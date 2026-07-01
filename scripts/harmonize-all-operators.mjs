// =============================================================================
// Track & Tide — Full Operator & Station Harmonization
// Links all operators to served stations, adds missing operators,
// generates clean station IDs from names, and outputs updated data files.
// =============================================================================

import { readFileSync, writeFileSync } from 'fs';

const DATA_FILE   = '../data.json';
const STATIONS_FILE = '../stations.json';
const MISSING_OPS  = '../missing-operators-report.json';
const MISSING_ST   = '../missing-station-operators.json';

// ── Helpers ──────────────────────────────────────────────────────────────────

function norm(s) {
  if (!s) return '';
  if (typeof s !== 'string') s = String(s);
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripSuffixes(s) {
  if (!s) return '';
  if (typeof s !== 'string') s = String(s);
  return s
    .replace(/\b(ltd|limited|gmbh|ag|sa|nv|spa|srl|ab|as|oy|plc|inc|llc|co|corp|kg|sp\.z\s*o\.o\.|s\.l\.|s\.a\.|s\.r\.l\.|a\.s\.)\b/gi, '')
    .replace(/\s+/g, ' ').trim();
}

function cleanStationName(name) {
  return String(name||'')
    .replace(/\s+/g, ' ')
    .replace(/^Bahnhof\s+/i, '')
    .replace(/^(Gare de|Gare du|Gare d'|Stazione di|Stazione|Estación de|Estación|Estacao de|Estacao)\s+/i, '')
    .replace(/\s+(railway station|railway|train station|central station|bus station|metro station|airport|aeroport|aéroport|flughafen|hauptbahnhof|hbf|bahnhof|station|gare|stazione|estación|estacao)$/i, '')
    .trim();
}

function makeStationId(name, country) {
  const clean = cleanStationName(name)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const iso = getIso(country);
  return clean + '-' + (iso || country.toLowerCase().slice(0, 2));
}

let countryIsoMap = {};
function getIso(country) {
  if (countryIsoMap[country]) return countryIsoMap[country];
  // Will be populated when reading stations.json
  return null;
}

// ── Load Data ────────────────────────────────────────────────────────────────

console.log('Loading data files...');
const dataJson = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
const stationsJson = JSON.parse(readFileSync(STATIONS_FILE, 'utf8'));
const missingOps = JSON.parse(readFileSync(MISSING_OPS, 'utf8'));
const missingSt = JSON.parse(readFileSync(MISSING_ST, 'utf8'));

const operators = dataJson.operators || [];
const ferryOps = operators.filter(o => o.type === 'ferries');
const trainOps = operators.filter(o => o.type === 'trains');

// Build country→ISO map from stations.json
console.log('Building country map...');
for (const [countryName, countryData] of Object.entries(stationsJson.countries || {})) {
  if (countryData.iso) countryIsoMap[countryName] = countryData.iso.toLowerCase();
}

// ── Build Known Operators Map ────────────────────────────────────────────────

console.log('Building operator alias map...');

// MANUAL_ALIASES: maps variant names → canonical operator id
const MANUAL_ALIASES = {
  // German variants
  'db station&service': 'db',
  'db station und service': 'db',
  'db infrage': 'db',
  'db infrage ag': 'db',
  'db infrago': 'db',
  'db infrago ag': 'db',
  'db netz': 'db',
  'db netz ag': 'db',
  'db energie': 'db',
  'db fernverkehr': 'db',
  'db fernverkehr ag': 'db',
  'db regio': 'db',
  'db regio ag': 'db',
  'db regio netz': 'db',
  'db regio netz verkehrsgmbh': 'db',
  'deutsche bahn': 'db',
  'deutsche bahn ag': 'db',
  'deutsche reichsbahn': 'db',
  'deutsche bundesbahn': 'db',
  's-bahn berlin': 'db',
  's-bahn berlin gmbh': 'db',
  's-bahn hamburg': 'db',
  's-bahn hamburg gmbh': 'db',
  's-bahn munchen': 'db',
  's-bahn münchen': 'db',
  's-bahn stuttgart': 'db',
  's-bahn rhein-main': 'db',
  's-bahn rhein neckar': 'db',
  's-bahn rhein-ruhr': 'db',
  's-bahn dresden': 'db',
  's-bahn hannover': 'db',
  's-bahn nurnberg': 'db',
  's-bahn nürnberg': 'db',

  // Swiss variants
  'sbb cff ffs': 'sbb',
  'sbb ag': 'sbb',
  'schweizerische bundesbahnen': 'sbb',
  'chemins de fer federaux suisses': 'sbb',
  'ferrovie federali svizzere': 'sbb',
  'swiss federal railways': 'sbb',
  'zwitserse federale spoorwegen': 'sbb',
  'sbb gmbh': 'sbb',

  // French variants
  'sncf reseau': 'sncf',
  'sncf réseau': 'sncf',
  'sncf voyageurs': 'sncf',
  'sncf gares & connexions': 'sncf',
  'sncf mobilites': 'sncf',
  'sncf mobilités': 'sncf',
  'societe nationale des chemins de fer francais': 'sncf',
  'société nationale des chemins de fer français': 'sncf',

  // Spanish variants
  'renfe operadora': 'renfe',
  'renfe viajeros': 'renfe',
  'renfe cercanias': 'renfe',
  'renfe cercanías': 'renfe',
  'adif': 'renfe',
  'adif alta velocidad': 'renfe',

  // Italian variants
  'trenitalia spa': 'trenitalia',
  'trenitalia tper': 'trenitalia',
  'fs italiane': 'trenitalia',
  'ferrovie dello stato': 'trenitalia',
  'ferrovie dello stato italiane': 'trenitalia',
  'rete ferroviaria italiana': 'trenitalia',
  'rfi': 'trenitalia',
  'italo nuovotrasporto viaggiatori': 'italo',
  'italo ntv': 'italo',
  'ntv': 'italo',
  'nuovo trasporto viaggiatori': 'italo',

  // Austrian variants
  'obb personenverkehr': 'obb',
  'öbb personenverkehr': 'obb',
  'obb infrastruktur': 'obb',
  'öbb infrastruktur': 'obb',
  'oesterreichische bundesbahnen': 'obb',
  'österreichische bundesbahnen': 'obb',

  // British variants
  'network rail': 'networkrail',
  'network rail infrastructure': 'networkrail',
  'network rail infrastructure ltd': 'networkrail',
  'lner': 'lner',
  'london north eastern railway': 'lner',
  'gwr': 'gwr',
  'great western railway': 'gwr',
  'avanti west coast': 'avanti',
  'crosscountry': 'crosscountry',
  'cross country': 'crosscountry',
  'transpennine express': 'tpe',
  'transpennine': 'tpe',
  'greater anglia': 'greateranglia',
  'south western railway': 'swr',
  'swr': 'swr',
  'southeastern': 'southeastern',
  'southeastern railway': 'southeastern',
  'thameslink': 'thameslink',
  'thameslink railway': 'thameslink',
  'chiltern railways': 'chiltern',
  'chiltern': 'chiltern',
  'east midlands railway': 'emr',
  'emr': 'emr',
  'west midlands railway': 'wmr',
  'wmr': 'wmr',
  'northern': 'northern',
  'northern rail': 'northern',
  'northern trains': 'northern',
  'transport for wales': 'tfw',
  'tfw': 'tfw',
  'scotrail': 'scotrail',
  'scotrail trains': 'scotrail',
  'c2c': 'c2c',
  'merseyrail': 'merseyrail',
  'london overground': 'overground',
  'overground': 'overground',
  'elizabeth line': 'elizabethline',
  'elizabethline': 'elizabethline',
  'hull trains': 'hulltrains',

  // Dutch variants
  'ns reizigers': 'ns',
  'nederlandse spoorwegen': 'ns',
  'ns stations': 'ns',
  'proRail': 'ns',
  'prorail': 'ns',
  'arriva nederland': 'arriva',
  'arriva treinen': 'arriva',
  'blauwnet': 'blauwnet',
  'breng': 'breng',
  'connexxion': 'connexxion',
  'keolis nederland': 'keolis',
  'qBuzz': 'qbuzz',
  'q-buzz': 'qbuzz',
  'eBS': 'ebs',
  'e.B.S.': 'ebs',
  'ret': 'ret',
  'gvb': 'gvb',
  'htm': 'htm',

  // Belgian variants  
  'nmbs sncb': 'nmbs',
  'infrabel': 'nmbs',
  'sncb': 'nmbs',

  // Swedish variants
  'sj ab': 'sj',
  'statens jarnvagar': 'sj',
  'statens järnvägar': 'sj',
  'sl': 'sl',
  'storstockholms lokaltrafik': 'sl',
  'stockholms lokaltrafik': 'sl',
  'vasttrafik': 'vasttrafik',
  'västtrafik': 'vasttrafik',
  'skanetrafiken': 'skanetrafiken',
  'skånetrafiken': 'skanetrafiken',
  'ul': 'ul',
  'upplands lokaltrafik': 'ul',
  'x-trafik': 'xtrafik',
  'xtrafik': 'xtrafik',
  'orebro läns trafik': 'lanstrafikenorebro',
  'lanstrafiken orebro': 'lanstrafikenorebro',
  'norrtag': 'norrtag',
  'norrtåg': 'norrtag',
  'mälardalstrafik': 'malardalstrafik',
  'malardalstrafik': 'malardalstrafik',
  'krosatagen': 'krosatagen',
  'krösatågen': 'krosatagen',
  'tåg i bergslagen': 'tagibergslagen',
  'tag i bergslagen': 'tagibergslagen',
  'varmlandstrafik': 'varmlandstrafik',
  'värmlandstrafik': 'varmlandstrafik',
  'jlt': 'jlt',
  'jonkopings lanstrafik': 'jlt',
  'jonköpings länstrafik': 'jlt',
  'länstrafiken kronoberg': 'lanstrafikenkronoberg',
  'blekingetrafiken': 'blekingetrafiken',
  'kalmar lanstrafik': 'klt',
  'klt': 'klt',
  'hallandstrafiken': 'hallandstrafiken',
  'ostgotatrafiken': 'ostgotatrafiken',
  'östgötatrafiken': 'ostgotatrafiken',

  // Norwegian variants  
  'vy tog': 'vy',
  'vy gruppen': 'vy',
  'nsb': 'vy',
  'norges statsbaner': 'vy',
  'go ahead nordic': 'goaheadnordic',
  'go-ahead nordic': 'goaheadnordic',
  'go ahead norge': 'goaheadnordic',
  'sj norge': 'sjnorge',
  'sj norway': 'sjnorge',
  'ruter': 'ruter',
  'skyss': 'skyss',
  'kolumbus': 'kolumbus',
  'atb': 'atb',
  'brakar': 'brakar',
  'ostfold kollektivtrafikk': 'ostfoldkollektiv',
  'østfold kollektivtrafikk': 'ostfoldkollektiv',
  'vestfold kollektivtrafikk': 'vkt',
  'vkt': 'vkt',
  'agder kollektivtrafikk': 'akt',
  'akt': 'akt',
  'telemark fylkeskommune': 'farte',
  'farte': 'farte',
  'innlandet fylkeskommune': 'innlandstrafikk',
  'innlandstrafikk': 'innlandstrafikk',
  'troms fylkestrafikk': 'tromsfylkestrafikk',
  'fylkestrafikk more og romsdal': 'fram',
  'fram': 'fram',
  'nordland fylkeskommune': 'nordland',
  'boreal': 'boreal',
  'boreal transport': 'boreal',

  // Danish variants
  'dsb': 'dsb',
  'danske statsbaner': 'dsb',
  'arriva danmark': 'arriva',
  'arriva tog': 'arriva',
  'nordjyske jernbaner': 'nordjyske',
  'nj': 'nordjyske',
  'midtjyske jernbaner': 'midtjyske',
  'lokaltog': 'lokaltog',
  'lokaltog a/s': 'lokaltog',
  'movia': 'movia',
  'nt': 'nordjyllandstrafik',
  'nordjyllands trafikselskab': 'nordjyllandstrafik',
  'midtTrafik': 'midttrafik',
  'midttrafik': 'midttrafik',
  'sydTrafik': 'sydtrafik',
  'sydtrafik': 'sydtrafik',
  'fynBus': 'fynbus',
  'fynbus': 'fynbus',

  // Finnish variants
  'vr': 'vr',
  'vr group': 'vr',
  'vr-yhtyma': 'vr',
  'vr yhtyma oy': 'vr',
  'valtionrautatiet': 'vr',

  // Czech variants
  'ceske drahy': 'cd',
  'české dráhy': 'cd',
  'cd': 'cd',
  'regiojet': 'regiojet',
  'regio jet': 'regiojet',
  'leo express': 'leoexpress',
  'leoexpress': 'leoexpress',
  'arriva vlaky': 'arriva',
  'sprava zeleznic': 'sz',
  'správa železnic': 'sz',
  'szdc': 'sz',
  'jikord': 'jikord',

  // Polish variants
  'pkp': 'pkp',
  'pkp intercity': 'pkp',
  'pkp intercity sa': 'pkp',
  'polskie koleje panstwowe': 'pkp',
  'polregio': 'polregio',
  'przewozy regionalne': 'polregio',
  'koleje mazowieckie': 'kolejemazowieckie',
  'km': 'kolejemazowieckie',
  'koleje slaskie': 'kolejeslaskie',
  'koleje śląskie': 'kolejeslaskie',
  'koleje wielkopolskie': 'kolejewielkopolskie',
  'koleje dolnoslaskie': 'kolejedolnoslaskie',
  'koleje dolnośląskie': 'kolejedolnoslaskie',
  'lka': 'lkaregionalna',
  'lodzka kolej aglomeracyjna': 'lkaregionalna',
  'łódzka kolej aglomeracyjna': 'lkaregionalna',
  'skm warszawa': 'skmwarszawa',
  'skm trojmiasto': 'skmtrojmiasto',
  'skm trójmieście': 'skmtrojmiasto',
  'warszawska kolej dojazdowa': 'wkd',
  'wkd': 'wkd',
  'koleje malopolskie': 'kolejemalopolskie',
  'koleje małopolskie': 'kolejemalopolskie',
  'pkp plk': 'pkp',

  // Hungarian variants
  'mav': 'mav',
  'máv': 'mav',
  'magyar allamvasutak': 'mav',
  'magyar államvasutak': 'mav',
  'mav start': 'mav',
  'máv start': 'mav',
  'mav start zrt': 'mav',
  'gysev': 'gysev',
  'gysev zrt': 'gysev',
  'győr sopron ebenfurti vasút': 'gysev',
  'bkv': 'bkv',
  'mav-hev': 'mavhev',
  'máv-hév': 'mavhev',

  // Portuguese variants
  'cp': 'cp',
  'comboios de portugal': 'cp',
  'cp comboios de portugal': 'cp',
  'infraestruturas de portugal': 'cp',
  'fertagus': 'fertagus',
  'metro do porto': 'metroporto',
  'metro de lisboa': 'metrolisboa',

  // Irish variants
  'irish rail': 'irishrail',
  'iarnrod eireann': 'irishrail',
  'iarnród éireann': 'irishrail',

  // Luxembourg
  'cfl': 'cfl',
  'chemins de fer luxembourgeois': 'cfl',
  'societe nationale des chemins de fer luxembourgeois': 'cfl',

  // Greek
  'ose': 'ose',
  'hellenic railways': 'ose',
  'trainose': 'ose',
  'hellenic train': 'ose',

  // Romanian
  'cfr': 'cfr',
  'caile ferate romane': 'cfr',
  'regio calatori': 'regiocalatori',
  'interregional calatori': 'cfr',
  'transferoviar calatori': 'transferoviar',
  'astra trans carpatica': 'astratranscarpatica',
  'softrans': 'softrans',

  // Bulgarian
  'bdz': 'bdz',
  'bdzh': 'bdz',
  'balgarski darzhavni zheleznitsi': 'bdz',

  // Croatian
  'hz': 'hzpp',
  'hz putnicki prijevoz': 'hzpp',
  'hž putnički prijevoz': 'hzpp',
  'hrvatske zeljeznice': 'hzpp',

  // Slovenian
  'sz': 'sž',
  'slovenske zeleznice': 'sž',
  'sž': 'sž',

  // Slovak
  'zssk': 'zssk',
  'železnicná spolocnost slovensko': 'zssk',

  // Lithuanian
  'ltg link': 'ltglink',
  'ltg': 'ltglink',
  'lietuvos gelezinkeliai': 'ltglink',

  // Latvian
  'pv': 'pasazieruvilciens',
  'pasazieru vilciens': 'pasazieruvilciens',

  // Estonian
  'elron': 'elron',
  'eesti raudtee': 'elron',

  // Turkish
  'tcdd': 'tcdd',
  'tcdd tasimacilik': 'tcdd',
  'tcdd taşımacılık': 'tcdd',
  'turkish state railways': 'tcdd',

  // French regional
  'ter': 'sncf',
  'ter auvergne rhone alpes': 'sncf',
  'ter nouvelle aquitaine': 'sncf',
  'ter occitanie': 'sncf',
  'ter grand est': 'sncf',
  'ter hauts de france': 'sncf',
  'ter bourgogne franche comte': 'sncf',
  'ter pays de la loire': 'sncf',
  'ter bretagne': 'sncf',
  'ter centre val de loire': 'sncf',
  'ter normandie': 'sncf',
  'ter provence alpes cote dazur': 'sncf',
  'rer': 'ratp',
  'transilien': 'sncf',

  // Spanish regional
  'fgc': 'fgc',
  'ferrocarrils de la generalitat de catalunya': 'fgc',
  'euskotren': 'euskotren',
  'euskotren trena': 'euskotren',
  'feve': 'renfe',
  'sfm': 'sfm',
  'serveis ferroviaris de mallorca': 'sfm',
  'fmb': 'metrobarcelona',
  'metro barcelona': 'metrobarcelona',
  'tmb': 'metrobarcelona',
  'metro madrid': 'metromadrid',
  'metro bilbao': 'metrobilbao',
  'metro valencia': 'metrovalencia',
  'metro sevilla': 'metrosevilla',

  // Ferry operator variants
  'stenaline': 'stenaline',
  'stena line': 'stenaline',
  'p&o ferries': 'poferries',
  'p and o ferries': 'poferries',
  'p&o': 'poferries',
  'brittany ferries': 'brittanyferries',
  'dfds': 'dfds',
  'dfds seaways': 'dfds',
  'scandlines': 'scandlines',
  'color line': 'colorline',
  'colorline': 'colorline',
  'fjord line': 'fjordline',
  'fjordline': 'fjordline',
  'tt line': 'ttline',
  'ttline': 'ttline',
  'tallink': 'tallinksilja',
  'silja line': 'tallinksilja',
  'tallink silja': 'tallinksilja',
  'viking line': 'vikingline',
  'vikingline': 'vikingline',
  'finnlines': 'finnlines',
  'finnlines oyj': 'finnlines',
  'balearia': 'balearia',
  'balearia caribbean': 'balearia',
  'grimaldi': 'grimaldi',
  'grimaldi lines': 'grimaldi',
  'gnv': 'gnv',
  'grandi navi veloci': 'gnv',
  'moby lines': 'moby',
  'moby': 'moby',
  'corsica ferries': 'corsicaferries',
  'corsica sardinia ferries': 'corsicaferries',
  'irish ferries': 'irishferries',
  'jadrolinija': 'jadrolinija',
  'molslinjen': 'molslinjen',
  'mols linjen': 'molslinjen',
  'bornholmslinjen': 'bornholmslinjen',
  'bornholmerfaergen': 'bornholmslinjen',
  'forsea': 'forsea',
  'wasaline': 'wasaline',
  'samsø rederi': 'samsorederi',
  'aerø faergerne': 'aeroe',
  'langelandsfaergen': 'langelandsfaergen',
  'faergen': 'faergen',
  'færgen': 'faergen',
  'destiny ferries': 'destiny',
  'eckerö': 'eckero',
  'eckerö linjen': 'eckero',
  'unity line': 'unityline',
  'polferries': 'polferries',
  'polska zegluga baltycka': 'polferries',

  // ── Romania ──
  'cfr calatori': 'cfr',
  'cfr cēlētori': 'cfr',
  'cfr c\u0103l\u0103tori': 'cfr',
  'transferoviar calatori': 'transferoviar',
  'transferoviar cēlētori': 'transferoviar',
  'regiotrans': 'regiocalatori',
  'softrans': 'softrans',
  'astra trans carpatica': 'astratranscarpatica',
  'regio calatori': 'regiocalatori',

  // ── UK missing ──
  'west midlands trains': 'wmr',
  'west midlands railway': 'wmr',
  'london northwestern railway': 'wmr',
  'london north western railway': 'wmr',
  'lnwr': 'wmr',
  'crosscountry trains': 'crosscountry',
  'arriva rail london': 'arriva',
  'arriva trains wales': 'tfw',
  'keolis amey wales': 'tfw',
  'merseyrail electrics': 'merseyrail',
  'first transPennine express': 'tpe',
  'first great western': 'gwr',
  'first scotrail': 'scotrail',
  'abellio greater anglia': 'greateranglia',
  'abellio scotrail': 'scotrail',
  'serco caledonian sleeper': 'caledoniansleeper',
  'serco': 'caledoniansleeper',
  'london underground': 'tfl',
  'transport for london': 'tfl',
  'tfl': 'tfl',
  'docklands light railway': 'tfl',
  'dlr': 'tfl',
  'tyne and wear metro': 'nexus',
  'nexus': 'nexus',
  'strathclyde partnership for transport': 'spt',
  'spt': 'spt',
  'ni railways': 'translink',
  'northern ireland railways': 'translink',
  'translink': 'translink',
  'translink ni': 'translink',
  'eurostar international': 'eurostar',

  // ── Swiss regional missing ──
  'schweizerische sudostbahn': 'so b',
  'schweizerische südostbahn': 'so b',
  'montreux berner oberland bahn': 'mo b',
  'montreux berner oberland': 'mo b',
  'montreux-berner oberland-bahn': 'mo b',
  'transports de martigny et regions': 'tmr',
  'tmr': 'tmr',
  'aare seeland mobil': 'as m',
  'chemins de fer du jura': 'cj',
  'transports publics fribourgeois': 'tpf',
  'transports publics du chablais': 'tpc',
  'frauenfeld wil bahn': 'fART',
  'matterhorn gotthard bahn': 'matterhorngotthard',
  'matterhorn gotthard verkehr': 'matterhorngotthard',
  'rhatische bahn': 'rhb',
  'rhätische bahn': 'rhb',
  'rhb ag': 'rhb',
  'b ls ag': 'b ls',

  // ── German missing ──
  'albtal verkehrs gesellschaft': 'avg',
  'albtal-verkehrs-gesellschaft': 'avg',
  'av g': 'avg',
  'avg': 'avg',
  'albtal verkehrs gesellschaft mbh': 'avg',
  'hohenzollerische landesbahn': 'hzl',
  'hzl': 'hzl',
  'swu verkehr': 'swu',
  'swu': 'swu',
  'abellio rail mitteldeutschland': 'abellio',
  'abellio rail nrw': 'abellio',
  'abellio rail': 'abellio',
  'trans regio': 'transregio',
  'transregio': 'transregio',
  'mitteldeutsche regiobahn': 'mitteldeutsche',
  'bayerische oberlandbahn': 'bayeroberland',
  'bayerische regiobahn': 'bayerregiobahn',
  'nordbahn eisenbahn': 'nbe',
  'osthannoversche eisenbahnen': 'hansestadt',
  'ohe': 'hansestadt',
  'railjet': 'obb',
  'nightjet': 'obb',
  'eurocity': 'db',
  'intercity': 'db',
  'intercity express': 'db',
  'ice': 'db',
  'metronom eisenbahngesellschaft': 'metronom',

  // ── Italian missing ──
  'ferrovie del sud est': 'fse',
  'fse': 'fse',
  'ferrovia suzzara ferrara': 'fer',
  'fer': 'fer',
  'ferrovie emilia romagna': 'fer',
  'ferrovia circumetnea': 'circumetnea',
  'circumvesuviana srl': 'circumvesuviana',
  'eav': 'circumvesuviana',
  'ente autonomo volturno': 'circumvesuviana',
  'ctc': 'cotral',
  'cotral': 'cotral',
  'compagnia trasporti laziali': 'cotral',
  'atac': 'atac',
  'atac roma': 'atac',
  'trenitalia tper scarl': 'trenordest',
  'ferrovienord spa': 'ferrovienord',
  'ferrovie nord milano': 'ferrovienord',
  'fnm': 'ferrovienord',
  'gruppo torinese trasporti': 'gtt',
  'gtt': 'gtt',
  'amt genova': 'amtgenova',
  'amt': 'amtgenova',
  'actv': 'actv',
  'actv venezia': 'actv',
  'dolomiti bus': 'dolomitibus',
  'ttr': 'ttr',
  'trentino trasporti': 'ttr',

  // ── French missing ──
  'ratp': 'ratp',
  'regie autonome des transports parisiens': 'ratp',
  'régie autonome des transports parisiens': 'ratp',
  'optile': 'ratp',
  'ile de france mobilites': 'ratp',
  'île-de-france mobilités': 'ratp',
  'stif': 'ratp',
  'chemins de fer de la corse': 'cfc',
  'cfc': 'cfc',
  'chemins de fer de provence': 'cpt',
  'mont blanc express': 'montblanc',
  'le train jaune': 'cervi',
  'cdg val': 'cdgval',

  // ── Austrian missing ──
  'raaberbahn': 'gysev',
  'raaberbahn ag': 'gysev',
  'gysev raaberbahn': 'gysev',
  'raab oedenburg ebenfurter': 'gysev',
  'steiermarkbahn': 'stlb',
  'stlb': 'stlb',
  'steiermarkische landesbahnen': 'stlb',
  'steiermärkische landesbahnen': 'stlb',
  'niederosterreichische schneebergbahn': 'schneebergbahn',
  'szr': 'schafbergbahn',
  'salzburg ag': 'szr',
  'pinzgauer lokalbahn': 'pinzgauer',
  'zillertaler verkehrsbetriebe': 'ztb',

  // ── Moldova / Ukraine / Russia missing ──
  'calea ferata din moldova': 'cfm',
  'cfm': 'cfm',
  'ukrzaliznytsia': 'uz',
  'ukrzaliznycja': 'uz',
  'uz': 'uz',
  'ukrainian railways': 'uz',
  'crimea railway': 'russianrailways',
  'krymskaya zheleznaya doroga': 'russianrailways',
  'russian railways': 'russianrailways',
  'rzd': 'russianrailways',
  'rzhd': 'russianrailways',
  'rossiyskie zheleznye dorogi': 'russianrailways',
  'bc': 'belarusianrailway',
  'belarusian railway': 'belarusianrailway',
  'belorusskaya zheleznaya doroga': 'belarusianrailway',

  // ── Greece missing ──
  'trainose': 'ose',
  'trainose sa': 'ose',
  'hellenic train': 'ose',
  'hellenic railways organisation': 'ose',
  'ose sa': 'ose',
  'stather': 'stather',
  'stasy': 'stather',
  'athens metro': 'stather',
};

// Build known operators: id → operator, AND all name variants → id
const knownOperators = new Map();

for (const op of operators) {
  knownOperators.set(op.id, op.id);
  // Add the operator's own name as alias
  knownOperators.set(norm(op.name), op.id);
  // Add normalized + stripped name
  knownOperators.set(norm(stripSuffixes(op.name)), op.id);
  // Also map the operator ID itself as a known name
  knownOperators.set(norm(op.id), op.id);
}

// Add manual aliases
for (const [alias, targetId] of Object.entries(MANUAL_ALIASES)) {
  knownOperators.set(norm(alias), targetId);
}

// ── Add New Operators ────────────────────────────────────────────────────────

console.log('Adding new operators...');

const newOperators = [
  // ── Swiss regional / scenic ──
  { id: 'rhb', name: 'Rhätische Bahn', country: 'Switzerland', countries:['Switzerland','Italy'], type:'trains', logo:'rhb.png', operatorLabel:'Swiss scenic mountain railway', description:'The Rhätische Bahn operates Switzerland\'s most iconic scenic routes including the Bernina Express and Glacier Express through the Alps.' },
  { id: 'matterhorngotthard', name: 'Matterhorn Gotthard Bahn', country:'Switzerland', countries:['Switzerland'], type:'trains', logo:'mgb.png', operatorLabel:'Swiss alpine railway', description:'Operates the Glacier Express route between Zermatt and St. Moritz through the Swiss Alps.' },
  { id: 'b ls', name:'BLS', country:'Switzerland', countries:['Switzerland'], type:'trains', logo:'bls.png', operatorLabel:'Swiss regional railway', description:'BLS operates regional and S-Bahn services in the Bernese Oberland and connects Bern with Interlaken and Lucerne.' },
  { id:'so b', name:'SOB', country:'Switzerland', countries:['Switzerland'], type:'trains', logo:'sob.png', operatorLabel:'Swiss regional railway', description:'Südostbahn operates the Voralpen Express and regional services in eastern Switzerland.' },
  { id:'zb', name:'Zentralbahn', country:'Switzerland', countries:['Switzerland'], type:'trains', description:'Scenic railway connecting Lucerne with Interlaken and Engelberg, including the Brünig line.' },
  { id:'mo b', name:'MOB', country:'Switzerland', countries:['Switzerland'], type:'trains', description:'Montreux-Oberland Bernois operates the GoldenPass panoramic route from Montreux to Zweisimmen.' },
  { id:'tpc', name:'Transports Publics du Chablais', country:'Switzerland', countries:['Switzerland'], type:'trains', description:'Regional transport in the Chablais region of Vaud and Valais.' },
  { id:'mgi n', name:'MVR', country:'Switzerland', countries:['Switzerland'], type:'trains', description:'Montreux-Vevey-Riviera transports including the scenic train to Rochers-de-Naye.' },
  { id:'as m', name:'ASm', country:'Switzerland', countries:['Switzerland'], type:'trains', description:'Aare Seeland mobil operates regional services in the Bern-Seeland region.' },
  { id:'cj', name:'CJ', country:'Switzerland', countries:['Switzerland'], type:'trains', description:'Chemins de fer du Jura operates regional railways in the Swiss Jura.' },
  { id:'travys', name:'Travys', country:'Switzerland', countries:['Switzerland'], type:'trains', description:'Regional transport in the Yverdon and Vallée de Joux area.' },
  { id:'tpf', name:'TPF', country:'Switzerland', countries:['Switzerland'], type:'trains', description:'Transports Publics Fribourgeois operates regional trains and buses around Fribourg.' },
  { id:'bam', name:'BAM', country:'Switzerland', countries:['Switzerland'], type:'trains', description:'Bière-Apples-Morges railway in canton Vaud.' },
  { id:'ab', name:'Appenzeller Bahnen', country:'Switzerland', countries:['Switzerland'], type:'trains', description:'Narrow-gauge railways in the Appenzell region of eastern Switzerland.' },
  { id:'fART', name:'Frauenfeld-Wil-Bahn', country:'Switzerland', countries:['Switzerland'], type:'trains', description:'Narrow-gauge railway connecting Frauenfeld and Wil.' },
  { id:'wab', name:'Wengernalpbahn', country:'Switzerland', countries:['Switzerland'], type:'trains', description:'The world\'s longest continuous cogwheel railway, connecting Lauterbrunnen, Wengen, and Kleine Scheidegg.' },
  { id:'jb', name:'Jungfraubahn', country:'Switzerland', countries:['Switzerland'], type:'trains', description:'Famous cogwheel railway to Jungfraujoch, Europe\'s highest railway station at 3,454m.' },
  { id:'gornergrat', name:'Gornergrat Bahn', country:'Switzerland', countries:['Switzerland'], type:'trains', description:'Scenic cogwheel railway from Zermatt to the Gornergrat summit at 3,089m.' },
  { id:'brienzrothorn', name:'Brienz Rothorn Bahn', country:'Switzerland', countries:['Switzerland'], type:'trains', description:'Historic steam cogwheel railway climbing from Brienz to the Rothorn summit.' },
  { id:'pilatus', name:'Pilatus Bahn', country:'Switzerland', countries:['Switzerland'], type:'trains', description:'The world\'s steepest cogwheel railway climbing Mount Pilatus near Lucerne.' },
  { id:'rigi', name:'Rigi Bahnen', country:'Switzerland', countries:['Switzerland'], type:'trains', description:'Europe\'s oldest mountain railway, climbing Mount Rigi from Vitznau and Arth-Goldau.' },

  // ── German regional / private ──
  { id:'metronom', name:'Metronom', country:'Germany', countries:['Germany'], type:'trains', logo:'metronom.png', operatorLabel:'German regional train operator', description:'Operates regional express services in Lower Saxony, Hamburg and Bremen.' },
  { id:'nordwestbahn', name:'NordWestBahn', country:'Germany', countries:['Germany'], type:'trains', description:'Regional train operator in northwest Germany, Lower Saxony and North Rhine-Westphalia.' },
  { id:'erixx', name:'Erixx', country:'Germany', countries:['Germany'], type:'trains', description:'Regional train services in Lower Saxony and Bremen.' },
  { id:'enno', name:'Enno', country:'Germany', countries:['Germany'], type:'trains', description:'Regional train operator in the Hanover-Brunswick-Wolfsburg region.' },
  { id:'westfalenbahn', name:'WestfalenBahn', country:'Germany', countries:['Germany'], type:'trains', description:'Regional train operator in North Rhine-Westphalia and Lower Saxony.' },
  { id:'eurobahn', name:'Eurobahn', country:'Germany', countries:['Germany'], type:'trains', description:'Regional train operator in North Rhine-Westphalia, Lower Saxony and the Netherlands border.' },
  { id:'trireno', name:'Trireno', country:'Germany', countries:['Germany'], type:'trains', description:'Regional train operator in the Black Forest and Upper Rhine region.' },
  { id:'goaheadde', name:'Go-Ahead Deutschland', country:'Germany', countries:['Germany'], type:'trains', description:'Regional train operator in Baden-Württemberg and Bavaria.' },
  { id:'agilis', name:'Agilis', country:'Germany', countries:['Germany'], type:'trains', description:'Regional train operator in Bavaria.' },
  { id:'alex', name:'Alex', country:'Germany', countries:['Germany','Czechia'], type:'trains', description:'Regional and inter-regional services between Bavaria and the Czech Republic.' },
  { id:'bayeroberland', name:'Bayerische Oberlandbahn', country:'Germany', countries:['Germany'], type:'trains', description:'Regional train services south of Munich into the Bavarian Oberland.' },
  { id:'bayerregiobahn', name:'Bayerische Regiobahn', country:'Germany', countries:['Germany'], type:'trains', description:'Regional train operator in Bavaria.' },
  { id:'mitteldeutsche', name:'Mitteldeutsche Regiobahn', country:'Germany', countries:['Germany'], type:'trains', description:'Regional train operator in Saxony, serving Dresden, Leipzig and Chemnitz.' },
  { id:'odenwaldbahn', name:'Odenwaldbahn', country:'Germany', countries:['Germany'], type:'trains', description:'Regional railway through the Odenwald forest between Hesse and Baden-Württemberg.' },
  { id:'abellio', name:'Abellio', country:'Germany', countries:['Germany'], type:'trains', description:'Regional train operator in several German states.' },
  { id:'vlexx', name:'Vlexx', country:'Germany', countries:['Germany'], type:'trains', description:'Regional train operator in Rhineland-Palatinate, Saarland and Hesse.' },
  { id:'cantus', name:'Cantus', country:'Germany', countries:['Germany'], type:'trains', description:'Regional train operator in Hesse and Thuringia.' },
  { id:'hansestadt', name:'Osthannoversche Eisenbahnen', country:'Germany', countries:['Germany'], type:'trains', description:'Regional freight and passenger railway in eastern Lower Saxony.' },
  { id:'nbe', name:'Nordbahn', country:'Germany', countries:['Germany'], type:'trains', description:'Regional railway in Schleswig-Holstein.' },
  { id:'akn', name:'AKN', country:'Germany', countries:['Germany'], type:'trains', description:'Regional railway in Schleswig-Holstein and Hamburg.' },

  // ── Italian regional ──
  { id:'trenord', name:'Trenord', country:'Italy', countries:['Italy'], type:'trains', logo:'trenord.png', operatorLabel:'Italian regional train operator', description:'Lombardy regional train operator serving Milan and the surrounding region.' },
  { id:'ferrovienord', name:'Ferrovienord', country:'Italy', countries:['Italy'], type:'trains', description:'Railway infrastructure and services in northern Lombardy.' },
  { id:'trenordest', name:'Trenitalia Tper', country:'Italy', countries:['Italy'], type:'trains', description:'Regional train operator in Emilia-Romagna.' },
  { id:'ferc', name:'Ferrovie del Gargano', country:'Italy', countries:['Italy'], type:'trains', description:'Regional railway in Apulia, including the Gargano line.' },
  { id:'ferappulo', name:'Ferrovie Appulo Lucane', country:'Italy', countries:['Italy'], type:'trains', description:'Regional narrow-gauge railway in Basilicata and Apulia.' },
  { id:'fcu', name:'Ferrovia Centrale Umbra', country:'Italy', countries:['Italy'], type:'trains', description:'Regional railway in Umbria.' },
  { id:'circumvesuviana', name:'Circumvesuviana', country:'Italy', countries:['Italy'], type:'trains', description:'Narrow-gauge railway network around Mount Vesuvius, serving Naples suburbs.' },
  { id:'circumetnea', name:'Ferrovia Circumetnea', country:'Italy', countries:['Italy'], type:'trains', description:'Narrow-gauge railway circling Mount Etna in Sicily.' },
  { id:'fta', name:'Ferrovia Trento-Malè', country:'Italy', countries:['Italy'], type:'trains', description:'Regional railway from Trento into the Val di Non and Val di Sole.' },
  { id:'sad', name:'SAD', country:'Italy', countries:['Italy','Austria'], type:'trains', description:'Regional transport in South Tyrol, including the Pustertal and Vinschgau railways.' },
  { id:'domodossolalocarno', name:'Domodossola-Locarno Railway', country:'Italy', countries:['Italy','Switzerland'], type:'trains', description:'Scenic international narrow-gauge railway through the Centovalli.' },
  { id:'berninaexpress', name:'Bernina Express', country:'Switzerland', countries:['Switzerland','Italy'], type:'trains', description:'UNESCO World Heritage scenic railway from Chur to Tirano through the Bernina Pass.' },

  // ── Austrian regional / scenic ──
  { id:'westbahn', name:'Westbahn', country:'Austria', countries:['Austria','Germany'], type:'trains', logo:'westbahn.png', operatorLabel:'Austrian private train operator', description:'Private intercity operator on the Vienna-Salzburg corridor, competing with ÖBB.' },
  { id:'gkb', name:'GKB', country:'Austria', countries:['Austria'], type:'trains', description:'Graz-Köflacher Bahn operates regional services around Graz, Styria.' },
  { id:'mzb', name:'Murtalbahn', country:'Austria', countries:['Austria'], type:'trains', description:'Narrow-gauge railway through the Mur valley in Styria.' },
  { id:'ztb', name:'Zillertalbahn', country:'Austria', countries:['Austria'], type:'trains', description:'Narrow-gauge railway through the Zillertal valley in Tyrol.' },
  { id:'acb', name:'Achenseebahn', country:'Austria', countries:['Austria'], type:'trains', description:'Historic steam cogwheel railway from Jenbach to Lake Achensee.' },
  { id:'pinzgauer', name:'Pinzgauer Lokalbahn', country:'Austria', countries:['Austria'], type:'trains', description:'Narrow-gauge railway through the Pinzgau region of Salzburg.' },
  { id:'schneebergbahn', name:'Schneebergbahn', country:'Austria', countries:['Austria'], type:'trains', description:'Cogwheel railway climbing the Schneeberg, Lower Austria\'s highest mountain.' },
  { id:'schafbergbahn', name:'SchafbergBahn', country:'Austria', countries:['Austria'], type:'trains', description:'Steam cogwheel railway climbing the Schafberg in the Salzkammergut.' },
  { id:'semmeringbahn', name:'Semmering Railway', country:'Austria', countries:['Austria'], type:'trains', description:'UNESCO World Heritage mountain railway, Europe\'s first standard-gauge mountain railway.' },
  { id:'cityairporttrain', name:'City Airport Train', country:'Austria', countries:['Austria'], type:'trains', description:'Express train connecting Vienna city centre with Vienna International Airport.' },

  // ── French regional / private ──
  { id:'ouigo', name:'Ouigo', country:'France', countries:['France','Spain'], type:'trains', logo:'ouigo.png', operatorLabel:'French low-cost high-speed rail', description:'SNCF\'s low-cost TGV service operating high-speed trains across France and to Spain.' },
  { id:'cpt', name:'Chemins de fer de Provence', country:'France', countries:['France'], type:'trains', description:'Scenic narrow-gauge railway from Nice to Digne-les-Bains through Provence.' },
  { id:'montblanc', name:'Mont-Blanc Express', country:'France', countries:['France','Switzerland'], type:'trains', description:'Scenic mountain railway through the Chamonix valley to Martigny.' },
  { id:'cervi', name:'Train Jaune', country:'France', countries:['France'], type:'trains', description:'Historic electric railway through the Pyrenees, known as the Yellow Train.' },
  { id:'cdgval', name:'CDGVAL', country:'France', countries:['France'], type:'trains', description:'Automated shuttle connecting terminals at Paris Charles de Gaulle Airport.' },

  // ── British regional / heritage ──
  { id:'grandcentral', name:'Grand Central', country:'United Kingdom', countries:['United Kingdom'], type:'trains', description:'Open-access intercity operator on the East Coast Main Line.' },
  { id:'tfwrail', name:'Transport for Wales Rail', country:'United Kingdom', countries:['United Kingdom'], type:'trains', description:'Welsh train operator serving Wales and the border regions.' },
  { id:'caledoniansleeper', name:'Caledonian Sleeper', country:'United Kingdom', countries:['United Kingdom'], type:'trains', description:'Overnight sleeper train services between London and Scotland.' },
  { id:'westcoast', name:'West Coast Railways', country:'United Kingdom', countries:['United Kingdom'], type:'trains', description:'Heritage and charter train operator, including the Jacobite steam train.' },
  { id:'heathrowexpress', name:'Heathrow Express', country:'United Kingdom', countries:['United Kingdom'], type:'trains', description:'Express train service between London Paddington and Heathrow Airport.' },
  { id:'gatwickexpress', name:'Gatwick Express', country:'United Kingdom', countries:['United Kingdom'], type:'trains', description:'Express train between London Victoria and Gatwick Airport.' },
  { id:'stanstedexpress', name:'Stansted Express', country:'United Kingdom', countries:['United Kingdom'], type:'trains', description:'Express train between London Liverpool Street and Stansted Airport.' },

  // ── Benelux ──
  { id:'eurostar', name:'Eurostar', country:'United Kingdom', countries:['United Kingdom','France','Belgium','Netherlands'], type:'trains', logo:'eurostar.png', operatorLabel:'International high-speed train operator', description:'Connects London with Paris, Brussels, Amsterdam and other European cities through the Channel Tunnel.' },
  { id:'intercitydirect', name:'Intercity Direct', country:'Netherlands', countries:['Netherlands','Belgium'], type:'trains', description:'High-speed domestic and international service connecting Amsterdam, Rotterdam and Breda.' },

  // ── Nordic ──
  { id:'flytoget', name:'Flytoget', country:'Norway', countries:['Norway'], type:'trains', description:'Airport express train between Oslo city centre and Oslo Airport Gardermoen.' },
  { id:'flygbussarna', name:'Arlanda Express', country:'Sweden', countries:['Sweden'], type:'trains', description:'High-speed airport train connecting Stockholm city centre with Arlanda Airport.' },
  { id:'oresundstag', name:'Öresundståg', country:'Sweden', countries:['Sweden','Denmark'], type:'trains', description:'Cross-border regional trains through the Öresund region connecting Sweden and Denmark.' },
  { id:'paatoget', name:'Pågatågen', country:'Sweden', countries:['Sweden'], type:'trains', description:'Regional train network in Skåne, southern Sweden.' },
  { id:'hsl', name:'HSL', country:'Finland', countries:['Finland'], type:'trains', description:'Helsinki Regional Transport Authority, operating commuter trains in the capital region.' },

  // ── Central / Eastern Europe ──
  { id:'dukol', name:'Die Länderbahn', country:'Germany', countries:['Germany','Czechia'], type:'trains', description:'Regional train operator in Bavaria, Saxony and the Czech Republic, operating the Alex and trilex brands.' },
  { id:'gwtr', name:'GW Train Regio', country:'Czechia', countries:['Czechia'], type:'trains', description:'Regional train operator in the Czech Republic.' },
  { id:'zsskcargo', name:'ZSSK Cargo', country:'Slovakia', countries:['Slovakia'], type:'trains', description:'Freight operator, also operates some regional passenger services in Slovakia.' },
  { id:'tez', name:'Tež', country:'Slovenia', countries:['Slovenia'], type:'trains', description:'Slovenian railway infrastructure manager.' },

  // ── Southern Europe ──
  { id:'rhodope', name:'Rhodope Narrow Gauge', country:'Bulgaria', countries:['Bulgaria'], type:'trains', description:'Scenic narrow-gauge railway through the Rhodope Mountains, Bulgaria\'s last operational narrow-gauge line.' },
  { id:'sarail', name:'SARail', country:'Greece', countries:['Greece'], type:'trains', description:'Thessaloniki suburban railway services.' },
  { id:'metroankara', name:'Metro Ankara', country:'Turkey', countries:['Turkey'], type:'trains', description:'Ankara metro and suburban rail system.' },
  { id:'marmaray', name:'Marmaray', country:'Turkey', countries:['Turkey'], type:'trains', description:'Cross-Bosphorus suburban railway connecting the European and Asian sides of Istanbul.' },
  { id:'izban', name:'İZBAN', country:'Turkey', countries:['Turkey'], type:'trains', description:'Suburban rail system serving the İzmir metropolitan area.' },

  // ── Island railways / scenic ──
  { id:'isleofman', name:'Isle of Man Railway', country:'United Kingdom', countries:['United Kingdom'], type:'trains', description:'Heritage steam railway on the Isle of Man, operating since 1873.' },
  { id:'snowdon', name:'Snowdon Mountain Railway', country:'United Kingdom', countries:['United Kingdom'], type:'trains', description:'Rack-and-pinion mountain railway climbing Snowdon, the highest peak in Wales.' },
  { id:'ffestiniog', name:'Ffestiniog Railway', country:'United Kingdom', countries:['United Kingdom'], type:'trains', description:'Historic narrow-gauge railway through Snowdonia National Park in Wales.' },
  { id:'corris', name:'Corris Railway', country:'United Kingdom', countries:['United Kingdom'], type:'trains', description:'Restored narrow-gauge heritage railway in Mid-Wales.' },
  { id:'flam', name:'Flåm Railway', country:'Norway', countries:['Norway'], type:'trains', description:'One of the world\'s steepest standard-gauge railways, descending from Myrdal to Flåm through dramatic fjord scenery.' },
  { id:'rauma', name:'Rauma Line', country:'Norway', countries:['Norway'], type:'trains', description:'Scenic railway from Dombås to Åndalsnes, passing through the Romsdalen valley.' },
  { id:'inlandsbanan', name:'Inlandsbanan', country:'Sweden', countries:['Sweden'], type:'trains', description:'Scenic 1,300km railway through the Swedish interior from Kristinehamn to Gällivare.' },

  // ── Infrastructure / agency aliases ──
  { id:'avg', name:'Albtal-Verkehrs-Gesellschaft', country:'Germany', countries:['Germany'], type:'trains', description:'Regional transport operator in the Karlsruhe/Albtal region of Baden-Württemberg.' },
  { id:'hzl', name:'Hohenzollerische Landesbahn', country:'Germany', countries:['Germany'], type:'trains', description:'Regional railway in the Swabian Alb region of Baden-Württemberg.' },
  { id:'swu', name:'SWU Verkehr', country:'Germany', countries:['Germany'], type:'trains', description:'Public transport operator in Ulm/Neu-Ulm.' },
  { id:'transregio', name:'Trans Regio', country:'Germany', countries:['Germany'], type:'trains', description:'Regional train operator in Rhineland-Palatinate and North Rhine-Westphalia.' },
  { id:'fse', name:'Ferrovie del Sud Est', country:'Italy', countries:['Italy'], type:'trains', description:'Regional railway operator in Apulia, southeastern Italy.' },
  { id:'fer', name:'Ferrovie Emilia Romagna', country:'Italy', countries:['Italy'], type:'trains', description:'Regional railway operator in Emilia-Romagna.' },
  { id:'cotral', name:'Cotral', country:'Italy', countries:['Italy'], type:'trains', description:'Regional transport company serving the Lazio region around Rome.' },
  { id:'atac', name:'ATAC', country:'Italy', countries:['Italy'], type:'trains', description:'Rome public transport operator including metro and light rail.' },
  { id:'gtt', name:'GTT', country:'Italy', countries:['Italy'], type:'trains', description:'Turin public transport operator including metro and regional rail.' },
  { id:'amtgenova', name:'AMT Genova', country:'Italy', countries:['Italy'], type:'trains', description:'Genoa public transport operator.' },
  { id:'actv', name:'ACTV', country:'Italy', countries:['Italy'], type:'trains', description:'Venice public transport operator including water buses.' },
  { id:'dolomitibus', name:'Dolomiti Bus', country:'Italy', countries:['Italy'], type:'trains', description:'Regional public transport in the Dolomites region.' },
  { id:'ttr', name:'Trentino Trasporti', country:'Italy', countries:['Italy'], type:'trains', description:'Regional transport operator in Trentino.' },
  { id:'ratp', name:'RATP', country:'France', countries:['France'], type:'trains', description:'Paris public transport operator including metro, RER, tram and bus services.' },
  { id:'cfc', name:'Chemins de Fer de la Corse', country:'France', countries:['France'], type:'trains', description:'Scenic railway network across the island of Corsica.' },
  { id:'tmr', name:'Transports de Martigny et Régions', country:'Switzerland', countries:['Switzerland'], type:'trains', description:'Regional transport operator in Martigny and the surrounding Valais region.' },
  { id:'stlb', name:'Steiermärkische Landesbahnen', country:'Austria', countries:['Austria'], type:'trains', description:'Regional railway operator in Styria, Austria.' },
  { id:'cfm', name:'Calea Ferată din Moldova', country:'Moldova', countries:['Moldova'], type:'trains', description:'National railway operator of Moldova.' },
  { id:'uz', name:'Ukrzaliznytsia', country:'Ukraine', countries:['Ukraine'], type:'trains', description:'National railway operator of Ukraine.' },
  { id:'russianrailways', name:'Russian Railways', country:'Russia', countries:['Russia','Ukraine'], type:'trains', description:'National railway operator of Russia (RŽD).' },
  { id:'belarusianrailway', name:'Belarusian Railway', country:'Belarus', countries:['Belarus'], type:'trains', description:'National railway operator of Belarus.' },
  { id:'stather', name:'STASY', country:'Greece', countries:['Greece'], type:'trains', description:'Athens urban rail transport operator including the metro system.' },
  { id:'tfl', name:'Transport for London', country:'United Kingdom', countries:['United Kingdom'], type:'trains', description:'London transport authority operating the Underground, Overground, DLR, trams and Elizabeth line.' },
  { id:'nexus', name:'Nexus', country:'United Kingdom', countries:['United Kingdom'], type:'trains', description:'Tyne and Wear transport authority operating the Metro system around Newcastle.' },
  { id:'spt', name:'Strathclyde Partnership for Transport', country:'United Kingdom', countries:['United Kingdom'], type:'trains', description:'Transport authority for the Glasgow and Strathclyde region, operating the Subway.' },
  { id:'translink', name:'Translink', country:'United Kingdom', countries:['United Kingdom'], type:'trains', description:'Northern Ireland transport operator including NI Railways, Ulsterbus and Metro.' },
];

let addedCount = 0;
for (const newOp of newOperators) {
  if (operators.find(o => o.id === newOp.id)) continue;
  operators.push({
    ...newOp,
    website: newOp.website || '',
    appLinks: newOp.appLinks || {},
    logo: newOp.logo || '',
  });
  // Add to known operators map
  knownOperators.set(norm(newOp.name), newOp.id);
  knownOperators.set(norm(stripSuffixes(newOp.name)), newOp.id);
  addedCount++;
}
console.log(`  Added ${addedCount} new operators`);

// Add aliases for new operators too
for (const [alias, targetId] of Object.entries(MANUAL_ALIASES)) {
  if (!knownOperators.has(norm(alias))) {
    knownOperators.set(norm(alias), targetId);
  }
}

// ── Process All Stations ─────────────────────────────────────────────────────

console.log('Processing stations...');
let totalStations = 0;
let totalMatched = 0;
let totalUnmatched = 0;
let totalMissingOps = 0;
let stationsWithNewIds = 0;

const newMissingOps = [];

function matchOperator(opName) {
  if (!opName) return null;
  // Handle case where operator is already an object (from corrupted previous run)
  if (typeof opName === 'object' && opName !== null) {
    if (opName.id && typeof opName.id === 'string') return opName.id;
    if (opName.name && typeof opName.name === 'string') {
      // Try to match by name
      const n = norm(opName.name);
      if (knownOperators.has(n)) return knownOperators.get(n);
      return null;
    }
    return null;
  }
  if (typeof opName !== 'string') opName = String(opName);
  if (!opName.trim()) return null;
  
  // Try exact normalized match
  const n = norm(opName);
  if (knownOperators.has(n)) return knownOperators.get(n);
  
  // Try without suffixes
  const stripped = norm(stripSuffixes(opName));
  if (knownOperators.has(stripped)) return knownOperators.get(stripped);
  
  // Try partial matching - see if any known operator name is contained in the station operator
  for (const [knownName, knownId] of knownOperators) {
    if (n.includes(knownName) || knownName.includes(n)) {
      // Only match if both are more than 3 chars to avoid false positives
      if (knownName.length > 3 && n.length > 3) {
        return knownId;
      }
    }
  }
  
  return null;
}

for (const [countryName, countryData] of Object.entries(stationsJson.countries || {})) {
  const stations = countryData.stations || [];
  for (const station of stations) {
    totalStations++;
    
    // Skip limited use stations for operator linking
    if (station.limited_use) continue;
    
    // Generate clean ID from station name
    const newId = makeStationId(station.name, countryName);
    if (station.id !== newId) {
      station._oldId = station.id;
      station.id = newId;
      stationsWithNewIds++;
    }
    
    // Process operators
    const rawOps = station.operators || [];
    if (!rawOps.length) continue;
    
    const matchedOps = [];
    for (const opName of rawOps) {
      const match = matchOperator(opName);
      if (match) {
        if (!matchedOps.includes(match)) matchedOps.push(match);
      } else {
        totalUnmatched++;
        // Record new missing operator
        const displayName = (typeof opName === 'object' && opName !== null) ? (opName.name || opName.id || String(opName)) : opName;
        const n = norm(typeof opName === 'object' ? displayName : opName);
        const existing = newMissingOps.find(m => m.normalized === n);
        if (existing) {
          existing.count++;
          if (existing.samples.length < 5) existing.samples.push(station.name);
        } else {
          newMissingOps.push({
            name: String(displayName),
            normalized: n,
            country: countryName,
            count: 1,
            samples: [station.name]
          });
        }
      }
    }
    
    if (matchedOps.length > 0) {
      station.operators = matchedOps;
      totalMatched++;
    }
  }
}

// Sort unmatched operators by count
newMissingOps.sort((a, b) => b.count - a.count);

// ── Write Output ─────────────────────────────────────────────────────────────

console.log('\nWriting output files...');

// Update data.json
const outputData = { ...dataJson, operators };
writeFileSync(DATA_FILE, JSON.stringify(outputData, null, 2));
console.log('  ✓ data.json updated');

// Update stations.json
writeFileSync(STATIONS_FILE, JSON.stringify(stationsJson, null, 2));
console.log('  ✓ stations.json updated');

// Write new missing operators report
const newReport = {
  generatedAt: new Date().toISOString(),
  totalMissing: newMissingOps.length,
  operators: newMissingOps
};
writeFileSync('../missing-operators-report.json', JSON.stringify(newReport, null, 2));
console.log('  ✓ missing-operators-report.json updated');

// ── Summary ──────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════');
console.log('  HARMONIZATION COMPLETE');
console.log('═══════════════════════════════════════════');
console.log(`  Total stations:       ${totalStations.toLocaleString()}`);
console.log(`  Stations with new IDs: ${stationsWithNewIds.toLocaleString()}`);
console.log(`  Stations matched:     ${totalMatched.toLocaleString()}`);
console.log(`  Unmatched operators:  ${totalUnmatched.toLocaleString()}`);
console.log(`  New operators added:  ${addedCount}`);
console.log(`  Total operators now:  ${operators.length}`);
console.log(`  Remaining missing:    ${newMissingOps.length}`);
console.log(`  Manual aliases:       ${Object.keys(MANUAL_ALIASES).length}`);
console.log('═══════════════════════════════════════════');

if (newMissingOps.length > 0) {
  console.log('\nTop 20 remaining missing operators:');
  newMissingOps.slice(0, 20).forEach((m, i) => {
    console.log(`  ${i+1}. ${m.name} (${m.count} stations, ${m.country})`);
  });
}
