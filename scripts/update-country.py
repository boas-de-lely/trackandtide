"""
Track & Tide — Single Country Station Updater (STRICT TRAIN-ONLY)
- Only active, operational railway stations
- No metro, tram, bus, funicular, heritage, closed, disused
- Strips suffixes, fixes encoding, deduplicates
Usage: python update-country.py "Country Name"
"""
import json, sys, os, time, re, requests, unicodedata
from math import radians, cos, sin, asin, sqrt

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIONS_FILE = os.path.join(BASE_DIR, 'stations.json')

COUNTRY_MAP = {
    'Albania': ('AL', 'Q222'), 'Andorra': ('AD', 'Q228'), 'Austria': ('AT', 'Q40'),
    'Belarus': ('BY', 'Q184'), 'Belgium': ('BE', 'Q31'),
    'Bosnia and Herzegovina': ('BA', 'Q225'), 'Bulgaria': ('BG', 'Q219'),
    'Croatia': ('HR', 'Q224'), 'Cyprus': ('CY', 'Q229'), 'Czechia': ('CZ', 'Q213'),
    'Denmark': ('DK', 'Q35'), 'Estonia': ('EE', 'Q191'), 'Finland': ('FI', 'Q33'),
    'France': ('FR', 'Q142'), 'Germany': ('DE', 'Q183'), 'Greece': ('GR', 'Q41'),
    'Hungary': ('HU', 'Q28'), 'Iceland': ('IS', 'Q189'), 'Ireland': ('IE', 'Q27'),
    'Italy': ('IT', 'Q38'), 'Kosovo': ('XK', 'Q1246'), 'Latvia': ('LV', 'Q211'),
    'Liechtenstein': ('LI', 'Q347'), 'Lithuania': ('LT', 'Q37'), 'Luxembourg': ('LU', 'Q32'),
    'Malta': ('MT', 'Q233'), 'Moldova': ('MD', 'Q217'), 'Monaco': ('MC', 'Q235'),
    'Montenegro': ('ME', 'Q236'), 'Netherlands': ('NL', 'Q55'),
    'North Macedonia': ('MK', 'Q221'), 'Norway': ('NO', 'Q20'), 'Poland': ('PL', 'Q36'),
    'Portugal': ('PT', 'Q45'), 'Romania': ('RO', 'Q218'), 'San Marino': ('SM', 'Q238'),
    'Serbia': ('RS', 'Q403'), 'Slovakia': ('SK', 'Q214'), 'Slovenia': ('SI', 'Q215'),
    'Spain': ('ES', 'Q29'), 'Sweden': ('SE', 'Q34'), 'Switzerland': ('CH', 'Q39'),
    'Turkey': ('TR', 'Q43'), 'Ukraine': ('UA', 'Q212'),
    'United Kingdom': ('GB', 'Q145'), 'Vatican City': ('VA', 'Q237'),
}

DEDUP_KM = 0.5
MERGE_KM = 0.15
TIMEOUT = 90

def haversine(lat1, lng1, lat2, lng2):
    R = 6371; dlat = radians(lat2-lat1); dlng = radians(lng2-lng1)
    a = sin(dlat/2)**2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlng/2)**2
    return R * 2 * asin(sqrt(a))

def fix_encoding(text):
    if not text: return text
    for _ in range(5):
        orig = text
        try:
            t = text.encode('cp1252', errors='replace').decode('utf-8', errors='replace')
            if t != text and '\ufffd' not in t: text = t; continue
        except: pass
        try:
            t = text.encode('latin-1', errors='replace').decode('utf-8', errors='replace')
            if t != text and '\ufffd' not in t: text = t; continue
        except: pass
        break
    return text

