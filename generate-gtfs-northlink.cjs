/**
 * GTFS for NorthLink Ferries (Scotland)
 * Run: node generate-gtfs-northlink.cjs
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const FEEDS_DIR = path.join(__dirname, 'feeds');

const P = {
  aberdeen:    {name:'Aberdeen',   lat:57.14, lon:-2.08},
  lerwick:     {name:'Lerwick',    lat:60.16, lon:-1.15},
  kirkwall:    {name:'Kirkwall',   lat:58.98, lon:-2.96},
  scrabster:   {name:'Scrabster',  lat:58.61, lon:-3.55},
  stromness:   {name:'Stromness',  lat:58.96, lon:-3.30},
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

const nlA={agency_id:'northlink',agency_name:'NorthLink Ferries',agency_url:'https://www.northlinkferries.co.uk',agency_timezone:'Europe/London',agency_lang:'en',agency_phone:'+44 1856 885500'};

const nlAbeLer=[
  {tid:'nl_abe_ler_1',rid:'nl_abe_ler',hs:'Lerwick',sh:'Hjaltland',ss:[{si:'aberdeen',ar:null,dp:'17:00:00'},{si:'lerwick',ar:'07:00:00',dp:null}]},
  {tid:'nl_ler_abe_1',rid:'nl_ler_abe',hs:'Aberdeen',sh:'Hrossey',ss:[{si:'lerwick',ar:null,dp:'17:00:00'},{si:'aberdeen',ar:'07:00:00',dp:null}]},
];

const nlAbeKir=[
  {tid:'nl_abe_kir_1',rid:'nl_abe_kir',hs:'Kirkwall',sh:'Hrossey',ss:[{si:'aberdeen',ar:null,dp:'17:00:00'},{si:'kirkwall',ar:'23:00:00',dp:null}]},
  {tid:'nl_kir_abe_1',rid:'nl_kir_abe',hs:'Aberdeen',sh:'Hjaltland',ss:[{si:'kirkwall',ar:null,dp:'23:45:00'},{si:'aberdeen',ar:'07:00:00',dp:null}]},
];

const nlScrStr=(()=>{const t=[];[{d:'06:30:00',a:'08:00:00',rd:'07:00:00',ra:'08:30:00'},{d:'10:00:00',a:'11:30:00',rd:'10:30:00',ra:'12:00:00'},{d:'13:00:00',a:'14:30:00',rd:'13:30:00',ra:'15:00:00'},{d:'16:30:00',a:'18:00:00',rd:'17:00:00',ra:'18:30:00'},{d:'19:30:00',a:'21:00:00',rd:'20:00:00',ra:'21:30:00'}].forEach((s,i)=>{t.push({tid:`nl_scr_str_${i+1}`,rid:'nl_scr_str',hs:'Stromness',sh:'Hamnavoe',ss:[{si:'scrabster',ar:null,dp:s.d},{si:'stromness',ar:s.a,dp:null}]});t.push({tid:`nl_str_scr_${i+1}`,rid:'nl_str_scr',hs:'Scrabster',sh:'Hamnavoe',ss:[{si:'stromness',ar:null,dp:s.rd},{si:'scrabster',ar:s.ra,dp:null}]});});return t;})();

const nlR=[{rid:'nl_abe_ler',sn:'ABZ-LWK',ln:'Aberdeen - Lerwick (NorthLink)'},{rid:'nl_ler_abe',sn:'LWK-ABZ',ln:'Lerwick - Aberdeen (NorthLink)'},{rid:'nl_abe_kir',sn:'ABZ-KWL',ln:'Aberdeen - Kirkwall (NorthLink)'},{rid:'nl_kir_abe',sn:'KWL-ABZ',ln:'Kirkwall - Aberdeen (NorthLink)'},{rid:'nl_scr_str',sn:'SCR-STN',ln:'Scrabster - Stromness (NorthLink)'},{rid:'nl_str_scr',sn:'STN-SCR',ln:'Stromness - Scrabster (NorthLink)'}];
const nlT=[...nlAbeLer,...nlAbeKir,...nlScrStr];
const nlS={aberdeen:P.aberdeen,lerwick:P.lerwick,kirkwall:P.kirkwall,scrabster:P.scrabster,stromness:P.stromness};

console.log('🚢 NorthLink Ferries...');
buildGTFS(path.join(FEEDS_DIR,'northlink'),nlA,nlR,nlT,nlS);zip('northlink','northlink-gtfs.zip');
console.log(`  ${nlR.length} routes | ${nlT.length} trips/day | ${Object.keys(nlS).length} stops`);
console.log('✨ Done!');
