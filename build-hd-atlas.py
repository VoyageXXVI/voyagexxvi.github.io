"""Build the optional detailed boundaries and Earth texture. Input is cached in a directory supplied via argv."""
import json, pathlib, struct, sys, urllib.request
from PIL import Image
root=pathlib.Path(__file__).resolve().parents[1]
cache=pathlib.Path(sys.argv[1]);cache.mkdir(parents=True,exist_ok=True)
out=root/'dist/atlas'
sources={'countries.geojson':'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson','land.jpg':'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/july/world.200407.3x5400x2700.jpg'}
for filename,url in sources.items():
 if not (cache/filename).exists():urllib.request.urlretrieve(url,cache/filename)
features=json.loads((cache/'countries.geojson').read_text())['features']
known={r[0] for r in json.loads((out/'countries.json').read_text())}
# Split by polygon to skip distant islands outside the viewport. Preserve holes.
pieces=[]
for feature in features:
 code=feature['properties']['ADM0_A3']
 geometry=feature['geometry']
 for polygon in (geometry['coordinates'] if geometry['type']=='MultiPolygon' else [geometry['coordinates']]):
  pieces.append((code,polygon))
with (out/'countries-10m.bin').open('wb') as file:
 file.write(b'V26H'+struct.pack('<I',len(pieces)))
 for code,polygon in pieces:
  file.write(code.encode('ascii')+struct.pack('<H',len(polygon)))
  for ring in polygon:
   file.write(struct.pack('<I',len(ring)))
   for lon,lat,*_ in ring:file.write(struct.pack('<ii',round(lon*10000),round(lat*10000)))
im=Image.open(cache/'land.jpg');im.save(out/'land-5400.webp',quality=91,method=5)
print(len(features),'map units;',len(pieces),'polygon parts;',im.size)
