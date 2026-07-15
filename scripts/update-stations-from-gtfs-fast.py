"""
Optimized: Update stations.json with GTFS feed data from railway-specific feeds only.
Fast - skips trip/stop_times filtering, uses route_type check only.
"""
import zipfile, io, csv, os, json, math, shutil
from datetime import datetime

GTFS_DIR = os.path.join(os.path.dirname(__file__), '..', 'gtfs feeds')
STATIONS_FILE = os.path.join(os.path.dirname(__file__), '..', 'stations.json')
BACKUP_FILE = os.path.join(os.path.dirname(__file__), '..', 'stations.json.bak')

RAIL_ROUTE_TYPES = {'2', '100', '101', '102', '103', '104', '105', '106', '107', '108', '109', '110', '111', '112', '113', '114', '115', '116', '117'}

# Only process these known railway feeds (by filename substring match)
RAILWAY_FEEDS = [
    'de_DELFI', 'be_sncb', 'gb_great-britain', 'gb_northern-ireland',
    'ch_opentransportdataswiss26', 'ch_opentransportdataswiss-flex',
    'fr_horaires-sncf', 'fr_horaires-des-trains-trenitalia-france',
    'at_Railway', 'es_RENFE', 'es_Cercanías', 'es_Feve', 'es_Euskotren',
    'es_Ferrocarrils', 'es_Tranvía-Metropolitano', 'es_Metro', 'es_Ouigo',
    'it_Lombardia-Trenord', 'it_Piemonte-Trenitalia', 'it_Sardegna-Trenitalia',
    'it_Toscana-Trenitalia', 'hr_hz', 'hu_mav', 'cz_CZPTT', 'cz_PID',
    'bg_bdz', 'ee_elron', 'fi_fintraffic', 'dk_rejseplanen',
    'ie_transport-for-ireland', 'ge_georgian-railway', 'gr_Hellenic-Train',
    'eu_eurostar', 'eu_european-sleeper', 'fr_breizhgo-ter',
    'fr_trains-express-regionaux-zou', 'fr_horaires-theoriques-du-reseau-ferre',
    'fr_zou', 'fr_horaires-ave-espagne-france'
]
DEDUP_KM = 0.3

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def clean_name(name):
    import re
    if not name: return ''
    name = name.strip()
    name = re.sub(r'\s*\(?(Binario|Voie|Andén|Spor|Peron|Track|Platform|Gleis|Spoor|Vía)\s*\d+\)?\s*$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s+\d+[A-Z]?$', '', name)
    name = re.sub(r'\s*\(Bus\)$', '', name, flags=re.IGNORECASE)
    return re.sub(r'\s+', ' ', name).strip()

def is_railway_feed(filename):
    return any(kw in filename for kw in RAILWAY_FEEDS)

def extract_rail_stops(filepath, filename):
    try:
        z = zipfile.ZipFile(filepath)
        files = z.namelist()
        if 'stops.txt' not in files:
            z.close(); return []
        
        # Quick check: does this feed have rail routes?
        has_rail = False
        if 'routes.txt' in files:
            with z.open('routes.txt') as rf:
                reader = csv.DictReader(io.TextIOWrapper(rf, 'utf-8'))
                for row in reader:
                    if row.get('route_type', '').strip() in RAIL_ROUTE_TYPES:
                        has_rail = True
                        break
        
        if not has_rail:
            z.close(); return []
        
        # Read stops - only parent stations
        stops = []
        with z.open('stops.txt') as sf:
            reader = csv.DictReader(io.TextIOWrapper(sf, 'utf-8'))
            for row in reader:
                loc_type = row.get('location_type', '').strip()
                if loc_type in ('2', '3', '4'):
                    continue  # Skip entrances/exits/boarding areas
                
                name = clean_name(row.get('stop_name', ''))
                if not name or len(name) < 2:
                    continue
                
                try:
                    lat = float(row.get('stop_lat', ''))
                    lon = float(row.get('stop_lon', ''))
                except ValueError:
                    continue
                
                if lat == 0 and lon == 0:
                    continue
                
                parent = row.get('parent_station', '').strip()
                
                stops.append({
                    'name': name,
                    'lat': lat,
                    'lng': lon,
                    'parent': parent if parent else None,
                    'feed': filename
                })
        
        z.close()
        
        # Dedup: prefer parents
        parents = {}
        orphans = []
        for s in stops:
            if s['parent']:
                if s['parent'] not in parents:
                    parents[s['parent']] = s
            else:
                orphans.append(s)
        
        result = list(parents.values()) + orphans
        return result
    
    except Exception as e:
        print(f"  ERROR {filename}: {e}")
        return []

