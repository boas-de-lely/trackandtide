import { readFile, writeFile } from "node:fs/promises";

/**
 * Manual alias map: full/native/alternate names → canonical name in data.json.
 * Handles language variants, full legal names, acronym expansions, and spelling differences.
 */
const MANUAL_ALIASES = {
  // ── National operators (language variants / full names) ──
  "nederlandse spoorwegen":        "NS",
  "zwitserse federale spoorwegen": "SBB",
  "magyar allamvasutak":            "MÁV",
  "nationale maatschappij der belgische spoorwegen": "NMBS/SNCB",
  "osterreichische bundesbahnen":   "ÖBB",
  "danske statsbaner":              "DSB",
  "ceske drahy":                    "České dráhy",
  "cale ferata din moldova":        "Calea Ferată din Moldova",
  "chemins de fer luxembourgeois":  "CFL",
  "iarnrod eireann":                "Irish Rail",
  "cale ferate romane":             "CFR Călători",
  "caile ferate romane":            "CFR Călători",
  "rhatische bahn":                 "Rähtische Bahn",   // "Rhätische" → "Rähtische" spelling variant
  "rahtische bahn":                 "Rähtische Bahn",   // already normalized form
  "rhB":                            "Rähtische Bahn",

  // ── DB group variants ──
  "deutsche bahn":                  "DB",
  "deutsche bahn ag":               "DB",
  "db fernverkehr ag":              "DB",
  "db fernverkehr":                 "DB",
  "db regio":                       "DB",
  "db regio ag":                    "DB",
  "db regio schleswig holstein":    "DB",
  "db netz":                        "DB",
  "db netz ag":                     "DB",
  "db station service":             "DB",
  "db stationandservice ag":        "DB",
  "db stationandservice":           "DB",
  "db station service ag":          "DB",
  "db infrago ag":                  "DB",
  "db infrago":                     "DB",

  // ── NMBS/SNCB variants ──
  "nationale maatschappij der belgische spoorwegen nmbs": "NMBS/SNCB",
  "nmbs":                           "NMBS/SNCB",
  "sncb":                           "NMBS/SNCB",
  "nmbs sncb":                      "NMBS/SNCB",

  // ── SBB variants ──
  "schweizerische bundesbahnen":    "SBB",
  "chemins de fer federaux suisses": "SBB",
  "ferrovie federali svizzere":     "SBB",
  "sbb cff ffs":                    "SBB",

  // ── ÖBB variants ──
  "oebb":                           "ÖBB",
  "oebb infrastruktur ag":          "ÖBB",
  "oebb infrastruktur":             "ÖBB",

  // ── SNCF variants ──
  "societe nationale des chemins de fer francais": "SNCF",

  // ── PKP variants ──
  "pkp polskie linie kolejowe":     "PKP Intercity",  // infrastructure vs operator

  // ── CFR variants ──
  "cfr":                            "CFR Călători",

  // ── Irish Rail variants ──
  "iarnrod eireann irish rail":     "Irish Rail",

  // ── CP variants ──
  "comboios de portugal":           "CP",

  // ── ZSSK variants ──
  "zeleznice slovenskej republiky": "ZSSK",
  "zsr":                            "ZSSK",

  // ── HŽPP variants ──
  "hrvatske zeleznice":             "HŽPP",

  // ── Ferrovienord / FNM ──
  "ferrovienord":                   "Trenord",

  // ── BDZ variants ──
  "balgarska darzhavna zheleznitsa": "BDZ",
  "balgarski darzhavni zheleznitsi": "BDZ",
  "national railway infrastructure company": "BDZ",

  // ── Öresundståg ──
  "oresundstag":                    "Öresundståg",
  "oresundstag ab":                 "Öresundståg",

  // ── GoVolta / European Sleeper ──
  "european sleeper":               "European sleeper",

  // ── Caledonian Sleeper ──
  "caledonian sleeper":             "Caledonian Sleeper",

  // ── Keolis ──
  "keolis nederland":               "Keolis/RRReis",

  // ── Renfe ──
  "renfe operadora":                "Renfe",
  "renfe viajeros":                 "Renfe",
  "administrador de infraestructuras ferroviarias": "Renfe",

  // ── MÁV variants ──
  "mav magyar allamvasutak":        "MÁV",
  "mav start":                      "MÁV",

  // ── FlixTrain ──
  "flixtrain":                      "FlixTrain",
  "flix train":                     "FlixTrain",

  // ── Trenitalia variants ──
  "trenitalia spa":                 "Trenitalia",
  "ferrovie dello stato italiane":  "Trenitalia",

  // ── Hellenic Train ──
  "trainose":                       "Hellenic Train",
  "hellenic train":                 "Hellenic Train",

  // ── LTG Link ──
  "ltg link":                       "LTG Link",
  "ltglink":                        "LTG Link",

  // ── Vivi ──
  "pasażieru vilciens":             "Vivi",

  // ── Westbahn ──
  "westbahn gmbh":                  "Westbahn",
  "westbahn management gmbh":       "Westbahn",

  // ── Arriva ──
  "arriva nederland":               "Arriva",
  "arriva personenvervoer nederland": "Arriva",

  // ── Eurostar ──
  "eurostar international":         "Eurostar",

  // ── Qbuzz ──
  "qbuzz nederland":                "Qbuzz",

  // ── UK operators ──
  "scotrail":                       "National Rail",
  "scotrail abellio":               "National Rail",
  "abellio scotrail":               "National Rail",
  "london midland":                 "West Midlands Trains",  // historical → current
  "east midlands trains":           "East Midlands Railway",
  "arriva trains wales":            "Transport for Wales",
  "arriva rail north":              "Northern",
  "northern rail":                  "Northern",
  "southern railway":               "GTR",
  "gatwick express":                "GTR",
  "thameslink":                     "GTR",
  "great northern":                 "GTR",
  "new southern railway":           "GTR",
  "merseyrail":                     "National Rail",
  "first trans pennine express":    "TransPennine Express",
  "first great western":            "Great Western Railway",
  "c2c":                            "National Rail",
  "london overground":              "National Rail",
  "tfl rail":                        "National Rail",
  "elizabeth line":                  "National Rail",
  "west midlands trains":           "West Midlands Trains",
  "west midlands railway":          "West Midlands Trains",
  "london northwestern":            "West Midlands Trains",
  "ni railways":                    "NI Railways",
  "northern ireland railways":      "NI Railways",
  "translink":                      "NI Railways",
  "regie autonome des transports parisiens": "RATP",
  "ratp":                           "RATP",
  "chemins de fer de la corse":     "Chemins de Fer de la Corse",
  "cfc":                            "Chemins de Fer de la Corse",
  "lokaltog":                       "Lokaltog",
  "raaberbahn":                     "Raaberbahn",
  "raaberbahn ag":                  "Raaberbahn",
  "gysev":                          "Raaberbahn",
  "ferrovie del sud est":           "Ferrovie del Sud Est",
  "fse":                            "Ferrovie del Sud Est",
  "albtal verkehrs gesellschaft":   "Albtal-Verkehrs-Gesellschaft mbH",
  "avag":                           "Albtal-Verkehrs-Gesellschaft mbH",
  "transports publics du chablais": "Transports Publics du Chablais",
  "tpc":                            "Transports Publics du Chablais",
  "appenzeller bahnen":             "Appenzeller Bahnen",
  "appenzellerbahn":                "Appenzeller Bahnen",
  "ab":                             "Appenzeller Bahnen",
  "montreux berner oberland bahn":  "Montreux-Berner Oberland-Bahn",
  "mob":                            "Montreux-Berner Oberland-Bahn",
  "compagnia trasporti laziali":    "Compagnia Trasporti Laziali",
  "ctl":                            "Compagnia Trasporti Laziali",
  "cotral":                         "Compagnia Trasporti Laziali",
  "aare seeland mobil":             "Aare Seeland mobil",
  "asm":                            "Aare Seeland mobil",
  "chemins de fer du jura":         "Chemins de fer du Jura",
  "cj":                             "Chemins de fer du Jura",
  "schweizerische sudostbahn":      "Schweizerische Südostbahn",
  "sob":                            "Schweizerische Südostbahn",
  "sudostbayernbahn":               "Südostbayernbahn",
  "südostbayernbahn":               "Südostbayernbahn",
  "crimea railway":                 "Crimea Railway",
  "nordjyske jernbaner":            "Nordjyske Jernbaner",
  "nj":                             "Nordjyske Jernbaner",
  "glasgow":                        "ScotRail",
  "network rail":                   "Network Rail",
  "network rail infrastructure ltd": "Network Rail",
  "euskotren trena":                "Euskotren",
  "euskotren":                      "Euskotren",
  "ukrzaliznytsia":                 "Ukrzaliznytsia",
  "oekraiense spoorwegen":          "Ukrzaliznytsia",
  "ukrainian railway":              "Ukrzaliznytsia",
  "ukrainian railways":             "Ukrzaliznytsia",
  "cale ferate romane":             "CFR Călători", // already above, keeping for safety
  "caile ferate romane":            "CFR Călători",
};

