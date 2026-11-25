import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
const dist=new URL('../dist/',import.meta.url);
const context={
  window:{},document:{currentScript:{src:new URL('discovery.js',dist).href}},URL,Intl,
  fetch:async url=>({ok:true,json:async()=>JSON.parse(await readFile(fileURLToPath(url),'utf8'))})
};
vm.runInNewContext(await readFile(new URL('discovery.js',dist),'utf8'),context);
const app=context.window;
await app.VoyageFactsReady;
const landmarks=await app.VoyageLandmarksReady;
test('country facts belong to the containing country; a mountain region can span countries',()=>{
  const france=app.VoyageFacts({name:'France',type:'Country',iso2:'FR'});
  assert.equal(france.currencyCode,'EUR');
  assert(france.timeZones.includes('Europe/Paris'));
  assert.equal(app.VoyageFacts(app.featuredPlaces[1]).scope,'Japan');
  assert.equal(app.VoyageFacts(app.featuredPlaces[3]),null);
});
test('nearby results use a spherical estimate and exclude the reference place',()=>{
  const reference={id:'a',name:'Origin',lat:0,lon:179.8,type:'City'};
  const neighbor={id:'b',name:'Next',lat:0,lon:-179.8,type:'City'};
  const results=app.VoyageNearby(reference,[reference,neighbor]);
  assert.equal(results.length,1);assert(results[0].distanceKm>44&&results[0].distanceKm<45);
});
test('every imported Wikidata landmark carries a traceable id and bounded coordinates',()=>{
  assert(landmarks.length>0);
  for(const p of landmarks){assert.match(p.wikidata,/^Q\d+$/);assert.equal(p.id,'wd-'+p.wikidata);assert(p.lat>=-90&&p.lat<=90);assert(p.lon>=-180&&p.lon<=180);assert(p.tags.length>0)}
});
test('all four destination photo assets are bundled',async()=>{
  for(const p of app.featuredPlaces)assert((await readFile(fileURLToPath(p.image))).length>300);
});
