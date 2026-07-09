// Filter all data files to Netherlands-only, keeping only active railway stations
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ── 1. Filter stations.json ──
console.log('Filtering stations.json...');
const stations = JSON.parse(fs.readFileSync(path.join(ROOT, 'stations.json'), 'utf8'));
const nlData = stations.countries?.['Netherlands'];
if (!nlData) { console.error('Netherlands not found in stations.json'); process.exit(1); }

const originalCount = nlData.stations.length;
// Keep only stations with at least one operator (active railway stations)
const filteredStations = nlData.stations.filter(s => Array.isArray(s.operators) && s.operators.length > 0);
const removedCount = originalCount - filteredStations.length;

nlData.stations = filteredStations;
nlData.counts.total = filteredStations.length;
// Re-count sources
const wdCount = filteredStations.filter(s => s.source === 'wikidata').length;
const osmCount = filteredStations.filter(s => s.source === 'osm').length;
const csvCount = filteredStations.filter(s => s.source === 'csv').length;
nlData.counts.wikidata = wdCount;
nlData.counts.osm = osmCount;

// Replace entire countries object with only Netherlands
stations.countries = { 'Netherlands': nlData };
stations.generatedAt = new Date().toISOString();

fs.writeFileSync(path.join(ROOT, 'stations.json'), JSON.stringify(stations, null, 2));
console.log(`  NL stations: ${originalCount} → ${filteredStations.length} (removed ${removedCount} non-railway)`);
console.log(`  Sources: wikidata=${wdCount}, osm=${osmCount}, csv=${csvCount}`);

// ── 2. Filter data.json (operators) ──
console.log('Filtering data.json...');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data.json'), 'utf8'));
const originalOpCount = data.operators.length;

// Keep operators that have Netherlands in their countries array
const nlOperators = data.operators.filter(op => {
  const countries = op.countries || [op.country];
  return countries.some(c => c === 'Netherlands');
});

data.operators = nlOperators;
fs.writeFileSync(path.join(ROOT, 'data.json'), JSON.stringify(data, null, 2));
console.log(`  Operators: ${originalOpCount} → ${nlOperators.length} (NL only)`);
console.log(`  Names: ${nlOperators.map(o => o.name).join(', ')}`);

// ── 3. Filter ferries.json ──
console.log('Filtering ferries.json...');
const ferries = JSON.parse(fs.readFileSync(path.join(ROOT, 'ferries.json'), 'utf8'));
const originalFerryCount = (ferries.routes || []).length;

const nlFerryRoutes = (ferries.routes || []).filter(r => {
  return (r.countries || []).some(c => c === 'Netherlands');
});

ferries.routes = nlFerryRoutes;
fs.writeFileSync(path.join(ROOT, 'ferries.json'), JSON.stringify(ferries, null, 2));
console.log(`  Ferry routes: ${originalFerryCount} → ${nlFerryRoutes.length}`);

// ── 4. Filter ferry_ports.json ──
console.log('Filtering ferry_ports.json...');
const fp = JSON.parse(fs.readFileSync(path.join(ROOT, 'ferry_ports.json'), 'utf8'));
const originalPortCount = (fp.ports || []).length;

const nlPorts = (fp.ports || []).filter(p => {
  return (p.countries || [p.country]).some(c => c === 'Netherlands');
});

fp.ports = nlPorts;
fs.writeFileSync(path.join(ROOT, 'ferry_ports.json'), JSON.stringify(fp, null, 2));
console.log(`  Ferry ports: ${originalPortCount} → ${nlPorts.length}`);

console.log('\nDone! All data files filtered to Netherlands only.');