/**
 * Normalize an operator name for fuzzy matching.
 * - lowercases, strips diacritics, replaces & with "and"
 * - removes common legal suffixes
 * - collapses whitespace
 */
function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/\b(nv|sa|ag|as|spa|srl|ltd|limited|gmbh|bv|plc|inc|llc|ab|ev|z s|azo|a s)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── 1. Load both files ───────────────────────────────────────────────
const dataRaw = await readFile("data.json", "utf8");
const stationRaw = await readFile("stations.json", "utf8");

const operatorDb = JSON.parse(dataRaw);
const stationData = JSON.parse(stationRaw);

// ── 2. Build lookup: normalized forms → canonical name from data.json ─
const knownOperators = new Map(); // normalized → canonical name

// 2a. Add manual aliases first (highest priority)
for (const [aliasNormalized, canonicalName] of Object.entries(MANUAL_ALIASES)) {
  knownOperators.set(aliasNormalized, canonicalName);
}

// 2b. Add entries from data.json
for (const op of (operatorDb.operators || [])) {
  const canonicalName = op.name;
  const forms = new Set([op.name, op.id]);

  // Add individual name parts as fuzzy aids (for multi-word names)
  const nameParts = normalizeName(op.name).split(/\s+/).filter(Boolean);
  if (nameParts.length >= 2) {
    forms.add(nameParts.join(" "));
  }

  for (const form of forms) {
    const normalized = normalizeName(form);
    if (normalized && !knownOperators.has(normalized)) {
      knownOperators.set(normalized, canonicalName);
    }
  }
}

