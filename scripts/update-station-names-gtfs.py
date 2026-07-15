"""
Update station NAMES in stations.json using GTFS feeds.
Only matches existing stations by proximity, updates names from GTFS.
Does NOT add new stations. Fast - O(n) grid-based matching.
"""
import zipfile, io, csv, os, json, math, shutil
from datetime import datetime

GTFS_DIR = os.path.join(os.path.dirname(__file__), '..', 'gtfs feeds')
STATIONS_FILE = os.path.join(os.path.dirname(__file__), '..', 'stations.json')
BACKUP_FILE = os.path.join(os.path.dirname(__file__), '..', 'stations.json.bak')

RAIL_ROUTE_TYPES = {'2', '100', '101', '102', '103', '104', '105', '106', '107', '108', '109', '110', '111', '112', '113', '114', '115', '116', '117'}

RAILWAY_FEEDS = [
    'de_DELFI', 'be_sncb', 'gb_great-britain', 'gb_northern-ireland',
    'ch_opentransportdataswiss26', 'ch_opentransportdataswiss-flex',
    'fr_horaires-sncf', 'fr_horaires-des-trains-trenitalia-france',
    'at_Railway', 'es_RENFE', 'es_Cercanías',
    'es_Euskotren', 'es_Ferrocarrils', 'es_Feve', 'es_Ouigo',
    'it_Lombardia-Trenord', 'it_Piemonte-Trenitalia', 'it_Sardegna-Trenitalia',
    'it_Toscana-Trenitalia', 'hr_hz', 'hu_mav', 'cz_CZPTT',
    'bg_bdz', 'ee_elron', 'fi_fintraffic', 'dk_rejseplanen',
    'ie_transport-for-ireland', 'ge_georgian-railway', 'gr_Hellenic-Train',
    'eu_eurostar', 'eu_european-sleeper', 'fr_breizhgo-ter',
    'fr_trains-express-regionaux-zou', 'fr_horaires-ave-espagne-france',
]
MATCH_KM = 0.5

def clean_name(name):
    import re
    if not name: return ''
    name = name.strip()
    # Skip obvious bus/coach stops
    bus_patterns = r'\b(bus\s*station|central\s*bus|busbahnhof|bus\s*stop|coach\s*station|bus\s*terminal|bus\s*stand|estación\s*de\s*autobuses|gare\s*routière|autobus|busstop|fernbus|long\s*distance\s*bus)\b'
    if re.search(bus_patterns, name, re.IGNORECASE):
        return ''
    # Strip parentheticals that look like street/address names (not city indicators)
    # Keep "(Main)", "(Saale)", etc. but remove "(De Ruijterkade)", "(Pershing - Porte Maillot)"
    name = re.sub(r'\s*\([^)]*(?:kade|straat|laan|weg|plein|square|street|road|lane|avenue|drive|court|place|boulevard|pershing|porte|gate|bridge)[^)]*\)\s*$', '', name, re.IGNORECASE)
    name = re.sub(r'\s*\(?(Binario|Voie|Andén|Spor|Peron|Track|Platform|Gleis|Spoor|Vía|Quay|Steig|Bstg)\s*\d+\)?\s*$', '', name, re.IGNORECASE)
    name = re.sub(r'\s+\d+[A-Z]?$', '', name)
    name = re.sub(r'\s*\(Bus\)$', '', name, re.IGNORECASE)
    name = re.sub(r'\s+', ' ', name).strip()
    # Skip if after cleaning, the name is just a city name with nothing else
    if name and len(name.split()) == 1 and len(name) < 6:
        return ''
    return name

def is_railway_station_name(name):
    """Check if a name looks like a genuine railway station (not a bus stop)."""
    import re
    # Must be at least 4 characters
    if len(name) < 4:
        return False
    # Must contain station-related keywords OR be a known compound station name
    station_keywords = r'(?i)\b(hbf|hauptbahnhof|bahnhof|bf\.?$|station|central|centraal|centrale|gare|stazione|estaci[oó]n|esta[cç][aã]o|railway|train|rail$|terminal|junction|interchange|airport|flughafen|halte|halt$|stop$|stoptrein|sprinter|intercity|ice$|ic$|metro|subway|tram|ferry|port\b|haven|harbour)'
    # Or: ends with city-like name that's known to be a station (e.g., "Paris Gare du Nord")
    # Or: is a multi-word compound that sounds like a station name
    words = name.split()
    if len(words) >= 3:
        return True  # Multi-word names are likely stations
    if re.search(station_keywords, name):
        return True
    if len(words) == 2:
        return True  # Two-word names like "Amsterdam Amstel", "Paris Nord"
    # Single word: only allow if it contains station keyword
    return bool(re.search(station_keywords, name))

