/**
 * Comprehensive operator harmonization script.
 * 
 * Reads the missing operators report, maps all operators to known operators
 * or creates new entries in data.json for genuinely new operators.
 * Skips limited_use stations (they don't need operator linking).
 * 
 * Usage: node scripts/harmonize-all-operators.mjs
 */

import { readFile, writeFile } from "node:fs/promises";

// ────────────────────────────────────────────────────────────────
// 1. LOAD DATA
// ────────────────────────────────────────────────────────────────
const dataRaw = await readFile("data.json", "utf8");
const stationRaw = await readFile("stations.json", "utf8");
const missingRaw = await readFile("missing-operators-report.json", "utf8");

const operatorDb = JSON.parse(dataRaw);
const stationData = JSON.parse(stationRaw);
const missingReport = JSON.parse(missingRaw);

// ────────────────────────────────────────────────────────────────
// 2. NORMALIZATION
// ────────────────────────────────────────────────────────────────
function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/\b(nv|sa|ag|as|spa|srl|ltd|limited|gmbh|bv|plc|inc|llc|ab|ev|z s|azo|a s|se|co kg|ug|mbh|spa|s p a|s a|oy|akciova spolecnost|as\b)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ────────────────────────────────────────────────────────────────
// 3. COMPREHENSIVE ALIAS MAP
// ────────────────────────────────────────────────────────────────
const MANUAL_ALIASES = {
  // ── National operators (language variants / full names) ──
  "nederlandse spoorwegen": "NS",
  "zwitserse federale spoorwegen": "SBB",
  "magyar allamvasutak": "MÁV",
  "nationale maatschappij der belgische spoorwegen": "NMBS/SNCB",
  "osterreichische bundesbahnen": "ÖBB",
  "danske statsbaner": "DSB",
  "ceske drahy": "České dráhy",
  "cale ferata din moldova": "Calea Ferată din Moldova",
  "chemins de fer luxembourgeois": "CFL",
  "iarnrod eireann": "Irish Rail",
  "cale ferate romane": "CFR Călători",
  "caile ferate romane": "CFR Călători",
  "rhatische bahn": "Rähtische Bahn",
  "rahtische bahn": "Rähtische Bahn",
  "rhB": "Rähtische Bahn",

  // ── DB group variants ──
  "deutsche bahn": "DB",
  "deutsche bahn ag": "DB",
  "db fernverkehr ag": "DB",
  "db fernverkehr": "DB",
  "db regio": "DB",
  "db regio ag": "DB",
  "db regio schleswig holstein": "DB",
  "db netz": "DB",
  "db netz ag": "DB",
  "db station service": "DB",
  "db stationandservice ag": "DB",
  "db stationandservice": "DB",
  "db station service ag": "DB",
  "db infrago ag": "DB",
  "db infrago": "DB",

  // ── NMBS/SNCB variants ──
  "nationale maatschappij der belgische spoorwegen nmbs": "NMBS/SNCB",
  "nmbs": "NMBS/SNCB",
  "sncb": "NMBS/SNCB",
  "nmbs sncb": "NMBS/SNCB",

  // ── SBB variants ──
  "schweizerische bundesbahnen": "SBB",
  "chemins de fer federaux suisses": "SBB",
  "ferrovie federali svizzere": "SBB",
  "sbb cff ffs": "SBB",

  // ── ÖBB variants ──
  "oebb": "ÖBB",
  "oebb infrastruktur ag": "ÖBB",
  "oebb infrastruktur": "ÖBB",

  // ── SNCF variants ──
  "societe nationale des chemins de fer francais": "SNCF",

  // ── PKP variants ──
  "pkp polskie linie kolejowe": "PKP Intercity",
  "polskie koleje panstwowe": "PKP Intercity",
  "polskie linie kolejowe": "PKP Intercity",

  // ── CFR variants ──
  "cfr": "CFR Călători",

  // ── Irish Rail variants ──
  "iarnrod eireann irish rail": "Irish Rail",

  // ── CP variants ──
  "comboios de portugal": "CP",

  // ── ZSSK variants ──
  "zeleznice slovenskej republiky": "ZSSK",
  "zsr": "ZSSK",

  // ── HŽPP variants ──
  "hrvatske zeleznice": "HŽPP",
  "hz infrastruktura": "HŽPP",

  // ── Ferrovienord / FNM ──
  "ferrovienord": "Trenord",

  // ── BDZ variants ──
  "balgarska darzhavna zheleznitsa": "BDZ",
  "balgarski darzhavni zheleznitsi": "BDZ",
  "national railway infrastructure company": "BDZ",
  "bulgarian state railways": "BDZ",

  // ── Öresundståg ──
  "oresundstag": "Öresundståg",
  "oresundstag ab": "Öresundståg",

  // ── GoVolta / European Sleeper ──
  "european sleeper": "European sleeper",

  // ── Caledonian Sleeper ──
  "caledonian sleeper": "Caledonian Sleeper",

  // ── Keolis ──
  "keolis nederland": "Keolis/RRReis",

  // ── Renfe ──
  "renfe operadora": "Renfe",
  "renfe viajeros": "Renfe",
  "administrador de infraestructuras ferroviarias": "Renfe",
  "red nacional de los ferrocarriles espanoles": "Renfe",

  // ── MÁV variants ──
  "mav magyar allamvasutak": "MÁV",
  "mav start": "MÁV",
  "mav infrastructure co ltd": "MÁV",

  // ── FlixTrain ──
  "flixtrain": "FlixTrain",
  "flix train": "FlixTrain",

  // ── Trenitalia variants ──
  "trenitalia spa": "Trenitalia",
  "ferrovie dello stato italiane": "Trenitalia",
  "rete ferroviaria italiana": "Trenitalia",
  "rfi": "Trenitalia",
  "fondazione fs italiane": "Trenitalia",
  "centostazioni": "Trenitalia",
  "nuovo trasporto viaggiatori": "Italo",

  // ── Hellenic Train ──
  "trainose": "Hellenic Train",
  "hellenic train": "Hellenic Train",

  // ── LTG Link ──
  "ltg link": "LTG Link",
  "ltglink": "LTG Link",

  // ── Vivi ──
  "pasażieru vilciens": "Vivi",

  // ── Westbahn ──
  "westbahn gmbh": "Westbahn",
  "westbahn management gmbh": "Westbahn",

  // ── Arriva ──
  "arriva nederland": "Arriva",
  "arriva personenvervoer nederland": "Arriva",

  // ── Eurostar ──
  "eurostar international": "Eurostar",

  // ── Qbuzz ──
  "qbuzz nederland": "Qbuzz",

  // ── UK operators ──
  "scotrail": "ScotRail",
  "scotrail abellio": "ScotRail",
  "abellio scotrail": "ScotRail",
  "glasgow": "ScotRail",
  "london midland": "West Midlands Trains",
  "east midlands trains": "East Midlands Railway",
  "arriva trains wales": "Transport for Wales",
  "arriva rail north": "Northern",
  "northern rail": "Northern",
  "northern trains": "Northern",
  "southern railway": "GTR",
  "gatwick express": "GTR",
  "thameslink": "GTR",
  "great northern": "GTR",
  "new southern railway": "GTR",
  "merseyrail": "National Rail",
  "first trans pennine express": "TransPennine Express",
  "first great western": "Great Western Railway",
  "c2c": "National Rail",
  "london overground": "National Rail",
  "tfl rail": "National Rail",
  "elizabeth line": "National Rail",
  "west midlands trains": "West Midlands Trains",
  "west midlands railway": "West Midlands Trains",
  "london northwestern": "West Midlands Trains",
  "ni railways": "NI Railways",
  "northern ireland railways": "NI Railways",
  "translink": "NI Railways",
  "transport for wales": "Transport for Wales",
  "transport for wales rail": "Transport for Wales",
  "keolisamey wales": "Transport for Wales",
  "virgin trains": "Avanti West Coast",
  "transport for london": "National Rail",
  "island line trains": "South Western Railway",
  "network rail": "Network Rail",
  "network rail infrastructure ltd": "Network Rail",

  // ── Adif ──
  "adif": "Renfe",

  // ── Infraestruturas de Portugal ──
  "infraestruturas de portugal": "CP",

  // ── Správa železnic ──
  "sprava zeleznic": "České dráhy",
  "cz szdc": "České dráhy",
  "sprava zeleznicni dopravni cesty": "České dráhy",

  // ── Slovenian Railways variants ──
  "slovenske zeleznice": "Slovenian Railways",

  // ── Finnish Railways ──
  "finnish transport infrastructure agency": "VR",
  "vaylavirasto": "VR",

  // ── Albanian Railways ──
  "hekurudha shqiptare": "hsh (Albanian Railways)",

  // ── Serbian Railways variants ──
  "serbian railways infrastructure": "Srbija Voz",
  "serbian railways": "Srbija Voz",
  "srbijavoz": "Srbija Voz",

  // ── Kosovo Railways ──
  "kosovo railways": "Trainkos",

  // ── Latvian Railways ──
  "latvian railways": "Vivi",

  // ── Lithuanian Railways ──
  "lietuvos gelezinkeliai": "LTG Link",
  "ltg infra": "LTG Link",

  // ── Ukraine ──
  "ukrzaliznytsia": "Ukrzaliznytsia",
  "oekraiense spoorwegen": "Ukrzaliznytsia",
  "ukrainian railway": "Ukrzaliznytsia",
  "ukrainian railways": "Ukrzaliznytsia",
  "cisdnieper railways": "Ukrzaliznytsia",

  // ── Moldova ──
  "calea ferata din moldova": "Calea Ferată din Moldova",

  // ── Estonia ──
  "elektriraudtee": "Elron",

  // ── Germany: DB subsidiaries → DB ──
  "sudostbayernbahn": "DB",
  "südostbayernbahn": "DB",
  "westfrankenbahn": "DB",
  "kurhessenbahn": "DB",
  "erixx": "DB",

  // ── Norway infrastructure ──
  "bane nor": "Vy",

  // ── Sweden infrastructure ──
  "swedish transport administration": "SJ",

  // ── Switzerland: Various operators that are already in data.json ──
  "regie autonome des transports parisiens": "RATP",
  "ratp": "RATP",
  "chemins de fer de la corse": "Chemins de Fer de la Corse",
  "cfc": "Chemins de Fer de la Corse",
  "lokaltog": "Lokaltog",
  "raaberbahn": "Raaberbahn",
  "raaberbahn ag": "Raaberbahn",
  "gysev": "Raaberbahn",
  "ferrovie del sud est": "Ferrovie del Sud Est",
  "fse": "Ferrovie del Sud Est",
  "albtal verkehrs gesellschaft": "Albtal-Verkehrs-Gesellschaft mbH",
  "avag": "Albtal-Verkehrs-Gesellschaft mbH",
  "transports publics du chablais": "Transports Publics du Chablais",
  "tpc": "Transports Publics du Chablais",
  "appenzeller bahnen": "Appenzeller Bahnen",
  "appenzellerbahn": "Appenzeller Bahnen",
  "ab": "Appenzeller Bahnen",
  "montreux berner oberland bahn": "Montreux-Berner Oberland-Bahn",
  "mob": "Montreux-Berner Oberland-Bahn",
  "compagnia trasporti laziali": "Compagnia Trasporti Laziali",
  "ctl": "Compagnia Trasporti Laziali",
  "cotral": "Compagnia Trasporti Laziali",
  "aare seeland mobil": "Aare Seeland mobil",
  "asm": "Aare Seeland mobil",
  "chemins de fer du jura": "Chemins de fer du Jura",
  "cj": "Chemins de fer du Jura",
  "schweizerische sudostbahn": "Schweizerische Südostbahn",
  "sob": "Schweizerische Südostbahn",
  "nordjyske jernbaner": "Nordjyske Jernbaner",
  "nj": "Nordjyske Jernbaner",
  "euskotren trena": "Euskotren",
  "euskotren": "Euskotren",
  "crimea railway": "Crimea Railway",
  "zeleznice republike srpske": "Željeznice Republike Srpske",
  "zrs": "Željeznice Republike Srpske",
  "zfbh": "ŽFBiH",
  "zpcg": "ŽPCG",

  // ── Italy: Trenitalia infrastructure aliases ──
  "ferrovienord": "Trenord",
  "societa unica abruzzese di trasporto": "Trenitalia",
  "treni regionali ticino lombardia": "TILO",

  // ── Spain: Renfe infrastructure/regional ──
  "euskotrenbideak ferrocarriles vascos": "Euskotren",
  "eusko trenbideak ferrocarriles vascos": "Euskotren",
  "ferrocarrils de la generalitat de catalunya": "Renfe",
  "metro van valencia": "Renfe",
  "ferrocarrils de la generalitat valenciana": "Renfe",
};

