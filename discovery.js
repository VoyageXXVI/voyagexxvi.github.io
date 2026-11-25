(() => {
  'use strict';
  const base = new URL('.',document.currentScript.src);
  const featured = [
    {name:'Iceland', id:'ISL', iso2:'IS', lat:64.7793,lon:-18.6737,region:'Europe',type:'Country',capital:'Reykjavík',tags:['Islands','Nature','Photography'],description:'Glaciers, volcanic terrain and long stretches of North Atlantic coast.'},
    {name:'Kyoto',id:'1159149967',country:'Japan',lat:35.0319,lon:135.7481,region:'Asia',type:'City',tags:['Architecture','Religious heritage','Cultural experiences'],description:'Temple gardens, timber townhouses and riverside walks in Japan’s former capital.'},
    {name:'Dolomites',id:'wd-Q1283',country:'Italy',lat:46.61306,lon:12.16306,region:'Europe',type:'Mountain',tags:['Mountains','Nature','Photography'],description:'Limestone peaks and alpine valleys in north-eastern Italy.'},
    {name:'Patagonia',id:'wd-Q1507',lat:-41,lon:-68,region:'South America',type:'Geographical region',tags:['Nature','Adventure','Mountains'],description:'A region of steppe, ice fields and mountains across southern Argentina and Chile.'}
  ];
  window.featuredPlaces=featured.map(p=>({...p,slug:p.name.toLowerCase(),image:new URL('photos/'+p.name.toLowerCase()+'.webp',base).href}));
  const norm = value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const load = file=>fetch(new URL('atlas/'+file,base)).then(r=>{if(!r.ok)throw Error('Unavailable');return r.json()}).catch(()=>[]);
  window.VoyageLandmarksReady=load('landmarks.json');
  const countryFacts=new Map();
  window.VoyageFactsReady=load('country-facts.json').then(rows=>{for(const p of rows)for(const n of [p.iso2,p.iso3,p.name])countryFacts.set(norm(n),p);return rows.length>0});
  const aliases={'united states of america':'us','democratic republic of the congo':'cd','republic of the congo':'cg','united republic of tanzania':'tz','north korea':'kp','south korea':'kr','ivory coast':'ci','the bahamas':'bs','republic of serbia':'rs','east timor':'tl'};
  const translated=new Intl.DisplayNames(['en'],{type:'language'});
  window.VoyageFacts=p=>{
    if(!p)return null;
    const parent=norm(p.country),area=['Country','Territory','Disputed region','Indeterminate region'].includes(p.type);
    const f=(area&&(countryFacts.get(norm(p.iso2))||countryFacts.get(norm(p.id))||countryFacts.get(norm(p.name))))||countryFacts.get(parent)||countryFacts.get(aliases[parent]);
    if(!f)return null;
    const languages=[...new Set(f.languageCodes.map(s=>s.split('-')[0]))].map(s=>{try{return translated.of(s)}catch{return s}});
    return {...f,languages,scope:f.name,acquired:'2026-11-25',source:'GeoNames and IANA'};
  };
  const radians=n=>n*Math.PI/180;
  const distance=(a,b)=>{
    const d=Math.sin(radians(b.lat-a.lat)/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(radians(b.lon-a.lon)/2)**2;
    return 12742.0176*Math.asin(Math.sqrt(Math.min(d,1)));
  };
  window.VoyageNearby=(p,places,limit=5)=>places.filter(n=>n.id!==p.id&&n.name!==p.name&&Number.isFinite(n.lat)&&Number.isFinite(n.lon)&&['City','Mountain','Protected area','Lake','Landmark','Museum','Beach'].includes(n.type)).map(n=>({...n,distanceKm:distance(p,n)})).sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,limit);
  const element=(tag,cls='',text='')=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n};
  const action=(label,fn,cls='vd-btn')=>{const n=element('button',cls,label);n.type='button';n.onclick=fn;return n};
  const key=p=>p.type+':'+(p.id??p.name);
  const baseTags=p=>p.tags||({Mountain:['Mountains','Nature'],Lake:['Nature'],River:['Nature'],'Protected area':['Nature'],City:['Cities'],Country:['Countries'],Territory:['Territories']}[p.type])||[];
  const tags=p=>p.heritage?[...baseTags(p),'World Heritage']:baseTags(p);
  window.VoyageDiscover=async(container,{places=[],openPlace,initialQuery=''}={})=>{
    const root=element('section','vd');
    container.replaceChildren(root);
    root.append(element('h1','','Explore destinations'));
    const available=new Map();
    for(const p of [...places,...await window.VoyageLandmarksReady,...window.featuredPlaces])available.set(key(p),{...available.get(key(p)),...p});
    const all=[...available.values()].sort((a,b)=>Number(Boolean(b.image))-Number(Boolean(a.image))||a.name.localeCompare(b.name));
    const controls=element('div','vd-filters'),selection=element('div','vd-selection'),grid=element('div','vd-results'),summary=element('div','vd-summary'),count=element('strong');
    count.setAttribute('aria-live','polite');
    const search=element('input');search.type='search';search.placeholder='Search destinations';search.value=initialQuery;
    const picker=(values,prompt)=>{const s=element('select');s.append(new Option(prompt,''));[...new Set(values.filter(Boolean))].sort().forEach(v=>s.append(new Option(v,v)));return s};
    const region=picker(all.map(p=>p.region),'All regions'),type=picker(all.map(p=>p.type),'All features'),interest=picker(all.flatMap(tags),'All interests');
    for(const [label,input] of [['Find a place',search],['Region',region],['Feature',type],['Interest',interest]]){const l=element('label','vd-field');l.append(element('span','',label),input);controls.append(l)}
    let matches=[],limit=24;const selected=new Map();
    const surprise=action('Surprise me',()=>{if(matches.length)openPlace(matches[Math.floor(Math.random()*matches.length)])},'vd-btn vd-primary');
    controls.append(surprise);
    const more=action('Show more places',()=>{limit+=24;render()});
    const compare=element('dialog','vd-compare');compare.setAttribute('aria-label','Compare destinations');compare.onclick=e=>{if(e.target===compare)compare.close()};
    const footer=element('a','vd-credits','Data sources and coverage');footer.href=new URL('atlas/discovery-credits.json',base);
    summary.append(count,element('small','','Choose up to four places to compare.'));
    root.append(controls,selection,summary,grid,more,footer,compare);
    function showCompare(){
      const header=element('div','vd-dialog-head');header.append(element('h2','','Compare destinations'),action('Close',()=>compare.close()));
      const scroll=element('div','vd-scroll'),table=element('table'),head=element('thead'),tbody=element('tbody'),row=element('tr');
      row.append(element('th','','Destination'));
      const entries=[...selected.values()];
      for(const p of entries){const col=element('th','',p.name);col.scope='col';row.append(col)}head.append(row);
      const fields=[['Feature',p=>p.type],['Region',p=>p.region],['Coordinates',p=>p.lat.toFixed(2)+'°, '+p.lon.toFixed(2)+'°'],['Country facts for',(_,f)=>f?.scope],['Capital',(_,f)=>f?.capital],['Currency code',(_,f)=>f?.currencyCode],['Spoken languages (first five listed)',(_,f)=>f?.languages.slice(0,5).join(', ')],['Time zones',(_,f)=>f?.timeZones.join(', ')],['Heritage designation',p=>p.heritage],['Travel interests',p=>tags(p).join(', ')]];
      for(const [name,get] of fields){const r=element('tr'),h=element('th','',name);h.scope='row';r.append(h);for(const p of entries)r.append(element('td','',get(p,window.VoyageFacts(p))||'Unavailable'));tbody.append(r)}
      table.append(head,tbody);scroll.append(table);compare.replaceChildren(header,scroll,element('p','','Country facts from GeoNames and IANA · retrieved 25 November 2026.'));compare.showModal();
    }
    function render(){
      const term=norm(search.value);
      matches=all.filter(p=>(!term||norm([p.name,p.country,p.region,...(p.searchNames||[]),...tags(p)].join(' ')).includes(term))&&(!region.value||p.region===region.value)&&(!type.value||p.type===type.value)&&(!interest.value||tags(p).includes(interest.value)));
      count.textContent=matches.length.toLocaleString()+' '+(matches.length===1?'place':'places');more.hidden=limit>=matches.length;surprise.disabled=!matches.length;
      selection.hidden=selected.size===0;selection.replaceChildren();
      for(const p of selected.values())selection.append(action(p.name+' ×',()=>{selected.delete(key(p));render()},'vd-chip'));
      const compareButton=action('Compare places',showCompare,'vd-btn vd-primary');compareButton.disabled=selected.size<2;selection.append(compareButton);grid.replaceChildren();
      for(const p of matches.slice(0,limit)){const card=element('article','vd-card'),open=action('',()=>openPlace(p),'vd-open');
        if(p.image){const image=element('img','vd-thumb');image.src=p.image;image.loading='lazy';image.alt='';open.append(image)}
        open.append(element('small','vd-meta',[p.type,p.region].filter(Boolean).join(' · ')),element('strong','',p.name));
        if(p.country)open.append(element('small','',p.country));
        const check=element('input');check.type='checkbox';check.checked=selected.has(key(p));check.disabled=!check.checked&&selected.size>=4;check.setAttribute('aria-label','Compare '+p.name);
        check.onchange=()=>{if(check.checked)selected.set(key(p),p);else selected.delete(key(p));render()};
        const label=element('label','vd-check');label.append(check,document.createTextNode('Compare'));card.append(open,label);grid.append(card)}
      if(!matches.length)grid.append(element('p','','No matching destinations. Try another name, region or interest.'));
    }
    for(const n of [search,region,type,interest])n.addEventListener(n===search?'input':'change',()=>{limit=24;render()});render();
  };
})();
