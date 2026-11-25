'use strict';
const local=Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const zones=[...new Set(['UTC',local,...(Intl.supportedValuesOf?.('timeZone')||['Asia/Dhaka','Asia/Tokyo','Asia/Kolkata','Asia/Kathmandu','Africa/Nairobi','Australia/Sydney','Europe/London','America/Toronto','America/New_York'])])].sort();
const q=id=>document.getElementById(id),from=q('from'),to=q('to'),when=q('when');
for(const box of [from,to])for(const zone of zones)box.add(new Option(zone.replaceAll('_',' '),zone));
from.value=local;to.value=local==='Europe/London'?'UTC':'Europe/London';
function wall(epoch,zone){
 const fmt=new Intl.DateTimeFormat('en-GB-u-nu-latn',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const p=Object.fromEntries(fmt.formatToParts(epoch).map(v=>[v.type,v.value]));
 return p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute;
}
function instants(time,zone){
 const nominal=Date.parse(time+'Z');
 if(!Number.isFinite(nominal))return [];
 const offsets=new Set([-36,-12,0,12,36].map(hour=>{const v=nominal+hour*3600000;return Date.parse(wall(v,zone)+'Z')-v}));
 return [...offsets].map(o=>nominal-o).filter(t=>wall(t,zone)===time).sort((a,b)=>a-b);
}
function convert(){
 if(!when.value){q('answer').textContent='Select a date and time.';return;}
 const values=instants(when.value,from.value);
 const fmt=new Intl.DateTimeFormat(undefined,{timeZone:to.value,year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'});
 q('answer').textContent=values.length===0?'This local time does not occur in the selected zone. Choose another time.':values.length===1?fmt.format(values[0]):'The source clock repeats this time. Earlier: '+fmt.format(values[0])+' · Later: '+fmt.format(values[1]);
}
function now(){when.value=wall(Date.now(),from.value);convert()}
[from,to,when].forEach(el=>el.addEventListener('input',convert));q('now').addEventListener('click',now);now();
const checks=[...document.querySelectorAll('input[type=checkbox]')];
function progress(){q('ready').textContent=checks.filter(el=>el.checked).length+' of '+checks.length+' ready';}
checks.forEach(el=>el.addEventListener('change',progress));progress();q('print').addEventListener('click',()=>window.print());