// ────────────────────────────────────────────────────────────────
// 4. NEW OPERATORS TO ADD
// These are genuinely new operators that don't exist in data.json
// ────────────────────────────────────────────────────────────────
const newOperators = [
  // ── Switzerland ──
  {
    id: "rbs",
    name: "Regionalverkehr Bern-Solothurn",
    country: "Switzerland",
    countries: ["Switzerland"],
    type: "trains",
    website: "https://www.rbs.ch",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional transport operator in the Bern-Solothurn area, running S-Bahn and regional services.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "tpf",
    name: "Transports publics Fribourgeois",
    country: "Switzerland",
    countries: ["Switzerland"],
    type: "trains",
    website: "https://www.tpf.ch",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Public transport operator in the canton of Fribourg, running regional rail and bus services.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "sihltal_bahn",
    name: "Sihltal Zürich Uetliberg Bahn (SZU)",
    country: "Switzerland",
    countries: ["Switzerland"],
    type: "trains",
    website: "https://www.szu.ch",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional railway operator serving the Sihltal and Uetliberg lines in the Zurich area.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "travys",
    name: "TRAVYS",
    country: "Switzerland",
    countries: ["Switzerland"],
    type: "trains",
    website: "https://www.travys.ch",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional transport operator in the Vallée de Joux and Yverdon-les-Bains area.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "transn",
    name: "Transports Publics Neuchâtelois (transN)",
    country: "Switzerland",
    countries: ["Switzerland"],
    type: "trains",
    website: "https://www.transn.ch",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Public transport operator in the canton of Neuchâtel, running regional rail and bus services.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "morges_biere",
    name: "Transports de la région Morges-Bière-Cossonay (MBC)",
    country: "Switzerland",
    countries: ["Switzerland"],
    type: "trains",
    website: "https://www.mbc.ch",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional transport operator in the Morges-Bière-Cossonay area of Vaud canton.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "bdwm",
    name: "BDWM Transport (Aargau Verkehr)",
    country: "Switzerland",
    countries: ["Switzerland"],
    type: "trains",
    website: "https://www.aargauverkehr.ch",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional transport operator in Aargau, operating the Bremgarten-Dietikon and Wohlen-Meisterschwanden lines.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "forchbahn",
    name: "Forchbahn",
    country: "Switzerland",
    countries: ["Switzerland"],
    type: "trains",
    website: "https://www.forchbahn.ch",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional light rail line connecting Zurich with Forch and Esslingen.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "frauenfeld_wil",
    name: "Frauenfeld-Wil-Bahn",
    country: "Switzerland",
    countries: ["Switzerland"],
    type: "trains",
    website: "https://www.fw-bahn.ch",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Narrow-gauge railway connecting Frauenfeld with Wil in canton Thurgau.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "tpc_vevey",
    name: "Transports Publics du Chablais (Vevey−Chamby)",
    country: "Switzerland",
    countries: ["Switzerland"],
    type: "trains",
    website: "https://www.tpc.ch",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional transport operator in the Chablais region, including the Vevey–Blonay–Les Pléiades line.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "ferrovie_luganesi",
    name: "Ferrovie Luganesi (FLP)",
    country: "Switzerland",
    countries: ["Switzerland"],
    type: "trains",
    website: "https://www.flpsa.ch",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional railway operator in the Lugano area, running the Lugano-Ponte Tresa line.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "baselland_transport",
    name: "Baselland Transport (BLT)",
    country: "Switzerland",
    countries: ["Switzerland"],
    type: "trains",
    website: "https://www.blt.ch",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional transport operator in Basel-Landschaft, running light rail and bus services.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "rigi_bahnen",
    name: "Rigi Bahnen",
    country: "Switzerland",
    countries: ["Switzerland"],
    type: "trains",
    website: "https://www.rigi.ch",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Mountain railway operator on Mount Rigi, running Europe's oldest mountain railway.",
    operatorLabel: "Scenic train operator"
  },
  {
    id: "jungfraubahn",
    name: "Jungfraubahn",
    country: "Switzerland",
    countries: ["Switzerland"],
    type: "trains",
    website: "https://www.jungfrau.ch",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Operator of railways in the Jungfrau region, including the famous Jungfrau Railway to Jungfraujoch.",
    operatorLabel: "Scenic train operator"
  },
  {
    id: "berner_oberland",
    name: "Berner Oberland-Bahnen (BOB)",
    country: "Switzerland",
    countries: ["Switzerland"],
    type: "trains",
    website: "https://www.jungfrau.ch",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Mountain railway operator in the Bernese Oberland, connecting Interlaken with Lauterbrunnen and Grindelwald.",
    operatorLabel: "Scenic train operator"
  },
  {
    id: "emmentalbahn",
    name: "Emmentalbahn (ETB)",
    country: "Switzerland",
    countries: ["Switzerland"],
    type: "trains",
    website: "https://www.etb-smb.ch",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional railway in the Emmental valley, running the Hasle-Rüegsau–Huttwil line.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "fart",
    name: "Ferrovie Autolinee Regionali Ticinesi (FART)",
    country: "Switzerland",
    countries: ["Switzerland", "Italy"],
    type: "trains",
    website: "https://www.centovalli.ch",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional transport operator in Ticino, running the scenic Centovalli railway between Locarno and Domodossola.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "wynental_suhrental",
    name: "Wynental- und Suhrentalbahn (WSB)",
    country: "Switzerland",
    countries: ["Switzerland"],
    type: "trains",
    website: "https://www.aargauverkehr.ch",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional railway in Aargau, running the Aarau–Menziken and Aarau–Schöftland lines (now part of Aargau Verkehr).",
    operatorLabel: "Regional train operator"
  },
  {
    id: "leb",
    name: "Chemin de fer Lausanne-Échallens-Bercher (LEB)",
    country: "Switzerland",
    countries: ["Switzerland"],
    type: "trains",
    website: "https://www.leb.ch",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional railway linking Lausanne with Échallens and Bercher in Vaud canton.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "nstcm",
    name: "Chemin de fer Nyon-St-Cergue-Morez (NStCM)",
    country: "Switzerland",
    countries: ["Switzerland"],
    type: "trains",
    website: "https://www.nstcm.ch",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional railway running from Nyon on Lake Geneva to the Jura mountains.",
    operatorLabel: "Regional train operator"
  },

  // ── Germany ──
  {
    id: "evb",
    name: "Eisenbahnen und Verkehrsbetriebe Elbe-Weser (EVB)",
    country: "Germany",
    countries: ["Germany"],
    type: "trains",
    website: "https://www.evb-elbe-weser.de",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional railway operator in Lower Saxony, connecting Bremerhaven, Bremervörde and Hamburg.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "metronom",
    name: "metronom Eisenbahngesellschaft",
    country: "Germany",
    countries: ["Germany"],
    type: "trains",
    website: "https://www.der-metronom.de",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional train operator in northern Germany, running services between Hamburg, Bremen and Lüneburg.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "harzer_schmalspurbahnen",
    name: "Harzer Schmalspurbahnen (HSB)",
    country: "Germany",
    countries: ["Germany"],
    type: "trains",
    website: "https://www.hsb-wr.de",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Narrow-gauge steam railway network in the Harz mountains, Germany's largest narrow-gauge railway.",
    operatorLabel: "Heritage train operator"
  },
  {
    id: "akn_eisenbahn",
    name: "AKN Eisenbahn",
    country: "Germany",
    countries: ["Germany"],
    type: "trains",
    website: "https://www.akn.de",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional railway operator in Schleswig-Holstein, connecting Hamburg with northern suburbs.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "usedomer_baderbahn",
    name: "Usedomer Bäderbahn (UBB)",
    country: "Germany",
    countries: ["Germany"],
    type: "trains",
    website: "https://www.ubb-online.com",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional railway operator on the island of Usedom, connecting seaside resorts with the mainland.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "bleckeder_kleinbahn",
    name: "Bleckeder Kleinbahn",
    country: "Germany",
    countries: ["Germany"],
    type: "trains",
    website: "",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Small regional railway connecting Lüneburg with Bleckede in Lower Saxony.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "kvg",
    name: "Kahlgrund-Verkehrs-Gesellschaft (KVG)",
    country: "Germany",
    countries: ["Germany"],
    type: "trains",
    website: "https://www.kvg-mobil.de",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional railway operator in the Kahlgrund area of Bavaria.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "regio_infra",
    name: "Regio Infra Nord-Ost",
    country: "Germany",
    countries: ["Germany"],
    type: "trains",
    website: "https://www.regioinfra.de",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional railway operator in Mecklenburg-Vorpommern and Brandenburg.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "saxon_steam",
    name: "Saxon Steam Railway (SDG)",
    country: "Germany",
    countries: ["Germany"],
    type: "trains",
    website: "https://www.sdg-bahn.de",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Operator of several narrow-gauge steam railways in Saxony, including the Fichtelbergbahn and Lößnitzgrundbahn.",
    operatorLabel: "Heritage train operator"
  },
  {
    id: "sweg",
    name: "SWEG Südwestdeutsche Landesverkehrs-GmbH",
    country: "Germany",
    countries: ["Germany"],
    type: "trains",
    website: "https://www.sweg.de",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional transport operator in southwest Germany (Baden-Württemberg), running rail and bus services.",
    operatorLabel: "Regional train operator"
  },

  // ── Italy ──
  {
    id: "ferrovie_calabria",
    name: "Ferrovie della Calabria",
    country: "Italy",
    countries: ["Italy"],
    type: "trains",
    website: "https://www.ferroviedellacalabria.it",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional railway operator in Calabria, southern Italy.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "ferrovie_appulo_lucane",
    name: "Ferrovie Appulo Lucane (FAL)",
    country: "Italy",
    countries: ["Italy"],
    type: "trains",
    website: "https://www.ferrovieappulolucane.it",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional railway operator connecting Apulia (Puglia) and Basilicata regions in southern Italy.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "ferrovie_emilia_romagna",
    name: "Ferrovie Emilia Romagna (FER)",
    country: "Italy",
    countries: ["Italy"],
    type: "trains",
    website: "https://www.fer.it",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional railway operator in the Emilia-Romagna region, now part of TPER.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "ente_autonomo_volturno",
    name: "Ente Autonomo Volturno (EAV)",
    country: "Italy",
    countries: ["Italy"],
    type: "trains",
    website: "https://www.eavsrl.it",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional transport operator in Campania, running rail, metro and funicular services around Naples.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "ferrovie_gargano",
    name: "Ferrovie del Gargano",
    country: "Italy",
    countries: ["Italy"],
    type: "trains",
    website: "https://www.ferroviedelgargano.com",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional railway operator on the Gargano peninsula in Apulia (Puglia).",
    operatorLabel: "Regional train operator"
  },
  {
    id: "ferrotramviaria",
    name: "Ferrotramviaria",
    country: "Italy",
    countries: ["Italy"],
    type: "trains",
    website: "https://www.ferrovienordbarese.it",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional railway operator in Apulia, running the Bari–Barletta line and Bari airport link.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "ferrovia_circumetnea",
    name: "Ferrovia Circumetnea",
    country: "Italy",
    countries: ["Italy"],
    type: "trains",
    website: "https://www.circumetnea.it",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Narrow-gauge railway circling Mount Etna in Sicily, connecting Catania with Riposto.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "ferrovia_suzzara_ferrara",
    name: "Ferrovia Suzzara-Ferrara (FSF)",
    country: "Italy",
    countries: ["Italy"],
    type: "trains",
    website: "",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional railway line connecting Suzzara with Ferrara in the Po Valley (now part of FER/TPER).",
    operatorLabel: "Regional train operator"
  },
  {
    id: "sistemi_territoriali",
    name: "Sistemi Territoriali",
    country: "Italy",
    countries: ["Italy"],
    type: "trains",
    website: "https://www.sistemiterritorialispa.it",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional railway operator in Veneto, running the Adria–Mestre and other regional lines.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "trasporto_ferroviario_toscano",
    name: "Trasporto Ferroviario Toscano (TFT)",
    country: "Italy",
    countries: ["Italy"],
    type: "trains",
    website: "https://www.trasportoferroviariotoscano.it",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional railway operator in Tuscany, running the Arezzo–Stia and Arezzo–Sinalunga lines.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "gruppo_torinese_trasporti",
    name: "Gruppo Torinese Trasporti (GTT)",
    country: "Italy",
    countries: ["Italy"],
    type: "trains",
    website: "https://www.gtt.to.it",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Public transport operator in Turin, running the Turin–Ceres railway and local metro/light rail services.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "sad_nahverkehr",
    name: "SAD Nahverkehr",
    country: "Italy",
    countries: ["Italy"],
    type: "trains",
    website: "https://www.sad.it",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional transport operator in South Tyrol/Alto Adige, running rail and bus services including the Bolzano–Merano line.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "arenaways",
    name: "Arenaways",
    country: "Italy",
    countries: ["Italy"],
    type: "trains",
    website: "https://www.arenaways.it",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Private Italian railway operator running regional services in Piedmont.",
    operatorLabel: "Private train operator"
  },
  {
    id: "amt_genova",
    name: "AMT Genova",
    country: "Italy",
    countries: ["Italy"],
    type: "trains",
    website: "https://www.amt.genova.it",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Public transport operator in Genoa, running the Genova–Casella railway and local transport.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "minimetro",
    name: "Minimetrò Perugia",
    country: "Italy",
    countries: ["Italy"],
    type: "trains",
    website: "https://www.minimetrospa.it",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Automated people mover system in Perugia.",
    operatorLabel: "Urban transit operator"
  },
  {
    id: "arst",
    name: "ARST Sardegna",
    country: "Italy",
    countries: ["Italy"],
    type: "trains",
    website: "https://www.arstspa.info",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional transport operator in Sardinia, running narrow-gauge railways, light rail, and bus services.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "astral",
    name: "ASTRAL (Roma Nord)",
    country: "Italy",
    countries: ["Italy"],
    type: "trains",
    website: "https://www.astralspa.it",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Operator of the Roma–Civita Castellana–Viterbo railway (Roma Nord) in Lazio.",
    operatorLabel: "Regional train operator"
  },

  // ── Austria ──
  {
    id: "novog",
    name: "NÖVOG (Niederösterreichische Verkehrsorganisationsgesellschaft)",
    country: "Austria",
    countries: ["Austria"],
    type: "trains",
    website: "https://www.noevog.at",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional transport operator in Lower Austria, running several narrow-gauge and regional railways.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "zillertalbahn",
    name: "Zillertalbahn",
    country: "Austria",
    countries: ["Austria"],
    type: "trains",
    website: "https://www.zillertalbahn.at",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Narrow-gauge railway in the Zillertal valley in Tyrol, connecting Jenbach with Mayrhofen.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "stlb",
    name: "Steiermärkische Landesbahnen (StLB)",
    country: "Austria",
    countries: ["Austria"],
    type: "trains",
    website: "https://www.stlb.at",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional railway operator in Styria, running several narrow-gauge lines including the Murtalbahn.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "stern_haftel",
    name: "Stern & Hafferl",
    country: "Austria",
    countries: ["Austria"],
    type: "trains",
    website: "https://www.stern-verkehr.at",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Private transport company in Upper Austria, running several local railways and tram lines.",
    operatorLabel: "Regional train operator"
  },

  // ── Denmark ──
  {
    id: "midtjyske_jernbaner",
    name: "Midtjyske Jernbaner",
    country: "Denmark",
    countries: ["Denmark"],
    type: "trains",
    website: "https://www.mjba.dk",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Regional railway operator in Central Jutland, Denmark.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "gocollective",
    name: "GoCollective",
    country: "Denmark",
    countries: ["Denmark"],
    type: "trains",
    website: "https://www.gocollective.dk",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Danish regional railway operator (formerly Arriva Denmark), running services in Jutland.",
    operatorLabel: "Regional train operator"
  },

  // ── Poland ──
  {
    id: "warszawska_kolej_dojazdowa",
    name: "Warszawska Kolej Dojazdowa (WKD)",
    country: "Poland",
    countries: ["Poland"],
    type: "trains",
    website: "https://www.wkd.com.pl",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Suburban railway operator in Warsaw, connecting the city centre with western suburbs.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "szybka_kolej_miejska",
    name: "Szybka Kolej Miejska (SKM)",
    country: "Poland",
    countries: ["Poland"],
    type: "trains",
    website: "https://www.skm.pkp.pl",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Rapid urban railway in the Tricity area (Gdańsk, Sopot, Gdynia) in Poland.",
    operatorLabel: "Regional train operator"
  },

  // ── Romania ──
  {
    id: "regiotrans",
    name: "Regiotrans",
    country: "Romania",
    countries: ["Romania"],
    type: "trains",
    website: "",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Private regional railway operator in Romania.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "transferoviar_calatori",
    name: "Transferoviar Călători",
    country: "Romania",
    countries: ["Romania"],
    type: "trains",
    website: "https://www.transferoviar.ro",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Private passenger rail operator in Romania, running regional services.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "rc_cf_trans",
    name: "RC-CF Trans",
    country: "Romania",
    countries: ["Romania"],
    type: "trains",
    website: "",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Private railway operator in Romania, running regional passenger and freight services.",
    operatorLabel: "Regional train operator"
  },
  {
    id: "transferoviar_infrastructura",
    name: "Transferoviar Infrastructura",
    country: "Romania",
    countries: ["Romania"],
    type: "trains",
    website: "https://www.transferoviar.ro",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Railway infrastructure manager for non-interoperable lines in Romania.",
    operatorLabel: "Infrastructure manager"
  },

  // ── UK ──
  {
    id: "scotrail",
    name: "ScotRail",
    country: "United Kingdom",
    countries: ["United Kingdom"],
    type: "trains",
    website: "https://www.scotrail.co.uk",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Scotland's primary train operator, running regional, commuter and intercity services. Book through National Rail retailers or directly with ScotRail.",
    operatorLabel: "Scottish train operator"
  },
  {
    id: "west_somerset_railway",
    name: "West Somerset Railway",
    country: "United Kingdom",
    countries: ["United Kingdom"],
    type: "trains",
    website: "https://www.west-somerset-railway.co.uk",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Heritage railway in Somerset, England, the longest standard gauge heritage line in the UK.",
    operatorLabel: "Heritage train operator"
  },
  {
    id: "ffestiniog_railway",
    name: "Ffestiniog Railway",
    country: "United Kingdom",
    countries: ["United Kingdom"],
    type: "trains",
    website: "https://www.festrail.co.uk",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Historic narrow-gauge railway in Snowdonia, Wales, running from Porthmadog to Blaenau Ffestiniog.",
    operatorLabel: "Heritage train operator"
  },
  {
    id: "severn_valley_railway",
    name: "Severn Valley Railway",
    country: "United Kingdom",
    countries: ["United Kingdom"],
    type: "trains",
    website: "https://www.svr.co.uk",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Heritage railway in Shropshire and Worcestershire, running between Bridgnorth and Kidderminster.",
    operatorLabel: "Heritage train operator"
  },
  {
    id: "east_lancashire_railway",
    name: "East Lancashire Railway",
    country: "United Kingdom",
    countries: ["United Kingdom"],
    type: "trains",
    website: "https://www.eastlancsrailway.org.uk",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Heritage railway in Lancashire, running between Heywood and Rawtenstall.",
    operatorLabel: "Heritage train operator"
  },
  {
    id: "ravenglass_eskdale",
    name: "Ravenglass & Eskdale Railway",
    country: "United Kingdom",
    countries: ["United Kingdom"],
    type: "trains",
    website: "https://ravenglass-railway.co.uk",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Narrow-gauge heritage railway in the Lake District, known as 'La'al Ratty'.",
    operatorLabel: "Heritage train operator"
  },

  // ── Czechia ──
  {
    id: "pkp_cargo_international",
    name: "PKP Cargo International",
    country: "Czechia",
    countries: ["Czechia", "Poland"],
    type: "trains",
    website: "https://www.pkpcargointernational.eu",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Rail freight operator, subsidiary of PKP Cargo, operating in Czechia and Central Europe.",
    operatorLabel: "Freight train operator"
  },

  // ── France ──
  {
    id: "compagnie_mont_blanc",
    name: "Compagnie du Mont-Blanc",
    country: "France",
    countries: ["France"],
    type: "trains",
    website: "https://www.montblancnaturalresort.com",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Operator of the Montenvers Railway and Tramway du Mont-Blanc in Chamonix, France.",
    operatorLabel: "Scenic train operator"
  },
  {
    id: "chemin_fer_chanteraines",
    name: "Chemin de Fer des Chanteraines",
    country: "France",
    countries: ["France"],
    type: "trains",
    website: "https://www.cfchanteraines.fr",
    appLinks: { android: "", ios: "" },
    logo: "",
    description: "Heritage narrow-gauge railway in the Parc des Chanteraines, near Paris.",
    operatorLabel: "Heritage train operator"
  },
];

