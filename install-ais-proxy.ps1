# install-ais-proxy.ps1 — Run ONCE as Administrator
# Installs a Windows scheduled task that auto-starts the AIS proxy at login

$scriptDir = "\\LELYNAS\trackandtide"
$taskName = "TrackAndTide_AIS_Proxy"

# Remove old task if exists
schtasks /delete /tn $taskName /f 2>$null

# Create task: runs at login, keeps running, restarts if crashed
schtasks /create /tn $taskName /tr "node --experimental-websocket `"$scriptDir\ais-proxy.js`"" /sc onlogon /rl highest /f

Write-Host "Starting AIS proxy now..."
Start-Process -NoNewWindow node -ArgumentList "--experimental-websocket", "$scriptDir\ais-proxy.js"

Write-Host "AIS proxy installed! It will auto-start at every login."
Write-Host "Run 'schtasks /run /tn $taskName' to start it manually."
