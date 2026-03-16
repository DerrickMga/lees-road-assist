$ErrorActionPreference = 'Stop'
$repo = 'C:\inetpub\wwwroot\lees-road-assist'
$web = Join-Path $repo 'web'
$log = Join-Path $repo 'backend\logs\web-build-iis.txt'

"=== Web IIS Build: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Out-File -FilePath $log -Encoding ASCII

if (Get-Service lra_web -ErrorAction SilentlyContinue) {
    "Stopping lra_web service..." | Out-File -FilePath $log -Append -Encoding ASCII
    Stop-Service lra_web -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

"Running npm run build..." | Out-File -FilePath $log -Append -Encoding ASCII
Push-Location $web
cmd /c "npm run build" | Out-File -FilePath $log -Append -Encoding ASCII
$exitCode = $LASTEXITCODE
Pop-Location

"Build exit code: $exitCode" | Out-File -FilePath $log -Append -Encoding ASCII

"Starting lra_web service..." | Out-File -FilePath $log -Append -Encoding ASCII
Start-Service lra_web -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Get-Service lra_web | Format-Table Name,Status,StartType -AutoSize | Out-String | Out-File -FilePath $log -Append -Encoding ASCII

if ($exitCode -ne 0) {
    throw "Web build failed with exit code $exitCode"
}

"DONE" | Out-File -FilePath $log -Append -Encoding ASCII
