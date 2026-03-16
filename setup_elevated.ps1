# Lee's Road Assist - Elevated Setup Script
# This script runs with elevated privileges to set up the infrastructure
# It will be launched by the deployment process with Start-Process -Verb RunAs

param(
    [string]$LraRoot = "C:\inetpub\wwwroot\lees-road-assist"
)

$ErrorActionPreference = "Continue"
$PgBin = "C:\Program Files\PostgreSQL\17\bin"
$PgData = "C:\Program Files\PostgreSQL\17\data"
$NginxDir = "C:\nginx"
$RedisDir = "C:\redis"
$Nssm = "C:\ProgramData\chocolatey\bin\nssm.exe"
$DbName = "lees_road_assist"
$DbUser = "lra_user"
$DbPass = "RsrExuyDH_l_xzIFeoLn78M7oneXP5WhNij0FpNXOy4"

# Log file for this elevated session
$logFile = Join-Path $LraRoot "backend\logs\deploy-elevated.log"
New-Item -ItemType Directory -Path (Join-Path $LraRoot "backend\logs") -Force | Out-Null
Start-Transcript -Path $logFile -Force

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  LRA Elevated Setup" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

# ── Step 1: Stop IIS ──────────────────────────────────────────────────────
Write-Host "[1/7] Stopping IIS..." -ForegroundColor Yellow
Stop-Service W3SVC -Force -ErrorAction SilentlyContinue
Stop-Service WAS -Force -ErrorAction SilentlyContinue
Set-Service W3SVC -StartupType Disabled -ErrorAction SilentlyContinue
Write-Host "  IIS stopped." -ForegroundColor Green

# ── Step 2: PostgreSQL Setup ──────────────────────────────────────────────
Write-Host "`n[2/7] Setting up PostgreSQL..." -ForegroundColor Yellow

# Backup and modify pg_hba.conf for trust auth
$pgHba = Join-Path $PgData "pg_hba.conf"
if (Test-Path $pgHba) {
    Copy-Item $pgHba "$pgHba.bak" -Force
    @"
# Temporary trust config for LRA setup
host all all 127.0.0.1/32 trust
host all all ::1/128 trust
"@ | Set-Content $pgHba -Encoding UTF8

    # Restart PostgreSQL
    Write-Host "  Restarting PostgreSQL with trust auth..."
    Restart-Service postgresql-x64-17
    Start-Sleep -Seconds 5

    # Create user and database
    Write-Host "  Creating database user '$DbUser'..."
    & "$PgBin\psql.exe" -U postgres -h 127.0.0.1 -c "DO `$`$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$DbUser') THEN CREATE ROLE $DbUser WITH LOGIN PASSWORD '$DbPass'; END IF; END `$`$;" 2>&1
    & "$PgBin\psql.exe" -U postgres -h 127.0.0.1 -c "ALTER ROLE $DbUser WITH LOGIN PASSWORD '$DbPass' CREATEDB;" 2>&1

    Write-Host "  Creating database '$DbName'..."
    $dbExists = & "$PgBin\psql.exe" -U postgres -h 127.0.0.1 -tAc "SELECT 1 FROM pg_database WHERE datname='$DbName'" 2>&1
    if ($dbExists -notmatch "1") {
        & "$PgBin\psql.exe" -U postgres -h 127.0.0.1 -c "CREATE DATABASE $DbName OWNER $DbUser;" 2>&1
        Write-Host "  Database created." -ForegroundColor Green
    } else {
        Write-Host "  Database already exists." -ForegroundColor Green
    }
    & "$PgBin\psql.exe" -U postgres -h 127.0.0.1 -c "GRANT ALL PRIVILEGES ON DATABASE $DbName TO $DbUser;" 2>&1

    # Restore pg_hba.conf with scram-sha-256 auth
    Write-Host "  Restoring secure authentication..."
    @"
# PostgreSQL Client Authentication for LRA
# TYPE  DATABASE  USER  ADDRESS  METHOD
host all all 127.0.0.1/32 scram-sha-256
host all all ::1/128 scram-sha-256
"@ | Set-Content $pgHba -Encoding UTF8

    Restart-Service postgresql-x64-17
    Start-Sleep -Seconds 3

    # Verify connection
    $env:PGPASSWORD = $DbPass
    $result = & "$PgBin\psql.exe" -U $DbUser -h 127.0.0.1 -d $DbName -tAc "SELECT 'DB_OK';" 2>&1
    if ($result -match "DB_OK") {
        Write-Host "  PostgreSQL setup verified!" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: DB verification failed: $result" -ForegroundColor Red
    }
} else {
    Write-Host "  ERROR: pg_hba.conf not found at $pgHba" -ForegroundColor Red
}

