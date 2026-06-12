// ais-proxy.js — Node.js built-in WebSocket (v24+)
// Run: node --experimental-websocket ais-proxy.js

const http = require("http");
let vessels = new Map();
let msgCount = 0;

function connect() {
  const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");

  ws.addEventListener("open", () => {
    console.log("Connected, sending subscription...");
    ws.send(JSON.stringify({
      Apikey: "172f05825d0490c61bde1f4ccfae8887809a5ef7",
      BoundingBoxes: [[[35, -25], [72, 45]]],
      FilterMessageTypes: ["PositionReport", "ShipStaticData", "StaticDataReport"]
    }));
  });

  ws.addEventListener("message", async (event) => {
    msgCount++;
    try {
      const raw = typeof event.data === "string" ? event.data : await event.data.text();
      const msg = JSON.parse(raw);
      if (msgCount === 1) {
        console.log("First msg type:", msg.MessageType);
        if (msg.MetaData) console.log("MetaData:", JSON.stringify(msg.MetaData).substring(0, 120));
      }
      if (msg.error) return;
      const meta = msg.MetaData;
      if (!meta) return;
      // Also handle StaticDataReport (more common than ShipStaticData)
      if (msg.MessageType === "StaticDataReport" && msg.Message?.StaticDataReport) {
        const sd = msg.Message.StaticDataReport;
        const key = sd.UserID;
        const st = sd.ReportB?.ShipType || sd.ReportA?.ShipType;
        if (vessels.has(key) && st != null) {
          vessels.get(key).shipType = st;
        }
        return;
      }

      if (msg.MessageType === "ShipStaticData" && msg.Message?.ShipStaticData) {
        const sd = msg.Message.ShipStaticData;
        const key = sd.UserID;
        if (vessels.has(key)) {
          const v = vessels.get(key);
          if (sd.Name && sd.Name.trim()) v.name = sd.Name.trim();
          if (sd.Destination && sd.Destination.trim()) v.dest = sd.Destination.trim();
          if (sd.Type != null) v.shipType = sd.Type;
          v.callsign = sd.CallSign || "";
        }
        return;
      }

      const pos = msg.Message?.PositionReport || msg.Message?.StandardClassBPositionReport;
      if (!pos || pos.Latitude == null) return;

      const key = meta.MMSI || meta.mmsi;
      const existing = vessels.get(key);
      // Only filter OUT if we know the type AND it's not passenger/ferry
      const st = existing ? existing.shipType : meta.ShipType;
      if (st != null && st > 0 && !((st >= 60 && st <= 69) || (st >= 80 && st <= 89))) return;

      vessels.set(key, {
        mmsi: key,
        name: meta.ShipName || (existing ? existing.name : ""),
        lat: pos.Latitude, lng: pos.Longitude,
        heading: pos.TrueHeading,
        speed: pos.Sog != null ? (pos.Sog * 1.852).toFixed(1) : null,
        course: pos.Cog,
        dest: meta.Destination || (existing ? existing.dest : ""),
        shipType: st,
        callsign: existing ? existing.callsign : "",
        _first: existing ? existing._first : Date.now()
      });
    } catch (e) {
      if (msgCount <= 2) console.log("Parse err:", e.message.substring(0, 80));
    }
  });

  ws.addEventListener("close", () => { console.log("Disconnected, reconnecting..."); setTimeout(connect, 5000); });
  ws.addEventListener("error", (e) => { 
    console.log("WS error:", e.message || JSON.stringify(e));
    try { ws.close(); } catch(_) {}
  });
}

connect();

// Clean old vessels every 30 min
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  vessels.forEach((v, k) => { if (v._ts && v._ts < cutoff) vessels.delete(k); });
}, 600000);

http.createServer((req, res) => {
  const result = [];
  const now = Date.now();
  vessels.forEach(v => {
    v._ts = now;
    const st = v.shipType;
    // ONLY show if confirmed passenger/ferry (60-69) or ro-ro (80-89)
    if (st != null && st > 0 && ((st >= 60 && st <= 69) || (st >= 80 && st <= 89))) {
      result.push(v);
    }
  });
  res.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  });
  res.end(JSON.stringify({ count: result.length, vessels: result, msgs: msgCount }));
}).listen(3099, "0.0.0.0", () => {
  console.log("Proxy on http://0.0.0.0:3099 — Node", process.version);
});
