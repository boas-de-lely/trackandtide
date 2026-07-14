#!/usr/bin/env python3
"""
Tag stations with their city for grouping in search results.
Generates station-cities.json — a mapping of station ID → city name.

Strategy:
1. Parse station name to extract the city
2. Only tag cities with 2+ stations
3. For cities with 2+ stations, also note the "main" station (shortest name, likely the central one)
"""

import json
import re
import sys
from collections import defaultdict

STATION_SUFFIXES = [
    r'\b(Hauptbahnhof|Hbf|Central|Centraal|Centrale|Termini|Terminus|Centralstation|'
    r'Sentrum|Stasjon|Station|Gare|Bahnhof|Estaci[oó]n|Estacao|Esta[cç][aã]o|'
    r'Stazione|Halt|Haltepunkt|Railway\s+Station|Train\s+Station|Railway|'
    r'Treinstation|Spoorwegstation|Jernbanestation|Bergstation|Talstation|'
    r'Turiststation|Flughafen|Airport|Aéroport|Aeroport|Aeropuerto|Luchthaven)\b',
    r'[駅站火车站]$',
]

# Words that are NOT city names — skip these when they appear alone
NOT_CITY_NAMES = {
    # Articles / short words that appear as prefixes
    'de', 'la', 'le', 'les', 'du', 'des', 'el', 'il', 'lo', 'los', 'las',
    'os', 'as', 'na', 'no', 'al', 'da', 'di', 'van', 'der', 'den',
    'het', 'een', 'l', 'd', 'the', 'a', 'un', 'une',
    # Common non-city words
    'halte', 'halt', 'gare', 'bahnhof', 'station', 'stops', 'stop',
    'west', 'ost', 'nord', 'sud', 'est', 'north', 'south', 'east',
    'centrum', 'centre', 'centro', 'center', 'centrale', 'central',
    'port', 'porto', 'airport', 'aeroport', 'flughafen',
    'bahnhofstrasse', 'bahnhofplatz', 'bahnhofsplatz',
    'hauptbahnhof', 'hbf', 'piazza', 'piazzale', 'platz',
    'strasse', 'straat', 'street', 'road', 'allee', 'avenue',
    'park', 'platz', 'square', 'markt', 'market',
    'schloss', 'burg', 'castle', 'chateau', 'château',
    'dorf', 'stadt', 'town', 'city', 'ville', 'cité',
    'gara', 'ponte', 'pont', 'pon', 'porta', 'of', 'and', 'und',
    'zjeleznička', 'železnička', 'zeleznicna', 'stanica', 'stazione',
    'borgo', 'rijeka', 'most', 'dol', 'górny', 'gorny', 'dolny', 'dólny',
    # Numbers
    'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x',
}

# Words part of compound city names
CITY_CONNECTORS = {'am', 'an', 'im', 'in', 'de', 'da', 'di', 'del', 'della', 'delle',
                   'sur', 'en', 'ob', 'van', 'der', 'den', 'upon', 'au', 'aux',
                   'nad', 'pod', 'pri', 'vor', 'bei', 'zu', 'zum', 'zur'}

# City name prefixes — these indicate the start of a proper city name
CITY_PREFIXES = {'Bad', 'St', 'St.', 'San', 'Santa', 'Sankt', 'Sint', 'Saint',
                 'Sainte', 'São', 'Mont', 'Mount', 'Groß', 'Gross', 'Klein',
                 'Neu', 'Alt', 'Ober', 'Unter', 'Nieder', 'Hohen', 'Schloss',
                 'Horní', 'Dolní', 'Nová', 'Nové', 'Nový', 'Staré', 'Starý',
                 'Velké', 'Velký', 'Velká', 'Malé', 'Malý', 'Valea',
                 'Monte', 'Castel', 'Castello', 'Vila', 'Villa', 'Campo',
                 'Corte', 'Alto', 'Basso', 'New', 'Old', 'Great',
                 'Vila', 'Aldeia', 'Quinta', 'Barrio', 'Urbanización',
                 'Sant', 'Nowy', 'Nowa', 'Nowe', 'Stary', 'Stara', 'Stare'}


def clean_for_city(name):
    """Clean station name to extract city."""
    n = name.strip()
    # Remove parentheticals first
    n = re.sub(r'\([^)]*\)', ' ', n)
    n = re.sub(r'\[[^\]]*\]', ' ', n)

    # Handle "Gare de X" / "Gare du X" → "X"
    n = re.sub(r'^Gare\s+(de|du|des|d)\s+', '', n, flags=re.IGNORECASE)
    n = re.sub(r'^Bahnhof\s+', '', n, flags=re.IGNORECASE)
    n = re.sub(r'^Stazione\s+(di|de|del|della|delle)\s+', '', n, flags=re.IGNORECASE)
    n = re.sub(r'^Estaci[oó]n\s+(de|del)\s+', '', n, flags=re.IGNORECASE)
    n = re.sub(r'^Esta[cç][aã]o\s+(de|do|da|das)\s+', '', n, flags=re.IGNORECASE)

    # Remove station suffixes
    for suffix in STATION_SUFFIXES:
        n = re.sub(suffix, ' ', n, flags=re.IGNORECASE)

    # Normalize whitespace
    n = re.sub(r'\s+', ' ', n).strip()

    # Only split on comma and slash — NOT on hyphen/dash (preserves "Saint-Lô", "Köln-Mülheim")
    parts = re.split(r'[,/]', n)
    n = parts[0].strip()

    if not n:
        return name.strip()

    # Tokenize
    words = n.split()
    if not words:
        return name.strip()

    # Filter leading words that are NOT city names
    # e.g. "De Hoek" — "De" is not a city, skip to "Hoek"
    # But "De Bilt" → "De Bilt" (known compound)
    start_idx = 0
    while start_idx < len(words) and words[start_idx].lower() in NOT_CITY_NAMES:
        start_idx += 1

    if start_idx >= len(words):
        # All words were stopwords — use original
        return name.strip()

    words = words[start_idx:]

    # Build city name
    city_words = [words[0]]
    
    # If first word is a prefix (Bad, San, Saint, St., New, Groß, etc.),
    # always include the next word as part of the city name
    if words[0] in CITY_PREFIXES and len(words) >= 2:
        city_words.append(words[1])
        i = 2
    else:
        i = 1
    
    while i < len(words):
        wl = words[i].lower()
        if wl in CITY_CONNECTORS:
            city_words.append(words[i])
            i += 1
            if i < len(words):
                city_words.append(words[i])
                i += 1
        elif words[i] in CITY_PREFIXES and i + 1 < len(words):
            city_words.append(words[i])
            city_words.append(words[i + 1])
            i += 2
        else:
            break

    city = ' '.join(city_words).strip()

    # Final check: if result is still in NOT_CITY_NAMES, return original
    if city.lower() in NOT_CITY_NAMES:
        return name.strip()

    return city


