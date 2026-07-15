"""Test: Netherlands stations from DELFI GTFS"""
import zipfile, io, csv, json, re

with open('../stations.json','r',encoding='utf-8') as f:
    data = json.load(f)

NL_LAT = (50.7, 53.7); NL_LON = (3.3, 7.3)

nl_existing = []
for cn,cd in data['countries'].items():
    for s in cd['stations']:
        if NL_LAT[0] <= s['lat'] <= NL_LAT[1] and NL_LON[0] <= s['lng'] <= NL_LON[1]:
            nl_existing.append(s)

print(f'Existing in NL bbox: {len(nl_existing)}')
print(f'Sample: {[s["name"] for s in nl_existing[:10]]}')

RAIL_TYPES = {'2','100','101','102','103','104','105','106','107','108','109','110','111','112','113','114','115','116','117'}

z = zipfile.ZipFile('../gtfs feeds/de_DELFI.gtfs.zip')

rail_routes = set()
with z.open('routes.txt') as f:
    for row in csv.DictReader(io.TextIOWrapper(f,'utf-8')):
        if row.get('route_type','').strip() in RAIL_TYPES:
            rail_routes.add(row.get('route_id',''))
print(f'Rail routes: {len(rail_routes)}')

rail_trips = set()
with z.open('trips.txt') as f:
    for row in csv.DictReader(io.TextIOWrapper(f,'utf-8')):
        if row.get('route_id','') in rail_routes:
            rail_trips.add(row.get('trip_id',''))
print(f'Rail trips: {len(rail_trips)}')

rail_stops = set()
with z.open('stop_times.txt') as f:
    for row in csv.DictReader(io.TextIOWrapper(f,'utf-8')):
        if row.get('trip_id','') in rail_trips:
            rail_stops.add(row.get('stop_id',''))
print(f'Rail stop_ids: {len(rail_stops)}')

# Get parent_station mapping first
parent_map = {}
with z.open('stops.txt') as f:
    for row in csv.DictReader(io.TextIOWrapper(f,'utf-8')):
        sid = row.get('stop_id','')
        parent = row.get('parent_station','').strip()
        if parent:
            parent_map[sid] = parent

nl_gtfs = {}
with z.open('stops.txt') as f:
    for row in csv.DictReader(io.TextIOWrapper(f,'utf-8')):
        sid = row.get('stop_id','')
        if sid not in rail_stops: continue
        lt = row.get('location_type','').strip()
        if lt in ('2','3','4'): continue
        
        # Resolve to parent if exists
        actual_sid = parent_map.get(sid, sid)
        # Skip if this is a child stop and parent exists
        if sid in parent_map: continue
        
        name = row.get('stop_name','').strip()
        name = re.sub(r'\s*\(?(Binario|Voie|Anden|Spor|Peron|Track|Platform|Gleis|Spoor|Via|Quay|Steig|Bstg)\s*\d+\)?\s*$','',name,flags=re.I)
        name = re.sub(r'\s+\d+[A-Z]?$','',name)
        name = re.sub(r'\s+',' ',name).strip()
        if not name or len(name)<2: continue
        
        try: lat=float(row['stop_lat']); lon=float(row['stop_lon'])
        except: continue
        if lat==0 and lon==0: continue
        if not (NL_LAT[0] <= lat <= NL_LAT[1] and NL_LON[0] <= lon <= NL_LON[1]): continue
        
        if actual_sid not in nl_gtfs:
            nl_gtfs[actual_sid] = {'name':name,'lat':lat,'lon':lon,'lt':lt}
        elif lt == '1' and nl_gtfs[actual_sid]['lt'] != '1':
            nl_gtfs[actual_sid] = {'name':name,'lat':lat,'lon':lon,'lt':lt}

z.close()

stations = list(nl_gtfs.values())
stations.sort(key=lambda s: s['name'])
print(f'\nNL GTFS rail stations: {len(stations)}')
for s in stations[:30]:
    print(f'  {s["name"]} ({s["lat"]:.4f},{s["lon"]:.4f}) lt={s["lt"]}')
if len(stations) > 30:
    print(f'  ... and {len(stations)-30} more')

# Compare: what GTFS has that existing doesn't
existing_names = {re.sub(r'\s+',' ',s['name'].strip().lower()) for s in nl_existing}
gtfs_names = {s['name'].lower() for s in stations}
missing = gtfs_names - existing_names
extra = existing_names - gtfs_names
print(f'\nIn GTFS but not existing: {len(missing)}')
for m in sorted(missing)[:20]:
    print(f'  + {m}')
print(f'\nIn existing but not GTFS: {len(extra)}')
for e in sorted(extra)[:20]:
    print(f'  - {e}')
