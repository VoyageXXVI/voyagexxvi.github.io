"""Rebuild map data and imagery. Python + Pillow, numpy."""
import sys,json,pathlib,urllib.request
from PIL import Image
import numpy as np
OUT=pathlib.Path(__file__).resolve().parents[1]/'dist/atlas'; OUT.mkdir(parents=True,exist_ok=True)
CACHE=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '.atlas-cache');CACHE.mkdir(exist_ok=True)
credits=[];places=[];parents={};shapes={}
def save(file,data): (OUT/file).write_text(json.dumps(data,separators=(',',':'),ensure_ascii=False))
def get(key,url,creator,license,source):
 p=CACHE/key
 if not p.exists():urllib.request.urlretrieve(url,p)
 credits.append(dict(asset=key,url=url,source=source,creator=creator,license=license,attribution=creator,public_reuse=True,acquired="2026-11-25"));return p
def features(key):
 return json.load(open(get(key,'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_'+key+'.geojson','Natural Earth','Public domain','https://www.naturalearthdata.com/about/terms-of-use/')))['features']
def rings(f):
 g=f['geometry'];c=g['coordinates'];t=g['type']
 return [ring for poly in c for ring in poly] if t=='MultiPolygon' else c if t in ('MultiLineString','Polygon') else [c] if t=='LineString' else []
def shape(group,ident,geo):
 if geo:shapes.setdefault(group,[]).append([ident,[[round(v*100) for pt in ring for v in pt[:2]] for ring in geo]])
def place(ident,name,kind,point,region='',**fields):
 if not name or None in point:return {}
 q=dict(id=str(ident),name=name,type=kind,lon=round(point[0],4),lat=round(point[1],4),region=region or '',**{k:v for k,v in fields.items() if v is not None});places.append(q);return q
un=set('AFG AGO ALB AND ARE ARG ARM ATG AUS AUT AZE BDI BEL BEN BFA BGD BGR BHR BHS BIH BLR BLZ BOL BRA BRB BRN BTN BWA CAF CAN CHE CHL CHN CIV CMR COD COG COL COM CPV CRI CUB CYP CZE DEU DJI DMA DNK DOM DZA ECU EGY ERI ESP EST ETH FIN FJI FRA FSM GAB GBR GEO GHA GIN GMB GNB GNQ GRC GRD GTM GUY HND HRV HTI HUN IDN IND IRL IRN IRQ ISL ISR ITA JAM JOR JPN KAZ KEN KGZ KHM KIR KNA KOR KWT LAO LBN LBR LBY LCA LIE LKA LSO LTU LUX LVA MAR MCO MDA MDG MDV MEX MHL MKD MLI MLT MMR MNE MNG MOZ MRT MUS MWI MYS NAM NER NGA NIC NLD NOR NPL NRU NZL OMN PAK PAN PER PHL PLW PNG POL PRK PRT PRY QAT ROU RUS RWA SAU SDN SDS SEN SGP SLB SLE SLV SMR SOM SRB STP SUR SVK SVN SWE SWZ SYC SYR TCD TGO THA TJK TKM TLS TON TTO TUN TUR TUV TZA UGA UKR URY USA UZB VCT VEN VNM VUT WSM YEM ZAF ZMB ZWE'.split());assert len(un)==193
for f in features('50m_admin_0_countries'):
 p=f['properties'];i=p['ADM0_A3'];cls=p['TYPE'];kind='Country' if i in un|{'VAT','PSX'} else 'Associated state' if i in {'NIU','COK'} else 'Other atlas area' if i in {'CYN','SOL','TWN'} else 'Continent' if i=='ATA' else {'Disputed':'Disputed region','Indeterminate':'Indeterminate region'}.get(cls,'Territory')
 parents[i]=place(i,p['NAME_EN'] or p['ADMIN'],kind,[p['LABEL_X'],p['LABEL_Y']],p['CONTINENT'],classification=cls,countingGroup=kind,unStatus='Member state' if i in un else 'Non-member observer state' if i in {'VAT','PSX'} else None,iso2=p['ISO_A2_EH'],geographicalRegion=p['SUBREGION'],sovereignty=p['SOVEREIGNT'])
 shape('countries',i,rings(f))