def dedup_stops(stops):
    if len(stops) <= 1: return stops
    stops.sort(key=lambda s: s['name'])
    result = []
    for s in stops:
        dup = any(haversine_km(s['lat'], s['lng'], e['lat'], e['lng']) < DEDUP_KM for e in result)
        if not dup:
            result.append(s)
    return result

def main():
    print("=== GTFS Station Updater (Railway Feeds Only) ===\n")
    
    # Backup
    if os.path.exists(STATIONS_FILE):
        shutil.copy2(STATIONS_FILE, BACKUP_FILE)
        print(f"Backed up to {BACKUP_FILE}")
    
    # Load existing
    with open(STATIONS_FILE, 'r', encoding='utf-8') as f:
        existing = json.load(f)
    
    # Build existing flat list
    existing_flat = []
    for cname, cdata in existing.get('countries', {}).items():
        for s in cdata.get('stations', []):
            existing_flat.append({'country': cname, 'station': s})
    
    # Process railway feeds
    all_stops = []
    feed_files = sorted(os.listdir(GTFS_DIR))
    processed = 0
    
    for filename in feed_files:
        if not filename.endswith('.gtfs.zip'): continue
        if not is_railway_feed(filename): continue
        
        filepath = os.path.join(GTFS_DIR, filename)
        print(f"  {filename}...", end=' ', flush=True)
        stops = extract_rail_stops(filepath, filename)
        print(f"{len(stops)} stops")
        all_stops.extend(stops)
        processed += 1
    
    print(f"\nProcessed {processed} feeds, {len(all_stops)} raw stops")
    
    # Dedup
    all_stops = dedup_stops(all_stops)
    print(f"After dedup: {len(all_stops)} stops")
    
    # Merge: match by proximity, update names from GTFS
    overrides = 0
    new_by_country = {}
    
    for gs in all_stops:
        # Find closest existing station
        best_i = -1
        best_d = float('inf')
        for i, ef in enumerate(existing_flat):
            d = haversine_km(gs['lat'], gs['lng'], ef['station']['lat'], ef['station']['lng'])
            if d < best_d:
                best_d = d
                best_i = i
        
        if best_i >= 0 and best_d < DEDUP_KM:
            # Override name with GTFS name
            ef = existing_flat[best_i]
            if ef['station']['name'] != gs['name']:
                ef['station']['name'] = gs['name']
                overrides += 1
        else:
            # Find nearest country
            country = 'Unknown'
            cd = float('inf')
            for ef in existing_flat:
                d = haversine_km(gs['lat'], gs['lng'], ef['station']['lat'], ef['station']['lng'])
                if d < cd:
                    cd = d
                    country = ef['country']
            if cd > 50:
                country = 'Unknown'
            
            if country not in new_by_country:
                new_by_country[country] = []
            new_by_country[country].append({
                'id': f"gtfs-{country.lower()}-{len(new_by_country[country])}",
                'name': gs['name'],
                'lat': gs['lat'],
                'lng': gs['lng'],
                'operators': [],
                'source': 'gtfs',
                'url': ''
            })
    
    # Add new stations
    for country, stations in new_by_country.items():
        if country not in existing['countries']:
            existing['countries'][country] = {'country': country, 'qid': '', 'iso': '', 'counts': {}, 'stations': []}
        c = existing['countries'][country]
        c['stations'].extend(stations)
        c['counts']['total'] = len(c['stations'])
    
    total_new = sum(len(v) for v in new_by_country.values())
    existing['generatedAt'] = datetime.utcnow().isoformat() + 'Z'
    
    print(f"Name overrides: {overrides}")
    print(f"New stations: {total_new}")
    
    # Write
    with open(STATIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)
    print(f"Written to {STATIONS_FILE}")
    print("Done!")

if __name__ == '__main__':
    main()
