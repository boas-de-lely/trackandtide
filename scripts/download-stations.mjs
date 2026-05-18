import { readFile, writeFile } from "node:fs/promises";

const wikidataSparqlUrl = "https://query.wikidata.org/sparql";
const overpassUrls = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

const countries = [
  { name: "Albania", qid: "Q222", iso: "AL" },
  { name: "Austria", qid: "Q40", iso: "AT" },
  { name: "Belgium", qid: "Q31", iso: "BE" },
  { name: "Bosnia and Herzegovina", qid: "Q225", iso: "BA" },
  { name: "Bulgaria", qid: "Q219", iso: "BG" },
  { name: "Croatia", qid: "Q224", iso: "HR" },
  { name: "Czechia", qid: "Q213", iso: "CZ" },
  { name: "Denmark", qid: "Q35", iso: "DK" },
  { name: "Estonia", qid: "Q191", iso: "EE" },
  { name: "Finland", qid: "Q33", iso: "FI" },
  { name: "France", qid: "Q142", iso: "FR" },
  { name: "Germany", qid: "Q183", iso: "DE" },
  { name: "Greece", qid: "Q41", iso: "GR" },
  { name: "Hungary", qid: "Q28", iso: "HU" },
  { name: "Ireland", qid: "Q27", iso: "IE" },
  { name: "Italy", qid: "Q38", iso: "IT" },
  { name: "Kosovo", qid: "Q1246", iso: "XK" },
  { name: "Latvia", qid: "Q211", iso: "LV" },
  { name: "Lithuania", qid: "Q37", iso: "LT" },
  { name: "Liechtenstein", qid: "Q347", iso: "LI" },
  { name: "Luxembourg", qid: "Q32", iso: "LU" },
  { name: "Moldova", qid: "Q217", iso: "MD" },
  { name: "Montenegro", qid: "Q236", iso: "ME" },
  { name: "Netherlands", qid: "Q55", iso: "NL" },
  { name: "Norway", qid: "Q20", iso: "NO" },
  { name: "Poland", qid: "Q36", iso: "PL" },
  { name: "Portugal", qid: "Q45", iso: "PT" },
  { name: "Romania", qid: "Q218", iso: "RO" },
  { name: "Republic of Serbia", qid: "Q403", iso: "RS" },
  { name: "Slovakia", qid: "Q214", iso: "SK" },
  { name: "Slovenia", qid: "Q215", iso: "SI" },
  { name: "Spain", qid: "Q29", iso: "ES" },
  { name: "Sweden", qid: "Q34", iso: "SE" },
  { name: "Switzerland", qid: "Q39", iso: "CH" },
  { name: "Ukraine", qid: "Q212", iso: "UA" },
  { name: "United Kingdom", qid: "Q145", iso: "GB" }
];

// -------------------- helpers --------------------

function parsePoint(value) {
  const match = /^Point\(([-\d.]+) ([-\d.]+)\)$/.exec(value || "");
  if (!match) return null;
  return { lng: Number(match[1]), lat: Number(match[2]) };
}

function cleanStationName(name) {
  return String(name || "")
    .replace(/\s+/g, " ")
    .replace(/^station\s+/i, "")
    .replace(/\s+station$/i, "")
    .replace(/\s+railway station$/i, "")
    .trim();
}

function isKilometerMarkerName(name) {
  return /(^|[^a-z])km([^a-z]|$)|\bkilometr/i.test(name || "");
}

