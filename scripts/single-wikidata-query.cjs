// Single Wikidata query for all European railway stations
const https = require('https');
const fs = require('fs');

function fetchJSON(url) {
  return new Promise((ok, fail) => {
    const req = https.get(url, {headers:{'User-Agent':'TrackAndTide/1.0'}, timeout: 180000}, r => {
      let d=''; r.on('data',c=>d+=c); r.on('end',()=>{try{ok(JSON.parse(d))}catch(e){fail(e)}});
    }).on('error', fail);
    req.on('timeout', () => { req.destroy(); fail(new Error('timeout')); });
  });
}

const ISO_MAP = {
  'Albania':'AL','Andorra':'AD','Austria':'AT','Belarus':'BY','Belgium':'BE',
  'Bosnia and Herzegovina':'BA','Bulgaria':'BG','Croatia':'HR','Cyprus':'CY',
  'Czech Republic':'CZ','Denmark':'DK','Estonia':'EE','Finland':'FI',
  'France':'FR','Germany':'DE','Greece':'GR','Hungary':'HU','Iceland':'IS',
  'Ireland':'IE','Italy':'IT','Kosovo':'XK','Latvia':'LV','Liechtenstein':'LI',
  'Lithuania':'LT','Luxembourg':'LU','Malta':'MT','Moldova':'MD','Monaco':'MC',
  'Montenegro':'ME','Netherlands':'NL','North Macedonia':'MK','Norway':'NO',
  'Poland':'PL','Portugal':'PT','Romania':'RO','San Marino':'SM','Serbia':'RS',
  'Slovakia':'SK','Slovenia':'SI','Spain':'ES','Sweden':'SE','Switzerland':'CH',
  'Turkey':'TR','Ukraine':'UA','United Kingdom':'GB','Vatican City':'VA'
};

function makeId(name, iso) {
  return String(name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') + '-' + (iso||'xx').toLowerCase();
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

(async () => {
  // Single query: all European railway stations (Q55488 + Q55489), excluding disused/decommissioned/abandoned
  const query = `SELECT DISTINCT ?station ?stationLabel ?countryLabel ?wdId ?lat ?lon WHERE {
  ?station wdt:P31 ?type.
  VALUES ?type { wd:Q55488 wd:Q55489 }.
  ?station wdt:P17 ?country.
  ?country wdt:P30 wd:Q46.
  ?station wdt:P625 ?coord.
  BIND(geof:latitude(?coord) AS ?lat)
  BIND(geof:longitude(?coord) AS ?lon)
  BIND(STRAFTER(STR(?station), "http://www.wikidata.org/entity/") AS ?wdId)
  FILTER NOT EXISTS { ?station wdt:P5817 wd:Q22674925. }
  FILTER NOT EXISTS { ?station wdt:P5817 wd:Q56054944. }
  FILTER NOT EXISTS { ?station wdt:P5817 wd:Q39366689. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 50000`;

  console.log('Querying Wikidata for all European railway stations...');
  const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query);
  
  const data = await fetchJSON(url);
  const raw = (data.results?.bindings || []).map(b => ({
    name: b.stationLabel?.value || 'Unknown',
    country: b.countryLabel?.value || '',
    lat: parseFloat(b.lat?.value),
    lng: parseFloat(b.lon?.value),
    wikidataId: b.wdId?.value || '',
    source: 'wikidata',
    url: 'https://www.wikidata.org/wiki/' + (b.wdId?.value || ''),
    operators: []
  })).filter(s => s.lat && s.lng && !isNaN(s.lat) && !isNaN(s.lng));
  
  console.log(`Wikidata returned ${raw.length} stations`);

  // Group by country
  const byCountry = {};
  raw.forEach(r => { 
    const cn = r.country;
    if (!byCountry[cn]) byCountry[cn] = [];
    byCountry[cn].push(r);
  });

  // Load existing
  const stations = JSON.parse(fs.readFileSync('stations.json', 'utf8'));
  const DEDUP_KM = 0.5;

  for (const [cn, newStations] of Object.entries(byCountry)) {
    const iso = ISO_MAP[cn];
    if (!iso) { console.log(`  ${cn}: unknown ISO, skipping ${newStations.length}`); continue; }

    const existing = stations.countries[cn];
    const existingStations = existing?.stations || [];

    // Build spatial grid from existing
    const grid = new Map();
    for (const s of existingStations) {
      const key = `${Math.floor(s.lat*2)},${Math.floor(s.lng*2)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(s);
    }

    let added = 0, dupes = 0;
    const toAdd = [];
    for (const s of newStations) {
      let isDupe = false;
      const clat = Math.floor(s.lat*2), clng = Math.floor(s.lng*2);
      for (let dla = -1; dla <= 1; dla++) {
        for (let dln = -1; dln <= 1; dln++) {
          const cell = grid.get(`${clat+dla},${clng+dln}`);
          if (cell) {
            for (const es of cell) {
              if (haversineKm(s.lat, s.lng, es.lat, es.lng) < DEDUP_KM) { isDupe = true; break; }
            }
          }
          if (isDupe) break;
        }
        if (isDupe) break;
      }
      if (!isDupe) {
        s.id = makeId(s.name, iso);
        toAdd.push(s);
        const key = `${clat},${clng}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(s);
        added++;
      } else { dupes++; }
    }

    if (!stations.countries[cn]) {
      stations.countries[cn] = { country: cn, iso: iso.toLowerCase(), qid: '', counts: { total: 0, wikidata: 0, osm: 0 }, stations: [] };
    }
    stations.countries[cn].stations = [...existingStations, ...toAdd].sort((a,b) => (a.name||'').localeCompare(b.name||''));
    stations.countries[cn].counts.total = stations.countries[cn].stations.length;
    stations.countries[cn].counts.wikidata = stations.countries[cn].stations.filter(s => s.source==='wikidata').length;
    stations.countries[cn].counts.osm = stations.countries[cn].stations.filter(s => s.source==='osm').length;

    console.log(`  ${cn}: +${added} new, ${dupes} dupes → ${stations.countries[cn].stations.length} total`);
  }

  stations.generatedAt = new Date().toISOString();
  fs.writeFileSync('stations.json', JSON.stringify(stations, null, 2));

  let total = 0;
  for (const c of Object.values(stations.countries)) total += c.stations.length;
  console.log(`\nDone! ${total} stations in ${Object.keys(stations.countries).length} countries`);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
