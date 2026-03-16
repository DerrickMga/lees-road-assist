# Lee's Road Assist - Fix Deployment Issues
# Run with: Start-Process powershell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File C:\inetpub\wwwroot\lees-road-assist\fix_deploy.ps1"

$ErrorActionPreference = "Continue"
$LraRoot = "C:\inetpub\wwwroot\lees-road-assist"
$PgBin = "C:\Program Files\PostgreSQL\17\bin"
$PgData = "C:\Program Files\PostgreSQL\17\data"
$NginxDir = "C:\nginx"
$DbName = "lees_road_assist"
$DbUser = "lra_user"
$DbPass = "RsrExuyDH_l_xzIFeoLn78M7oneXP5WhNij0FpNXOy4"
$venvPython = Join-Path $LraRoot ".venv\Scripts\python.exe"

$logFile = Join-Path $LraRoot "backend\logs\fix-deploy.log"
Start-Transcript -Path $logFile -Force

Write-Host "`n=== LRA Deployment Fix ===" -ForegroundColor Cyan

# ── Fix 1: PostgreSQL ────────────────────────────────────────────────────
Write-Host "`n[1/4] Fixing PostgreSQL..." -ForegroundColor Yellow

$pgHba = Join-Path $PgData "pg_hba.conf"
$pgService = Get-Service postgresql-x64-17 -ErrorAction SilentlyContinue

# Write pg_hba.conf with ASCII encoding (no BOM) for trust auth
$trustConf = "# Temporary trust config for LRA setup`r`nhost all all 127.0.0.1/32 trust`r`nhost all all ::1/128 trust`r`n"
[System.IO.File]::WriteAllText($pgHba, $trustConf, [System.Text.Encoding]::ASCII)
Write-Host "  pg_hba.conf written (ASCII, trust auth)"

# Start PG
Stop-Service postgresql-x64-17 -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-Service postgresql-x64-17
Start-Sleep -Seconds 5

# Verify PG is listening
$pgRunning = netstat -ano | Select-String ":5432.*LISTENING"
if ($pgRunning) {
    Write-Host "  PostgreSQL is running on port 5432" -ForegroundColor Green
} else {
    Write-Host "  ERROR: PostgreSQL not listening!" -ForegroundColor Red
    # Check PG log
    $pgLog = Get-ChildItem "$PgData\log" -Filter "*.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($pgLog) { Get-Content $pgLog.FullName -Tail 20 }
    Stop-Transcript
    exit 1
}

# Create user and database
Write-Host "  Creating database user and database..."
& "$PgBin\psql.exe" -U postgres -h 127.0.0.1 -c "DO `$`$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$DbUser') THEN CREATE ROLE $DbUser WITH LOGIN PASSWORD '$DbPass'; END IF; END `$`$;" 2>&1
& "$PgBin\psql.exe" -U postgres -h 127.0.0.1 -c "ALTER ROLE $DbUser WITH LOGIN PASSWORD '$DbPass' CREATEDB;" 2>&1

$dbExists = & "$PgBin\psql.exe" -U postgres -h 127.0.0.1 -tAc "SELECT 1 FROM pg_database WHERE datname='$DbName'" 2>&1
if ($dbExists -notmatch "1") {
    & "$PgBin\psql.exe" -U postgres -h 127.0.0.1 -c "CREATE DATABASE $DbName OWNER $DbUser;" 2>&1
    Write-Host "  Database created." -ForegroundColor Green
} else {
    Write-Host "  Database already exists." -ForegroundColor Green
}
& "$PgBin\psql.exe" -U postgres -h 127.0.0.1 -c "GRANT ALL PRIVILEGES ON DATABASE $DbName TO $DbUser;" 2>&1

# Now restore secure auth
Write-Host "  Restoring scram-sha-256 authentication..."
$secureConf = "# PostgreSQL Client Authentication for LRA`r`nhost all all 127.0.0.1/32 scram-sha-256`r`nhost all all ::1/128 scram-sha-256`r`n"
[System.IO.File]::WriteAllText($pgHba, $secureConf, [System.Text.Encoding]::ASCII)

Restart-Service postgresql-x64-17
Start-Sleep -Seconds 5

# Verify with password
$env:PGPASSWORD = $DbPass
$result = & "$PgBin\psql.exe" -U $DbUser -h 127.0.0.1 -d $DbName -tAc "SELECT 'DB_OK';" 2>&1
if ($result -match "DB_OK") {
    Write-Host "  PostgreSQL verified with password auth!" -ForegroundColor Green
} else {
    Write-Host "  WARNING: DB verification: $result" -ForegroundColor Red
}

