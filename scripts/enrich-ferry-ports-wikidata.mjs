import { readFile, writeFile } from "node:fs/promises";

// Fetches Wikidata IDs for ferry ports by searching by name + geographic proximity.
// Uses wbsearchentities API for name search, then verifies via coordinates.

const WIKIDATA_UA = 'TrackAndTide/1.0 (https://trackandtide.eu; contact@trackandtide.eu)';
const DELAY_MS = 150; // delay between requests to avoid rate-limiting

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': WIKIDATA_UA } });
  if (!res.ok) {
    if (res.status === 429) {
      console.warn('  Rate limited, waiting 5s...');
      await sleep(5000);
      return fetchJson(url);
    }
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Search Wikidata for a port by name
async function searchWikidata(portName, country) {
  const queries = [
    `${portName} port`,
    `${portName} ferry port`,
    `${portName} harbour`,
    `port of ${portName}`,
  ];
  
  for (const q of queries) {
    await sleep(DELAY_MS);
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}&language=en&limit=5&format=json&origin=*`;
    try {
      const data = await fetchJson(url);
      if (data.search?.length) {
        return data.search;
      }
    } catch (e) {
      console.warn(`  Search failed for "${q}": ${e.message}`);
    }
  }
  return [];
}

// Get entity data with claims for a Wikidata ID
async function getEntityData(wikidataId) {
  await sleep(DELAY_MS);
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(wikidataId)}.json`;
  try {
    const data = await fetchJson(url);
    return data.entities?.[wikidataId] || null;
  } catch (e) {
    return null;
  }
}

function getCoordinate(entity) {
  const coord = entity?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
  if (coord) return { lat: coord.latitude, lng: coord.longitude };
  return null;
}

function getImageUrl(entity) {
  const file = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  if (file) {
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, '_'))}?width=600`;
  }
  return null;
}

function getWebsite(entity) {
  return entity?.claims?.P856?.[0]?.mainsnak?.datavalue?.value || null;
}

function getNightView(entity) {
  const file = entity?.claims?.P3451?.[0]?.mainsnak?.datavalue?.value;
  if (file) {
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, '_'))}?width=600`;
  }
  return null;
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function enrichPort(port, index, total) {
  console.log(`[${index + 1}/${total}] ${port.name} (${port.country})...`);
  
  const results = await searchWikidata(port.name, port.country);
  if (!results.length) {
    console.log(`  → No Wikidata results found`);
    return null;
  }

  // Check each result for coordinate proximity
  let bestMatch = null;
  let bestDist = Infinity;

  for (const result of results) {
    const entity = await getEntityData(result.id);
    if (!entity) continue;
    
    const coord = getCoordinate(entity);
    if (coord) {
      const dist = distanceKm(port.lat, port.lng, coord.lat, coord.lng);
      if (dist < bestDist) {
        bestDist = dist;
        bestMatch = { id: result.id, label: result.label, description: result.description, entity, dist };
      }
    } else {
      // No coordinates in Wikidata, use label match as fallback
      const labelLower = (result.label || '').toLowerCase();
      const portLower = port.name.toLowerCase();
      if (labelLower.includes(portLower) || portLower.includes(labelLower)) {
        if (!bestMatch) {
          bestMatch = { id: result.id, label: result.label, description: result.description, entity, dist: Infinity };
        }
      }
    }
  }

  if (!bestMatch) {
    console.log(`  → No matching entity found`);
    return null;
  }

  if (bestMatch.dist > 5 && bestMatch.dist < Infinity) {
    console.log(`  → Best match: ${bestMatch.id} "${bestMatch.label}" but ${bestMatch.dist.toFixed(1)}km away — skipping`);
    return null;
  }

  console.log(`  → Matched: ${bestMatch.id} "${bestMatch.label}"${bestMatch.dist < Infinity ? ` (${bestMatch.dist.toFixed(1)}km)` : ' (no coords)'}`);
  
  return {
    wikidataId: bestMatch.id,
    wikidataLabel: bestMatch.label,
    image: getImageUrl(bestMatch.entity),
    website: getWebsite(bestMatch.entity),
    nightView: getNightView(bestMatch.entity),
  };
}

async function main() {
  const dataPath = "\\\\LELYNAS\\trackandtide\\ferry_ports.json";
  const data = JSON.parse(await readFile(dataPath, "utf-8"));
  const ports = data.ports || [];
  
  console.log(`Enriching ${ports.length} ferry ports with Wikidata IDs...\n`);
  
  let enriched = 0;
  let skipped = 0;
  
  for (let i = 0; i < ports.length; i++) {
    const port = ports[i];
    
    // Skip if already has wikidataId
    if (port.wikidataId) {
      console.log(`[${i + 1}/${ports.length}] ${port.name} — already has Wikidata ID (${port.wikidataId}), skipping`);
      skipped++;
      continue;
    }
    
    const result = await enrichPort(port, i, ports.length);
    if (result) {
      port.wikidataId = result.wikidataId;
      port.wikidataLabel = result.wikidataLabel;
      port.source = "wikidata";
      // Also pre-cache image/website/nightView
      if (result.image) port.image = result.image;
      if (result.website) port.website = result.website;
      if (result.nightView) port.nightView = result.nightView;
      enriched++;
    } else {
      skipped++;
    }
  }
  
  // Write updated data
  data.generatedAt = new Date().toISOString();
  await writeFile(dataPath, JSON.stringify(data, null, 2), "utf-8");
  
  console.log(`\nDone! Enriched: ${enriched}, Skipped/missing: ${skipped}, Total: ${ports.length}`);
}

main().catch(console.error);
