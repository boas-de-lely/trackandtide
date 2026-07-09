// =============================================================================
// Track & Tide — Comprehensive Station Downloader (Wikidata + existing OSM merge)
// Queries Wikidata for ALL train stations in all European countries.
// Preserves existing OSM-sourced stations from current data.
// Deduplicates by proximity & name.
// =============================================================================

import { readFileSync, writeFileSync } from 'fs';

const EXISTING_FILE = '../stations.json';
const OUTPUT_FILE = '../stations.json';

// ── European Countries ───────────────────────────────────────────────────────
const EUROPEAN_COUNTRIES = [
  { name:'Albania', iso:'AL', qid:'Q222' },
  { name:'Andorra', iso:'AD', qid:'Q228' },
  { name:'Austria', iso:'AT', qid:'Q40' },
  { name:'Belarus', iso:'BY', qid:'Q184' },
  { name:'Belgium', iso:'BE', qid:'Q31' },
  { name:'Bosnia and Herzegovina', iso:'BA', qid:'Q225' },
  { name:'Bulgaria', iso:'BG', qid:'Q219' },
  { name:'Croatia', iso:'HR', qid:'Q224' },
  { name:'Cyprus', iso:'CY', qid:'Q229' },
  { name:'Czechia', iso:'CZ', qid:'Q213' },
  { name:'Denmark', iso:'DK', qid:'Q35' },
  { name:'Estonia', iso:'EE', qid:'Q191' },
  { name:'Finland', iso:'FI', qid:'Q33' },
  { name:'France', iso:'FR', qid:'Q142' },
  { name:'Germany', iso:'DE', qid:'Q183' },
  { name:'Greece', iso:'GR', qid:'Q41' },
  { name:'Hungary', iso:'HU', qid:'Q28' },
  { name:'Iceland', iso:'IS', qid:'Q189' },
  { name:'Ireland', iso:'IE', qid:'Q27' },
  { name:'Italy', iso:'IT', qid:'Q38' },
  { name:'Kosovo', iso:'XK', qid:'Q1246' },
  { name:'Latvia', iso:'LV', qid:'Q211' },
  { name:'Liechtenstein', iso:'LI', qid:'Q347' },
  { name:'Lithuania', iso:'LT', qid:'Q37' },
  { name:'Luxembourg', iso:'LU', qid:'Q32' },
  { name:'Malta', iso:'MT', qid:'Q233' },
  { name:'Moldova', iso:'MD', qid:'Q217' },
  { name:'Monaco', iso:'MC', qid:'Q235' },
  { name:'Montenegro', iso:'ME', qid:'Q236' },
  { name:'Netherlands', iso:'NL', qid:'Q55' },
  { name:'North Macedonia', iso:'MK', qid:'Q221' },
  { name:'Norway', iso:'NO', qid:'Q20' },
  { name:'Poland', iso:'PL', qid:'Q36' },
  { name:'Portugal', iso:'PT', qid:'Q45' },
  { name:'Romania', iso:'RO', qid:'Q218' },
  { name:'San Marino', iso:'SM', qid:'Q238' },
  { name:'Serbia', iso:'RS', qid:'Q403' },
  { name:'Slovakia', iso:'SK', qid:'Q214' },
  { name:'Slovenia', iso:'SI', qid:'Q215' },
  { name:'Spain', iso:'ES', qid:'Q29' },
  { name:'Sweden', iso:'SE', qid:'Q34' },
  { name:'Switzerland', iso:'CH', qid:'Q39' },
  { name:'Turkey', iso:'TR', qid:'Q43' },
  { name:'Ukraine', iso:'UA', qid:'Q212' },
  { name:'United Kingdom', iso:'GB', qid:'Q145' },
  { name:'Vatican City', iso:'VA', qid:'Q237' },
];