# ── Step 3: Install Redis ─────────────────────────────────────────────────
Write-Host "`n[3/7] Installing Redis..." -ForegroundColor Yellow
if (-not (Test-Path "$RedisDir\redis-server.exe")) {
    New-Item -ItemType Directory -Path $RedisDir -Force | Out-Null
    Write-Host "  Downloading Redis for Windows..."
    $redisUrl = "https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip"
    $redisZip = "$env:TEMP\redis.zip"
    try {
        Invoke-WebRequest -Uri $redisUrl -OutFile $redisZip -UseBasicParsing
        Write-Host "  Extracting Redis..."
        Expand-Archive -Path $redisZip -DestinationPath $RedisDir -Force
        Remove-Item $redisZip -Force -ErrorAction SilentlyContinue
        Write-Host "  Redis installed to $RedisDir" -ForegroundColor Green
    } catch {
        Write-Host "  Download failed: $_" -ForegroundColor Red
        Write-Host "  Trying chocolatey..." -ForegroundColor Yellow
        choco install redis-64 -y --no-progress 2>&1
    }
} else {
    Write-Host "  Redis already installed." -ForegroundColor Green
}

# Start Redis service
Write-Host "  Creating Redis service..."
& $Nssm stop lra_redis 2>&1 | Out-Null
& $Nssm remove lra_redis confirm 2>&1 | Out-Null
& $Nssm install lra_redis "$RedisDir\redis-server.exe"
& $Nssm set lra_redis AppDirectory $RedisDir
& $Nssm set lra_redis DisplayName "LRA Redis"
& $Nssm set lra_redis Start SERVICE_AUTO_START
Start-Service lra_redis -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$redisPing = & "$RedisDir\redis-cli.exe" ping 2>&1
if ($redisPing -match "PONG") {
    Write-Host "  Redis is running!" -ForegroundColor Green
} else {
    Write-Host "  WARNING: Redis ping failed: $redisPing" -ForegroundColor Red
}

