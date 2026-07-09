# Track & Tide - Batch Country Updater with Hard Timeout
$py = "C:/Users/Boas de Lely/AppData/Local/Programs/Python/Python311/python.exe"
$script = "\\LELYNAS\trackandtide\scripts\update-country.py"
$timeout = 120  # seconds per country

$countries = @(
    'Czechia','Estonia','Finland','France','Germany','Greece','Hungary',
    'Iceland','Ireland','Italy','Kosovo','Latvia','Liechtenstein','Lithuania',
    'Luxembourg','Malta','Moldova','Monaco','Montenegro','Netherlands',
    'North Macedonia','Norway','Poland','Portugal','Romania','San Marino',
    'Serbia','Slovakia','Slovenia','Spain','Sweden','Switzerland','Turkey',
    'Ukraine','United Kingdom','Vatican City'
)

$total = $countries.Count
$i = 0
$success = 0
$failed = 0

foreach ($c in $countries) {
    $i++
    Write-Host "=== [$i/$total] $c ==="
    
    $job = Start-Job -ScriptBlock {
        param($py, $script, $c)
        & $py -u $script $c 2>&1
    } -ArgumentList $py, $script, $c
    
    $completed = Wait-Job $job -Timeout $timeout
    
    if ($completed) {
        $output = Receive-Job $job
        $output | ForEach-Object { Write-Host $_ }
        if ($output -match "FAILED") {
            $failed++
            Write-Host "  FAILED for $c (keeping original data)"
        } else {
            $success++
        }
    } else {
        Stop-Job $job
        Write-Host "  TIMEOUT after ${timeout}s for $c (keeping original data)"
        $failed++
    }
    
    Remove-Job $job -Force
    Write-Host ""
    Start-Sleep -Seconds 5
}

Write-Host "`n═════════════════════════════"
Write-Host "Batch complete!"
Write-Host "Successful: $success"
Write-Host "Failed/Timeout: $failed"
Write-Host "═════════════════════════════"
