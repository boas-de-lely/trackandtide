# PowerShell harmonization script for operators
$ErrorActionPreference = "Stop"

function Normalize-Name($name) {
    if (-not $name) { return "" }
    $n = $name.Normalize([System.Text.NormalizationForm]::FormKD)
    $n = [System.Text.RegularExpressions.Regex]::Replace($n, '\p{M}', '')
    $n = $n.ToLowerInvariant()
    $n = $n -replace '\b(nv|sa|ag|as|spa|srl|ltd|limited|gmbh|bv|plc|inc|llc|ab|ev|se|ug|co kg|mbh|oy|akciova spolecnost)\b', ''
    $n = $n -replace '&', 'and'
    $n = $n -replace '[^a-z0-9 ]+', ' '
    $n = $n -replace '\s+', ' '
    return $n.Trim()
}

$aliases = @{}

$manualMap = @{
    "nederlandse spoorwegen" = "NS"
    "zwitserse federale spoorwegen" = "SBB"
    "magyar allamvasutak" = "MAV"
    "osterreichische bundesbahnen" = "OBB"
    "danske statsbaner" = "DSB"
    "ceske drahy" = "CD"
    "deutsche bahn" = "DB"; "deutsche bahn ag" = "DB"
    "db fernverkehr" = "DB"; "db fernverkehr ag" = "DB"
    "db regio" = "DB"; "db regio ag" = "DB"; "db regio schleswig holstein" = "DB"
    "db netz" = "DB"; "db netz ag" = "DB"
    "db station service" = "DB"; "db stationandservice" = "DB"
    "db stationandservice ag" = "DB"; "db station service ag" = "DB"
    "db infrago" = "DB"; "db infrago ag" = "DB"
    "nmbs" = "NMBS/SNCB"; "sncb" = "NMBS/SNCB"; "nmbs sncb" = "NMBS/SNCB"
    "schweizerische bundesbahnen" = "SBB"; "sbb cff ffs" = "SBB"
    "oebb" = "OBB"; "oebb infrastruktur" = "OBB"; "oebb infrastruktur ag" = "OBB"
    "societe nationale des chemins de fer francais" = "SNCF"
    "pkp polskie linie kolejowe" = "PKP Intercity"
    "polskie koleje panstwowe" = "PKP Intercity"
    "polskie linie kolejowe" = "PKP Intercity"
    "cfr" = "CFR Calatori"
    "hrvatske zeleznice" = "HZPP"; "hz infrastruktura" = "HZPP"
    "ferrovienord" = "Trenord"
    "bulgarian state railways" = "BDZ"
    "national railway infrastructure company" = "BDZ"
    "oresundstag" = "Oresundstag"; "oresundstag ab" = "Oresundstag"
    "european sleeper" = "European sleeper"
    "caledonian sleeper" = "Caledonian Sleeper"
    "keolis nederland" = "Keolis/RRReis"
    "renfe operadora" = "Renfe"; "renfe viajeros" = "Renfe"
    "administrador de infraestructuras ferroviarias" = "Renfe"
    "red nacional de los ferrocarriles espanoles" = "Renfe"
    "mav magyar allamvasutak" = "MAV"; "mav start" = "MAV"
    "mav infrastructure co ltd" = "MAV"
    "flixtrain" = "FlixTrain"; "flix train" = "FlixTrain"
    "trenitalia spa" = "Trenitalia"
    "ferrovie dello stato italiane" = "Trenitalia"
    "rete ferroviaria italiana" = "Trenitalia"; "rfi" = "Trenitalia"
    "fondazione fs italiane" = "Trenitalia"; "centostazioni" = "Trenitalia"
    "nuovo trasporto viaggiatori" = "Italo"
    "trainose" = "Hellenic Train"
    "westbahn gmbh" = "Westbahn"; "westbahn management gmbh" = "Westbahn"
    "arriva nederland" = "Arriva"
    "arriva personenvervoer nederland" = "Arriva"
    "eurostar international" = "Eurostar"
    "qbuzz nederland" = "Qbuzz"
    "scotrail" = "ScotRail"; "scotrail abellio" = "ScotRail"
    "abellio scotrail" = "ScotRail"; "glasgow" = "ScotRail"
    "northern rail" = "Northern"; "northern trains" = "Northern"
    "arriva rail north" = "Northern"
    "southern railway" = "GTR"; "gatwick express" = "GTR"
    "thameslink" = "GTR"; "great northern" = "GTR"
    "merseyrail" = "National Rail"; "c2c" = "National Rail"
    "london overground" = "National Rail"; "tfl rail" = "National Rail"
    "elizabeth line" = "National Rail"
    "west midlands trains" = "West Midlands Trains"
    "west midlands railway" = "West Midlands Trains"
    "london northwestern" = "West Midlands Trains"
    "london midland" = "West Midlands Trains"
    "east midlands trains" = "East Midlands Railway"
    "ni railways" = "NI Railways"; "northern ireland railways" = "NI Railways"
    "translink" = "NI Railways"
    "transport for wales" = "Transport for Wales"
    "transport for wales rail" = "Transport for Wales"
    "keolisamey wales" = "Transport for Wales"
    "virgin trains" = "Avanti West Coast"
    "transport for london" = "National Rail"
    "island line trains" = "South Western Railway"
    "network rail" = "Network Rail"
    "network rail infrastructure ltd" = "Network Rail"
    "adif" = "Renfe"
    "infraestruturas de portugal" = "CP"
    "sprava zeleznic" = "Ceske drahy"; "cz szdc" = "Ceske drahy"
    "slovenske zeleznice" = "Slovenian Railways"
    "hekurudha shqiptare" = "hsh (Albanian Railways)"
    "serbian railways infrastructure" = "Srbija Voz"
    "serbian railways" = "Srbija Voz"; "srbijavoz" = "Srbija Voz"
    "kosovo railways" = "Trainkos"
    "latvian railways" = "Vivi"
    "lietuvos gelezinkeliai" = "LTG Link"; "ltg infra" = "LTG Link"
    "elektriraudtee" = "Elron"
    "ukrzaliznytsia" = "Ukrzaliznytsia"
    "ukrainian railway" = "Ukrzaliznytsia"
    "ukrainian railways" = "Ukrzaliznytsia"
    "cisdnieper railways" = "Ukrzaliznytsia"
    "bane nor" = "Vy"
    "swedish transport administration" = "SJ"
    "ratp" = "RATP"; "regie autonome des transports parisiens" = "RATP"
    "cfc" = "Chemins de Fer de la Corse"
    "chemins de fer de la corse" = "Chemins de Fer de la Corse"
    "lokaltog" = "Lokaltog"
    "raaberbahn" = "Raaberbahn"; "gysev" = "Raaberbahn"
    "fse" = "Ferrovie del Sud Est"
    "ferrovie del sud est" = "Ferrovie del Sud Est"
    "avag" = "Albtal-Verkehrs-Gesellschaft mbH"
    "albtal verkehrs gesellschaft" = "Albtal-Verkehrs-Gesellschaft mbH"
    "tpc" = "Transports Publics du Chablais"
    "transports publics du chablais" = "Transports Publics du Chablais"
    "appenzeller bahnen" = "Appenzeller Bahnen"
    "montreux berner oberland bahn" = "Montreux-Berner Oberland-Bahn"
    "mob" = "Montreux-Berner Oberland-Bahn"
    "ctl" = "Compagnia Trasporti Laziali"
    "cotral" = "Compagnia Trasporti Laziali"
    "compagnia trasporti laziali" = "Compagnia Trasporti Laziali"
    "aare seeland mobil" = "Aare Seeland mobil"; "asm" = "Aare Seeland mobil"
    "cj" = "Chemins de fer du Jura"
    "chemins de fer du jura" = "Chemins de fer du Jura"
    "schweizerische sudostbahn" = "Schweizerische Sudostbahn"
    "sob" = "Schweizerische Sudostbahn"
    "nordjyske jernbaner" = "Nordjyske Jernbaner"
    "nj" = "Nordjyske Jernbaner"
    "euskotren trena" = "Euskotren"; "euskotren" = "Euskotren"
    "crimea railway" = "Crimea Railway"
    "zrs" = "Zeljeznice Republike Srpske"
    "zeleznice republike srpske" = "Zeljeznice Republike Srpske"
    "zfbh" = "ZFBiH"; "zpcg" = "ZPCG"
    "erixx" = "DB"; "sudostbayernbahn" = "DB"
    "westfrankenbahn" = "DB"; "kurhessenbahn" = "DB"
    "treni regionali ticino lombardia" = "TILO"
    "societa unica abruzzese di trasporto" = "Trenitalia"
    "finnish transport infrastructure agency" = "VR"
    "vaylavirasto" = "VR"
    # Switzerland new operators
    "regionalverkehr bern solothurn" = "Regionalverkehr Bern-Solothurn"
    "transports publics fribourgeois" = "Transports publics Fribourgeois"
    "sihltal zurich uetliberg bahn" = "SZU (Sihltal Zurich Uetliberg Bahn)"
    "travys" = "TRAVYS"
    "transports publics neuchatelois" = "transN (Transports Publics Neuchatelois)"
    "transports de la region morges biere cossonay" = "MBC (Transports Morges-Biere-Cossonay)"
    "bdwm transport" = "Aargau Verkehr (AVA/BDWM)"
    "forchbahn" = "Forchbahn"; "forchbahn ag" = "Forchbahn"
    "frauenfeld wil bahn" = "Frauenfeld-Wil-Bahn"
    "frauenfeld wil bahn ag" = "Frauenfeld-Wil-Bahn"
    "spoorlijn vevey chamby" = "TPC (Vevey-Chamby)"
    "ferrovie luganesi" = "Ferrovie Luganesi (FLP)"
    "baselland transport" = "Baselland Transport (BLT)"
    "rigi bahnen" = "Rigi Bahnen"; "rigi bahnen ag" = "Rigi Bahnen"
    "jungfraubahn holding" = "Jungfraubahn"
    "jungfraubahn" = "Jungfraubahn"
    "berner oberland bahnen" = "Berner Oberland-Bahnen (BOB)"
    "berner oberland bahnen ag" = "Berner Oberland-Bahnen (BOB)"
    "emmentalbahn" = "Emmentalbahn (ETB)"
    "regional bus and rail company of canton ticino" = "FART (Ferrovie Autolinee Regionali Ticinesi)"
    "wynental en suhrentalbahn" = "WSB (Wynental- und Suhrentalbahn)"
    "wynental und suhrentalbahn" = "WSB (Wynental- und Suhrentalbahn)"
    "spoorlijn lausanne bercher" = "LEB (Lausanne-Echallens-Bercher)"
    "spoorlijn nyon morez" = "NStCM (Nyon-St-Cergue-Morez)"
    "transports de martigny et regions" = "Transports de Martigny et Regions"
    "trn" = "transN (Transports Publics Neuchatelois)"
    # Germany
    "eisenbahnen und verkehrsbetriebe elbe weser" = "EVB (Elbe-Weser)"
    "metronom eisenbahngesellschaft" = "metronom Eisenbahngesellschaft"
    "harzer schmalspurbahnen" = "Harzer Schmalspurbahnen (HSB)"
    "akn eisenbahn" = "AKN Eisenbahn"
    "usedomer baderbahn" = "Usedomer Baderbahn (UBB)"
    "bleckeder kleinbahn" = "Bleckeder Kleinbahn"
    "bleckeder kleinbahn ug" = "Bleckeder Kleinbahn"
    "kahlgrund verkehrs gesellschaft" = "KVG (Kahlgrund-Verkehrs-Gesellschaft)"
    "kahlgrund verkehrs gesellschaft mbh" = "KVG (Kahlgrund-Verkehrs-Gesellschaft)"
    "regio infra nord ost" = "Regio Infra Nord-Ost"
    "saxon steam railway company" = "Saxon Steam Railway (SDG)"
    "sweg schienenwege" = "SWEG"; "sweg schienenwege gmbh" = "SWEG"
    # Italy
    "ferrovie della calabria" = "Ferrovie della Calabria"
    "ferrovie appulo lucane" = "Ferrovie Appulo Lucane (FAL)"
    "ferrovie emilia romagna" = "Ferrovie Emilia Romagna (FER)"
    "ente autonomo volturno" = "Ente Autonomo Volturno (EAV)"
    "eav" = "Ente Autonomo Volturno (EAV)"
    "anm" = "Ente Autonomo Volturno (EAV)"
    "ferrovie del gargano" = "Ferrovie del Gargano"
    "ferrotramviaria" = "Ferrotramviaria"
    "ferrovia circumetnea" = "Ferrovia Circumetnea"
    "ferrovia suzzara ferrara" = "Ferrovia Suzzara-Ferrara (FSF)"
    "sistemi territoriali" = "Sistemi Territoriali"
    "trasporto ferroviario toscano" = "Trasporto Ferroviario Toscano (TFT)"
    "gruppo torinese trasporti" = "Gruppo Torinese Trasporti (GTT)"
    "sad nahverkehr" = "SAD Nahverkehr"
    "arenaways" = "Arenaways"
    "amt genova" = "AMT Genova"; "amt" = "AMT Genova"
    "societe regionale de transport sarde" = "ARST Sardegna"
    "astral" = "ASTRAL (Roma Nord)"
    # Austria
    "novog" = "NOVOG"
    "zillertaler verkehrsbetriebe" = "Zillertalbahn"
    "stb" = "Steiermarkische Landesbahnen (StLB)"
    "stlb" = "Steiermarkische Landesbahnen (StLB)"
    "sth" = "Stern and Hafferl"
    # Denmark
    "midtjyske jernbaner" = "Midtjyske Jernbaner"
    "gocollective" = "GoCollective"; "gocollective a s" = "GoCollective"
    # Poland
    "warszawska kolej dojazdowa" = "Warszawska Kolej Dojazdowa (WKD)"
    "szybka kolej miejska" = "SKM (Szybka Kolej Miejska)"
    # Romania
    "regiotrans" = "Regiotrans"
    "transferoviar calatori" = "Transferoviar Calatori"
    "rc cf trans" = "RC-CF Trans"
    "transferoviar infrastructura neinteroperabila" = "Transferoviar Infrastructura"
    # UK
    "west somerset railway" = "West Somerset Railway"
    "west somerset railway plc" = "West Somerset Railway"
    "ffestiniog railway" = "Ffestiniog Railway"
    "severn valley railway" = "Severn Valley Railway"
    "east lancashire railway" = "East Lancashire Railway"
    "ravenglass and eskdale railway" = "Ravenglass and Eskdale Railway"
    # France
    "compagnie du mont blanc" = "Compagnie du Mont-Blanc"
    "chemin de fer des chanteraines" = "Chemin de Fer des Chanteraines"
    # Bulgaria
    "compagnie des chemins de fer orientaux" = "BDZ"
    # UK historical
    "dumbarton and helensburgh railway" = "ScotRail"
    "paisley and greenock railway" = "ScotRail"
    "scottish north eastern railway" = "ScotRail"
    "dundee and arbroath railway" = "ScotRail"
    "callander and oban railway" = "ScotRail"
    "mallaig extension railway" = "ScotRail"
    "sutherland and caithness railway" = "ScotRail"
    "dingwall and skye railway" = "ScotRail"
    "kilmarnock and ayr railway" = "ScotRail"
    "dumfries and carlisle railway" = "ScotRail"
    "paisley" = "ScotRail"
    "first trans pennine express" = "TransPennine Express"
    "first great western" = "Great Western Railway"
    "new southern railway" = "GTR"
    # More regional/historical operators
    "metro van valencia" = "Renfe"
    "ferrocarrils de la generalitat de catalunya" = "Renfe"
    "ferrocarrils de la generalitat valenciana" = "Renfe"
    "eusko trenbideak ferrocarriles vascos" = "Euskotren"
    "eusko trenbideak and ferrocarriles vascos" = "Euskotren"
    "agenzia dei trasporti autoferrotranviari del comune di roma" = "Trenitalia"
    "minimetro" = "Minimetro Perugia"
    "minimetro s p a" = "Minimetro Perugia"
    "pkp cargo international" = "PKP Intercity"
    "thuringer eisenbahn" = "DB"
    "go ahead norge" = "Vy"
    "rhein neckar verkehr" = "DB"
    "azienda trasporti bergamo" = "Trenord"
    "gornergrat railway" = "Matterhorn Gotthard Bahn"
    "brohltal eisenbahn" = "Brohltal-Eisenbahn"
    "meiringen innertkirchen bahn" = "Zentralbahn"
    "trafikverket" = "SJ"
    "jernhusen" = "SJ"
    "delmenhorst harpstedter eisenbahn" = "Delmenhorst-Harpstedter Eisenbahn"
    "regio calatori" = "CFR Calatori"
    "euregio verkehrsschienennetz" = "DB"
}