// 2c. Add each logo filename (without extension) as a potential match
for (const op of (operatorDb.operators || [])) {
  if (op.logo) {
    const logoName = op.logo.replace(/\.(png|svg|jpg)$/i, "").replace(/[_-]+/g, " ");
    const normalized = normalizeName(logoName);
    const canonicalName = op.name;
    if (normalized && !knownOperators.has(normalized)) {
      knownOperators.set(normalized, canonicalName);
    }
  }
}

// 2d. Also add country-specific infrastructure managers to known operators
// so they're recognized as known (they'll keep their name but won't be "missing")
const infrastructureAliases = {
  "rete ferroviaria italiana": "Rete Ferroviaria Italiana",
  "rfi": "Rete Ferroviaria Italiana",
  "adif": "Adif",
  "infraestruturas de portugal": "Infraestruturas de Portugal",
  "sprava zeleznic": "Správa železnic",
  "pkp polskie linie kolejowe": "PKP Polskie Linie Kolejowe",
  "zeleznice slovenskej republiky": "Železnice Slovenskej republiky",
  "national railway infrastructure company": "National Railway Infrastructure Company",
  "finnish transport infrastructure agency": "Finnish Transport Infrastructure Agency",
  "azerbaijan railway": "Azerbaijan Railway",
  "ukrzaliznytsia": "Ukrzaliznytsia",
};
for (const [norm, displayName] of Object.entries(infrastructureAliases)) {
  if (!knownOperators.has(norm)) {
    knownOperators.set(norm, displayName);
  }
}

console.log(`Loaded ${operatorDb.operators.length} operators from data.json`);
console.log(`Built ${knownOperators.size} normalized lookup entries`);

// ── 3. Process every station ─────────────────────────────────────────
const missing = new Map(); // original operator name → { name, countries, stationCount, sampleStations }
let totalStations = 0;
let totalReplacements = 0;

