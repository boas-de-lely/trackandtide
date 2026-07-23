const https = require('https');
const http = require('http');

// Transitous API (MOTIS) configuration
const MOTIS_HOST = 'api.transitous.org';
const MOTIS_PORT = 443;
const MOTIS_BASE = '/api';
const UA = 'trackandtide/5.0 (https://trackandtide.com)';

const cache = new Map(), TTL = 60000;

function get(path) {
  return new Promise((ok, fail) => {
    https.get({ hostname: MOTIS_HOST, port: MOTIS_PORT, path, timeout: 12000, headers: { 'User-Agent': UA } }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => {
        if (r.statusCode !== 200) { fail(new Error('HTTP ' + r.statusCode)); return; }
        try { ok(JSON.parse(d)) } catch (e) { fail(new Error('Invalid JSON')); }
      });
    }).on('error', fail);
  });
}

function post(path, body) {
  return new Promise((ok, fail) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: MOTIS_HOST, port: MOTIS_PORT, path: path, method: 'POST',
      timeout: 15000,
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(opts, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => {
        if (r.statusCode !== 200) { fail(new Error('HTTP ' + r.statusCode)); return; }
        try { ok(JSON.parse(d)) } catch (e) { fail(new Error('Invalid JSON')); }
      });
    });
    req.on('error', fail);
    req.write(data);
    req.end();
  });
}

// Rail, ferry & bus modes sent to MOTIS (BUS included for rail replacement services)
const RAIL_MODES = ['HIGHSPEED_RAIL', 'LONG_DISTANCE', 'NIGHT_RAIL', 'REGIONAL_RAIL', 'SUBURBAN', 'FERRY', 'BUS'];

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