# ── Fix 2: Alembic Migrations ────────────────────────────────────────────
Write-Host "`n[2/4] Running database migrations..." -ForegroundColor Yellow

$backendDir = Join-Path $LraRoot "backend"
Push-Location $backendDir
$env:DATABASE_URL = "postgresql+asyncpg://${DbUser}:${DbPass}@127.0.0.1:5432/${DbName}"
$env:APP_ENV = "production"

& $venvPython -m alembic upgrade head 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Existing migration failed - trying to create tables directly..." -ForegroundColor Yellow
    & $venvPython -c "
import asyncio
from app.core.database import engine
from app.models import Base

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('Tables created via SQLAlchemy')

asyncio.run(create_tables())
" 2>&1
}
Pop-Location

# ── Fix 3: Nginx SSL Certs ───────────────────────────────────────────────
Write-Host "`n[3/4] Fixing Nginx SSL certificates..." -ForegroundColor Yellow

# The nginx config uses relative paths: ssl/fullchain.pem -> resolves to C:\nginx\conf\ssl\
$nginxSslDir = "$NginxDir\conf\ssl"
New-Item -ItemType Directory -Path $nginxSslDir -Force | Out-Null
Copy-Item "$LraRoot\nginx\ssl\fullchain.pem" "$nginxSslDir\fullchain.pem" -Force
Copy-Item "$LraRoot\nginx\ssl\privkey.pem" "$nginxSslDir\privkey.pem" -Force
Write-Host "  SSL certs copied to $nginxSslDir" -ForegroundColor Green

# Test nginx config
$nginxTest = & "$NginxDir\nginx.exe" -t -c "$NginxDir\conf\nginx.conf" 2>&1
Write-Host "  Nginx config test: $nginxTest"

# ── Fix 4: Restart Services ──────────────────────────────────────────────
Write-Host "`n[4/4] Restarting services..." -ForegroundColor Yellow

$Nssm = "C:\ProgramData\chocolatey\bin\nssm.exe"

# Restart backend
Write-Host "  Restarting lra_backend..."
& $Nssm restart lra_backend 2>&1 | Out-Null
Start-Sleep -Seconds 3

# Restart nginx
Write-Host "  Restarting lra_nginx..."
& $Nssm restart lra_nginx 2>&1 | Out-Null
Start-Sleep -Seconds 3

# Check all services
Write-Host "`n=== Service Status ===" -ForegroundColor Cyan
$allServices = @("postgresql-x64-17", "lra_redis", "lra_backend", "lra_celery", "lra_whatsapp", "lra_web", "lra_nginx")
foreach ($svc in $allServices) {
    $s = Get-Service $svc -ErrorAction SilentlyContinue
    if ($s.Status -eq "Running") {
        Write-Host "  [OK]   $svc" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] $svc ($($s.Status))" -ForegroundColor Red
    }
}

# Test endpoints
Write-Host "`n=== Endpoint Tests ===" -ForegroundColor Cyan
Start-Sleep -Seconds 3

try { $r = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -UseBasicParsing -TimeoutSec 5; Write-Host "  Backend :8000 -> $($r.StatusCode) $($r.Content)" -ForegroundColor Green } catch { Write-Host "  Backend :8000 -> FAIL: $($_.Exception.Message)" -ForegroundColor Red }
try { $r = Invoke-WebRequest -Uri "http://127.0.0.1:3000" -UseBasicParsing -TimeoutSec 5; Write-Host "  Web     :3000 -> $($r.StatusCode)" -ForegroundColor Green } catch { Write-Host "  Web     :3000 -> FAIL: $($_.Exception.Message)" -ForegroundColor Red }
try { $r = Invoke-WebRequest -Uri "http://127.0.0.1:80" -UseBasicParsing -TimeoutSec 5; Write-Host "  Nginx   :80   -> $($r.StatusCode)" -ForegroundColor Green } catch { Write-Host "  Nginx   :80   -> $($_.Exception.Message)" }
try { $r = Invoke-WebRequest -Uri "https://127.0.0.1:443" -UseBasicParsing -TimeoutSec 5 -SkipCertificateCheck; Write-Host "  Nginx   :443  -> $($r.StatusCode)" -ForegroundColor Green } catch { Write-Host "  Nginx   :443  -> $($_.Exception.Message)" }

# Write status file
"FIXED $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File "$LraRoot\backend\logs\fix-status.txt" -Encoding ASCII

Write-Host "`n=== Fix Complete ===" -ForegroundColor Green
Write-Host "  Domain: https://leesrca.kmgvitallinks.com" -ForegroundColor Green
Stop-Transcript
