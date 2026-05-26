import { readFile, writeFile } from "node:fs/promises";

// ⚠️  WARNING: This script makes batch SPARQL queries to Wikidata from the SERVER.
// Running it too frequently can cause the server IP to be rate-limited or blocked by Wikidata.
// Run this ONLY occasionally for offline data enrichment.
// Live user-facing Wikidata data is fetched client-side (from the user's browser) in stations.html and index.html.

const wikidataSparqlUrl = "https://query.wikidata.org/sparql";

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// Fetch rich Wikidata info for stations: tracks, platforms, inception,
// images, architect, architectural style, patronage, facilities
async function fetchWikidataStationDetails(wikidataIds) {
  if (!wikidataIds.length) return new Map();

  const valuesClause = wikidataIds.map(id => `wd:${id}`).join(" ");
  const query = `
    SELECT ?station ?stationLabel
           ?tracks ?platforms ?inception
           ?image ?interiorImage
           ?architect ?architectLabel
           ?style ?styleLabel
           ?patronage ?patronageYear
           ?hasBicycleParking ?hasToilet ?hasWaitingRoom ?hasTicketOffice ?hasWifi
           ?heritageStation ?heritageRailway ?heritagePart
    WHERE {
      VALUES ?station { ${valuesClause} }
      OPTIONAL { ?station wdt:P1103 ?tracks. }
      OPTIONAL { ?station wdt:P1103 ?platforms. } # same property for platforms
      OPTIONAL { ?station wdt:P571 ?inception. }
      OPTIONAL { ?station wdt:P18 ?image. }
      OPTIONAL { ?station wdt:P5775 ?interiorImage. }
      OPTIONAL { ?station wdt:P84 ?architect. }
      OPTIONAL { ?station wdt:P149 ?style. }
      OPTIONAL { ?station p:P3872 ?patronageStmt. 
                 ?patronageStmt ps:P3872 ?patronage.
                 OPTIONAL { ?patronageStmt pq:P585 ?patronageYear. } }
      OPTIONAL { ?station wdt:P2795 ?hasBicycleParking. }
      OPTIONAL { ?station wdt:P2856 ?hasToilet. }
      OPTIONAL { ?station wdt:P2846 ?hasWaitingRoom. }
      OPTIONAL { ?station wdt:P2650 ?hasTicketOffice. }
      OPTIONAL { ?station wdt:P2829 ?hasWifi. }
      OPTIONAL { ?station wdt:P31 wd:Q55488. BIND("1" AS ?heritageStation) }
      OPTIONAL { ?station wdt:P31 wd:Q420962. BIND("1" AS ?heritageRailway) }
      OPTIONAL { ?station wdt:P518 wd:Q420962. BIND("1" AS ?heritagePart) }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
  `;

  const url = `${wikidataSparqlUrl}?format=json&query=${encodeURIComponent(query)}`;
  console.log(`Fetching Wikidata details for ${wikidataIds.length} stations...`);

  const data = await fetchJson(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "TrackAndTide/1.0"
    }
  });

  const resultMap = new Map();
  for (const b of data.results?.bindings || []) {
    const stationUrl = b.station?.value;
    if (!stationUrl) continue;
    const wikidataId = stationUrl.split("/").pop();

    const detail = {};

    if (b.tracks?.value) detail.tracks = parseInt(b.tracks.value, 10);
    if (b.inception?.value) {
      const d = b.inception.value.replace(/^\+/, "").split("T")[0];
      if (d && d !== "0000-00-00") detail.inception = d;
    }
    if (b.image?.value) detail.image = b.image.value;
    if (b.interiorImage?.value) detail.interiorImage = b.interiorImage.value;
    if (b.architect?.value) detail.architect = b.architectLabel?.value || b.architect.value.split("/").pop();
    if (b.style?.value) detail.architecturalStyle = b.styleLabel?.value || b.style.value.split("/").pop();
    if (b.patronage?.value) {
      detail.patronage = parseInt(b.patronage.value, 10);
      if (b.patronageYear?.value) {
        const y = b.patronageYear.value.replace(/^\+/, "").split("T")[0];
        if (y) detail.patronageYear = y;
      }
    }

    // Facilities
    detail.hasBicycleParking = b.hasBicycleParking?.value === "http://www.wikidata.org/entity/Q28830165";
    detail.hasToilet = b.hasToilet?.value === "http://www.wikidata.org/entity/Q28830165";
    detail.hasWaitingRoom = b.hasWaitingRoom?.value === "http://www.wikidata.org/entity/Q28830165";
    detail.hasTicketOffice = b.hasTicketOffice?.value === "http://www.wikidata.org/entity/Q28830165";
    detail.hasWifi = b.hasWifi?.value === "http://www.wikidata.org/entity/Q28830165";

    // Heritage check
    const isHeritage = !!b.heritageRailway?.value || !!b.heritagePart?.value;

    resultMap.set(wikidataId, { detail, isHeritage });
  }

  return resultMap;
}

