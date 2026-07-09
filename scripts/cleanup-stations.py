"""
Track & Tide — Station Data Cleanup
1. Fix double-encoded UTF-8 names (MÃ¼rzhofen → Mürzhofen)
2. Remove bus stations
3. Merge duplicate station variants (Berlin Hbf/Tief/Stadtbahn → Berlin Hbf)
4. Strip suffixes (railway station, bahnhof, etc.)
5. Use clean, local-language names
"""
import json, re, unicodedata, os, sys
from math import radians, cos, sin, asin, sqrt

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIONS_FILE = os.path.join(BASE_DIR, 'stations.json')

MERGE_THRESHOLD_KM = 0.15  # 150m - merge stations this close

def fix_double_encoding(text):
    """Fix UTF-8 bytes interpreted as Latin-1/CP1252 (multiple rounds)"""
    if not text:
        return text
    original = text
    # Try up to 3 rounds of fixing
    for _ in range(3):
        try:
            # Try CP1252 → UTF-8 first (most common double-encoding)
            fixed = text.encode('cp1252').decode('utf-8')
            if fixed != text and '\ufffd' not in fixed:
                text = fixed
                continue
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
        try:
            # Try Latin-1 → UTF-8
            fixed = text.encode('latin-1').decode('utf-8')
            if fixed != text and '\ufffd' not in fixed:
                text = fixed
                continue
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
        break
    
    # Final fallback: if the text contains common mojibake patterns, try harder
    if re.search(r'[Ã¢â¬¦â€œâ„¢Å“Å¡Å½]', text):
        try:
            # Sometimes the data is UTF-8 bytes stored as raw Latin-1 chars
            # Try encoding to bytes via latin-1 and decoding as utf-8 in a loop
            for _ in range(5):
                try:
                    as_bytes = text.encode('latin-1')
                    decoded = as_bytes.decode('utf-8')
                    if decoded != text:
                        text = decoded
                    else:
                        break
                except:
                    break
        except:
            pass
    
    return text if text != original else original

def haversine_km(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = radians(lat2 - lat1); dlng = radians(lng2 - lng1)
    a = sin(dlat/2)**2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlng/2)**2
    return R * 2 * asin(sqrt(a))

def clean_name(name):
    """Remove suffixes like 'railway station', 'bahnhof', 'gare', etc."""
    name = str(name or '')
    name = re.sub(r'\s+', ' ', name).strip()
    
    # Remove common prefixes
    name = re.sub(r'^Bahnhof\s+', '', name, flags=re.IGNORECASE)
    name = re.sub(r"^(Gare de|Gare du|Gare d'|Stazione di|Stazione|Estación de|Estación|Estação de|Estação|Dworzec)\s+", '', name, flags=re.IGNORECASE)
    name = re.sub(r'^(Haltestelle|Haltepunkt)\s+', '', name, flags=re.IGNORECASE)
    
    # Remove common suffixes with word boundary
    suffixes = [
        r'railway station', r'train station', r'central station', r'bus station',
        r'metro station', r'underground station', r'S-Bahn station', r'U-Bahn station',
        r'airport', r'aeroport', r'aéroport', r'flughafen',
        r'hauptbahnhof', r'hbf', r'bahnhof', r'station',
        r'gare', r'stazione', r'estación', r'estação', r'estacion',
        r'vasútállomás', r'pályaudvar', r'állomás',
        r'vasutallomas', r'palyaudvar', r'allomas',
        r'stacja kolejowa', r'dworzec kolejowy', r'železniční stanice',
        r'railway halt', r'stop', r'haltestelle', r'haltepunkt',
        r'fermata', r'stazione ferroviaria',
        r'station code',  # Wikidata sometimes adds "(station code: ...)"
    ]
    for s in suffixes:
        name = re.sub(rf'\s+{s}\s*$', '', name, flags=re.IGNORECASE)
        # Also remove parenthesized station codes like "Berlin Hbf (station code: ...)"
        name = re.sub(rf'\s*\(.*?(?:station code|bahnhofscode).*?\)', '', name, flags=re.IGNORECASE)
    
    # Remove parenthetical Wikidata station codes
    name = re.sub(r'\s*\(station code:?\s*\w+\)', '', name, flags=re.IGNORECASE)
    
    return name.strip()

def simplify_name(name):
    """Further simplify for grouping: lowercase, remove special chars"""
    n = name.lower()
    n = unicodedata.normalize('NFD', n)
    n = ''.join(c for c in n if not unicodedata.combining(c))
    n = re.sub(r'[^a-z0-9]', '', n)
    return n

