// ── System Status Monitor ── Only active on /status page. Checks the status of various systems and displays a grid of cards with their status.
// Stores results in Firestore. Only re-checks if cached status is >30 min old.

(function() {
  var COLLECTION = "stats";
  var DOC = "system-status";
  var MAX_AGE = 1800000; // 30 minutes

  var systems = [
    { id: "motis",     name: "Transitous API",        desc: "Route planning & live departures",   url: "https://api.transitous.org/api/v1/health" },
    { id: "carto",     name: "Carto Tiles",             desc: "Base map styles & vector tiles",      url: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" },
    { id: "esri",      name: "Esri Satellite",           desc: "Satellite imagery tiles",             url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer?f=json" },
    { id: "osm",       name: "OpenStreetMap Tiles",     desc: "Raster map tiles, and railway lines",                    url: "https://tile.openstreetmap.org/0/0/0.png" },
    { id: "openmeteo", name: "Open-Meteo Weather",      desc: "Handles live weather for stations", url: "https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=temperature_2m" }
  ];

  // Only run on status/about pages
  var path = window.location.pathname.replace(/\/$/, "");
  if (path !== "/status" && path !== "/status.html" && path !== "/about" && path !== "/about.html") return;

  var statuses = {};
  var lastChecked = {};
  var db = null;
  var dbRetries = 0;

  function initDb() {
    try {
      if (typeof firebase !== "undefined" && firebase.firestore && firebase.apps && firebase.apps.length) {
        db = firebase.firestore();
        return true;
      }
    } catch(e) {}
    return false;
  }

  function tryInitDb(cb) {
    if (initDb()) { cb(); return; }
    if (++dbRetries > 20) { cb(); return; }
    setTimeout(function() { tryInitDb(cb); }, 500);
  }

  // ── CSS ──
  var style = document.createElement("style");
  style.textContent =
    ".sys-monitor{margin-top:1.5rem;}" +
    ".sys-monitor-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;}" +
    ".sys-monitor-card{background:var(--card,#273549);border:1px solid var(--border,#3B4A5F);border-radius:14px;padding:1.25rem;display:flex;align-items:center;gap:1rem;}" +
    ".sys-monitor-dot{width:14px;height:14px;border-radius:50%;flex-shrink:0;transition:background 0.3s;}" +
    ".sys-monitor-dot.ok{background:var(--success,#10B981);}" +
    ".sys-monitor-dot.down{background:var(--error,#EF4444);}" +
    ".sys-monitor-dot.checking{background:var(--warning,#FBBF24);animation:pulse-yellow 1s infinite;}" +
    ".sys-monitor-dot.unknown{background:var(--text-secondary,#94A3B8);}" +
    ".sys-monitor-info{flex:1;min-width:0;}" +
    ".sys-monitor-name{font-weight:700;font-size:0.95rem;}" +
    ".sys-monitor-desc{font-size:0.8rem;color:var(--text-secondary,#94A3B8);margin-top:2px;}" +
    ".sys-monitor-time{font-size:0.72rem;color:var(--text-secondary,#94A3B8);margin-top:4px;}" +
    "@keyframes pulse-yellow{0%,100%{opacity:1;}50%{opacity:0.4;}}" +
    ".sys-legend{display:flex;flex-wrap:wrap;gap:1rem;margin-top:1rem;font-size:0.75rem;color:var(--text-secondary,#94A3B8);}" +
    ".sys-legend-item{display:flex;align-items:center;gap:0.35rem;}" +
    ".sys-legend-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}" +
    ".sys-legend-dot.ok{background:var(--success,#10B981);}" +
    ".sys-legend-dot.down{background:var(--error,#EF4444);}" +
    ".sys-legend-dot.checking{background:var(--warning,#FBBF24);}" +
    ".sys-legend-dot.unknown{background:var(--text-secondary,#94A3B8);}";
  document.head.appendChild(style);

  function buildMonitorHTML() {
    var all = systems.concat([{ id: "firebase", name: "Firebase Firestore", desc: "Comment storage" }]);
    var cards = all.map(function(sys) {
      var s = statuses[sys.id] || "unknown";
      var t = "Not checked yet";
      if (lastChecked[sys.id]) {
        var a = Math.round((Date.now() - lastChecked[sys.id]) / 1000);
        t = "Checked " + (a < 60 ? a + "s ago" : Math.round(a/60) + "m ago");
      }
      return "<div class='sys-monitor-card'><div class='sys-monitor-dot " + s + "' id='sysDot-" + sys.id + "'></div>" +
        "<div class='sys-monitor-info'><div class='sys-monitor-name'>" + sys.name + "</div>" +
        "<div class='sys-monitor-desc'>" + sys.desc + "</div>" +
        "<div class='sys-monitor-time' id='sysTime-" + sys.id + "'>" + t + "</div></div></div>";
    }).join("");
    return "<div class='sys-monitor' id='sysMonitor'><div class='sys-monitor-grid'>" + cards + "</div>" +
      "<div class='sys-legend'>" +
        "<span class='sys-legend-item'><span class='sys-legend-dot ok'></span> Online</span>" +
        "<span class='sys-legend-item'><span class='sys-legend-dot down'></span> Offline</span>" +
        "<span class='sys-legend-item'><span class='sys-legend-dot checking'></span> Checking</span>" +
        "<span class='sys-legend-item'><span class='sys-legend-dot unknown'></span> Unknown</span>" +
      "</div></div>";
  }

  function updateMonitor() {
    var all = systems.concat([{ id: "firebase", name: "Firebase Firestore", desc: "Comment storage" }]);
    all.forEach(function(sys) {
      var dot = document.getElementById("sysDot-" + sys.id);
      var time = document.getElementById("sysTime-" + sys.id);
      if (!dot) return;
      dot.className = "sys-monitor-dot " + (statuses[sys.id] || "unknown");
      if (time && lastChecked[sys.id]) {
        var a = Math.round((Date.now() - lastChecked[sys.id]) / 1000);
        time.textContent = "Checked " + (a < 60 ? a + "s ago" : Math.round(a/60) + "m ago");
      }
    });
  }

  function injectMonitor() {
    // Skip about page on mobile
    var isAbout = path.indexOf("/about") === 0;
    if (isAbout && window.innerWidth <= 768) return;
    var c = document.querySelector(".container");
    if (!c) { requestAnimationFrame(injectMonitor); return; }
    c.insertAdjacentHTML("beforeend", buildMonitorHTML());
    updateMonitor();
  }
  injectMonitor();

  function loadFromFirestore() {
    if (!db) { updateMonitor(); return; }

    db.collection(COLLECTION).doc(DOC).get({ source: "server" }).then(function(doc) {
      var data = doc.exists ? doc.data() : null;

      if (data && data.systems && data.updated && (Date.now() - data.updated < MAX_AGE)) {
        data.systems.forEach(function(s) {
          statuses[s.id] = s.status || "unknown";
          lastChecked[s.id] = s.lastChecked || null;
        });
        statuses.firebase = "ok";
        lastChecked.firebase = data.updated;
        updateMonitor();
        return;
      }

      statuses.firebase = "ok";
      lastChecked.firebase = Date.now();
      runChecks();
    }).catch(function() {
      statuses.firebase = "down";
      lastChecked.firebase = Date.now();
      updateMonitor();
    });
  }

  function runChecks() {
    var pending = systems.length;

    systems.forEach(function(sys) {
      statuses[sys.id] = "checking";
      updateMonitor();

      fetch(sys.url, { cache: "no-cache" })
        .then(function(r) {
          statuses[sys.id] = r.ok ? "ok" : "down";
          lastChecked[sys.id] = Date.now();
          done();
        })
        .catch(function() {
          statuses[sys.id] = "down";
          lastChecked[sys.id] = Date.now();
          done();
        });
    });

    function done() {
      pending--;
      updateMonitor();
      if (pending === 0) saveToFirestore();
    }
  }

  function saveToFirestore() {
    if (!db) return;
    var sysArr = systems.map(function(s) {
      return { id: s.id, status: statuses[s.id] || "unknown", lastChecked: lastChecked[s.id] || null };
    });
    sysArr.push({ id: "firebase", status: statuses.firebase || "ok", lastChecked: lastChecked.firebase || null });
    db.collection(COLLECTION).doc(DOC).set({ systems: sysArr, updated: Date.now() }).catch(function() {});
  }

  tryInitDb(function() {
    loadFromFirestore();
  });
})();