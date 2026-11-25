"""Convert GeoNames countryInfo.txt and IANA zone.tab to the public local index."""
import sys,json
from pathlib import Path
zones={}
for line in Path(sys.argv[2]).read_text().splitlines():
    if line and not line.startswith('#'):
        f=line.split('\t'); zones.setdefault(f[0],[]).append(f[2])
rows=[]
for line in Path(sys.argv[1]).read_text().splitlines():
    if line and not line.startswith('#'):
        f=line.split('\t')
        if f[0] not in ('AN','CS'):
            rows.append(dict(iso2=f[0],iso3=f[1],name=f[4],capital=f[5],areaKm2=float(f[6]) if f[6] else None,currencyCode=f[10],currency=f[11],callingCode=f[12],languageCodes=f[15].split(',') if f[15] else [],timeZones=zones.get(f[0],[]),geonamesId=f[16]))
Path(sys.argv[3]).write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':')))