def is_bus_station(station):
    """Check if station is actually a bus station"""
    name = station.get('name', '').lower()
    # Check name
    bus_indicators = ['bus stop', 'bus station', 'busbahnhof', 'bus terminal', 
                      'central bus', 'bus depot', 'busterminal', 'bus garage']
    for ind in bus_indicators:
        if ind in name:
            return True
    # Check if it has only bus-related operators
    return False

def make_id(name, iso):
    clean = clean_name(name).lower()
    clean = unicodedata.normalize('NFD', clean)
    clean = ''.join(c for c in clean if not unicodedata.combining(c))
    clean = re.sub(r'[^a-z0-9]+', '-', clean).strip('-')
    return f"{clean}-{iso.lower()}"

def main():
    print("Loading stations.json...")
    with open(STATIONS_FILE, 'r', encoding='utf-8-sig') as f:
        data = json.load(f)
    
    countries = data.get('countries', {})
    print(f"Loaded {len(countries)} countries")
    
    total_fixed = 0
    total_removed_bus = 0
    total_merged = 0
    total_cleaned = 0
    total_before = 0
    
    for country_name, country_data in countries.items():
        stations = country_data.get('stations', [])
        if not stations:
            continue
        
        iso = country_data.get('iso', 'xx').lower()
        orig_count = len(stations)
        total_before += orig_count
        
        # Phase 1: Fix names and filter bus stations
        cleaned = []
        for s in stations:
            old_name = s.get('name', '')
            # Fix double encoding
            new_name = fix_double_encoding(old_name)
            if new_name != old_name:
                total_fixed += 1
            
            # Clean suffixes
            cleaned_name = clean_name(new_name)
            if cleaned_name != new_name:
                total_cleaned += 1
            
            # Skip bus stations
            if is_bus_station(s):
                total_removed_bus += 1
                continue
            
            s['name'] = cleaned_name
            s['_rawName'] = old_name if old_name != cleaned_name else None
            cleaned.append(s)
        
        # Phase 2: Merge duplicate station variants (e.g., Berlin Hbf/Tief)
        merged = []
        for s in cleaned:
            found = False
            for existing in merged:
                dist = haversine_km(s['lat'], s['lng'], existing['lat'], existing['lng'])
                if dist < MERGE_THRESHOLD_KM:
                    # Same location - merge
                    # Prefer the shorter name (less specific = more canonical)
                    if len(s['name']) < len(existing['name']):
                        # Swap: keep shorter name but merge operators
                        if s.get('operators'):
                            for op in s['operators']:
                                if op not in existing.get('operators', []):
                                    existing.setdefault('operators', []).append(op)
                        existing['name'] = s['name']
                        existing['_mergedFrom'] = existing.get('_mergedFrom', []) + [existing.get('_oldName', existing['name'])]
                    elif len(s['name']) > len(existing['name']):
                        if existing.get('operators'):
                            for op in existing['operators']:
                                if op not in s.get('operators', []):
                                    s.setdefault('operators', []).append(op)
                    elif s.get('operators'):
                        for op in s['operators']:
                            if op not in existing.get('operators', []):
                                existing.setdefault('operators', []).append(op)
                    
                    # Mark as merged
                    existing['_mergedFrom'] = existing.get('_mergedFrom', []) + [s['name']]
                    total_merged += 1
                    found = True
                    break
            if not found:
                merged.append(s)
        
        # Phase 3: Regenerate IDs
        for s in merged:
            old_id = s.get('id', '')
            new_id = make_id(s['name'], iso)
            if new_id != old_id:
                s['_oldId'] = old_id
                s['id'] = new_id
        
        # Sort alphabetically
        merged.sort(key=lambda x: x['name'])
        
        # Update country
        country_data['stations'] = merged
        country_data['counts'] = country_data.get('counts', {})
        country_data['counts']['total'] = len(merged)
    
    # Update timestamp
    from datetime import datetime
    data['generatedAt'] = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.000Z')
    
    # Write
    print(f"\nWriting cleaned stations.json...")
    with open(STATIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)
    
    # Summary
    new_total = sum(len(c.get('stations', [])) for c in countries.values())
    
    print(f"\n{'═'*50}")
    print(f"CLEANUP COMPLETE")
    print(f"{'═'*50}")
    print(f"Total stations before: {total_before}")
    print(f"Names fixed (encoding): {total_fixed}")
    print(f"Names cleaned (suffix):  {total_cleaned}")
    print(f"Bus stations removed:   {total_removed_bus}")
    print(f"Stations merged (dupe): {total_merged}")
    print(f"Total stations after:   {new_total}")
    print(f"{'═'*50}")

if __name__ == '__main__':
    main()
