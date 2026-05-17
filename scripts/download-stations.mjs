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

function parsePoint(value) {
  const match = /^Point\(([-\d.]+) ([-\d.]+)\)$/.exec(value || "");
  if (!match) return null;

  return {
    lng: Number(match[1]),
    lat: Number(match[2])
  };
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

function wikidataEntityId(url) {
  return String(url || "").split("/").pop();
}

function stationKey(station) {
  return `${stableId(station.name)}:${Math.round(station.lat * 1000)}:${Math.round(station.lng * 1000)}`;
}

function distanceMeters(a, b) {
  const earthRadius = 6371000;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const deltaLat = (b.lat - a.lat) * Math.PI / 180;
  const deltaLng = (b.lng - a.lng) * Math.PI / 180;
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function namesCompatible(a, b) {
  const left = stableId(a);
  const right = stableId(b);
  if (!left || !right) return false;
  if (left === right) return true;

  const [shorter, longer] = left.length < right.length ? [left, right] : [right, left];
  return shorter.length >= 5 && longer.includes(shorter);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchWikidataStations(country) {
  const query = `
    SELECT ?station ?stationLabel ?coord (GROUP_CONCAT(DISTINCT ?operatorLabel; separator=", ") AS ?operators) WHERE {
      ?station wdt:P31 wd:Q55488;
               wdt:P17 wd:${country.qid};
               wdt:P5817 wd:Q55654238;
               wdt:P625 ?coord.
      OPTIONAL { ?station wdt:P137 ?operator. }
      SERVICE wikibase:label {
        bd:serviceParam wikibase:language "nl,en,[AUTO_LANGUAGE]".
        ?station rdfs:label ?stationLabel.
        ?operator rdfs:label ?operatorLabel.
      }
    }
    GROUP BY ?station ?stationLabel ?coord
    ORDER BY ?stationLabel
  `;

  const url = `${wikidataSparqlUrl}?format=json&query=${encodeURIComponent(query)}`;
  const data = await fetchJson(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "TrackAndTide/1.0 station downloader"
    }
  });

  return (data.results?.bindings || [])
    .map(binding => {
      const point = parsePoint(binding.coord?.value);
      return {
        id: binding.station?.value,
        wikidataId: wikidataEntityId(binding.station?.value),
        url: binding.station?.value,
        source: "wikidata",
        name: cleanStationName(binding.stationLabel?.value),
        lat: point?.lat,
        lng: point?.lng,
        operators: binding.operators?.value
          ? binding.operators.value.split(", ").filter(Boolean)
          : []
      };
    })
    .filter(station =>
      station.id &&
      station.name &&
      !isKilometerMarkerName(station.name) &&
      isFiniteCoord(station.lat, station.lng)
    );
}

function isUsableOsmStation(tags = {}) {
  if (!tags.name || tags.railway !== "station") return false;

  const excludedValues = new Set(["abandoned", "construction", "disused", "historic", "razed", "proposed"]);
  const excludedStationTypes = new Set(["subway", "light_rail", "tram", "monorail"]);

  if (excludedValues.has(tags.lifecycle)) return false;
  if (excludedStationTypes.has(tags.station)) return false;
  if (tags.disused === "yes" || tags.abandoned === "yes" || tags.construction === "yes" || tags.proposed === "yes") return false;
  if (tags["disused:railway"] || tags["abandoned:railway"] || tags["construction:railway"] || tags["proposed:railway"]) return false;
  if (tags["railway:preserved"] === "yes") return false;
  if (tags.tourism === "museum") return false;

  return true;
}

async function fetchOsmStations(country) {
  const query = `
    [out:json][timeout:180];
    area["ISO3166-1"="${country.iso}"][admin_level=2]->.searchArea;
    (
      node["railway"="station"](area.searchArea);
      way["railway"="station"](area.searchArea);
      relation["railway"="station"](area.searchArea);
    );
    out center tags;
  `;

  let data;
  let lastError;

  for (const url of overpassUrls) {
    try {
      data = await fetchJson(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "TrackAndTide/1.0 station downloader"
        },
        body: new URLSearchParams({ data: query })
      });
      break;
    } catch (error) {
      lastError = error;
      console.warn(`  OSM endpoint failed (${url}): ${error.message}`);
    }
  }

  if (!data) throw lastError;

  return (data.elements || [])
    .filter(element => isUsableOsmStation(element.tags))
    .map(element => {
      const tags = element.tags || {};
      const lat = element.lat ?? element.center?.lat;
      const lng = element.lon ?? element.center?.lon;

      return {
        id: `osm:${element.type}/${element.id}`,
        url: `https://www.openstreetmap.org/${element.type}/${element.id}`,
        wikidataId: tags.wikidata || "",
        source: "osm",
        name: cleanStationName(tags.name),
        lat: Number(lat),
        lng: Number(lng),
        operators: tags.operator
          ? tags.operator.split(";").map(value => value.trim()).filter(Boolean)
          : []
      };
    })
    .filter(station =>
      station.name &&
      !isKilometerMarkerName(station.name) &&
      isFiniteCoord(station.lat, station.lng)
    );
}

