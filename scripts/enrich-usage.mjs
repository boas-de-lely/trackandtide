import { readFile, writeFile } from "node:fs/promises";

// ⚠️  WARNING: This script makes batch SPARQL queries to Wikidata from the SERVER.
// Running it too frequently can cause the server IP to be rate-limited or blocked by Wikidata.
// Run this ONLY occasionally for offline data enrichment.
// Live user-facing Wikidata data is fetched client-side (from the user's browser) in stations.html and index.html.

// Wikidata state-of-use (P5817) categories
const USAGE_CATEGORIES = {
  // "in_use" — fully operational mainline station
  in_use: new Set([
    "Q55654238",  // in use
  ]),

  // "limited_use" — anything that's not fully in-use mainline, but not abandoned
  limited_use: new Set([
    "Q39367638",  // partially in use / heritage / museum use
    "Q55453390",  // closed (but not abandoned — might be seasonal/special)
    "Q116611218", // seasonal service
    "Q29963925",  // occasional use
    "Q28913198",  // operated as event venue
    "Q111651402", // temporarily closed
  ]),

  // These are explicitly excluded / treated as abandoned
  abandoned: new Set([
    "Q22676035",  // abandoned
    "Q16662049",  // demolished
    "Q30261664",  // dismantled
    "Q67385990",  // ruined
  ]),
};

// Map Wikidata state IDs to our categories
function categorizeWikidataState(stateId) {
  if (USAGE_CATEGORIES.in_use.has(stateId)) return "in_use";
  if (USAGE_CATEGORIES.limited_use.has(stateId)) return "limited_use";
  if (USAGE_CATEGORIES.abandoned.has(stateId)) return "abandoned";
  // Unknown state → treat as limited_use (not fully operational, not abandoned)
  return "limited_use";
}

const wikidataSparqlUrl = "https://query.wikidata.org/sparql";

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchWikidataUsageStates() {
  // Fetch P5817 for all railway stations in Wikidata
  const query = `
    SELECT ?station ?state WHERE {
      ?station wdt:P31 wd:Q55488;
               wdt:P5817 ?state.
    }
  `;

  const url = `${wikidataSparqlUrl}?format=json&query=${encodeURIComponent(query)}`;
  console.log("Fetching Wikidata usage states...");

  const data = await fetchJson(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "TrackAndTide/1.0"
    }
  });

  const stateMap = new Map();
  for (const b of data.results?.bindings || []) {
    const stationUrl = b.station?.value;
    const stateUrl = b.state?.value;
    if (stationUrl && stateUrl) {
      const wikidataId = stationUrl.split("/").pop();
      const stateId = stateUrl.split("/").pop();
      stateMap.set(wikidataId, categorizeWikidataState(stateId));
    }
  }

  return stateMap;
}

// Fetch stations that are heritage railways or have heritage railway as "applies to part"
// P31 = Q420962 (instance of: heritage railway)
// P518 = Q420962 (applies to part: heritage railway)
async function fetchWikidataHeritageRailways() {
  const query = `
    SELECT DISTINCT ?station WHERE {
      { ?station wdt:P31 wd:Q420962. }
      UNION
      { ?station wdt:P518 wd:Q420962. }
    }
  `;

  const url = `${wikidataSparqlUrl}?format=json&query=${encodeURIComponent(query)}`;
  console.log("Fetching Wikidata heritage railways...");

  const data = await fetchJson(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "TrackAndTide/1.0"
    }
  });

  const heritageSet = new Set();
  for (const b of data.results?.bindings || []) {
    const stationUrl = b.station?.value;
    if (stationUrl) {
      heritageSet.add(stationUrl.split("/").pop());
    }
  }

  return heritageSet;
}

// OSM-specific usage inference from station data
// OSM stations without wikidataId fall back to name/operator heuristics
function inferOsmUsage(station) {
  // If the station came from Wikidata, we already have its state
  if (station.source === "wikidata") return station.usage || "in_use";

  // For OSM-only stations, check name/operator patterns
  const name = (station.name || "").toLowerCase();
  const operators = (station.operators || []).map(o => o.toLowerCase());

  // Heritage/museum/tourism indicators in name or operator
  const heritageTerms = [
    "museum", "heritage", "stoomtrein", "stoomtram", "preserved",
    "tourist", "tourism", "draisine", "museumstoomtram", "museumspoor",
    "museumspoorlijn", "museumstoomtrein", "museumlijn",
    "veluwsche stoomtrein", "museum buurtspoorweg",
    "zuid-limburgse stoomtrein", "stoomtrein goes",
    "excursion", "sightseeing", "scenic", "touristic",
    "tourist train", "tourist tram", "heritage railway",
    "heritage tram", "historic railway", "historic train",
    "vintage", "narrow gauge", "miniature", "park railway",
    "parkeisenbahn", "parkbahn", "feldbahn", "field railway"
  ];

  const isHeritage = heritageTerms.some(term =>
    name.includes(term) || operators.some(op => op.includes(term))
  );

  if (isHeritage) return "limited_use";

  // For all other OSM stations that passed the usable filter, treat as in_use
  return "in_use";
}

async function main() {
  console.log("Loading stations.json...");
  const stationData = JSON.parse(await readFile("stations.json", "utf8"));

  // Step 1: Fetch all Wikidata usage states and heritage railways
  const [wikiStateMap, heritageRailways] = await Promise.all([
    fetchWikidataUsageStates(),
    fetchWikidataHeritageRailways()
  ]);
  console.log(`Fetched ${wikiStateMap.size} Wikidata station states`);
  console.log(`Fetched ${heritageRailways.size} Wikidata heritage railways`);

  // Step 2: Apply usage states to all stations
  let totalStations = 0;
  let inUse = 0;
  let limitedUse = 0;
  let abandoned = 0;
  let heritageOverride = 0;

  for (const [countryName, country] of Object.entries(stationData.countries || {})) {
    const stations = country.stations || [];
    for (const station of stations) {
      totalStations++;

      // Try Wikidata P5817 first
      if (station.wikidataId && wikiStateMap.has(station.wikidataId)) {
        station.usage = wikiStateMap.get(station.wikidataId);
      } else {
        // Fall back to OSM inference
        station.usage = inferOsmUsage(station);
      }

      // Override: heritage railway (Wikidata P31/P518 = Q420962) → limited_use
      if (station.wikidataId && heritageRailways.has(station.wikidataId)) {
        if (station.usage !== "limited_use") {
          station.usage = "limited_use";
          heritageOverride++;
        }
      }

      if (station.usage === "in_use") inUse++;
      else if (station.usage === "limited_use") limitedUse++;
      else if (station.usage === "abandoned") abandoned++;
    }
  }

  console.log(`\nResults:`);
  console.log(`  Total stations: ${totalStations}`);
  console.log(`  In use: ${inUse}`);
  console.log(`  Limited use: ${limitedUse} (${heritageOverride} from heritage railway override)`);
  console.log(`  Abandoned: ${abandoned}`);

  // Write updated stations.json
  await writeFile("stations.json", JSON.stringify(stationData, null, 2));
  console.log("\nSaved stations.json with usage states");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