for f in features('50m_admin_1_states_provinces'):
 p=f['properties'];i=p['adm1_code'];par=parents.get(p['adm0_a3'],{});place(i,p['name_en'] or p['name'],'Administrative division',[p['longitude'],p['latitude']],par.get('region'),country=par.get('name'),classification=p['type_en']);shape('provinces',i,rings(f))
for layer,key,kind in [('cities','50m_populated_places_simple','City'),('airports','10m_airports','Airport'),('mountains','10m_geography_regions_elevation_points','Mountain'),('regions','10m_geography_regions_points','Geographical region')]:
 for f in features(key):
  p=f['properties'];par=parents.get(p.get('adm0_a3'),{})
  if layer=='mountains' and p['featurecla']!='mountain':continue
  q=place(p['ne_id'],p.get('name_en') or p.get('name'),kind,f['geometry']['coordinates'],par.get('region') or p.get('region'),country=par.get('name'),layer=layer,elevation=p.get('elevation'),iata=p.get('iata_code'))
  if q and par and p.get('adm0cap')==1:par['capital']=q['name']
for layer,key,kind in [('rivers','50m_rivers_lake_centerlines','River'),('lakes','50m_lakes','Lake'),('seas','50m_geography_marine_polys','Marine region'),('disputed','50m_admin_0_boundary_lines_disputed_areas','Disputed boundary'),('parks','10m_parks_and_protected_lands_area','Protected area')]:
 for j,f in enumerate(features(key)):
  p=f['properties'];path=rings(f);i=layer+str(j)
  if not path:continue
  line=max(path,key=len);place(i,p.get('name_en') or p.get('unit_name') or p.get('name') or p.get('NAME'),kind,line[len(line)//2],layer=layer);shape(layer,i,path)
for key,v in shapes.items():save(key+'.json',v)
save('places.json',places)
base='https://assets.science.nasa.gov/content/dam/science/esd/eo/'
def nasa(key,path,creator,ref):
 return Image.open(get(key,base+path,creator,'Public domain, US government work','https://science.nasa.gov/earth/earth-observatory/'+ref)).convert('RGB')
land=nasa('earth.jpg','images/bmng/bmng-base/july/world.200407.3x5400x2700.jpg','NASA Earth Observatory / Reto Stöckli','blue-marble-next-generation/base-map/').resize((2048,1024),Image.Resampling.LANCZOS);land.save(OUT/'land.webp',quality=88)
cloud=nasa('cloud.jpg','content-feature/bluemarble/images/cloud_combined_2048.jpg','NASA GSFC / Reto Stöckli and Robert Simmon','the-blue-marble-true-color-global-imagery-at-1km-resolution/').convert('L').resize(land.size)
a=np.asarray(land)/255.;c=(np.asarray(cloud)/255.)**1.4*.72;o=(a[:,:,2]>1.3*a[:,:,0])&(a[:,:,2]>1.12*a[:,:,1]);a[o]=a[o]*[.63,.8,.65]+[.011,.07,.12];a=a*(1-c[:,:,None])+np.array([.92,.96,1.])*c[:,:,None]
Image.fromarray((np.clip(a,0,1)*255).astype('uint8')).save(OUT/'earth.webp',quality=89)
nasa('night.jpg','images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg','NASA Earth Observatory / Joshua Stevens, Suomi NPP VIIRS','earth-at-night/maps/').resize((2048,1024)).save(OUT/'night.webp',quality=84)
credits.extend([
 dict(asset='OpenFreeMap Liberty street style and vector tiles',creator='OpenFreeMap / OpenMapTiles / OpenStreetMap contributors',source='https://openfreemap.org/quick_start/',url='https://tiles.openfreemap.org/styles/liberty',license='OpenStreetMap data under ODbL 1.0; upstream style and cartography terms apply',attribution='OpenFreeMap · © OpenMapTiles · © OpenStreetMap contributors',public_reuse=True,acquired='2026-11-25'),
 dict(asset='MapLibre GL JS 5.12.0, CSS and CSP worker',creator='MapLibre contributors',source='https://github.com/maplibre/maplibre-gl-js/tree/v5.12.0',url='https://unpkg.com/maplibre-gl@5.12.0/dist/',license='BSD-3-Clause; bundled third-party notices in atlas/maplibre/maplibre-license.txt and distribution',attribution='MapLibre contributors',public_reuse=True,acquired='2026-11-25')
])
save('credits.json',credits);print(len(places),'places')
