#!/usr/bin/env python3
"""
Fix ferry data:
1. Add missing ports to ferry_ports.json
2. Fix port routeIds for ports missing route references
3. Mark suspended routes in ferries.json
4. Fix port country data
"""
import json
import os

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def load(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

# --- Missing ports to add ---
NEW_PORTS = [
    {
        "id": "fp175",
        "name": "Almería",
        "lat": 36.83,
        "lng": -2.47,
        "country": "Spain",
        "countries": ["Spain"],
        "routeIds": ["fr168", "fr169"]
    },
    {
        "id": "fp176",
        "name": "Nador",
        "lat": 35.17,
        "lng": -2.93,
        "country": "Morocco",
        "countries": ["Morocco"],
        "routeIds": ["fr168"]
    },
    {
        "id": "fp177",
        "name": "Corfu",
        "lat": 39.62,
        "lng": 19.92,
        "country": "Greece",
        "countries": ["Greece"],
        "routeIds": ["fr134", "fr164", "fr165"]
    },
    {
        "id": "fp178",
        "name": "Mull",
        "lat": 56.47,
        "lng": -5.70,
        "country": "United Kingdom",
        "countries": ["United Kingdom"],
        "routeIds": ["fr25"]
    },
    {
        "id": "fp179",
        "name": "Coll",
        "lat": 56.63,
        "lng": -6.56,
        "country": "United Kingdom",
        "countries": ["United Kingdom"],
        "routeIds": ["fr25"]
    },
    {
        "id": "fp180",
        "name": "Stari Grad",
        "lat": 43.18,
        "lng": 16.60,
        "country": "Croatia",
        "countries": ["Croatia"],
        "routeIds": ["fr166"]
    }
]

# --- Fixes for existing ports ---
# Port ID -> route IDs to add
PORT_ROUTE_FIXES = {
    "fp145": ["fr128"],   # Świnoujście already refs fr128? let's check
    "fp171": ["fr111"],   # Gothenburg = Göteborg
    "fp174": ["fr44", "fr75"],  # Tanger Med
}

# --- Suspended routes ---
SUSPENDED_ROUTES = {
    "fr172": "Zeebrugge - Hull route suspended; P&O Ferries now operates Rotterdam - Hull instead"
}


def main():
    # 1. Add missing ports
    ports_path = os.path.join(PROJECT, 'ferry_ports.json')
    ports_data = load(ports_path)
    
    existing_ids = {p['id'] for p in ports_data['ports']}
    print(f"Existing ports: {len(ports_data['ports'])}")
    
    added = 0
    for new_port in NEW_PORTS:
        if new_port['id'] not in existing_ids:
            ports_data['ports'].append(new_port)
            added += 1
            print(f"  Added: {new_port['id']} {new_port['name']}")
    
    # 2. Fix port routeIds
    fixed_ports = 0
    for p in ports_data['ports']:
        pid = p['id']
        if pid in PORT_ROUTE_FIXES:
            for rid in PORT_ROUTE_FIXES[pid]:
                if rid not in p.get('routeIds', []):
                    p.setdefault('routeIds', []).append(rid)
                    fixed_ports += 1
                    print(f"  Fixed: {pid} {p['name']} += {rid}")
    
    # Also fix Tanger Med (fp174) - it already exists but with empty routeIds
    # and Tangier (fp173) - keep as is since no routes use "Tangier" specifically
    
    # Fix Gothenburg/Göteborg route reference
    # fr111 is "Frederikshavn - Göteborg" - port fp171 is "Gothenburg"
    
    # 3. Also need to check if Świnoujście already has fr128
    for p in ports_data['ports']:
        if p['id'] == 'fp145':
            if 'fr128' not in p.get('routeIds', []):
                p.setdefault('routeIds', []).append('fr128')
                print(f"  Fixed: fp145 Świnoujście += fr128")
    
    # Also check Zeebrugge (fp170) country
    for p in ports_data['ports']:
        if p['id'] == 'fp170':
            p['country'] = 'Belgium'
            p['countries'] = ['Belgium']
            print(f"  Fixed: fp170 Zeebrugge country -> Belgium")
        if p['id'] == 'fp171':
            p['country'] = 'Sweden'
            p['countries'] = ['Sweden']
            print(f"  Fixed: fp171 Gothenburg country -> Sweden")
        if p['id'] == 'fp173':
            p['country'] = 'Morocco'
            p['countries'] = ['Morocco']
            print(f"  Fixed: fp173 Tangier country -> Morocco")
        if p['id'] == 'fp174':
            p['country'] = 'Morocco'
            p['countries'] = ['Morocco']
            print(f"  Fixed: fp174 Tanger Med country -> Morocco")
    
    save(ports_path, ports_data)
    print(f"\nPorts updated: {added} added, {fixed_ports} routeIds fixed")
    
    # 4. Mark suspended routes
    ferries_path = os.path.join(PROJECT, 'ferries.json')
    ferries_data = load(ferries_path)
    
    for r in ferries_data['routes']:
        rid = r['id']
        if rid in SUSPENDED_ROUTES:
            r['suspended'] = True
            r['suspendedNote'] = SUSPENDED_ROUTES[rid]
            print(f"  Suspended: {rid} {r['name']}")
    
    save(ferries_path, ferries_data)
    print(f"\nRoutes updated with suspension flags")


if __name__ == '__main__':
    main()
