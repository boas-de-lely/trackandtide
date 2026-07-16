/**
 * GTFS Feed Generator for GNV, Moby Lines, Tirrenia, Grimaldi Lines, Corsica Ferries
 * Mediterranean ferry operators. Data from Wikipedia as of July 2026.
 * Run: node generate-gtfs-med.cjs
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const FEEDS_DIR = path.join(__dirname, 'feeds');

// Port coordinates
const P = {
  genoa:        {name:'Genoa',         lat:44.41, lon:8.93},
  palermo:      {name:'Palermo',       lat:38.12, lon:13.36},
  portoTorres:  {name:'Porto Torres',  lat:40.84, lon:8.40},
  olbia:        {name:'Olbia',         lat:40.92, lon:9.50},
  barcelona:    {name:'Barcelona',     lat:41.38, lon:2.17},
  livorno:      {name:'Livorno',       lat:43.55, lon:10.30},
  civitavecchia:{name:'Civitavecchia', lat:42.10, lon:11.79},
  sete:         {name:'Sète',          lat:43.41, lon:3.70},
  tangier:      {name:'Tangier',       lat:35.79, lon:-5.81},
  napoli:       {name:'Naples',        lat:40.84, lon:14.27},
  cagliari:     {name:'Cagliari',      lat:39.22, lon:9.11},
  nice:         {name:'Nice',          lat:43.70, lon:7.28},
  toulon:       {name:'Toulon',        lat:43.12, lon:5.93},
  bastia:       {name:'Bastia',        lat:42.70, lon:9.45},
  ajaccio:      {name:'Ajaccio',       lat:41.92, lon:8.74},
  lileRousse:   {name:"L'Île-Rousse",  lat:42.63, lon:8.94},
  portoVecchio: {name:'Porto-Vecchio', lat:41.59, lon:9.28},
  savona:       {name:'Savona',        lat:44.31, lon:8.48},
  golfoAranci:  {name:'Golfo Aranci',  lat:41.00, lon:9.62},
  piombino:     {name:'Piombino',      lat:42.93, lon:10.53},
  portoferraio: {name:'Portoferraio',  lat:42.81, lon:10.33},
  staTeresa:    {name:'S.Teresa Gallura',lat:41.24, lon:9.19},
  bonifacio:    {name:'Bonifacio',     lat:41.39, lon:9.16},
  alcudia:      {name:'Alcudia',       lat:39.85, lon:3.12},
  menorca:      {name:'Menorca (Mahón)',lat:39.89, lon:4.26},
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
function mt(rid,ship,dir,stops){return stops.map((s,i)=>({tid:`${rid}_${i+1}`,rid,hs:dir,sh:ship,ss:s.stops}));}

// ============ GNV ============
const gnvA={agency_id:'gnv',agency_name:'Grandi Navi Veloci',agency_url:'https://www.gnv.it',agency_timezone:'Europe/Rome',agency_lang:'en',agency_phone:'+39 010 20941'};

const gnvGenPal=mr('gnv_gen_pal','gnv_pal_gen','La Suprema','genoa','palermo',[{d:'20:00:00',a:'10:00:00',rd:'20:00:00',ra:'10:00:00'}]);
const gnvGenPto=mr('gnv_gen_pto','gnv_pto_gen','La Superba','genoa','portoTorres',[{d:'21:00:00',a:'08:00:00',rd:'21:00:00',ra:'08:00:00'}]);
const gnvGenOlb=mr('gnv_gen_olb','gnv_olb_gen','Excelsior','genoa','olbia',[{d:'22:00:00',a:'10:00:00',rd:'22:00:00',ra:'10:00:00'}]);
const gnvLivPal=mr('gnv_liv_pal','gnv_pal_liv','Splendid','livorno','palermo',[{d:'20:00:00',a:'10:00:00',rd:'20:00:00',ra:'10:00:00'}]);
const gnvCivPal=mr('gnv_civ_pal','gnv_pal_civ','Majestic','civitavecchia','palermo',[{d:'18:00:00',a:'08:00:00',rd:'18:00:00',ra:'08:00:00'}]);
const gnvGenBar=mr('gnv_gen_bar','gnv_bar_gen','Fantastic','genoa','barcelona',[{d:'20:00:00',a:'17:00:00',rd:'20:00:00',ra:'17:00:00'}]);
const gnvSetTan=mr('gnv_set_tan','gnv_tan_set','SNAV Sardegna','sete','tangier',[{d:'18:00:00',a:'12:00:00',rd:'18:00:00',ra:'12:00:00'}]);

const gnvR=[{rid:'gnv_gen_pal',sn:'GOA-PMO',ln:'Genoa - Palermo (GNV)'},{rid:'gnv_pal_gen',sn:'PMO-GOA',ln:'Palermo - Genoa (GNV)'},{rid:'gnv_gen_pto',sn:'GOA-PTO',ln:'Genoa - Porto Torres (GNV)'},{rid:'gnv_pto_gen',sn:'PTO-GOA',ln:'Porto Torres - Genoa (GNV)'},{rid:'gnv_gen_olb',sn:'GOA-OLB',ln:'Genoa - Olbia (GNV)'},{rid:'gnv_olb_gen',sn:'OLB-GOA',ln:'Olbia - Genoa (GNV)'},{rid:'gnv_liv_pal',sn:'LIV-PMO',ln:'Livorno - Palermo (GNV)'},{rid:'gnv_pal_liv',sn:'PMO-LIV',ln:'Palermo - Livorno (GNV)'},{rid:'gnv_civ_pal',sn:'CIV-PMO',ln:'Civitavecchia - Palermo (GNV)'},{rid:'gnv_pal_civ',sn:'PMO-CIV',ln:'Palermo - Civitavecchia (GNV)'},{rid:'gnv_gen_bar',sn:'GOA-BCN',ln:'Genoa - Barcelona (GNV)'},{rid:'gnv_bar_gen',sn:'BCN-GOA',ln:'Barcelona - Genoa (GNV)'},{rid:'gnv_set_tan',sn:'SET-TNG',ln:'Sète - Tangier (GNV)'},{rid:'gnv_tan_set',sn:'TNG-SET',ln:'Tangier - Sète (GNV)'}];
const gnvT=[...gnvGenPal,...gnvGenPto,...gnvGenOlb,...gnvLivPal,...gnvCivPal,...gnvGenBar,...gnvSetTan];
const gnvS={genoa:P.genoa,palermo:P.palermo,portoTorres:P.portoTorres,olbia:P.olbia,barcelona:P.barcelona,livorno:P.livorno,civitavecchia:P.civitavecchia,sete:P.sete,tangier:P.tangier};

// ============ MOBY LINES ============
const mobyA={agency_id:'moby_lines',agency_name:'Moby Lines',agency_url:'https://www.moby.it',agency_timezone:'Europe/Rome',agency_lang:'en',agency_phone:'+39 02 3030 2000'};

const mlLivOlb=mr('ml_liv_olb','ml_olb_liv','Moby Fantasy','livorno','olbia',[{d:'10:00:00',a:'17:00:00',rd:'10:30:00',ra:'17:30:00'},{d:'22:00:00',a:'05:00:00',rd:'22:00:00',ra:'05:00:00'}]);
const mlLivBas=mr('ml_liv_bas','ml_bas_liv','Moby Orli','livorno','bastia',[{d:'08:00:00',a:'12:00:00',rd:'13:00:00',ra:'17:00:00'}]);
const mlGenOlb=mr('ml_gen_olb','ml_olb_gen','Moby Aki','genoa','olbia',[{d:'20:00:00',a:'08:00:00',rd:'20:00:00',ra:'08:00:00'}]);
const mlPioOlb=mr('ml_pio_olb','ml_olb_pio','Moby Wonder','piombino','olbia',[{d:'10:00:00',a:'17:00:00',rd:'10:30:00',ra:'17:30:00'}]);
const mlPioPfe=mr('ml_pio_pfe','ml_pfe_pio','Moby Kiss','piombino','portoferraio',[{d:'06:00:00',a:'07:00:00',rd:'06:30:00',ra:'07:30:00'},{d:'08:00:00',a:'09:00:00',rd:'08:30:00',ra:'09:30:00'},{d:'10:00:00',a:'11:00:00',rd:'10:30:00',ra:'11:30:00'},{d:'12:00:00',a:'13:00:00',rd:'12:30:00',ra:'13:30:00'},{d:'14:00:00',a:'15:00:00',rd:'14:30:00',ra:'15:30:00'},{d:'16:00:00',a:'17:00:00',rd:'16:30:00',ra:'17:30:00'},{d:'18:00:00',a:'19:00:00',rd:'18:30:00',ra:'19:30:00'},{d:'20:00:00',a:'21:00:00',rd:'20:30:00',ra:'21:30:00'},{d:'22:00:00',a:'23:00:00',rd:'22:30:00',ra:'23:30:00'}]);
const mlPalOlb=mr('ml_pal_olb','ml_olb_pal','Vincenzo Florio','palermo','olbia',[{d:'20:00:00',a:'06:00:00',rd:'20:00:00',ra:'06:00:00'}]);
const mlStaBon=mr('ml_sta_bon','ml_bon_sta','Giraglia','staTeresa','bonifacio',[{d:'07:00:00',a:'08:00:00',rd:'07:30:00',ra:'08:30:00'},{d:'10:00:00',a:'11:00:00',rd:'10:30:00',ra:'11:30:00'},{d:'14:00:00',a:'15:00:00',rd:'14:30:00',ra:'15:30:00'},{d:'17:00:00',a:'18:00:00',rd:'17:30:00',ra:'18:30:00'}]);

const mobyR=[{rid:'ml_liv_olb',sn:'LIV-OLB',ln:'Livorno - Olbia (Moby)'},{rid:'ml_olb_liv',sn:'OLB-LIV',ln:'Olbia - Livorno (Moby)'},{rid:'ml_liv_bas',sn:'LIV-BAS',ln:'Livorno - Bastia (Moby)'},{rid:'ml_bas_liv',sn:'BAS-LIV',ln:'Bastia - Livorno (Moby)'},{rid:'ml_gen_olb',sn:'GOA-OLB',ln:'Genoa - Olbia (Moby)'},{rid:'ml_olb_gen',sn:'OLB-GOA',ln:'Olbia - Genoa (Moby)'},{rid:'ml_pio_olb',sn:'PIO-OLB',ln:'Piombino - Olbia (Moby)'},{rid:'ml_olb_pio',sn:'OLB-PIO',ln:'Olbia - Piombino (Moby)'},{rid:'ml_pio_pfe',sn:'PIO-PFE',ln:'Piombino - Portoferraio (Moby)'},{rid:'ml_pfe_pio',sn:'PFE-PIO',ln:'Portoferraio - Piombino (Moby)'},{rid:'ml_pal_olb',sn:'PMO-OLB',ln:'Palermo - Olbia (Moby)'},{rid:'ml_olb_pal',sn:'OLB-PMO',ln:'Olbia - Palermo (Moby)'},{rid:'ml_sta_bon',sn:'STE-BON',ln:'S.Teresa - Bonifacio (Moby)'},{rid:'ml_bon_sta',sn:'BON-STE',ln:'Bonifacio - S.Teresa (Moby)'}];
const mobyT=[...mlLivOlb,...mlLivBas,...mlGenOlb,...mlPioOlb,...mlPioPfe,...mlPalOlb,...mlStaBon];
const mobyS={livorno:P.livorno,olbia:P.olbia,bastia:P.bastia,genoa:P.genoa,piombino:P.piombino,portoferraio:P.portoferraio,palermo:P.palermo,staTeresa:P.staTeresa,bonifacio:P.bonifacio};

// ============ TIRRENIA ============
const tirA={agency_id:'tirrenia',agency_name:'Tirrenia',agency_url:'https://www.tirrenia.it',agency_timezone:'Europe/Rome',agency_lang:'en',agency_phone:'+39 199 123 199'};

const tirCivOlb=mr('tr_civ_olb','tr_olb_civ','Athara','civitavecchia','olbia',[{d:'10:00:00',a:'15:30:00',rd:'10:30:00',ra:'16:00:00'},{d:'22:00:00',a:'03:30:00',rd:'22:00:00',ra:'03:30:00'}]);
const tirNapCag=mr('tr_nap_cag','tr_cag_nap','Janas','napoli','cagliari',[{d:'20:00:00',a:'10:00:00',rd:'20:00:00',ra:'10:00:00'}]);
const tirGenPto=mr('tr_gen_pto','tr_pto_gen','Bithia','genoa','portoTorres',[{d:'21:00:00',a:'08:00:00',rd:'21:00:00',ra:'08:00:00'}]);

const tirR=[{rid:'tr_civ_olb',sn:'CIV-OLB',ln:'Civitavecchia - Olbia (Tirrenia)'},{rid:'tr_olb_civ',sn:'OLB-CIV',ln:'Olbia - Civitavecchia (Tirrenia)'},{rid:'tr_nap_cag',sn:'NAP-CAG',ln:'Naples - Cagliari (Tirrenia)'},{rid:'tr_cag_nap',sn:'CAG-NAP',ln:'Cagliari - Naples (Tirrenia)'},{rid:'tr_gen_pto',sn:'GOA-PTO',ln:'Genoa - Porto Torres (Tirrenia)'},{rid:'tr_pto_gen',sn:'PTO-GOA',ln:'Porto Torres - Genoa (Tirrenia)'}];
const tirT=[...tirCivOlb,...tirNapCag,...tirGenPto];
const tirS={civitavecchia:P.civitavecchia,olbia:P.olbia,napoli:P.napoli,cagliari:P.cagliari,genoa:P.genoa,portoTorres:P.portoTorres};

// ============ GRIMALDI LINES ============
const griA={agency_id:'grimaldi_lines',agency_name:'Grimaldi Lines',agency_url:'https://www.grimaldi-lines.com',agency_timezone:'Europe/Rome',agency_lang:'en',agency_phone:'+39 081 496 444'};

const griCivBar=mr('gr_civ_bar','gr_bar_civ','Cruise Roma','civitavecchia','barcelona',[{d:'20:00:00',a:'18:00:00',rd:'20:00:00',ra:'18:00:00'}]);
const griLivBar=mr('gr_liv_bar','gr_bar_liv','Cruise Barcelona','livorno','barcelona',[{d:'18:00:00',a:'17:00:00',rd:'18:00:00',ra:'17:00:00'}]);
const griCivPto=mr('gr_civ_pto','gr_pto_civ','Eurocargo Roma','civitavecchia','portoTorres',[{d:'19:00:00',a:'05:00:00',rd:'19:00:00',ra:'05:00:00'}]);
const griLivPal=mr('gr_liv_pal','gr_pal_liv','Eurocargo Valencia','livorno','palermo',[{d:'20:00:00',a:'10:00:00',rd:'20:00:00',ra:'10:00:00'}]);

const griR=[{rid:'gr_civ_bar',sn:'CIV-BCN',ln:'Civitavecchia - Barcelona (Grimaldi)'},{rid:'gr_bar_civ',sn:'BCN-CIV',ln:'Barcelona - Civitavecchia (Grimaldi)'},{rid:'gr_liv_bar',sn:'LIV-BCN',ln:'Livorno - Barcelona (Grimaldi)'},{rid:'gr_bar_liv',sn:'BCN-LIV',ln:'Barcelona - Livorno (Grimaldi)'},{rid:'gr_civ_pto',sn:'CIV-PTO',ln:'Civitavecchia - Porto Torres (Grimaldi)'},{rid:'gr_pto_civ',sn:'PTO-CIV',ln:'Porto Torres - Civitavecchia (Grimaldi)'},{rid:'gr_liv_pal',sn:'LIV-PMO',ln:'Livorno - Palermo (Grimaldi)'},{rid:'gr_pal_liv',sn:'PMO-LIV',ln:'Palermo - Livorno (Grimaldi)'}];
const griT=[...griCivBar,...griLivBar,...griCivPto,...griLivPal];
const griS={civitavecchia:P.civitavecchia,barcelona:P.barcelona,livorno:P.livorno,portoTorres:P.portoTorres,palermo:P.palermo};

// ============ CORSICA FERRIES ============
const corA={agency_id:'corsica_ferries',agency_name:'Corsica Ferries - Sardinia Ferries',agency_url:'https://www.corsica-ferries.co.uk',agency_timezone:'Europe/Paris',agency_lang:'en',agency_phone:'+33 825 095 095'};

const corNicBas=mr('cf_nic_bas','cf_bas_nic','Mega Express','nice','bastia',[{d:'08:00:00',a:'13:00:00',rd:'08:30:00',ra:'13:30:00'},{d:'20:00:00',a:'01:00:00',rd:'20:30:00',ra:'01:30:00'}]);
const corNicIro=mr('cf_nic_iro','cf_iro_nic','Mega Express Two','nice','lileRousse',[{d:'07:00:00',a:'11:00:00',rd:'07:30:00',ra:'11:30:00'}]);
const corTouAja=mr('cf_tou_aja','cf_aja_tou','Mega Smeralda','toulon','ajaccio',[{d:'19:00:00',a:'06:00:00',rd:'19:00:00',ra:'06:00:00'}]);
const corTouBas=mr('cf_tou_bas','cf_bas_tou','Pascal Lota','toulon','bastia',[{d:'08:00:00',a:'15:00:00',rd:'09:00:00',ra:'16:00:00'}]);
const corTouIro=mr('cf_tou_iro','cf_iro_tou','Mega Andrea','toulon','lileRousse',[{d:'09:00:00',a:'15:00:00',rd:'10:00:00',ra:'16:00:00'}]);
const corLivBas=mr('cf_liv_bas','cf_bas_liv','Mega Regina','livorno','bastia',[{d:'08:00:00',a:'12:00:00',rd:'13:00:00',ra:'17:00:00'}]);
const corSavBas=mr('cf_sav_bas','cf_bas_sav','Mega Victoria','savona','bastia',[{d:'20:00:00',a:'06:00:00',rd:'20:30:00',ra:'06:30:00'}]);
const corLivGol=mr('cf_liv_gol','cf_gol_liv','Mega Express Four','livorno','golfoAranci',[{d:'09:00:00',a:'15:00:00',rd:'10:00:00',ra:'16:00:00'}]);

const corR=[{rid:'cf_nic_bas',sn:'NCE-BAS',ln:'Nice - Bastia (Corsica Ferries)'},{rid:'cf_bas_nic',sn:'BAS-NCE',ln:'Bastia - Nice (Corsica Ferries)'},{rid:'cf_nic_iro',sn:'NCE-IRO',ln:"Nice - L'Île-Rousse (Corsica Ferries)"},{rid:'cf_iro_nic',sn:'IRO-NCE',ln:"L'Île-Rousse - Nice (Corsica Ferries)"},{rid:'cf_tou_aja',sn:'TLN-AJA',ln:'Toulon - Ajaccio (Corsica Ferries)'},{rid:'cf_aja_tou',sn:'AJA-TLN',ln:'Ajaccio - Toulon (Corsica Ferries)'},{rid:'cf_tou_bas',sn:'TLN-BAS',ln:'Toulon - Bastia (Corsica Ferries)'},{rid:'cf_bas_tou',sn:'BAS-TLN',ln:'Bastia - Toulon (Corsica Ferries)'},{rid:'cf_tou_iro',sn:'TLN-IRO',ln:"Toulon - L'Île-Rousse (Corsica Ferries)"},{rid:'cf_iro_tou',sn:'IRO-TLN',ln:"L'Île-Rousse - Toulon (Corsica Ferries)"},{rid:'cf_liv_bas',sn:'LIV-BAS',ln:'Livorno - Bastia (Corsica Ferries)'},{rid:'cf_bas_liv',sn:'BAS-LIV',ln:'Bastia - Livorno (Corsica Ferries)'},{rid:'cf_sav_bas',sn:'SAV-BAS',ln:'Savona - Bastia (Corsica Ferries)'},{rid:'cf_bas_sav',sn:'BAS-SAV',ln:'Bastia - Savona (Corsica Ferries)'},{rid:'cf_liv_gol',sn:'LIV-GOL',ln:'Livorno - Golfo Aranci (Corsica Ferries)'},{rid:'cf_gol_liv',sn:'GOL-LIV',ln:'Golfo Aranci - Livorno (Corsica Ferries)'}];
const corT=[...corNicBas,...corNicIro,...corTouAja,...corTouBas,...corTouIro,...corLivBas,...corSavBas,...corLivGol];
const corS={nice:P.nice,bastia:P.bastia,lileRousse:P.lileRousse,toulon:P.toulon,ajaccio:P.ajaccio,livorno:P.livorno,savona:P.savona,golfoAranci:P.golfoAranci,portoVecchio:P.portoVecchio};

// ============ BUILD ============
console.log('🚢 Generating Mediterranean GTFS feeds...\n');
const specs=[['gnv',gnvA,gnvR,gnvT,gnvS],['mobylines',mobyA,mobyR,mobyT,mobyS],['tirrenia',tirA,tirR,tirT,tirS],['grimaldi',griA,griR,griT,griS],['corsicaferries',corA,corR,corT,corS]];
specs.forEach(([n,a,r,t,s])=>{buildGTFS(path.join(FEEDS_DIR,n),a,r,t,s);zip(n,`${n}-gtfs.zip`);});
console.log('\n📊 Summary:');
specs.forEach(([n,,r,t,s])=>console.log(`  ${n}: ${r.length} routes | ${t.length} trips/day | ${Object.keys(s).length} stops`));
console.log('✨ Done!');
