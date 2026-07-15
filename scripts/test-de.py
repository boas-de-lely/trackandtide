"""Test: Germany stations from DELFI GTFS - properly filtered"""
import zipfile, io, csv, json, math, re

with open('../stations.json','r',encoding='utf-8') as f:
    data = json.load(f)

# Germany rough bbox
DE_LAT = (47.2, 55.1); DE_LON = (5.8, 15.1)

de_existing = [s for cn,cd in data['countries'].items() for s in cd['stations']
               if DE_LAT[0]<=s['lat']<=DE_LAT[1] and DE_LON[0]<=s['lng']<=DE_LON[1]]
print(f'Existing in DE bbox: {len(de_existing)}')

RAIL_TYPES = {'2','100','101','102','103','104','105','106','107','108','109','110','111','112','113','114','115','116','117'}

z = zipfile.ZipFile('../gtfs feeds/de_DELFI.gtfs.zip')

# routes->trips->stop_times
rail_routes = set()
with z.open('routes.txt') as f:
    for row in csv.DictReader(io.TextIOWrapper(f,'utf-8')):
        if row.get('route_type','').strip() in RAIL_TYPES:
            rail_routes.add(row.get('route_id',''))
print(f'Rail routes: {len(rail_routes)}')

# Sample rail routes to see what they look like
with z.open('routes.txt') as f:
    samples = []
    for row in csv.DictReader(io.TextIOWrapper(f,'utf-8')):
        if row.get('route_type','').strip() in RAIL_TYPES:
            samples.append(f"  {row.get('route_short_name','')} ({row.get('route_type','')})")
            if len(samples) >= 10: break
print('Sample rail routes:')
for s in samples: print(s)

rail_trips = set()
with z.open('trips.txt') as f:
    for row in csv.DictReader(io.TextIOWrapper(f,'utf-8')):
        if row.get('route_id','') in rail_routes:
            rail_trips.add(row.get('trip_id',''))
print(f'Rail trips: {len(rail_trips)}')

rail_stop_ids = set()
with z.open('stop_times.txt') as f:
    for row in csv.DictReader(io.TextIOWrapper(f,'utf-8')):
        if row.get('trip_id','') in rail_trips:
            rail_stop_ids.add(row.get('stop_id',''))
print(f'Rail stop_ids: {len(rail_stop_ids)}')

# Build parent mapping
parent_of = {}
with z.open('stops.txt') as f:
    for row in csv.DictReader(io.TextIOWrapper(f,'utf-8')):
        sid = row.get('stop_id',''); p = row.get('parent_station','').strip()
        if p: parent_of[sid] = p

# Extract DE rail stations  
de_gtfs = {}
with z.open('stops.txt') as f:
    for row in csv.DictReader(io.TextIOWrapper(f,'utf-8')):
        sid = row.get('stop_id','')
        if sid not in rail_stop_ids: continue
        if sid in parent_of: continue  # Skip children, use parent
        
        lt = row.get('location_type','').strip()
        if lt in ('2','3','4'): continue
        
        name = row.get('stop_name','').strip()
        name = re.sub(r'\s*\(?(Binario|Voie|Anden|Spor|Peron|Track|Platform|Gleis|Spoor|Via|Quay|Steig|Bstg)\s*\d+\)?\s*$','',name,flags=re.I)
        name = re.sub(r'\s+\d+[A-Z]?$','',name)
        name = re.sub(r'\s+',' ',name).strip()
        if not name or len(name)<2: continue
        
        try: lat=float(row['stop_lat']); lon=float(row['stop_lon'])
        except: continue
        if lat==0 and lon==0: continue
        if not (DE_LAT[0]<=lat<=DE_LAT[1] and DE_LON[0]<=lon<=DE_LON[1]): continue
        
        if sid not in de_gtfs or (lt=='1' and de_gtfs[sid]['lt']!='1'):
            de_gtfs[sid] = {'name':name,'lat':lat,'lon':lon,'lt':lt}

z.close()

stations = sorted(de_gtfs.values(), key=lambda s: s['name'])
print(f'\nDE GTFS rail stations: {len(stations)}')
for s in stations[:15]:
    print(f'  {s["name"]} ({s["lat"]:.4f},{s["lon"]:.4f})')
print(f'  ...')

# Match with existing
def haversine(lat1,lon1,lat2,lon2):
    R=6371;dla=math.radians(lat2-lat1);dlo=math.radians(lon2-lon1)
    a=math.sin(dla/2)**2+math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlo/2)**2
    return R*2*math.atan2(math.sqrt(a),math.sqrt(1-a))

matched = 0; new_count = 0
for gs in stations:
    best_d = 0.5
    found = False
    for es in de_existing:
        d = haversine(gs['lat'],gs['lon'],es['lat'],es['lng'])
        if d < best_d:
            found = True; break
    if found: matched += 1
    else: new_count += 1

print(f'\nMatched with existing: {matched}')
print(f'New (not in existing): {new_count}')
print(f'Total after merge: {len(de_existing) + new_count}')
print(f'Germany should have ~5,400 railway stations')
