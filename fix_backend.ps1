# Fix backend service - kill orphan process and restart via nssm
# Run: Start-Process powershell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File C:\inetpub\wwwroot\lees-road-assist\fix_backend.ps1"

$Nssm = "C:\ProgramData\chocolatey\bin\nssm.exe"

# Kill the orphan python process on port 8000
$pid8000 = (netstat -ano | Select-String ":8000.*LISTENING" | ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -First 1)
if ($pid8000) {
    Write-Host "Killing orphan process PID $pid8000 on port 8000..."
    Stop-Process -Id $pid8000 -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Restart the backend service
Write-Host "Restarting lra_backend service..."
& $Nssm restart lra_backend 2>&1
Start-Sleep -Seconds 5

$status = (Get-Service lra_backend).Status
Write-Host "lra_backend: $status"

"BACKEND_FIXED $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File "C:\inetpub\wwwroot\lees-road-assist\backend\logs\backend-fix-status.txt" -Encoding ASCII
