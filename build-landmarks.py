"""Retrieve CC0 Wikidata coordinates and factual tags for a curated travel index."""
import concurrent.futures,json,subprocess
from pathlib import Path
# English article titles are used solely to resolve the Wikidata entity identifier.
SOURCE = """
Eiffel_Tower|Landmark|Architecture,Photography|France|Europe
Colosseum|Landmark|Architecture,Historical sites|Italy|Europe
Sagrada_Família|Landmark|Architecture,Religious heritage|Spain|Europe
Alhambra|Landmark|Architecture,Historical sites|Spain|Europe
Grand_Bazaar,_Istanbul|Market|Shopping,Cultural experiences|Turkey|Europe
Spice_Bazaar|Market|Shopping,Food|Turkey|Europe
Borough_Market|Market|Shopping,Food|United Kingdom|Europe
Jemaa_el-Fnaa|Market|Food,Cultural experiences|Morocco|Africa
Hagia_Sophia|Landmark|Religious heritage,Architecture|Turkey|Europe
Taj_Mahal|Landmark|Architecture,Historical sites|India|Asia
Angkor_Wat|Landmark|Religious heritage,Architecture|Cambodia|Asia
Borobudur|Landmark|Religious heritage,Historical sites|Indonesia|Asia
Fushimi_Inari-taisha|Landmark|Religious heritage,Photography|Japan|Asia
Great_Wall_of_China|Landmark|Historical sites,Architecture|China|Asia
Sydney_Opera_House|Landmark|Architecture,Cultural experiences|Australia|Oceania
Machu_Picchu|Landmark|Historical sites,Mountains|Peru|South America
Chichén_Itzá|Landmark|Historical sites,Architecture|Mexico|North America
Petra|Landmark|Historical sites,Architecture|Jordan|Asia
Giza_pyramid_complex|Landmark|Historical sites,Architecture|Egypt|Africa
Great_Zimbabwe|Landmark|Historical sites,Cultural experiences|Zimbabwe|Africa
Serengeti_National_Park|Protected area|Wildlife,Nature,Photography|Tanzania|Africa
Kruger_National_Park|Protected area|Wildlife,Nature|South Africa|Africa
Sundarbans_National_Park|Protected area|Wildlife,Nature|India|Asia
Yellowstone_National_Park|Protected area|Wildlife,Nature|United States|North America
Banff_National_Park|Protected area|Mountains,Nature,Photography|Canada|North America
Fiordland_National_Park|Protected area|Nature,Adventure|New Zealand|Oceania
Torres_del_Paine_National_Park|Protected area|Nature,Mountains,Adventure|Chile|South America
Komodo_National_Park|Protected area|Wildlife,Islands,Nature|Indonesia|Asia
Whitehaven_Beach|Beach|Beaches,Islands|Australia|Oceania
Bondi_Beach|Beach|Beaches|Australia|Oceania
Cox%27s_Bazar_Beach|Beach|Beaches|Bangladesh|Asia
Easter_Island|Island|Islands,Historical sites|Chile|Oceania
Jeju_Island|Island|Islands,Nature|South Korea|Asia
Galápagos_Islands|Archipelago|Wildlife,Islands|Ecuador|South America
Ring_Road_(Iceland)|Road|Road trips|Iceland|Europe
Great_Ocean_Road|Road|Road trips,Photography|Australia|Oceania
Tate_Modern|Museum|Cultural experiences,Architecture|United Kingdom|Europe
Louvre|Museum|Cultural experiences,Architecture|France|Europe
Ahsan_Manzil|Landmark|Historical sites,Architecture|Bangladesh|Asia
Sixty_Dome_Mosque|Landmark|Religious heritage,Architecture|Bangladesh|Asia
Mahasthangarh|Landmark|Historical sites|Bangladesh|Asia
Dolomites|Mountain|Mountains,Nature|Italy|Europe
Patagonia|Geographical region|Nature,Adventure|Argentina, Chile|South America
""".strip().splitlines()
def get(entry):
    article,kind,tags,country,region=entry.split('|')
    try:
        import re
        from urllib.parse import quote
        page=subprocess.check_output(['curl','-fLsS','--max-time','22','https://en.wikipedia.org/wiki/'+quote(article,safe="%_,()'")]).decode()
        qid=re.search(r'www.wikidata.org/wiki/Special:EntityPage/(Q[0-9]+)',page)[1]
        raw=subprocess.check_output(['curl','-fLsS','--max-time','22','https://www.wikidata.org/wiki/Special:EntityData/'+qid+'.json'])
        item=json.loads(raw)['entities'][qid];name=item['labels']['en']['value']
        coords=next(c['mainsnak']['datavalue']['value'] for c in item['claims']['P625'] if c.get('rank')!='deprecated' and 'datavalue' in c['mainsnak'])
        # The listed Istanbul landmarks are on its European bank.
        if country=='Turkey':region='Europe'
        data=dict(id='wd-'+qid,wikidata=qid,name=name,lat=round(coords['latitude'],5),lon=round(coords['longitude'],5),type=kind,tags=tags.split(','),country=country,region=region)
        data['searchNames']=[article.replace('_',' ').replace('%27',"'")]+[a['value'] for a in item.get('aliases',{}).get('en',[])[:6]]
        if any(c['mainsnak'].get('datavalue',{}).get('value',{}).get('id')=='Q9259' and c.get('rank')!='deprecated' for c in item['claims'].get('P1435',[])):data['heritage']='UNESCO World Heritage Site'
        return data
    except Exception as exc:print(article,str(exc)[:75],flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as workers:
    rows=[r for r in workers.map(get,SOURCE) if r]
path=Path('dist/atlas/landmarks.json')
if rows:path.write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':')))
print(len(rows),'landmarks')
