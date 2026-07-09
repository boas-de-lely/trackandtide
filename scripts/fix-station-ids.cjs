// Fix stations.json: clean IDs, remove limited_use, proper formatting
const fs = require('fs');

function cleanStationName(name) {
  return String(name||'')
    .replace(/\s+/g, ' ')
    .replace(/^Bahnhof\s+/i, '')
    .replace(/^(Gare de|Gare du|Gare d'|Stazione di|Stazione|Estación de|Estación|Estação de|Estação|Dworzec\s+)\s*/i, '')
    .replace(/\s+(railway station|railway|train station|central station|bus station|metro station|airport|aeroport|aéroport|flughafen|hauptbahnhof|hbf|bahnhof|station|gare|stazione|estación|estação|vasútállomás|pályaudvar|állomás)$/i, '')
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

console.log('Loading stations.json...');
const stations = JSON.parse(fs.readFileSync('stations.json', 'utf8'));

let totalBefore = 0, totalAfter = 0, limitedRemoved = 0;

for (const [cn, country] of Object.entries(stations.countries)) {
  const before = country.stations.length;
  totalBefore += before;

  // Remove limited_use stations
  const filtered = country.stations.filter(s => !s.limited_use && s.usage !== 'limited_use');
  limitedRemoved += (before - filtered.length);

  // Clean up each station
  country.stations = filtered.map(s => {
    const clean = {
      id: makeStationId(s.name, country.iso || 'xx'),
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      operators: Array.isArray(s.operators) ? s.operators.filter(o => o) : []
    };
    // Only include optional fields if they have values
    if (s.wikidataId && s.wikidataId !== '') clean.wikidataId = s.wikidataId;
    if (s.source && s.source !== 'csv') clean.source = s.source;
    if (s.url && s.url !== '' && !s.url.startsWith('http://www.wikidata.org/entity/')) clean.url = s.url;
    return clean;
  });

  // Sort by name
  country.stations.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  country.counts.total = country.stations.length;
  country.counts.wikidata = country.stations.filter(s => s.source === 'wikidata').length;
  country.counts.osm = country.stations.filter(s => s.source === 'osm').length;

  totalAfter += country.stations.length;
  if (country.stations.length > 0) {
    console.log(`  ${cn}: ${before} → ${country.stations.length} (removed ${before - country.stations.length} limited_use)`);
  }
}

// Remove empty countries
for (const cn of Object.keys(stations.countries)) {
  if (stations.countries[cn].stations.length === 0) {
    delete stations.countries[cn];
  }
}

stations.generatedAt = new Date().toISOString();

// Write with clean formatting
fs.writeFileSync('stations.json', JSON.stringify(stations, null, 2));
console.log(`\nDone! ${totalBefore} → ${totalAfter} stations (${limitedRemoved} limited_use removed)`);
console.log(`${Object.keys(stations.countries).length} countries with stations`);
