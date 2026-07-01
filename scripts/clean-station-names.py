#!/usr/bin/env python3
"""Clean station names in stations.json - remove suffixes/prefixes that don't belong."""
import json, re, os

def clean_name(name):
    original = name
    name = name.strip()
    
    # Remove common suffixes
    name = re.sub(r'\s+(railway station|railway|train station|central station|bus station|metro station)$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s+(airport|aeroport|aéroport|flughafen)$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s+(hauptbahnhof|hbf|bahnhof|station|gare|stazione|estación|estacao)$', '', name, flags=re.IGNORECASE)
    
    # Remove standalone "railway" at end
    name = re.sub(r'\s+railway$', '', name, flags=re.IGNORECASE)
    
    # Remove "Bahnhof " prefix (Austrian stations)
    name = re.sub(r'^Bahnhof\s+', '', name, flags=re.IGNORECASE)
    
    # Remove "Gare de ", "Gare du ", "Gare d'" prefix
    name = re.sub(r'^(Gare de|Gare du|Gare d\')\s+', '', name, flags=re.IGNORECASE)
    
    # Remove "Stazione di " prefix
    name = re.sub(r'^(Stazione di|Stazione)\s+', '', name, flags=re.IGNORECASE)
    
    # Remove "Estación de " prefix
    name = re.sub(r'^(Estación de|Estación|Estacao de|Estacao)\s+', '', name, flags=re.IGNORECASE)
    
    # Clean up extra spaces
    name = re.sub(r'\s+', ' ', name).strip()
    
    return name if name else original

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir) if script_dir else os.getcwd()
    path = os.path.join(project_dir, 'stations.json')
    
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    countries = data.get('countries', {})
    changed = 0
    
    for country, country_data in countries.items():
        stations = country_data.get('stations', [])
        for station in stations:
            old = station.get('name', '')
            new = clean_name(old)
            if new != old:
                station['name'] = new
                changed += 1
                if changed <= 30:
                    print(f"  {old} → {new}")
    
    if changed > 30:
        print(f"  ... and {changed - 30} more")
    
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"\nCleaned {changed} station names in {path}")

if __name__ == '__main__':
    main()
