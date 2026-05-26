import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const data = JSON.parse(await readFile("data.json", "utf8"));

// Logo sources: try to download from Wikipedia/Wikimedia
// For operators without a logo, try to find one
const logoUrls = {
  "stena_line": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Stena_Line_logo.svg/200px-Stena_Line_logo.svg.png",
  "p_o_ferries": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/P%26O_Ferries_logo.svg/200px-P%26O_Ferries_logo.svg.png",
  "finnlines": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Finnlines_logo.svg/200px-Finnlines_logo.svg.png",
  "tt_line": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/TT-Line_Logo.svg/200px-TT-Line_Logo.svg.png",
  "tallink_silja": "https://upload.wikimedia.org/wikipedia/en/thumb/9/9a/Tallink_Silja.svg/200px-Tallink_Silja.svg.png",
  "viking_line": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Viking_Line_logo.svg/200px-Viking_Line_logo.svg.png",
  "gnv": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/GNV_logo.svg/200px-GNV_logo.svg.png",
  "moby_lines": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Moby_ferries.svg/200px-Moby_ferries.svg.png",
  "corsica_ferries": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Corsica_Ferries_logo.svg/200px-Corsica_Ferries_logo.svg.png",
  "condor_ferries": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Condor_Ferries_logo.svg/200px-Condor_Ferries_logo.svg.png",
  "irish_ferries": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Irish_Ferries_logo.svg/200px-Irish_Ferries_logo.svg.png",
  "eurotunnel": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Getlink_logo.svg/200px-Getlink_logo.svg.png",
  "algerie_ferries": "",
  "tunisie_ferries": "",
  "ctn": "",
  "anek_lines": "https://upload.wikimedia.org/wikipedia/en/thumb/7/7c/ANEK_Lines_logo.svg/200px-ANEK_Lines_logo.svg.png",
  "superfast_ferries": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Superfast_Ferries.png/200px-Superfast_Ferries.png",
  "jadrolinija": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Jadrolinija_logo.svg/200px-Jadrolinija_logo.svg.png",
  "ventouris_ferries": "",
  "molslinjen": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Molslinjen_logo.svg/200px-Molslinjen_logo.svg.png",
  "forsea": "",
  "eckero_line": "",
  "wasaline": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Wasaline_logo.svg/200px-Wasaline_logo.svg.png",
  "destination_gotland": "",
  "teso": "",
  "rederij_doeksen": "",
  "wagenborg": "",
  "ag_ems": "",
  "northlink_ferries": "",
  "caledonian_macbrayne": "",
  "smryil_line": "",
  "european_seaways": "",
  "ukrferry": "",
  "black_sea_ferry": "",
  "acciona": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Acciona_logo.svg/200px-Acciona_logo.svg.png",
};

const logosDir = new URL("../operator logos/", import.meta.url).pathname;

for (const op of data.operators) {
  if (op.logo) {
    const logoPath = `${logosDir}${op.logo}`;
    if (existsSync(logoPath)) continue; // already exists
  }

  const url = logoUrls[op.id];
  if (!url) {
    if (!op.logo) {
      op.logo = "";
    }
    continue;
  }

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buffer = Buffer.from(await resp.arrayBuffer());
    const ext = url.includes(".svg") ? "svg" : "png";
    const filename = `${op.id}.${ext}`;
    await writeFile(`${logosDir}${filename}`, buffer);
    op.logo = filename;
    console.log(`✓ Downloaded logo: ${filename}`);
  } catch (e) {
    console.log(`✗ Failed to download logo for ${op.id}: ${e.message}`);
    if (!op.logo) op.logo = "";
  }
}

await writeFile("data.json", JSON.stringify(data, null, 2), "utf8");
console.log("\nDone updating logos in data.json");