def is_bad(name):
    n = name.lower()
    bad = [
        r'\bclosed\b',r'\bdisused\b',r'\babandoned\b',r'\bdismantled\b',
        r'\bdecommissioned\b',r'\bdefunct\b',r'\bmothballed\b',r'\baufgelassen\b',
        r'\(closed\)',r'\(disused\)',r'\(abandoned\)',
        r'\bmetro\b(?!politan)',r'\bunderground\b',r'\bsubway\b',
        r'\btram\b(?!p|way)',r'\btramway\b',r'\btram stop\b',
        r'\bbus station\b',r'\bbus stop\b',r'\bbusbahnhof\b',
        r'\bfunicular\b',r'\bcable car\b',r'\bgondola\b',r'\bchairlift\b',
        r'\bcableway\b',r'\baerial lift\b',
        r'\bferry\b(?!bridge|hill|meadow|road|lane|street|way|bank|side|view|park|green|field|vale|mount|court|close|drive|avenue|place|terrace|gardens|estate|manor|wood|lea|grove|heath)',
        r'\bharbour station\b',r'\bferry terminal\b',
        r'\bmuseum railway\b',r'\bheritage railway\b',r'\btourist railway\b',
        r'\bminiature\b',r'\bmodel railway\b',r'\bmonorail\b',r'\bmaglev\b',
        # ── Freight / depot / non-passenger ──
        r'\bgüterbahnhof\b',r'\bgueterbahnhof\b',r'\bfreight yard\b',
        r'\brangierbahnhof\b',r'\bmarshalling yard\b',
        r'\bfreight depot\b',r'\bgoods station\b',r'\bgoods yard\b',
        r'\bbetriebsbahnhof\b',r'\bbetriebswerk\b',r'\bwerkstatt\b',
        r'\babstellbahnhof\b',r'\babstellgruppe\b',r'\bwagenwerkstatt\b',
        r'\bdepot\b(?!\s+station)', r'\bausbesserungswerk\b',
        r'\blokschuppen\b',r'\bcontainer terminal\b',r'\bumschlagbahnhof\b',
    ]
    for p in bad:
        if re.search(p, n): return True
    if re.search(r'\bu-bahn\b|\bu bahn\b', n) and not re.search(r'\bs-bahn\b|\bs bahn\b', n):
        return True
    return False

def clean(name):
    name = fix_encoding(str(name or ''))
    name = re.sub(r'\s+', ' ', name).strip()
    name = re.sub(r'^Bahnhof\s+', '', name, flags=re.I)
    name = re.sub(r"^(Gare de|Gare du|Gare d'|Stazione di|Stazione|Estación de|Estación|Estação de|Estação|Dworzec|Haltestelle|Haltepunkt)\s+", '', name, flags=re.I)
    suffixes = [
        r'railway station',r'train station',r'central station',r'passenger station',
        r'hauptbahnhof',r'hbf',r'bahnhof',r'station',r'gare',r'stazione',
        r'estación',r'estação',r'estacion',r'vasútállomás',r'pályaudvar',r'állomás',
        r'stacja kolejowa',r'dworzec kolejowy',r'railway halt',r'halt',r'stop',
        r'haltestelle',r'haltepunkt',r'fermata',r'stazione ferroviaria',
        r'personenbahnhof',r'güterbahnhof',r'bahnhofsteil',
    ]
    for s in suffixes:
        name = re.sub(rf'\s+{s}\s*$', '', name, flags=re.I)
    name = re.sub(r'\s*\(.*?(?:station code|bahnhofscode).*?\)', '', name, flags=re.I)
    return name.strip()

def make_id(name, iso):
    c = clean(name).lower()
    c = unicodedata.normalize('NFD', c)
    c = ''.join(ch for ch in c if not unicodedata.combining(ch))
    c = re.sub(r'[^a-z0-9]+', '-', c).strip('-')
    return f"{c}-{iso.lower()}"

def fetch(country_name, qid):
    # Fast query — NO MINUS (causes timeouts). All filtering in Python.
    q = """
SELECT DISTINCT ?station ?stationLabel ?wdId ?lat ?lon WHERE {{
  ?station wdt:P17 wd:{0}.
  ?station wdt:P31 ?type.
  VALUES ?type {{ wd:Q55488 wd:Q55489 wd:Q12046342 wd:Q548662 }}
  ?station wdt:P625 ?coord.
  BIND(geof:latitude(?coord) AS ?lat)
  BIND(geof:longitude(?coord) AS ?lon)
  BIND(STRAFTER(STR(?station), "http://www.wikidata.org/entity/") AS ?wdId)
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,de,fr,it,es,nl,pl,cs,sv,da,fi,el,hu,ro,bg,sk,sl,hr,sr,lt,lv,et,uk,no". }}
}}
LIMIT 30000
""".format(qid)
    try:
        r = requests.get('https://query.wikidata.org/sparql',
                        params={'format':'json','query':q},
                        headers={'User-Agent':'TrackAndTide/1.0'}, timeout=TIMEOUT)
        r.raise_for_status()
        try: d = r.json()
        except json.JSONDecodeError: d = json.loads(r.text, strict=False)
        out = []
        for b in d.get('results',{}).get('bindings',[]):
            try:
                lat=float(b['lat']['value']); lng=float(b['lon']['value'])
                wdid=b.get('wdId',{}).get('value','')
                nm=b.get('stationLabel',{}).get('value','')
                if not nm: nm=b.get('station',{}).get('value','').split('/')[-1].replace('_',' ')
                if lat and lng and nm:
                    out.append({'name':nm,'lat':lat,'lng':lng,'wikidataId':wdid,'source':'wikidata',
                               'url':f"https://www.wikidata.org/wiki/{wdid}" if wdid else ''})
            except: pass
        return out
        return out
    except Exception as e:
        print(f"  ERR:{e}"); return None