// ────────────────────────────────────────────────────────────────
// 5. ADD ALIASES FOR NEW OPERATORS
// ────────────────────────────────────────────────────────────────

// Map of missing report names → new operator entry names
const newOperatorAliases = {
  // Switzerland
  "regionalverkehr bern solothurn": "Regionalverkehr Bern-Solothurn",
  "transports publics fribourgeois": "Transports publics Fribourgeois",
  "sihltal zurich uetliberg bahn": "Sihltal Zürich Uetliberg Bahn (SZU)",
  "sihltal zurich uetliberg bahn szu": "Sihltal Zürich Uetliberg Bahn (SZU)",
  "travys": "TRAVYS",
  "transports publics neuchatelois": "Transports Publics Neuchâtelois (transN)",
  "transports publics neuchatelois transn": "Transports Publics Neuchâtelois (transN)",
  "transports de la region morges biere cossonay": "Transports de la région Morges-Bière-Cossonay (MBC)",
  "transports de la region morges biere cossonay mbc": "Transports de la région Morges-Bière-Cossonay (MBC)",
  "bdwm transport": "BDWM Transport (Aargau Verkehr)",
  "forchbahn ag": "Forchbahn",
  "forchbahn": "Forchbahn",
  "frauenfeld wil bahn": "Frauenfeld-Wil-Bahn",
  "frauenfeld wil bahn ag": "Frauenfeld-Wil-Bahn",
  "spoorlijn vevey chamby": "Transports Publics du Chablais (Vevey−Chamby)",
  "ferrovie luganesi": "Ferrovie Luganesi (FLP)",
  "ferrovie luganesi flp": "Ferrovie Luganesi (FLP)",
  "baselland transport": "Baselland Transport (BLT)",
  "baselland transport blt": "Baselland Transport (BLT)",
  "rigi bahnen": "Rigi Bahnen",
  "rigi bahnen ag": "Rigi Bahnen",
  "jungfraubahn holding": "Jungfraubahn",
  "jungfraubahn": "Jungfraubahn",
  "berner oberland bahnen": "Berner Oberland-Bahnen (BOB)",
  "berner oberland bahnen ag": "Berner Oberland-Bahnen (BOB)",
  "berner oberland bahnen bob": "Berner Oberland-Bahnen (BOB)",
  "emmentalbahn": "Emmentalbahn (ETB)",
  "emmentalbahn etb": "Emmentalbahn (ETB)",
  "regional bus and rail company of canton ticino": "Ferrovie Autolinee Regionali Ticinesi (FART)",
  "wynental en suhrentalbahn": "Wynental- und Suhrentalbahn (WSB)",
  "wynental und suhrentalbahn wsb": "Wynental- und Suhrentalbahn (WSB)",
  "spoorlijn lausanne bercher": "Chemin de fer Lausanne-Échallens-Bercher (LEB)",
  "spoorlijn nyon morez": "Chemin de fer Nyon-St-Cergue-Morez (NStCM)",
  "transports de martigny et regions": "Transports de Martigny et Régions",

  // Germany
  "eisenbahnen und verkehrsbetriebe elbe weser": "Eisenbahnen und Verkehrsbetriebe Elbe-Weser (EVB)",
  "eisenbahnen und verkehrsbetriebe elbe weser evb": "Eisenbahnen und Verkehrsbetriebe Elbe-Weser (EVB)",
  "metronom eisenbahngesellschaft": "metronom Eisenbahngesellschaft",
  "harzer schmalspurbahnen": "Harzer Schmalspurbahnen (HSB)",
  "harzer schmalspurbahnen hsb": "Harzer Schmalspurbahnen (HSB)",
  "akn eisenbahn": "AKN Eisenbahn",
  "usedomer baderbahn": "Usedomer Bäderbahn (UBB)",
  "usedomer baderbahn ubb": "Usedomer Bäderbahn (UBB)",
  "bleckeder kleinbahn ug": "Bleckeder Kleinbahn",
  "bleckeder kleinbahn": "Bleckeder Kleinbahn",
  "kahlgrund verkehrs gesellschaft mbh": "Kahlgrund-Verkehrs-Gesellschaft (KVG)",
  "kahlgrund verkehrs gesellschaft kvg": "Kahlgrund-Verkehrs-Gesellschaft (KVG)",
  "regio infra nord ost": "Regio Infra Nord-Ost",
  "saxon steam railway company": "Saxon Steam Railway (SDG)",
  "saxon steam railway sdg": "Saxon Steam Railway (SDG)",
  "sweg schienenwege": "SWEG Südwestdeutsche Landesverkehrs-GmbH",
  "sweg schienenwege gmbh": "SWEG Südwestdeutsche Landesverkehrs-GmbH",
  "sweg sudwestdeutsche landesverkehrs": "SWEG Südwestdeutsche Landesverkehrs-GmbH",

  // Italy
  "ferrovie della calabria": "Ferrovie della Calabria",
  "ferrovie appulo lucane": "Ferrovie Appulo Lucane (FAL)",
  "ferrovie appulo lucane fal": "Ferrovie Appulo Lucane (FAL)",
  "ferrovie emilia romagna": "Ferrovie Emilia Romagna (FER)",
  "ferrovie emilia romagna fer": "Ferrovie Emilia Romagna (FER)",
  "ente autonomo volturno": "Ente Autonomo Volturno (EAV)",
  "ente autonomo volturno eav": "Ente Autonomo Volturno (EAV)",
  "eav": "Ente Autonomo Volturno (EAV)",
  "ferrovie del gargano": "Ferrovie del Gargano",
  "ferrotramviaria": "Ferrotramviaria",
  "ferrovia circumetnea": "Ferrovia Circumetnea",
  "ferrovia suzzara ferrara": "Ferrovia Suzzara-Ferrara (FSF)",
  "ferrovia suzzara ferrara fsf": "Ferrovia Suzzara-Ferrara (FSF)",
  "sistemi territoriali": "Sistemi Territoriali",
  "trasporto ferroviario toscano": "Trasporto Ferroviario Toscano (TFT)",
  "trasporto ferroviario toscano tft": "Trasporto Ferroviario Toscano (TFT)",
  "gruppo torinese trasporti": "Gruppo Torinese Trasporti (GTT)",
  "gruppo torinese trasporti gtt": "Gruppo Torinese Trasporti (GTT)",
  "sad nahverkehr": "SAD Nahverkehr",
  "arenaways": "Arenaways",
  "amt genova": "AMT Genova",
  "anm": "Ente Autonomo Volturno (EAV)",
  "minimetro": "Minimetrò Perugia",
  "societa unica abruzzese di trasporto": "Trenitalia",
  "amt": "AMT Genova",
  "societe regionale de transport sarde": "ARST Sardegna",
  "astral": "ASTRAL (Roma Nord)",

  // Austria
  "novog": "NÖVOG (Niederösterreichische Verkehrsorganisationsgesellschaft)",
  "zillertaler verkehrsbetriebe": "Zillertalbahn",
  "stb": "Steiermärkische Landesbahnen (StLB)",
  "stlb": "Steiermärkische Landesbahnen (StLB)",
  "sth": "Stern & Hafferl",
  "trn": "Transports Publics Neuchâtelois (transN)",

  // Denmark
  "midtjyske jernbaner": "Midtjyske Jernbaner",
  "gocollective": "GoCollective",
  "gocollective a s": "GoCollective",

  // Poland
  "warszawska kolej dojazdowa": "Warszawska Kolej Dojazdowa (WKD)",
  "warszawska kolej dojazdowa wkd": "Warszawska Kolej Dojazdowa (WKD)",
  "szybka kolej miejska": "Szybka Kolej Miejska (SKM)",
  "szybka kolej miejska skm": "Szybka Kolej Miejska (SKM)",

  // Romania
  "regiotrans": "Regiotrans",
  "transferoviar calatori": "Transferoviar Călători",
  "rc cf trans": "RC-CF Trans",
  "rc cf trans": "RC-CF Trans",
  "transferoviar infrastructura neinteroperabila": "Transferoviar Infrastructura",

  // UK
  "west somerset railway": "West Somerset Railway",
  "west somerset railway plc": "West Somerset Railway",
  "ffestiniog railway": "Ffestiniog Railway",
  "severn valley railway": "Severn Valley Railway",
  "east lancashire railway": "East Lancashire Railway",
  "ravenglass and eskdale railway": "Ravenglass & Eskdale Railway",
  "ravenglass eskdale railway": "Ravenglass & Eskdale Railway",

  // UK historical → modern
  "dumbarton and helensburgh railway": "ScotRail",
  "paisley and greenock railway": "ScotRail",
  "scottish north eastern railway": "ScotRail",
  "dundee and arbroath railway": "ScotRail",
  "callander and oban railway": "ScotRail",
  "mallaig extension railway": "ScotRail",
  "sutherland and caithness railway": "ScotRail",
  "dingwall and skye railway": "ScotRail",
  "kilmarnock and ayr railway": "ScotRail",
  "dumfries and carlisle railway": "ScotRail",
  "paisley": "ScotRail",

  // Czechia
  "pkp cargo international": "PKP Cargo International",

  // France
  "compagnie du mont blanc": "Compagnie du Mont-Blanc",
  "chemin de fer des chanteraines": "Chemin de Fer des Chanteraines",

  // Bulgaria historical → modern
  "compagnie des chemins de fer orientaux": "BDZ",
};