for (const [countryKey, country] of Object.entries(stationData.countries || {})) {
  for (const station of (country.stations || [])) {
    totalStations++;
    const syncedOperators = [];

    for (const operatorName of (station.operators || [])) {
      const normalized = normalizeName(operatorName);
      if (!normalized) continue;

      // Try exact normalized match first
      let matchedName = knownOperators.get(normalized);

      // If no exact match, try partial matching: check if any known operator
      // name is contained within this one, or vice versa
      if (!matchedName) {
        for (const [knownNorm, canonical] of knownOperators) {
          const knownParts = knownNorm.split(/\s+/);
          const opParts = normalized.split(/\s+/);
          
          // Check if one contains all significant words of the other
          const shorter = knownParts.length <= opParts.length ? knownParts : opParts;
          const longer = knownParts.length > opParts.length ? knownParts : opParts;
          
          // If all words of the shorter name appear in the longer name
          const allWordsMatch = shorter.every(w => longer.includes(w));
          
          if (allWordsMatch && shorter.length >= 1) {
            matchedName = canonical;
            break;
          }
        }
      }

      // Skip Wikidata Q-IDs (e.g. "Q314293") — these are not real operator names
      if (/^q\d+$/.test(normalized)) {
        continue;
      }

      if (matchedName) {
        // Add the harmonized name (deduplicate)
        if (!syncedOperators.includes(matchedName)) {
          syncedOperators.push(matchedName);
          totalReplacements++;
        }
      } else {
        // Keep the original name in the station
        if (!syncedOperators.includes(operatorName)) {
          syncedOperators.push(operatorName);
        }

        // Track missing operator
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
        if (entry.sampleStations.length < 5) {
          entry.sampleStations.push({
            name: station.name,
            country: country.country,
            source: station.source,
            url: station.url
          });
        }
      }
    }

    station.operators = syncedOperators;
  }
}

// ── 4. Write results ─────────────────────────────────────────────────

// 4a. Save updated stations.json
await writeFile("stations.json", `${JSON.stringify(stationData, null, 2)}\n`, "utf8");
console.log(`\n✓ Updated stations.json — processed ${totalStations} stations, made ${totalReplacements} operator replacements`);

// 4b. Save missing-operators-report.json (detailed JSON)
const missingOutput = {
  generatedAt: new Date().toISOString(),
  totalMissing: missing.size,
  operators: [...missing.values()]
    .map(entry => ({
      ...entry,
      countries: [...entry.countries].sort((a, b) => a.localeCompare(b))
    }))
    .sort((a, b) => b.stationCount - a.stationCount || a.name.localeCompare(b.name))
};

await writeFile("missing-operators-report.json", `${JSON.stringify(missingOutput, null, 2)}\n`, "utf8");
console.log(`✓ Saved missing-operators-report.json with ${missingOutput.totalMissing} unmatched operators`);

// 4c. Save missing-operators.txt (human-readable text report)
const lines = [
  `Missing Operators Report — generated ${new Date().toISOString()}`,
  `Total operators NOT in database: ${missingOutput.totalMissing}`,
  `Total operators in database: ${operatorDb.operators.length}`,
  "",
  "=".repeat(80),
  ...missingOutput.operators.map(op => {
    const countries = op.countries.join(", ");
    return [
      `\n${op.name}`,
      `  Stations: ${op.stationCount}`,
      `  Countries: ${countries}`,
      op.sampleStations.map(s => `  Sample: ${s.name} (${s.country})`).join("\n")
    ].join("\n");
  }),
  "",
  "=".repeat(80),
  `End of report — ${missingOutput.totalMissing} operators not found in data.json`
].join("\n");

await writeFile("missing-operators.txt", lines, "utf8");
console.log("✓ Saved missing-operators.txt (human-readable report)");

// 4d. Save a simple summary CSV
const csvLines = [
  "Operator Name,Station Count,Countries",
  ...missingOutput.operators.map(op =>
    `"${op.name}",${op.stationCount},"${op.countries.join("; ")}"`
  )
];
await writeFile("missing-operators.csv", csvLines.join("\n"), "utf8");
console.log("✓ Saved missing-operators.csv");

console.log("\nDone! 🎉");
