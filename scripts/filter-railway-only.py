"""
Filter stations.json: keep only stations that were matched by railway GTFS feeds.
This removes metro, tram, bus, funicular, and other non-railway stations.
"""
import zipfile, io, csv, os, json, math, shutil
from datetime import datetime

GTFS_DIR = os.path.join(os.path.dirname(__file__), '..', 'gtfs feeds')
STATIONS_FILE = os.path.join(os.path.dirname(__file__), '..', 'stations.json')

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
    'it_skyalps', 'eu_optimaexpress', 'es_Trenes-y-tranvías-de-Alicante',
]
MATCH_KM = 0.5

def is_railway_feed(filename):
    return any(kw in filename for kw in RAILWAY_FEEDS)

def main():
    print("=== Filtering stations.json to railway-only ===")
    
    with open(STATIONS_FILE, 'r', encoding='utf-8') as f:
        existing = json.load(f)
    
    # Build flat station list with index
    existing_stations = []
    for cname, cdata in existing.get('countries', {}).items():
        for i, s in enumerate(cdata.get('stations', [])):
            existing_stations.append({'station': s, 'country': cname, 'cidx': i, 'cname': cname})
    
    print(f"Before: {len(existing_stations)} stations in {len(existing['countries'])} countries")
    
    # Spatial grid
    grid = {}
    for es in existing_stations:
        s = es['station']
        gx = int(s['lng'] * 4); gy = int(s['lat'] * 4)
        grid.setdefault((gx, gy), []).append(es)
    
    # Mark stations matched by GTFS
    matched_set = set()  # (country, station_index)
    
    feed_files = sorted(os.listdir(GTFS_DIR))
    for filename in feed_files:
        if not filename.endswith('.gtfs.zip'): continue
        if not is_railway_feed(filename): continue
        
        filepath = os.path.join(GTFS_DIR, filename)
        try:
            z = zipfile.ZipFile(filepath)
            files = z.namelist()
            if 'stops.txt' not in files: z.close(); continue
            
            has_rail = False
            if 'routes.txt' in files:
                with z.open('routes.txt') as rf:
                    reader = csv.DictReader(io.TextIOWrapper(rf, 'utf-8'))
                    for row in reader:
                        if row.get('route_type', '').strip() in RAIL_ROUTE_TYPES:
                            has_rail = True; break
            if not has_rail: z.close(); continue
            
            count = 0; matched = 0
            with z.open('stops.txt') as sf:
                reader = csv.DictReader(io.TextIOWrapper(sf, 'utf-8'))
                for row in reader:
                    loc_type = row.get('location_type', '').strip()
                    if loc_type and loc_type not in ('0', '1'): continue
                    
                    try:
                        lat = float(row.get('stop_lat', ''))
                        lon = float(row.get('stop_lon', ''))
                    except ValueError: continue
                    if lat == 0 and lon == 0: continue
                    
                    count += 1
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
                                    matched_set.add(id(es))
                                    matched += 1
                                    break
                            else: continue
                            break
            z.close()
            print(f"  {filename}: matched {matched} existing stations")
        except Exception as e:
            print(f"  {filename}: ERROR {e}")
    
    # Now filter: only remove non-railway stations from countries covered by GTFS
    # Determine which countries have GTFS coverage
    gtfs_countries = set()
    for es in existing_stations:
        if id(es) in matched_set:
            gtfs_countries.add(es['cname'])
    
    print(f"\nCountries with GTFS railway data: {sorted(gtfs_countries)}")
    cset = set(c['country'] for c in existing['countries'].values())
    print(f"Countries without GTFS: {sorted(cset - gtfs_countries)}")
    
    removed = 0
    countries = existing['countries']
    for cname in list(countries.keys()):
        cdata = countries[cname]
        if cname in gtfs_countries:
            # Filter this country
            old_stations = cdata['stations']
            new_stations = []
            for s in old_stations:
                es = next((e for e in existing_stations if e['station'] is s), None)
                if es and id(es) in matched_set:
                    new_stations.append(s)
                else:
                    removed += 1
            cdata['stations'] = new_stations
            cdata['counts']['total'] = len(new_stations)
        # Countries without GTFS: keep all stations unchanged
    
    total = sum(len(c['stations']) for c in countries.values())
    print(f"\nAfter: {total} stations in {len(countries)} countries")
    print(f"Removed: {removed} non-railway stations")
    
    existing['generatedAt'] = datetime.utcnow().isoformat() + 'Z'
    with open(STATIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)
    print("Done!")

if __name__ == '__main__':
    main()