const DEDUP_THRESHOLD_KM = 0.5;
const RETRY_COUNT = 3;
const RETRY_DELAY = 5000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function cleanStationName(name) {
  return String(name||'')
    .replace(/\s+/g, ' ')
    .replace(/^Bahnhof\s+/i, '')
    .replace(/^(Gare de|Gare du|Gare d'|Stazione di|Stazione|Estación de|Estación|Estação de|Estação|Dworzec\s+)\s*/i, '')
    .replace(/\s+(railway station|railway|train station|central station|bus station|metro station|airport|aeroport|aéroport|flughafen|hauptbahnhof|hbf|bahnhof|station|gare|stazione|estación|estação|vasútállomás|pályaudvar|állomás|vasutallomas|palyaudvar|allomas)$/i, '')
    .trim();
}

function makeStationId(name, iso) {
  const clean = cleanStationName(name)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return clean + '-' + (iso || 'xx').toLowerCase();
}

// ── Wikidata SPARQL Query ────────────────────────────────────────────────────

async function fetchWikidataStations(country, attempt = 0) {
  const query = `
SELECT DISTINCT ?station ?stationLabel ?wdId ?lat ?lon WHERE {
  ?station wdt:P17 wd:${country.qid}.
  ?station wdt:P31 ?type.
  VALUES ?type {
    wd:Q55488    # railway station
    wd:Q55489    # railway stop (halt)
    wd:Q928830   # metro station
    wd:Q12046342 # S-Bahn station
    wd:Q2175765  # underground station
    wd:Q55491    # railway junction
    wd:Q548662   # request stop / halt
  }
  ?station wdt:P625 ?coord.
  BIND(geof:latitude(?coord) AS ?lat)
  BIND(geof:longitude(?coord) AS ?lon)
  BIND(STRAFTER(STR(?station), "http://www.wikidata.org/entity/") AS ?wdId)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,de,fr,it,es,nl,pl,cs,sv,da,fi,el,hu,ro,bg,sk,sl,hr,sr,lt,lv,et,uk,no". }
}
LIMIT 30000
`.trim();

  const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query);
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000); // 45s timeout
    
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'TrackAndTide/1.0 (https://trackandtide.com)' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    
    if (!resp.ok) {
      if (attempt < RETRY_COUNT) {
        console.log(`    Wikidata HTTP ${resp.status}, retrying in ${RETRY_DELAY/1000}s...`);
        await sleep(RETRY_DELAY);
        return fetchWikidataStations(country, attempt + 1);
      }
      console.log(`    Wikidata HTTP ${resp.status}, giving up`);
      return [];
    }
    const data = await resp.json();
    const bindings = data?.results?.bindings || [];
    console.log(`    Wikidata returned ${bindings.length} results`);
    return bindings.map(b => ({
      name: b.stationLabel?.value || b.station?.value?.split('/').pop() || 'Unknown',
      lat: parseFloat(b.lat?.value),
      lng: parseFloat(b.lon?.value),
      wikidataId: b.wdId?.value || '',
      source: 'wikidata',
      url: `https://www.wikidata.org/wiki/${b.wdId?.value || ''}`,
    })).filter(s => s.lat && s.lng && !isNaN(s.lat) && !isNaN(s.lng));
  } catch (e) {
    if (attempt < RETRY_COUNT) {
      console.log(`    Wikidata error: ${e.message}, retrying in ${RETRY_DELAY/1000}s...`);
      await sleep(RETRY_DELAY);
      return fetchWikidataStations(country, attempt + 1);
    }
    console.log(`    Wikidata error: ${e.message}, giving up (preserving existing data)`);
    return null; // null = use existing data instead of empty array
  }
}

// ── Merge with existing OSM data ────────────────────────────────────────────

function mergeExistingOsm(newStations, existingCountryData) {
  if (!existingCountryData?.stations) return { stations: newStations, osmPreserved: 0 };
  
  const existing = existingCountryData.stations;
  let osmPreserved = 0;
  
  for (const old of existing) {
    if (!old.source || old.source !== 'osm') continue;
    if (!old.lat || !old.lng) continue;
    
    let isDuplicate = false;
    for (const ns of newStations) {
      if (ns.source === 'osm') continue;
      const dist = haversineKm(old.lat, old.lng, ns.lat, ns.lng);
      if (dist < DEDUP_THRESHOLD_KM) {
        isDuplicate = true;
        if (old.operators?.length && (!ns.operators || !ns.operators.length)) {
          ns.operators = old.operators;
        }
        if (old.limited_use) ns.limited_use = old.limited_use;
        if (old._oldId) ns._oldId = old._oldId;
        break;
      }
    }
    
    if (!isDuplicate) {
      newStations.push({
        id: old.id,
        url: old.url || '',
        wikidataId: old.wikidataId || '',
        source: 'osm',
        name: old.name,
        lat: old.lat,
        lng: old.lng,
        operators: old.operators || [],
        limited_use: old.limited_use || false,
        _oldId: old._oldId || undefined,
      });
      osmPreserved++;
    }
  }
  
  return { stations: newStations, osmPreserved };
}

// ── Internal Dedup ──────────────────────────────────────────────────────────

