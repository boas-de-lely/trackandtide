"""
Add missing railway stations from GTFS using proper route→trip→stop chain.
Only includes stops actually served by rail routes (route_type 2, 100-117).
"""
import zipfile, io, csv, os, json, math, shutil, re
from datetime import datetime

GTFS_DIR = os.path.join(os.path.dirname(__file__), '..', 'gtfs feeds')
STATIONS_FILE = os.path.join(os.path.dirname(__file__), '..', 'stations.json')

RAIL_TYPES = {'2','100','101','102','103','104','105','106','107','108','109','110','111','112','113','114','115','116','117'}

RAILWAY_FEEDS = [
    'de_DELFI','be_sncb','gb_great-britain','gb_northern-ireland',
    'ch_opentransportdataswiss26','ch_opentransportdataswiss-flex',
    'fr_horaires-sncf','fr_horaires-des-trains-trenitalia-france',
    'at_Railway','es_RENFE','es_Cercanías','es_Euskotren','es_Feve','es_Ouigo',
    'it_Lombardia-Trenord','it_Piemonte-Trenitalia','it_Sardegna-Trenitalia',
    'it_Toscana-Trenitalia','hr_hz','hu_mav','cz_CZPTT',
    'bg_bdz','ee_elron','fi_fintraffic','dk_rejseplanen',
    'ie_transport-for-ireland','ge_georgian-railway','gr_Hellenic-Train',
    'eu_eurostar','eu_european-sleeper','fr_breizhgo-ter',
    'fr_trains-express-regionaux-zou','fr_horaires-ave-espagne-france',
]
MATCH_KM = 0.5

def clean(name):
    if not name: return ''
    name = re.sub(r'\s*\(?(Binario|Voie|Anden|Spor|Peron|Track|Platform|Gleis|Spoor|Via|Quay|Steig|Bstg)\s*\d+\)?\s*$', '', name.strip(), flags=re.I)
    name = re.sub(r'\s+\d+[A-Z]?$', '', name)
    return re.sub(r'\s+', ' ', name).strip()

def haversine(lat1,lon1,lat2,lon2):
    R=6371;dla=math.radians(lat2-lat1);dlo=math.radians(lon2-lon1)
    a=math.sin(dla/2)**2+math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlo/2)**2
    return R*2*math.atan2(math.sqrt(a),math.sqrt(1-a))

def get_rail_stop_ids(z, files):
    """Returns set of stop_ids served by rail routes, using routes->trips->stop_times."""
    if 'routes.txt' not in files:
        return None  # Can't determine, accept all
    
    # 1. Find rail route_ids
    rail_routes = set()
    with z.open('routes.txt') as f:
        for row in csv.DictReader(io.TextIOWrapper(f,'utf-8')):
            if row.get('route_type','').strip() in RAIL_TYPES:
                rail_routes.add(row.get('route_id',''))
    
    if not rail_routes:
        return set()  # No rail routes
    
    # 2. Find trip_ids for those routes
    if 'trips.txt' not in files:
        return None  # Can't join, accept all stops (feed is probably rail-only)
    
    rail_trips = set()
    with z.open('trips.txt') as f:
        for row in csv.DictReader(io.TextIOWrapper(f,'utf-8')):
            if row.get('route_id','') in rail_routes:
                rail_trips.add(row.get('trip_id',''))
    
    if not rail_trips:
        return set()
    
    # 3. Find stop_ids from stop_times
    if 'stop_times.txt' not in files:
        return None
    
    rail_stops = set()
    with z.open('stop_times.txt') as f:
        for row in csv.DictReader(io.TextIOWrapper(f,'utf-8')):
            if row.get('trip_id','') in rail_trips:
                rail_stops.add(row.get('stop_id',''))
    
    return rail_stops

def is_rail_feed(filename):
    return any(kw in filename for kw in RAILWAY_FEEDS)