def dedup(stations):
    out = []
    for s in stations:
        dup = False
        for e in out:
            if haversine(s['lat'],s['lng'],e['lat'],e['lng'])<DEDUP_KM:
                dup=True
                if s.get('operators') and not e.get('operators'): e['operators']=s['operators']
                if s['source']=='wikidata' and e['source']=='osm':
                    e['wikidataId']=s.get('wikidataId',''); e['url']=s.get('url',''); e['source']='wikidata'
                break
        if not dup: out.append(s)
    out.sort(key=lambda x:x['name'])
    return out

def main():
    if len(sys.argv)<2: print("Usage: python update-country.py 'Country'"); sys.exit(1)
    cn=sys.argv[1]
    if cn not in COUNTRY_MAP: print(f"Unknown: {cn}"); sys.exit(1)
    iso,qid=COUNTRY_MAP[cn]
    print(f"{cn} ({iso})",end=' ')
    
    with open(STATIONS_FILE,'r',encoding='utf-8-sig') as f: data=json.load(f)
    wd=fetch(cn,qid)
    if wd is None: print("FAILED"); return
    
    removed=0
    stations=[]
    for s in wd:
        s['name']=clean(s['name'])
        if is_bad(s['name']): removed+=1; continue
        stations.append({'id':make_id(s['name'],iso),'url':s['url'],'wikidataId':s['wikidataId'],
                        'source':s['source'],'name':s['name'],'lat':s['lat'],'lng':s['lng'],'operators':[]})
    wd_count=len(stations)
    stations=dedup(stations)
    
    existing=data.get('countries',{}).get(cn,{}).get('stations',[])
    osm_added=0; ops=0; wd_only_removed=0
    for old in existing:
        if not old.get('lat') or not old.get('lng'): continue
        if is_bad(old.get('name','')): continue
        dup=False
        for ns in stations:
            if haversine(old['lat'],old['lng'],ns['lat'],ns['lng'])<DEDUP_KM:
                dup=True
                if old.get('operators') and not ns.get('operators'):
                    ns['operators']=old['operators']; ops+=1
                if old.get('limited_use'): ns['limited_use']=True
                break
        if not dup:
            if old.get('source')=='osm' or (old.get('operators') and len(old.get('operators',[]))>0):
                stations.append(old)
                if old.get('source')=='osm': osm_added+=1
    
    stations=dedup(stations)
    merged=0
    result=[]
    for s in stations:
        found=False
        for e in result:
            if haversine(s['lat'],s['lng'],e['lat'],e['lng'])<MERGE_KM:
                if len(s['name'])<len(e['name']):
                    if s.get('operators'):
                        for op in s['operators']:
                            if op not in e.get('operators',[]): e.setdefault('operators',[]).append(op)
                    e['name']=s['name']
                merged+=1; found=True; break
        if not found: result.append(s)
    result.sort(key=lambda x:x['name'])
    
    data['countries'][cn]={
        'country':cn,'qid':qid,'iso':iso,
        'counts':{'total':len(result),'wikidata':wd_count,'osm':osm_added},
        'stations':result,
    }
    data['generatedAt']=time.strftime('%Y-%m-%dT%H:%M:%S.000Z',time.gmtime())
    with open(STATIONS_FILE,'w',encoding='utf-8') as f: json.dump(data,f,ensure_ascii=False)
    print(f"-> {len(result)} (WD:{wd_count} osm+:{osm_added} bad:{removed} merge:{merged} ops:{ops})")

if __name__=='__main__': main()