# ── Step 4: Install Nginx ─────────────────────────────────────────────────
Write-Host "`n[4/7] Installing Nginx..." -ForegroundColor Yellow
if (-not (Test-Path "$NginxDir\nginx.exe")) {
    Write-Host "  Downloading Nginx..."
    $nginxUrl = "https://nginx.org/download/nginx-1.27.4.zip"
    $nginxZip = "$env:TEMP\nginx.zip"
    try {
        Invoke-WebRequest -Uri $nginxUrl -OutFile $nginxZip -UseBasicParsing
        $extractDir = "$env:TEMP\nginx_extract"
        Expand-Archive -Path $nginxZip -DestinationPath $extractDir -Force
        # Move from nested folder
        $nested = Get-ChildItem $extractDir -Directory | Select-Object -First 1
        if ($nested) {
            New-Item -ItemType Directory -Path $NginxDir -Force | Out-Null
            Copy-Item "$($nested.FullName)\*" $NginxDir -Recurse -Force
        }
        Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item $nginxZip -Force -ErrorAction SilentlyContinue
        Write-Host "  Nginx installed to $NginxDir" -ForegroundColor Green
    } catch {
        Write-Host "  Download failed: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  Nginx already installed." -ForegroundColor Green
}

# Configure Nginx
Write-Host "  Configuring Nginx..."
New-Item -ItemType Directory -Path "$NginxDir\ssl" -Force | Out-Null
New-Item -ItemType Directory -Path "$NginxDir\logs" -Force | Out-Null
New-Item -ItemType Directory -Path "$NginxDir\html\acme" -Force | Out-Null
Copy-Item "$LraRoot\nginx\nginx-windows.conf" "$NginxDir\conf\nginx.conf" -Force
Copy-Item "$LraRoot\nginx\ssl\fullchain.pem" "$NginxDir\ssl\fullchain.pem" -Force
Copy-Item "$LraRoot\nginx\ssl\privkey.pem" "$NginxDir\ssl\privkey.pem" -Force
Write-Host "  Nginx configured." -ForegroundColor Green

# ── Step 5: Run Database Migrations ───────────────────────────────────────
Write-Host "`n[5/7] Running database migrations..." -ForegroundColor Yellow
$venvPython = Join-Path $LraRoot ".venv\Scripts\python.exe"
$backendDir = Join-Path $LraRoot "backend"

Push-Location $backendDir
$env:DATABASE_URL = "postgresql+asyncpg://${DbUser}:${DbPass}@127.0.0.1:5432/${DbName}"
$env:APP_ENV = "production"

& $venvPython -m alembic upgrade head 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Migration failed, trying autogenerate..." -ForegroundColor Yellow
    & $venvPython -m alembic revision --autogenerate -m "initial" 2>&1
    & $venvPython -m alembic upgrade head 2>&1
}
Pop-Location
Write-Host "  Migrations done." -ForegroundColor Green

# ── Step 6: Create Windows Services ───────────────────────────────────────
Write-Host "`n[6/7] Creating Windows services..." -ForegroundColor Yellow

# Backend (FastAPI)
Write-Host "  -> lra_backend (FastAPI on :8000)"
& $Nssm stop lra_backend 2>&1 | Out-Null
& $Nssm remove lra_backend confirm 2>&1 | Out-Null
& $Nssm install lra_backend $venvPython
& $Nssm set lra_backend AppParameters "-m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2"
& $Nssm set lra_backend AppDirectory $backendDir
& $Nssm set lra_backend DisplayName "LRA Backend (FastAPI)"
& $Nssm set lra_backend Start SERVICE_AUTO_START
& $Nssm set lra_backend AppStdout "$backendDir\logs\backend-stdout.log"
& $Nssm set lra_backend AppStderr "$backendDir\logs\backend-stderr.log"
& $Nssm set lra_backend AppRotateFiles 1
& $Nssm set lra_backend AppRotateBytes 10485760

# Celery Worker
Write-Host "  -> lra_celery (Celery worker)"
& $Nssm stop lra_celery 2>&1 | Out-Null
& $Nssm remove lra_celery confirm 2>&1 | Out-Null
& $Nssm install lra_celery $venvPython
& $Nssm set lra_celery AppParameters "-m celery -A app.worker.celery_app worker --loglevel=info --concurrency=2 --pool=solo"
& $Nssm set lra_celery AppDirectory $backendDir
& $Nssm set lra_celery DisplayName "LRA Celery Worker"
& $Nssm set lra_celery Start SERVICE_AUTO_START
& $Nssm set lra_celery AppStdout "$backendDir\logs\celery-stdout.log"
& $Nssm set lra_celery AppStderr "$backendDir\logs\celery-stderr.log"

# WhatsApp Webhook
Write-Host "  -> lra_whatsapp (WhatsApp webhook on :8001)"
& $Nssm stop lra_whatsapp 2>&1 | Out-Null
& $Nssm remove lra_whatsapp confirm 2>&1 | Out-Null
& $Nssm install lra_whatsapp $venvPython
& $Nssm set lra_whatsapp AppParameters "-m uvicorn whatsapp_webhook:app --host 127.0.0.1 --port 8001 --workers 1"
& $Nssm set lra_whatsapp AppDirectory $backendDir
& $Nssm set lra_whatsapp DisplayName "LRA WhatsApp Webhook"
& $Nssm set lra_whatsapp Start SERVICE_AUTO_START
& $Nssm set lra_whatsapp AppStdout "$backendDir\logs\whatsapp-stdout.log"
& $Nssm set lra_whatsapp AppStderr "$backendDir\logs\whatsapp-stderr.log"

