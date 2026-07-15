"""
Update stations.json with GTFS feed data.
- Backs up existing stations.json
- Reads all GTFS feeds
- Extracts railway station stops (route_type 2, 100-109)
- Merges with existing stations, GTFS names take priority
- Deduplicates by geo proximity
- Outputs updated stations.json
"""
import zipfile, io, csv, os, json, sys, math

GTFS_DIR = os.path.join(os.path.dirname(__file__), '..', 'gtfs feeds')
STATIONS_FILE = os.path.join(os.path.dirname(__file__), '..', 'stations.json')
BACKUP_FILE = os.path.join(os.path.dirname(__file__), '..', 'stations.json.bak')

# Rail route types in GTFS (extended)
# 2 = Rail, 100 = Railway Service, 101 = High Speed Rail, 102 = Long Distance,
# 103 = Night Rail, 104 = Regional Rail, 105 = Tourist Rail, 106 = Rail Shuttle,
# 109 = Suburban Railway, 110-117 = various rail
RAIL_ROUTE_TYPES = {'2', '100', '101', '102', '103', '104', '105', '106', '107', '108', '109', '110', '111', '112', '113', '114', '115', '116', '117'}

# Exclude: metro/subway (400-405), tram (0, 900), bus (3, 700-715), ferry (4, 1000, 1200, 1500)
EXCLUDE_TYPES = frozenset()

# Minimum distance in km for two stations to be considered different
DEDUP_DISTANCE_KM = 0.3

