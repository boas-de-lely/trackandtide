/**
 * GTFS for GoVolta (Dutch open-access train operator)
 * Route: Amsterdam Centraal → Berlin-Spandau (6x/week, started March 2026)
 * Run: node generate-gtfs-govolta.cjs
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const FEEDS_DIR = path.join(__dirname, 'feeds');

// Station coordinates
const S = {
  amsterdam_c:  {name:'Amsterdam Centraal',   lat:52.38, lon:4.90},
  amersfoort_c: {name:'Amersfoort Centraal',  lat:52.15, lon:5.37},
  hengelo:      {name:'Hengelo',              lat:52.26, lon:6.79},
  osnabrueck:   {name:'Osnabrück Hbf',        lat:52.27, lon:8.06},
  hannover:     {name:'Hannover Hbf',         lat:52.38, lon:9.74},
  berlin_sp:    {name:'Berlin-Spandau',       lat:52.53, lon:13.20},
};

function csvLine(f){return f.map(v=>{if(v==null)return'';const s=String(v);if(s.includes(',')||s.includes('"')||s.includes('\n'))return'"'+s.replace(/"/g,'""')+'"';return s;}).join(',');}
function writeCSV(fp,h,r){const l=[csvLine(h)];r.forEach(x=>l.push(csvLine(h.map(k=>x[k]!=null?x[k]:''))));fs.writeFileSync(fp,l.join('\n')+'\n','utf-8');}

function buildGTFS(out,agency,routes,trips,stops){
  fs.mkdirSync(out,{recursive:true});
  writeCSV(path.join(out,'agency.txt'),['agency_id','agency_name','agency_url','agency_timezone','agency_lang','agency_phone'],[agency]);
  writeCSV(path.join(out,'stops.txt'),['stop_id','stop_name','stop_lat','stop_lon'],Object.entries(stops).map(([id,s])=>({stop_id:id,stop_name:s.name,stop_lat:s.lat,stop_lon:s.lon})));
  writeCSV(path.join(out,'routes.txt'),['route_id','agency_id','route_short_name','route_long_name','route_type'],routes.map(r=>({route_id:r.rid,agency_id:agency.agency_id,route_short_name:r.sn,route_long_name:r.ln,route_type:2}))); // 2=rail
  writeCSV(path.join(out,'trips.txt'),['route_id','service_id','trip_id','trip_headsign','direction_id','trip_short_name'],trips.map(t=>({route_id:t.rid,service_id:'daily',trip_id:t.tid,trip_headsign:t.hs,direction_id:0,trip_short_name:t.sh||''})));
  const st=[];trips.forEach(t=>{t.ss.forEach((s,i)=>{st.push({trip_id:t.tid,arrival_time:s.ar||'',departure_time:s.dp||'',stop_id:s.si,stop_sequence:i+1});});});
  writeCSV(path.join(out,'stop_times.txt'),['trip_id','arrival_time','departure_time','stop_id','stop_sequence'],st);
  const cal=[];const sd=new Date('2026-07-16');
  for(let d=0;d<365;d++){const dt=new Date(sd);dt.setDate(dt.getDate()+d);const y=dt.getFullYear(),m=String(dt.getMonth()+1).padStart(2,'0'),day=String(dt.getDate()).padStart(2,'0');cal.push({service_id:'daily',date:`${y}${m}${day}`,exception_type:1});}
  writeCSV(path.join(out,'calendar_dates.txt'),['service_id','date','exception_type'],cal);
  writeCSV(path.join(out,'feed_info.txt'),['feed_publisher_name','feed_publisher_url','feed_lang','feed_start_date','feed_end_date'],[{feed_publisher_name:'Track & Tide',feed_publisher_url:'https://trackandtide.com',feed_lang:'en',feed_start_date:'20260716',feed_end_date:'20270716'}]);
}
function zip(d,z){try{execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${path.join(FEEDS_DIR,d)}\\*' -DestinationPath '${path.join(FEEDS_DIR,z)}' -Force"`,{stdio:'pipe'});console.log('  ✅ '+z);}catch(e){console.error('  ❌ '+z);}}

const gvA={agency_id:'govolta',agency_name:'GoVolta',agency_url:'https://www.govolta.nl',agency_timezone:'Europe/Amsterdam',agency_lang:'en'};

// Amsterdam → Berlin-Spandau (~6.5h, 6x/week)
// Stops: Amsterdam C, Amersfoort C, Hengelo, Osnabrück Hbf, Hannover Hbf, Berlin-Spandau
const gvAmsBer=[
  {tid:'gv_ams_ber_1',rid:'gv_ams_ber',hs:'Berlin-Spandau',sh:'GoVolta',ss:[
    {si:'amsterdam_c',ar:null,dp:'08:00:00'},{si:'amersfoort_c',ar:'08:35:00',dp:'08:38:00'},
    {si:'hengelo',ar:'09:35:00',dp:'09:38:00'},{si:'osnabrueck',ar:'10:30:00',dp:'10:33:00'},
    {si:'hannover',ar:'11:35:00',dp:'11:40:00'},{si:'berlin_sp',ar:'14:30:00',dp:null}]},
  {tid:'gv_ber_ams_1',rid:'gv_ber_ams',hs:'Amsterdam Centraal',sh:'GoVolta',ss:[
    {si:'berlin_sp',ar:null,dp:'07:00:00'},{si:'hannover',ar:'09:50:00',dp:'09:55:00'},
    {si:'osnabrueck',ar:'10:57:00',dp:'11:00:00'},{si:'hengelo',ar:'11:52:00',dp:'11:55:00'},
    {si:'amersfoort_c',ar:'12:52:00',dp:'12:55:00'},{si:'amsterdam_c',ar:'13:30:00',dp:null}]},
  {tid:'gv_ams_ber_2',rid:'gv_ams_ber',hs:'Berlin-Spandau',sh:'GoVolta',ss:[
    {si:'amsterdam_c',ar:null,dp:'16:00:00'},{si:'amersfoort_c',ar:'16:35:00',dp:'16:38:00'},
    {si:'hengelo',ar:'17:35:00',dp:'17:38:00'},{si:'osnabrueck',ar:'18:30:00',dp:'18:33:00'},
    {si:'hannover',ar:'19:35:00',dp:'19:40:00'},{si:'berlin_sp',ar:'22:30:00',dp:null}]},
];

const gvR=[{rid:'gv_ams_ber',sn:'AMS-BER',ln:'Amsterdam - Berlin (GoVolta)'},{rid:'gv_ber_ams',sn:'BER-AMS',ln:'Berlin - Amsterdam (GoVolta)'}];

console.log('🚆 GoVolta train GTFS...');
buildGTFS(path.join(FEEDS_DIR,'govolta'),gvA,gvR,gvAmsBer,S);zip('govolta','govolta-gtfs.zip');
console.log(`  ${gvR.length} routes | ${gvAmsBer.length} trips/day | ${Object.keys(S).length} stops`);
console.log('✨ Done!');
