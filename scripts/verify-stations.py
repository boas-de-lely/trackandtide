import json
d = json.load(open('../stations.json', 'r', encoding='utf-8'))

nl = d['countries']['Netherlands']['stations']
ams = [s['name'] for s in nl if 'Amsterdam' in s['name']][:5]
print('Amsterdam stations:', ams)

de = d['countries']['Germany']['stations']
muc = [s['name'] for s in de if 'Munchen' in s['name'] or 'Munich' in s['name']][:5]
print('Munich stations:', muc)

fr = d['countries']['France']['stations']
par = [s['name'] for s in fr if 'Paris' in s['name']][:5]
print('Paris stations:', par)

total = sum(len(c['stations']) for c in d['countries'].values())
print(f'Total stations: {total}')
print(f'Countries: {len(d["countries"])}')