// ────────────────────────────────────────────────────────────────
// 6. BUILD COMPLETE ALIAS MAP
// ────────────────────────────────────────────────────────────────
const knownOperators = new Map();

// Add manual aliases
for (const [norm, canonical] of Object.entries(MANUAL_ALIASES)) {
  knownOperators.set(normalizeName(norm), canonical);
}

// Add new operator aliases
for (const [norm, canonical] of Object.entries(newOperatorAliases)) {
  knownOperators.set(normalizeName(norm), canonical);
}

// Add existing operators from data.json
for (const op of operatorDb.operators || []) {
  if (op.type !== "trains") continue; // Only train operators
  const normalizedName = normalizeName(op.name);
  const normalizedId = normalizeName(op.id);
  if (normalizedName && !knownOperators.has(normalizedName)) {
    knownOperators.set(normalizedName, op.name);
  }
  if (normalizedId && !knownOperators.has(normalizedId)) {
    knownOperators.set(normalizedId, op.name);
  }
}

// Add new operators to knownOperators so they don't get reported as missing
for (const op of newOperators) {
  const normalizedName = normalizeName(op.name);
  if (normalizedName && !knownOperators.has(normalizedName)) {
    knownOperators.set(normalizedName, op.name);
  }
}

// ────────────────────────────────────────────────────────────────
// 7. ADD NEW OPERATORS TO data.json
// ────────────────────────────────────────────────────────────────
const existingIds = new Set(operatorDb.operators.map(op => op.id.toLowerCase()));
const existingNames = new Set(operatorDb.operators.map(op => normalizeName(op.name)));