// Kilometer marker name detection
function isKilometerMarkerName(name) {
  return /(^|[^a-z])km([^a-z]|$)|\bkilometr/i.test(name || "");
}

async function main() {
  console.log("Loading stations.json...");
  const stationData = JSON.parse(await readFile("stations.json", "utf8"));

  // Step 1: Remove km stations and collect Wikidata IDs
  let kmRemoved = 0;
  let totalBefore = 0;
  const allWikidataIds = [];

  for (const [countryName, country] of Object.entries(stationData.countries || {})) {
    const stations = country.stations || [];
    totalBefore += stations.length;

    // Filter out km stations
    country.stations = stations.filter(s => {
      if (isKilometerMarkerName(s.name)) {
        kmRemoved++;
        return false;
      }
      if (s.wikidataId) allWikidataIds.push(s.wikidataId);
      return true;
    });

    // Update counts
    country.counts = {
      total: country.stations.length,
      wikidata: country.stations.filter(s => s.source === "wikidata").length,
      osm: country.stations.filter(s => s.source === "osm").length
    };
  }

  console.log(`Removed ${kmRemoved} km marker stations (from ${totalBefore} total)`);

  // Step 2: Batch fetch Wikidata details
  console.log(`Fetching details for ${allWikidataIds.length} Wikidata stations...`);

  const BATCH_SIZE = 100;
  const allDetails = new Map();

  for (let i = 0; i < allWikidataIds.length; i += BATCH_SIZE) {
    const batch = allWikidataIds.slice(i, i + BATCH_SIZE);
    const batchResults = await fetchWikidataStationDetails(batch);

    for (const [id, data] of batchResults) {
      // Merge with existing if duplicate
      if (allDetails.has(id)) {
        const existing = allDetails.get(id);
        existing.detail = { ...existing.detail, ...data.detail };
        existing.isHeritage = existing.isHeritage || data.isHeritage;
      } else {
        allDetails.set(id, data);
      }
    }

    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allWikidataIds.length / BATCH_SIZE)} done (${allDetails.size} total)`);
  }

  // Step 3: Apply details and heritage overrides to all stations
  let enrichedCount = 0;
  let heritageOverrides = 0;
  let inUse = 0;
  let limitedUse = 0;

  for (const [countryName, country] of Object.entries(stationData.countries || {})) {
    for (const station of country.stations || []) {
      // Apply Wikidata details
      if (station.wikidataId && allDetails.has(station.wikidataId)) {
        const { detail, isHeritage } = allDetails.get(station.wikidataId);

        // Merge detail info
        if (Object.keys(detail).length > 0) {
          station.detail = detail;
          enrichedCount++;
        }

        // Heritage override: P31=Q420962 (heritage railway) or P518=Q420962 → limited_use
        if (isHeritage && station.usage !== "limited_use") {
          station.usage = "limited_use";
          heritageOverrides++;
        }
      }

      if (station.usage === "in_use") inUse++;
      else if (station.usage === "limited_use") limitedUse++;
    }
  }

  console.log(`\nResults:`);
  console.log(`  Total stations: ${totalBefore - kmRemoved}`);
  console.log(`  In use: ${inUse}`);
  console.log(`  Limited use: ${limitedUse}`);
  console.log(`  Heritage overrides: ${heritageOverrides}`);
  console.log(`  Stations enriched with details: ${enrichedCount}`);
  console.log(`  KM stations removed: ${kmRemoved}`);

  // Update generatedAt
  stationData.generatedAt = new Date().toISOString();

  await writeFile("stations.json", JSON.stringify(stationData, null, 2));
  console.log("\nSaved stations.json");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
