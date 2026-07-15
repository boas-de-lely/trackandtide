"""
Query Wikidata for active Austrian railway stations (Q55488 only, in use).
No name filtering — relies purely on Wikidata classification.
"""
import json, urllib.request, urllib.parse, re
from datetime import datetime

STATIONS_FILE = '../stations.json'

QUERY = """
SELECT DISTINCT ?station ?stationLabel ?coord WHERE {
  ?station wdt:P31 wd:Q55488;
           wdt:P17 wd:Q40;
           wdt:P625 ?coord.
  
  MINUS { ?station wdt:P5817 wd:Q511399. }
  MINUS { ?station wdt:P5817 wd:Q35771415. }
  MINUS { ?station wdt:P5817 wd:Q10735358. }
  MINUS { ?station wdt:P5817 wd:Q56557161. }
  MINUS { ?station wdt:P5817 wd:Q56556915. }
  MINUS { ?station wdt:P5817 wd:Q56286695. }
  MINUS { ?station wdt:P5817 wd:Q37941669. }
  MINUS { ?station wdt:P5817 wd:Q11639308. }
  MINUS { ?station wdt:P576 []. }
  MINUS { ?station wdt:P3999 []. }
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
}
ORDER BY ?stationLabel
"""

def strip(name):
    if not name: return ''
    name = name.strip()
    for pre in [r'^Haltestelle\s+', r'^Bahnhof\s+', r'^Bhf\.\s+', r'^Bf\.\s+']:
        name = re.sub(pre, '', name, flags=re.I)
    for suf in [
        r'\s+Hauptbahnhof$', r'\s+Hbf\.?$', r'\s+Bahnhof\s*\([^)]*\)$',
        r'\s+Bahnhof$', r'\s+Bf\.?$', r'\s+Haltepunkt$', r'\s+Haltestelle$',
        r'\s+Railway\s+Station$', r'\s+Train\s+Station$', r'\s+Railway$',
        r'\s+Station$', r'\s+Halt$', r'\s+Spoorwegstation$', r'\s+Treinstation$',
    ]:
        name = re.sub(suf, '', name, flags=re.I)
    name = re.sub(r'\s*\([^)]*(?:Bahnsteig|Gleis|Platform|Track)[^)]*\)\s*', '', name, re.I)
    return name.strip()

def main():
    print("=== Wikidata: Austria Q55488 (railway stations only) ===\n")
    url = "https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(QUERY)
    print("Querying...")
    
    req = urllib.request.Request(url, headers={'User-Agent': 'TrackAndTide/1.0'})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read())
    
    bindings = data['results']['bindings']
    print(f"Raw: {len(bindings)}")
    
    stations = {}  # key by qid for dedup
    seen_coords = set()
    
    for b in bindings:
        name = b.get('stationLabel', {}).get('value', '')
        qid = b['station']['value'].split('/')[-1]
        coord = b.get('coord', {}).get('value', '')
        if not name or not coord: continue
        m = re.match(r'Point\(([-\d.]+)\s+([-\d.]+)\)', coord)
        if not m: continue
        lon, lat = float(m.group(1)), float(m.group(2))
        
        clean = strip(name)
        if not clean or len(clean) < 2: continue
        
        key = (round(lat, 3), round(lon, 3))
        if key in seen_coords: continue
        seen_coords.add(key)
        
        stations[qid] = {
            'id': f"wikidata-{qid}", 'name': clean,
            'lat': lat, 'lng': lon,
            'operators': [], 'source': 'wikidata', 'wikidataId': qid,
            'url': f"https://www.wikidata.org/wiki/{qid}"
        }
    
    result = sorted(stations.values(), key=lambda s: s['name'])
    print(f"After dedup: {len(result)}")
    for s in result[:15]:
        print(f"  {s['name']} ({s['lat']:.4f},{s['lng']:.4f})")
    print(f"  ...")
    
    with open(STATIONS_FILE, 'r', encoding='utf-8') as f:
        existing = json.load(f)
    
    existing['countries']['Austria'] = {
        'country': 'Austria', 'qid': 'Q40', 'iso': 'AT',
        'counts': {'total': len(result), 'wikidata': len(result), 'osm': 0},
        'stations': result
    }
    existing['generatedAt'] = datetime.utcnow().isoformat() + 'Z'
    
    with open(STATIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)
    
    total = sum(len(c['stations']) for c in existing['countries'].values())
    print(f"\nAustria: {len(result)} stations")
    print(f"Total: {total}")
    print("Done!")

if __name__ == '__main__':
    main()
