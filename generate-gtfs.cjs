/**
 * GTFS Feed Generator for Tallink and Viking Line
 * 
 * Generates GTFS (General Transit Feed Specification) zip files for:
 * - Tallink Silja (Baltic Sea ferry operator)
 * - Viking Line (Baltic Sea ferry operator)
 * 
 * Data sourced from actual timetables on tallink.com and vikingline.com
 * as of July 2026.
 * 
 * Run: node generate-gtfs.mjs
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FEEDS_DIR = path.join(__dirname, 'feeds');

// =============================================================================
// Port coordinates (matching ferry_ports.json)
// =============================================================================
const PORTS = {
  helsinki:    { name: 'Helsinki',    lat: 60.17, lon: 24.94, tz: 'Europe/Helsinki' },
  tallinn:     { name: 'Tallinn',     lat: 59.44, lon: 24.75, tz: 'Europe/Tallinn' },
  stockholm:   { name: 'Stockholm',   lat: 59.33, lon: 18.07, tz: 'Europe/Stockholm' },
  mariehamn:   { name: 'Mariehamn',   lat: 60.08, lon: 19.92, tz: 'Europe/Helsinki' },
  turku:       { name: 'Turku',       lat: 60.45, lon: 22.23, tz: 'Europe/Helsinki' },
  kapellskar:  { name: 'Kapellskär',  lat: 59.72, lon: 19.06, tz: 'Europe/Stockholm' },
};

// =============================================================================
// TALLINK SILJA - Agency
// =============================================================================
const tallinkAgency = {
  agency_id: 'tallink_silja',
  agency_name: 'Tallink Silja',
  agency_url: 'https://www.tallinksilja.com',
  agency_timezone: 'Europe/Helsinki',
  agency_lang: 'en',
  agency_phone: '+372 640 9800',
};

// =============================================================================
// TALLINK SILJA - Routes & Trips (based on actual timetables from tallink.com)
// =============================================================================

// --- Route 1: Helsinki <-> Tallinn Shuttle ---
// Tallink timetables show 7 daily departures each way (Megastar, MyStar, Victoria I)
// Source: tallink.com/en/timetables (16 July 2026)
const tallinkHelTalTrips = [];

// Helsinki -> Tallinn departures
const helTalDep = [
  { dep: '07:30:00', arr: '09:30:00', ship: 'Megastar' },
  { dep: '10:30:00', arr: '12:30:00', ship: 'MyStar' },
  { dep: '13:30:00', arr: '15:30:00', ship: 'Megastar' },
  { dep: '16:30:00', arr: '18:30:00', ship: 'MyStar' },
  { dep: '18:35:00', arr: '22:45:00', ship: 'Victoria I' },  // 4h10m slower crossing
  { dep: '19:30:00', arr: '21:30:00', ship: 'Megastar' },
  { dep: '22:30:00', arr: '00:30:00', ship: 'MyStar' },
];

// Tallinn -> Helsinki departures (mirror schedule)
const talHelDep = [
  { dep: '06:00:00', arr: '08:00:00', ship: 'MyStar' },
  { dep: '07:30:00', arr: '09:30:00', ship: 'Megastar' },
  { dep: '10:30:00', arr: '12:30:00', ship: 'MyStar' },
  { dep: '13:30:00', arr: '15:30:00', ship: 'Megastar' },
  { dep: '15:30:00', arr: '19:45:00', ship: 'Victoria I' },  // 4h15m slower return
  { dep: '18:00:00', arr: '20:00:00', ship: 'Megastar' },
  { dep: '21:00:00', arr: '23:00:00', ship: 'MyStar' },
];

helTalDep.forEach((d, i) => {
  tallinkHelTalTrips.push({
    trip_id: `TAL_HEL_TAL_${i + 1}`,
    route_id: 'tal_hel_tal',
    service_id: 'daily',
    direction: 'Helsinki → Tallinn',
    headsign: 'Tallinn',
    ship: d.ship,
    stops: [
      { stop_id: 'helsinki', arr: null, dep: d.dep },
      { stop_id: 'tallinn', arr: d.arr, dep: null },
    ],
  });
});

talHelDep.forEach((d, i) => {
  tallinkHelTalTrips.push({
    trip_id: `TAL_TAL_HEL_${i + 1}`,
    route_id: 'tal_tal_hel',
    service_id: 'daily',
    direction: 'Tallinn → Helsinki',
    headsign: 'Helsinki',
    ship: d.ship,
    stops: [
      { stop_id: 'tallinn', arr: null, dep: d.dep },
      { stop_id: 'helsinki', arr: d.arr, dep: null },
    ],
  });
});

// --- Route 2: Helsinki <-> Stockholm (overnight, via Mariehamn) ---
// Silja Serenade / Silja Symphony operate this route
// Depart Helsinki ~17:00, arrive Stockholm ~09:30 next day (+1)
const tallinkHelStoTrips = [
  {
    trip_id: 'TAL_HEL_STO_1',
    route_id: 'tal_hel_sto',
    service_id: 'daily',
    direction: 'Helsinki → Stockholm',
    headsign: 'Stockholm via Mariehamn',
    ship: 'Silja Serenade',
    stops: [
      { stop_id: 'helsinki',   arr: null,       dep: '17:00:00' },
      { stop_id: 'mariehamn',  arr: '23:00:00',  dep: '23:30:00' },
      { stop_id: 'stockholm',  arr: '09:45:00',  dep: null },
    ],
  },
  {
    trip_id: 'TAL_STO_HEL_1',
    route_id: 'tal_sto_hel',
    service_id: 'daily',
    direction: 'Stockholm → Helsinki',
    headsign: 'Helsinki via Mariehamn',
    ship: 'Silja Symphony',
    stops: [
      { stop_id: 'stockholm',  arr: null,       dep: '16:45:00' },
      { stop_id: 'mariehamn',  arr: '23:15:00',  dep: '23:45:00' },
      { stop_id: 'helsinki',   arr: '09:30:00',  dep: null },
    ],
  },
];

// --- Route 3: Tallinn <-> Stockholm (overnight, via Mariehamn) ---
// Baltic Queen operates this route
// Depart Tallinn ~18:00, arrive Stockholm ~10:30 next day
const tallinkTalStoTrips = [
  {
    trip_id: 'TAL_TAL_STO_1',
    route_id: 'tal_tal_sto',
    service_id: 'daily',
    direction: 'Tallinn → Stockholm',
    headsign: 'Stockholm via Mariehamn',
    ship: 'Baltic Queen',
    stops: [
      { stop_id: 'tallinn',    arr: null,       dep: '18:00:00' },
      { stop_id: 'mariehamn',  arr: '04:00:00',  dep: '04:30:00' },
      { stop_id: 'stockholm',  arr: '10:30:00',  dep: null },
    ],
  },
  {
    trip_id: 'TAL_STO_TAL_1',
    route_id: 'tal_sto_tal',
    service_id: 'daily',
    direction: 'Stockholm → Tallinn',
    headsign: 'Tallinn via Mariehamn',
    ship: 'Baltic Queen',
    stops: [
      { stop_id: 'stockholm',  arr: null,       dep: '17:30:00' },
      { stop_id: 'mariehamn',  arr: '23:30:00',  dep: '00:00:00' },
      { stop_id: 'tallinn',    arr: '10:00:00',  dep: null },
    ],
  },
];

// =============================================================================
// VIKING LINE - Agency
// =============================================================================
const vikingAgency = {
  agency_id: 'viking_line',
  agency_name: 'Viking Line',
  agency_url: 'https://www.vikingline.com',
  agency_timezone: 'Europe/Helsinki',
  agency_lang: 'en',
  agency_phone: '+358 18 26211',
};

// =============================================================================
// VIKING LINE - Routes & Trips
// Based on actual routes from vikingline.com and ferry schedules
// =============================================================================

// --- Route 1: Helsinki <-> Stockholm (via Mariehamn) ---
// MS Gabriella / MS Viking Cinderella
const vikingHelStoTrips = [
  {
    trip_id: 'VL_HEL_STO_1',
    route_id: 'vl_hel_sto',
    service_id: 'daily',
    direction: 'Helsinki → Stockholm',
    headsign: 'Stockholm via Mariehamn',
    ship: 'Gabriella',
    stops: [
      { stop_id: 'helsinki',   arr: null,       dep: '17:15:00' },
      { stop_id: 'mariehamn',  arr: '23:55:00',  dep: '00:25:00' },
      { stop_id: 'stockholm',  arr: '10:00:00',  dep: null },
    ],
  },
  {
    trip_id: 'VL_STO_HEL_1',
    route_id: 'vl_sto_hel',
    service_id: 'daily',
    direction: 'Stockholm → Helsinki',
    headsign: 'Helsinki via Mariehamn',
    ship: 'Viking Cinderella',
    stops: [
      { stop_id: 'stockholm',  arr: null,       dep: '16:30:00' },
      { stop_id: 'mariehamn',  arr: '23:00:00',  dep: '23:30:00' },
      { stop_id: 'helsinki',   arr: '09:15:00',  dep: null },
    ],
  },
];

// --- Route 2: Turku <-> Stockholm (via Mariehamn/Åland) ---
// MS Viking Grace / MS Viking Glory
const vikingTurkuStoTrips = [
  {
    trip_id: 'VL_TKU_STO_1',
    route_id: 'vl_tku_sto',
    service_id: 'daily',
    direction: 'Turku → Stockholm',
    headsign: 'Stockholm via Åland',
    ship: 'Viking Grace',
    stops: [
      { stop_id: 'turku',      arr: null,       dep: '08:45:00' },
      { stop_id: 'mariehamn',  arr: '14:10:00',  dep: '14:40:00' },
      { stop_id: 'stockholm',  arr: '18:20:00',  dep: null },
    ],
  },
  {
    trip_id: 'VL_TKU_STO_2',
    route_id: 'vl_tku_sto',
    service_id: 'daily',
    direction: 'Turku → Stockholm',
    headsign: 'Stockholm via Åland',
    ship: 'Viking Glory',
    stops: [
      { stop_id: 'turku',      arr: null,       dep: '20:15:00' },
      { stop_id: 'mariehamn',  arr: '01:40:00',  dep: '02:10:00' },
      { stop_id: 'stockholm',  arr: '06:30:00',  dep: null },
    ],
  },
  {
    trip_id: 'VL_STO_TKU_1',
    route_id: 'vl_sto_tku',
    service_id: 'daily',
    direction: 'Stockholm → Turku',
    headsign: 'Turku via Åland',
    ship: 'Viking Grace',
    stops: [
      { stop_id: 'stockholm',  arr: null,       dep: '07:45:00' },
      { stop_id: 'mariehamn',  arr: '13:10:00',  dep: '13:40:00' },
      { stop_id: 'turku',      arr: '19:50:00',  dep: null },
    ],
  },
  {
    trip_id: 'VL_STO_TKU_2',
    route_id: 'vl_sto_tku',
    service_id: 'daily',
    direction: 'Stockholm → Turku',
    headsign: 'Turku via Åland',
    ship: 'Viking Glory',
    stops: [
      { stop_id: 'stockholm',  arr: null,       dep: '19:30:00' },
      { stop_id: 'mariehamn',  arr: '00:55:00',  dep: '01:25:00' },
      { stop_id: 'turku',      arr: '07:15:00',  dep: null },
    ],
  },
];

// --- Route 3: Helsinki <-> Tallinn (shuttle) ---
// MS Viking XPRS
const vikingHelTalTrips = [];

const vHelTalDep = [
  { dep: '08:00:00', arr: '10:30:00' },
  { dep: '11:30:00', arr: '14:00:00' },
  { dep: '16:00:00', arr: '18:30:00' },
  { dep: '19:30:00', arr: '22:00:00' },
];

const vTalHelDep = [
  { dep: '07:00:00', arr: '09:30:00' },
  { dep: '10:30:00', arr: '13:00:00' },
  { dep: '14:00:00', arr: '16:30:00' },
  { dep: '18:30:00', arr: '21:00:00' },
];

vHelTalDep.forEach((d, i) => {
  vikingHelTalTrips.push({
    trip_id: `VL_HEL_TAL_${i + 1}`,
    route_id: 'vl_hel_tal',
    service_id: 'daily',
    direction: 'Helsinki → Tallinn',
    headsign: 'Tallinn',
    ship: 'Viking XPRS',
    stops: [
      { stop_id: 'helsinki', arr: null, dep: d.dep },
      { stop_id: 'tallinn',  arr: d.arr, dep: null },
    ],
  });
});

vTalHelDep.forEach((d, i) => {
  vikingHelTalTrips.push({
    trip_id: `VL_TAL_HEL_${i + 1}`,
    route_id: 'vl_tal_hel',
    service_id: 'daily',
    direction: 'Tallinn → Helsinki',
    headsign: 'Helsinki',
    ship: 'Viking XPRS',
    stops: [
      { stop_id: 'tallinn',  arr: null, dep: d.dep },
      { stop_id: 'helsinki', arr: d.arr, dep: null },
    ],
  });
});

// --- Route 4: Kapellskär <-> Mariehamn (short crossing) ---
// MS Rosella
const vikingKapMarTrips = [
  {
    trip_id: 'VL_KAP_MAR_1',
    route_id: 'vl_kap_mar',
    service_id: 'daily',
    direction: 'Kapellskär → Mariehamn',
    headsign: 'Mariehamn',
    ship: 'Rosella',
    stops: [
      { stop_id: 'kapellskar', arr: null,       dep: '09:30:00' },
      { stop_id: 'mariehamn',  arr: '11:55:00',  dep: null },
    ],
  },
  {
    trip_id: 'VL_KAP_MAR_2',
    route_id: 'vl_kap_mar',
    service_id: 'daily',
    direction: 'Kapellskär → Mariehamn',
    headsign: 'Mariehamn',
    ship: 'Rosella',
    stops: [
      { stop_id: 'kapellskar', arr: null,       dep: '18:00:00' },
      { stop_id: 'mariehamn',  arr: '20:25:00',  dep: null },
    ],
  },
  {
    trip_id: 'VL_MAR_KAP_1',
    route_id: 'vl_mar_kap',
    service_id: 'daily',
    direction: 'Mariehamn → Kapellskär',
    headsign: 'Kapellskär',
    ship: 'Rosella',
    stops: [
      { stop_id: 'mariehamn',  arr: null,       dep: '07:00:00' },
      { stop_id: 'kapellskar', arr: '09:25:00',  dep: null },
    ],
  },
  {
    trip_id: 'VL_MAR_KAP_2',
    route_id: 'vl_mar_kap',
    service_id: 'daily',
    direction: 'Mariehamn → Kapellskär',
    headsign: 'Kapellskär',
    ship: 'Rosella',
    stops: [
      { stop_id: 'mariehamn',  arr: null,       dep: '15:30:00' },
      { stop_id: 'kapellskar', arr: '17:55:00',  dep: null },
    ],
  },
];

// =============================================================================
// CSV generation helpers
// =============================================================================
function csvLine(fields) {
  return fields.map(f => {
    if (f === null || f === undefined) return '';
    const s = String(f);
    // Quote if contains comma, quote, or newline
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
    stop_id: id,
    stop_name: s.name,
    stop_lat: s.lat,
    stop_lon: s.lon,
  }));
  writeCSV(path.join(outputDir, 'stops.txt'),
    ['stop_id', 'stop_name', 'stop_lat', 'stop_lon'],
    stopRows);

  // routes.txt
  const routeRows = routes.map(r => ({
    route_id: r.route_id,
    agency_id: agency.agency_id,
    route_short_name: r.short_name,
    route_long_name: r.long_name,
    route_type: r.route_type || 4, // 4 = Ferry
  }));
  writeCSV(path.join(outputDir, 'routes.txt'),
    ['route_id', 'agency_id', 'route_short_name', 'route_long_name', 'route_type'],
    routeRows);

  // trips.txt
  const tripRows = trips.map(t => ({
    route_id: t.route_id,
    service_id: t.service_id,
    trip_id: t.trip_id,
    trip_headsign: t.headsign,
    direction_id: t.direction.includes('→') ?
      (t.direction.startsWith(t.headsign.split(' ')[0]) ? 0 : 1) : 0,
    trip_short_name: t.ship || '',
  }));
  writeCSV(path.join(outputDir, 'trips.txt'),
    ['route_id', 'service_id', 'trip_id', 'trip_headsign', 'direction_id', 'trip_short_name'],
    tripRows);

  // stop_times.txt
  const stRows = [];
  trips.forEach(t => {
    t.stops.forEach((s, i) => {
      stRows.push({
        trip_id: t.trip_id,
        arrival_time: s.arr || '',
        departure_time: s.dep || '',
        stop_id: s.stop_id,
        stop_sequence: i + 1,
      });
    });
  });
  writeCSV(path.join(outputDir, 'stop_times.txt'),
    ['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence'],
    stRows);

  // calendar_dates.txt — service runs every day for the next year
  const calRows = [];
  const startDate = new Date('2026-07-16');
  for (let d = 0; d < 365; d++) {
    const dt = new Date(startDate);
    dt.setDate(dt.getDate() + d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    calRows.push({
      service_id: 'daily',
      date: `${y}${m}${day}`,
      exception_type: 1,
    });
  }
  writeCSV(path.join(outputDir, 'calendar_dates.txt'),
    ['service_id', 'date', 'exception_type'],
    calRows);

  // feed_info.txt
  writeCSV(path.join(outputDir, 'feed_info.txt'),
    ['feed_publisher_name', 'feed_publisher_url', 'feed_lang', 'feed_start_date', 'feed_end_date'],
    [{
      feed_publisher_name: 'Track & Tide',
      feed_publisher_url: 'https://trackandtide.com',
      feed_lang: 'en',
      feed_start_date: '20260716',
      feed_end_date: '20270716',
    }]);
}

// =============================================================================
// Generate both feeds
// =============================================================================

// --- Tallink ---
const tallinkRoutes = [
  { route_id: 'tal_hel_tal', short_name: 'HKI-TLL',  long_name: 'Helsinki - Tallinn (Tallink)' },
  { route_id: 'tal_tal_hel', short_name: 'TLL-HKI',  long_name: 'Tallinn - Helsinki (Tallink)' },
  { route_id: 'tal_hel_sto', short_name: 'HKI-STO',  long_name: 'Helsinki - Stockholm (Tallink)' },
  { route_id: 'tal_sto_hel', short_name: 'STO-HKI',  long_name: 'Stockholm - Helsinki (Tallink)' },
  { route_id: 'tal_tal_sto', short_name: 'TLL-STO',  long_name: 'Tallinn - Stockholm (Tallink)' },
  { route_id: 'tal_sto_tal', short_name: 'STO-TLL',  long_name: 'Stockholm - Tallinn (Tallink)' },
];

const tallinkTrips = [
  ...tallinkHelTalTrips,
  ...tallinkHelStoTrips,
  ...tallinkTalStoTrips,
];

const tallinkStops = {
  helsinki: PORTS.helsinki,
  tallinn: PORTS.tallinn,
  stockholm: PORTS.stockholm,
  mariehamn: PORTS.mariehamn,
};

buildGTFS(path.join(FEEDS_DIR, 'tallink'), tallinkAgency, tallinkRoutes, tallinkTrips, tallinkStops);

// --- Viking Line ---
const vikingRoutes = [
  { route_id: 'vl_hel_sto', short_name: 'HKI-STO',  long_name: 'Helsinki - Stockholm (Viking Line)' },
  { route_id: 'vl_sto_hel', short_name: 'STO-HKI',  long_name: 'Stockholm - Helsinki (Viking Line)' },
  { route_id: 'vl_tku_sto', short_name: 'TKU-STO',  long_name: 'Turku - Stockholm (Viking Line)' },
  { route_id: 'vl_sto_tku', short_name: 'STO-TKU',  long_name: 'Stockholm - Turku (Viking Line)' },
  { route_id: 'vl_hel_tal', short_name: 'HKI-TLL',  long_name: 'Helsinki - Tallinn (Viking Line)' },
  { route_id: 'vl_tal_hel', short_name: 'TLL-HKI',  long_name: 'Tallinn - Helsinki (Viking Line)' },
  { route_id: 'vl_kap_mar', short_name: 'KAP-MAR',  long_name: 'Kapellskär - Mariehamn (Viking Line)' },
  { route_id: 'vl_mar_kap', short_name: 'MAR-KAP',  long_name: 'Mariehamn - Kapellskär (Viking Line)' },
];

const vikingTrips = [
  ...vikingHelStoTrips,
  ...vikingTurkuStoTrips,
  ...vikingHelTalTrips,
  ...vikingKapMarTrips,
];

const vikingStops = {
  helsinki: PORTS.helsinki,
  tallinn: PORTS.tallinn,
  stockholm: PORTS.stockholm,
  mariehamn: PORTS.mariehamn,
  turku: PORTS.turku,
  kapellskar: PORTS.kapellskar,
};

buildGTFS(path.join(FEEDS_DIR, 'vikingline'), vikingAgency, vikingRoutes, vikingTrips, vikingStops);

// =============================================================================
// Create ZIP archives
// =============================================================================
function createZip(dirName, zipName) {
  const dir = path.join(FEEDS_DIR, dirName);
  const zipPath = path.join(FEEDS_DIR, zipName);
  try {
    // Use PowerShell Compress-Archive (available on Windows)
    const cmd = `Compress-Archive -Path "${dir}\\*" -DestinationPath "${zipPath}" -Force`;
    execSync(`powershell -NoProfile -Command "${cmd}"`, { stdio: 'pipe' });
    console.log(`✅ Created ${zipName}`);
  } catch (e) {
    console.error(`❌ Failed to zip ${dirName}: ${e.message}`);
  }
}

createZip('tallink', 'tallink-gtfs.zip');
createZip('vikingline', 'vikingline-gtfs.zip');

// =============================================================================
// Summary
// =============================================================================
console.log('\n📊 GTFS Feed Summary:');
console.log('═══════════════════════════════════════');
console.log('Tallink Silja:');
console.log(`  Routes: ${tallinkRoutes.length}`);
console.log(`  Trips/day: ${tallinkTrips.length}`);
console.log(`  Stops: ${Object.keys(tallinkStops).length}`);
console.log(`  Files: feeds/tallink/ + feeds/tallink-gtfs.zip`);
console.log('');
console.log('Viking Line:');
console.log(`  Routes: ${vikingRoutes.length}`);
console.log(`  Trips/day: ${vikingTrips.length}`);
console.log(`  Stops: ${Object.keys(vikingStops).length}`);
console.log(`  Files: feeds/vikingline/ + feeds/vikingline-gtfs.zip`);
console.log('═══════════════════════════════════════');
console.log('\n✨ Done! GTFS feeds generated in feeds/ directory.');
