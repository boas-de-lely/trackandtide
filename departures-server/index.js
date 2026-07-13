const http = require('http');
const cache = new Map(), TTL = 60000;

function get(host, port, path) {
  return new Promise((ok, fail) => {
    http.get({ hostname: host, port: port, path, timeout: 12000, headers: { 'User-Agent': 'trackandtide/5.0' } }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => {
        if (r.statusCode !== 200) { fail(new Error('HTTP ' + r.statusCode)); return; }
        try { ok(JSON.parse(d)) } catch (e) { fail(new Error('Invalid JSON')); }
      });
    }).on('error', fail);
  });
}

// Server-side itinerary filter: only allow train & ferry legs
function filterItineraries(data, modeStr) {
  var itineraries = (data && data.plan && data.plan.itineraries) || (data && data.itineraries);
  if (!itineraries || !Array.isArray(itineraries)) { console.log('[filter] WARNING: no itineraries found in response'); return; }
  var before = itineraries.length;

  // Collect all unique modes for debugging
  var allModes = {};
  itineraries.forEach(function(it) {
    (it.legs||[]).forEach(function(leg) {
      allModes[(leg.mode||'UNKNOWN')] = (leg.routeShortName||leg.route||'');
    });
  });
  console.log('[filter] all modes in response:', JSON.stringify(allModes));

  // Blocklist: anything containing these words is excluded
  var blocked = ['BUS', 'COACH', 'TRAM', 'SUBWAY', 'METRO', 'GONDOLA', 'CABLE_CAR', 'FUNICULAR', 'TRANSIT'];

  var filtered = itineraries.filter(function(it) {
    return (it.legs||[]).every(function(leg) {
      var m = (leg.mode||'').toUpperCase();
      for (var i = 0; i < blocked.length; i++) {
        if (m.indexOf(blocked[i]) >= 0) {
          console.log('[filter] DROPPED itinerary — leg mode: ' + leg.mode + ' route: ' + (leg.routeShortName||leg.route||'') + ' agency: ' + (leg.agencyName||''));
          return false;
        }
      }
      return true;
    });
  });

  if (data.plan) { data.plan.itineraries = filtered; }
  else { data.itineraries = filtered; }
  console.log('[filter] ' + before + ' → ' + filtered.length + ' itineraries');
}

function delayMin(scheduled, actual) {
  if (!scheduled || !actual) return null;
  return Math.round((new Date(actual) - new Date(scheduled)) / 60000);
}

// Override mode based on headsign keywords
function detectMode(headsign, routeShortName, mode) {
  const h = (headsign || '').toLowerCase();
  const r = (routeShortName || '').toLowerCase();
  const combined = h + ' ' + r;
  if (/\bintercity\b|^ic\s|^ice\s|^ec\s|tgv|eurostar|thalys|railjet|nightjet|^rj\s|supercity|^nj\s/.test(combined)) return 'INTERCITY';
  if (/\bsprinter\b|regional|^re\s|^rb\s|^r\s|stoptrein|local/.test(combined)) return 'REGIONAL';
  if (mode === 'LONG_DISTANCE' || mode === 'HIGHSPEED_RAIL' || mode === 'NIGHT_RAIL') return 'INTERCITY';
  if (mode === 'REGIONAL_RAIL') return 'REGIONAL';
  return mode;
}

async function fetchMotisDepartures(name) {
  const locs = await get('192.168.188.170', 8080, '/api/v1/geocode?text=' + encodeURIComponent(name));
  if (!Array.isArray(locs) || !locs.length) return null;
  const s = locs[0];
  if (!s.lat || !s.lon) return null;
  const data = await get('192.168.188.170', 8080, '/api/v1/stoptimes?center=' + s.lat + ',' + s.lon + '&radius=1500&n=200');
  const times = data.stopTimes || [];
  if (!times.length) return null;

  const now = new Date();
  const deps = times.map(t => {
    const p = t.place || {};
    const scheduled = p.scheduledDeparture || null;
    const actual = p.departure || scheduled;
    const mode = detectMode(t.headsign, t.routeShortName, t.mode);
    return {
      when: actual,
      plannedWhen: scheduled,
      platform: p.scheduledTrack || p.track || null,
      direction: t.headsign || '',
      line: { name: t.routeShortName || '', product: mode },
      mode: mode,
      agencyName: t.agencyName || '',
      cancelled: p.cancelled || t.tripCancelled || false,
      realTime: t.realTime || false,
      delayMinutes: delayMin(scheduled, actual)
    };
  }).filter(d => {
    if (!d.when) return false;
    return new Date(d.when) > new Date(now - 120000);
  });

  return { departures: deps, station: { name: s.name || name } };
}

require('http').createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const u = new URL(req.url, 'http://localhost');

  if (u.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"status":"ok"}');
  }

  if (u.pathname === '/departures') {
    // Journey planner mode: /departures?action=plan&fromPlace=...&toPlace=...
    if (u.searchParams.get('action') === 'plan') {
      try {
        let params = new URLSearchParams();
        params.set('fromPlace', u.searchParams.get('fromPlace') || '');
        params.set('toPlace', u.searchParams.get('toPlace') || '');
        params.set('departureTime', u.searchParams.get('departureTime') || u.searchParams.get('time') || '');
        params.set('mode', u.searchParams.get('mode') || 'RAIL');
        params.set('numItineraries', u.searchParams.get('numItineraries') || '6');
        params.set('maxWalkDistance', u.searchParams.get('maxWalkDistance') || '1000');
        params.set('walkSpeed', u.searchParams.get('walkSpeed') || '1.4');
        const motisPath = '/api/v1/plan?' + params.toString();
        console.log('[plan via departures] proxying to MOTIS:', motisPath);
        const data = await get('192.168.188.170', 8080, motisPath);
        // Server-side filter: exclude bus/coach/tram/metro — only train & ferry
        filterItineraries(data, params.get('mode') || 'RAIL');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (e) {
        console.error('[plan via departures] error:', e.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
    // Normal departures mode
    const name = u.searchParams.get('name');
    if (!name) { res.writeHead(400); return res.end('{"error":"missing name"}'); }
    const key = name.toLowerCase();
    const c = cache.get(key);
    if (c && Date.now() - c.ts < TTL) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(c.data));
    }
    try {
      const r = await fetchMotisDepartures(name);
      if (!r || !r.departures.length) { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end('{"error":"no departures"}'); }
      cache.set(key, { data: r, ts: Date.now() });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(r));
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Proxy /plan to MOTIS for journey planning
  if (u.pathname === '/plan') {
    try {
      // MOTIS expects 'departureTime', not 'time' — transform if needed
      let params = new URLSearchParams(u.search);
      if (params.has('time') && !params.has('departureTime')) {
        params.set('departureTime', params.get('time'));
        params.delete('time');
      }
      const motisPath = '/api/v1/plan?' + params.toString();
      console.log('[plan] proxying to MOTIS:', motisPath);
      const data = await get('192.168.188.170', 8080, motisPath);
      // Server-side filter: exclude bus/coach/tram/metro — only train & ferry
      filterItineraries(data, params.get('mode') || 'RAIL');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (e) {
      console.error('[plan] error:', e.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  res.writeHead(404); res.end('{"error":"use /departures, /plan, or /health"}');
}).listen(3098, '0.0.0.0', () => console.log('ready'));
