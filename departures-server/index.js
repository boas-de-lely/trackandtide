const https = require('https');
const cache = new Map(), TTL = 60000;

function get(host, path) {
  return new Promise((ok, fail) => {
    https.get({ hostname: host, path, timeout: 12000, headers: { 'User-Agent': 'trackandtide/5.0' } }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => {
        if (r.statusCode !== 200) { fail(new Error('HTTP ' + r.statusCode)); return; }
        try { ok(JSON.parse(d)) } catch (e) { fail(new Error('Invalid JSON')); }
      });
    }).on('error', fail);
  });
}

function delayMin(scheduled, actual) {
  if (!scheduled || !actual) return null;
  return Math.round((new Date(actual) - new Date(scheduled)) / 60000);
}

// Override MOTIS mode based on headsign keywords
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

async function tryMotis(name) {
  const locs = await get('api.transitous.org', '/api/v1/geocode?text=' + encodeURIComponent(name));
  if (!Array.isArray(locs) || !locs.length) return null;
  const s = locs[0];
  if (!s.lat || !s.lon) return null;
  const data = await get('api.transitous.org', '/api/v1/stoptimes?center=' + s.lat + ',' + s.lon + '&radius=1500&n=200');
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

async function trySwiss(name) {
  const data = await get('transport.opendata.ch', '/v1/stationboard?station=' + encodeURIComponent(name) + '&limit=20');
  const board = data.stationboard || [];
  if (!board.length) return null;
  const deps = board.map(d => ({
    when: d.stop?.prognosis?.departure || d.stop?.departure || null,
    plannedWhen: d.stop?.departure || null,
    platform: d.stop?.platform || null,
    direction: d.to || d.name || '',
    line: { name: (d.category || '') + (d.number ? ' ' + d.number : ''), product: d.category || 'REGIONAL_RAIL' },
    mode: /^IC|^EC|^ICE/.test(d.category || '') ? 'INTERCITY' : /^S/.test(d.category || '') ? 'SUBURBAN' : /^IR|^RE|^R/.test(d.category || '') ? 'REGIONAL' : d.category || '',
    agencyName: d.operator || '',
    cancelled: false, realTime: !!d.stop?.prognosis,
    delayMinutes: d.stop?.delay != null ? d.stop.delay : (d.stop?.prognosis?.departure && d.stop?.departure ? Math.round((new Date(d.stop.prognosis.departure) - new Date(d.stop.departure)) / 60000) : 0)
  }));
  return { departures: deps, station: { name: data.station?.name || name } };
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
    const name = u.searchParams.get('name');
    if (!name) { res.writeHead(400); return res.end('{"error":"missing name"}'); }
    const key = name.toLowerCase();
    const c = cache.get(key);
    if (c && Date.now() - c.ts < TTL) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(c.data));
    }
    try {
      let r = await tryMotis(name);
      if (!r || !r.departures.length) r = await trySwiss(name);
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
  res.writeHead(404); res.end('{"error":"use /departures or /health"}');
}).listen(3098, '0.0.0.0', () => console.log('ready'));
