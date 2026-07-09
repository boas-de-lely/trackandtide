"""
Merge improved Wikidata station data into original stations.json
Reads the current (improved) stations.json and merges new countries into original.
"""
import json, sys, os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(SCRIPT_DIR)

def main():
    # The original is already restored via git checkout
    orig_path = os.path.join(BASE_DIR, 'stations.json')
    
    # Our improved data was saved by the download script - but it's been overwritten
    # by git checkout. The improved data per country was saved before we killed the script.
    # We need to re-download the 10 countries and merge.
    
    # For now: print what we need
    improved_countries = [
        'Albania', 'Andorra', 'Austria', 'Belarus', 'Belgium',
        'Bosnia and Herzegovina', 'Bulgaria', 'Croatia', 'Cyprus', 'Czechia'
    ]
    
    print("Loading original data...")
    with open(orig_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    countries = data.get('countries', {})
    print(f"Original: {len(countries)} countries")
    for name, cdata in sorted(countries.items()):
        cnt = cdata.get('counts', {}).get('total', len(cdata.get('stations', [])))
        improved = ' ← TO UPDATE' if name in improved_countries else ''
        print(f"  {name}: {cnt}{improved}")

if __name__ == '__main__':
    main()
