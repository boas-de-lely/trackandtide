# Re-apply all intentional changes after git restore
$ErrorActionPreference = 'Stop'
$root = '\\LELYNAS\trackandtide'
$files = @('404.html','about.html','index.html','journey.html','operators.html','ports.html','stations.html')

foreach ($file in $files) {
  $path = Join-Path $root $file
  $content = Get-Content $path -Raw -Encoding UTF8
  
  # 1. Remove modal CSS block (from ".modal-overlay" or "/* ── Modal ── */" or "/* Modal */" through ".form-success.show" or ".report-form select option")
  $content = $content -replace '(?s)\s*/\*.*Modal.*\*/\s*\n.*?(\.modal-overlay\s*\{.*?)\.form-success\.show\s*\{[^}]*\}\s*',''
  # Also remove any leftover modal-related CSS lines
  $content = $content -replace '(?s)\s*\.report-form select option\s*\{[^}]*\}\s*',''
  $content = $content -replace '(?s)\s*\.form-error\s*\{[^}]*\}\s*',''
  $content = $content -replace '(?s)\s*\.report-hint\s*\{[^}]*\}\s*',''
  $content = $content -replace '(?s)\s*\.form-success\s*\.success-icon\s*\{[^}]*\}\s*',''
  
  Write-Host "Fixed CSS in $file"
}

Write-Host 'CSS removal done. Now handling modal HTML+JS removal...'
