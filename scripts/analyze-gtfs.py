"""Analyze GTFS feeds to understand structure and identify railway stations."""
import zipfile, io, csv, os, json, sys

GTFS_DIR = os.path.join(os.path.dirname(__file__), '..', 'gtfs feeds')

def analyze_feed(filepath):
    try:
        z = zipfile.ZipFile(filepath)
        files = z.namelist()
        info = {'file': os.path.basename(filepath), 'files': len(files)}
        
        # Check routes.txt for route types
        if 'routes.txt' in files:
            with z.open('routes.txt') as rf:
                reader = csv.DictReader(io.TextIOWrapper(rf, 'utf-8'))
                types = set()
                names = set()
                for row in reader:
                    rt = row.get('route_type', '')
                    types.add(rt)
                    if rt in ('2', '100', '101', '102', '103', '104', '105', '106', '109', '110', '111', '400', '401', '402', '403', '404', '405'):
                        names.add(row.get('route_long_name', row.get('route_short_name', '')))
                info['route_types'] = sorted(types)
                info['rail_routes'] = sorted(names)[:5] if names else []
        
        # Count stops
        if 'stops.txt' in files:
            with z.open('stops.txt') as sf:
                reader = csv.DictReader(io.TextIOWrapper(sf, 'utf-8'))
                fieldnames = reader.fieldnames
                stops = list(reader)
                info['stop_count'] = len(stops)
                info['stop_fields'] = fieldnames
                if stops:
                    info['sample_stop'] = {k: v for k, v in stops[0].items()}
        
        z.close()
        return info
    except Exception as e:
        return {'file': os.path.basename(filepath), 'error': str(e)}

# Analyze key feeds
key_feeds = [
    'de_DELFI.gtfs.zip', 'be_sncb.gtfs.zip', 'gb_great-britain.gtfs.zip',
    'ch_opentransportdataswiss26.gtfs.zip', 'fr_horaires-sncf.gtfs.zip',
    'at_Railway-Current-Reference-Data-2026.gtfs.zip', 'es_RENFE-Larga-Distancia-y-AVE.gtfs.zip',
    'it_Lombardia-Trenord.gtfs.zip', 'nl_ns.gtfs.zip', 'dk_rejseplanen.gtfs.zip',
    'cz_CZPTT.gtfs.zip', 'hr_hz.gtfs.zip', 'hu_mav.gtfs.zip',
    'fi_fintraffic.gtfs.zip', 'bg_bdz.gtfs.zip', 'ee_elron.gtfs.zip'
]

for feed_name in key_feeds:
    path = os.path.join(GTFS_DIR, feed_name)
    if os.path.exists(path):
        info = analyze_feed(path)
        print(f"\n--- {info.get('file', feed_name)} ---")
        for k, v in info.items():
            if k not in ('sample_stop',):
                print(f"  {k}: {v}")
        if 'sample_stop' in info:
            print(f"  sample stop: {json.dumps(info['sample_stop'], ensure_ascii=False)[:300]}")
    else:
        print(f"\n{feed_name}: NOT FOUND")

# Also check which countries have feeds
print("\n\n=== Feed count by country ===")
countries = {}
for f in os.listdir(GTFS_DIR):
    if f.endswith('.gtfs.zip'):
        country = f.split('_')[0] if '_' in f else 'unknown'
        countries[country] = countries.get(country, 0) + 1
for c, n in sorted(countries.items()):
    print(f"  {c}: {n} feeds")
print(f"Total: {sum(countries.values())} feeds")
