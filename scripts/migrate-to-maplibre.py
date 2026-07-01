import re

filepath = r"\\LELYNAS\trackandtide\index.html"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the STATE section marker - just the line with "STATE"
lines = content.split('\n')
state_idx = -1
sw_idx = -1
for i, line in enumerate(lines):
    if line.strip() == 'STATE' and state_idx == -1:
        state_idx = i
    if 'SERVICE WORKER' in line and sw_idx == -1 and state_idx != -1:
        sw_idx = i

if state_idx == -1 or sw_idx == -1:
    print(f"ERROR: STATE at {state_idx}, SW at {sw_idx}")
else:
    before = '\n'.join(lines[:state_idx]) + '\n'
    after = '\n' + '\n'.join(lines[sw_idx:])
    print(f"STATE at line {state_idx+1}, SW at line {sw_idx+1}")
    
    new_map_code = '''/* =========================
   STATE
========================= */
let countryData = {};
let stationDataset = { countries: {} };
let ferryPortsData = [];
let allFerryRoutes = [];
let ferryPortsByCountry = {};
let stationsData = [];
let stationsBuilt = false;
let ferryPortsBuilt = false;
let currentSelectedCountry = null;
let lastSelectedCountry = null;
let selectedStationId = null;
let selectedPort = null;
let selectedFerryRouteName = null;
let visibleFerryRoutes = [];
let selectedCountryId = null;

const pendingStationId = new URLSearchParams(window.location.search).get("stationId");
const pendingPortId = new URLSearchParams(window.location.search).get("portId");

const countryZoomConfig = {
  "Netherlands": { center: [5.3, 52.1], zoom: 7 },
  "Germany": { center: [10.4, 51.2], zoom: 5 },
  "France": { center: [2.2, 46.6], zoom: 5 },
  "Italy": { center: [12.5, 42.8], zoom: 5 },
  "Spain": { center: [-3.7, 40.4], zoom: 5 },
  "United Kingdom": { center: [-2.5, 54.5], zoom: 5 },
  "Norway": { center: [11.0, 64.5], zoom: 4 },
  "Portugal": { center: [-8.0, 39.5], zoom: 6 },
  "Russia": { center: [100.0, 61.5], zoom: 2 },
  "Liechtenstein": { center: [9.55, 47.14], zoom: 10 }
};

function isMobileViewport() { return window.matchMedia("(max-width: 900px)").matches; }
function scrollMapToTop() {
  if (!isMobileViewport()) return;
  const mc = document.querySelector(".map-column");
  if (mc) mc.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => map.resize(), 300);
}
function scrollSidebarIntoView() { sidebar.scrollIntoView({ behavior: "smooth", block: "nearest" }); }

function cleanStationName(name) {
  return String(name||"").replace(/\\s+/g," ").replace(/^Bahnhof\\s+/i,"").replace(/^(Gare de|Gare du|Gare d'|Stazione di|Stazione|Estaci\\u00f3n de|Estaci\\u00f3n|Estacao de|Estacao)\\s+/i,"").replace(/\\s+(railway station|railway|train station|central station|bus station|metro station|airport|aeroport|a\\u00e9roport|flughafen|hauptbahnhof|hbf|bahnhof|station|gare|stazione|estaci\\u00f3n|estacao)$/i,"").trim();
}

function getStationCount(source) { return source?.counts?.total || source?.stations?.length || 0; }
function getStationSource(countryName) { return stationDataset.countries?.[countryName] || null; }
function findStationById(stationId) {
  for (const [cn, country] of Object.entries(stationDataset.countries || {})) {
    const station = (country.stations || []).find(s => s.id === stationId);
    if (station) return { station, countryName: cn };
  }
  return null;
}

/* =========================
   MAP SOURCES & LAYERS
========================= */
function buildStationsGeoJSON() {
  const features = stationsData.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng)).map(s => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
    properties: { id: s.id, name: s.name, country: s.country, operators: s.operators||[], source: s.source, url: s.url }
  }));
  return { type: 'FeatureCollection', features };
}

function buildFerryPortsGeoJSON() {
  const features = ferryPortsData.map(p => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    properties: { id: p.id, name: p.name, countries: p.countries||[], routeIds: p.routeIds||[] }
  }));
  return { type: 'FeatureCollection', features };
}

function ferryRouteToFeature(route) {
  return { type: 'Feature', geometry: { type: 'LineString', coordinates: route.coords.map(c => [c[1], c[0]]) }, properties: { name: route.name, operator: route.operator||'' } };
}

function addStationLayer() {
  if (map.getSource('stations')) return;
  map.addSource('stations', { type: 'geojson', data: buildStationsGeoJSON() });
  map.addLayer({ id: 'station-circles', type: 'circle', source: 'stations',
    paint: { 'circle-radius': ['interpolate',['linear'],['zoom'], 3,0.5, 5,1.5, 7,3, 9,5, 11,7, 13,9], 'circle-color': '#34d399', 'circle-opacity': 0.55, 'circle-stroke-width': 0 }
  });
  map.addLayer({ id: 'station-circles-selected', type: 'circle', source: 'stations', filter: ['==',['get','id'],''],
    paint: { 'circle-radius': ['+',['interpolate',['linear'],['zoom'], 3,0.5, 5,1.5, 7,3, 9,5, 11,7, 13,9], 2], 'circle-color': '#34d399', 'circle-opacity': 1, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' }
  });
  map.addLayer({ id: 'station-glow', type: 'circle', source: 'stations', filter: ['==',['get','id'],''],
    paint: { 'circle-radius': ['+',['interpolate',['linear'],['zoom'], 3,0.5, 5,1.5, 7,3, 9,5, 11,7, 13,9], 6], 'circle-color': '#fff', 'circle-opacity': 0.25, 'circle-stroke-width': 0 }
  });
  stationsBuilt = true;
}

function addFerryPortLayer() {
  if (map.getSource('ferry-ports')) return;
  map.addSource('ferry-ports', { type: 'geojson', data: buildFerryPortsGeoJSON() });
  map.addLayer({ id: 'ferry-port-circles', type: 'circle', source: 'ferry-ports',
    paint: { 'circle-radius': ['interpolate',['linear'],['zoom'], 3,2.5, 5,4, 7,6, 9,8, 11,10, 13,12], 'circle-color': '#38bdf8', 'circle-opacity': 0.7, 'circle-stroke-width': 0 }
  });
  ferryPortsBuilt = true;
}

function addFerryRouteLayers() {
  if (map.getSource('ferry-routes-bg')) return;
  map.addSource('ferry-routes-bg', { type: 'geojson', data: { type:'FeatureCollection', features:[] } });
  map.addLayer({ id: 'ferry-lines-bg', type: 'line', source: 'ferry-routes-bg', layout: {'line-cap':'round','line-join':'round'},
    paint: { 'line-color': '#38bdf8', 'line-width': 1.5, 'line-opacity': 0.08, 'line-dasharray': [8,12] }
  });
  map.addSource('ferry-route-highlight', { type: 'geojson', data: { type:'FeatureCollection', features:[] } });
  map.addLayer({ id: 'ferry-line-highlight', type: 'line', source: 'ferry-route-highlight', layout: {'line-cap':'round','line-join':'round'},
    paint: { 'line-color': '#38bdf8', 'line-width': 5, 'line-opacity': 0.95, 'line-dasharray': [12,10] }
  });
}

function addCountryLayer() {
  map.addSource('countries', { type: 'geojson', data: 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson' });
  map.addLayer({ id: 'country-fill', type: 'fill', source: 'countries', paint: { 'fill-color': '#64748b', 'fill-opacity': 0 } });
  map.addLayer({ id: 'country-outline', type: 'line', source: 'countries', paint: { 'line-color': '#64748b', 'line-width': 1 } });
  map.addLayer({ id: 'country-fill-selected', type: 'fill', source: 'countries', filter: ['==',['get','ADMIN'],''], paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.25 } });
  map.addLayer({ id: 'country-outline-selected', type: 'line', source: 'countries', filter: ['==',['get','ADMIN'],''], paint: { 'line-color': '#3b82f6', 'line-width': 2 } });
}

function setStationsVisible(v) {
  if (!stationsBuilt) addStationLayer();
  ['station-circles','station-circles-selected','station-glow'].forEach(id => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none');
  });
}

function setFerryPortsVisible(v) {
  if (!ferryPortsBuilt) addFerryPortLayer();
  if (map.getLayer('ferry-port-circles')) map.setLayoutProperty('ferry-port-circles', 'visibility', v ? 'visible' : 'none');
  if (!v) { clearFerryRouteLines(); clearFerryLines(); visibleFerryRoutes = []; }
}

/* =========================
   STATION INTERACTION
========================= */
function selectStation(station) {
  selectedStationId = station.id;
  map.setFilter('station-circles-selected', ['==',['get','id'], station.id]);
  map.setFilter('station-glow', ['==',['get','id'], station.id]);
  renderStationDetail(station);
  updateURL({ stationId: station.id });
  scrollSidebarIntoView();
}

function clearStationSelection() {
  selectedStationId = null;
  map.setFilter('station-circles-selected', ['==',['get','id'], '']);
  map.setFilter('station-glow', ['==',['get','id'], '']);
  const panel = document.getElementById("stationDetailPanel");
  if (panel) panel.innerHTML = "";
}

map.on('click', 'station-circles', (e) => {
  if (!e.features || !e.features.length) return;
  const props = e.features[0].properties;
  const station = stationsData.find(s => s.id === props.id);
  if (station) selectStation(station);
});

function selectCountryOnMap(geoName) {
  selectedCountryId = geoName;
  map.setFilter('country-fill-selected', ['==',['get','ADMIN'], geoName]);
  map.setFilter('country-outline-selected', ['==',['get','ADMIN'], geoName]);
  const zoomConfig = countryZoomConfig[geoName];
  if (zoomConfig) {
    map.flyTo({ center: zoomConfig.center, zoom: zoomConfig.zoom, duration: 1800 });
  }
}

map.on('click', 'country-fill', (e) => {
  if (!e.features || !e.features.length) return;
  const props = e.features[0].properties;
  const geoName = props.ADMIN || props.NAME || props.name || "Unknown";
  const isReselect = lastSelectedCountry === geoName;
  lastSelectedCountry = geoName;
  currentSelectedCountry = geoName;
  selectCountryOnMap(geoName);
  clearFerryRouteLines();
  clearStationSelection();
  selectedPort = null;
  const normalized = norm(geoName);
  const routeMatches = (allFerryRoutes||[]).filter(r => r.countries?.some(c => norm(c)===normalized) && !r.suspended);
  setVisibleFerryRoutes(routeMatches);
  renderCountrySidebar(geoName);
  scrollMapToTop();
});

map.on('click', (e) => {
  if (window._portBlock) { window._portBlock = false; return; }
  if (selectedPort) clearSelectedPort();
});

/* =========================
   FERRY ROUTES
========================= */
function clearFerryRouteLines() {
  if (map.getSource('ferry-route-highlight')) map.getSource('ferry-route-highlight').setData({ type:'FeatureCollection', features:[] });
  selectedFerryRouteName = null;
}

function clearFerryLines() {
  if (map.getSource('ferry-routes-bg')) map.getSource('ferry-routes-bg').setData({ type:'FeatureCollection', features:[] });
  visibleFerryRoutes = [];
}

function setVisibleFerryRoutes(routes) {
  if (!ferryPortsToggle.checked) return;
  visibleFerryRoutes = (routes||[]).filter(r => !r.suspended);
  if (map.getSource('ferry-routes-bg')) {
    map.getSource('ferry-routes-bg').setData({ type:'FeatureCollection', features: visibleFerryRoutes.map(ferryRouteToFeature) });
  }
}

function showFerryRoute(route, shouldFocus) {
  if (!ferryPortsToggle.checked) return;
  clearFerryRouteLines();
  if (!route) return;
  if (map.getSource('ferry-route-highlight')) {
    map.getSource('ferry-route-highlight').setData({ type:'FeatureCollection', features: [ferryRouteToFeature(route)] });
  }
  selectedFerryRouteName = route.name;
  if (shouldFocus !== false) focusFerryRoute(route);
}

function focusFerryRoute(route) {
  if (!route?.coords?.length) return;
  const bounds = new maplibregl.LngLatBounds();
  route.coords.forEach(c => bounds.extend([c[1], c[0]]));
  map.fitBounds(bounds, { padding: 35, maxZoom: 7 });
  scrollMapToTop();
}

function estimateCrossingTime(km) { const avgKph=35, hours=km/avgKph; if (hours<1) return Math.round(hours*60)+' min'; const h=Math.floor(hours), m=Math.round((hours-h)*60); return m?h+'h '+m+'min':h+'h'; }

/* =========================
   FERRY PORT CLICK
========================= */
map.on('click', 'ferry-port-circles', (e) => {
  if (!e.features || !e.features.length) return;
  const props = e.features[0].properties;
  const port = ferryPortsData.find(p => p.id === props.id);
  if (port) { window._portBlock = true; showPortRoutes(port); }
});

function showPortRoutes(port) {
  if (!port || !port.routeIds || !port.routeIds.length) return;
  const routes = allFerryRoutes.filter(r => port.routeIds.includes(r.id) && !r.suspended);
  clearFerryRouteLines(); clearFerryLines(); visibleFerryRoutes = []; selectedPort = port;
  if (map.getSource('ferry-route-highlight')) map.getSource('ferry-route-highlight').setData({ type:'FeatureCollection', features: routes.map(ferryRouteToFeature) });
  map.flyTo({ center: [port.lng, port.lat], zoom: 10, duration: 1500 });
  const uniqueOperators = [...new Set(routes.map(r => r.operator||"Unknown"))];
  const operatorPills = uniqueOperators.map(op => `<a class="pill" href="/operators?operator=${encodeURIComponent(op)}" target="_self" rel="noopener">${escapeHTML(op)}</a>`).join("");
  const routeList = routes.map(route => {
    const dist = route.coords?.length>=2 ? haversineKm(route.coords[0], route.coords[route.coords.length-1]) : null;
    return `<button type="button" class="route-item" data-route-name="${escapeHTML(route.name)}">${escapeHTML(route.name)}${dist?`<span class="route-dist">${dist} km \\u00b7 ~${estimateCrossingTime(dist)}</span>`:''}<span class="route-tag">${escapeHTML(route.operator||"")}</span></button>`;
  }).join("");
  const portsUrl = `/ports?portId=${encodeURIComponent(port.id)}`;
  document.getElementById("sidebarBody").innerHTML = `<div id="stationDetailPanel"></div><h2>${escapeHTML(port.name)}</h2><p class="country-description">${port.countries?.length?port.countries.join(", "):""} \\u00b7 ${routes.length} ferry route${routes.length>1?'s':''}</p>${operatorPills?`<div class="detail-pills-map">${operatorPills}</div>`:""}<div class="ferry-route-panel"><p class="route-help">Select a route to highlight it:</p><div class="route-list">${routeList}</div></div><div class="detail-links" style="margin-top:0.75rem;"><a class="detail-link" href="${portsUrl}" target="_self" rel="noopener">Full details</a></div><div id="mapComments_port"></div><button id="mapComments_portTipBtn" class="detail-link" style="margin-top:0.35rem;cursor:pointer;display:none" onclick="openMapTipModal('port','${escapeHTML(port.id)}','${escapeHTML(port.name)}')">Leave a comment</button>`;
  loadMapComments('port', port.id, 'mapComments_port');
  updateURL({ portId: port.id });
  document.querySelectorAll("#sidebarContent .route-item").forEach(button => {
    button.addEventListener("click", () => {
      const rn = button.dataset.routeName;
      const route = routes.find(r => r.name === rn);
      if (route) { clearFerryRouteLines(); showFerryRoute(route, false); document.querySelectorAll("#sidebarContent .route-item").forEach(item => item.classList.toggle("active", item===button)); focusFerryRoute(route); }
    });
  });
  if (routes.length && routes[0].coords?.length>=2) {
    const dist = haversineKm(routes[0].coords[0], routes[0].coords[routes[0].coords.length-1]);
    if (dist>1) document.getElementById('sidebarBody').insertAdjacentHTML('beforeend', renderCarbonPanel(dist));
  }
  scrollSidebarIntoView();
}

function clearSelectedPort() {
  clearFerryRouteLines(); selectedPort = null; updateURL({ portId: null });
  if (map.getSource('ferry-route-highlight')) map.getSource('ferry-route-highlight').setData({ type:'FeatureCollection', features:[] });
  if (currentSelectedCountry) {
    const normalized = norm(currentSelectedCountry);
    const routeMatches = (allFerryRoutes||[]).filter(r => r.countries?.some(c => norm(c)===normalized) && !r.suspended);
    setVisibleFerryRoutes(routeMatches);
    renderCountrySidebar(currentSelectedCountry);
  } else {
    clearFerryLines(); visibleFerryRoutes = [];
    document.getElementById("sidebarBody").innerHTML = `<div id="stationDetailPanel"></div><div class="count-badge" id="countBadge">${stationsData.length.toLocaleString()} stations \\u00b7 ${ferryPortsData.length} ports</div><h2>Track & Tide</h2><p>Select a country or ferry route.</p>`;
  }
}

/* =========================
   COUNTRY SIDEBAR
========================= */
function renderCountrySidebar(geoName) {
  const normalized = norm(geoName);
  const stationSource = getStationSource(geoName);
  const operators = (countryData?.operators||[]).filter(op => { const opCountries = op.countries||[op.country]; return opCountries.some(c => norm(c)===normalized); });
  const sortNat = (a,b) => { const aN=norm(a.country)===normalized, bN=norm(b.country)===normalized; if (aN!==bN) return aN?-1:1; return (a.name||"").localeCompare(b.name||""); };
  const trains = operators.filter(o => o.type==="trains").sort(sortNat);
  const ferryOps = operators.filter(o => o.type==="ferries").sort(sortNat);
  const routeMatches = (allFerryRoutes||[]).filter(r => r.countries?.some(c => norm(c)===normalized) && !r.suspended);
  const operatorRouteMap = {}; routeMatches.forEach(r => { const op=r.operator||"Unknown"; if(!operatorRouteMap[op]) operatorRouteMap[op]=[]; operatorRouteMap[op].push(r); });
  const renderOpCard = (op, routeBtns="") => `<details class="card" data-operator="${escapeHTML(op.name)}"><summary class="card-summary">${op.logo?`<img src="operator logos/${op.logo}" alt="${escapeHTML(op.name)} logo" class="card-logo" />`:""}<div class="card-body"><div class="card-title">${escapeHTML(op.name)}</div><div class="card-subtitle">${escapeHTML(op.operatorLabel||(op.type==='trains'?'Train operator':'Ferry operator'))}</div></div></summary><div class="card-extra">${op.description?`<div class="card-description">${escapeHTML(op.description)}</div>`:""}${op.website?`<a href="${op.website}" target="_blank" class="card-button card-button-primary">Visit website</a>`:""}<div class="app-badges">${op.appLinks?.android?`<a href="${op.appLinks.android}" target="_blank" class="app-badge"><img src="get_it_on_google_play.png" alt="Get it on Google Play"></a>`:""}${op.appLinks?.ios?`<a href="${op.appLinks.ios}" target="_blank" class="app-badge"><img src="get_it_on_apple.png" alt="Download on the App Store"></a>`:""}</div>${routeBtns}</div></details>`;
  const renderRouteBtns = (routes, opName) => routes.length?`<div class="route-list">${routes.map(r => `<button type="button" class="route-item" data-route-name="${escapeHTML(r.name)}" data-operator="${escapeHTML(opName)}">${escapeHTML(r.name)}${r.countries?.length?` <span class="route-tag">${escapeHTML(r.countries.join(" / "))}</span>`:""}</button>`).join("")}</div>`:"";
  const countryInfo = countryData?.countryInfo?.find(c => c.country===geoName);
  const countryDesc = countryInfo?.info||"";
  const sc = getStationCount(stationSource);
  document.getElementById("sidebarBody").innerHTML = `<div id="stationDetailPanel"></div><h2>${geoName}</h2>${countryDesc?`<p class="country-description">${escapeHTML(countryDesc)}</p>`:""}${stationSource?`<p class="station-count">${sc.toLocaleString()} stations in dataset</p>`:""}${trains.length?"<h3>Trains</h3>":""}${trains.map(op => renderOpCard(op)).join("")}${ferryOps.length?"<h3>Ferries</h3>":""}${ferryOps.map(op => renderOpCard(op, renderRouteBtns(operatorRouteMap[op.name]||[], op.name))).join("")}`;
  const passInfo = railPassInfo[geoName];
  if (passInfo) document.getElementById("sidebarBody").insertAdjacentHTML('beforeend', `<div class="pass-info"><div class="pass-info-title">\\ud83c\\udfab ${escapeHTML(passInfo.pass)}</div><div class="pass-info-desc">${escapeHTML(passInfo.desc)}</div></div>`);
  document.querySelectorAll(".route-item").forEach(button => { button.addEventListener("click", () => { const rn=button.dataset.routeName, opName=button.dataset.operator; const route=routeMatches.find(r => r.name===rn); if(route){ if(!ferryPortsToggle.checked){ferryPortsToggle.checked=true;setFerryPortsVisible(true);} showFerryRoute(route); document.querySelectorAll(".route-item").forEach(item => item.classList.toggle("active", item===button)); const card=Array.from(document.querySelectorAll('.card[data-operator]')).find(c => c.dataset.operator===opName); if(card) card.open=true; setTimeout(()=>{const ar=document.querySelector(".route-item.active");if(ar)ar.scrollIntoView({behavior:"smooth",block:"center"});},240); } }); });
}

/* =========================
   STATION DETAIL
========================= */
function renderStationDetailHTML(station) {
  if (!station) return '';
  const cleanName = cleanStationName(station.name);
  const operatorPills = (station.operators||[]).slice(0,3).map(op => `<a class="pill" href="/operators?operator=${encodeURIComponent(op)}" target="_self" rel="noopener">${escapeHTML(op)}</a>`).join('');
  const stationsUrl = '/stations?stationId='+encodeURIComponent(station.id);
  return `<div class="station-detail"><h3>${escapeHTML(cleanName)}</h3>${operatorPills?`<div class="detail-pills-map">${operatorPills}</div>`:''}<div class="detail-links" style="display:flex;gap:0.4rem;margin-bottom:0.5rem"><a class="detail-link" href="${stationsUrl}" target="_self">Full details</a><a class="detail-link" href="/?stationId=${encodeURIComponent(station.id)}" target="_self">View on map</a></div><div id="departuresPanel_${escapeHTML(station.id)}" class="departures-panel"></div></div>`;
}

async function renderStationDetail(station) {
  const panel = document.getElementById('stationDetailPanel');
  if (!panel) return;
  let html = renderStationDetailHTML(station);
  const favorited = isFavorite(station.id), checkedIn = isCheckedIn(station.id);
  const extra = `<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem"><span id="stationStarBtn" class="station-star${favorited?' favorited':''}" data-station-id="${station.id}" onclick="event.stopPropagation();toggleFavorite({id:'${station.id}',name:'${escapeHTML(station.name)}',country:'${escapeHTML(station.country||'')}',lat:${station.lat},lng:${station.lng}});updateStationStarBtn();renderFavoritesPanel();updateStatsBar()">${favorited?'\\u2b50 Saved':'\\u2606 Save'}</span><span id="checkinBtn" class="checkin-btn${checkedIn?' checked-in':''}" onclick="event.stopPropagation();toggleCheckin({id:'${station.id}',name:'${escapeHTML(station.name)}',country:'${escapeHTML(station.country||'')}'})">${checkedIn?'\\ud83d\\udccd Checked in! \\u2715':'\\ud83d\\udccd I\\'ve been here'}</span><span class="share-btn" onclick="event.stopPropagation();shareStation({id:'${station.id}'})">\\ud83d\\udd17 Share</span></div>`;
  const lastDiv = html.lastIndexOf('</div>');
  if (lastDiv>0) html = html.substring(0,lastDiv) + extra + '<div id="weatherWidget" class="weather-widget" style="display:none"></div>' + html.substring(lastDiv);
  panel.innerHTML = html;
  scrollSidebarIntoView();
  fetchAndRenderDepartures(station);
  renderWeatherWidget(station);
  updateStatsBar();
  injectNearbyStations(station, panel);
}

function injectNearbyStations(station, panel) {
  if (!station||!stationsData.length) return;
  const nearby = stationsData.filter(s => s.id!==station.id).map(s => ({...s, distance: haversineKm([station.lat,station.lng],[s.lat,s.lng])})).filter(s => s.distance<=80).sort((a,b)=>a.distance-b.distance).slice(0,5);
  if (!nearby.length) return;
  panel.insertAdjacentHTML('beforeend', '<div style="margin-top:0.6rem;font-size:0.82rem;opacity:0.7">\\ud83d\\udccd Nearby stations</div>'+nearby.map(s => `<div style="font-size:0.8rem;padding:0.25rem 0;cursor:pointer;border-bottom:1px solid var(--border)" onclick="event.stopPropagation();goToStation('${s.id}')">${escapeHTML(s.name)} <span style="opacity:0.5">${s.distance} km</span></div>`).join(''));
  if (nearby[0]) panel.insertAdjacentHTML('beforeend', renderCarbonPanel(nearby[0].distance));
}

function goToStation(stationId) {
  const station = stationsData.find(s => s.id===stationId);
  if (station) { selectStation(station); map.flyTo({ center: [station.lng, station.lat], zoom: 13, duration: 1500 }); }
}

/* =========================
   DEPARTURES
========================= */
async function fetchAndRenderDepartures(station) {
  const panelId = 'departuresPanel_'+escapeHTML(station.id);
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.style.display='block'; panel.innerHTML='<div class="dep-loading">Loading departures...</div>';
  const stationName=cleanStationName(station.name), country=station.country||'';
  try {
    const resp = await fetch('/api/departures?name='+encodeURIComponent(stationName)+'&country='+encodeURIComponent(country));
    if (!resp.ok) throw new Error('HTTP '+resp.status);
    const data = await resp.json();
    if (data.error) { panel.innerHTML='<div class="dep-error">'+escapeHTML(data.error)+'</div>'; return; }
    const allDeps = data.departures||[];
    if (!allDeps.length) { panel.innerHTML='<div class="dep-empty">No upcoming departures found</div>'; return; }
    panel._allDeps=allDeps; panel._stationId=station.id; panel._showLocal=false; panel._showCount=10;
    renderDepartureList(panel);
  } catch(err) { panel.innerHTML='<div class="dep-error">Could not load departures<div class="dep-refresh" onclick="refreshDepartures(\\''+escapeHTML(station.id)+'\\')">Retry</div></div>'; }
}

function renderDepartureList(panel) {
  const showLocal=panel._showLocal||false, allDeps=panel._allDeps||[], stationId=panel._stationId||'', showCount=panel._showCount||10;
  const hideModes=showLocal?[]:['BUS','TRAM','METRO','SUBWAY','FUNICULAR','GONDOLA','CABLE_CAR'];
  const filtered=allDeps.filter(d => !hideModes.includes(d.mode||''));
  const deps=filtered.slice(0,showCount), hasMore=filtered.length>showCount;
  if (!deps.length) { panel.innerHTML='<div class="dep-empty">No departures. <label class="dep-local-label"><input type="checkbox" '+(showLocal?'checked':'')+' onchange="var p=document.getElementById(\\'departuresPanel_'+escapeHTML(stationId)+'\\');p._showLocal=this.checked;p._showCount=10;renderDepartureList(p)"> Show bus, tram, metro</label></div>'; return; }
  const modeIcon = m => { if(['INTERCITY','HIGHSPEED_RAIL','LONG_DISTANCE','NIGHT_RAIL'].includes(m)) return 'high_speed_train.png'; if(['REGIONAL','REGIONAL_RAIL','SUBURBAN'].includes(m)) return 'train.png'; if(m==='TRAM') return 'tram.png'; if(m==='BUS'||m==='COACH') return 'bus.png'; if(m==='METRO'||m==='SUBWAY') return 'metro.png'; return null; };
  const isLight=root.classList.contains('light');
  let html='<div class="departures-header"><span>Departures</span><span class="dep-count">'+showCount+' of '+filtered.length+'</span></div><label class="dep-local-label"><input type="checkbox" '+(showLocal?'checked':'')+' onchange="var p=document.getElementById(\\'departuresPanel_'+escapeHTML(stationId)+'\\');p._showLocal=this.checked;p._showCount=10;renderDepartureList(p)"> Show bus, tram, metro</label><div class="departures-list">';
  for (const dep of deps) {
    const time=dep.when?new Date(dep.when):null, plannedTime=dep.plannedWhen?new Date(dep.plannedWhen):null;
    const timeStr=time?time.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'--:--', plannedStr=plannedTime?plannedTime.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'';
    const delay=dep.delayMinutes, isDelayed=delay!=null&&delay>0, isCancelled=dep.cancelled;
    const lineName=dep.line?.name||'', direction=dep.direction||'', platform=dep.platform||'', mode=dep.mode||'', icon=modeIcon(mode);
    let timeHtml='';
    if(isCancelled) timeHtml='<div class="dep-time dep-cancelled">'+plannedStr+'</div><span class="dep-cancelled-badge">Cancelled</span>';
    else if(isDelayed) timeHtml='<div class="dep-time dep-delayed">'+timeStr+'</div><div class="dep-planned">'+plannedStr+'</div><span class="dep-delay">+'+delay+'m</span>';
    else timeHtml='<div class="dep-time">'+timeStr+'</div>';
    const iconHtml=icon?'<img class="dep-icon'+(isLight?'':' dep-icon-invert')+'" src="transport icons/'+icon+'" width="18" height="18" alt="">':'';
    html+='<div class="dep-row"><div>'+timeHtml+'</div><div class="dep-direction">'+iconHtml+(lineName?'<span class="dep-line '+(mode==='INTERCITY'?'dep-line-ic':mode==='REGIONAL'?'dep-line-r':'')+'">'+escapeHTML(lineName)+'</span>':'')+escapeHTML(direction)+'</div><div class="dep-platform">'+(platform?'Pl. '+escapeHTML(platform):'')+'</div></div>';
  }
  html+='</div>';
  if(hasMore) html+='<div class="dep-more" onclick="var p=document.getElementById(\\'departuresPanel_'+escapeHTML(stationId)+'\\');p._showCount=(p._showCount||10)+10;renderDepartureList(p)">Load 10 more \\u2193</div>';
  html+='<div class="dep-refresh" onclick="refreshDepartures(\\''+escapeHTML(stationId)+'\\')">Refresh \\u21bb</div>';
  html+='<a class="dep-detail-link" href="/stations?stationId='+encodeURIComponent(stationId)+'" target="_self">Full station details \\u2192</a>';
  panel.innerHTML=html;
}

function refreshDepartures(stationId) {
  const depPanel=document.getElementById('departuresPanel_'+stationId);
  if (depPanel?._allDeps) { renderDepartureList(depPanel); }
  else { const station=stationsData.find(s => s.id===stationId); if(station) fetchAndRenderDepartures(station); }
}

/* =========================
   TOGGLES
========================= */
stationToggle.addEventListener("change", () => setStationsVisible(stationToggle.checked));
ferryPortsToggle.addEventListener("change", () => setFerryPortsVisible(ferryPortsToggle.checked));

/* =========================
   DATA LOADING
========================= */
map.on('load', () => {
  addStationLayer(); setStationsVisible(stationToggle.checked);
  addFerryRouteLayers(); addCountryLayer();

  const DV = '?v=20260626';
  Promise.all([
    fetch("./data.json"+DV).then(r => r.json()).catch(()=>({})),
    fetch("./ferries.json"+DV).then(r => r.json()).catch(()=>({routes:[]})),
    fetch("./stations.json"+DV).then(r => r.ok?r.json():{countries:{}}).catch(()=>({countries:{}})),
    fetch("./ferry_ports.json"+DV).then(r => r.json()).catch(()=>({ports:[],routes:[]}))
  ]).then(([data, f, stations, fp]) => {
    countryData = data; stationDataset = stations||{countries:{}}; ferryPortsData = fp.ports||[]; allFerryRoutes = f.routes||[];
    stationsData = [];
    for (const [countryName, country] of Object.entries(stationDataset.countries||{})) {
      (country.stations||[]).forEach(s => { stationsData.push({...s, country:countryName, name:cleanStationName(s.name), lat:Number(s.lat), lng:Number(s.lng), operators:Array.isArray(s.operators)?s.operators:[]}); });
    }
    stationsData = stationsData.filter(s => s.name&&Number.isFinite(s.lat)&&Number.isFinite(s.lng));
    map.getSource('stations').setData(buildStationsGeoJSON());
    ferryPortsByCountry = {};
    ferryPortsData.forEach(p => { (p.countries||[]).forEach(c => { const cKey=norm(c); if(!ferryPortsByCountry[cKey]) ferryPortsByCountry[cKey]=[]; ferryPortsByCountry[cKey].push(p.id); }); });
    addFerryPortLayer(); setFerryPortsVisible(ferryPortsToggle.checked);
    buildSearchIndex(); updateCountBadge(); renderFavoritesPanel(); updateStatsBar();
    if (pendingStationId) {
      const match = findStationById(pendingStationId);
      if (match) {
        const { station, countryName } = match;
        currentSelectedCountry = countryName;
        stationToggle.checked = true; setStationsVisible(true);
        selectCountryOnMap(countryName);
        setTimeout(() => { selectStation(station); map.flyTo({ center: [station.lng, station.lat], zoom: 13, duration: 1500 }); }, 1000);
      }
    }
    if (pendingPortId) { const port = ferryPortsData.find(p => p.id===pendingPortId); if(port){ferryPortsToggle.checked=true;setFerryPortsVisible(true);showPortRoutes(port);} }
  });
});

'''

    new_content = before + new_map_code + after
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("SUCCESS: Map section replaced with Maplibre GL JS code")
