"""
Track & Tide — Station Downloader (Python)
Downloads train stations from Wikidata for all European countries.
Uses requests with proper timeout handling.
"""
import json, sys, os, time, requests
from math import radians, cos, sin, asin, sqrt

EXISTING_FILE = os.path.join(os.path.dirname(__file__), '..', 'stations.json')
OUTPUT_FILE = EXISTING_FILE
STATE_FILE = os.path.join(os.path.dirname(__file__), '..', 'station-download-state.json')

EUROPEAN_COUNTRIES = [
    ('Albania', 'AL', 'Q222'),
    ('Andorra', 'AD', 'Q228'),
    ('Austria', 'AT', 'Q40'),
    ('Belarus', 'BY', 'Q184'),
    ('Belgium', 'BE', 'Q31'),
    ('Bosnia and Herzegovina', 'BA', 'Q225'),
    ('Bulgaria', 'BG', 'Q219'),
    ('Croatia', 'HR', 'Q224'),
    ('Cyprus', 'CY', 'Q229'),
    ('Czechia', 'CZ', 'Q213'),
    ('Denmark', 'DK', 'Q35'),
    ('Estonia', 'EE', 'Q191'),
    ('Finland', 'FI', 'Q33'),
    ('France', 'FR', 'Q142'),
    ('Germany', 'DE', 'Q183'),
    ('Greece', 'GR', 'Q41'),
    ('Hungary', 'HU', 'Q28'),
    ('Iceland', 'IS', 'Q189'),
    ('Ireland', 'IE', 'Q27'),
    ('Italy', 'IT', 'Q38'),
    ('Kosovo', 'XK', 'Q1246'),
    ('Latvia', 'LV', 'Q211'),
    ('Liechtenstein', 'LI', 'Q347'),
    ('Lithuania', 'LT', 'Q37'),
    ('Luxembourg', 'LU', 'Q32'),
    ('Malta', 'MT', 'Q233'),
    ('Moldova', 'MD', 'Q217'),
    ('Monaco', 'MC', 'Q235'),
    ('Montenegro', 'ME', 'Q236'),
    ('Netherlands', 'NL', 'Q55'),
    ('North Macedonia', 'MK', 'Q221'),
    ('Norway', 'NO', 'Q20'),
    ('Poland', 'PL', 'Q36'),
    ('Portugal', 'PT', 'Q45'),
    ('Romania', 'RO', 'Q218'),
    ('San Marino', 'SM', 'Q238'),
    ('Serbia', 'RS', 'Q403'),
    ('Slovakia', 'SK', 'Q214'),
    ('Slovenia', 'SI', 'Q215'),
    ('Spain', 'ES', 'Q29'),
    ('Sweden', 'SE', 'Q34'),
    ('Switzerland', 'CH', 'Q39'),
    ('Turkey', 'TR', 'Q43'),
    ('Ukraine', 'UA', 'Q212'),
    ('United Kingdom', 'GB', 'Q145'),
    ('Vatican City', 'VA', 'Q237'),
]

DEDUP_THRESHOLD_KM = 0.5
TIMEOUT = 60  # seconds per SPARQL query

def haversine_km(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)**2
    return R * 2 * asin(sqrt(a))

def clean_name(name):
    import re
    name = str(name or '')
    name = re.sub(r'\s+', ' ', name)
    name = re.sub(r'^Bahnhof\s+', '', name, flags=re.IGNORECASE)
    name = re.sub(r"^(Gare de|Gare du|Gare d'|Stazione di|Stazione|Estación de|Estación|Estação de|Estação|Dworzec)\s+", '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s+(railway station|railway|train station|central station|bus station|metro station|airport|aeroport|aéroport|flughafen|hauptbahnhof|hbf|bahnhof|station|gare|stazione|estación|estação|vasútállomás|pályaudvar|állomás)$', '', name, flags=re.IGNORECASE)
    return name.strip()

def make_id(name, iso):
    import re, unicodedata
    clean = clean_name(name).lower()
    clean = unicodedata.normalize('NFD', clean)
    clean = ''.join(c for c in clean if not unicodedata.combining(c))
    clean = re.sub(r'[^a-z0-9]+', '-', clean).strip('-')
    return f"{clean}-{iso.lower()}"