def is_railway_feed(filename):
    return any(kw in filename for kw in RAILWAY_FEEDS)

def main():
    print("=== GTFS Station Name Updater ===\n")
    
    shutil.copy2(STATIONS_FILE, BACKUP_FILE)
    print(f"Backed up to {BACKUP_FILE}")
    
    with open(STATIONS_FILE, 'r', encoding='utf-8') as f:
        existing = json.load(f)
    
    existing_stations = []
    for cname, cdata in existing.get('countries', {}).items():
        for s in cdata.get('stations', []):
            existing_stations.append({'station': s, 'country': cname})
    
    print(f"Existing stations: {len(existing_stations)}")
    
    # Spatial grid (0.25 deg cells)
    grid = {}
    for es in existing_stations:
        s = es['station']
        gx = int(s['lng'] * 4)
        gy = int(s['lat'] * 4)
        key = (gx, gy)
        grid.setdefault(key, []).append(es)
    
    overrides = 0
    processed = 0
    feed_files = sorted(os.listdir(GTFS_DIR))
    
    for filename in feed_files:
        if not filename.endswith('.gtfs.zip'): continue
        if not is_railway_feed(filename): continue
        
        filepath = os.path.join(GTFS_DIR, filename)
        try:
            z = zipfile.ZipFile(filepath)
            files = z.namelist()
            if 'stops.txt' not in files:
                z.close(); continue
            
            has_rail = False
            if 'routes.txt' in files:
                with z.open('routes.txt') as rf:
                    reader = csv.DictReader(io.TextIOWrapper(rf, 'utf-8'))
                    for row in reader:
                        if row.get('route_type', '').strip() in RAIL_ROUTE_TYPES:
                            has_rail = True; break
            if not has_rail:
                z.close(); continue
            
            count = 0; matched = 0; feed_overrides = 0
            with z.open('stops.txt') as sf:
                reader = csv.DictReader(io.TextIOWrapper(sf, 'utf-8'))
                for row in reader:
                    loc_type = row.get('location_type', '').strip()
                    # Only parent stations (0=stop, 1=station), skip platforms (empty), entrances (2), etc.
                    if loc_type and loc_type not in ('0', '1'): continue
                    
                    name = clean_name(row.get('stop_name', ''))
                    if not name or len(name) < 2: continue
                    
                    try:
                        lat = float(row.get('stop_lat', ''))
                        lon = float(row.get('stop_lon', ''))
                    except ValueError:
                        continue
                    if lat == 0 and lon == 0: continue
                    
                    count += 1
                    if count % 100000 == 0:
                        print(f"    ...{count} stops, {feed_overrides} overrides")
                    
                    gx = int(lon * 4); gy = int(lat * 4)
                    coslat = math.cos(math.radians(lat))
                    
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            key = (gx + dx, gy + dy)
                            if key not in grid: continue
                            for es in grid[key]:
                                s = es['station']
                                dlat = abs(lat - s['lat'])
                                dlon = abs(lon - s['lng'])
                                if dlat * 111 < MATCH_KM and dlon * 111 * coslat < MATCH_KM:
                                    if s['name'] != name and is_railway_station_name(name):
                                        s['name'] = name
                                        overrides += 1; feed_overrides += 1
                                    matched += 1
                                    break
                            else: continue
                            break
            
            z.close(); processed += 1
            print(f"  {filename}: {count} stops, {matched} matched, {feed_overrides} overrides")
        except Exception as e:
            print(f"  {filename}: ERROR {e}")
    
    existing['generatedAt'] = datetime.utcnow().isoformat() + 'Z'
    with open(STATIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)
    
    print(f"\n{processed} feeds, {overrides} name overrides total")
    print(f"Written to {STATIONS_FILE}")
    print("Done!")

if __name__ == '__main__':
    main()
