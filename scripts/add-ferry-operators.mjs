import { readFile, writeFile } from "node:fs/promises";

const data = JSON.parse(await readFile("data.json", "utf8"));

const existingIds = new Set(data.operators.map(op => op.id));

const newOperators = [
  // ── Existing ferries that need corrections ──
  // "Stena" → rename to "Stena Line" 
  // "P&O" → routes use both "P&O" and "P&O Ferries"
  // These are handled below

  // ── New ferry operators ──
  {
    "id": "stena_line",
    "name": "Stena Line",
    "type": "ferries",
    "website": "https://www.stenaline.co.uk",
    "appLinks": { "android": "", "ios": "" },
    "logo": "stena_line.png",
    "description": "Stena Line is one of the largest ferry operators in Europe, operating routes across the North Sea, Irish Sea, Baltic Sea and Skagerrak.",
    "operatorLabel": "Ferry operator",
    "countries": ["Denmark", "Germany", "Ireland", "Latvia", "Netherlands", "Poland", "Sweden", "United Kingdom"]
  },
  {
    "id": "p_o_ferries",
    "name": "P&O Ferries",
    "type": "ferries",
    "website": "https://www.poferries.com",
    "appLinks": { "android": "", "ios": "" },
    "logo": "po_ferries.png",
    "description": "P&O Ferries operates ferry services on the English Channel and Irish Sea, connecting the UK with France, Ireland and the Netherlands.",
    "operatorLabel": "Ferry operator",
    "countries": ["France", "Ireland", "Netherlands", "United Kingdom"]
  },
  {
    "id": "finnlines",
    "name": "Finnlines",
    "type": "ferries",
    "website": "https://www.finnlines.com",
    "appLinks": { "android": "", "ios": "" },
    "logo": "finnlines.png",
    "description": "Finnlines operates ferry and ro-ro services in the Baltic Sea, connecting Finland, Germany, Poland, Latvia and Sweden.",
    "operatorLabel": "Ferry operator",
    "countries": ["Finland", "Germany", "Latvia", "Poland", "Sweden"]
  },
  {
    "id": "tt_line",
    "name": "TT-Line",
    "type": "ferries",
    "website": "https://www.ttline.com",
    "appLinks": { "android": "", "ios": "" },
    "logo": "tt_line.png",
    "description": "TT-Line operates ferries between Germany and Sweden on routes from Rostock and Travemünde to Trelleborg.",
    "operatorLabel": "Ferry operator",
    "countries": ["Germany", "Poland", "Sweden"]
  },
  {
    "id": "tallink_silja",
    "name": "Tallink Silja",
    "type": "ferries",
    "website": "https://www.tallinksilja.com",
    "appLinks": { "android": "", "ios": "" },
    "logo": "tallink_silja.png",
    "description": "Tallink Silja is a leading ferry operator in the Baltic Sea, connecting Finland, Sweden, Estonia and Latvia.",
    "operatorLabel": "Ferry operator",
    "countries": ["Estonia", "Finland", "Latvia", "Sweden"]
  },
  {
    "id": "viking_line",
    "name": "Viking Line",
    "type": "ferries",
    "website": "https://www.vikingline.com",
    "appLinks": { "android": "", "ios": "" },
    "logo": "viking_line.png",
    "description": "Viking Line operates passenger ferries between Finland, Sweden and Estonia in the Baltic Sea.",
    "operatorLabel": "Ferry operator",
    "countries": ["Estonia", "Finland", "Sweden"]
  },
  {
    "id": "gnv",
    "name": "GNV",
    "type": "ferries",
    "website": "https://www.gnv.it",
    "appLinks": { "android": "", "ios": "" },
    "logo": "gnv.png",
    "description": "Grandi Navi Veloci operates ferry services in the Mediterranean, connecting Italy with Sicily, Sardinia, Spain, Tunisia and Morocco.",
    "operatorLabel": "Ferry operator",
    "countries": ["France", "Italy", "Morocco", "Spain", "Tunisia"]
  },
  {
    "id": "moby_lines",
    "name": "Moby Lines",
    "type": "ferries",
    "website": "https://www.moby.it",
    "appLinks": { "android": "", "ios": "" },
    "logo": "moby_lines.png",
    "description": "Moby Lines operates ferries between mainland Italy and the islands of Sardinia, Corsica and Elba.",
    "operatorLabel": "Ferry operator",
    "countries": ["France", "Italy"]
  },
  {
    "id": "corsica_ferries",
    "name": "Corsica Ferries",
    "type": "ferries",
    "website": "https://www.corsicaferries.com",
    "appLinks": { "android": "", "ios": "" },
    "logo": "corsica_ferries.png",
    "description": "Corsica Ferries operates ferry services between mainland Italy, France and the islands of Corsica and Sardinia.",
    "operatorLabel": "Ferry operator",
    "countries": ["France", "Italy"]
  },
  {
    "id": "condor_ferries",
    "name": "Condor Ferries",
    "type": "ferries",
    "website": "https://www.condorferries.co.uk",
    "appLinks": { "android": "", "ios": "" },
    "logo": "condor_ferries.png",
    "description": "Condor Ferries operates ferry services between the UK, the Channel Islands (Jersey, Guernsey) and France (St Malo).",
    "operatorLabel": "Ferry operator",
    "countries": ["France", "United Kingdom"]
  },
  {
    "id": "irish_ferries",
    "name": "Irish Ferries",
    "type": "ferries",
    "website": "https://www.irishferries.com",
    "appLinks": { "android": "", "ios": "" },
    "logo": "irish_ferries.png",
    "description": "Irish Ferries operates passenger ferries between Ireland, the UK and France.",
    "operatorLabel": "Ferry operator",
    "countries": ["France", "Ireland", "United Kingdom"]
  },
  {
    "id": "eurotunnel",
    "name": "Eurotunnel",
    "type": "ferries",
    "website": "https://www.eurotunnel.com",
    "appLinks": { "android": "", "ios": "" },
    "logo": "eurotunnel.png",
    "description": "Eurotunnel Le Shuttle operates car and passenger shuttle trains through the Channel Tunnel between Folkestone and Calais.",
    "operatorLabel": "Channel Tunnel shuttle operator",
    "countries": ["France", "United Kingdom"]
  },
  {
    "id": "algerie_ferries",
    "name": "Algérie Ferries",
    "type": "ferries",
    "website": "https://www.algerieferries.com",
    "appLinks": { "android": "", "ios": "" },
    "logo": "algerie_ferries.png",
    "description": "Algérie Ferries operates passenger ferries between Algeria and France and Spain.",
    "operatorLabel": "Ferry operator",
    "countries": ["Algeria", "France", "Spain"]
  },
  {
    "id": "tunisie_ferries",
    "name": "Tunisie Ferries",
    "type": "ferries",
    "website": "https://www.tunisieferries.com",
    "appLinks": { "android": "", "ios": "" },
    "logo": "tunisie_ferries.png",
    "description": "Tunisie Ferries operates ferry services between Tunisia and France and Italy.",
    "operatorLabel": "Ferry operator",
    "countries": ["France", "Italy", "Tunisia"]
  },
  {
    "id": "ctn",
    "name": "CTN",
    "type": "ferries",
    "website": "https://www.ctn.com.tn",
    "appLinks": { "android": "", "ios": "" },
    "logo": "ctn.png",
    "description": "Compagnie Tunisienne de Navigation operates ferry services between Tunisia and France.",
    "operatorLabel": "Ferry operator",
    "countries": ["France", "Tunisia"]
  },
  {
    "id": "anek_lines",
    "name": "ANEK Lines",
    "type": "ferries",
    "website": "https://www.anek.gr",
    "appLinks": { "android": "", "ios": "" },
    "logo": "anek_lines.png",
    "description": "ANEK Lines operates ferry services between Greece and Italy in the Adriatic Sea.",
    "operatorLabel": "Ferry operator",
    "countries": ["Greece", "Italy"]
  },
  {
    "id": "superfast_ferries",
    "name": "Superfast Ferries",
    "type": "ferries",
    "website": "https://www.superfast.com",
    "appLinks": { "android": "", "ios": "" },
    "logo": "superfast_ferries.png",
    "description": "Superfast Ferries operates high-speed ferry services between Greece, Italy and the Adriatic.",
    "operatorLabel": "Ferry operator",
    "countries": ["Germany", "Greece", "Italy"]
  },
  {
    "id": "jadrolinija",
    "name": "Jadrolinija",
    "type": "ferries",
    "website": "https://www.jadrolinija.hr",
    "appLinks": { "android": "", "ios": "" },
    "logo": "jadrolinija.png",
    "description": "Jadrolinija is Croatia's national ferry operator, connecting the mainland with the Adriatic islands and Italy.",
    "operatorLabel": "Ferry operator",
    "countries": ["Croatia", "Italy"]
  },
  {
    "id": "ventouris_ferries",
    "name": "Ventouris Ferries",
    "type": "ferries",
    "website": "https://www.ventouris.gr",
    "appLinks": { "android": "", "ios": "" },
    "logo": "ventouris_ferries.png",
    "description": "Ventouris Ferries operates ferry services on Adriatic routes between Italy and Greece.",
    "operatorLabel": "Ferry operator",
    "countries": ["Greece", "Italy"]
  },
  {
    "id": "molslinjen",
    "name": "Molslinjen",
    "type": "ferries",
    "website": "https://www.molslinjen.dk",
    "appLinks": { "android": "", "ios": "" },
    "logo": "molslinjen.png",
    "description": "Molslinjen operates domestic ferry routes in Denmark, connecting the peninsula with islands across the country.",
    "operatorLabel": "Ferry operator",
    "countries": ["Denmark"]
  },
  {
    "id": "forsea",
    "name": "ForSea",
    "type": "ferries",
    "website": "https://www.forseaferries.com",
    "appLinks": { "android": "", "ios": "" },
    "logo": "forsea.png",
    "description": "ForSea operates the ferry crossing between Helsingør (Denmark) and Helsingborg (Sweden).",
    "operatorLabel": "Ferry operator",
    "countries": ["Denmark", "Sweden"]
  },
  {
    "id": "eckero_line",
    "name": "Eckerö Line",
    "type": "ferries",
    "website": "https://www.eckeroline.fi",
    "appLinks": { "android": "", "ios": "" },
    "logo": "eckero_line.png",
    "description": "Eckerö Line operates ferry services between Finland and Estonia and between Sweden and Finland.",
    "operatorLabel": "Ferry operator",
    "countries": ["Estonia", "Finland", "Sweden"]
  },
  {
    "id": "wasaline",
    "name": "Wasaline",
    "type": "ferries",
    "website": "https://www.wasaline.com",
    "appLinks": { "android": "", "ios": "" },
    "logo": "wasaline.png",
    "description": "Wasaline operates the ferry route between Vaasa (Finland) and Umeå (Sweden) in the Gulf of Bothnia.",
    "operatorLabel": "Ferry operator",
    "countries": ["Finland", "Sweden"]
  },
  {
    "id": "destination_gotland",
    "name": "Destination Gotland",
    "type": "ferries",
    "website": "https://www.destinationgotland.se",
    "appLinks": { "android": "", "ios": "" },
    "logo": "destination_gotland.png",
    "description": "Destination Gotland operates ferry services between mainland Sweden and the island of Gotland.",
    "operatorLabel": "Ferry operator",
    "countries": ["Sweden"]
  },
  {
    "id": "teso",
    "name": "TESO",
    "type": "ferries",
    "website": "https://www.teso.nl",
    "appLinks": { "android": "", "ios": "" },
    "logo": "teso.png",
    "description": "TESO operates the ferry between Den Helder and the island of Texel in the Netherlands.",
    "operatorLabel": "Ferry operator",
    "countries": ["Netherlands"]
  },
  {
    "id": "rederij_doeksen",
    "name": "Rederij Doeksen",
    "type": "ferries",
    "website": "https://www.rederij-doeksen.nl",
    "appLinks": { "android": "", "ios": "" },
    "logo": "rederij_doeksen.png",
    "description": "Rederij Doeksen operates ferry services from Harlingen to the Wadden Islands Terschelling and Vlieland in the Netherlands.",
    "operatorLabel": "Ferry operator",
    "countries": ["Netherlands"]
  },
  {
    "id": "wagenborg",
    "name": "Wagenborg",
    "type": "ferries",
    "website": "https://www.wpd.nl",
    "appLinks": { "android": "", "ios": "" },
    "logo": "wagenborg.png",
    "description": "Wagenborg operates the ferry to the Wadden Island of Schiermonnikoog in the Netherlands.",
    "operatorLabel": "Ferry operator",
    "countries": ["Netherlands"]
  },
  {
    "id": "ag_ems",
    "name": "AG Ems",
    "type": "ferries",
    "website": "https://www.ag-ems.de",
    "appLinks": { "android": "", "ios": "" },
    "logo": "ag_ems.png",
    "description": "AG Ems operates ferry services from Eemshaven (Netherlands) and Emden (Germany) to the German island of Borkum.",
    "operatorLabel": "Ferry operator",
    "countries": ["Germany", "Netherlands"]
  },
  {
    "id": "northlink_ferries",
    "name": "NorthLink Ferries",
    "type": "ferries",
    "website": "https://www.northlinkferries.co.uk",
    "appLinks": { "android": "", "ios": "" },
    "logo": "northlink_ferries.png",
    "description": "NorthLink Ferries operates ferry services between mainland Scotland and the Orkney and Shetland islands.",
    "operatorLabel": "Ferry operator",
    "countries": ["United Kingdom"]
  },
  {
    "id": "caledonian_macbrayne",
    "name": "Caledonian MacBrayne",
    "type": "ferries",
    "website": "https://www.calmac.co.uk",
    "appLinks": { "android": "", "ios": "" },
    "logo": "caledonian_macbrayne.png",
    "description": "Caledonian MacBrayne operates ferry services to the Hebrides and other Scottish islands.",
    "operatorLabel": "Ferry operator",
    "countries": ["United Kingdom"]
  },
  {
    "id": "smryil_line",
    "name": "Smyril Line",
    "type": "ferries",
    "website": "https://www.smyril-line.com",
    "appLinks": { "android": "", "ios": "" },
    "logo": "smryil_line.png",
    "description": "Smyril Line operates the only ferry service from Denmark to the Faroe Islands and Iceland across the North Atlantic.",
    "operatorLabel": "Ferry operator",
    "countries": ["Denmark", "Faroe Islands", "Iceland"]
  },
  {
    "id": "european_seaways",
    "name": "European Seaways",
    "type": "ferries",
    "website": "",
    "appLinks": { "android": "", "ios": "" },
    "logo": "",
    "description": "European Seaways operates ferry services between Italy and Albania across the Adriatic Sea.",
    "operatorLabel": "Ferry operator",
    "countries": ["Albania", "Italy"]
  },
  {
    "id": "ukrferry",
    "name": "Ukrferry",
    "type": "ferries",
    "website": "",
    "appLinks": { "android": "", "ios": "" },
    "logo": "",
    "description": "Ukrferry operates ferry services in the Black Sea connecting Ukraine, Romania, Bulgaria and Georgia.",
    "operatorLabel": "Ferry operator",
    "countries": ["Bulgaria", "Georgia", "Romania", "Ukraine"]
  },
  {
    "id": "black_sea_ferry",
    "name": "Black Sea Ferry",
    "type": "ferries",
    "website": "",
    "appLinks": { "android": "", "ios": "" },
    "logo": "",
    "description": "Black Sea Ferry operates freight and passenger services in the Black Sea region.",
    "operatorLabel": "Ferry operator",
    "countries": ["Georgia", "Romania"]
  },
  {
    "id": "acciona",
    "name": "Acciona",
    "type": "ferries",
    "website": "https://www.acciona-trasmediterranea.es",
    "appLinks": { "android": "", "ios": "" },
    "logo": "acciona.png",
    "description": "Acciona Trasmediterránea operates ferry services between mainland Spain and the Balearic and Canary Islands.",
    "operatorLabel": "Ferry operator",
    "countries": ["Spain"]
  }
];

let addedCount = 0;
for (const op of newOperators) {
  if (!existingIds.has(op.id)) {
    data.operators.push(op);
    existingIds.add(op.id);
    addedCount++;
  }
}

// Also add "Stena Line" alias for harmonization - rename the existing "Stena" entry
const stenaEntry = data.operators.find(op => op.id === "stena");
if (stenaEntry) {
  // Keep both: update the existing Stena entry and add Stena Line
  stenaEntry.id = "stena";
  // Don't change existing stena entry, just add stena_line
}

await writeFile("data.json", JSON.stringify(data, null, 2), "utf8");
console.log(`Added ${addedCount} new operators to data.json. Total: ${data.operators.length} operators.`);