def fetch_wikidata(country_name, qid):
    # Strategy 1: Fast query with label service (GET)
    query = f"""
SELECT DISTINCT ?station ?stationLabel ?wdId ?lat ?lon WHERE {{
  ?station wdt:P17 wd:{qid}.
  ?station wdt:P31 ?type.
  VALUES ?type {{
    wd:Q55488    # railway station
    wd:Q55489    # railway stop (halt)
    wd:Q928830   # metro station
    wd:Q12046342 # S-Bahn station
    wd:Q2175765  # underground station
    wd:Q55491    # railway junction
    wd:Q548662   # request stop / halt
  }}
  ?station wdt:P625 ?coord.
  BIND(geof:latitude(?coord) AS ?lat)
  BIND(geof:longitude(?coord) AS ?lon)
  BIND(STRAFTER(STR(?station), "http://www.wikidata.org/entity/") AS ?wdId)
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,de,fr,it,es,nl,pl,cs,sv,da,fi,el,hu,ro,bg,sk,sl,hr,sr,lt,lv,et,uk,no". }}
}}
LIMIT 30000
"""
    try:
        resp = requests.get('https://query.wikidata.org/sparql',
                          params={'format': 'json', 'query': query},
                          headers={'User-Agent': 'TrackAndTide/1.0'},
                          timeout=TIMEOUT)
        resp.raise_for_status()
        try:
            data = resp.json()
        except json.JSONDecodeError:
            data = json.loads(resp.text, strict=False)
        bindings = data.get('results', {}).get('bindings', [])
        if bindings:
            return parse_bindings(bindings)
    except Exception as e:
        print(f"    Wikidata GET failed: {e}, trying paginated fallback...")
    
    # Strategy 2: Fallback with pagination, no label service
    return fetch_wikidata_paginated(country_name, qid)

def parse_bindings(bindings):
    stations = []
    for b in bindings:
        try:
            lat = float(b['lat']['value'])
            lng = float(b['lon']['value'])
            wdid = b.get('wdId', {}).get('value', '')
            name = b.get('stationLabel', {}).get('value', '')
            if not name:
                name = b.get('station', {}).get('value', '').split('/')[-1].replace('_', ' ')
            if lat and lng and name:
                stations.append({
                    'name': name, 'lat': lat, 'lng': lng,
                    'wikidataId': wdid, 'source': 'wikidata',
                    'url': f"https://www.wikidata.org/wiki/{wdid}" if wdid else '',
                })
        except (ValueError, KeyError):
            pass
    return stations

def fetch_wikidata_paginated(country_name, qid):
    all_stations = []
    offset = 0
    batch_size = 5000
    
    while offset < 50000:
        query = f"""
SELECT DISTINCT ?station ?stationLabel ?wdId ?lat ?lon WHERE {{
  ?station wdt:P17 wd:{qid}.
  ?station wdt:P31 ?type.
  VALUES ?type {{
    wd:Q55488 wd:Q55489 wd:Q928830 wd:Q12046342 wd:Q2175765 wd:Q55491 wd:Q548662
  }}
  ?station wdt:P625 ?coord.
  ?station rdfs:label ?stationLabel.
  FILTER(LANG(?stationLabel) = "en" || LANG(?stationLabel) = "de" || LANG(?stationLabel) = "fr" 
      || LANG(?stationLabel) = "it" || LANG(?stationLabel) = "es" || LANG(?stationLabel) = "nl"
      || LANG(?stationLabel) = "pl" || LANG(?stationLabel) = "cs")
  BIND(geof:latitude(?coord) AS ?lat)
  BIND(geof:longitude(?coord) AS ?lon)
  BIND(STRAFTER(STR(?station), "http://www.wikidata.org/entity/") AS ?wdId)
}}
LIMIT {batch_size} OFFSET {offset}
"""
        try:
            resp = requests.get('https://query.wikidata.org/sparql',
                              params={'format': 'json', 'query': query},
                              headers={'User-Agent': 'TrackAndTide/1.0'},
                              timeout=TIMEOUT)
            resp.raise_for_status()
            try:
                data = resp.json()
            except json.JSONDecodeError:
                data = json.loads(resp.text, strict=False)
            bindings = data.get('results', {}).get('bindings', [])
            if not bindings:
                break
            all_stations.extend(parse_bindings(bindings))
            if len(bindings) < batch_size:
                break
            offset += batch_size
        except Exception as e:
            print(f"    Wikidata fallback error at offset {offset}: {e}")
            break
    
    return all_stations

def deduplicate(stations):
    deduped = []
    for s in stations:
        dup = False
        for existing in deduped:
            if haversine_km(s['lat'], s['lng'], existing['lat'], existing['lng']) < DEDUP_THRESHOLD_KM:
                dup = True
                if s.get('operators') and not existing.get('operators'):
                    existing['operators'] = s['operators']
                if s['source'] == 'wikidata' and existing['source'] == 'osm':
                    existing['wikidataId'] = s.get('wikidataId', '')
                    existing['url'] = s.get('url', '')
                    existing['source'] = 'wikidata'
                break
        if not dup:
            deduped.append(s)
    deduped.sort(key=lambda x: x['name'])
    return deduped