foreach ($key in $manualMap.Keys) {
    $norm = Normalize-Name $key
    if ($norm) { $aliases[$norm] = $manualMap[$key] }
}

Write-Host "Loading data.json..."
$dataJson = Get-Content -Raw -Encoding UTF8 "data.json" | ConvertFrom-Json

foreach ($op in $dataJson.operators) {
    if ($op.type -ne "trains") { continue }
    $normName = Normalize-Name $op.name
    $normId = Normalize-Name $op.id
    if ($normName -and -not $aliases.ContainsKey($normName)) { $aliases[$normName] = $op.name }
    if ($normId -and $normId -ne $normName -and -not $aliases.ContainsKey($normId)) { $aliases[$normId] = $op.name }
}

Write-Host "Built $($aliases.Count) lookup entries; $($dataJson.operators.Count) operators in data.json"

# Resolve all alias values to actual data.json operator display names
$opNameLookup = @{}
foreach ($op in $dataJson.operators) {
    if ($op.type -ne "trains") { continue }
    $n = Normalize-Name $op.name; if ($n) { $opNameLookup[$n] = $op.name }
    $n = Normalize-Name $op.id; if ($n) { $opNameLookup[$n] = $op.name }
}
$resolved = 0
$newAliases = @{}
foreach ($key in $aliases.Keys) {
    $val = $aliases[$key]
    $normVal = Normalize-Name $val
    if ($opNameLookup.ContainsKey($normVal)) {
        $newAliases[$key] = $opNameLookup[$normVal]
        $resolved++
    } else {
        $newAliases[$key] = $val
    }
}
$aliases = $newAliases
Write-Host "Resolved $resolved alias values to data.json display names"