def haversine_km(lat1, lon1, lat2, lon2):
    """Distance between two points in km."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def load_existing():
    """Load existing stations.json"""
    with open(STATIONS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def clean_name(name):
    """Clean a station name."""
    if not name:
        return ''
    name = name.strip()
    # Remove platform suffixes like " (Platform 1)", " Gleis 1", " Binario 1"
    import re
    name = re.sub(r'\s*\(?(Binario|Voie|Andén|Spor|Peron|Track|Platform|Gleis|Spoor|Vía)\s*\d+\)?\s*$', '', name, flags=re.IGNORECASE)
    # Remove trailing numbers that look like platform numbers
    name = re.sub(r'\s+\d+[A-Z]?$', '', name)
    # Remove known non-station suffixes
    name = re.sub(r'\s*\(Bus\)$', '', name, flags=re.IGNORECASE)
    # Normalize whitespace
    name = re.sub(r'\s+', ' ', name)
    return name.strip()

def extract_rail_stops(filepath, feed_name):
    """Extract railway station stops from a GTFS feed."""
    try:
        z = zipfile.ZipFile(filepath)
        files = z.namelist()
        
        if 'stops.txt' not in files:
            z.close()
            return []
        
        # Step 1: Determine which route_types are in this feed
        has_rail = False
        rail_route_ids = set()
        
        if 'routes.txt' in files:
            with z.open('routes.txt') as rf:
                reader = csv.DictReader(io.TextIOWrapper(rf, 'utf-8'))
                for row in reader:
                    rt = row.get('route_type', '').strip()
                    if rt in RAIL_ROUTE_TYPES:
                        has_rail = True
                        rail_route_ids.add(row.get('route_id', ''))
        
        if not has_rail:
            # Check if this is a known railway-only feed by filename
            rail_keywords = ['sncf', 'sncb', 'renfe', 'delfi', 'railway', 'trenord', 'trenitalia',
                           'mav', 'hz', 'czptt', 'elron', 'bdz', 'fintraffic', 'eurostar',
                           'cercanías', 'feve', 'euskotren', 'ferrocarrils', 'opentransportdataswiss']
            feed_lower = feed_name.lower()
            if not any(kw in feed_lower for kw in rail_keywords):
                z.close()
                return []
        
        # Step 2: Get stop_ids served by rail routes
        rail_stop_ids = set()
        if rail_route_ids and 'trips.txt' in files and 'stop_times.txt' in files:
            # Get trip_ids for rail routes
            rail_trip_ids = set()
            with z.open('trips.txt') as tf:
                reader = csv.DictReader(io.TextIOWrapper(tf, 'utf-8'))
                for row in reader:
                    if row.get('route_id', '') in rail_route_ids:
                        rail_trip_ids.add(row.get('trip_id', ''))
            
            # Get stop_ids from those trips
            if rail_trip_ids:
                with z.open('stop_times.txt') as sf:
                    reader = csv.DictReader(io.TextIOWrapper(sf, 'utf-8'))
                    for row in reader:
                        if row.get('trip_id', '') in rail_trip_ids:
                            rail_stop_ids.add(row.get('stop_id', ''))
        
        # Step 3: Read stops
        stops = []
        with z.open('stops.txt') as sf:
            content = io.TextIOWrapper(sf, 'utf-8')
            # Check for BOM
            first_line = content.readline()
            if first_line.startswith('\ufeff'):
                first_line = first_line[1:]
            content.seek(0)
            
            reader = csv.DictReader(content)
            for row in reader:
                stop_id = row.get('stop_id', '')
                stop_name = row.get('stop_name', '')
                
                # Skip if we have route filtering and this stop isn't served by rail
                if rail_stop_ids and stop_id not in rail_stop_ids:
                    continue
                
                # Skip bus stops, tram stops, etc. based on name patterns
                name_lower = stop_name.lower()
                if any(x in name_lower for x in [' bus', 'bus ', '(bus)', ' bus)', ' bus station']):
                    continue
                
                # Must have coordinates
                lat = row.get('stop_lat', '')
                lon = row.get('stop_lon', '')
                if not lat or not lon:
                    continue
                
                try:
                    lat_f = float(lat)
                    lon_f = float(lon)
                except ValueError:
                    continue
                
                if lat_f == 0 and lon_f == 0:
                    continue
                
                # Only keep parent stations (location_type 0, 1, or empty)
                loc_type = row.get('location_type', '').strip()
                if loc_type in ('2', '3', '4'):
                    continue  # Skip entrances, boarding areas, etc.
                
                name = clean_name(stop_name)
                if not name or len(name) < 2:
                    continue
                
                # Check for parent_station - if exists, prefer parent
                parent = row.get('parent_station', '')
                
                stops.append({
                    'id': f"gtfs:{stop_id}",
                    'name': name,
                    'lat': lat_f,
                    'lng': lon_f,
                    'source': 'gtfs',
                    'feed': feed_name,
                    'parent': parent if parent else None
                })
        
        z.close()
        
        # Deduplicate within feed by parent station
        # Group by parent, take the parent station's coords
        parents = {}
        orphans = []
        for s in stops:
            if s['parent']:
                if s['parent'] not in parents:
                    parents[s['parent']] = s
            else:
                orphans.append(s)
        
        # Deduplicate by name + proximity
        result = list(parents.values()) + orphans
        result = deduplicate_stops(result)
        
        return result
    
    except Exception as e:
        print(f"  ERROR in {feed_name}: {e}")
        return []

def deduplicate_stops(stops):
    """Remove duplicate stops by proximity."""
    if len(stops) <= 1:
        return stops
    
    # Sort by name
    stops.sort(key=lambda s: s['name'])
    
    result = []
    for s in stops:
        is_dup = False
        for existing in result:
            dist = haversine_km(s['lat'], s['lng'], existing['lat'], existing['lng'])
            if dist < DEDUP_DISTANCE_KM:
                is_dup = True
                break
        if not is_dup:
            result.append(s)
    
    return result

def merge_with_existing(existing_data, gtfs_stops):
    """Merge GTFS stops with existing stations.json data."""
    countries = existing_data.get('countries', {})
    
    # Build a lookup of existing stations by geo proximity and name
    existing_flat = []
    for country_name, cdata in countries.items():
        for s in cdata.get('stations', []):
            existing_flat.append({
                'country': country_name,
                'station': s
            })
    
    # Track which GTFS stops are new vs matching existing
    matched = set()  # indices of existing stations that were matched
    new_stations_by_country = {}
    name_overrides = 0
    
    for gs in gtfs_stops:
        gs_name = gs['name']
        gs_lat = gs['lat']
        gs_lng = gs['lng']
        
        # Find best matching existing station
        best_match = None
        best_dist = float('inf')
        
        for i, ef in enumerate(existing_flat):
            if i in matched:
                continue
            es = ef['station']
            # Check name similarity first (case insensitive)
            dist = haversine_km(gs_lat, gs_lng, es['lat'], es['lng'])
            if dist < 1.0:  # Within 1km
                if dist < best_dist:
                    best_dist = dist
                    best_match = i
        
        if best_match is not None and best_dist < DEDUP_DISTANCE_KM:
            # Update existing station name with GTFS name
            ef = existing_flat[best_match]
            old_name = ef['station']['name']
            if old_name != gs_name:
                ef['station']['name'] = gs_name
                name_overrides += 1
            # Add gtfs source if not present
            if 'gtfs' not in ef['station'].get('source', ''):
                ef['station']['source'] = ef['station'].get('source', '') + '+gtfs'
            matched.add(best_match)
        else:
            # New station - need to determine country
            # Use closest existing station's country as hint
            closest_country = None
            closest_dist = float('inf')
            for ef in existing_flat:
                dist = haversine_km(gs_lat, gs_lng, ef['station']['lat'], ef['station']['lng'])
                if dist < closest_dist:
                    closest_dist = dist
                    closest_country = ef['country']
            
            if closest_country and closest_dist < 50:  # Within 50km of a known country
                country = closest_country
            else:
                country = 'Unknown'
            
            if country not in new_stations_by_country:
                new_stations_by_country[country] = []
            
            new_id = f"gtfs-{gs['feed'].replace('.gtfs.zip','')}-{len(new_stations_by_country[country])}"
            new_stations_by_country[country].append({
                'id': new_id,
                'name': gs_name,
                'lat': gs_lat,
                'lng': gs_lng,
                'operators': [],
                'source': 'gtfs',
                'url': ''
            })
    
    # Update existing data
    total_new = sum(len(v) for v in new_stations_by_country.values())
    
    for country, stations in new_stations_by_country.items():
        if country not in countries:
            countries[country] = {
                'country': country,
                'qid': '',
                'iso': '',
                'counts': {'total': 0, 'wikidata': 0, 'osm': 0, 'gtfs': 0},
                'stations': []
            }
        cdata = countries[country]
        cdata['stations'].extend(stations)
        cdata['counts']['total'] = len(cdata['stations'])
        cdata['counts']['gtfs'] = cdata['counts'].get('gtfs', 0) + len(stations)
    
    # Update generation timestamp
    from datetime import datetime
    existing_data['generatedAt'] = datetime.utcnow().isoformat() + 'Z'
    existing_data['sources']['gtfs'] = 'Various GTFS feeds from transport.data.gouv.fr and other open data portals'
    
    print(f"  Name overrides: {name_overrides}")
    print(f"  New stations added: {total_new}")
    print(f"  Existing stations: {len(existing_flat)}")
    
    return existing_data

def main():
    print("=== GTFS Station Updater ===\n")
    
    # Backup existing
    if os.path.exists(STATIONS_FILE):
        print(f"Backing up {STATIONS_FILE} -> {BACKUP_FILE}")
        import shutil
        shutil.copy2(STATIONS_FILE, BACKUP_FILE)
    
    # Load existing
    existing = load_existing()
    
    # Process feeds - prioritize railway-specific feeds
    all_gtfs_stops = []
    
    # Railway-only feeds first (by filename)
    rail_keywords = ['sncf', 'sncb', 'renfe', 'delfi', 'railway', 'trenord', 'trenitalia',
                    'mav', 'hz', 'czptt', 'elron', 'bdz', 'fintraffic', 'cercanías', 'feve',
                    'euskotren', 'ferrocarrils', 'eurostar', 'VIA', 'amtrak', 'metra',
                    'great-britain', 'rejseplanen', 'opentransportdataswiss', 'ouigo', 'irigo',
                    'PID', 'vlacky', 'sncf', 'mav', 'zou', 'breizhgo-ter', 'aleop', 'suburban']
    
    feed_files = sorted(os.listdir(GTFS_DIR))
    
    for i, filename in enumerate(feed_files):
        if not filename.endswith('.gtfs.zip'):
            continue
        
        filepath = os.path.join(GTFS_DIR, filename)
        
        # Check if likely railway feed
        is_rail = any(kw in filename.lower() for kw in rail_keywords)
        
        if is_rail:
            print(f"[{i+1}/{len(feed_files)}] {filename} (railway)")
            stops = extract_rail_stops(filepath, filename)
            if stops:
                print(f"  -> {len(stops)} rail stops extracted")
                all_gtfs_stops.extend(stops)
            else:
                print(f"  -> no rail stops")
    
    # Deduplicate all GTFS stops
    print(f"\nTotal GTFS stops before dedup: {len(all_gtfs_stops)}")
    all_gtfs_stops = deduplicate_stops(all_gtfs_stops)
    print(f"Total GTFS stops after dedup: {len(all_gtfs_stops)}")
    
    # Merge with existing
    print("\nMerging with existing stations.json...")
    updated = merge_with_existing(existing, all_gtfs_stops)
    
    # Write output
    print(f"\nWriting updated stations.json...")
    with open(STATIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump(updated, f, ensure_ascii=False, indent=2)
    
    print("Done!")

if __name__ == '__main__':
    main()