async function fetchMotisDepartures(name, lat, lng) {
  var centerLat, centerLng, stationName = name;

  if (lat != null && lng != null) {
    // Use provided coordinates directly
    centerLat = lat; centerLng = lng;
  } else {
    // Fall back to geocoding by name
    const locs = await get(MOTIS_BASE + '/v1/geocode?text=' + encodeURIComponent(name));
    if (!Array.isArray(locs) || !locs.length) return null;
    const s = locs[0];
    if (!s.lat || !s.lon) return null;
    centerLat = s.lat; centerLng = s.lon;
    stationName = s.name || name;
  }

  const data = await get(MOTIS_BASE + '/v6/stoptimes?center=' + centerLat + ',' + centerLng + '&radius=1500&n=200');
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

  return { departures: deps, station: { name: stationName } };
}

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const u = new URL(req.url, 'http://localhost');

  if (u.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"status":"ok"}');
  }

  // Proxy geocode requests directly to MOTIS (used by system-status health check)
  if (u.pathname === '/geocode') {
    try {
      var text = u.searchParams.get('text') || '';
      var geo = await get(MOTIS_BASE + '/v1/geocode?text=' + encodeURIComponent(text));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(geo));
    } catch(e) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      return res.end('{"error":"' + e.message + '"}');
    }
  }

  if (u.pathname === '/departures') {
    // Isochrone mode: /departures?action=isochrones&lat=...&lng=...&maxDuration=...
    if (u.searchParams.get('action') === 'isochrones') {
      try {
        const lat = u.searchParams.get('lat');
        const lng = u.searchParams.get('lng');
        const maxDuration = u.searchParams.get('maxDuration') || '60';
        if (!lat || !lng) { res.writeHead(400); return res.end('{"error":"missing lat/lng"}'); }
        // First reverse-geocode to find a stop ID at these coordinates
        var stopId = null;
        try {
          var geo = await get(MOTIS_BASE + '/v1/reverse-geocode?place=' + lat + ',' + lng + '&type=STOP&numResults=1');
          if (Array.isArray(geo) && geo.length > 0 && geo[0].id) {
            stopId = geo[0].id;
            console.log('[isochrones] reverse-geocode OK:', lat + ',' + lng, '→', stopId, '(' + geo[0].name + ')');
          } else {
            console.log('[isochrones] reverse-geocode: no STOP found at', lat + ',' + lng, 'response:', JSON.stringify(geo).substring(0, 200));
          }
        } catch(ge) {
          console.log('[isochrones] reverse-geocode error:', ge.message);
        }
        const one = stopId || (lat + ',' + lng);
        const time = u.searchParams.get('time') || '';
        var motisPath = MOTIS_BASE + '/v6/one-to-all?one=' + encodeURIComponent(one) + '&maxTravelTime=' + maxDuration + '&transitModes=' + RAIL_MODES.join(',') + '&preTransitModes=WALK&postTransitModes=WALK';
        if (time) motisPath += '&time=' + encodeURIComponent(time);
        console.log('[isochrones] one=' + one + ' maxTravelTime=' + maxDuration + ' GET:', motisPath.substring(0, 200));
        const data = await get(motisPath);
        console.log('[isochrones] response keys:', data ? Object.keys(data).join(', ') : 'null');
        console.log('[isochrones] all count:', data && data.all ? data.all.length : 0);
        if (data && data.all && data.all.length > 0) {
          console.log('[isochrones] first:', JSON.stringify(data.all[0]).substring(0, 200));
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (e) {
        console.error('[isochrones] error:', e.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
    // Journey planner mode: /departures?action=plan&fromPlace=...&toPlace=...
    if (u.searchParams.get('action') === 'plan') {
      try {
        let params = new URLSearchParams();
        params.set('fromPlace', u.searchParams.get('fromPlace') || '');
        params.set('toPlace', u.searchParams.get('toPlace') || '');
        // MOTIS expects 'time', not 'departureTime'
        params.set('time', u.searchParams.get('departureTime') || u.searchParams.get('time') || '');
        if (u.searchParams.get('arriveBy') === 'true') params.set('arriveBy', 'true');
        if (u.searchParams.get('minTransferTime')) params.set('minTransferTime', u.searchParams.get('minTransferTime'));
        if (u.searchParams.get('pageCursor')) {
          params.set('pageCursor', u.searchParams.get('pageCursor'));
          console.log('[plan via departures] pageCursor:', u.searchParams.get('pageCursor').substring(0, 60) + '...');
        }
        // Resolve via coordinates to MOTIS stop IDs via reverse-geocode
        var viaCoords = u.searchParams.getAll('via');
        for (var i = 0; i < viaCoords.length; i++) {
          var coords = viaCoords[i];
          if (!coords) continue;
          try {
            var geo = await get(MOTIS_BASE + '/v1/reverse-geocode?place=' + encodeURIComponent(coords) + '&type=STOP&numResults=1');
            if (Array.isArray(geo) && geo.length > 0 && geo[0].id) {
              params.append('via', geo[0].id);
              console.log('[plan via] reverse-geocode: ' + coords + ' → ' + geo[0].id + ' (' + geo[0].name + ')');
            } else {
              console.warn('[plan via] no STOP found for coords: ' + coords);
            }
          } catch (e) {
            console.warn('[plan via] reverse-geocode error for ' + coords + ': ' + e.message);
          }
        }
        params.set('numItineraries', u.searchParams.get('numItineraries') || '6');
        params.set('maxPreTransitTime', u.searchParams.get('maxWalkDistance') || '900');
        params.set('maxPostTransitTime', u.searchParams.get('maxWalkDistance') || '900');
        params.set('maxDirectTime', '1800');
        params.set('pedestrianSpeed', u.searchParams.get('walkSpeed') || '1.4');
        params.set('transitModes', RAIL_MODES.join(','));
        params.set('pedestrianProfile', 'FOOT');
        params.set('useRoutedTransfers', 'false');
        const motisPath = MOTIS_BASE + '/v6/plan?' + params.toString();
        console.log('[plan via departures] GET MOTIS:', motisPath.substring(0, 200) + '...');
        const data = await get(motisPath);
        if (data) {
          console.log('[plan via departures] response keys:', Object.keys(data).join(', '));
          if (data.previousPageCursor) console.log('[plan via departures] top prevCursor:', data.previousPageCursor.substring(0, 60) + '...');
          if (data.nextPageCursor) console.log('[plan via departures] top nextCursor:', data.nextPageCursor.substring(0, 60) + '...');
          if (data.metadata) console.log('[plan via departures] metadata keys:', Object.keys(data.metadata).join(', '));
          if (data.plan) {
            console.log('[plan via departures] plan keys:', Object.keys(data.plan).join(', '));
          }
        }
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
    const lat = u.searchParams.get('lat'), lng = u.searchParams.get('lng');
    const key = (name + '|' + (lat||'') + ',' + (lng||'')).toLowerCase();
    const c = cache.get(key);
    if (c && Date.now() - c.ts < TTL) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(c.data));
    }
    try {
      const r = await fetchMotisDepartures(name, lat, lng);
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
      let params = new URLSearchParams(u.search);
      // MOTIS expects 'time', client may send 'departureTime' — normalize to 'time'
      if (params.has('departureTime') && !params.has('time')) {
        params.set('time', params.get('departureTime'));
        params.delete('departureTime');
      }
      params.set('transitModes', RAIL_MODES.join(','));
      params.set('pedestrianProfile', 'FOOT');
      params.set('useRoutedTransfers', 'false');
      const motisPath = MOTIS_BASE + '/v6/plan?' + params.toString();
      console.log('[plan] GET MOTIS:', motisPath);
      const data = await get(motisPath);
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