function isFiniteCoord(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function stableId(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function distanceMeters(a, b) {
  const R = 6371000;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function namesCompatible(a, b) {
  const x = stableId(a);
  const y = stableId(b);
  if (!x || !y) return false;
  if (x === y) return true;

  const [s, l] = x.length < y.length ? [x, y] : [y, x];
  return s.length >= 5 && l.includes(s);
}

function stationKey(station) {
  return `${stableId(station.name)}:${Math.round(station.lat * 10000)}:${Math.round(station.lng * 10000)}`;
}

// -------------------- wikidata --------------------

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function wikidataEntityId(url) {
  return String(url || "").split("/").pop();
}

async function fetchWikidataStations(country) {
  const query = `
    SELECT ?station ?stationLabel ?coord (GROUP_CONCAT(DISTINCT ?operatorLabel; separator=", ") AS ?operators)
    WHERE {
      ?station wdt:P31 wd:Q55488;
               wdt:P17 wd:${country.qid};
               wdt:P5817 wd:Q55654238;
               wdt:P625 ?coord.
      OPTIONAL { ?station wdt:P137 ?operator. }
      SERVICE wikibase:label {
        bd:serviceParam wikibase:language "nl,en,[AUTO_LANGUAGE]".
      }
    }
    GROUP BY ?station ?stationLabel ?coord
  `;

  const url = `${wikidataSparqlUrl}?format=json&query=${encodeURIComponent(query)}`;

  const data = await fetchJson(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "TrackAndTide/1.0"
    }
  });

  return (data.results?.bindings || [])
    .map(b => {
      const p = parsePoint(b.coord?.value);
      return {
        id: b.station?.value,
        wikidataId: wikidataEntityId(b.station?.value),
        source: "wikidata",
        name: cleanStationName(b.stationLabel?.value),
        lat: p?.lat,
        lng: p?.lng,
        operators: b.operators?.value?.split(", ") || []
      };
    })
    .filter(s =>
      s.id &&
      s.name &&
      !isKilometerMarkerName(s.name) &&
      isFiniteCoord(s.lat, s.lng)
    );
}

// -------------------- OSM --------------------

function isUsableOsmStation(tags = {}) {
  if (!tags.name || tags.railway !== "station") return false;

  const bad = new Set(["abandoned", "construction", "disused", "historic", "razed", "proposed"]);
  const badTypes = new Set(["subway", "light_rail", "tram", "monorail"]);

  if (bad.has(tags.lifecycle)) return false;
  if (badTypes.has(tags.station)) return false;

  if (
    tags.disused === "yes" ||
    tags.abandoned === "yes" ||
    tags.construction === "yes" ||
    tags.proposed === "yes"
  ) return false;

  if (tags.tourism === "museum") return false;

  return true;
}

async function fetchOsmStations(country) {
  const query = `
    [out:json][timeout:180];
    area["ISO3166-1"="${country.iso}"][admin_level=2]->.a;
    (
      node["railway"="station"](area.a);
      way["railway"="station"](area.a);
      relation["railway"="station"](area.a);
    );
    out center tags;
  `;

  let data;

  for (const url of overpassUrls) {
    try {
      data = await fetchJson(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "TrackAndTide/1.0"
        },
        body: new URLSearchParams({ data: query })
      });
      break;
    } catch (e) {
      console.warn(`OSM failed ${url}: ${e.message}`);
    }
  }

  if (!data) throw new Error("All OSM endpoints failed");

  return (data.elements || [])
    .filter(e => isUsableOsmStation(e.tags))
    .map(e => {
      const t = e.tags || {};
      const lat = e.lat ?? e.center?.lat;
      const lng = e.lon ?? e.center?.lon;

      return {
        id: `osm:${e.type}/${e.id}`,
        source: "osm",
        wikidataId: t.wikidata || "",
        name: cleanStationName(t.name),
        lat: Number(lat),
        lng: Number(lng),
        operators: t.operator ? t.operator.split(";") : []
      };
    })
    .filter(s =>
      s.name &&
      !isKilometerMarkerName(s.name) &&
      isFiniteCoord(s.lat, s.lng)
    );
}

// -------------------- merge --------------------

function mergeStations(wikidataStations, osmStations) {
  const merged = [];
  const seen = new Set();

  const wikidataById = new Map(
    wikidataStations
      .filter(s => s.wikidataId)
      .map(s => [s.wikidataId, s])
  );

  // 1. add Wikidata first
  for (const w of wikidataStations) {
    seen.add(stationKey(w));
    merged.push(w);
  }

  // 2. add OSM with rules
  for (const o of osmStations) {
    const key = stationKey(o);
    if (seen.has(key)) continue;

    // rule 1: OSM has wikidata → skip if exists
    if (o.wikidataId && wikidataById.has(o.wikidataId)) {
      continue;
    }

    // rule 2: very close station → keep Wikidata only (<50m)
    const near = merged.some(m => distanceMeters(o, m) <= 50);
    if (near) continue;

    seen.add(key);
    merged.push(o);
  }

  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

// -------------------- pipeline --------------------

async function downloadCountry(country) {
  console.log(`Downloading ${country.name}...`);

  const [w, o] = await Promise.allSettled([
    fetchWikidataStations(country),
    fetchOsmStations(country)
  ]);

  const wikidataStations = w.status === "fulfilled" ? w.value : [];
  const osmStations = o.status === "fulfilled" ? o.value : [];

  const stations = mergeStations(wikidataStations, osmStations);

  console.log(`  ${stations.length} stations`);

  return {
    country: country.name,
    qid: country.qid,
    iso: country.iso,
    counts: {
      total: stations.length,
      wikidata: stations.filter(s => s.source === "wikidata").length,
      osm: stations.filter(s => s.source === "osm").length
    },
    stations
  };
}

// -------------------- CLI --------------------

const requested = process.argv.slice(2).filter(a => !a.startsWith("--"));

const selected = requested.length
  ? countries.filter(c =>
      requested.includes(c.name) || requested.includes(c.iso)
    )
  : countries;

if (!selected.length) {
  console.error("No countries matched");
  process.exit(1);
}

let output = {
  generatedAt: new Date().toISOString(),
  sources: { wikidata: wikidataSparqlUrl, osm: overpassUrls },
  countries: {}
};

try {
  if (requested.length) {
    output = JSON.parse(await readFile("stations.json", "utf8"));
  }
} catch {}

for (const c of selected) {
  output.countries[c.name] = await downloadCountry(c);
}

await writeFile("stations.json", JSON.stringify(output, null, 2));
console.log("Saved stations.json");