def normalize_city(city):
    """Normalize city name for grouping key."""
    return city.lower().strip()

    if not n:
        return name.strip()
    
    # Tokenize
    words = n.split()
    if not words:
        return name.strip()
    
    # Build city name: start with first word, include connector words + next word
    city_words = [words[0]]
    i = 1
    while i < len(words):
        if words[i].lower() in CITY_CONNECTORS:
            city_words.append(words[i])
            i += 1
            if i < len(words):
                city_words.append(words[i])
                i += 1
        elif words[i] in CITY_PREFIXES and i + 1 < len(words):
            # e.g. "Bad Homburg" — prefix is part of city
            city_words.append(words[i])
            city_words.append(words[i + 1])
            i += 2
        else:
            break
    
    city = ' '.join(city_words)
    return city.strip()


def normalize_city(city):
    """Normalize city name for grouping key."""
    return city.lower().strip()


def main():
    if len(sys.argv) < 2:
        print("Usage: python tag-station-cities.py <stations.json>")
        sys.exit(1)
    
    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Step 1: Extract city for every station
    station_cities = {}  # station_id → (city_name, city_key)
    city_stations = defaultdict(list)  # city_key → [station_ids]
    
    for country_name, country_data in data.get('countries', {}).items():
        for station in country_data.get('stations', []):
            sid = station.get('id', '')
            sname = station.get('name', '')
            if not sid or not sname:
                continue
            
            city = clean_for_city(sname)
            city_key = normalize_city(city)
            
            station_cities[sid] = {
                'city': city,
                'cityKey': city_key,
                'name': sname
            }
            city_stations[city_key].append({
                'id': sid,
                'name': sname,
                'city': city,
                'lat': station.get('lat'),
                'lng': station.get('lng'),
                'country': country_name
            })
    
    # Step 2: Only keep cities with 2+ stations
    multi_station_cities = {
        ck: stations for ck, stations in city_stations.items()
        if len(stations) >= 2
    }
    
    # Step 3: For each multi-station city, pick the "main" station
    # Prefer stations with "Central", "Hbf", "Centraal", "Główny" etc. in the name
    CENTRAL_KEYWORDS = [
        'hauptbahnhof', 'hbf', 'central', 'centraal', 'centrale', 'termini',
        'główny', 'glowny', 'hlavní', 'hlavni', 'fő', 'fo', 'sentrum',
        'sentral', 'terminus', 'principal', 'principale', 'pasazerski',
        'pasazerski', 'osobowy', 'glavny', 'glavni', 'glavna',
        'main station', 'main', 'city', 'centre', 'center'
    ]
    
    city_info = {}
    for ck, stations in multi_station_cities.items():
        # Score each station for "main-ness"
        def main_score(s):
            n = s['name'].lower()
            score = 0
            # Bonus for central keywords
            for kw in CENTRAL_KEYWORDS:
                if kw in n:
                    score += 10
            # Penalty for long names (short names are more likely central)
            score -= len(s['name']) * 0.1
            # Bonus for exact city name match
            if n == s['city'].lower():
                score += 5
            return score
        
        sorted_stations = sorted(stations, key=main_score, reverse=True)
        main = sorted_stations[0]
        city_info[ck] = {
            'city': main['city'],
            'mainStationId': main['id'],
            'mainStationName': main['name'],
            'lat': main['lat'],
            'lng': main['lng'],
            'country': main['country'],
            'stationCount': len(stations),
            'stationIds': [s['id'] for s in stations]
        }
    
    # Step 4: Build output — station_id → city assignment
    output = {}
    for sid, info in station_cities.items():
        ck = info['cityKey']
        if ck in city_info:
            output[sid] = {
                'city': city_info[ck]['city'],
                'cityKey': ck
            }
    
    # Step 5: Also include city index for search
    cities_index = {}
    for ck, info in city_info.items():
        cities_index[ck] = info
    
    result = {
        'description': 'Station-to-city mapping for search grouping. Only cities with 2+ stations.',
        'generatedAt': data.get('generatedAt', ''),
        'stationCities': output,
        'cities': cities_index
    }
    
    # Write output
    out_path = 'station-cities.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"Generated {out_path}")
    print(f"  Stations tagged: {len(output)}")
    print(f"  Cities with 2+ stations: {len(cities_index)}")
    
    # Print top cities by station count
    top = sorted(cities_index.items(), key=lambda x: x[1]['stationCount'], reverse=True)[:30]
    print(f"\nTop cities by station count:")
    for ck, info in top:
        print(f"  {info['city']}: {info['stationCount']} stations (main: {info['mainStationName']})")


if __name__ == '__main__':
    main()
