/**
 * GTFS for Irish Ferries + Scandlines
 * Run: node generate-gtfs-isf.cjs
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const FEEDS_DIR = path.join(__dirname, 'feeds');

const P = {
  dublin:       {name:'Dublin',       lat:53.35, lon:-6.26},
  holyhead:     {name:'Holyhead',     lat:53.31, lon:-4.63},
  cherbourg:    {name:'Cherbourg',    lat:49.64, lon:-1.62},
  rosslare:     {name:'Rosslare',     lat:52.25, lon:-6.34},
  pembroke:     {name:'Pembroke',     lat:51.69, lon:-4.92},
  dover:        {name:'Dover',        lat:51.13, lon:1.31},
  calais:       {name:'Calais',       lat:50.97, lon:1.86},
  rodby:        {name:'Rødby',        lat:54.65, lon:11.35},
  puttgarden:   {name:'Puttgarden',   lat:54.50, lon:11.20},
  gedser:       {name:'Gedser',       lat:54.58, lon:11.93},
  rostock:      {name:'Rostock',      lat:54.18, lon:12.08},
};

function csvLine(f){return f.map(v=>{if(v==null)return'';const s=String(v);if(s.includes(',')||s.includes('"')||s.includes('\n'))return'"'+s.replace(/"/g,'""')+'"';return s;}).join(',');}
function writeCSV(fp,h,r){const l=[csvLine(h)];r.forEach(x=>l.push(csvLine(h.map(k=>x[k]!=null?x[k]:''))));fs.writeFileSync(fp,l.join('\n')+'\n','utf-8');}

function buildGTFS(out,agency,routes,trips,stops){
  fs.mkdirSync(out,{recursive:true});
  writeCSV(path.join(out,'agency.txt'),['agency_id','agency_name','agency_url','agency_timezone','agency_lang','agency_phone'],[agency]);
  writeCSV(path.join(out,'stops.txt'),['stop_id','stop_name','stop_lat','stop_lon'],Object.entries(stops).map(([id,s])=>({stop_id:id,stop_name:s.name,stop_lat:s.lat,stop_lon:s.lon})));
  writeCSV(path.join(out,'routes.txt'),['route_id','agency_id','route_short_name','route_long_name','route_type'],routes.map(r=>({route_id:r.rid,agency_id:agency.agency_id,route_short_name:r.sn,route_long_name:r.ln,route_type:4})));
  writeCSV(path.join(out,'trips.txt'),['route_id','service_id','trip_id','trip_headsign','direction_id','trip_short_name'],trips.map(t=>({route_id:t.rid,service_id:'daily',trip_id:t.tid,trip_headsign:t.hs,direction_id:0,trip_short_name:t.sh||''})));
  const st=[];trips.forEach(t=>{t.ss.forEach((s,i)=>{st.push({trip_id:t.tid,arrival_time:s.ar||'',departure_time:s.dp||'',stop_id:s.si,stop_sequence:i+1});});});
  writeCSV(path.join(out,'stop_times.txt'),['trip_id','arrival_time','departure_time','stop_id','stop_sequence'],st);
  const cal=[];const sd=new Date('2026-07-16');
  for(let d=0;d<365;d++){const dt=new Date(sd);dt.setDate(dt.getDate()+d);const y=dt.getFullYear(),m=String(dt.getMonth()+1).padStart(2,'0'),day=String(dt.getDate()).padStart(2,'0');cal.push({service_id:'daily',date:`${y}${m}${day}`,exception_type:1});}
  writeCSV(path.join(out,'calendar_dates.txt'),['service_id','date','exception_type'],cal);
  writeCSV(path.join(out,'feed_info.txt'),['feed_publisher_name','feed_publisher_url','feed_lang','feed_start_date','feed_end_date'],[{feed_publisher_name:'Track & Tide',feed_publisher_url:'https://trackandtide.com',feed_lang:'en',feed_start_date:'20260716',feed_end_date:'20270716'}]);
}
function zip(d,z){try{execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${path.join(FEEDS_DIR,d)}\\*' -DestinationPath '${path.join(FEEDS_DIR,z)}' -Force"`,{stdio:'pipe'});console.log('  ✅ '+z);}catch(e){console.error('  ❌ '+z);}}

function mr(ridA,ridB,ship,a,b,sch){const t=[];sch.forEach((s,i)=>{t.push({tid:`${ridA}_${i+1}`,rid:ridA,hs:P[b].name,sh:ship,ss:[{si:a,ar:null,dp:s.d},{si:b,ar:s.a,dp:null}]});t.push({tid:`${ridB}_${i+1}`,rid:ridB,hs:P[a].name,sh:ship,ss:[{si:b,ar:null,dp:s.rd},{si:a,ar:s.ra,dp:null}]});});return t;}

// ============ IRISH FERRIES ============
const ifA={agency_id:'irish_ferries',agency_name:'Irish Ferries',agency_url:'https://www.irishferries.com',agency_timezone:'Europe/Dublin',agency_lang:'en',agency_phone:'+353 1 607 5700'};

const ifDubHol=mr('if_dub_hol','if_hol_dub','Ulysses','dublin','holyhead',[{d:'02:45:00',a:'06:00:00',rd:'02:45:00',ra:'06:00:00'},{d:'08:45:00',a:'12:00:00',rd:'08:45:00',ra:'12:00:00'},{d:'14:00:00',a:'17:15:00',rd:'14:00:00',ra:'17:15:00'},{d:'20:30:00',a:'23:45:00',rd:'20:30:00',ra:'23:45:00'}]);
const ifDubChe=mr('if_dub_che','if_che_dub','W.B. Yeats','dublin','cherbourg',[{d:'16:00:00',a:'11:00:00',rd:'16:00:00',ra:'11:00:00'}]);
const ifRosPem=mr('if_ros_pem','if_pem_ros','Isle of Inishmore','rosslare','pembroke',[{d:'08:00:00',a:'12:00:00',rd:'08:30:00',ra:'12:30:00'},{d:'20:00:00',a:'00:00:00',rd:'20:30:00',ra:'00:30:00'}]);
const ifDovCal=mr('if_dov_cal','if_cal_dov','Isle of Inisheer','dover','calais',[{d:'01:00:00',a:'02:30:00',rd:'03:00:00',ra:'04:30:00'},{d:'05:00:00',a:'06:30:00',rd:'07:00:00',ra:'08:30:00'},{d:'09:00:00',a:'10:30:00',rd:'11:00:00',ra:'12:30:00'},{d:'13:00:00',a:'14:30:00',rd:'15:00:00',ra:'16:30:00'},{d:'17:00:00',a:'18:30:00',rd:'19:00:00',ra:'20:30:00'},{d:'21:00:00',a:'22:30:00',rd:'23:00:00',ra:'00:30:00'}]);

const ifR=[{rid:'if_dub_hol',sn:'DUB-HLY',ln:'Dublin - Holyhead (Irish Ferries)'},{rid:'if_hol_dub',sn:'HLY-DUB',ln:'Holyhead - Dublin (Irish Ferries)'},{rid:'if_dub_che',sn:'DUB-CHG',ln:'Dublin - Cherbourg (Irish Ferries)'},{rid:'if_che_dub',sn:'CHG-DUB',ln:'Cherbourg - Dublin (Irish Ferries)'},{rid:'if_ros_pem',sn:'ROS-PEM',ln:'Rosslare - Pembroke (Irish Ferries)'},{rid:'if_pem_ros',sn:'PEM-ROS',ln:'Pembroke - Rosslare (Irish Ferries)'},{rid:'if_dov_cal',sn:'DOV-CAL',ln:'Dover - Calais (Irish Ferries)'},{rid:'if_cal_dov',sn:'CAL-DOV',ln:'Calais - Dover (Irish Ferries)'}];
const ifT=[...ifDubHol,...ifDubChe,...ifRosPem,...ifDovCal];
const ifS={dublin:P.dublin,holyhead:P.holyhead,cherbourg:P.cherbourg,rosslare:P.rosslare,pembroke:P.pembroke,dover:P.dover,calais:P.calais};

// ============ SCANDLINES ============
const scA={agency_id:'scandlines',agency_name:'Scandlines',agency_url:'https://www.scandlines.com',agency_timezone:'Europe/Copenhagen',agency_lang:'en',agency_phone:'+45 33 15 15 15'};

const scRodPut=mr('sc_rod_put','sc_put_rod','Deutschland','rodby','puttgarden',[{d:'00:15:00',a:'01:00:00',rd:'00:30:00',ra:'01:15:00'},{d:'02:15:00',a:'03:00:00',rd:'02:30:00',ra:'03:15:00'},{d:'04:15:00',a:'05:00:00',rd:'04:30:00',ra:'05:15:00'},{d:'06:15:00',a:'07:00:00',rd:'06:30:00',ra:'07:15:00'},{d:'08:15:00',a:'09:00:00',rd:'08:30:00',ra:'09:15:00'},{d:'10:15:00',a:'11:00:00',rd:'10:30:00',ra:'11:15:00'},{d:'12:15:00',a:'13:00:00',rd:'12:30:00',ra:'13:15:00'},{d:'14:15:00',a:'15:00:00',rd:'14:30:00',ra:'15:15:00'},{d:'16:15:00',a:'17:00:00',rd:'16:30:00',ra:'17:15:00'},{d:'18:15:00',a:'19:00:00',rd:'18:30:00',ra:'19:15:00'},{d:'20:15:00',a:'21:00:00',rd:'20:30:00',ra:'21:15:00'},{d:'22:15:00',a:'23:00:00',rd:'22:30:00',ra:'23:15:00'}]);
const scGedRos=mr('sc_ged_ros','sc_ros_ged','Berlin','gedser','rostock',[{d:'06:00:00',a:'08:00:00',rd:'06:30:00',ra:'08:30:00'},{d:'08:30:00',a:'10:30:00',rd:'09:00:00',ra:'11:00:00'},{d:'11:00:00',a:'13:00:00',rd:'11:30:00',ra:'13:30:00'},{d:'13:30:00',a:'15:30:00',rd:'14:00:00',ra:'16:00:00'},{d:'16:00:00',a:'18:00:00',rd:'16:30:00',ra:'18:30:00'},{d:'18:30:00',a:'20:30:00',rd:'19:00:00',ra:'21:00:00'},{d:'21:00:00',a:'23:00:00',rd:'21:30:00',ra:'23:30:00'}]);

const scR=[{rid:'sc_rod_put',sn:'ROD-PUT',ln:'Rødby - Puttgarden (Scandlines)'},{rid:'sc_put_rod',sn:'PUT-ROD',ln:'Puttgarden - Rødby (Scandlines)'},{rid:'sc_ged_ros',sn:'GED-RSK',ln:'Gedser - Rostock (Scandlines)'},{rid:'sc_ros_ged',sn:'RSK-GED',ln:'Rostock - Gedser (Scandlines)'}];
const scT=[...scRodPut,...scGedRos];
const scS={rodby:P.rodby,puttgarden:P.puttgarden,gedser:P.gedser,rostock:P.rostock};

// ============ BUILD ============
console.log('🚢 Generating Irish Ferries + Scandlines...\n');
[['irishferries',ifA,ifR,ifT,ifS],['scandlines',scA,scR,scT,scS]].forEach(([n,a,r,t,s])=>{buildGTFS(path.join(FEEDS_DIR,n),a,r,t,s);zip(n,`${n}-gtfs.zip`);});
console.log('\n📊 Summary:');
[['irishferries',ifR,ifT,ifS],['scandlines',scR,scT,scS]].forEach(([n,r,t,s])=>console.log(`  ${n}: ${r.length} routes | ${t.length} trips/day | ${Object.keys(s).length} stops`));
console.log('✨ Done!');