def merge_osm(new_stations, existing_country):
    if not existing_country or 'stations' not in existing_country:
        return new_stations, 0
    osm_preserved = 0
    for old in existing_country['stations']:
        if old.get('source') != 'osm':
            continue
        if not old.get('lat') or not old.get('lng'):
            continue
        dup = False
        for ns in new_stations:
            if ns.get('source') == 'osm':
                continue
            if haversine_km(old['lat'], old['lng'], ns['lat'], ns['lng']) < DEDUP_THRESHOLD_KM:
                dup = True
                if old.get('operators') and not ns.get('operators'):
                    ns['operators'] = old['operators']
                if old.get('limited_use'):
                    ns['limited_use'] = True
                break
        if not dup:
            new_stations.append({
                'id': old.get('id', ''),
                'url': old.get('url', ''),
                'wikidataId': old.get('wikidataId', ''),
                'source': 'osm',
                'name': old['name'],
                'lat': old['lat'],
                'lng': old['lng'],
                'operators': old.get('operators', []),
                'limited_use': old.get('limited_use', False),
            })
            osm_preserved += 1
    return new_stations, osm_preserved

def main():
    # Parse args
    target_names = None
    args = sys.argv[1:]
    if '--country' in args:
        idx = args.index('--country')
        target_names = set()
        for a in args[idx+1:]:
            if a.startswith('--'):
                break
            target_names.add(a)
    
    # Load existing
    existing = {'countries': {}}
    try:
        with open(EXISTING_FILE, 'r', encoding='utf-8') as f:
            existing = json.load(f)
        print(f"Loaded existing data with {len(existing.get('countries', {}))} countries")
    except:
        print("No existing data found")
    
    # Filter countries
    target = EUROPEAN_COUNTRIES
    if target_names:
        target = [c for c in EUROPEAN_COUNTRIES if c[0] in target_names]
    
    print(f"Target: {', '.join(c[0] for c in target)}")
    print()
    
    result = {}
    total_wd = 0
    total_osm = 0
    grand_total = 0
    
    for i, (name, iso, qid) in enumerate(target):
        print(f"[{i+1}/{len(target)}] {name} ({iso})")
        
        wd = fetch_wikidata(name, qid)
        
        if wd is None:
            # Failed, use existing
            existing_country = existing.get('countries', {}).get(name)
            if existing_country:
                result[name] = existing_country
                cnt = existing_country.get('counts', {}).get('total', 0)
                print(f"  Wikidata failed, preserving {cnt} existing stations")
                grand_total += cnt
            else:
                result[name] = {
                    'country': name, 'qid': qid, 'iso': iso,
                    'counts': {'total': 0, 'wikidata': 0, 'osm': 0},
                    'stations': [],
                }
            print()
            continue
        
        print(f"    Wikidata returned {len(wd)} results")
        
        stations = []
        for s in wd:
            stations.append({
                'id': make_id(s['name'], iso),
                'url': s['url'],
                'wikidataId': s['wikidataId'],
                'source': s['source'],
                'name': s['name'],
                'lat': s['lat'],
                'lng': s['lng'],
                'operators': [],
            })
        
        wd_before = len(stations)
        stations = deduplicate(stations)
        wd_after = len(stations)
        
        existing_country = existing.get('countries', {}).get(name)
        stations, osm_preserved = merge_osm(stations, existing_country)
        
        stations = deduplicate(stations)
        
        total_wd += len(wd)
        total_osm += osm_preserved
        grand_total += len(stations)
        
        result[name] = {
            'country': name, 'qid': qid, 'iso': iso,
            'counts': {'total': len(stations), 'wikidata': len(wd), 'osm': osm_preserved},
            'stations': stations,
        }
        
        print(f"  → {len(stations)} unique ({wd_before} WD raw, {wd_after} WD dedup, {osm_preserved} OSM preserved)")
        print()
        
        # Save intermediate after each country
        output = {
            'generatedAt': time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime()),
            'sources': {
                'wikidata': 'https://query.wikidata.org/sparql',
                'osm': existing.get('sources', {}).get('osm', ['https://overpass-api.de/api/interpreter']),
            },
            'countries': result,
        }
        # Also preserve unprocessed existing countries
        for cn, cd in existing.get('countries', {}).items():
            if cn not in result:
                result[cn] = cd
        
        output['countries'] = result
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False)
    
    # Final summary
    print(f"\n{'═'*50}")
    print(f"Download complete!")
    print(f"Countries processed: {len(target)}")
    print(f"Total Wikidata fetched: {total_wd}")
    print(f"Total OSM preserved: {total_osm}")
    print(f"Total unique stations: {grand_total}")
    print(f"Output: {OUTPUT_FILE}")
    print(f"{'═'*50}")

if __name__ == '__main__':
    main()
