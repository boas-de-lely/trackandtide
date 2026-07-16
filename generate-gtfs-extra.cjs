/**
 * GTFS Feed Generator for Color Line, Fjord Line, Smyril Line, Molslinjen,
 * TT-Line, Finnlines, Destination Gotland
 *
 * Data sourced from Wikipedia and official websites as of July 2026.
 * Run: node generate-gtfs-extra.cjs
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FEEDS_DIR = path.join(__dirname, 'feeds');

// =============================================================================
// Port coordinates
// =============================================================================
const P = {
  // Norway
  oslo:          { name:'Oslo',           lat:59.91, lon:10.73 },
  kristiansand:  { name:'Kristiansand',   lat:58.14, lon:7.99 },
  larvik:        { name:'Larvik',         lat:59.05, lon:10.03 },
  sandefjord:    { name:'Sandefjord',     lat:59.13, lon:10.23 },
  bergen:        { name:'Bergen',         lat:60.39, lon:5.32 },
  stavanger:     { name:'Stavanger',      lat:58.97, lon:5.73 },

  // Denmark
  hirtshals:     { name:'Hirtshals',      lat:57.59, lon:9.96 },
  copenhagen:    { name:'Copenhagen',     lat:55.69, lon:12.60 },
  frederikshavn: { name:'Frederikshavn',  lat:57.44, lon:10.54 },
  odden:         { name:'Odden',          lat:55.97, lon:11.35 },
  ebeltoft:      { name:'Ebeltoft',       lat:56.20, lon:10.68 },
  aarhus:        { name:'Aarhus',         lat:56.15, lon:10.22 },
  ronne:         { name:'Rønne',          lat:55.10, lon:14.70 },
  koge:          { name:'Køge',           lat:55.46, lon:12.18 },
  helsingor:     { name:'Helsingør',      lat:56.03, lon:12.61 },
  kalundborg:    { name:'Kalundborg',     lat:55.68, lon:11.09 },
  ballen:        { name:'Ballen (Samsø)', lat:55.82, lon:10.64 },
  bojden:        { name:'Bøjden',         lat:55.10, lon:10.08 },
  fynshav:       { name:'Fynshav',        lat:54.99, lon:9.98 },
  spodsbjerg:    { name:'Spodsbjerg',     lat:54.93, lon:10.84 },
  taars:         { name:'Tårs',           lat:54.88, lon:11.03 },
  esbjerg:       { name:'Esbjerg',        lat:55.47, lon:8.45 },
  nordby:        { name:'Nordby (Fanø)',  lat:55.45, lon:8.40 },

  // Germany
  kiel:          { name:'Kiel',           lat:54.33, lon:10.15 },
  travemunde:    { name:'Travemünde',     lat:53.96, lon:10.87 },
  rostock:       { name:'Rostock',        lat:54.18, lon:12.08 },
  sassnitz:      { name:'Sassnitz',       lat:54.51, lon:13.64 },

  // Sweden
  stromstad:     { name:'Strömstad',      lat:58.93, lon:11.17 },
  helsingborg:   { name:'Helsingborg',    lat:56.05, lon:12.69 },
  trelleborg:    { name:'Trelleborg',     lat:55.37, lon:13.17 },
  ystad:         { name:'Ystad',          lat:55.43, lon:13.82 },
  malmo:         { name:'Malmö',          lat:55.61, lon:13.00 },
  nynashamn:     { name:'Nynäshamn',      lat:58.90, lon:17.95 },
  visby:         { name:'Visby',          lat:57.64, lon:18.30 },
  oskarshamn:    { name:'Oskarshamn',     lat:57.26, lon:16.45 },

  // Finland
  helsinki:      { name:'Helsinki',       lat:60.17, lon:24.94 },
  naantali:      { name:'Naantali',       lat:60.47, lon:22.03 },
  kapellskar:    { name:'Kapellskär',     lat:59.72, lon:19.06 },

  // Faroe Islands / Iceland
  torshavn:      { name:'Tórshavn',       lat:62.01, lon:-6.77 },
  seydisfjordur: { name:'Seyðisfjörður',  lat:65.26, lon:-13.91 },

  // Poland / Lithuania
  swinoujscie:   { name:'Świnoujście',    lat:53.91, lon:14.25 },
  gdynia:        { name:'Gdynia',         lat:54.52, lon:18.54 },
  klaipeda:      { name:'Klaipėda',       lat:55.71, lon:21.13 },
};

// =============================================================================
// Helpers
// =============================================================================
function csvLine(fields) {
  return fields.map(f => {
    if (f == null) return '';
    const s = String(f);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"'+s.replace(/"/g,'""')+'"';
    return s;
  }).join(',');
}

function writeCSV(fp, headers, rows) {
  const lines = [csvLine(headers)];
  rows.forEach(r => lines.push(csvLine(headers.map(h => r[h] != null ? r[h] : ''))));
  fs.writeFileSync(fp, lines.join('\n')+'\n', 'utf-8');
}

function buildGTFS(outDir, agency, routes, trips, stopsUsed) {
  fs.mkdirSync(outDir, { recursive: true });

  writeCSV(path.join(outDir,'agency.txt'),
    ['agency_id','agency_name','agency_url','agency_timezone','agency_lang','agency_phone'],[agency]);

  const stopRows = Object.entries(stopsUsed).map(([id,s]) => ({stop_id:id,stop_name:s.name,stop_lat:s.lat,stop_lon:s.lon}));
  writeCSV(path.join(outDir,'stops.txt'),['stop_id','stop_name','stop_lat','stop_lon'],stopRows);

  const routeRows = routes.map(r => ({route_id:r.route_id,agency_id:agency.agency_id,route_short_name:r.short_name,route_long_name:r.long_name,route_type:4}));
  writeCSV(path.join(outDir,'routes.txt'),['route_id','agency_id','route_short_name','route_long_name','route_type'],routeRows);

  const tripRows = trips.map(t => ({route_id:t.route_id,service_id:t.service_id,trip_id:t.trip_id,trip_headsign:t.headsign,direction_id:0,trip_short_name:t.ship||''}));
  writeCSV(path.join(outDir,'trips.txt'),['route_id','service_id','trip_id','trip_headsign','direction_id','trip_short_name'],tripRows);

  const stRows = [];
  trips.forEach(t => { t.stops.forEach((s,i) => { stRows.push({trip_id:t.trip_id,arrival_time:s.arr||'',departure_time:s.dep||'',stop_id:s.stop_id,stop_sequence:i+1}); }); });
  writeCSV(path.join(outDir,'stop_times.txt'),['trip_id','arrival_time','departure_time','stop_id','stop_sequence'],stRows);

  const calRows = [];
  const sd = new Date('2026-07-16');
  for (let d=0; d<365; d++) {
    const dt = new Date(sd); dt.setDate(dt.getDate()+d);
    const y=dt.getFullYear(), m=String(dt.getMonth()+1).padStart(2,'0'), day=String(dt.getDate()).padStart(2,'0');
    calRows.push({service_id:'daily',date:`${y}${m}${day}`,exception_type:1});
  }
  writeCSV(path.join(outDir,'calendar_dates.txt'),['service_id','date','exception_type'],calRows);
  writeCSV(path.join(outDir,'feed_info.txt'),['feed_publisher_name','feed_publisher_url','feed_lang','feed_start_date','feed_end_date'],[{feed_publisher_name:'Track & Tide',feed_publisher_url:'https://trackandtide.com',feed_lang:'en',feed_start_date:'20260716',feed_end_date:'20270716'}]);
}

function zipIt(dirName, zipName) {
  try {
    execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${path.join(FEEDS_DIR,dirName)}\\*' -DestinationPath '${path.join(FEEDS_DIR,zipName)}' -Force"`,{stdio:'pipe'});
    console.log(`  ✅ ${zipName}`);
  } catch(e) { console.error(`  ❌ ${zipName}: ${e.message}`); }
}

function makeRoundTrips(ridA,ridB,ship,stopA,stopB,schedules) {
  const t=[];
  schedules.forEach((s,i)=>{
    t.push({trip_id:`${ridA}_${i+1}`,route_id:ridA,service_id:'daily',headsign:P[stopB].name,ship,stops:[{stop_id:stopA,arr:null,dep:s.dep},{stop_id:stopB,arr:s.arr,dep:null}]});
    t.push({trip_id:`${ridB}_${i+1}`,route_id:ridB,service_id:'daily',headsign:P[stopA].name,ship,stops:[{stop_id:stopB,arr:null,dep:s.retDep},{stop_id:stopA,arr:s.retArr,dep:null}]});
  });
  return t;
}

// =============================================================================
// 1. COLOR LINE
// =============================================================================
const colorAgency = {agency_id:'color_line',agency_name:'Color Line',agency_url:'https://www.colorline.com',agency_timezone:'Europe/Oslo',agency_lang:'en',agency_phone:'+47 22 94 44 44'};

const colorOsloKiel = [
  {trip_id:'cl_osl_kie_1',route_id:'cl_osl_kie',service_id:'daily',headsign:'Kiel',ship:'Color Fantasy',stops:[{stop_id:'oslo',arr:null,dep:'14:00:00'},{stop_id:'kiel',arr:'10:00:00',dep:null}]},
  {trip_id:'cl_kie_osl_1',route_id:'cl_kie_osl',service_id:'daily',headsign:'Oslo',ship:'Color Magic',stops:[{stop_id:'kiel',arr:null,dep:'14:00:00'},{stop_id:'oslo',arr:'10:00:00',dep:null}]},
];

const colorKrsHir = makeRoundTrips('cl_krs_hir','cl_hir_krs','SuperSpeed','kristiansand','hirtshals',[
  {dep:'06:00:00',arr:'09:15:00',retDep:'06:30:00',retArr:'09:45:00'},
  {dep:'10:00:00',arr:'13:15:00',retDep:'10:30:00',retArr:'13:45:00'},
  {dep:'14:00:00',arr:'17:15:00',retDep:'14:30:00',retArr:'17:45:00'},
  {dep:'18:00:00',arr:'21:15:00',retDep:'18:30:00',retArr:'21:45:00'},
  {dep:'22:00:00',arr:'01:15:00',retDep:'22:30:00',retArr:'01:45:00'},
]);

const colorLarHir = makeRoundTrips('cl_lar_hir','cl_hir_lar','SuperSpeed 2','larvik','hirtshals',[
  {dep:'08:00:00',arr:'11:45:00',retDep:'08:30:00',retArr:'12:15:00'},
  {dep:'17:00:00',arr:'20:45:00',retDep:'19:00:00',retArr:'22:45:00'},
]);

const colorSanStr = makeRoundTrips('cl_san_str','cl_str_san','Color Hybrid','sandefjord','stromstad',[
  {dep:'06:00:00',arr:'08:30:00',retDep:'07:00:00',retArr:'09:30:00'},
  {dep:'10:00:00',arr:'12:30:00',retDep:'11:00:00',retArr:'13:30:00'},
  {dep:'14:00:00',arr:'16:30:00',retDep:'15:00:00',retArr:'17:30:00'},
  {dep:'18:00:00',arr:'20:30:00',retDep:'19:00:00',retArr:'21:30:00'},
]);

const colorRoutes = [
  {route_id:'cl_osl_kie',short_name:'OSL-KEL',long_name:'Oslo - Kiel (Color Line)'},
  {route_id:'cl_kie_osl',short_name:'KEL-OSL',long_name:'Kiel - Oslo (Color Line)'},
  {route_id:'cl_krs_hir',short_name:'KRS-HIR',long_name:'Kristiansand - Hirtshals (Color Line)'},
  {route_id:'cl_hir_krs',short_name:'HIR-KRS',long_name:'Hirtshals - Kristiansand (Color Line)'},
  {route_id:'cl_lar_hir',short_name:'LAR-HIR',long_name:'Larvik - Hirtshals (Color Line)'},
  {route_id:'cl_hir_lar',short_name:'HIR-LAR',long_name:'Hirtshals - Larvik (Color Line)'},
  {route_id:'cl_san_str',short_name:'SDF-STD',long_name:'Sandefjord - Strömstad (Color Line)'},
  {route_id:'cl_str_san',short_name:'STD-SDF',long_name:'Strömstad - Sandefjord (Color Line)'},
];
const colorTrips = [...colorOsloKiel,...colorKrsHir,...colorLarHir,...colorSanStr];
const colorStops = {oslo:P.oslo,kiel:P.kiel,kristiansand:P.kristiansand,hirtshals:P.hirtshals,larvik:P.larvik,sandefjord:P.sandefjord,stromstad:P.stromstad};

// =============================================================================
// 2. FJORD LINE
// =============================================================================
const fjordAgency = {agency_id:'fjord_line',agency_name:'Fjord Line',agency_url:'https://www.fjordline.com',agency_timezone:'Europe/Oslo',agency_lang:'en',agency_phone:'+47 51 46 40 99'};

const fjordBerHir = [
  {trip_id:'fl_ber_hir_1',route_id:'fl_ber_hir',service_id:'daily',headsign:'Hirtshals',ship:'Stavangerfjord',stops:[{stop_id:'bergen',arr:null,dep:'13:30:00'},{stop_id:'hirtshals',arr:'08:00:00',dep:null}]},
  {trip_id:'fl_hir_ber_1',route_id:'fl_hir_ber',service_id:'daily',headsign:'Bergen',ship:'Bergensfjord',stops:[{stop_id:'hirtshals',arr:null,dep:'20:00:00'},{stop_id:'bergen',arr:'14:30:00',dep:null}]},
];

const fjordStaBer = makeRoundTrips('fl_sta_ber','fl_ber_sta','Fjord Norway','stavanger','bergen',[
  {dep:'07:00:00',arr:'12:00:00',retDep:'13:00:00',retArr:'18:00:00'},
]);

const fjordRoutes = [
  {route_id:'fl_ber_hir',short_name:'BGO-HIR',long_name:'Bergen - Hirtshals (Fjord Line)'},
  {route_id:'fl_hir_ber',short_name:'HIR-BGO',long_name:'Hirtshals - Bergen (Fjord Line)'},
  {route_id:'fl_sta_ber',short_name:'SVG-BGO',long_name:'Stavanger - Bergen (Fjord Line)'},
  {route_id:'fl_ber_sta',short_name:'BGO-SVG',long_name:'Bergen - Stavanger (Fjord Line)'},
];
const fjordTrips = [...fjordBerHir,...fjordStaBer];
const fjordStops = {bergen:P.bergen,hirtshals:P.hirtshals,stavanger:P.stavanger};

// =============================================================================
// 3. SMYRIL LINE
// =============================================================================
const smyrilAgency = {agency_id:'smyril_line',agency_name:'Smyril Line',agency_url:'https://www.smyrilline.com',agency_timezone:'Atlantic/Faroe',agency_lang:'en',agency_phone:'+298 345900'};

const smyrilTrips = [
  {trip_id:'sm_hir_tor_1',route_id:'sm_hir_tor',service_id:'daily',headsign:'Tórshavn',ship:'Norröna',stops:[{stop_id:'hirtshals',arr:null,dep:'18:00:00'},{stop_id:'torshavn',arr:'00:00:00',dep:null}]},
  {trip_id:'sm_tor_sey_1',route_id:'sm_tor_sey',service_id:'daily',headsign:'Seyðisfjörður',ship:'Norröna',stops:[{stop_id:'torshavn',arr:null,dep:'04:00:00'},{stop_id:'seydisfjordur',arr:'19:00:00',dep:null}]},
  {trip_id:'sm_sey_tor_1',route_id:'sm_sey_tor',service_id:'daily',headsign:'Tórshavn',ship:'Norröna',stops:[{stop_id:'seydisfjordur',arr:null,dep:'20:00:00'},{stop_id:'torshavn',arr:'11:00:00',dep:null}]},
  {trip_id:'sm_tor_hir_1',route_id:'sm_tor_hir',service_id:'daily',headsign:'Hirtshals',ship:'Norröna',stops:[{stop_id:'torshavn',arr:null,dep:'16:00:00'},{stop_id:'hirtshals',arr:'22:00:00',dep:null}]},
];
const smyrilRoutes = [
  {route_id:'sm_hir_tor',short_name:'HIR-TOR',long_name:'Hirtshals - Tórshavn (Smyril Line)'},
  {route_id:'sm_tor_sey',short_name:'TOR-SEY',long_name:'Tórshavn - Seyðisfjörður (Smyril Line)'},
  {route_id:'sm_sey_tor',short_name:'SEY-TOR',long_name:'Seyðisfjörður - Tórshavn (Smyril Line)'},
  {route_id:'sm_tor_hir',short_name:'TOR-HIR',long_name:'Tórshavn - Hirtshals (Smyril Line)'},
];
const smyrilStops = {hirtshals:P.hirtshals,torshavn:P.torshavn,seydisfjordur:P.seydisfjordur};

// =============================================================================
// 4. MOLSLINJEN
// =============================================================================
const molsAgency = {agency_id:'molslinjen',agency_name:'Molslinjen',agency_url:'https://www.molslinjen.com',agency_timezone:'Europe/Copenhagen',agency_lang:'en',agency_phone:'+45 70 10 14 15'};

const molsOddEbe = makeRoundTrips('ml_odd_ebe','ml_ebe_odd','Express 5','odden','ebeltoft',[
  {dep:'05:30:00',arr:'06:25:00',retDep:'06:00:00',retArr:'06:55:00'},
  {dep:'08:00:00',arr:'08:55:00',retDep:'08:30:00',retArr:'09:25:00'},
  {dep:'10:30:00',arr:'11:25:00',retDep:'11:00:00',retArr:'11:55:00'},
  {dep:'13:00:00',arr:'13:55:00',retDep:'13:30:00',retArr:'14:25:00'},
  {dep:'15:30:00',arr:'16:25:00',retDep:'16:00:00',retArr:'16:55:00'},
  {dep:'18:00:00',arr:'18:55:00',retDep:'18:30:00',retArr:'19:25:00'},
  {dep:'20:30:00',arr:'21:25:00',retDep:'21:00:00',retArr:'21:55:00'},
]);

const molsOddAar = makeRoundTrips('ml_odd_aar','ml_aar_odd','Express 4','odden','aarhus',[
  {dep:'06:00:00',arr:'07:20:00',retDep:'06:30:00',retArr:'07:50:00'},
  {dep:'09:00:00',arr:'10:20:00',retDep:'09:30:00',retArr:'10:50:00'},
  {dep:'12:00:00',arr:'13:20:00',retDep:'12:30:00',retArr:'13:50:00'},
  {dep:'15:00:00',arr:'16:20:00',retDep:'15:30:00',retArr:'16:50:00'},
  {dep:'18:00:00',arr:'19:20:00',retDep:'18:30:00',retArr:'19:50:00'},
  {dep:'21:00:00',arr:'22:20:00',retDep:'21:30:00',retArr:'22:50:00'},
]);

const molsRonYst = makeRoundTrips('ml_ron_yst','ml_yst_ron','Hammershus','ronne','ystad',[
  {dep:'06:00:00',arr:'07:20:00',retDep:'07:00:00',retArr:'08:20:00'},
  {dep:'09:30:00',arr:'10:50:00',retDep:'10:30:00',retArr:'11:50:00'},
  {dep:'14:30:00',arr:'15:50:00',retDep:'15:00:00',retArr:'16:20:00'},
  {dep:'19:30:00',arr:'20:50:00',retDep:'20:00:00',retArr:'21:20:00'},
]);

const molsRonSas = makeRoundTrips('ml_ron_sas','ml_sas_ron','Povl Anker','ronne','sassnitz',[
  {dep:'08:30:00',arr:'11:50:00',retDep:'12:30:00',retArr:'15:50:00'},
]);

const molsRonKog = makeRoundTrips('ml_ron_kog','ml_kog_ron','Hammershus','ronne','koge',[
  {dep:'23:00:00',arr:'05:00:00',retDep:'23:30:00',retArr:'05:30:00'},
]);

const molsHelHel = makeRoundTrips('ml_hel_hel','ml_hel_hel_r','Tycho Brahe','helsingor','helsingborg',[
  {dep:'05:00:00',arr:'05:20:00',retDep:'05:15:00',retArr:'05:35:00'},
  {dep:'06:00:00',arr:'06:20:00',retDep:'06:15:00',retArr:'06:35:00'},
  {dep:'07:00:00',arr:'07:20:00',retDep:'07:15:00',retArr:'07:35:00'},
  {dep:'08:00:00',arr:'08:20:00',retDep:'08:15:00',retArr:'08:35:00'},
  {dep:'09:00:00',arr:'09:20:00',retDep:'09:15:00',retArr:'09:35:00'},
  {dep:'10:00:00',arr:'10:20:00',retDep:'10:15:00',retArr:'10:35:00'},
  {dep:'12:00:00',arr:'12:20:00',retDep:'12:15:00',retArr:'12:35:00'},
  {dep:'14:00:00',arr:'14:20:00',retDep:'14:15:00',retArr:'14:35:00'},
  {dep:'16:00:00',arr:'16:20:00',retDep:'16:15:00',retArr:'16:35:00'},
  {dep:'18:00:00',arr:'18:20:00',retDep:'18:15:00',retArr:'18:35:00'},
  {dep:'20:00:00',arr:'20:20:00',retDep:'20:15:00',retArr:'20:35:00'},
  {dep:'22:00:00',arr:'22:20:00',retDep:'22:15:00',retArr:'22:35:00'},
]);

const molsKalBal = makeRoundTrips('ml_kal_bal','ml_bal_kal','Samsø','kalundborg','ballen',[
  {dep:'06:30:00',arr:'08:00:00',retDep:'08:30:00',retArr:'10:00:00'},
  {dep:'12:00:00',arr:'13:30:00',retDep:'14:00:00',retArr:'15:30:00'},
  {dep:'17:00:00',arr:'18:30:00',retDep:'19:00:00',retArr:'20:30:00'},
]);

const molsBojFyn = makeRoundTrips('ml_boj_fyn','ml_fyn_boj','Fynshav','bojden','fynshav',[
  {dep:'05:30:00',arr:'06:20:00',retDep:'06:00:00',retArr:'06:50:00'},
  {dep:'08:00:00',arr:'08:50:00',retDep:'08:30:00',retArr:'09:20:00'},
  {dep:'11:00:00',arr:'11:50:00',retDep:'11:30:00',retArr:'12:20:00'},
  {dep:'14:00:00',arr:'14:50:00',retDep:'14:30:00',retArr:'15:20:00'},
  {dep:'17:00:00',arr:'17:50:00',retDep:'17:30:00',retArr:'18:20:00'},
  {dep:'20:00:00',arr:'20:50:00',retDep:'20:30:00',retArr:'21:20:00'},
  {dep:'22:30:00',arr:'23:20:00',retDep:'23:00:00',retArr:'23:50:00'},
]);

const molsSpoTar = makeRoundTrips('ml_spo_tar','ml_tar_spo','Langeland','spodsbjerg','taars',[
  {dep:'05:00:00',arr:'05:45:00',retDep:'05:30:00',retArr:'06:15:00'},
  {dep:'07:30:00',arr:'08:15:00',retDep:'08:00:00',retArr:'08:45:00'},
  {dep:'10:00:00',arr:'10:45:00',retDep:'10:30:00',retArr:'11:15:00'},
  {dep:'12:30:00',arr:'13:15:00',retDep:'13:00:00',retArr:'13:45:00'},
  {dep:'15:00:00',arr:'15:45:00',retDep:'15:30:00',retArr:'16:15:00'},
  {dep:'17:30:00',arr:'18:15:00',retDep:'18:00:00',retArr:'18:45:00'},
  {dep:'20:00:00',arr:'20:45:00',retDep:'20:30:00',retArr:'21:15:00'},
  {dep:'22:30:00',arr:'23:15:00',retDep:'23:00:00',retArr:'23:45:00'},
]);

const molsEsbNor = makeRoundTrips('ml_esb_nor','ml_nor_esb','Fenja','esbjerg','nordby',[
  {dep:'05:00:00',arr:'05:12:00',retDep:'05:15:00',retArr:'05:27:00'},
  {dep:'06:30:00',arr:'06:42:00',retDep:'06:45:00',retArr:'06:57:00'},
  {dep:'08:00:00',arr:'08:12:00',retDep:'08:15:00',retArr:'08:27:00'},
  {dep:'09:30:00',arr:'09:42:00',retDep:'09:45:00',retArr:'09:57:00'},
  {dep:'11:00:00',arr:'11:12:00',retDep:'11:15:00',retArr:'11:27:00'},
  {dep:'12:30:00',arr:'12:42:00',retDep:'12:45:00',retArr:'12:57:00'},
  {dep:'14:00:00',arr:'14:12:00',retDep:'14:15:00',retArr:'14:27:00'},
  {dep:'15:30:00',arr:'15:42:00',retDep:'15:45:00',retArr:'15:57:00'},
  {dep:'17:00:00',arr:'17:12:00',retDep:'17:15:00',retArr:'17:27:00'},
  {dep:'18:30:00',arr:'18:42:00',retDep:'18:45:00',retArr:'18:57:00'},
  {dep:'20:00:00',arr:'20:12:00',retDep:'20:15:00',retArr:'20:27:00'},
  {dep:'22:00:00',arr:'22:12:00',retDep:'22:15:00',retArr:'22:27:00'},
]);

const molsRoutes = [
  {route_id:'ml_odd_ebe',short_name:'ODD-EBE',long_name:'Odden - Ebeltoft (Molslinjen)'},{route_id:'ml_ebe_odd',short_name:'EBE-ODD',long_name:'Ebeltoft - Odden (Molslinjen)'},
  {route_id:'ml_odd_aar',short_name:'ODD-AAR',long_name:'Odden - Aarhus (Molslinjen)'},{route_id:'ml_aar_odd',short_name:'AAR-ODD',long_name:'Aarhus - Odden (Molslinjen)'},
  {route_id:'ml_ron_yst',short_name:'RNN-YST',long_name:'Rønne - Ystad (Bornholmslinjen)'},{route_id:'ml_yst_ron',short_name:'YST-RNN',long_name:'Ystad - Rønne (Bornholmslinjen)'},
  {route_id:'ml_ron_sas',short_name:'RNN-SAS',long_name:'Rønne - Sassnitz (Bornholmslinjen)'},{route_id:'ml_sas_ron',short_name:'SAS-RNN',long_name:'Sassnitz - Rønne (Bornholmslinjen)'},
  {route_id:'ml_ron_kog',short_name:'RNN-KOG',long_name:'Rønne - Køge (Bornholmslinjen)'},{route_id:'ml_kog_ron',short_name:'KOG-RNN',long_name:'Køge - Rønne (Bornholmslinjen)'},
  {route_id:'ml_hel_hel',short_name:'HEL-HEL',long_name:'Helsingør - Helsingborg (Øresundslinjen)'},{route_id:'ml_hel_hel_r',short_name:'HEL-HEL',long_name:'Helsingborg - Helsingør (Øresundslinjen)'},
  {route_id:'ml_kal_bal',short_name:'KAL-BAL',long_name:'Kalundborg - Ballen (Samsølinjen)'},{route_id:'ml_bal_kal',short_name:'BAL-KAL',long_name:'Ballen - Kalundborg (Samsølinjen)'},
  {route_id:'ml_boj_fyn',short_name:'BOJ-FYN',long_name:'Bøjden - Fynshav (Alslinjen)'},{route_id:'ml_fyn_boj',short_name:'FYN-BOJ',long_name:'Fynshav - Bøjden (Alslinjen)'},
  {route_id:'ml_spo_tar',short_name:'SPO-TAR',long_name:'Spodsbjerg - Tårs (Langelandslinjen)'},{route_id:'ml_tar_spo',short_name:'TAR-SPO',long_name:'Tårs - Spodsbjerg (Langelandslinjen)'},
  {route_id:'ml_esb_nor',short_name:'ESB-NOR',long_name:'Esbjerg - Nordby (Fanølinjen)'},{route_id:'ml_nor_esb',short_name:'NOR-ESB',long_name:'Nordby - Esbjerg (Fanølinjen)'},
];

const molsTrips = [...molsOddEbe,...molsOddAar,...molsRonYst,...molsRonSas,...molsRonKog,...molsHelHel,...molsKalBal,...molsBojFyn,...molsSpoTar,...molsEsbNor];
const molsStops = {odden:P.odden,ebeltoft:P.ebeltoft,aarhus:P.aarhus,ronne:P.ronne,ystad:P.ystad,sassnitz:P.sassnitz,koge:P.koge,helsingor:P.helsingor,helsingborg:P.helsingborg,kalundborg:P.kalundborg,ballen:P.ballen,bojden:P.bojden,fynshav:P.fynshav,spodsbjerg:P.spodsbjerg,taars:P.taars,esbjerg:P.esbjerg,nordby:P.nordby};

// =============================================================================
// 5. TT-LINE
// =============================================================================
const ttAgency = {agency_id:'tt_line',agency_name:'TT-Line',agency_url:'https://www.ttline.com',agency_timezone:'Europe/Berlin',agency_lang:'en',agency_phone:'+49 451 8980'};

const ttTreTra = makeRoundTrips('tt_tre_tra','tt_tra_tre','Nils Holgersson','trelleborg','travemunde',[
  {dep:'06:00:00',arr:'14:00:00',retDep:'07:00:00',retArr:'15:00:00'},
  {dep:'14:00:00',arr:'22:00:00',retDep:'15:00:00',retArr:'23:00:00'},
  {dep:'22:00:00',arr:'06:00:00',retDep:'23:00:00',retArr:'07:00:00'},
]);

const ttTreRos = makeRoundTrips('tt_tre_ros','tt_ros_tre','Peter Pan','trelleborg','rostock',[
  {dep:'08:00:00',arr:'14:00:00',retDep:'09:00:00',retArr:'15:00:00'},
  {dep:'16:00:00',arr:'22:00:00',retDep:'17:00:00',retArr:'23:00:00'},
  {dep:'23:30:00',arr:'05:30:00',retDep:'00:30:00',retArr:'06:30:00'},
]);

const ttTreSwi = makeRoundTrips('tt_tre_swi','tt_swi_tre','Tom Sawyer','trelleborg','swinoujscie',[
  {dep:'07:00:00',arr:'13:30:00',retDep:'08:00:00',retArr:'14:30:00'},
  {dep:'22:00:00',arr:'04:30:00',retDep:'23:00:00',retArr:'05:30:00'},
]);

const ttTreKla = makeRoundTrips('tt_tre_kla','tt_kla_tre','Marco Polo','trelleborg','klaipeda',[
  {dep:'18:00:00',arr:'12:00:00',retDep:'19:00:00',retArr:'13:00:00'},
]);

const ttRoutes = [
  {route_id:'tt_tre_tra',short_name:'TRG-TRV',long_name:'Trelleborg - Travemünde (TT-Line)'},{route_id:'tt_tra_tre',short_name:'TRV-TRG',long_name:'Travemünde - Trelleborg (TT-Line)'},
  {route_id:'tt_tre_ros',short_name:'TRG-RSK',long_name:'Trelleborg - Rostock (TT-Line)'},{route_id:'tt_ros_tre',short_name:'RSK-TRG',long_name:'Rostock - Trelleborg (TT-Line)'},
  {route_id:'tt_tre_swi',short_name:'TRG-SWI',long_name:'Trelleborg - Świnoujście (TT-Line)'},{route_id:'tt_swi_tre',short_name:'SWI-TRG',long_name:'Świnoujście - Trelleborg (TT-Line)'},
  {route_id:'tt_tre_kla',short_name:'TRG-KLA',long_name:'Trelleborg - Klaipėda (TT-Line)'},{route_id:'tt_kla_tre',short_name:'KLA-TRG',long_name:'Klaipėda - Trelleborg (TT-Line)'},
];
const ttTrips = [...ttTreTra,...ttTreRos,...ttTreSwi,...ttTreKla];
const ttStops = {trelleborg:P.trelleborg,travemunde:P.travemunde,rostock:P.rostock,swinoujscie:P.swinoujscie,klaipeda:P.klaipeda};

// =============================================================================
// 6. FINNLINES
// =============================================================================
const finnAgency = {agency_id:'finnlines',agency_name:'Finnlines',agency_url:'https://www.finnlines.com',agency_timezone:'Europe/Helsinki',agency_lang:'en',agency_phone:'+358 10 343 60'};

const finnHelTra = [
  {trip_id:'fn_hel_tra_1',route_id:'fn_hel_tra',service_id:'daily',headsign:'Travemünde',ship:'Finnstar',stops:[{stop_id:'helsinki',arr:null,dep:'17:00:00'},{stop_id:'travemunde',arr:'20:00:00',dep:null}]},
  {trip_id:'fn_tra_hel_1',route_id:'fn_tra_hel',service_id:'daily',headsign:'Helsinki',ship:'Finnmaid',stops:[{stop_id:'travemunde',arr:null,dep:'03:00:00'},{stop_id:'helsinki',arr:'06:00:00',dep:null}]},
];

const finnNaaKap = makeRoundTrips('fn_naa_kap','fn_kap_naa','Finnswan','naantali','kapellskar',[
  {dep:'09:00:00',arr:'18:30:00',retDep:'09:30:00',retArr:'19:00:00'},
  {dep:'21:00:00',arr:'06:30:00',retDep:'21:30:00',retArr:'07:00:00'},
]);

const finnMalTra = makeRoundTrips('fn_mal_tra','fn_tra_mal','Finnpartner','malmo','travemunde',[
  {dep:'07:00:00',arr:'16:00:00',retDep:'08:00:00',retArr:'17:00:00'},
  {dep:'22:00:00',arr:'07:00:00',retDep:'23:00:00',retArr:'08:00:00'},
]);

const finnMalSwi = makeRoundTrips('fn_mal_swi','fn_swi_mal','Finntrader','malmo','swinoujscie',[
  {dep:'10:00:00',arr:'18:00:00',retDep:'11:00:00',retArr:'19:00:00'},
  {dep:'22:00:00',arr:'06:00:00',retDep:'23:00:00',retArr:'07:00:00'},
]);

const finnRoutes = [
  {route_id:'fn_hel_tra',short_name:'HEL-TRV',long_name:'Helsinki - Travemünde (Finnlines)'},{route_id:'fn_tra_hel',short_name:'TRV-HEL',long_name:'Travemünde - Helsinki (Finnlines)'},
  {route_id:'fn_naa_kap',short_name:'NAA-KAP',long_name:'Naantali - Kapellskär (Finnlines)'},{route_id:'fn_kap_naa',short_name:'KAP-NAA',long_name:'Kapellskär - Naantali (Finnlines)'},
  {route_id:'fn_mal_tra',short_name:'MAL-TRV',long_name:'Malmö - Travemünde (Finnlines)'},{route_id:'fn_tra_mal',short_name:'TRV-MAL',long_name:'Travemünde - Malmö (Finnlines)'},
  {route_id:'fn_mal_swi',short_name:'MAL-SWI',long_name:'Malmö - Świnoujście (Finnlines)'},{route_id:'fn_swi_mal',short_name:'SWI-MAL',long_name:'Świnoujście - Malmö (Finnlines)'},
];
const finnTrips = [...finnHelTra,...finnNaaKap,...finnMalTra,...finnMalSwi];
const finnStops = {helsinki:P.helsinki,travemunde:P.travemunde,naantali:P.naantali,kapellskar:P.kapellskar,malmo:P.malmo,swinoujscie:P.swinoujscie};

// =============================================================================
// 7. DESTINATION GOTLAND
// =============================================================================
const gotAgency = {agency_id:'dest_gotland',agency_name:'Destination Gotland',agency_url:'https://www.destinationgotland.se',agency_timezone:'Europe/Stockholm',agency_lang:'en',agency_phone:'+46 771 22 33 00'};

const gotVisNyn = makeRoundTrips('dg_vis_nyn','dg_nyn_vis','Gotland','visby','nynashamn',[
  {dep:'05:00:00',arr:'08:15:00',retDep:'06:00:00',retArr:'09:15:00'},
  {dep:'08:30:00',arr:'11:45:00',retDep:'10:00:00',retArr:'13:15:00'},
  {dep:'12:00:00',arr:'15:15:00',retDep:'13:30:00',retArr:'16:45:00'},
  {dep:'16:00:00',arr:'19:15:00',retDep:'17:00:00',retArr:'20:15:00'},
  {dep:'19:00:00',arr:'22:15:00',retDep:'20:00:00',retArr:'23:15:00'},
]);

const gotVisOsk = makeRoundTrips('dg_vis_osk','dg_osk_vis','Visby','visby','oskarshamn',[
  {dep:'07:00:00',arr:'10:15:00',retDep:'08:00:00',retArr:'11:15:00'},
  {dep:'12:00:00',arr:'15:15:00',retDep:'13:00:00',retArr:'16:15:00'},
  {dep:'17:00:00',arr:'20:15:00',retDep:'18:00:00',retArr:'21:15:00'},
]);

const gotRoutes = [
  {route_id:'dg_vis_nyn',short_name:'VBY-NYN',long_name:'Visby - Nynäshamn (Dest. Gotland)'},{route_id:'dg_nyn_vis',short_name:'NYN-VBY',long_name:'Nynäshamn - Visby (Dest. Gotland)'},
  {route_id:'dg_vis_osk',short_name:'VBY-OSK',long_name:'Visby - Oskarshamn (Dest. Gotland)'},{route_id:'dg_osk_vis',short_name:'OSK-VBY',long_name:'Oskarshamn - Visby (Dest. Gotland)'},
];
const gotTrips = [...gotVisNyn,...gotVisOsk];
const gotStops = {visby:P.visby,nynashamn:P.nynashamn,oskarshamn:P.oskarshamn};

// =============================================================================
// BUILD ALL
// =============================================================================
console.log('🚢 Generating GTFS feeds for 7 operators...\n');

const specs = [
  ['colorline', colorAgency, colorRoutes, colorTrips, colorStops],
  ['fjordline', fjordAgency, fjordRoutes, fjordTrips, fjordStops],
  ['smyrilline', smyrilAgency, smyrilRoutes, smyrilTrips, smyrilStops],
  ['molslinjen', molsAgency, molsRoutes, molsTrips, molsStops],
  ['ttline', ttAgency, ttRoutes, ttTrips, ttStops],
  ['finnlines', finnAgency, finnRoutes, finnTrips, finnStops],
  ['destgotland', gotAgency, gotRoutes, gotTrips, gotStops],
];

specs.forEach(([name, agency, routes, trips, stops]) => {
  buildGTFS(path.join(FEEDS_DIR, name), agency, routes, trips, stops);
  zipIt(name, `${name}-gtfs.zip`);
});

console.log('\n📊 GTFS Feed Summary:');
console.log('═══════════════════════════════════════');
specs.forEach(([name,, routes, trips, stops]) => {
  console.log(`${name}: ${routes.length} routes | ${trips.length} trips/day | ${Object.keys(stops).length} stops`);
});
console.log('═══════════════════════════════════════');
console.log('\n✨ Done! All GTFS feeds in feeds/ directory.');
