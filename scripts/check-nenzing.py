import json
d = json.load(open('../stations.json', encoding='utf-8'))
d2 = json.load(open('../stations.json.bak', encoding='utf-8'))

# Check Nenzing
at = d['countries']['Austria']['stations']
nenzing_new = [s for s in at if 'nenzing' in s['name'].lower()]
print('Nenzing in NEW:', nenzing_new)

at2 = d2['countries']['Austria']['stations']
nenzing_old = [s for s in at2 if 'nenzing' in s['name'].lower()]
print('Nenzing in BACKUP:', nenzing_old)

# Count Austria
print(f'\nAustria: {len(at)} stations (was {len(at2)})')

# Check what GTFS feed says about Nenzing
import zipfile, io, csv, os
gtfs_path = os.path.join(os.path.dirname(__file__), '..', 'gtfs feeds', 'at_Railway-Current-Reference-Data-2026.gtfs.zip')
z = zipfile.ZipFile(gtfs_path)
with z.open('stops.txt') as sf:
    reader = csv.DictReader(io.TextIOWrapper(sf, 'utf-8'))
    matches = []
    for row in reader:
        name = row.get('stop_name', '')
        if 'nenzing' in name.lower():
            matches.append({'name': name, 'lat': row.get('stop_lat'), 'lon': row.get('stop_lon'), 'loc_type': row.get('location_type', '')})
    print(f'\nGTFS Nenzing stops: {matches}')
z.close()
