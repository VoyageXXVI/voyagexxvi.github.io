/* VoyageXXVI local atlas. Data and raster provenance in atlas/credits.json. */
(() => {
'use strict';
const base=new URL('atlas/',document.currentScript.src),R=Math.PI/180;
const load=n=>fetch(new URL(n+'.json',base)).then(r=>{if(!r.ok)throw Error(n);return r.json()});
const places=window.atlasPlaces=load('places'),clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),wrap=x=>((x+180)%360+360)%360-180;
const raster=n=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=new URL(n+'.webp',base)});
const imageTasks={earth:raster('earth'),land:raster('land'),night:raster('night')};
const shapeCache={};
function shapes(n){
 return shapeCache[n] ||= load(n).then(a=>a.map(([id,rings])=>{
  const path=new Path2D(),boxes=[];
  for(const ring of rings){let b=[180,90,-180,-90];for(let i=0;i<ring.length;i+=2){const x=ring[i]/100,y=ring[i+1]/100;
    if(!i)path.moveTo(x,-y);else path.lineTo(x,-y);
    b=[Math.min(b[0],x),Math.min(b[1],y),Math.max(b[2],x),Math.max(b[3],y)];
  }boxes.push(b);}return {id,path,boxes};
 }));
}
const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const colors={provinces:'#e8d8b3',rivers:'#5db9eb',lakes:'#73c1d8',seas:'#83b6c7',disputed:'#ffc77d',parks:'#99d996'};
window.AtlasMount=function(el,op={}){
 const view=canvas(1,1),tex=canvas(2048,1024),sphere=canvas(1,1),hitter=canvas(1,1).getContext('2d');
 const ctx=view.getContext('2d'),tc=tex.getContext('2d',{willReadFrequently:true}),sphereCtx=sphere.getContext('2d');
 Object.assign(view.style,{width:'100%',height:'100%',display:'block',touchAction:'none',cursor:'grab'});view.tabIndex=0;view.ariaLabel='Interactive Earth. Move with arrow keys and zoom with plus or minus.';el.append(view);
 let mode=op.mode||'globe',style='satellite',lon=29,lat=20,z=1,alpha=.85,pause=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let dirty=true,texDirty=true,dead=false,last=0,delay=0,frame=0,hover='',sel='',external=null,pixels,lookup,bitmap,nights,projectionKey='',dpr=1;
 let curated=null,geo={},images={},catalog=[],index={},hitpoints=[],personal={visits:[],routes:[]};
 let L={borders:true,disputed:true,grid:false,day:true,night:false,visited:true,planned:true,wishlist:true,routes:true};
 let streetMap=null,streetHost=null,streetAttempt=0,streetOffline=false;
 function closeStreet(){streetAttempt++;streetMap?.remove();streetMap=null;streetHost?.remove();streetHost=null;}
 function streetCheck(){
  closeStreet();if(mode!=='map'||style!=='street'||dead)return;
  if(!navigator.onLine){announceFallback();return;}
  const attempt=streetAttempt,host=document.createElement('div');streetHost=host;
  Object.assign(host.style,{position:'absolute',inset:'0',opacity:'0',pointerEvents:'none',background:'#18333d'});
  el.append(host);
  const select=p=>{sel=p.id||'';external=p;op.onSelect?.(p);};
  const fallback=()=>{if(attempt!==streetAttempt)return;closeStreet();announceFallback();dirty=true;};
  import(new URL('street.mjs',base)).then(m=>m.street(host,{
    center:[lon,lat],zoom:Math.max(1,Math.log2(z)+1),state:()=>({personal,layers:L,external}),
    ready:()=>{if(attempt===streetAttempt){host.style.opacity='1';host.style.pointerEvents='auto';if(external)streetMap?.focus(external);}},
    move:(center,zoom)=>{lon=wrap(center.lng);lat=center.lat;z=clamp(2**(zoom-1),.65,32);dirty=true},
    fail:fallback,onCoordinate:p=>op.onCoordinate?.(p),select,
    lookup:(name,pt)=>catalog.filter(p=>p.name.toLowerCase()===String(name).toLowerCase()).sort((a,b)=>Math.abs(a.lat-pt.lat)+Math.abs(wrap(a.lon-pt.lon))-Math.abs(b.lat-pt.lat)-Math.abs(wrap(b.lon-pt.lon)))[0],
    pickLocal:pos=>{const p=pick(pos);if(p)select(p);}
  })).then(map=>{if(attempt===streetAttempt)streetMap=map;else map.remove();}).catch(fallback);
 }
 function announceFallback(){
   if(streetOffline)return;streetOffline=true;const notice=document.createElement('div');notice.setAttribute('role','status');notice.textContent='Street tiles unavailable · Local atlas';
   Object.assign(notice.style,{position:'absolute',top:'8px',left:'8px',padding:'5px 9px',background:'#152d36',color:'#fff',font:'12px system-ui'});el.append(notice);setTimeout(()=>{notice.remove();streetOffline=false;},5500);
 }
 const pointers=new Map();let drag=null,pinch=0;
 const flags=['countries','provinces','rivers','lakes','seas','parks','disputed'];
 const waitFor=n=>{if(!flags.includes(n)||geo[n])return;shapes(n).then(v=>{geo[n]=v;dirty=texDirty=true}).catch(()=>{})};
 waitFor('countries');waitFor('disputed');places.then(p=>{catalog=p;index=Object.fromEntries(p.map(q=>[q.id,q]));dirty=true});
 Object.entries(imageTasks).forEach(([k,v])=>v.then(im=>{images[k]=im;if(k==='night'){const n=canvas(2048,1024),c=n.getContext('2d');c.drawImage(im,0,0,2048,1024);nights=c.getImageData(0,0,2048,1024).data;}dirty=texDirty=true}).catch(()=>{}));
 const rad=()=>Math.min(view.width,view.height)*.465*z,unit=()=>Math.min(view.width/360,view.height/180)*z;
 function rebuild(){
  tc.setTransform(1,0,0,1,0,0);
  const imagery=style==='satellite'||style==='physical',im=L.night&&mode==='globe'?images.night:style==='satellite'&&mode==='globe'?images.earth:images.land;
  tc.fillStyle=style==='vintage'?'#bac5ae':style==='minimal'?'#d2e0dc':'#173748';tc.fillRect(0,0,2048,1024);if(imagery&&im)tc.drawImage(im,0,0,2048,1024);
  tc.setTransform(2048/360,0,0,2048/360,1024,512);tc.lineJoin='round';tc.lineCap='round';
  const fills=['#667f68','#a19875','#548276','#809277','#acaa85','#65867b'];
  const fillsByPlace=new Map();
  for(const v of personal.visits||[]){
   const k=/want|wish/i.test(v.status)?'wishlist':/plan/i.test(v.status)?'planned':'visited';
   if(!L[k]||!v.place||!['Country','Territory','Disputed region','Associated state','Other atlas area','Indeterminate region'].includes(v.place.type))continue;
   const color=/^#[a-f0-9]{3}([a-f0-9]{3})?$/i.test(v.color||'')?v.color:k==='visited'?'#69bf9e':k==='planned'?'#d2aa70':'#ab99ca';
   fillsByPlace.set(v.place.id||v.place.name,color);
  }
  for(const [i,f] of (geo.countries||[]).entries()){
   if(!imagery||!im){tc.fillStyle=style==='dark'?'#345451':style==='minimal'?'#eaeada':fills[i%fills.length];tc.fill(f.path,'evenodd');}
   const recordedColor=fillsByPlace.get(f.id)||fillsByPlace.get(index[f.id]?.name);
   if(recordedColor){tc.globalAlpha=.53*alpha;tc.fillStyle=recordedColor;tc.fill(f.path,'evenodd');tc.globalAlpha=1;}
   if(f.id===sel||f.id===hover){tc.fillStyle='#edc67a66';tc.fill(f.path,'evenodd');}
   if(L.borders){tc.lineWidth=.12;tc.strokeStyle=imagery?'#eddec978':'#29392cbb';tc.stroke(f.path);}
  }
  tc.globalAlpha=alpha;
  for(const k of flags.slice(1))if(L[k]&&geo[k]){tc.strokeStyle=colors[k];tc.lineWidth=k==='disputed'?.31:.17;tc.setLineDash(k==='disputed'?[.56,.35]:[]);for(const f of geo[k]){
   if(['parks','lakes','seas'].includes(k)){tc.fillStyle=colors[k]+(k==='seas'?'19':'6a');tc.fill(f.path,'evenodd');}tc.stroke(f.path);
  }}
  tc.setLineDash([]);if(L.grid){tc.beginPath();for(let x=-180;x<=180;x+=15){tc.moveTo(x,-90);tc.lineTo(x,90)}for(let y=-90;y<=90;y+=15){tc.moveTo(-180,y);tc.lineTo(180,y)}tc.strokeStyle='#c4dad777';tc.lineWidth=.11;tc.stroke();}
  tc.globalAlpha=1;tc.setTransform(1,0,0,1,0,0);pixels=tc.getImageData(0,0,2048,1024).data;texDirty=false;
 }
 function globe(){
  const radius=rad(),size=clamp(Math.ceil(radius*2),100,pointers.size?650:1050),key=[size,lat,L.day,L.night].join(':');
  if(key!==projectionKey){
   projectionKey=key;sphere.width=sphere.height=size;bitmap=sphereCtx.createImageData(size,size);lookup=new Int32Array(size*size*2);const c=Math.cos(lat*R),s=Math.sin(lat*R);
   for(let y=0,i=0;y<size;y++)for(let x=0;x<size;x++,i++){
    const X=(x+.5-size/2)/(size/2),Y=(size/2-y-.5)/(size/2),d=X*X+Y*Y;if(d>=1){lookup[i*2]=-1;continue;}
    const Z=Math.sqrt(1-d),latitude=Math.asin(clamp(Y*c+Z*s,-1,1)),longitude=Math.atan2(X,Z*c-Y*s);
    const sx=Math.floor((.5+longitude/(2*Math.PI))*2048)&2047,sy=clamp(Math.floor((.5-latitude/Math.PI)*1024),0,1023);
    const lit=Math.max(0,(-.70*X+.63*Y+.68*Z)/1.16),brightness=L.night?.95:L.day?.23+.98*Math.pow(lit,.72):1,edge=Math.pow(1-Z,3),shade=clamp(Math.round((1-lit*3)*31),0,31);
    lookup[i*2]=(sy<<11)|sx;lookup[i*2+1]=Math.round(brightness*128)|(Math.round((.48+.52*lit)*edge*255)<<8)|(shade<<16);bitmap.data[i*4+3]=255;
   }
  }
  const shift=Math.round(lon/360*2048),out=bitmap.data,lights=L.day&&!L.night&&style==='satellite'&&nights;
  for(let i=0;i<bitmap.data.length/4;i++){const loc=lookup[2*i];if(loc<0)continue;const j=((loc&~2047)|((loc+shift)&2047))*4,mask=lookup[2*i+1],br=(mask&255)/128,edge=((mask>>8)&255)/255,lamp=lights?Math.max(0,nights[j]-65)*((mask>>16)/31)*.75:0;
   out[4*i]=pixels[j]*br+edge*42+lamp;out[4*i+1]=pixels[j+1]*br+edge*104+lamp*.75;out[4*i+2]=pixels[j+2]*br+edge*170+lamp*.34;
  }
  sphereCtx.putImageData(bitmap,0,0);const cx=view.width/2,cy=view.height/2;ctx.save();ctx.shadowBlur=9*dpr;ctx.shadowColor='#5ca2e2';ctx.drawImage(sphere,cx-radius,cy-radius,radius*2,radius*2);ctx.restore();
 }
 function project(p){
  const dx=wrap(p.lon-lon),w=view.width,h=view.height;if(mode==='map')return [w/2+dx*unit(),h/2-(p.lat-lat)*unit()];
  const s=Math.sin(p.lat*R),c=Math.cos(p.lat*R),sl=Math.sin(lat*R),cl=Math.cos(lat*R);if(s*sl+c*cl*Math.cos(dx*R)<.01)return null;
  return [w/2+rad()*c*Math.sin(dx*R),h/2-rad()*(s*cl-c*sl*Math.cos(dx*R))];
 }
 function inverse(x,y){const w=view.width,h=view.height;if(mode==='map'){let a=lat-(y-h/2)/unit();return Math.abs(a)<=90?{lon:wrap(lon+(x-w/2)/unit()),lat:a}:null;}
  const X=(x-w/2)/rad(),Y=(h/2-y)/rad(),d=X*X+Y*Y;if(d>1)return null;const Z=Math.sqrt(1-d),s=Math.sin(lat*R),c=Math.cos(lat*R);return {lon:wrap(lon+Math.atan2(X,Z*c-Y*s)/R),lat:Math.asin(clamp(Y*c+Z*s,-1,1))/R};
 }
 const usable=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon);
 function decorate(){hitpoints=[];
  if(L.routes){ctx.save();ctx.setLineDash([4*dpr,3*dpr]);ctx.strokeStyle='#f1be71';ctx.lineWidth=1.5*dpr;
   for(const route of personal.routes||[]){let prev=null;ctx.beginPath();for(const stop of route.stops||[]){const p=stop.place||stop;if(!usable(p)){prev=null;continue;}const q=project(p);if(q){if(prev&&Math.abs(prev[0]-q[0])<view.width*.5)ctx.lineTo(...q);else ctx.moveTo(...q);}prev=q;}ctx.stroke();}ctx.restore();
  }
  const groups=new Map();function mark(p,color,alone=false){if(!usable(p))return;const q=project(p);if(!q||q[0]<0||q[1]<0||q[0]>view.width||q[1]>view.height)return;
   const key=alone?'p:'+p.name:Math.floor(q[0]/(32*dpr))+','+Math.floor(q[1]/(32*dpr));if(!groups.has(key))groups.set(key,{q,p,color,n:0,alone});groups.get(key).n++;
  }
  for(const p of curated||[]){
   if(L.attractions || (L.historical && p.tags?.includes('Historical sites')) || (L.islands && ['Island','Archipelago'].includes(p.type)))mark(p,'#edb38b');
  }
  for(const p of catalog)if(['cities','airports','mountains','regions'].includes(p.layer)&&L[p.layer])mark(p,'#deb17a');
  for(const v of personal.visits||[]){const k=/want|wish/i.test(v.status)?'wishlist':/plan/i.test(v.status)?'planned':'visited';if(L[k])mark(v.place,/^#[a-f0-9]{3,8}$/i.test(v.color||'')?v.color:'#93d7bc',true);}
  if(external)mark(external,'#ffcf83',true);
  for(const a of groups.values()){const {q,p,n,color,alone}=a,r=(alone?4:n>1?8:3)*dpr;ctx.beginPath();ctx.arc(...q,r,0,Math.PI*2);ctx.fillStyle=n>1&&!alone?'#234a50':color;ctx.strokeStyle='#eac695';ctx.lineWidth=dpr;ctx.fill();ctx.stroke();ctx.fillStyle='white';ctx.textBaseline='middle';ctx.font=(10*dpr)+'px system-ui';ctx.textAlign='center';if(n>1&&!alone)ctx.fillText(n,...q);else if(alone||z>3){ctx.textAlign='left';ctx.strokeStyle='#15242a';ctx.lineWidth=3*dpr;ctx.strokeText(p.name||'',q[0]+8*dpr,q[1]);ctx.fillText(p.name||'',q[0]+8*dpr,q[1]);}hitpoints.push(a);}
  if(mode==='map'&&L.borders){const occupied=new Set();ctx.font='500 '+(Math.min(14,11+Math.log2(Math.max(z,1))*.5)*dpr)+'px system-ui';ctx.textAlign='center';ctx.fillStyle='#fff6db';ctx.lineWidth=2.4*dpr;ctx.strokeStyle='#29413b';for(const f of geo.countries||[]){const p=index[f.id];if(!p)continue;const q=project(p),k=Math.round(q[0]/(85*dpr))+','+Math.round(q[1]/(30*dpr));if(occupied.has(k))continue;occupied.add(k);ctx.strokeText(p.name,...q);ctx.fillText(p.name,...q);}}
 }
 // The flat atlas paints projected paths in the current viewport. Zooming never enlarges a rasterized political map.
 let detailed=null,detailTask=null,hdLand=null,landTask=null;
 function requestDetail(){
  detailTask??=import(new URL('detail.mjs',base)).then(m=>m.highDetail(new URL('countries-10m.bin',base))).then(v=>{detailed=v;dirty=true}).catch(()=>{});
  if(style==='satellite'||style==='physical')landTask??=raster('land-5400').then(v=>{hdLand=v;dirty=true}).catch(()=>{});
 }
 function drawFlat(){
  requestDetail();const w=view.width,h=view.height,u=unit(),px=dpr/u;
  ctx.fillStyle=style==='minimal'?'#d5e5e5':style==='vintage'?'#b6c6b9':style==='dark'?'#142d3b':'#193c50';ctx.fillRect(0,0,w,h);
  const physical=(style==='physical'||style==='satellite')&&(hdLand||images.land);
  const countryColors=['#829c83','#b3ae8f','#799c8a','#8ca796','#a7ae91','#91a38b'];
  const overlay=new Map();
  for(const v of personal.visits||[]){const group=/want|wish/i.test(v.status)?'wishlist':/plan/i.test(v.status)?'planned':'visited';if(L[group]&&v.place&&/^#[0-9a-f]{6}$/i.test(v.color||''))overlay.set(v.place.id,v.color)}
  const west=lon-w/(2*u),east=lon+w/(2*u),south=lat-h/(2*u),north=lat+h/(2*u);
  for(let copy=Math.floor((west+180)/360);copy<=Math.floor((east+180)/360);copy++){
   const shift=copy*360,visible=f=>f.boxes.some(b=>b[2]+shift>=west&&b[0]+shift<=east&&b[3]>=south&&b[1]<=north);
   ctx.save();ctx.setTransform(u,0,0,u,w/2-(lon-shift)*u,h/2+lat*u);ctx.lineCap='round';ctx.lineJoin='round';
   if(physical){ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(physical,-180,-90,360,180)}
   for(const f of detailed||geo.countries||[]){if(!visible(f))continue;
    if(!physical){const colorIndex=Array.from(f.id).reduce((a,c)=>a+c.charCodeAt(0),0)%countryColors.length;
     ctx.fillStyle=style==='dark'?'#34544f':style==='minimal'?'#edeee4':countryColors[colorIndex];ctx.fill(f.path,'evenodd')}
    const personalColor=overlay.get(f.id);if(personalColor){ctx.globalAlpha=.55*alpha;ctx.fillStyle=personalColor;ctx.fill(f.path,'evenodd');ctx.globalAlpha=1}
    if(f.id===sel||f.id===hover){ctx.fillStyle='#f2c77d62';ctx.fill(f.path,'evenodd')}
    if(L.borders){ctx.lineWidth=.78*px;ctx.strokeStyle=physical?'#fff2cee0':style==='dark'?'#abc2aa':'#374e4b';ctx.stroke(f.path)}
   }
   ctx.globalAlpha=alpha;
   for(const k of flags.slice(1)){if(!L[k]||!geo[k])continue;ctx.strokeStyle=colors[k];ctx.lineWidth=(k==='disputed'?1.65:1)*px;ctx.setLineDash(k==='disputed'?[4*px,3*px]:[]);for(const f of geo[k]){if(!visible(f))continue;if(['lakes','parks','seas'].includes(k)){ctx.fillStyle=colors[k]+(k==='seas'?'20':'76');ctx.fill(f.path,'evenodd')}ctx.stroke(f.path)}}
   ctx.setLineDash([]);if(L.grid){ctx.strokeStyle='#7899a377';ctx.lineWidth=.6*px;ctx.beginPath();for(let x=-180;x<=180;x+=15){ctx.moveTo(x,-90);ctx.lineTo(x,90)}for(let y=-90;y<=90;y+=15){ctx.moveTo(-180,y);ctx.lineTo(180,y)}ctx.stroke()}
   ctx.restore()
  }
 }
 function draw(t){
  if(dead)return;frame=requestAnimationFrame(draw);if(!el.clientWidth||!el.clientHeight||document.hidden)return;
  const rotate=mode==='globe'&&!pause&&!pointers.size&&t>delay;if(!dirty&&(!rotate||t-last<65))return;
  if(rotate&&last)lon=wrap(lon+.76*Math.min(t-last,200)/1000);last=t;const w=Math.round(el.clientWidth*dpr),h=Math.round(el.clientHeight*dpr);if(w!==view.width||h!==view.height){view.width=w;view.height=h;}
  ctx.clearRect(0,0,w,h);
  if(mode==='globe'){if(texDirty)rebuild();globe()}else drawFlat();
  decorate();dirty=false;
 }
 function pick(pos){if(!pos)return null;for(const k of ['disputed','rivers','parks','lakes','provinces','countries','seas'])if(k==='countries'||L[k])for(const f of (k==='countries'&&mode==='map'&&detailed?detailed:geo[k])||[]){const line=['disputed','rivers'].includes(k),slop=line?(mode==='map'?3*dpr/unit():.7/z):0,x=pos.lon,y=pos.lat;if(!f.boxes.some(b=>x>=b[0]-slop&&x<=b[2]+slop&&y>=b[1]-slop&&y<=b[3]+slop))continue;if(line)hitter.lineWidth=2*slop;if(line?hitter.isPointInStroke(f.path,x,-y):hitter.isPointInPath(f.path,x,-y,'evenodd')){if(index[f.id])return index[f.id];}}return null;}
 const xy=e=>{const b=view.getBoundingClientRect();return [(e.clientX-b.left)*dpr,(e.clientY-b.top)*dpr]};
 function zoom(n){if(streetMap){streetMap.zoom(n);return;}if(n>0&&Number.isFinite(n)){z=clamp(z*n,.65,mode==='map'?32:3);dirty=true;delay=performance.now()+7000;}}
 function tap(q){const pos=inverse(...q);if(pos&&op.onCoordinate?.(pos)===true)return;
  const a=hitpoints.slice().reverse().find(it=>Math.hypot(it.q[0]-q[0],it.q[1]-q[1])<13*dpr);if(a?.n>1&&!a.alone){lon=a.p.lon;lat=a.p.lat;zoom(1.8);return;}
  const p=a?.p||pick(pos);if(p){sel=p.id||'';external=p;texDirty=dirty=true;delay=performance.now()+9000;op.onSelect?.(p);}
 }
 view.onpointerdown=e=>{view.setPointerCapture(e.pointerId);pointers.set(e.pointerId,xy(e));drag={start:xy(e),moved:false};if(pointers.size===2){const [a,b]=[...pointers.values()];pinch=Math.hypot(a[0]-b[0],a[1]-b[1]);drag.moved=true;}view.style.cursor='grabbing';};
 view.onpointermove=e=>{const q=xy(e),prev=pointers.get(e.pointerId);if(!prev){if(e.pointerType==='mouse'){const p=pick(inverse(...q));if((p?.id||'')!==hover){hover=p?.id||'';texDirty=dirty=true;}view.style.cursor=p?'pointer':'grab';delay=performance.now()+1200;}return;}
  pointers.set(e.pointerId,q);if(pointers.size===2){const [a,b]=[...pointers.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch)zoom(d/pinch);pinch=d;return;}
  if(!drag)return;if(Math.hypot(q[0]-drag.start[0],q[1]-drag.start[1])>3*dpr)drag.moved=true;
  if(drag.moved){const u=mode==='map'?1/unit():.85/(rad()*R);lon=wrap(lon-(q[0]-prev[0])*u);lat=clamp(lat+(q[1]-prev[1])*u,-89,89);delay=performance.now()+7000;dirty=true;}
 };
 view.onpointerup=e=>{if(drag&&!drag.moved&&pointers.size===1)tap(xy(e));pointers.delete(e.pointerId);if(!pointers.size)drag=null;view.style.cursor='grab';};
 view.onpointercancel=e=>{pointers.delete(e.pointerId);drag=null};view.onpointerleave=()=>{if(hover){hover='';texDirty=dirty=true;}};
 view.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(-clamp(e.deltaY,-100,100)*.003));},{passive:false});
 view.onkeydown=e=>{if(['+','=','-'].includes(e.key)){e.preventDefault();zoom(e.key==='-'?.8:1.25);}else if(e.key.startsWith('Arrow')){e.preventDefault();const n=8/z;lon=wrap(lon+(e.key==='ArrowLeft'?-n:e.key==='ArrowRight'?n:0));lat=clamp(lat+(e.key==='ArrowDown'?-n:e.key==='ArrowUp'?n:0),-89,89);delay=performance.now()+7000;dirty=true;}};
 const observer=new ResizeObserver(()=>{dpr=Math.min(devicePixelRatio||1,3,Math.sqrt(10000000/Math.max(1,el.clientWidth*el.clientHeight)));streetMap?.resize();dirty=true;});observer.observe(el);frame=requestAnimationFrame(draw);
 return {zoom,mode(m){if(m===mode)return;mode=m;this.reset();streetCheck();view.animate?.([{opacity:.15},{opacity:1}],{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:500});},reset(){streetMap?.reset();z=1;lon=mode==='map'?0:29;lat=mode==='map'?0:20;sel=hover='';external=null;dirty=texDirty=true;},
  focus(p){if(usable(p)){external=p;streetMap?.focus(p);lon=p.lon;lat=p.lat;sel=p.id||'';external=p;z=mode==='map'?(p.type==='Country'?4:12):1;delay=performance.now()+12000;dirty=texDirty=true;}},
  layer(k,v){L[k]=!!v;streetMap?.push();if(v&&['attractions','historical','islands'].includes(k)&&curated===null){curated=[];load('landmarks').then(p=>{curated=p;dirty=true;}).catch(()=>{curated=null;});}if(v)waitFor(k);dirty=texDirty=true;},style(n){if(style===n)return;style=n;streetCheck();dirty=texDirty=true;},opacity(v){alpha=clamp(Number(v),0,1);dirty=texDirty=true;},pause(v){pause=!!v;dirty=true;},
  personal(data){personal={visits:data?.visits||[],routes:data?.routes||[]};streetMap?.push();dirty=texDirty=true;},destroy(){dead=true;closeStreet();observer.disconnect();cancelAnimationFrame(frame);view.remove();}
 };
};
})();