def main():
    print("=== GTFS Station Adder (routes->trips->stops) ===\n")
    shutil.copy2(STATIONS_FILE, STATIONS_FILE + '.bak')
    
    with open(STATIONS_FILE,'r',encoding='utf-8') as f:
        data = json.load(f)
    
    all_ex = []
    for cn,cd in data.get('countries',{}).items():
        for s in cd.get('stations',[]):
            all_ex.append({'s':s,'c':cn})
    
    print(f"Existing: {len(all_ex)} stations")
    
    grid = {}
    for e in all_ex:
        s = e['s']; k = (int(s['lng']*4), int(s['lat']*4))
        grid.setdefault(k,[]).append(e)
    
    overrides = 0; new_stations = []
    
    for fname in sorted(os.listdir(GTFS_DIR)):
        if not fname.endswith('.gtfs.zip') or not is_rail_feed(fname): continue
        
        fp = os.path.join(GTFS_DIR, fname)
        try:
            z = zipfile.ZipFile(fp); files = z.namelist()
            if 'stops.txt' not in files: z.close(); continue
            
            # Get rail stop IDs via routes->trips->stop_times
            rail_stop_ids = get_rail_stop_ids(z, files)
            if rail_stop_ids is not None and not rail_stop_ids:
                z.close(); continue  # No rail stops
            
            matched = 0; new_count = 0; ov = 0
            with z.open('stops.txt') as sf:
                for row in csv.DictReader(io.TextIOWrapper(sf,'utf-8')):
                    sid = row.get('stop_id','')
                    
                    # If we have rail_stop_ids, only accept those
                    if rail_stop_ids is not None and sid not in rail_stop_ids:
                        continue
                    
                    # Skip platforms/entrances if location_type present
                    lt = row.get('location_type','').strip()
                    if lt in ('2','3','4'):
                        continue
                    
                    name = clean(row.get('stop_name',''))
                    if not name or len(name) < 2: continue
                    
                    try:
                        lat = float(row['stop_lat']); lon = float(row['stop_lon'])
                    except: continue
                    if lat==0 and lon==0: continue
                    
                    gx,gy = int(lon*4), int(lat*4); cl = math.cos(math.radians(lat))
                    
                    best_e = None; best_d = MATCH_KM+1
                    for dx in (-1,0,1):
                        for dy in (-1,0,1):
                            for e in grid.get((gx+dx,gy+dy),[]):
                                s = e['s']
                                d = math.sqrt(((lat-s['lat'])*111)**2 + ((lon-s['lng'])*111*cl)**2)
                                if d < best_d: best_d = d; best_e = e
                    
                    if best_e and best_d < MATCH_KM:
                        if best_e['s']['name'] != name:
                            best_e['s']['name'] = name; ov += 1
                        matched += 1
                    else:
                        nc = 'Unknown'; nd = 999
                        for dx in range(-3,4):
                            for dy in range(-3,4):
                                for e in grid.get((gx+dx,gy+dy),[]):
                                    d = haversine(lat,lon,e['s']['lat'],e['s']['lng'])
                                    if d < nd: nd = d; nc = e['c']
                        if nd > 50: nc = 'Unknown'
                        new_stations.append({'name':name,'lat':lat,'lng':lon,'c':nc,'f':fname})
                        new_count += 1
            
            z.close()
            overrides += ov
            print(f"  {fname}: {matched} matched, {ov} ovr, {new_count} new")
        except Exception as e:
            print(f"  {fname}: ERROR {e}")
    
    new_stations.sort(key=lambda x:x['name'])
    deduped = []
    for ns in new_stations:
        if not any(haversine(ns['lat'],ns['lng'],d['lat'],d['lng']) < 0.3 for d in deduped):
            deduped.append(ns)
    
    print(f"\nNew: {len(deduped)} (from {len(new_stations)}), Overrides: {overrides}")
    
    for ns in deduped:
        c = ns['c']
        if c not in data['countries']:
            data['countries'][c] = {'country':c,'qid':'','iso':'','counts':{},'stations':[]}
        cd = data['countries'][c]
        cd['stations'].append({'id':f"gtfs-{c.lower()}-{len(cd['stations'])}",
            'name':ns['name'],'lat':ns['lat'],'lng':ns['lng'],
            'operators':[],'source':'gtfs','url':''})
        cd['counts']['total'] = len(cd['stations'])
    
    total = sum(len(c['stations']) for c in data['countries'].values())
    data['generatedAt'] = datetime.utcnow().isoformat()+'Z'
    
    with open(STATIONS_FILE,'w',encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Final: {total} stations in {len(data['countries'])} countries")
    print("Done!")

if __name__ == '__main__':
    main()