Write-Host "Loading stations.json..."
$stationsJson = Get-Content -Raw -Encoding UTF8 "stations.json" | ConvertFrom-Json

$totalStations = 0; $totalLimitedSkipped = 0; $totalReplacements = 0
$missing = @{}

foreach ($countryKey in $stationsJson.countries.PSObject.Properties.Name) {
    $country = $stationsJson.countries.$countryKey
    if (-not $country.stations) { continue }
    for ($i = 0; $i -lt $country.stations.Count; $i++) {
        $station = $country.stations[$i]; $totalStations++
        if ($station.usage -eq "limited_use") {
            $totalLimitedSkipped++; $station.operators = @(); continue
        }
        $syncedOps = [System.Collections.ArrayList]@()
        $ops = $station.operators
        if (-not $ops -or $ops.Count -eq 0) { continue }
        foreach ($opName in $ops) {
            $norm = Normalize-Name $opName
            if (-not $norm -or $norm -match '^q\d+$') { continue }
            $matched = $null
            if ($aliases.ContainsKey($norm)) { $matched = $aliases[$norm] }
            if (-not $matched) {
                foreach ($knownNorm in $aliases.Keys) {
                    $a = $knownNorm -split '\s+'; $b = $norm -split '\s+'
                    $shorter = if ($a.Count -le $b.Count) { $a } else { $b }
                    $longer = if ($a.Count -gt $b.Count) { $a } else { $b }
                    $ok = $true
                    foreach ($w in $shorter) { if ($w -notin $longer) { $ok = $false; break } }
                    if ($ok -and $shorter.Count -ge 1) { $matched = $aliases[$knownNorm]; break }
                }
            }
            if ($matched) {
                if ($matched -notin $syncedOps) { [void]$syncedOps.Add($matched); $totalReplacements++ }
            } else {
                if ($opName -notin $syncedOps) { [void]$syncedOps.Add($opName) }
                if (-not $missing.ContainsKey($opName)) {
                    $missing[$opName] = @{ name = $opName; normalized = $norm; countries = @{}; stationCount = 0; sampleStations = [System.Collections.ArrayList]@() }
                }
                $e = $missing[$opName]; $e.countries[$country.country] = $true; $e.stationCount++
                if ($e.sampleStations.Count -lt 5) { [void]$e.sampleStations.Add(@{ name = $station.name; country = $country.country; source = $station.source; url = $station.url }) }
            }
        }
        $station.operators = @($syncedOps)
    }
}

Write-Host "Writing stations.json..."
$out = $stationsJson | ConvertTo-Json -Depth 100
[System.IO.File]::WriteAllText((Resolve-Path "stations.json"), $out, [System.Text.UTF8Encoding]::new($false))
Write-Host "Done: $totalStations stations ($totalLimitedSkipped limited-use skipped), $totalReplacements links"

$ml = @()
foreach ($e in $missing.Values) {
    $ml += [PSCustomObject]@{ name = $e.name; normalized = $e.normalized; countries = @($e.countries.Keys | Sort-Object); stationCount = $e.stationCount; sampleStations = @($e.sampleStations) }
}
$ml = $ml | Sort-Object -Property stationCount -Descending

$mr = [PSCustomObject]@{ generatedAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"); totalMissing = $ml.Count; operators = @($ml) }
$mout = $mr | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText((Resolve-Path "missing-operators-report.json"), $mout, [System.Text.UTF8Encoding]::new($false))
Write-Host "Missing operators report: $($ml.Count) remaining"

Write-Host "`nOPERATORS: $($dataJson.operators.Count) | STATIONS: $totalStations | SKIPPED: $totalLimitedSkipped | LINKS: $totalReplacements | MISSING: $($ml.Count)"
