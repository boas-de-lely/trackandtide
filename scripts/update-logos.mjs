import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const data = JSON.parse(await readFile("data.json", "utf8"));

// Map operator IDs to their logo filenames
const logoMap = {
  "stena_line": "stena_line.png",
  "finnlines": "finnlines.png",
  "viking_line": "viking_line.png",
  "condor_ferries": "condor_ferries.png",
  "moby_lines": "moby_lines.png",
  "eurotunnel": "eurotunnel.png",
  // Already have these:
  "rederij_doeksen": "rederij_doeksen.png",
  "acciona": "",  // Couldn't download
  "tt_line": "",  // Couldn't download
  "irish_ferries": "", // Couldn't download
  "tallink_silja": "", // Couldn't download (Wikimedia doesn't have it)
  "gnv": "", // Couldn't download
  "corsica_ferries": "", // Couldn't download
  "anek_lines": "", // Couldn't download
  "molslinjen": "", // Couldn't download
  "p_o_ferries": "", // Couldn't download - use po.png as fallback?
  "forsea": "",
  "eckero_line": "",
  "wasaline": "",
  "destination_gotland": "",
  "wagenborg": "",
  "ag_ems": "",
  "northlink_ferries": "",
  "caledonian_macbrayne": "",
  "smryil_line": "",
  "european_seaways": "",
  "ukrferry": "",
  "black_sea_ferry": "",
  "algerie_ferries": "",
  "tunisie_ferries": "",
  "ctn": "",
  "superfast_ferries": "",
  "jadrolinija": "",
  "ventouris_ferries": "",
};

const logosDir = new URL("../operator logos/", import.meta.url).pathname;

let updated = 0;
for (const op of data.operators) {
  if (logoMap[op.id] !== undefined) {
    op.logo = logoMap[op.id];
    updated++;
  }
}

await writeFile("data.json", JSON.stringify(data, null, 2), "utf8");
console.log(`Updated logo fields for ${updated} operators. Total: ${data.operators.length} operators.`);
