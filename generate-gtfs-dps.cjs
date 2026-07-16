/**
 * GTFS Feed Generator for DFDS, P&O Ferries, and Stena Line
 * 
 * Generates GTFS zip files for:
 * - DFDS Seaways (North Sea, English Channel, Scandinavia)
 * - P&O Ferries (English Channel, North Sea, Irish Sea)
 * - Stena Line (Irish Sea, North Sea, Scandinavia, Baltic Sea)
 * 
 * Data sourced from Wikipedia, official websites as of July 2026.
 * Run: node generate-gtfs-dps.cjs
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FEEDS_DIR = path.join(__dirname, 'feeds');

// =============================================================================
// Port coordinates (matching ferry_ports.json)
// =============================================================================
const PORTS = {
  // English Channel
  dover:        { name: 'Dover',         lat: 51.13, lon: 1.31 },
  calais:       { name: 'Calais',        lat: 50.97, lon: 1.86 },
  dunkirk:      { name: 'Dunkirk',       lat: 51.04, lon: 2.37 },

  // North Sea
  newcastle:    { name: 'Newcastle',     lat: 55.01, lon: -1.45 },
  ijmuiden:     { name: 'IJmuiden',      lat: 52.46, lon: 4.61 },
  hull:         { name: 'Hull',          lat: 53.74, lon: -0.33 },
  rotterdam:    { name: 'Rotterdam',     lat: 51.95, lon: 4.14 },
  harwich:      { name: 'Harwich',       lat: 51.94, lon: 1.28 },
  hookOfHolland:{ name: 'Hook of Holland', lat: 51.98, lon: 4.13 },
  newhaven:     { name: 'Newhaven',      lat: 50.79, lon: 0.05 },
  dieppe:       { name: 'Dieppe',        lat: 49.92, lon: 1.08 },
  gothenburg:   { name: 'Gothenburg',    lat: 57.70, lon: 11.93 },
  kiel:         { name: 'Kiel',          lat: 54.33, lon: 10.15 },

  // Scandinavia
  copenhagen:   { name: 'Copenhagen',    lat: 55.69, lon: 12.60 },
  oslo:         { name: 'Oslo',          lat: 59.91, lon: 10.73 },
  frederikshavn:{ name: 'Frederikshavn', lat: 57.44, lon: 10.54 },

  // Irish Sea
  cairnryan:    { name: 'Cairnryan',     lat: 54.97, lon: -5.02 },
  larne:        { name: 'Larne',         lat: 54.85, lon: -5.81 },
  belfast:      { name: 'Belfast',       lat: 54.61, lon: -5.92 },
  birkenhead:   { name: 'Birkenhead',    lat: 53.39, lon: -3.01 },
  holyhead:     { name: 'Holyhead',      lat: 53.31, lon: -4.63 },
  dublin:       { name: 'Dublin',        lat: 53.35, lon: -6.26 },
  fishguard:    { name: 'Fishguard',     lat: 52.01, lon: -4.98 },
  rosslare:     { name: 'Rosslare',      lat: 52.25, lon: -6.34 },

  // Baltic Sea / Scandinavia
  trelleborg:   { name: 'Trelleborg',    lat: 55.37, lon: 13.17 },
  rostock:      { name: 'Rostock',       lat: 54.18, lon: 12.08 },
  karlskrona:   { name: 'Karlskrona',    lat: 56.17, lon: 15.59 },
  gdynia:       { name: 'Gdynia',        lat: 54.52, lon: 18.54 },
  nynashamn:    { name: 'Nynäshamn',     lat: 58.90, lon: 17.95 },
  ventspils:    { name: 'Ventspils',     lat: 57.39, lon: 21.56 },
  travemunde:   { name: 'Travemünde',    lat: 53.96, lon: 10.87 },
  liepaja:      { name: 'Liepāja',       lat: 56.52, lon: 21.01 },
  vaasa:        { name: 'Vaasa',         lat: 63.09, lon: 21.57 },
  umea:         { name: 'Umeå',          lat: 63.82, lon: 20.25 },
  halmstad:     { name: 'Halmstad',      lat: 56.67, lon: 12.86 },
  grenaa:       { name: 'Grenå',         lat: 56.41, lon: 10.88 },
};

// =============================================================================
// CSV helpers
// =============================================================================
function csvLine(fields) {
  return fields.map(f => {
    if (f === null || f === undefined) return '';
    const s = String(f);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }).join(',');
}

function writeCSV(filePath, headers, rows) {
  const lines = [csvLine(headers)];
  rows.forEach(row => lines.push(csvLine(headers.map(h => row[h] !== undefined ? row[h] : ''))));
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
}

// =============================================================================
// Build GTFS for one operator
// =============================================================================
function buildGTFS(outputDir, agency, routes, trips, stopsUsed) {
  fs.mkdirSync(outputDir, { recursive: true });

  // agency.txt
  writeCSV(path.join(outputDir, 'agency.txt'),
    ['agency_id', 'agency_name', 'agency_url', 'agency_timezone', 'agency_lang', 'agency_phone'],
    [agency]);

  // stops.txt
  const stopRows = Object.entries(stopsUsed).map(([id, s]) => ({
    stop_id: id, stop_name: s.name, stop_lat: s.lat, stop_lon: s.lon,
  }));
  writeCSV(path.join(outputDir, 'stops.txt'),
    ['stop_id', 'stop_name', 'stop_lat', 'stop_lon'], stopRows);

  // routes.txt
  const routeRows = routes.map(r => ({
    route_id: r.route_id, agency_id: agency.agency_id,
    route_short_name: r.short_name, route_long_name: r.long_name,
    route_type: 4, // Ferry
  }));
  writeCSV(path.join(outputDir, 'routes.txt'),
    ['route_id', 'agency_id', 'route_short_name', 'route_long_name', 'route_type'], routeRows);

  // trips.txt
  const tripRows = trips.map(t => ({
    route_id: t.route_id, service_id: t.service_id, trip_id: t.trip_id,
    trip_headsign: t.headsign, direction_id: 0, trip_short_name: t.ship || '',
  }));
  writeCSV(path.join(outputDir, 'trips.txt'),
    ['route_id', 'service_id', 'trip_id', 'trip_headsign', 'direction_id', 'trip_short_name'], tripRows);

  // stop_times.txt
  const stRows = [];
  trips.forEach(t => {
    t.stops.forEach((s, i) => {
      stRows.push({
        trip_id: t.trip_id, arrival_time: s.arr || '', departure_time: s.dep || '',
        stop_id: s.stop_id, stop_sequence: i + 1,
      });
    });
  });
  writeCSV(path.join(outputDir, 'stop_times.txt'),
    ['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence'], stRows);

  // calendar_dates.txt — daily service for 1 year
  const calRows = [];
  const startDate = new Date('2026-07-16');
  for (let d = 0; d < 365; d++) {
    const dt = new Date(startDate);
    dt.setDate(dt.getDate() + d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    calRows.push({ service_id: 'daily', date: `${y}${m}${day}`, exception_type: 1 });
  }
  writeCSV(path.join(outputDir, 'calendar_dates.txt'),
    ['service_id', 'date', 'exception_type'], calRows);

  // feed_info.txt
  writeCSV(path.join(outputDir, 'feed_info.txt'),
    ['feed_publisher_name', 'feed_publisher_url', 'feed_lang', 'feed_start_date', 'feed_end_date'],
    [{ feed_publisher_name: 'Track & Tide', feed_publisher_url: 'https://trackandtide.com',
       feed_lang: 'en', feed_start_date: '20260716', feed_end_date: '20270716' }]);
}

function createZip(dirName, zipName) {
  const dir = path.join(FEEDS_DIR, dirName);
  const zipPath = path.join(FEEDS_DIR, zipName);
  try {
    const cmd = `Compress-Archive -Path "${dir}\\*" -DestinationPath "${zipPath}" -Force`;
    execSync(`powershell -NoProfile -Command "${cmd}"`, { stdio: 'pipe' });
    console.log(`  ✅ Created ${zipName}`);
  } catch (e) {
    console.error(`  ❌ Failed to zip ${dirName}: ${e.message}`);
  }
}

// =============================================================================
// Helper to build bidirectional trip pairs
// =============================================================================
function makeTrips(routeIdA, routeIdB, serviceId, ship, stopA, stopB, schedules) {
  const trips = [];
  schedules.forEach((s, i) => {
    trips.push({
      trip_id: `${routeIdA}_${i + 1}`, route_id: routeIdA, service_id: serviceId,
      headsign: PORTS[stopB].name, ship: ship,
      stops: [
        { stop_id: stopA, arr: null, dep: s.dep },
        { stop_id: stopB, arr: s.arr, dep: null },
      ],
    });
  });
  schedules.forEach((s, i) => {
    trips.push({
      trip_id: `${routeIdB}_${i + 1}`, route_id: routeIdB, service_id: serviceId,
      headsign: PORTS[stopA].name, ship: ship,
      stops: [
        { stop_id: stopB, arr: null, dep: s.retDep },
        { stop_id: stopA, arr: s.retArr, dep: null },
      ],
    });
  });
  return trips;
}

// =============================================================================
// 1. DFDS SEAWAYS
// =============================================================================

const dfdsAgency = {
  agency_id: 'dfds', agency_name: 'DFDS Seaways',
  agency_url: 'https://www.dfds.com', agency_timezone: 'Europe/Copenhagen',
  agency_lang: 'en', agency_phone: '+45 33 42 30 00',
};

// Dover <-> Calais (~1.5h, ~10x daily)
const dfdsDoverCalaisTrips = makeTrips('dfds_dov_cal', 'dfds_cal_dov', 'daily', 'Côte des Dunes',
  'dover', 'calais', [
    { dep: '01:00:00', arr: '02:30:00', retDep: '03:00:00', retArr: '04:30:00' },
    { dep: '04:00:00', arr: '05:30:00', retDep: '06:00:00', retArr: '07:30:00' },
    { dep: '06:20:00', arr: '07:50:00', retDep: '08:20:00', retArr: '09:50:00' },
    { dep: '08:45:00', arr: '10:15:00', retDep: '10:45:00', retArr: '12:15:00' },
    { dep: '11:15:00', arr: '12:45:00', retDep: '13:15:00', retArr: '14:45:00' },
    { dep: '13:45:00', arr: '15:15:00', retDep: '15:45:00', retArr: '17:15:00' },
    { dep: '16:15:00', arr: '17:45:00', retDep: '18:15:00', retArr: '19:45:00' },
    { dep: '18:45:00', arr: '20:15:00', retDep: '20:45:00', retArr: '22:15:00' },
    { dep: '21:15:00', arr: '22:45:00', retDep: '23:15:00', retArr: '00:45:00' },
  ]);

// Dover <-> Dunkirk (~2h, ~12x daily)
const dfdsDoverDunkirkTrips = makeTrips('dfds_dov_dun', 'dfds_dun_dov', 'daily', 'Dover Seaways',
  'dover', 'dunkirk', [
    { dep: '00:01:00', arr: '02:01:00', retDep: '02:30:00', retArr: '04:30:00' },
    { dep: '04:01:00', arr: '06:01:00', retDep: '06:30:00', retArr: '08:30:00' },
    { dep: '06:01:00', arr: '08:01:00', retDep: '08:30:00', retArr: '10:30:00' },
    { dep: '08:01:00', arr: '10:01:00', retDep: '10:30:00', retArr: '12:30:00' },
    { dep: '10:01:00', arr: '12:01:00', retDep: '12:30:00', retArr: '14:30:00' },
    { dep: '12:01:00', arr: '14:01:00', retDep: '14:30:00', retArr: '16:30:00' },
    { dep: '14:01:00', arr: '16:01:00', retDep: '16:30:00', retArr: '18:30:00' },
    { dep: '16:01:00', arr: '18:01:00', retDep: '18:30:00', retArr: '20:30:00' },
    { dep: '18:01:00', arr: '20:01:00', retDep: '20:30:00', retArr: '22:30:00' },
    { dep: '20:01:00', arr: '22:01:00', retDep: '22:30:00', retArr: '00:30:00' },
    { dep: '22:01:00', arr: '00:01:00', retDep: '00:30:00', retArr: '02:30:00' },
  ]);

// Newcastle <-> IJmuiden (Amsterdam) (~15h overnight)
const dfdsNewIJmTrips = [
  { trip_id: 'dfds_new_ijm_1', route_id: 'dfds_new_ijm', service_id: 'daily',
    headsign: 'IJmuiden (Amsterdam)', ship: 'King Seaways',
    stops: [{ stop_id: 'newcastle', arr: null, dep: '17:00:00' },
            { stop_id: 'ijmuiden',  arr: '09:00:00', dep: null }] },
  { trip_id: 'dfds_ijm_new_1', route_id: 'dfds_ijm_new', service_id: 'daily',
    headsign: 'Newcastle', ship: 'Princess Seaways',
    stops: [{ stop_id: 'ijmuiden',  arr: null, dep: '17:30:00' },
            { stop_id: 'newcastle', arr: '09:30:00', dep: null }] },
];

// Copenhagen <-> Oslo (~16h overnight)
const dfdsCphOslTrips = [
  { trip_id: 'dfds_cph_osl_1', route_id: 'dfds_cph_osl', service_id: 'daily',
    headsign: 'Oslo', ship: 'Pearl Seaways',
    stops: [{ stop_id: 'copenhagen', arr: null, dep: '16:30:00' },
            { stop_id: 'oslo',       arr: '09:15:00', dep: null }] },
  { trip_id: 'dfds_osl_cph_1', route_id: 'dfds_osl_cph', service_id: 'daily',
    headsign: 'Copenhagen', ship: 'Crown Seaways',
    stops: [{ stop_id: 'oslo',       arr: null, dep: '16:30:00' },
            { stop_id: 'copenhagen', arr: '09:15:00', dep: null }] },
];

// Frederikshavn <-> Oslo (~10h, day crossing)
const dfdsFreOslTrips = [
  { trip_id: 'dfds_fre_osl_1', route_id: 'dfds_fre_osl', service_id: 'daily',
    headsign: 'Oslo', ship: 'Bergensfjord',
    stops: [{ stop_id: 'frederikshavn', arr: null, dep: '10:00:00' },
            { stop_id: 'oslo',          arr: '19:45:00', dep: null }] },
  { trip_id: 'dfds_osl_fre_1', route_id: 'dfds_osl_fre', service_id: 'daily',
    headsign: 'Frederikshavn', ship: 'Bergensfjord',
    stops: [{ stop_id: 'oslo',          arr: null, dep: '19:45:00' },
            { stop_id: 'frederikshavn', arr: '06:00:00', dep: null }] },
];

// Newhaven <-> Dieppe (~4h, 3x daily)
const dfdsNewDieTrips = makeTrips('dfds_new_die', 'dfds_die_new', 'daily', 'Seven Sisters',
  'newhaven', 'dieppe', [
    { dep: '09:30:00', arr: '13:30:00', retDep: '14:00:00', retArr: '18:00:00' },
    { dep: '13:30:00', arr: '17:30:00', retDep: '18:00:00', retArr: '22:00:00' },
    { dep: '23:00:00', arr: '03:00:00', retDep: '04:00:00', retArr: '08:00:00' },
  ]);

const dfdsRoutes = [
  { route_id: 'dfds_dov_cal', short_name: 'DOV-CAL', long_name: 'Dover - Calais (DFDS)' },
  { route_id: 'dfds_cal_dov', short_name: 'CAL-DOV', long_name: 'Calais - Dover (DFDS)' },
  { route_id: 'dfds_dov_dun', short_name: 'DOV-DUN', long_name: 'Dover - Dunkirk (DFDS)' },
  { route_id: 'dfds_dun_dov', short_name: 'DUN-DOV', long_name: 'Dunkirk - Dover (DFDS)' },
  { route_id: 'dfds_new_ijm', short_name: 'NCL-IJM', long_name: 'Newcastle - IJmuiden (DFDS)' },
  { route_id: 'dfds_ijm_new', short_name: 'IJM-NCL', long_name: 'IJmuiden - Newcastle (DFDS)' },
  { route_id: 'dfds_cph_osl', short_name: 'CPH-OSL', long_name: 'Copenhagen - Oslo (DFDS)' },
  { route_id: 'dfds_osl_cph', short_name: 'OSL-CPH', long_name: 'Oslo - Copenhagen (DFDS)' },
  { route_id: 'dfds_fre_osl', short_name: 'FDH-OSL', long_name: 'Frederikshavn - Oslo (DFDS)' },
  { route_id: 'dfds_osl_fre', short_name: 'OSL-FDH', long_name: 'Oslo - Frederikshavn (DFDS)' },
  { route_id: 'dfds_new_die', short_name: 'NHV-DPE', long_name: 'Newhaven - Dieppe (DFDS)' },
  { route_id: 'dfds_die_new', short_name: 'DPE-NHV', long_name: 'Dieppe - Newhaven (DFDS)' },
];

const dfdsTrips = [
  ...dfdsDoverCalaisTrips, ...dfdsDoverDunkirkTrips,
  ...dfdsNewIJmTrips, ...dfdsCphOslTrips, ...dfdsFreOslTrips, ...dfdsNewDieTrips,
];

const dfdsStops = {
  dover: PORTS.dover, calais: PORTS.calais, dunkirk: PORTS.dunkirk,
  newcastle: PORTS.newcastle, ijmuiden: PORTS.ijmuiden,
  copenhagen: PORTS.copenhagen, oslo: PORTS.oslo,
  frederikshavn: PORTS.frederikshavn,
  newhaven: PORTS.newhaven, dieppe: PORTS.dieppe,
};

// =============================================================================
// 2. P&O FERRIES
// =============================================================================

const poAgency = {
  agency_id: 'po_ferries', agency_name: 'P&O Ferries',
  agency_url: 'https://www.poferries.com', agency_timezone: 'Europe/London',
  agency_lang: 'en', agency_phone: '+44 1304 448800',
};

// Dover <-> Calais (~1.5h, ~11x daily)
const poDoverCalaisTrips = makeTrips('po_dov_cal', 'po_cal_dov', 'daily', 'Spirit of Britain',
  'dover', 'calais', [
    { dep: '00:15:00', arr: '01:45:00', retDep: '02:15:00', retArr: '03:45:00' },
    { dep: '03:15:00', arr: '04:45:00', retDep: '05:15:00', retArr: '06:45:00' },
    { dep: '06:15:00', arr: '07:45:00', retDep: '08:15:00', retArr: '09:45:00' },
    { dep: '08:00:00', arr: '09:30:00', retDep: '10:00:00', retArr: '11:30:00' },
    { dep: '09:45:00', arr: '11:15:00', retDep: '11:50:00', retArr: '13:20:00' },
    { dep: '11:30:00', arr: '13:00:00', retDep: '13:35:00', retArr: '15:05:00' },
    { dep: '13:15:00', arr: '14:45:00', retDep: '15:20:00', retArr: '16:50:00' },
    { dep: '15:00:00', arr: '16:30:00', retDep: '17:05:00', retArr: '18:35:00' },
    { dep: '16:45:00', arr: '18:15:00', retDep: '18:50:00', retArr: '20:20:00' },
    { dep: '18:30:00', arr: '20:00:00', retDep: '20:35:00', retArr: '22:05:00' },
    { dep: '20:15:00', arr: '21:45:00', retDep: '22:20:00', retArr: '23:50:00' },
    { dep: '22:30:00', arr: '00:00:00', retDep: '00:30:00', retArr: '02:00:00' },
  ]);

// Hull <-> Rotterdam (~12h overnight)
const poHullRotTrips = [
  { trip_id: 'po_hul_rot_1', route_id: 'po_hul_rot', service_id: 'daily',
    headsign: 'Rotterdam', ship: 'Pride of Rotterdam',
    stops: [{ stop_id: 'hull', arr: null, dep: '20:30:00' },
            { stop_id: 'rotterdam', arr: '08:00:00', dep: null }] },
  { trip_id: 'po_rot_hul_1', route_id: 'po_rot_hul', service_id: 'daily',
    headsign: 'Hull', ship: 'Pride of Hull',
    stops: [{ stop_id: 'rotterdam', arr: null, dep: '20:30:00' },
            { stop_id: 'hull', arr: '08:00:00', dep: null }] },
];

// Cairnryan <-> Larne (~2h, ~6x daily)
const poCaiLarTrips = makeTrips('po_cai_lar', 'po_lar_cai', 'daily', 'European Highlander',
  'cairnryan', 'larne', [
    { dep: '03:30:00', arr: '05:30:00', retDep: '04:00:00', retArr: '06:00:00' },
    { dep: '07:30:00', arr: '09:30:00', retDep: '08:00:00', retArr: '10:00:00' },
    { dep: '11:30:00', arr: '13:30:00', retDep: '12:00:00', retArr: '14:00:00' },
    { dep: '15:30:00', arr: '17:30:00', retDep: '16:00:00', retArr: '18:00:00' },
    { dep: '19:30:00', arr: '21:30:00', retDep: '20:00:00', retArr: '22:00:00' },
    { dep: '23:30:00', arr: '01:30:00', retDep: '00:00:00', retArr: '02:00:00' },
  ]);

const poRoutes = [
  { route_id: 'po_dov_cal', short_name: 'DOV-CAL', long_name: 'Dover - Calais (P&O)' },
  { route_id: 'po_cal_dov', short_name: 'CAL-DOV', long_name: 'Calais - Dover (P&O)' },
  { route_id: 'po_hul_rot', short_name: 'HUL-RTM', long_name: 'Hull - Rotterdam (P&O)' },
  { route_id: 'po_rot_hul', short_name: 'RTM-HUL', long_name: 'Rotterdam - Hull (P&O)' },
  { route_id: 'po_cai_lar', short_name: 'CAI-LAR', long_name: 'Cairnryan - Larne (P&O)' },
  { route_id: 'po_lar_cai', short_name: 'LAR-CAI', long_name: 'Larne - Cairnryan (P&O)' },
];

const poTrips = [...poDoverCalaisTrips, ...poHullRotTrips, ...poCaiLarTrips];

const poStops = {
  dover: PORTS.dover, calais: PORTS.calais,
  hull: PORTS.hull, rotterdam: PORTS.rotterdam,
  cairnryan: PORTS.cairnryan, larne: PORTS.larne,
};

// =============================================================================
// 3. STENA LINE
// =============================================================================

const stenaAgency = {
  agency_id: 'stena_line', agency_name: 'Stena Line',
  agency_url: 'https://www.stenaline.com', agency_timezone: 'Europe/Stockholm',
  agency_lang: 'en', agency_phone: '+46 31 85 80 00',
};

// Irish Sea routes
// Belfast <-> Cairnryan (~2h15m, multiple daily)
const stenaBelCaiTrips = makeTrips('ste_bel_cai', 'ste_cai_bel', 'daily', 'Stena Superfast VII',
  'belfast', 'cairnryan', [
    { dep: '03:30:00', arr: '05:45:00', retDep: '04:00:00', retArr: '06:15:00' },
    { dep: '07:30:00', arr: '09:45:00', retDep: '08:00:00', retArr: '10:15:00' },
    { dep: '11:30:00', arr: '13:45:00', retDep: '12:00:00', retArr: '14:15:00' },
    { dep: '15:30:00', arr: '17:45:00', retDep: '16:00:00', retArr: '18:15:00' },
    { dep: '19:30:00', arr: '21:45:00', retDep: '20:00:00', retArr: '22:15:00' },
    { dep: '23:30:00', arr: '01:45:00', retDep: '00:00:00', retArr: '02:15:00' },
  ]);

// Belfast <-> Birkenhead (Liverpool) (~8h, 2x daily)
const stenaBelBirTrips = [
  { trip_id: 'ste_bel_bir_1', route_id: 'ste_bel_bir', service_id: 'daily',
    headsign: 'Birkenhead (Liverpool)', ship: 'Stena Edda',
    stops: [{ stop_id: 'belfast', arr: null, dep: '10:30:00' },
            { stop_id: 'birkenhead', arr: '18:30:00', dep: null }] },
  { trip_id: 'ste_bel_bir_2', route_id: 'ste_bel_bir', service_id: 'daily',
    headsign: 'Birkenhead (Liverpool)', ship: 'Stena Embla',
    stops: [{ stop_id: 'belfast', arr: null, dep: '22:30:00' },
            { stop_id: 'birkenhead', arr: '06:30:00', dep: null }] },
  { trip_id: 'ste_bir_bel_1', route_id: 'ste_bir_bel', service_id: 'daily',
    headsign: 'Belfast', ship: 'Stena Edda',
    stops: [{ stop_id: 'birkenhead', arr: null, dep: '10:30:00' },
            { stop_id: 'belfast', arr: '18:30:00', dep: null }] },
  { trip_id: 'ste_bir_bel_2', route_id: 'ste_bir_bel', service_id: 'daily',
    headsign: 'Belfast', ship: 'Stena Embla',
    stops: [{ stop_id: 'birkenhead', arr: null, dep: '22:30:00' },
            { stop_id: 'belfast', arr: '06:30:00', dep: null }] },
];

// Holyhead <-> Dublin (~3h15m, 4x daily)
const stenaHolDubTrips = makeTrips('ste_hol_dub', 'ste_dub_hol', 'daily', 'Stena Adventurer',
  'holyhead', 'dublin', [
    { dep: '02:45:00', arr: '06:00:00', retDep: '03:15:00', retArr: '06:30:00' },
    { dep: '08:55:00', arr: '12:10:00', retDep: '09:25:00', retArr: '12:40:00' },
    { dep: '14:45:00', arr: '18:00:00', retDep: '15:15:00', retArr: '18:30:00' },
    { dep: '20:30:00', arr: '23:45:00', retDep: '21:00:00', retArr: '00:15:00' },
  ]);

// Fishguard <-> Rosslare (~3h30m, 2x daily)
const stenaFisRosTrips = makeTrips('ste_fis_ros', 'ste_ros_fis', 'daily', 'Stena Nordica',
  'fishguard', 'rosslare', [
    { dep: '02:30:00', arr: '06:00:00', retDep: '03:00:00', retArr: '06:30:00' },
    { dep: '14:30:00', arr: '18:00:00', retDep: '15:00:00', retArr: '18:30:00' },
  ]);

// North Sea routes
// Hook of Holland <-> Harwich (~6h30m day / 8h30m night, 2x daily)
const stenaHohHarTrips = [
  { trip_id: 'ste_hoh_har_1', route_id: 'ste_hoh_har', service_id: 'daily',
    headsign: 'Harwich', ship: 'Stena Britannica',
    stops: [{ stop_id: 'hookOfHolland', arr: null, dep: '08:00:00' },
            { stop_id: 'harwich', arr: '14:30:00', dep: null }] },
  { trip_id: 'ste_hoh_har_2', route_id: 'ste_hoh_har', service_id: 'daily',
    headsign: 'Harwich', ship: 'Stena Hollandica',
    stops: [{ stop_id: 'hookOfHolland', arr: null, dep: '22:00:00' },
            { stop_id: 'harwich', arr: '06:30:00', dep: null }] },
  { trip_id: 'ste_har_hoh_1', route_id: 'ste_har_hoh', service_id: 'daily',
    headsign: 'Hook of Holland', ship: 'Stena Britannica',
    stops: [{ stop_id: 'harwich', arr: null, dep: '09:00:00' },
            { stop_id: 'hookOfHolland', arr: '17:30:00', dep: null }] },
  { trip_id: 'ste_har_hoh_2', route_id: 'ste_har_hoh', service_id: 'daily',
    headsign: 'Hook of Holland', ship: 'Stena Hollandica',
    stops: [{ stop_id: 'harwich', arr: null, dep: '23:00:00' },
            { stop_id: 'hookOfHolland', arr: '07:30:00', dep: null }] },
];

// Scandinavia routes
// Gothenburg <-> Frederikshavn (~3h15m, ~6x daily)
const stenaGotFreTrips = makeTrips('ste_got_fre', 'ste_fre_got', 'daily', 'Stena Danica',
  'gothenburg', 'frederikshavn', [
    { dep: '00:15:00', arr: '03:30:00', retDep: '01:00:00', retArr: '04:15:00' },
    { dep: '06:15:00', arr: '09:30:00', retDep: '07:00:00', retArr: '10:15:00' },
    { dep: '10:15:00', arr: '13:30:00', retDep: '11:00:00', retArr: '14:15:00' },
    { dep: '14:15:00', arr: '17:30:00', retDep: '15:00:00', retArr: '18:15:00' },
    { dep: '18:15:00', arr: '21:30:00', retDep: '19:00:00', retArr: '22:15:00' },
    { dep: '22:15:00', arr: '01:30:00', retDep: '23:00:00', retArr: '02:15:00' },
  ]);

// Gothenburg <-> Kiel (~14h overnight)
const stenaGotKieTrips = [
  { trip_id: 'ste_got_kie_1', route_id: 'ste_got_kie', service_id: 'daily',
    headsign: 'Kiel', ship: 'Stena Germanica',
    stops: [{ stop_id: 'gothenburg', arr: null, dep: '19:30:00' },
            { stop_id: 'kiel', arr: '09:00:00', dep: null }] },
  { trip_id: 'ste_kie_got_1', route_id: 'ste_kie_got', service_id: 'daily',
    headsign: 'Gothenburg', ship: 'Stena Scandinavica',
    stops: [{ stop_id: 'kiel', arr: null, dep: '18:45:00' },
            { stop_id: 'gothenburg', arr: '09:15:00', dep: null }] },
];

// Trelleborg <-> Rostock (~5h30m, 3x daily)
const stenaTreRosTrips = makeTrips('ste_tre_ros', 'ste_ros_tre', 'daily', 'Skåne',
  'trelleborg', 'rostock', [
    { dep: '07:30:00', arr: '13:00:00', retDep: '08:00:00', retArr: '13:30:00' },
    { dep: '15:00:00', arr: '20:30:00', retDep: '15:30:00', retArr: '21:00:00' },
    { dep: '22:30:00', arr: '04:00:00', retDep: '23:00:00', retArr: '04:30:00' },
  ]);

// Baltic Sea routes
// Karlskrona <-> Gdynia (~10h30m, 2x daily)
const stenaKarGdyTrips = [
  { trip_id: 'ste_kar_gdy_1', route_id: 'ste_kar_gdy', service_id: 'daily',
    headsign: 'Gdynia', ship: 'Stena Estelle',
    stops: [{ stop_id: 'karlskrona', arr: null, dep: '10:00:00' },
            { stop_id: 'gdynia', arr: '20:30:00', dep: null }] },
  { trip_id: 'ste_kar_gdy_2', route_id: 'ste_kar_gdy', service_id: 'daily',
    headsign: 'Gdynia', ship: 'Stena Ebba',
    stops: [{ stop_id: 'karlskrona', arr: null, dep: '21:30:00' },
            { stop_id: 'gdynia', arr: '08:00:00', dep: null }] },
  { trip_id: 'ste_gdy_kar_1', route_id: 'ste_gdy_kar', service_id: 'daily',
    headsign: 'Karlskrona', ship: 'Stena Estelle',
    stops: [{ stop_id: 'gdynia', arr: null, dep: '09:00:00' },
            { stop_id: 'karlskrona', arr: '19:30:00', dep: null }] },
  { trip_id: 'ste_gdy_kar_2', route_id: 'ste_gdy_kar', service_id: 'daily',
    headsign: 'Karlskrona', ship: 'Stena Ebba',
    stops: [{ stop_id: 'gdynia', arr: null, dep: '21:00:00' },
            { stop_id: 'karlskrona', arr: '07:30:00', dep: null }] },
];

// Nynäshamn <-> Ventspils (~8h30m, 2x daily)
const stenaNynVenTrips = [
  { trip_id: 'ste_nyn_ven_1', route_id: 'ste_nyn_ven', service_id: 'daily',
    headsign: 'Ventspils', ship: 'Stena Baltica',
    stops: [{ stop_id: 'nynashamn', arr: null, dep: '10:00:00' },
            { stop_id: 'ventspils', arr: '18:30:00', dep: null }] },
  { trip_id: 'ste_nyn_ven_2', route_id: 'ste_nyn_ven', service_id: 'daily',
    headsign: 'Ventspils', ship: 'Stena Scandica',
    stops: [{ stop_id: 'nynashamn', arr: null, dep: '22:00:00' },
            { stop_id: 'ventspils', arr: '06:30:00', dep: null }] },
  { trip_id: 'ste_ven_nyn_1', route_id: 'ste_ven_nyn', service_id: 'daily',
    headsign: 'Nynäshamn', ship: 'Stena Baltica',
    stops: [{ stop_id: 'ventspils', arr: null, dep: '11:00:00' },
            { stop_id: 'nynashamn', arr: '19:30:00', dep: null }] },
  { trip_id: 'ste_ven_nyn_2', route_id: 'ste_ven_nyn', service_id: 'daily',
    headsign: 'Nynäshamn', ship: 'Stena Scandica',
    stops: [{ stop_id: 'ventspils', arr: null, dep: '23:00:00' },
            { stop_id: 'nynashamn', arr: '07:30:00', dep: null }] },
];

// Travemünde <-> Liepāja (~19h, 1x daily)
const stenaTraLieTrips = [
  { trip_id: 'ste_tra_lie_1', route_id: 'ste_tra_lie', service_id: 'daily',
    headsign: 'Liepāja', ship: 'Stena Flavia',
    stops: [{ stop_id: 'travemunde', arr: null, dep: '02:00:00' },
            { stop_id: 'liepaja', arr: '21:00:00', dep: null }] },
  { trip_id: 'ste_lie_tra_1', route_id: 'ste_lie_tra', service_id: 'daily',
    headsign: 'Travemünde', ship: 'Stena Horizon',
    stops: [{ stop_id: 'liepaja', arr: null, dep: '01:00:00' },
            { stop_id: 'travemunde', arr: '20:00:00', dep: null }] },
];

// Vaasa <-> Umeå (Wasaline, now Stena Line since Feb 2026) (~4h, 1-2x daily)
const stenaVaaUmeTrips = makeTrips('ste_vaa_ume', 'ste_ume_vaa', 'daily', 'Aurora Botnia',
  'vaasa', 'umea', [
    { dep: '09:00:00', arr: '13:00:00', retDep: '10:00:00', retArr: '14:00:00' },
    { dep: '18:00:00', arr: '22:00:00', retDep: '19:00:00', retArr: '23:00:00' },
  ]);

const stenaRoutes = [
  // Irish Sea
  { route_id: 'ste_bel_cai', short_name: 'BEL-CAI', long_name: 'Belfast - Cairnryan (Stena Line)' },
  { route_id: 'ste_cai_bel', short_name: 'CAI-BEL', long_name: 'Cairnryan - Belfast (Stena Line)' },
  { route_id: 'ste_bel_bir', short_name: 'BEL-BIR', long_name: 'Belfast - Birkenhead (Stena Line)' },
  { route_id: 'ste_bir_bel', short_name: 'BIR-BEL', long_name: 'Birkenhead - Belfast (Stena Line)' },
  { route_id: 'ste_hol_dub', short_name: 'HLY-DUB', long_name: 'Holyhead - Dublin (Stena Line)' },
  { route_id: 'ste_dub_hol', short_name: 'DUB-HLY', long_name: 'Dublin - Holyhead (Stena Line)' },
  { route_id: 'ste_fis_ros', short_name: 'FIS-ROS', long_name: 'Fishguard - Rosslare (Stena Line)' },
  { route_id: 'ste_ros_fis', short_name: 'ROS-FIS', long_name: 'Rosslare - Fishguard (Stena Line)' },
  // North Sea
  { route_id: 'ste_hoh_har', short_name: 'HVH-HAR', long_name: 'Hook of Holland - Harwich (Stena Line)' },
  { route_id: 'ste_har_hoh', short_name: 'HAR-HVH', long_name: 'Harwich - Hook of Holland (Stena Line)' },
  // Scandinavia
  { route_id: 'ste_got_fre', short_name: 'GOT-FDH', long_name: 'Gothenburg - Frederikshavn (Stena Line)' },
  { route_id: 'ste_fre_got', short_name: 'FDH-GOT', long_name: 'Frederikshavn - Gothenburg (Stena Line)' },
  { route_id: 'ste_got_kie', short_name: 'GOT-KEL', long_name: 'Gothenburg - Kiel (Stena Line)' },
  { route_id: 'ste_kie_got', short_name: 'KEL-GOT', long_name: 'Kiel - Gothenburg (Stena Line)' },
  { route_id: 'ste_tre_ros', short_name: 'TRG-RSK', long_name: 'Trelleborg - Rostock (Stena Line)' },
  { route_id: 'ste_ros_tre', short_name: 'RSK-TRG', long_name: 'Rostock - Trelleborg (Stena Line)' },
  // Baltic Sea
  { route_id: 'ste_kar_gdy', short_name: 'KAR-GDY', long_name: 'Karlskrona - Gdynia (Stena Line)' },
  { route_id: 'ste_gdy_kar', short_name: 'GDY-KAR', long_name: 'Gdynia - Karlskrona (Stena Line)' },
  { route_id: 'ste_nyn_ven', short_name: 'NYN-VEN', long_name: 'Nynäshamn - Ventspils (Stena Line)' },
  { route_id: 'ste_ven_nyn', short_name: 'VEN-NYN', long_name: 'Ventspils - Nynäshamn (Stena Line)' },
  { route_id: 'ste_tra_lie', short_name: 'TRV-LPX', long_name: 'Travemünde - Liepāja (Stena Line)' },
  { route_id: 'ste_lie_tra', short_name: 'LPX-TRV', long_name: 'Liepāja - Travemünde (Stena Line)' },
  // Wasaline (Stena acquired Feb 2026)
  { route_id: 'ste_vaa_ume', short_name: 'VAA-UME', long_name: 'Vaasa - Umeå (Stena Line)' },
  { route_id: 'ste_ume_vaa', short_name: 'UME-VAA', long_name: 'Umeå - Vaasa (Stena Line)' },
];

const stenaTrips = [
  ...stenaBelCaiTrips, ...stenaBelBirTrips, ...stenaHolDubTrips, ...stenaFisRosTrips,
  ...stenaHohHarTrips, ...stenaGotFreTrips, ...stenaGotKieTrips, ...stenaTreRosTrips,
  ...stenaKarGdyTrips, ...stenaNynVenTrips, ...stenaTraLieTrips, ...stenaVaaUmeTrips,
];

const stenaStops = {
  belfast: PORTS.belfast, cairnryan: PORTS.cairnryan,
  birkenhead: PORTS.birkenhead, holyhead: PORTS.holyhead,
  dublin: PORTS.dublin, fishguard: PORTS.fishguard, rosslare: PORTS.rosslare,
  hookOfHolland: PORTS.hookOfHolland, harwich: PORTS.harwich,
  gothenburg: PORTS.gothenburg, frederikshavn: PORTS.frederikshavn,
  kiel: PORTS.kiel, trelleborg: PORTS.trelleborg, rostock: PORTS.rostock,
  karlskrona: PORTS.karlskrona, gdynia: PORTS.gdynia,
  nynashamn: PORTS.nynashamn, ventspils: PORTS.ventspils,
  travemunde: PORTS.travemunde, liepaja: PORTS.liepaja,
  vaasa: PORTS.vaasa, umea: PORTS.umea,
};

// =============================================================================
// Build all three feeds
// =============================================================================

console.log('🚢 Generating GTFS feeds for DFDS, P&O Ferries, Stena Line...\n');

buildGTFS(path.join(FEEDS_DIR, 'dfds'), dfdsAgency, dfdsRoutes, dfdsTrips, dfdsStops);
createZip('dfds', 'dfds-gtfs.zip');

buildGTFS(path.join(FEEDS_DIR, 'poferries'), poAgency, poRoutes, poTrips, poStops);
createZip('poferries', 'poferries-gtfs.zip');

buildGTFS(path.join(FEEDS_DIR, 'stenaline'), stenaAgency, stenaRoutes, stenaTrips, stenaStops);
createZip('stenaline', 'stenaline-gtfs.zip');

// =============================================================================
// Summary
// =============================================================================
console.log('\n📊 GTFS Feed Summary:');
console.log('═══════════════════════════════════════');
console.log('DFDS Seaways:');
console.log(`  Routes: ${dfdsRoutes.length} | Trips/day: ${dfdsTrips.length} | Stops: ${Object.keys(dfdsStops).length}`);
console.log('  Files: feeds/dfds/ + feeds/dfds-gtfs.zip');
console.log('');
console.log('P&O Ferries:');
console.log(`  Routes: ${poRoutes.length} | Trips/day: ${poTrips.length} | Stops: ${Object.keys(poStops).length}`);
console.log('  Files: feeds/poferries/ + feeds/poferries-gtfs.zip');
console.log('');
console.log('Stena Line:');
console.log(`  Routes: ${stenaRoutes.length} | Trips/day: ${stenaTrips.length} | Stops: ${Object.keys(stenaStops).length}`);
console.log('  Files: feeds/stenaline/ + feeds/stenaline-gtfs.zip');
console.log('═══════════════════════════════════════');
console.log('\n✨ Done! All GTFS feeds generated in feeds/ directory.');