let addedCount = 0;
for (const op of newOperators) {
  const idLower = op.id.toLowerCase();
  const nameNorm = normalizeName(op.name);
  if (!existingIds.has(idLower) && !existingNames.has(nameNorm)) {
    operatorDb.operators.push(op);
    existingIds.add(idLower);
    existingNames.add(nameNorm);
    addedCount++;
    console.log(`  Added: ${op.name} (${op.id}) - ${op.country}`);
  }
}
console.log(`\nAdded ${addedCount} new operators to data.json`);

// ────────────────────────────────────────────────────────────────
// 8. PROCESS STATIONS (skip limited_use)
// ────────────────────────────────────────────────────────────────
let totalStations = 0;
let totalLimitedSkipped = 0;
let totalReplacements = 0;
const stillMissing = new Map();

for (const [countryKey, country] of Object.entries(stationData.countries || {})) {
  for (const station of country.stations || []) {
    totalStations++;
    
    // Skip limited_use stations
    if (station.usage === "limited_use") {
      totalLimitedSkipped++;
      station.operators = [];
      continue;
    }

    const syncedOperators = [];
    for (const operatorName of station.operators || []) {
      const normalized = normalizeName(operatorName);
      if (!normalized) continue;

      // Skip Wikidata Q-IDs
      if (/^q\d+$/.test(normalized)) continue;

      let matchedName = knownOperators.get(normalized);

      // Try partial matching
      if (!matchedName) {
        for (const [knownNorm, canonical] of knownOperators) {
          const knownParts = knownNorm.split(/\s+/);
          const opParts = normalized.split(/\s+/);
          const shorter = knownParts.length <= opParts.length ? knownParts : opParts;
          const longer = knownParts.length > opParts.length ? knownParts : opParts;
          const allWordsMatch = shorter.every(w => longer.includes(w));
          if (allWordsMatch && shorter.length >= 1) {
            matchedName = canonical;
            break;
          }
        }
      }

      if (matchedName) {
        if (!syncedOperators.includes(matchedName)) {
          syncedOperators.push(matchedName);
          totalReplacements++;
        }
      } else {
        if (!syncedOperators.includes(operatorName)) {
          syncedOperators.push(operatorName);
        }
        if (!stillMissing.has(operatorName)) {
          stillMissing.set(operatorName, {
            name: operatorName,
            normalized,
            countries: new Set(),
            stationCount: 0,
            sampleStations: []
          });
        }
        const entry = stillMissing.get(operatorName);
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

// ────────────────────────────────────────────────────────────────
// 9. WRITE RESULTS
// ────────────────────────────────────────────────────────────────

// Sort operators by type and id for consistency
const trainOps = operatorDb.operators.filter(o => o.type === "trains");
const ferryOps = operatorDb.operators.filter(o => o.type === "ferries");
trainOps.sort((a, b) => a.id.localeCompare(b.id));
ferryOps.sort((a, b) => a.id.localeCompare(b.id));
operatorDb.operators = [...trainOps, ...ferryOps];

// Write updated data.json
await writeFile("data.json", JSON.stringify(operatorDb, null, 2) + "\n", "utf8");
console.log(`\n✓ Updated data.json — now has ${operatorDb.operators.length} operators`);

// Write updated stations.json
await writeFile("stations.json", JSON.stringify(stationData, null, 2) + "\n", "utf8");
console.log(`✓ Updated stations.json — ${totalStations} stations (${totalLimitedSkipped} limited-use skipped), ${totalReplacements} operator links`);

// Write remaining missing operators
const remainingMissing = {
  generatedAt: new Date().toISOString(),
  totalMissing: stillMissing.size,
  operators: [...stillMissing.values()]
    .map(e => ({
      ...e,
      countries: [...e.countries].sort()
    }))
    .sort((a, b) => b.stationCount - a.stationCount)
};

await writeFile("missing-operators-report.json", JSON.stringify(remainingMissing, null, 2) + "\n", "utf8");
console.log(`✓ Updated missing-operators-report.json — ${remainingMissing.totalMissing} remaining missing operators`);

// Print summary
console.log(`\n═══════════════════════════════════════`);
console.log(`Summary:`);
console.log(`  Operators in data.json: ${operatorDb.operators.length}`);
console.log(`  Train operators: ${trainOps.length}`);
console.log(`  Ferry operators: ${ferryOps.length}`);
console.log(`  Stations processed: ${totalStations}`);
console.log(`  Limited-use skipped: ${totalLimitedSkipped}`);
console.log(`  Operator links made: ${totalReplacements}`);
console.log(`  Still missing: ${remainingMissing.totalMissing}`);
console.log(`═══════════════════════════════════════`);