function deduplicate(stations) {
  const deduped = [];
  for (const s of stations) {
    let isDuplicate = false;
    for (const existing of deduped) {
      const dist = haversineKm(s.lat, s.lng, existing.lat, existing.lng);
      if (dist < DEDUP_THRESHOLD_KM) {
        isDuplicate = true;
        if (s.operators?.length && (!existing.operators || !existing.operators.length)) {
          existing.operators = s.operators;
        }
        if (s.source === 'wikidata' && existing.source === 'osm') {
          existing.wikidataId = s.wikidataId;
          existing.url = s.url;
          existing.source = 'wikidata';
        }
        if (s.limited_use && !existing.limited_use) existing.limited_use = true;
        break;
      }
    }
    if (!isDuplicate) deduped.push(s);
  }
  deduped.sort((a, b) => a.name.localeCompare(b.name));
  return deduped;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  let targetCountries = EUROPEAN_COUNTRIES;
  
  const countryIdx = args.indexOf('--country');
  if (countryIdx >= 0) {
    const names = [];
    for (let i = countryIdx + 1; i < args.length && !args[i].startsWith('--'); i++) {
      names.push(args[i]);
    }
    if (names.length > 0) {
      targetCountries = EUROPEAN_COUNTRIES.filter(c => names.includes(c.name));
      if (targetCountries.length === 0) {
        console.log(`Country not found: ${names.join(', ')}`);
        process.exit(1);
      }
    }
  }
  
  let existingData = { countries: {} };
  try {
    existingData = JSON.parse(readFileSync(EXISTING_FILE, 'utf8'));
    console.log(`Loaded existing data with ${Object.keys(existingData.countries||{}).length} countries`);
  } catch {
    console.log('No existing data found, starting fresh');
  }
  
  console.log(`Track & Tide — Station Downloader`);
  console.log(`Target: ${targetCountries.map(c=>c.name).join(', ')}`);
  console.log('');
  
  const resultCountries = {};
  let grandTotalWikidata = 0;
  let grandTotalOsmPreserved = 0;
  let grandTotal = 0;
  
  for (let i = 0; i < targetCountries.length; i++) {
    const country = targetCountries[i];
    console.log(`[${i+1}/${targetCountries.length}] ${country.name} (${country.iso})`);
    
    const wdStations = await fetchWikidataStations(country);
    
    if (wdStations === null) {
      // Wikidata failed, preserve existing data entirely
      console.log(`  Wikidata failed, preserving existing data`);
      const existingCountry = existingData.countries?.[country.name];
      if (existingCountry) {
        resultCountries[country.name] = existingCountry;
        grandTotal += existingCountry.counts?.total || existingCountry.stations?.length || 0;
        grandTotalOsmPreserved += existingCountry.counts?.osm || 0;
        console.log(`  → ${existingCountry.counts?.total || existingCountry.stations?.length || 0} stations preserved`);
      } else {
        resultCountries[country.name] = {
          country: country.name, qid: country.qid, iso: country.iso,
          counts: { total: 0, wikidata: 0, osm: 0 }, stations: [],
        };
      }
      console.log('');
      if (i < targetCountries.length - 1) await sleep(1500);
      continue;
    }
    
    let stations = wdStations.map(s => ({
      id: makeStationId(s.name, country.iso),
      url: s.url,
      wikidataId: s.wikidataId,
      source: s.source,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      operators: [],
    }));
    
    const wdBeforeDedup = stations.length;
    stations = deduplicate(stations);
    const wdAfterDedup = stations.length;
    
    const existingCountry = existingData.countries?.[country.name];
    const { osmPreserved } = mergeExistingOsm(stations, existingCountry);
    
    stations = deduplicate(stations);
    
    grandTotalWikidata += wdStations.length;
    grandTotalOsmPreserved += osmPreserved;
    grandTotal += stations.length;
    
    const counts = {
      total: stations.length,
      wikidata: wdStations.length,
      osm: osmPreserved,
    };
    
    resultCountries[country.name] = {
      country: country.name,
      qid: country.qid,
      iso: country.iso,
      counts,
      stations,
    };
    
    console.log(`  → ${stations.length} unique (${wdBeforeDedup} WD raw, ${wdAfterDedup} after WD dedup, ${osmPreserved} OSM preserved)`);
    console.log('');
    
    if (i < targetCountries.length - 1) {
      await sleep(1500);
    }
  }
  
  // Preserve countries not in target list
  for (const [name, data] of Object.entries(existingData.countries || {})) {
    if (!resultCountries[name]) {
      resultCountries[name] = data;
      grandTotal += data.counts?.total || data.stations?.length || 0;
    }
  }
  
  const output = {
    generatedAt: new Date().toISOString(),
    sources: {
      wikidata: 'https://query.wikidata.org/sparql',
      osm: (existingData.sources?.osm || ['https://overpass-api.de/api/interpreter']),
    },
    countries: resultCountries,
  };
  
  console.log('Writing output file...');
  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`Download complete!`);
  console.log(`Countries processed:   ${targetCountries.length}`);
  console.log(`Total Wikidata fetched: ${grandTotalWikidata}`);
  console.log(`Total OSM preserved:   ${grandTotalOsmPreserved}`);
  console.log(`Total unique stations: ${grandTotal}`);
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log(`═══════════════════════════════════════════════════`);
}

main().catch(e => { console.error('Fatal error:', e); process.exit(1); });
