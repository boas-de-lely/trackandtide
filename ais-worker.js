// AIS proxy — fetches from free Digitraffic API (Baltic/Nordic)
// Also tries aisstream.io WebSocket if available

async function fetchDigitraffic() {
  try {
    const resp = await fetch("https://meri.digitraffic.fi/api/v1/locations/latest");
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.features || []).map(f => ({
      mmsi: f.mmsi || 0,
      name: (f.properties?.name || "").trim(),
      lat: f.geometry?.coordinates[1],
      lng: f.geometry?.coordinates[0],
      heading: f.properties?.heading || 0,
      dest: (f.properties?.destination || "").trim()
    })).filter(v => Number.isFinite(v.lat) && Number.isFinite(v.lng));
  } catch(e) { return []; }
}

let cache = { data: [], ts: 0 };

export default {
  async fetch(_req) {
    if (Date.now() - cache.ts > 15000) {
      const data = await fetchDigitraffic();
      if (data.length) cache = { data, ts: Date.now() };
    }
    return new Response(JSON.stringify(cache.data), {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      }
    });
  }
}
