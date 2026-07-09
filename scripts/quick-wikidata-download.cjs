// Quick Wikidata download for key European countries
const https = require('https');
const fs = require('fs');

function fetchJSON(url) {
  return new Promise((ok, fail) => {
    https.get(url, {headers:{'User-Agent':'TrackAndTide/1.0'}, timeout: 60000}, r => {
      let d=''; r.on('data',c=>d+=c); r.on('end',()=>{try{ok(JSON.parse(d))}catch(e){fail(e)}});
    }).on('error', fail).on('timeout', () => { fail(new Error('timeout')); });
  });
}

async function getCountry(qid) {
  // Only active railway stations — exclude metro/underground, and exclude decommissioned/disused/abandoned
  const query = `SELECT DISTINCT ?station ?stationLabel ?wdId ?lat ?lon WHERE {
  ?station wdt:P17 wd:${qid}.
  ?station wdt:P31 ?type.
  VALUES ?type { wd:Q55488 wd:Q55489 }.
  ?station wdt:P625 ?coord.
  BIND(geof:latitude(?coord) AS ?lat)
  BIND(geof:longitude(?coord) AS ?lon)
  BIND(STRAFTER(STR(?station), "http://www.wikidata.org/entity/") AS ?wdId)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  # Exclude decommissioned, disused, abandoned stations
  FILTER NOT EXISTS { ?station wdt:P5817 wd:Q22674925. }
  FILTER NOT EXISTS { ?station wdt:P5817 wd:Q56054944. }
  FILTER NOT EXISTS { ?station wdt:P5817 wd:Q39366689. }
  FILTER NOT EXISTS { ?station wdt:P5817 wd:Q56054954. }
} LIMIT 30000`;
  const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query);
  const data = await fetchJSON(url);
  return (data.results?.bindings || []).map(b => ({
    name: b.stationLabel?.value || 'Unknown',
    lat: parseFloat(b.lat?.value),
    lng: parseFloat(b.lon?.value),
    wikidataId: b.wdId?.value || '',
    source: 'wikidata',
    url: 'https://www.wikidata.org/wiki/' + (b.wdId?.value || ''),
    operators: []
  })).filter(s => s.lat && s.lng && !isNaN(s.lat) && !isNaN(s.lng));
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function makeId(name, iso) {
  return String(name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') + '-' + iso.toLowerCase();
}

const countries = [
  {name:'Germany',iso:'DE',qid:'Q183'},{name:'France',iso:'FR',qid:'Q142'},
  {name:'United Kingdom',iso:'GB',qid:'Q145'},{name:'Italy',iso:'IT',qid:'Q38'},
  {name:'Spain',iso:'ES',qid:'Q29'},{name:'Poland',iso:'PL',qid:'Q36'},
  {name:'Austria',iso:'AT',qid:'Q40'},{name:'Belgium',iso:'BE',qid:'Q31'},
  {name:'Switzerland',iso:'CH',qid:'Q39'},{name:'Sweden',iso:'SE',qid:'Q34'},
  {name:'Czechia',iso:'CZ',qid:'Q213'},{name:'Denmark',iso:'DK',qid:'Q35'},
  {name:'Norway',iso:'NO',qid:'Q20'},{name:'Finland',iso:'FI',qid:'Q33'},
  {name:'Portugal',iso:'PT',qid:'Q45'},{name:'Hungary',iso:'HU',qid:'Q28'},
  {name:'Romania',iso:'RO',qid:'Q218'},{name:'Croatia',iso:'HR',qid:'Q224'},
  {name:'Slovakia',iso:'SK',qid:'Q214'},{name:'Slovenia',iso:'SI',qid:'Q215'},
  {name:'Bulgaria',iso:'BG',qid:'Q219'},{name:'Ireland',iso:'IE',qid:'Q27'},
  {name:'Greece',iso:'GR',qid:'Q41'},{name:'Serbia',iso:'RS',qid:'Q403'},
  {name:'Lithuania',iso:'LT',qid:'Q37'},{name:'Latvia',iso:'LV',qid:'Q211'},
  {name:'Estonia',iso:'EE',qid:'Q191'},{name:'Luxembourg',iso:'LU',qid:'Q32'},
  {name:'Bosnia and Herzegovina',iso:'BA',qid:'Q225'},
];

const DEDUP_KM = 0.5;

async function main() {
  console.log('Loading existing stations.json...');
  const stations = JSON.parse(fs.readFileSync('stations.json', 'utf8'));
  
  for (const country of countries) {
    const cn = country.name;
    const existing = stations.countries[cn];
    if (existing && existing.stations.length > 50) {
      console.log(`${cn}: already ${existing.stations.length} stations, skipping`);
      continue;
    }
    
    console.log(`${cn}...`);
    try {
      // Retry up to 3 times with increasing delay
      let results = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          results = await getCountry(country.qid);
          break;
        } catch(e) {
          if (attempt < 2) {
            const delay = (attempt + 1) * 10000; // 10s, 20s
            console.log(`  Retry ${attempt+1} in ${delay/1000}s...`);
            await new Promise(r => setTimeout(r, delay));
          } else {
            throw e;
          }
        }
      }
      console.log(`  Wikidata: ${results.length} results`);
      
      if (results.length === 0) continue;
      
      // Build spatial grid for dedup
      const grid = new Map();
      const existingStations = existing?.stations || [];
      for (const s of existingStations) {
        const key = `${Math.floor(s.lat*2)},${Math.floor(s.lng*2)}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(s);
      }
      
      // Dedup
      let added = 0, dupes = 0;
      const newStations = [];
      for (const s of results) {
        let isDupe = false;
        const clat = Math.floor(s.lat*2), clng = Math.floor(s.lng*2);
        for (let dla = -1; dla <= 1; dla++) {
          for (let dln = -1; dln <= 1; dln++) {
            const cell = grid.get(`${clat+dla},${clng+dln}`);
            if (cell) {
              for (const es of cell) {
                if (haversineKm(s.lat, s.lng, es.lat, es.lng) < DEDUP_KM) {
                  isDupe = true;
                  if (s.operators?.length && !es.operators?.length) es.operators = s.operators;
                  break;
                }
              }
            }
            if (isDupe) break;
          }
          if (isDupe) break;
        }
        if (!isDupe) {
          s.id = makeId(s.name, country.iso);
          newStations.push(s);
          const key = `${clat},${clng}`;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(s);
          added++;
        } else { dupes++; }
      }
      
      if (!stations.countries[cn]) {
        stations.countries[cn] = { country: cn, iso: country.iso.toLowerCase(), qid: country.qid, counts: { total: 0, wikidata: 0, osm: 0 }, stations: [] };
      }
      stations.countries[cn].stations = [...(existingStations || []), ...newStations].sort((a,b) => (a.name||'').localeCompare(b.name||''));
      stations.countries[cn].counts.total = stations.countries[cn].stations.length;
      stations.countries[cn].counts.wikidata = stations.countries[cn].stations.filter(s => s.source==='wikidata').length;
      stations.countries[cn].counts.osm = stations.countries[cn].stations.filter(s => s.source==='osm').length;
      
      console.log(`  +${added} new, ${dupes} dupes → ${stations.countries[cn].stations.length} total`);
      
      // Save after each country
      stations.generatedAt = new Date().toISOString();
      fs.writeFileSync('stations.json', JSON.stringify(stations, null, 2));
      
      // Longer delay between countries to avoid rate limiting
      await new Promise(r => setTimeout(r, 8000));
    } catch(e) {
      console.log(`  FAILED after retries: ${e.message}, skipping`);
    }
  }
  
  let total = 0;
  for (const [cn, c] of Object.entries(stations.countries)) {
    total += c.stations.length;
  }
  console.log(`\nDone! ${total} stations in ${Object.keys(stations.countries).length} countries`);
}

main().catch(e => { console.error(e); process.exit(1); });
