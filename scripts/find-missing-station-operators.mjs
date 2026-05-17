import { readFile, writeFile } from "node:fs/promises";

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/\b(nv|sa|ag|as|spa|srl|ltd|limited|gmbh|bv|plc|inc|llc)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const data = JSON.parse(await readFile("data.json", "utf8"));
const stationData = JSON.parse(await readFile("stations.json", "utf8"));

const knownOperators = new Map();

(data.operators || []).forEach(operator => {
  [
    operator.name,
    operator.id
  ].forEach(value => {
    const normalized = normalizeName(value);
    if (normalized) knownOperators.set(normalized, operator.name);
  });
});

const missing = new Map();

Object.values(stationData.countries || {}).forEach(country => {
  (country.stations || []).forEach(station => {
    const syncedOperators = [];

    (station.operators || []).forEach(operatorName => {
      const normalized = normalizeName(operatorName);
      if (!normalized) return;

      const matchedName = knownOperators.get(normalized);
      if (matchedName) {
        if (!syncedOperators.includes(matchedName)) syncedOperators.push(matchedName);
        return;
      }

      if (!syncedOperators.includes(operatorName)) syncedOperators.push(operatorName);

      if (!missing.has(operatorName)) {
        missing.set(operatorName, {
          name: operatorName,
          normalized,
          countries: new Set(),
          stationCount: 0,
          sampleStations: []
        });
      }

      const entry = missing.get(operatorName);
      entry.countries.add(country.country);
      entry.stationCount += 1;
      if (entry.sampleStations.length < 8) {
        entry.sampleStations.push({
          name: station.name,
          country: country.country,
          source: station.source,
          url: station.url
        });
      }
    });

    station.operators = syncedOperators;
  });
});

const output = {
  generatedAt: new Date().toISOString(),
  totalMissing: missing.size,
  operators: [...missing.values()]
    .map(entry => ({
      ...entry,
      countries: [...entry.countries].sort((a, b) => a.localeCompare(b))
    }))
    .sort((a, b) => b.stationCount - a.stationCount || a.name.localeCompare(b.name))
};

await writeFile("missing-station-operators.json", `${JSON.stringify(output, null, 2)}\n`, "utf8");
await writeFile("stations.json", `${JSON.stringify(stationData, null, 2)}\n`, "utf8");
console.log(`Saved missing-station-operators.json with ${output.totalMissing} missing operators.`);
console.log("Synced matched station operators in stations.json.");
