// Run against a fresh in-memory database. See README.md in this directory.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
const {PGlite}=createRequire(import.meta.url)('@electric-sql/pglite');
const db=await PGlite.create();
const q=async(sql,args=[]) => (await db.query(sql,args)).rows;
const scalar=async(sql,args) => Object.values((await q(sql,args))[0])[0];
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const v='draft-2026-11-25';
let groups=0;
async function test(label,run){await run();console.log('PASS '+label);groups++;}
async function role(name='postgres',n=0){
 await db.exec('reset role');
 await q("select set_config('request.jwt.claim.sub',$1,false)",[n?id(n):'']);
 await db.exec('set role '+name);
}
const signup=n=>q('insert into auth.users(id,email_confirmed_at) values($1,now())',[id(n)]);
const activate=(n,adult=true,t=v,p=v,g=v)=>q('select public.v26_activate($1,$2,$3,$4,$5)',['tester'+n,adult,t,p,g]);
const publish=(kind='review',place='Kyoto',score=5,rights=true)=>q('select public.v26_publish($1,$2,$3,$4,$5,$6)',[kind,place,'Field note','An original test submission.',JSON.stringify(kind==='review'?{'Overall experience':score}:{}),rights]);
const moderate=(op,target)=>q('select public.v26_moderate($1,$2)',[op,target]);
const size=table=>scalar('select count(*)::int from '+table);
const report=post=>q('select public.v26_report($1,$2)',[post,'Please review this published item.']);
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 const dir=new URL('../database/migrations/',import.meta.url);
 for(const name of (await readdir(dir)).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile(new URL(name,dir),'utf8'));
 await test('Public registration and community start closed',async()=>{
  await assert.rejects(()=>signup(1),/registration is closed/i);await role('anon');
  const state=await scalar('select public.v26_state()');assert.equal(state.registration,false);assert.equal(state.community,false);
  assert.equal(await size('public.v26_feed()'),0);
  await assert.rejects(()=>q('select public.v26_admin()'),/permission denied/i);
  await assert.rejects(()=>q('select * from public.v26_records'),/permission denied/i);
 });
 await role();await db.exec('update voyage_private.settings set registration=true');
 for(let n=1;n<=6;n++)await signup(n);
 await q('insert into auth.users(id) values($1)',[id(7)]);await role('authenticated',7);
 await test('Unverified email cannot activate',()=>assert.rejects(()=>activate(7),/verify your email/i));
 await role('authenticated',1);
 await test('Age and each agreement required',async()=>{
  for(const values of [[false],[true,'old'],[true,v,null],[true,v,v,'old']])await assert.rejects(()=>activate(1,...values),/agreements and age/i);
  await assert.rejects(()=>q("insert into public.v26_records(kind,data) values('visit','{}')"),/row.level security/i);
 });
 for(let n=1;n<=6;n++){await role('authenticated',n);await activate(n);}
 await test('Versioned acceptance recorded with timestamp and retry is idempotent',async()=>{
  await role('authenticated',1);await activate(1);await role();assert.equal(await size('public.v26_acceptance where at is not null'),6);
 });
 await role('authenticated',1);
 const record=await scalar("insert into public.v26_records(kind,data) values('visit',$1) returning id",[JSON.stringify({name:'Kyoto'})]);
 await test('Private record isolation and staff restrictions',async()=>{
  await role('authenticated',2);assert.equal(await size('public.v26_records'),0);
  assert.deepEqual(await q("update public.v26_records set data='{}' where id=$1 returning id",[record]),[]);
  assert.deepEqual(await q("delete from public.v26_records where id=$1 returning id",[record]),[]);
  await assert.rejects(()=>q('select public.v26_admin()'),/administrator required/i);
  await assert.rejects(()=>moderate('approve',record),/administrator required/i);
  await role('authenticated',1);assert.equal((await scalar('select data from public.v26_records')).name,'Kyoto');
 });
 await test('Material change forces renewed acceptance',async()=>{
  await role();await db.exec("update voyage_private.settings set privacy='v2'");
  await role('authenticated',1);assert.equal(await size('public.v26_records'),0);
  await activate(1,true,v,'v2',v);assert.equal(await size('public.v26_records'),1);
  await role();await q('update voyage_private.settings set privacy=$1',[v]);
 });
 await test('Community gate, rights and rating validation',async()=>{
  await role('authenticated',1);await assert.rejects(()=>publish(),/Publishing unavailable/i);
  await role();await db.exec('update voyage_private.settings set community=true');await role('authenticated',1);
  await assert.rejects(()=>publish('review','Kyoto',5,false),/Publishing unavailable/i);
  await assert.rejects(()=>publish('review','Kyoto',6),/Invalid rating/i);
  await assert.rejects(()=>publish('review','    '),/Invalid rating/i);
 });
 await test('Pending reviews private and duplicates blocked',async()=>{
  await publish();await assert.rejects(()=>publish('review','kyoto'),/duplicate key/i);
  await role('anon');assert.equal(await size('public.v26_feed()'),0);
 });
 for(let n=2;n<=5;n++){await role('authenticated',n);await publish('review',n===5?'KYOTO':'Kyoto');}
 await role();
 const posts=await q("select id from public.v26_posts where status='pending'");
 await q('insert into voyage_private.staff(id) values($1)',[id(6)]);await role('authenticated',6);
 await test('Moderation and ranking threshold',async()=>{
  assert.equal((await scalar('select public.v26_admin()')).pending.length,5);
  for(const p of posts.slice(0,4))await moderate('approve',p.id);
  assert.equal(await size('public.v26_feed()'),4);assert.equal(await size('public.v26_rankings()'),0);
  await moderate('approve',posts[4].id);const results=await q('select * from public.v26_rankings()');
  assert.equal(results.length,1);assert.equal(Number(results[0].reviews),5);assert.equal(Number(results[0].average),5);
 });
 await test('Submission and report limits enforced',async()=>{
  await role('authenticated',1);
  for(let n=0;n<4;n++)await publish('story');
  await assert.rejects(()=>publish('story'),/Daily submission limit/i);
  for(let n=0;n<5;n++)await report(posts[0].id);
  await assert.rejects(()=>report(posts[0].id),/Daily report limit/i);
 });
 await test('Moderators can close reports, remove content and suspend accounts',async()=>{
  await role('authenticated',6);const first=(await scalar('select public.v26_admin()')).reports[0];
  await moderate('close report',first.id);await moderate('remove',posts[0].id);await moderate('suspend',id(2));
  assert.equal((await scalar('select public.v26_admin()')).reports.length,4);assert.equal(await size('public.v26_rankings()'),0);
  await role('authenticated',2);assert.equal(await scalar('select public.v26_active()'),false);
  await assert.rejects(()=>publish('review','Iceland'),/Publishing unavailable/i);
 });
 await test('Disposable snapshot restores data and owner isolation',async()=>{
  await role();const snapshot=await db.dumpDataDir();const restored=await PGlite.create({loadDataDir:snapshot});
  try{await restored.exec('set role authenticated');
   await restored.query("select set_config('request.jwt.claim.sub',$1,false)",[id(1)]);
   assert.equal((await restored.query('select data from public.v26_records')).rows[0].data.name,'Kyoto');
   await restored.query("select set_config('request.jwt.claim.sub',$1,false)",[id(3)]);
   assert.equal((await restored.query('select * from public.v26_records')).rows.length,0);
  }finally{await restored.close();}
 });
 await test('2,000-record quota isolates capacity by account',async()=>{
  await role('authenticated',4);
  await db.exec("insert into public.v26_records(kind,data) select 'visit','{}'::jsonb from generate_series(1,2000)");
  await assert.rejects(()=>q("insert into public.v26_records(kind,data) values('visit','{}')"),/Personal record quota/i);
  assert.equal(await size('public.v26_records'),2000);await role('authenticated',3);
  await db.exec("insert into public.v26_records(kind,data) values('trip','{}')");assert.equal(await size('public.v26_records'),1);
 });
 await test('Invited readers see only permitted fields and lose access on revocation',async()=>{
  await role('authenticated',3);const r=(await q("insert into public.v26_records(kind,data) values('trip',$1) returning id",[JSON.stringify({title:'Shared journey',bookings:'Private booking',stops:[]})]))[0].id;
  await q("select public.v26_share($1,'tester5',true)",[r]);await role('authenticated',5);
  assert.equal((await q('select * from public.v26_shared()'))[0].data.title,'Shared journey');assert.equal((await q('select * from public.v26_shared()'))[0].data.bookings,undefined);
  await assert.rejects(()=>q("select public.v26_share($1,'tester6',true)",[r]),/owner/i);
  await role('authenticated',3);await q("select public.v26_share($1,'tester5',false)",[r]);await role('authenticated',5);assert.equal(await size('public.v26_shared()'),0);
 });
 await test('Opt-in passport exposes only historical country stamps; block removes follow',async()=>{
  await role('authenticated',3);for(const [status,name] of [['Visited','Japan'],['Currently visiting','Private country']])await q("insert into public.v26_records(kind,data) values('visit',$1)",[JSON.stringify({status,place:{name,type:'Country'},Notes:'Private notes'})]);
  await role('anon');assert.equal(await scalar("select public.v26_passport('tester3')"),null);await role('authenticated',3);await q("select public.v26_privacy(true,true,'Midnight')");
  await role('authenticated',5);assert.deepEqual((await scalar("select public.v26_passport('tester3')")).stamps,['Japan']);await q("select public.v26_link('tester3','follow',true)");await role('authenticated',3);assert.equal((await scalar('select public.v26_social()')).followers[0].username,'tester5');
  await q("select public.v26_link('tester5','block',true)");await role('authenticated',5);assert.equal(await scalar("select public.v26_passport('tester3')"),null);assert.equal((await scalar('select public.v26_social()')).links.length,0);
 });
 await test('Private image gate, format validation, private export and admin pause',async()=>{
  const savePhoto=encoded=>q("insert into public.v26_records(kind,data) values('journal',$1)",[JSON.stringify({title:'Test album',photoRights:'accepted',photos:[encoded]})]);
  await role('authenticated',5);await assert.rejects(()=>savePhoto('data:image/webp;base64,UklGRg=='),/closed/i);await role();await db.exec('update voyage_private.settings set uploads=true');
  await role('authenticated',5);await assert.rejects(()=>savePhoto('data:image/webp;base64,UklGRg=='),/WebP/i);
  const valid='data:image/webp;base64,'+(await readFile(new URL('./photo-fixture.webp',import.meta.url))).toString('base64');await savePhoto(valid);
  assert.ok((await scalar('select public.v26_export()')).records.some(r=>r.data.photos?.[0]===valid));await role('authenticated',3);assert.ok(!(await scalar('select public.v26_export()')).records.some(r=>r.data.photos?.[0]===valid));await assert.rejects(()=>q('select public.v26_pause_uploads()'),/Administrator/i);
  await role('authenticated',6);await q('select public.v26_pause_uploads()');assert.equal((await scalar('select public.v26_ops()')).uploads,false);
 });
 await test('Comments require enabled feature and moderation; ratings aggregate approved reviews',async()=>{
  await role('authenticated',5);const post=(await q('select * from public.v26_feed()'))[0];await assert.rejects(()=>q("select public.v26_comment($1,'A test comment here.',true)",[post.id]),/Comments are closed/i);
  await role();await db.exec('update voyage_private.settings set comments=true');await role('authenticated',5);await q("select public.v26_comment($1,'A test comment here.',true)",[post.id]);await q("select public.v26_react($1,'save',true)",[post.id]);assert.ok((await scalar('select public.v26_social()')).saved.some(r=>r.id===post.id));
  await role('anon');assert.equal((await q("select * from public.v26_feed('comment',$1,0)",[post.id])).length,0);await role('authenticated',6);const pending=(await scalar('select public.v26_admin()')).pending.find(p=>p.kind==='comment');await moderate('approve',pending.id);await role('anon');assert.equal((await q("select * from public.v26_feed('comment',$1,0)",[post.id])).length,1);assert.ok((await q("select * from public.v26_scores('kyoto')")).length);
 });
 await test('Account deletion requires confirmation and cascades',async()=>{
  await role('authenticated',1);
  await assert.rejects(()=>q("select public.v26_delete_account('cancel')"),/Confirmation required/i);
  await q("select public.v26_delete_account('DELETE')");await role();
  for(const [table,key] of [['auth.users','id'],['public.v26_profiles','id'],['public.v26_records','owner'],['public.v26_acceptance','id'],['public.v26_posts','owner']]){
   assert.equal(await scalar('select count(*)::int from '+table+' where '+key+'=$1',[id(1)]),0);
  }
 });
 console.log(groups+' integration groups passed');
}finally{await db.close();}

