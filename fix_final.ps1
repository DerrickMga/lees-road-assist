# Final fix - restore PG auth and restart services
# Run with: Start-Process powershell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File C:\inetpub\wwwroot\lees-road-assist\fix_final.ps1"

$ErrorActionPreference = "Continue"
$LraRoot = "C:\inetpub\wwwroot\lees-road-assist"
$PgData = "C:\Program Files\PostgreSQL\17\data"
$PgHba = Join-Path $PgData "pg_hba.conf"
$Nssm = "C:\ProgramData\chocolatey\bin\nssm.exe"

# Log
$logFile = Join-Path $LraRoot "backend\logs\fix-final.log"
Start-Transcript -Path $logFile -Force

# 1. Restore secure PG auth
Write-Host "[1] Restoring secure PostgreSQL authentication..."
$secureConf = "# PostgreSQL Client Authentication for LRA`r`nhost all all 127.0.0.1/32 scram-sha-256`r`nhost all all ::1/128 scram-sha-256`r`n"
[System.IO.File]::WriteAllText($PgHba, $secureConf, [System.Text.Encoding]::ASCII)
Write-Host "  pg_hba.conf updated to scram-sha-256"

# 2. Restart PostgreSQL
Write-Host "[2] Restarting PostgreSQL..."
Restart-Service postgresql-x64-17 -Force
Start-Sleep -Seconds 5
$pgStatus = (Get-Service postgresql-x64-17).Status
Write-Host "  PostgreSQL: $pgStatus"

# 3. Kill the stuck fix_deploy process
Get-Process -Id 18016 -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# 4. Restart services
Write-Host "[3] Restarting application services..."
foreach ($svc in @("lra_backend", "lra_nginx")) {
    Write-Host "  Restarting $svc..."
    & $Nssm restart $svc 2>&1 | Out-Null
    Start-Sleep -Seconds 3
}

# 5. Check all services
Write-Host "`n=== Service Status ==="
foreach ($svc in @("postgresql-x64-17", "lra_redis", "lra_backend", "lra_celery", "lra_whatsapp", "lra_web", "lra_nginx")) {
    $s = Get-Service $svc -ErrorAction SilentlyContinue
    $mark = if ($s.Status -eq "Running") { "[OK]" } else { "[!!]" }
    Write-Host "  $mark $svc = $($s.Status)"
}

# 6. Test endpoints
Write-Host "`n=== Endpoint Tests ==="
Start-Sleep -Seconds 5
try { $r = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -UseBasicParsing -TimeoutSec 5; Write-Host "  Backend: $($r.StatusCode) $($r.Content)" } catch { Write-Host "  Backend: $($_.Exception.Message)" }
try { $r = Invoke-WebRequest -Uri "http://127.0.0.1:3000" -UseBasicParsing -TimeoutSec 5; Write-Host "  Web: $($r.StatusCode)" } catch { Write-Host "  Web: $($_.Exception.Message)" }
try { $r = Invoke-WebRequest -Uri "https://127.0.0.1" -UseBasicParsing -TimeoutSec 5 -SkipCertificateCheck; Write-Host "  Nginx HTTPS: $($r.StatusCode)" } catch { Write-Host "  Nginx HTTPS: $($_.Exception.Message)" }

# Write completion marker
"DONE $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File "$LraRoot\backend\logs\fix-final-status.txt" -Encoding ASCII
Write-Host "`n=== DONE ==="
Stop-Transcript
