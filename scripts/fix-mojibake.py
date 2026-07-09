"""Aggressive mojibake fixer - one more pass for remaining garbled names"""
import json, re, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIONS = os.path.join(BASE, 'stations.json')

def fix_mojibake(text):
    if not text: return text
    for _ in range(10):
        orig = text
        try:
            t = text.encode('cp1252', errors='replace').decode('utf-8', errors='replace')
            if t != text and '\ufffd' not in t:
                text = t; continue
        except: pass
        try:
            t = text.encode('latin-1', errors='replace').decode('utf-8', errors='replace')
            if t != text and '\ufffd' not in t:
                text = t; continue
        except: pass
        break
    return text

with open(STATIONS, 'r', encoding='utf-8-sig') as f:
    data = json.load(f)

fixed = 0
for cn, cd in data.get('countries', {}).items():
    for s in cd.get('stations', []):
        old = s['name']
        new = fix_mojibake(old)
        if new != old:
            s['name'] = new
            fixed += 1

print(f'Fixed: {fixed}')
with open(STATIONS, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False)
print('Saved')
