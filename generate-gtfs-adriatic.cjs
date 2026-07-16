/**
 * GTFS for ANEK Lines, Superfast Ferries, Ventouris Ferries, European Seaways, Jadrolinija
 * Run: node generate-gtfs-adriatic.cjs
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const FEEDS_DIR = path.join(__dirname, 'feeds');

const P = {
  piraeus:      {name:'Piraeus',       lat:37.94, lon:23.64},
  chania:       {name:'Chania',        lat:35.52, lon:24.02},
  heraklion:    {name:'Heraklion',     lat:35.34, lon:25.14},
  patras:       {name:'Patras',        lat:38.25, lon:21.73},
  igoumenitsa:  {name:'Igoumenitsa',   lat:39.51, lon:20.21},
  ancona:       {name:'Ancona',        lat:43.62, lon:13.51},
  bari:         {name:'Bari',          lat:41.13, lon:16.87},
  venice:       {name:'Venice',        lat:45.44, lon:12.32},
  corfu:        {name:'Corfu',         lat:39.62, lon:19.92},
  durres:       {name:'Durrës',        lat:41.32, lon:19.45},
  split:        {name:'Split',         lat:43.51, lon:16.44},
  dubrovnik:    {name:'Dubrovnik',     lat:42.65, lon:18.08},
  zadar:        {name:'Zadar',         lat:44.12, lon:15.23},
  rijeka:       {name:'Rijeka',        lat:45.33, lon:14.44},
  supetar:      {name:'Supetar (Brač)',lat:43.38, lon:16.55},
  starigrad:    {name:'Stari Grad',    lat:43.18, lon:16.60},
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

// ============ ANEK LINES (now Attica Group subsidiary) ============
const akA={agency_id:'anek_lines',agency_name:'ANEK Lines',agency_url:'https://www.anek.gr',agency_timezone:'Europe/Athens',agency_lang:'en',agency_phone:'+30 210 419 7400'};

const akPirCha=mr('ak_pir_cha','ak_cha_pir','Elyros','piraeus','chania',[{d:'21:00:00',a:'06:00:00',rd:'21:00:00',ra:'06:00:00'}]);
const akPirHer=mr('ak_pir_her','ak_her_pir','Asterion II','piraeus','heraklion',[{d:'22:00:00',a:'07:00:00',rd:'22:00:00',ra:'07:00:00'}]);

const akR=[{rid:'ak_pir_cha',sn:'PIR-CHQ',ln:'Piraeus - Chania (ANEK)'},{rid:'ak_cha_pir',sn:'CHQ-PIR',ln:'Chania - Piraeus (ANEK)'},{rid:'ak_pir_her',sn:'PIR-HER',ln:'Piraeus - Heraklion (ANEK)'},{rid:'ak_her_pir',sn:'HER-PIR',ln:'Heraklion - Piraeus (ANEK)'}];
const akT=[...akPirCha,...akPirHer];
const akS={piraeus:P.piraeus,chania:P.chania,heraklion:P.heraklion};

// ============ SUPERFAST FERRIES (Attica Group) ============
const sfA={agency_id:'superfast',agency_name:'Superfast Ferries',agency_url:'https://www.superfast.com',agency_timezone:'Europe/Athens',agency_lang:'en',agency_phone:'+30 210 891 9000'};

const sfPatAnc=mr('sf_pat_anc','sf_anc_pat','Superfast XI','patras','ancona',[{d:'18:00:00',a:'12:00:00',rd:'17:00:00',ra:'11:00:00'}]);
const sfPatBar=mr('sf_pat_bar','sf_bar_pat','Superfast I','patras','bari',[{d:'18:00:00',a:'08:00:00',rd:'17:00:00',ra:'07:00:00'}]);
const sfPatVen=mr('sf_pat_ven','sf_ven_pat','Superfast V','patras','venice',[{d:'18:00:00',a:'15:00:00',rd:'17:00:00',ra:'14:00:00'}]);

const sfR=[{rid:'sf_pat_anc',sn:'PAT-AOI',ln:'Patras - Ancona (Superfast)'},{rid:'sf_anc_pat',sn:'AOI-PAT',ln:'Ancona - Patras (Superfast)'},{rid:'sf_pat_bar',sn:'PAT-BRI',ln:'Patras - Bari (Superfast)'},{rid:'sf_bar_pat',sn:'BRI-PAT',ln:'Bari - Patras (Superfast)'},{rid:'sf_pat_ven',sn:'PAT-VCE',ln:'Patras - Venice (Superfast)'},{rid:'sf_ven_pat',sn:'VCE-PAT',ln:'Venice - Patras (Superfast)'}];
const sfT=[...sfPatAnc,...sfPatBar,...sfPatVen];
const sfS={patras:P.patras,igoumenitsa:P.igoumenitsa,ancona:P.ancona,bari:P.bari,venice:P.venice};

// ============ VENTOURIS FERRIES ============
const veA={agency_id:'ventouris',agency_name:'Ventouris Ferries',agency_url:'https://www.ventourisferries.com',agency_timezone:'Europe/Athens',agency_lang:'en',agency_phone:'+30 210 411 5421'};

const veBarDur=mr('ve_bar_dur','ve_dur_bar','Rigel II','bari','durres',[{d:'10:00:00',a:'18:00:00',rd:'09:00:00',ra:'17:00:00'},{d:'22:00:00',a:'06:00:00',rd:'22:00:00',ra:'06:00:00'}]);
const veBarIgo=mr('ve_bar_igo','ve_igo_bar','Rigel V','bari','igoumenitsa',[{d:'10:00:00',a:'18:00:00',rd:'09:00:00',ra:'17:00:00'}]);

const veR=[{rid:'ve_bar_dur',sn:'BRI-DUR',ln:'Bari - Durrës (Ventouris)'},{rid:'ve_dur_bar',sn:'DUR-BRI',ln:'Durrës - Bari (Ventouris)'},{rid:'ve_bar_igo',sn:'BRI-IGO',ln:'Bari - Igoumenitsa (Ventouris)'},{rid:'ve_igo_bar',sn:'IGO-BRI',ln:'Igoumenitsa - Bari (Ventouris)'}];
const veT=[...veBarDur,...veBarIgo];
const veS={bari:P.bari,durres:P.durres,igoumenitsa:P.igoumenitsa};

// ============ EUROPEAN SEAWAYS (Greece-Italy) ============
const euA={agency_id:'euro_seaways',agency_name:'European Seaways',agency_url:'https://www.europeanseaways.com',agency_timezone:'Europe/Athens',agency_lang:'en',agency_phone:'+30 210 411 2678'};

const euBarIgo=mr('eu_bar_igo','eu_igo_bar','Bridge','bari','igoumenitsa',[{d:'13:00:00',a:'23:00:00',rd:'12:00:00',ra:'22:00:00'}]);
const euBriCor=mr('eu_bri_cor','eu_cor_bri','Galaxy','bari','corfu',[{d:'09:00:00',a:'18:00:00',rd:'10:00:00',ra:'19:00:00'}]);

const euR=[{rid:'eu_bar_igo',sn:'BRI-IGO',ln:'Bari - Igoumenitsa (Eur.Seaways)'},{rid:'eu_igo_bar',sn:'IGO-BRI',ln:'Igoumenitsa - Bari (Eur.Seaways)'},{rid:'eu_bri_cor',sn:'BRI-CFU',ln:'Bari - Corfu (Eur.Seaways)'},{rid:'eu_cor_bri',sn:'CFU-BRI',ln:'Corfu - Bari (Eur.Seaways)'}];
const euT=[...euBarIgo,...euBriCor];
const euS={bari:P.bari,igoumenitsa:P.igoumenitsa,corfu:P.corfu};

// ============ JADROLINIJA ============
const jaA={agency_id:'jadrolinija',agency_name:'Jadrolinija',agency_url:'https://www.jadrolinija.hr',agency_timezone:'Europe/Zagreb',agency_lang:'en',agency_phone:'+385 51 666 100'};

// International routes
const jaSplAnc=mr('ja_spl_anc','ja_anc_spl','Marko Polo','split','ancona',[{d:'20:00:00',a:'08:00:00',rd:'20:00:00',ra:'08:00:00'}]);
const jaDubBar=mr('ja_dub_bar','ja_bar_dub','Dalmacija','dubrovnik','bari',[{d:'22:00:00',a:'08:00:00',rd:'22:00:00',ra:'08:00:00'}]);
const jaZadAnc=mr('ja_zad_anc','ja_anc_zad','Zadar','zadar','ancona',[{d:'21:00:00',a:'07:00:00',rd:'21:00:00',ra:'07:00:00'}]);

// Key domestic routes
const jaSplSup=mr('ja_spl_sup','ja_sup_spl','Supetar','split','supetar',[{d:'05:30:00',a:'06:20:00',rd:'06:00:00',ra:'06:50:00'},{d:'07:30:00',a:'08:20:00',rd:'08:00:00',ra:'08:50:00'},{d:'09:30:00',a:'10:20:00',rd:'10:00:00',ra:'10:50:00'},{d:'11:30:00',a:'12:20:00',rd:'12:00:00',ra:'12:50:00'},{d:'13:30:00',a:'14:20:00',rd:'14:00:00',ra:'14:50:00'},{d:'15:30:00',a:'16:20:00',rd:'16:00:00',ra:'16:50:00'},{d:'17:30:00',a:'18:20:00',rd:'18:00:00',ra:'18:50:00'},{d:'19:30:00',a:'20:20:00',rd:'20:00:00',ra:'20:50:00'},{d:'21:30:00',a:'22:20:00',rd:'22:00:00',ra:'22:50:00'}]);
const jaSplSta=mr('ja_spl_sta','ja_sta_spl','Stari Grad','split','starigrad',[{d:'06:00:00',a:'08:00:00',rd:'06:30:00',ra:'08:30:00'},{d:'11:00:00',a:'13:00:00',rd:'11:30:00',ra:'13:30:00'},{d:'16:00:00',a:'18:00:00',rd:'16:30:00',ra:'18:30:00'},{d:'21:00:00',a:'23:00:00',rd:'21:30:00',ra:'23:30:00'}]);

const jaR=[{rid:'ja_spl_anc',sn:'SPU-AOI',ln:'Split - Ancona (Jadrolinija)'},{rid:'ja_anc_spl',sn:'AOI-SPU',ln:'Ancona - Split (Jadrolinija)'},{rid:'ja_dub_bar',sn:'DBV-BRI',ln:'Dubrovnik - Bari (Jadrolinija)'},{rid:'ja_bar_dub',sn:'BRI-DBV',ln:'Bari - Dubrovnik (Jadrolinija)'},{rid:'ja_zad_anc',sn:'ZAD-AOI',ln:'Zadar - Ancona (Jadrolinija)'},{rid:'ja_anc_zad',sn:'AOI-ZAD',ln:'Ancona - Zadar (Jadrolinija)'},{rid:'ja_spl_sup',sn:'SPU-SUP',ln:'Split - Supetar (Jadrolinija)'},{rid:'ja_sup_spl',sn:'SUP-SPU',ln:'Supetar - Split (Jadrolinija)'},{rid:'ja_spl_sta',sn:'SPU-STG',ln:'Split - Stari Grad (Jadrolinija)'},{rid:'ja_sta_spl',sn:'STG-SPU',ln:'Stari Grad - Split (Jadrolinija)'}];
const jaT=[...jaSplAnc,...jaDubBar,...jaZadAnc,...jaSplSup,...jaSplSta];
const jaS={split:P.split,ancona:P.ancona,dubrovnik:P.dubrovnik,bari:P.bari,zadar:P.zadar,supetar:P.supetar,starigrad:P.starigrad};

// ============ BUILD ============
console.log('🚢 Generating Adriatic/Aegean GTFS feeds...\n');
const specs=[['aneklines',akA,akR,akT,akS],['superfast',sfA,sfR,sfT,sfS],['ventouris',veA,veR,veT,veS],['euroseaways',euA,euR,euT,euS],['jadrolinija',jaA,jaR,jaT,jaS]];
specs.forEach(([n,a,r,t,s])=>{buildGTFS(path.join(FEEDS_DIR,n),a,r,t,s);zip(n,`${n}-gtfs.zip`);});
console.log('\n📊 Summary:');
specs.forEach(([n,,r,t,s])=>console.log(`  ${n}: ${r.length} routes | ${t.length} trips/day | ${Object.keys(s).length} stops`));
console.log('✨ Done!');
