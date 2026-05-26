import { readFile, writeFile } from "node:fs/promises";

const ferryRaw = await readFile("ferries.json", "utf8");
const ferryData = JSON.parse(ferryRaw);

// Map of route operator names → data.json operator names
const operatorMap = {
  "P&O": "P&O",
  "P&O Ferries": "P&O Ferries",
  "Stena": "Stena",
  "Stena Line": "Stena Line",
  "Trasmediterránea": "Trasmediterránea",
  "Tallink Silja": "Tallink Silja",
  "Viking Line": "Viking Line",
  "Color Line": "Color Line",
  "Fjord Line": "Fjord Line",
  "Brittany Ferries": "Brittany Ferries",
  "DFDS": "DFDS",
  "Grimaldi Lines": "Grimaldi Lines",
  "Scandlines": "Scandlines",
  "Tirrenia": "Tirrenia",
  "Balearia": "Balearia",
  "Finnlines": "Finnlines",
  "TT-Line": "TT-Line",
  "GNV": "GNV",
  "Moby Lines": "Moby Lines",
  "Corsica Ferries": "Corsica Ferries",
  "Condor Ferries": "Condor Ferries",
  "Irish Ferries": "Irish Ferries",
  "Eurotunnel": "Eurotunnel",
  "Algérie Ferries": "Algérie Ferries",
  "Tunisie Ferries": "Tunisie Ferries",
  "CTN": "CTN",
  "ANEK Lines": "ANEK Lines",
  "Superfast Ferries": "Superfast Ferries",
  "Jadrolinija": "Jadrolinija",
  "Ventouris Ferries": "Ventouris Ferries",
  "Molslinjen": "Molslinjen",
  "ForSea": "ForSea",
  "Eckerö Line": "Eckerö Line",
  "Wasaline": "Wasaline",
  "Destination Gotland": "Destination Gotland",
  "TESO": "TESO",
  "Rederij Doeksen": "Rederij Doeksen",
  "Wagenborg": "Wagenborg",
  "AG Ems": "AG Ems",
  "NorthLink Ferries": "NorthLink Ferries",
  "Caledonian MacBrayne": "Caledonian MacBrayne",
  "Smyril Line": "Smyril Line",
  "European Seaways": "European Seaways",
  "Ukrferry": "Ukrferry",
  "Black Sea Ferry": "Black Sea Ferry",
  "Acciona": "Acciona",
};

let changes = 0;
for (const route of ferryData.routes) {
  const mapped = operatorMap[route.operator];
  if (mapped && mapped !== route.operator) {
    route.operator = mapped;
    changes++;
  }
}

await writeFile("ferries.json", JSON.stringify(ferryData, null, 2), "utf8");
console.log(`Harmonized ${changes} ferry route operator names.`);