# Next.js Frontend
Write-Host "  -> lra_web (Next.js on :3000)"
& $Nssm stop lra_web 2>&1 | Out-Null
& $Nssm remove lra_web confirm 2>&1 | Out-Null
& $Nssm install lra_web "node.exe"
& $Nssm set lra_web AppParameters "server.js"
& $Nssm set lra_web AppDirectory "$LraRoot\web\.next\standalone"
& $Nssm set lra_web AppEnvironmentExtra "NODE_ENV=production" "PORT=3000" "HOSTNAME=127.0.0.1"
& $Nssm set lra_web DisplayName "LRA Web (Next.js)"
& $Nssm set lra_web Start SERVICE_AUTO_START
& $Nssm set lra_web AppStdout "$backendDir\logs\web-stdout.log"
& $Nssm set lra_web AppStderr "$backendDir\logs\web-stderr.log"

# Nginx
Write-Host "  -> lra_nginx (Nginx on :80/:443)"
& $Nssm stop lra_nginx 2>&1 | Out-Null
& $Nssm remove lra_nginx confirm 2>&1 | Out-Null
& $Nssm install lra_nginx "$NginxDir\nginx.exe"
& $Nssm set lra_nginx AppDirectory $NginxDir
& $Nssm set lra_nginx DisplayName "LRA Nginx"
& $Nssm set lra_nginx Start SERVICE_AUTO_START

Write-Host "  Services created." -ForegroundColor Green

# ── Step 7: Start All Services ────────────────────────────────────────────
Write-Host "`n[7/7] Starting all services..." -ForegroundColor Yellow

$services = @("lra_redis", "lra_backend", "lra_celery", "lra_whatsapp", "lra_web", "lra_nginx")
foreach ($svc in $services) {
    Write-Host "  Starting $svc..."
    Start-Service $svc -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Configure firewall
Write-Host "`n  Configuring firewall..."
netsh advfirewall firewall delete rule name="LRA HTTP" 2>&1 | Out-Null
netsh advfirewall firewall delete rule name="LRA HTTPS" 2>&1 | Out-Null
netsh advfirewall firewall add rule name="LRA HTTP" dir=in action=allow protocol=tcp localport=80 | Out-Null
netsh advfirewall firewall add rule name="LRA HTTPS" dir=in action=allow protocol=tcp localport=443 | Out-Null
Write-Host "  Firewall rules added." -ForegroundColor Green

# ── Final Status ──────────────────────────────────────────────────────────
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  Service Status:" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

foreach ($svc in $services) {
    $status = (Get-Service $svc -ErrorAction SilentlyContinue).Status
    if ($status -eq "Running") {
        Write-Host "  [OK]   $svc" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] $svc ($status)" -ForegroundColor Red
    }
}

# Test backend health
Start-Sleep -Seconds 5
try {
    $health = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -UseBasicParsing -TimeoutSec 5
    Write-Host "`n  Backend health: $($health.StatusCode) $($health.Content)" -ForegroundColor Green
} catch {
    Write-Host "`n  Backend health check failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  DEPLOYMENT COMPLETE" -ForegroundColor Green
Write-Host ""
Write-Host "  Website  : https://leesrca.kmgvitallinks.com"
Write-Host "  API Docs : https://leesrca.kmgvitallinks.com/docs"
Write-Host "  Health   : https://leesrca.kmgvitallinks.com/api/v1/health"
Write-Host ""
Write-Host "  Using self-signed SSL. Run obtain_ssl_native.bat for Let's Encrypt."
Write-Host "============================================`n" -ForegroundColor Cyan

Stop-Transcript

# Signal completion
"DEPLOY_COMPLETE" | Set-Content (Join-Path $LraRoot "backend\logs\deploy-status.txt")

Read-Host "Press Enter to close"
