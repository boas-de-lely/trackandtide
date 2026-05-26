import { readFile, writeFile } from "node:fs/promises";

const existingRaw = await readFile("ferries.json", "utf8");
const existing = JSON.parse(existingRaw);

// ── Additional ferry routes to merge in ──────────────────────────────
const newRoutes = [
  // ════════════════════════════════════════════════
  // DFDS — more routes
  // ════════════════════════════════════════════════
  {
    "name": "Newhaven - Dieppe",
    "coords": [[50.79, 0.05], [49.92, 1.08]],
    "countries": ["United Kingdom", "France"],
    "operator": "DFDS"
  },
  {
    "name": "Paldiski - Kapellskär",
    "coords": [[59.35, 24.05], [59.72, 19.06]],
    "countries": ["Estonia", "Sweden"],
    "operator": "DFDS"
  },
  {
    "name": "Ghent - Göteborg",
    "coords": [[51.05, 3.72], [57.69, 11.92]],
    "countries": ["Belgium", "Sweden"],
    "operator": "DFDS"
  },
  {
    "name": "Algeciras - Tangier Med",
    "coords": [[36.13, -5.46], [35.88, -5.52]],
    "countries": ["Spain", "Morocco"],
    "operator": "DFDS"
  },
  {
    "name": "Algeciras - Ceuta",
    "coords": [[36.13, -5.46], [35.89, -5.31]],
    "countries": ["Spain"],
    "operator": "DFDS"
  },

  // ════════════════════════════════════════════════
  // P&O Ferries
  // ════════════════════════════════════════════════
  {
    "name": "Dover - Calais",
    "coords": [[51.13, 1.31], [50.97, 1.86]],
    "countries": ["United Kingdom", "France"],
    "operator": "P&O Ferries"
  },
  {
    "name": "Liverpool - Dublin",
    "coords": [[53.46, -3.02], [53.35, -6.26]],
    "countries": ["United Kingdom", "Ireland"],
    "operator": "P&O Ferries"
  },
  {
    "name": "Larne - Cairnryan",
    "coords": [[54.85, -5.81], [54.97, -5.02]],
    "countries": ["United Kingdom"],
    "operator": "P&O Ferries"
  },

  // ════════════════════════════════════════════════
  // Stena Line — additional routes
  // ════════════════════════════════════════════════
  {
    "name": "Fishguard - Rosslare",
    "coords": [[52.01, -4.98], [52.25, -6.34]],
    "countries": ["United Kingdom", "Ireland"],
    "operator": "Stena Line"
  },
  {
    "name": "Belfast - Liverpool",
    "coords": [[54.61, -5.92], [53.39, -3.01]],
    "countries": ["United Kingdom"],
    "operator": "Stena Line"
  },
  {
    "name": "Rosslare - Cherbourg",
    "coords": [[52.25, -6.34], [49.64, -1.62]],
    "countries": ["Ireland", "France"],
    "operator": "Stena Line"
  },
  {
    "name": "Karlskrona - Gdynia",
    "coords": [[56.17, 15.59], [54.52, 18.54]],
    "countries": ["Sweden", "Poland"],
    "operator": "Stena Line"
  },
  {
    "name": "Frederikshavn - Göteborg",
    "coords": [[57.44, 10.54], [57.69, 11.92]],
    "countries": ["Denmark", "Sweden"],
    "operator": "Stena Line"
  },
  {
    "name": "Grenaa - Varberg",
    "coords": [[56.41, 10.88], [57.11, 12.22]],
    "countries": ["Denmark", "Sweden"],
    "operator": "Stena Line"
  },

  // ════════════════════════════════════════════════
  // Brittany Ferries — additional routes
  // ════════════════════════════════════════════════
  {
    "name": "Portsmouth - St Malo",
    "coords": [[50.80, -1.09], [48.65, -2.03]],
    "countries": ["United Kingdom", "France"],
    "operator": "Brittany Ferries"
  },
  {
    "name": "Portsmouth - Cherbourg",
    "coords": [[50.80, -1.09], [49.64, -1.62]],
    "countries": ["United Kingdom", "France"],
    "operator": "Brittany Ferries"
  },
  {
    "name": "Poole - Cherbourg",
    "coords": [[50.71, -1.99], [49.64, -1.62]],
    "countries": ["United Kingdom", "France"],
    "operator": "Brittany Ferries"
  },
  {
    "name": "Cork - Roscoff",
    "coords": [[51.90, -8.48], [48.72, -3.98]],
    "countries": ["Ireland", "France"],
    "operator": "Brittany Ferries"
  },
  {
    "name": "Santander - Plymouth",
    "coords": [[43.46, -3.80], [50.37, -4.14]],
    "countries": ["Spain", "United Kingdom"],
    "operator": "Brittany Ferries"
  },
  {
    "name": "Bilbao - Portsmouth",
    "coords": [[43.35, -3.05], [50.80, -1.09]],
    "countries": ["Spain", "United Kingdom"],
    "operator": "Brittany Ferries"
  },

  // ════════════════════════════════════════════════
  // Color Line — additional
  // ════════════════════════════════════════════════
  {
    "name": "Sandefjord - Strömstad",
    "coords": [[59.13, 10.23], [58.94, 11.17]],
    "countries": ["Norway", "Sweden"],
    "operator": "Color Line"
  },

  // ════════════════════════════════════════════════
  // Fjord Line — additional
  // ════════════════════════════════════════════════
  {
    "name": "Hirtshals - Langesund",
    "coords": [[57.59, 9.96], [58.99, 9.75]],
    "countries": ["Denmark", "Norway"],
    "operator": "Fjord Line"
  },
  {
    "name": "Bergen - Stavanger - Hirtshals",
    "coords": [[60.39, 5.32], [58.97, 5.73], [57.59, 9.96]],
    "countries": ["Norway", "Denmark"],
    "operator": "Fjord Line"
  },

  // ════════════════════════════════════════════════
  // TT-Line — additional
  // ════════════════════════════════════════════════
  {
    "name": "Trelleborg - Travemünde",
    "coords": [[55.37, 13.17], [53.96, 10.87]],
    "countries": ["Sweden", "Germany"],
    "operator": "TT-Line"
  },
  {
    "name": "Trelleborg - Świnoujście",
    "coords": [[55.37, 13.17], [53.91, 14.25]],
    "countries": ["Sweden", "Poland"],
    "operator": "TT-Line"
  },

  // ════════════════════════════════════════════════
  // Finnlines — additional
  // ════════════════════════════════════════════════
  {
    "name": "Helsinki - Gdynia",
    "coords": [[60.17, 24.94], [54.52, 18.54]],
    "countries": ["Finland", "Poland"],
    "operator": "Finnlines"
  },
  {
    "name": "Rostock - Helsinki",
    "coords": [[54.18, 12.08], [60.17, 24.94]],
    "countries": ["Germany", "Finland"],
    "operator": "Finnlines"
  },
  {
    "name": "Malmö - Travemünde",
    "coords": [[55.61, 13.00], [53.96, 10.87]],
    "countries": ["Sweden", "Germany"],
    "operator": "Finnlines"
  },
  {
    "name": "Helsinki - Travemünde",
    "coords": [[60.17, 24.94], [53.96, 10.87]],
    "countries": ["Finland", "Germany"],
    "operator": "Finnlines"
  },

  // ════════════════════════════════════════════════
  // Scandlines — additional
  // ════════════════════════════════════════════════
  {
    "name": "Gedser - Rostock",
    "coords": [[54.58, 11.93], [54.18, 12.08]],
    "countries": ["Denmark", "Germany"],
    "operator": "Scandlines"
  },
  {
    "name": "Helsingør - Helsingborg",
    "coords": [[56.03, 12.61], [56.05, 12.69]],
    "countries": ["Denmark", "Sweden"],
    "operator": "Scandlines"
  },

  // ════════════════════════════════════════════════
  // Tallink Silja — additional
  // ════════════════════════════════════════════════
  {
    "name": "Helsinki - Stockholm",
    "coords": [[60.17, 24.94], [59.33, 18.07]],
    "countries": ["Finland", "Sweden"],
    "operator": "Tallink Silja"
  },

  // ════════════════════════════════════════════════
  // Viking Line — additional
  // ════════════════════════════════════════════════
  {
    "name": "Helsinki - Tallinn",
    "coords": [[60.17, 24.94], [59.44, 24.75]],
    "countries": ["Finland", "Estonia"],
    "operator": "Viking Line"
  },

  // ════════════════════════════════════════════════
  // Moby Lines (Italy-Sardinia-Corsica)
  // ════════════════════════════════════════════════
  {
    "name": "Livorno - Olbia",
    "coords": [[43.55, 10.31], [40.92, 9.50]],
    "countries": ["Italy"],
    "operator": "Moby Lines"
  },
  {
    "name": "Piombino - Olbia",
    "coords": [[42.93, 10.53], [40.92, 9.50]],
    "countries": ["Italy"],
    "operator": "Moby Lines"
  },
  {
    "name": "Civitavecchia - Olbia",
    "coords": [[42.10, 11.79], [40.92, 9.50]],
    "countries": ["Italy"],
    "operator": "Moby Lines"
  },
  {
    "name": "Genoa - Bastia",
    "coords": [[44.40, 8.93], [42.70, 9.45]],
    "countries": ["Italy", "France"],
    "operator": "Moby Lines"
  },

  // ════════════════════════════════════════════════
  // Corsica Ferries
  // ════════════════════════════════════════════════
  {
    "name": "Livorno - Bastia",
    "coords": [[43.55, 10.31], [42.70, 9.45]],
    "countries": ["Italy", "France"],
    "operator": "Corsica Ferries"
  },
  {
    "name": "Savona - Bastia",
    "coords": [[44.31, 8.48], [42.70, 9.45]],
    "countries": ["Italy", "France"],
    "operator": "Corsica Ferries"
  },
  {
    "name": "Nice - Bastia",
    "coords": [[43.70, 7.27], [42.70, 9.45]],
    "countries": ["France"],
    "operator": "Corsica Ferries"
  },
  {
    "name": "Nice - Calvi",
    "coords": [[43.70, 7.27], [42.57, 8.76]],
    "countries": ["France"],
    "operator": "Corsica Ferries"
  },
  {
    "name": "Livorno - Golfo Aranci",
    "coords": [[43.55, 10.31], [41.00, 9.62]],
    "countries": ["Italy"],
    "operator": "Corsica Ferries"
  },

  // ════════════════════════════════════════════════
  // Tirrenia (Italy-Sardinia)
  // ════════════════════════════════════════════════
  {
    "name": "Civitavecchia - Cagliari",
    "coords": [[42.10, 11.79], [39.22, 9.11]],
    "countries": ["Italy"],
    "operator": "Tirrenia"
  },
  {
    "name": "Genoa - Arbatax",
    "coords": [[44.40, 8.93], [39.93, 9.70]],
    "countries": ["Italy"],
    "operator": "Tirrenia"
  },
  {
    "name": "Genoa - Porto Torres",
    "coords": [[44.40, 8.93], [40.84, 8.40]],
    "countries": ["Italy"],
    "operator": "Tirrenia"
  },

  // ════════════════════════════════════════════════
  // Balearia — additional
  // ════════════════════════════════════════════════
  {
    "name": "Barcelona - Ibiza",
    "coords": [[41.38, 2.17], [38.91, 1.43]],
    "countries": ["Spain"],
    "operator": "Balearia"
  },
  {
    "name": "Denia - Ibiza - Palma",
    "coords": [[38.84, 0.11], [38.91, 1.43], [39.57, 2.65]],
    "countries": ["Spain"],
    "operator": "Balearia"
  },
  {
    "name": "Valencia - Palma",
    "coords": [[39.46, -0.32], [39.57, 2.65]],
    "countries": ["Spain"],
    "operator": "Balearia"
  },

  // ════════════════════════════════════════════════
  // Trasmediterránea
  // ════════════════════════════════════════════════
  {
    "name": "Barcelona - Palma",
    "coords": [[41.38, 2.17], [39.57, 2.65]],
    "countries": ["Spain"],
    "operator": "Trasmediterránea"
  },
  {
    "name": "Valencia - Palma",
    "coords": [[39.46, -0.32], [39.57, 2.65]],
    "countries": ["Spain"],
    "operator": "Trasmediterránea"
  },
  {
    "name": "Algeciras - Melilla",
    "coords": [[36.13, -5.46], [35.29, -2.94]],
    "countries": ["Spain"],
    "operator": "Trasmediterránea"
  },

  // ════════════════════════════════════════════════
  // GNV (Grandi Navi Veloci)
  // ════════════════════════════════════════════════
  {
    "name": "Genoa - Palermo",
    "coords": [[44.40, 8.93], [38.12, 13.36]],
    "countries": ["Italy"],
    "operator": "GNV"
  },
  {
    "name": "Genoa - Barcelona",
    "coords": [[44.40, 8.93], [41.38, 2.17]],
    "countries": ["Italy", "Spain"],
    "operator": "GNV"
  },
  {
    "name": "Genoa - Tunis",
    "coords": [[44.40, 8.93], [36.80, 10.18]],
    "countries": ["Italy", "Tunisia"],
    "operator": "GNV"
  },
  {
    "name": "Civitavecchia - Palermo",
    "coords": [[42.10, 11.79], [38.12, 13.36]],
    "countries": ["Italy"],
    "operator": "GNV"
  },

  // ════════════════════════════════════════════════
  // Grimaldi Lines — additional
  // ════════════════════════════════════════════════
  {
    "name": "Livorno - Palermo",
    "coords": [[43.55, 10.31], [38.12, 13.36]],
    "countries": ["Italy"],
    "operator": "Grimaldi Lines"
  },

  // ════════════════════════════════════════════════
  // ANEK / Superfast (Greece-Italy)
  // ════════════════════════════════════════════════
  {
    "name": "Ancona - Igoumenitsa - Patras",
    "coords": [[43.62, 13.51], [40.86, 18.02], [39.50, 20.27], [38.25, 21.73]],
    "countries": ["Italy", "Greece"],
    "operator": "Superfast Ferries"
  },
  {
    "name": "Bari - Dubrovnik - Bar",
    "coords": [[41.13, 16.87], [42.65, 18.09], [42.10, 19.09]],
    "countries": ["Italy", "Croatia", "Montenegro"],
    "operator": "Jadrolinija"
  },

  // ════════════════════════════════════════════════
  // Condor Ferries (Channel Islands)
  // ════════════════════════════════════════════════
  {
    "name": "Poole - St Malo",
    "coords": [[50.71, -1.99], [48.65, -2.03]],
    "countries": ["United Kingdom", "France"],
    "operator": "Condor Ferries"
  },
  {
    "name": "Poole - Jersey",
    "coords": [[50.71, -1.99], [49.19, -2.11]],
    "countries": ["United Kingdom"],
    "operator": "Condor Ferries"
  },
  {
    "name": "Poole - Guernsey",
    "coords": [[50.71, -1.99], [49.46, -2.54]],
    "countries": ["United Kingdom"],
    "operator": "Condor Ferries"
  },
  {
    "name": "St Malo - Jersey",
    "coords": [[48.65, -2.03], [49.19, -2.11]],
    "countries": ["France", "United Kingdom"],
    "operator": "Condor Ferries"
  },

  // ════════════════════════════════════════════════
  // Mediterranean crossings
  // ════════════════════════════════════════════════
  {
    "name": "Barcelona - Algiers",
    "coords": [[41.38, 2.17], [36.75, 3.06]],
    "countries": ["Spain", "Algeria"],
    "operator": "Algérie Ferries"
  },
  {
    "name": "Valencia - Algiers",
    "coords": [[39.46, -0.32], [36.75, 3.06]],
    "countries": ["Spain", "Algeria"],
    "operator": "Algérie Ferries"
  },
  {
    "name": "Tunis - Genoa",
    "coords": [[36.80, 10.18], [44.40, 8.93]],
    "countries": ["Tunisia", "Italy"],
    "operator": "Tunisie Ferries"
  },
  {
    "name": "Tunis - Marseille",
    "coords": [[36.80, 10.18], [43.30, 5.37]],
    "countries": ["Tunisia", "France"],
    "operator": "Tunisie Ferries"
  },
  {
    "name": "Sète - Tangier Med",
    "coords": [[43.41, 3.70], [35.88, -5.52]],
    "countries": ["France", "Morocco"],
    "operator": "GNV"
  },

  // ════════════════════════════════════════════════
  // Smyril Line (North Atlantic)
  // ════════════════════════════════════════════════
  {
    "name": "Hirtshals - Tórshavn - Seyðisfjörður",
    "coords": [[57.59, 9.96], [62.01, -6.77], [65.26, -13.91]],
    "countries": ["Denmark", "Faroe Islands", "Iceland"],
    "operator": "Smyril Line"
  },

  // ════════════════════════════════════════════════
  // Molslinjen (Denmark domestic)
  // ════════════════════════════════════════════════
  {
    "name": "Aarhus - Kalundborg",
    "coords": [[56.15, 10.22], [55.68, 11.09]],
    "countries": ["Denmark"],
    "operator": "Molslinjen"
  },
  {
    "name": "Odden - Ebeltoft",
    "coords": [[55.97, 11.35], [56.20, 10.68]],
    "countries": ["Denmark"],
    "operator": "Molslinjen"
  },

  // ════════════════════════════════════════════════
  // ForSea (formerly HH Ferries)
  // ════════════════════════════════════════════════
  {
    "name": "Helsingør - Helsingborg",
    "coords": [[56.03, 12.61], [56.05, 12.69]],
    "countries": ["Denmark", "Sweden"],
    "operator": "ForSea"
  },

  // ════════════════════════════════════════════════
  // Eckerö Line
  // ════════════════════════════════════════════════
  {
    "name": "Helsinki - Tallinn",
    "coords": [[60.17, 24.94], [59.44, 24.75]],
    "countries": ["Finland", "Estonia"],
    "operator": "Eckerö Line"
  },

  // ════════════════════════════════════════════════
  // Wasaline
  // ════════════════════════════════════════════════
  {
    "name": "Vaasa - Umeå",
    "coords": [[63.09, 21.57], [63.82, 20.25]],
    "countries": ["Finland", "Sweden"],
    "operator": "Wasaline"
  },

  // ════════════════════════════════════════════════
  // Destination Gotland
  // ════════════════════════════════════════════════
  {
    "name": "Nynäshamn - Visby",
    "coords": [[58.90, 17.95], [57.64, 18.30]],
    "countries": ["Sweden"],
    "operator": "Destination Gotland"
  },
  {
    "name": "Oskarshamn - Visby",
    "coords": [[57.27, 16.45], [57.64, 18.30]],
    "countries": ["Sweden"],
    "operator": "Destination Gotland"
  },

  // ════════════════════════════════════════════════
  // FRS (Germany-Scandinavia)
  // ════════════════════════════════════════════════
  {
    "name": "Rostock - Gedser",
    "coords": [[54.18, 12.08], [54.58, 11.93]],
    "countries": ["Germany", "Denmark"],
    "operator": "Scandlines"
  },

  // ════════════════════════════════════════════════
  // Irish Ferries
  // ════════════════════════════════════════════════
  {
    "name": "Dublin - Holyhead",
    "coords": [[53.35, -6.26], [53.31, -4.63]],
    "countries": ["Ireland", "United Kingdom"],
    "operator": "Irish Ferries"
  },
  {
    "name": "Dublin - Cherbourg",
    "coords": [[53.35, -6.26], [49.64, -1.62]],
    "countries": ["Ireland", "France"],
    "operator": "Irish Ferries"
  },
  {
    "name": "Rosslare - Pembroke",
    "coords": [[52.25, -6.34], [51.68, -4.92]],
    "countries": ["Ireland", "United Kingdom"],
    "operator": "Irish Ferries"
  },

  // ════════════════════════════════════════════════
  // Acciona Trasmediterránea
  // ════════════════════════════════════════════════
  {
    "name": "Barcelona - Palma",
    "coords": [[41.38, 2.17], [39.57, 2.65]],
    "countries": ["Spain"],
    "operator": "Acciona"
  },
  {
    "name": "Algeciras - Melilla",
    "coords": [[36.13, -5.46], [35.29, -2.94]],
    "countries": ["Spain"],
    "operator": "Balearia"
  },
  {
    "name": "Málaga - Melilla",
    "coords": [[36.72, -4.42], [35.29, -2.94]],
    "countries": ["Spain"],
    "operator": "Trasmediterránea"
  },
  {
    "name": "Motril - Al Hoceima",
    "coords": [[36.72, -3.52], [35.25, -3.94]],
    "countries": ["Spain", "Morocco"],
    "operator": "Balearia"
  },

  // ════════════════════════════════════════════════
  // Black Sea
  // ════════════════════════════════════════════════
  {
    "name": "Constanta - Varna",
    "coords": [[44.17, 28.65], [43.21, 27.91]],
    "countries": ["Romania", "Bulgaria"],
    "operator": "Ukrferry"
  },

  // ════════════════════════════════════════════════
  // Rederi Ab Eckerö
  // ════════════════════════════════════════════════
  {
    "name": "Grisslehamn - Eckerö",
    "coords": [[60.10, 18.82], [60.22, 19.60]],
    "countries": ["Sweden", "Finland"],
    "operator": "Eckerö Line"
  },

  // ════════════════════════════════════════════════
  // Ventouris Ferries (Adriatic)
  // ════════════════════════════════════════════════
  {
    "name": "Brindisi - Corfu - Igoumenitsa - Patras",
    "coords": [[40.64, 17.94], [39.62, 19.92], [39.50, 20.27], [38.25, 21.73]],
    "countries": ["Italy", "Greece"],
    "operator": "Ventouris Ferries"
  },

  // ════════════════════════════════════════════════
  // Rederij Doeksen (Wadden Islands, Netherlands)
  // ════════════════════════════════════════════════
  {
    "name": "Harlingen - Terschelling",
    "coords": [[53.17, 5.42], [53.37, 5.22]],
    "countries": ["Netherlands"],
    "operator": "Rederij Doeksen"
  },
  {
    "name": "Harlingen - Vlieland",
    "coords": [[53.17, 5.42], [53.30, 5.05]],
    "countries": ["Netherlands"],
    "operator": "Rederij Doeksen"
  },

  // ════════════════════════════════════════════════
  // TESO (Texel, Netherlands)
  // ════════════════════════════════════════════════
  {
    "name": "Den Helder - Texel",
    "coords": [[52.96, 4.76], [53.01, 4.79]],
    "countries": ["Netherlands"],
    "operator": "TESO"
  },

  // ════════════════════════════════════════════════
  // WAG (Wadden Sea)
  // ════════════════════════════════════════════════
  {
    "name": "Lauwersoog - Schiermonnikoog",
    "coords": [[53.41, 6.21], [53.48, 6.16]],
    "countries": ["Netherlands"],
    "operator": "Wagenborg"
  },
  {
    "name": "Eemshaven - Borkum",
    "coords": [[53.46, 6.83], [53.59, 6.67]],
    "countries": ["Netherlands", "Germany"],
    "operator": "AG Ems"
  },

  // ════════════════════════════════════════════════
  // Northlink Ferries (Scotland)
  // ════════════════════════════════════════════════
  {
    "name": "Scrabster - Stromness",
    "coords": [[58.61, -3.55], [58.96, -3.30]],
    "countries": ["United Kingdom"],
    "operator": "NorthLink Ferries"
  },
  {
    "name": "Aberdeen - Kirkwall - Lerwick",
    "coords": [[57.14, -2.08], [58.98, -2.96], [60.16, -1.15]],
    "countries": ["United Kingdom"],
    "operator": "NorthLink Ferries"
  },

  // ════════════════════════════════════════════════
  // Caledonian MacBrayne (Scottish islands)
  // ════════════════════════════════════════════════
  {
    "name": "Oban - Mull - Coll - Tiree",
    "coords": [[56.41, -5.47], [56.45, -5.70], [56.63, -6.56], [56.51, -6.89]],
    "countries": ["United Kingdom"],
    "operator": "Caledonian MacBrayne"
  },
  {
    "name": "Ullapool - Stornoway",
    "coords": [[57.90, -5.16], [58.21, -6.39]],
    "countries": ["United Kingdom"],
    "operator": "Caledonian MacBrayne"
  },
  {
    "name": "Ardrossan - Brodick (Arran)",
    "coords": [[55.64, -4.81], [55.58, -5.15]],
    "countries": ["United Kingdom"],
    "operator": "Caledonian MacBrayne"
  }
];

// ── Merge: add routes that don't already exist (checked by name+operator) ──
const existingKeys = new Set(
  existing.routes.map(r => `${r.name}|${r.operator}`)
);

let addedCount = 0;
for (const route of newRoutes) {
  const key = `${route.name}|${route.operator}`;
  if (!existingKeys.has(key)) {
    existing.routes.push(route);
    existingKeys.add(key);
    addedCount++;
  }
}

// De-duplicate routes with same name+operator but different coords (keep first)
const seen = new Set();
const dedupedRoutes = [];
for (const route of existing.routes) {
  const key = `${route.name}|${route.operator}`;
  if (!seen.has(key)) {
    seen.add(key);
    dedupedRoutes.push(route);
  }
}

existing.routes = dedupedRoutes;

// Sort routes by operator, then name
existing.routes.sort((a, b) => {
  if (a.operator !== b.operator) return a.operator.localeCompare(b.operator);
  return a.name.localeCompare(b.name);
});

await writeFile("ferries.json", JSON.stringify(existing, null, 2), "utf8");
console.log(`Added ${addedCount} new ferry routes. Total: ${existing.routes.length} routes.`);