function mergeStations(wikidataStations, osmStations) {
  const merged = [];
  const seen = new Set();
  const wikidataIds = new Set(wikidataStations.map(station => station.wikidataId).filter(Boolean));

  wikidataStations.forEach(station => {
    seen.add(stationKey(station));
    merged.push(station);
  });

  osmStations.forEach(station => {
    if (station.wikidataId && wikidataIds.has(station.wikidataId)) return;

    const key = stationKey(station);
    if (seen.has(key)) return;

    const matchesWikidataStation = wikidataStations.some(wikidataStation =>
      distanceMeters(station, wikidataStation) <= 350 &&
      namesCompatible(station.name, wikidataStation.name)
    );
    if (matchesWikidataStation) return;

    seen.add(key);
    merged.push(station);
  });

  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

async function downloadCountry(country) {
  console.log(`Downloading ${country.name}...`);

  const [wikidataResult, osmResult] = await Promise.allSettled([
    fetchWikidataStations(country),
    fetchOsmStations(country)
  ]);

  const wikidataStations = wikidataResult.status === "fulfilled" ? wikidataResult.value : [];
  const osmStations = osmResult.status === "fulfilled" ? osmResult.value : [];

  if (wikidataResult.status === "rejected") {
    console.warn(`  Wikidata failed: ${wikidataResult.reason.message}`);
  }

  if (osmResult.status === "rejected") {
    console.warn(`  OSM failed: ${osmResult.reason.message}`);
  }

  const stations = mergeStations(wikidataStations, osmStations);
  console.log(`  ${stations.length} stations (${wikidataStations.length} Wikidata, ${osmStations.length} OSM before merge)`);

  return {
    country: country.name,
    qid: country.qid,
    iso: country.iso,
    counts: {
      total: stations.length,
      wikidata: stations.filter(station => station.source === "wikidata").length,
      osm: stations.filter(station => station.source === "osm").length
    },
    stations
  };
}

const requestedCountries = process.argv
  .slice(2)
  .filter(arg => !arg.startsWith("--"));

const selectedCountries = requestedCountries.length
  ? countries.filter(country => requestedCountries.includes(country.name) || requestedCountries.includes(country.iso))
  : countries;

if (!selectedCountries.length) {
  console.error("No matching countries. Use a country name or ISO code, for example: node scripts/download-stations.mjs NL BE");
  process.exit(1);
}

let output = {
  generatedAt: new Date().toISOString(),
  sources: {
    wikidata: wikidataSparqlUrl,
    osm: overpassUrls
  },
  countries: {}
};

if (requestedCountries.length) {
  try {
    output = JSON.parse(await readFile("stations.json", "utf8"));
    output.generatedAt = new Date().toISOString();
    output.sources = {
      wikidata: wikidataSparqlUrl,
      osm: overpassUrls
    };
    output.countries ||= {};
  } catch {
    // No existing stations.json yet; create a fresh selected-country file.
  }
}

for (const country of selectedCountries) {
  output.countries[country.name] = await downloadCountry(country);
}

await writeFile("stations.json", `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Saved stations.json with ${Object.keys(output.countries).length} countries.`);
