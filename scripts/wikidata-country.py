"""Belgium railway stations Q55488 — Centraal kept, Station/Gare stripped."""
import json, urllib.request, urllib.parse, re
from datetime import datetime

C='Q31';CN='Belgium';ISO='BE';LANG='nl,fr,en';F='../stations.json'
Q=f"""SELECT DISTINCT ?station ?stationLabel ?coord WHERE {{
  ?station wdt:P31/wdt:P279* wd:Q55488; wdt:P17 wd:{C}; wdt:P625 ?coord.
  MINUS {{ ?station wdt:P31 wd:Q928830. }}
  MINUS {{ ?station wdt:P5817 wd:Q511399. }} MINUS {{ ?station wdt:P5817 wd:Q35771415. }}
  MINUS {{ ?station wdt:P5817 wd:Q10735358. }} MINUS {{ ?station wdt:P5817 wd:Q56557161. }}
  MINUS {{ ?station wdt:P5817 wd:Q56556915. }} MINUS {{ ?station wdt:P5817 wd:Q56286695. }}
  MINUS {{ ?station wdt:P5817 wd:Q37941669. }} MINUS {{ ?station wdt:P5817 wd:Q11639308. }}
  MINUS {{ ?station wdt:P576 []. }} MINUS {{ ?station wdt:P3999 []. }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "{LANG}". }}
}} ORDER BY ?stationLabel"""

def strip(n):
    if not n: return ''
    n=n.strip()
    # Strip known prefixes (Station, Gare, Halte, etc.)
    for p in [r'^Station\s+',r'^Gare\s+',r'^Halte\s+',r'^Bahnhof\s+',r'^Stopplaats\s+']:
        n=re.sub(p,'',n,flags=re.I)
    # After stripping "Gare " etc, strip French lowercase articles only (not Dutch "De")
    n=re.sub(r'^(de|d\'|du|des|la|l\'|le|sur|sous|à)\s+','',n)  # case-sensitive! only lowercase French
    # Strip known suffixes
    for s in [r'\s+Bahnhof$',r'\s+Bf\.?$',r'\s+Haltepunkt$',r'\s+Haltestelle$',
              r'\s+Railway\s+Station$',r'\s+Train\s+Station$',r'\s+Railway$',
              r'\s+Spoorwegstation$',r'\s+Treinstation$',r'\s+CS$',r'\s+Gare$',
              r'station$']:
        n=re.sub(s,'',n,flags=re.I)
    return n.strip()

def main():
    print(f"=== {CN} Q55488 ===\nQuerying...")
    u="https://query.wikidata.org/sparql?format=json&query="+urllib.parse.quote(Q)
    r=urllib.request.Request(u,headers={'User-Agent':'TrackAndTide/1.0'})
    with urllib.request.urlopen(r,timeout=60) as resp:
        d=json.loads(resp.read())
    b=d['results']['bindings']
    print(f"Raw: {len(b)}")
    st={};seen=set()
    for x in b:
        nm=x.get('stationLabel',{}).get('value','')
        qid=x['station']['value'].split('/')[-1]
        coord=x.get('coord',{}).get('value','')
        if not nm or not coord: continue
        m=re.match(r'Point\(([-\d.]+)\s+([-\d.]+)\)',coord)
        if not m: continue
        cl=strip(nm)
        if not cl or len(cl)<2: continue
        k=(round(float(m.group(2)),3),round(float(m.group(1)),3))
        if k in seen: continue; seen.add(k)
        st[qid]={'id':f"wikidata-{qid}",'name':cl,'lat':float(m.group(2)),'lng':float(m.group(1)),
                 'operators':[],'source':'wikidata','wikidataId':qid,'url':f"https://www.wikidata.org/wiki/{qid}"}
    res=sorted(st.values(),key=lambda s:s['name'])
    print(f"Kept: {len(res)}")
    for s in res[:15]: print(f"  {s['name']}")
    
    with open(F,'r',encoding='utf-8') as f:
        ex=json.load(f)
    ex['countries'][CN]={'country':CN,'qid':C,'iso':ISO,'counts':{'total':len(res),'wikidata':len(res),'osm':0},'stations':res}
    ex['generatedAt']=datetime.utcnow().isoformat()+'Z'
    with open(F,'w',encoding='utf-8') as f:
        json.dump(ex,f,ensure_ascii=False,indent=2)
    print(f"\n{CN}: {len(res)} | Total: {sum(len(c['stations']) for c in ex['countries'].values())}")

if __name__=='__main__': main()
