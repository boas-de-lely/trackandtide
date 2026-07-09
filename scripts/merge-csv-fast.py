"""Fast CSV merge using spatial grid for large countries"""
import json,csv,re,unicodedata
from math import radians,cos,sin,asin,sqrt
from collections import defaultdict

BASE = '//LELYNAS/trackandtide'
JSON = f'{BASE}/stations.json'
CSV = f'{BASE}/train_stations_europe.csv'
DEDUP_KM = 0.5

ISO = {'AL':'Albania','AT':'Austria','BE':'Belgium','BA':'Bosnia and Herzegovina','BG':'Bulgaria','HR':'Croatia','CZ':'Czechia','DK':'Denmark','EE':'Estonia','FI':'Finland','FR':'France','DE':'Germany','GR':'Greece','HU':'Hungary','IS':'Iceland','IE':'Ireland','IT':'Italy','XK':'Kosovo','LV':'Latvia','LI':'Liechtenstein','LT':'Lithuania','LU':'Luxembourg','MT':'Malta','MD':'Moldova','MC':'Monaco','ME':'Montenegro','NL':'Netherlands','MK':'North Macedonia','NO':'Norway','PL':'Poland','PT':'Portugal','RO':'Romania','SM':'San Marino','RS':'Serbia','SK':'Slovakia','SI':'Slovenia','ES':'Spain','SE':'Sweden','CH':'Switzerland','TR':'Turkey','UA':'Ukraine','GB':'United Kingdom','VA':'Vatican City','AD':'Andorra','BY':'Belarus','CY':'Cyprus'}

def haversine(lat1,lng1,lat2,lng2):
    R=6371;dlat=radians(lat2-lat1);dlng=radians(lng2-lng1)
    a=sin(dlat/2)**2+cos(radians(lat1))*cos(radians(lat2))*sin(dlng/2)**2
    return R*2*asin(sqrt(a))

def make_id(name,iso):
    c=re.sub(r'\s+',' ',str(name)).strip().lower()
    c=unicodedata.normalize('NFD',c)
    c=''.join(ch for ch in c if not unicodedata.combining(ch))
    c=re.sub(r'[^a-z0-9]+','-',c).strip('-')
    return f'{c}-{iso.lower()}'

def build_grid(stations):
    """Build 0.5° spatial grid for fast proximity lookup"""
    grid = defaultdict(list)
    for s in stations:
        if not s.get('lat') or not s.get('lng'): continue
        key = (int(s['lat']*2), int(s['lng']*2))  # 0.5 degree cells
        grid[key].append(s)
    return grid

def is_dup(lat, lng, grid):
    """Check if a point is within DEDUP_KM of any station in grid"""
    cell_lat = int(lat*2)
    cell_lng = int(lng*2)
    # Check 9 neighboring cells
    for dlat in (-1,0,1):
        for dlng in (-1,0,1):
            for s in grid.get((cell_lat+dlat, cell_lng+dlng), []):
                if haversine(lat, lng, s['lat'], s['lng']) < DEDUP_KM:
                    return True
    return False

print('Loading JSON...')
d = json.load(open(JSON, encoding='utf-8-sig'))

# Build spatial grids per country
grids = {}
for cn, cd in d['countries'].items():
    grids[cn] = build_grid(cd['stations'])

print('Reading CSV...')
with open(CSV, encoding='utf-8') as f:
    rows = list(csv.DictReader(f))
print(f'CSV: {len(rows)} rows')

added=nocoord=dupe=nocountry=0
for i,row in enumerate(rows):
    if i%10000==0: print(f'  {i}/{len(rows)}...')
    lat_s=row.get('latitude','NA'); lng_s=row.get('longitude','NA')
    if lat_s=='NA' or lng_s=='NA' or not lat_s or not lng_s: nocoord+=1; continue
    try: lat=float(lat_s); lng=float(lng_s)
    except: nocoord+=1; continue
    
    iso = row.get('country','').strip().upper()
    cn = ISO.get(iso)
    if not cn: nocountry+=1; continue
    
    if cn not in d['countries']:
        d['countries'][cn] = {'country':cn,'iso':iso.lower(),'qid':'','counts':{'total':0,'wikidata':0,'osm':0},'stations':[]}
        grids[cn] = defaultdict(list)
    
    name = row.get('name','').strip()
    if not name: continue
    
    if is_dup(lat, lng, grids[cn]):
        dupe += 1; continue
    
    sid = make_id(name, iso)
    s = {'id':sid,'url':'','wikidataId':'','source':'csv','name':name,'lat':lat,'lng':lng,'operators':[]}
    d['countries'][cn]['stations'].append(s)
    # Add to grid
    cell = (int(lat*2), int(lng*2))
    grids[cn][cell].append(s)
    added += 1

# Sort and update counts
for cn in d['countries']:
    d['countries'][cn]['stations'].sort(key=lambda x: x['name'])
    d['countries'][cn]['counts']['total'] = len(d['countries'][cn]['stations'])

d['generatedAt'] = '2026-07-01T00:00:00.000Z'
print('Writing...')
with open(JSON, 'w', encoding='utf-8') as f:
    json.dump(d, f, ensure_ascii=False)

total = sum(len(cd['stations']) for cd in d['countries'].values())
print(f'\nDone! Added:{added} Dupes:{dupe} NoCoord:{nocoord} NoCountry:{nocountry} Total:{total}')
