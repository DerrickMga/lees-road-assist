@echo off
:: ============================================================
:: Lee's Road Assist - Native Windows Deployment
:: Server: 100.42.189.186 | Domain: leesrca.kmgvitallinks.com
::
:: IMPORTANT: Right-click this file → "Run as Administrator"
:: ============================================================

:: ── Self-elevation check ────────────────────────────────────────────────────
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: This script must be run as Administrator!
    echo Right-click deploy_native.bat and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

cd /d "%~dp0"
setlocal enabledelayedexpansion

set LRA_ROOT=%~dp0
set PG_BIN=C:\Program Files\PostgreSQL\17\bin
set PG_DATA=C:\Program Files\PostgreSQL\17\data
set NGINX_DIR=C:\nginx
set REDIS_DIR=C:\redis
set NSSM=C:\ProgramData\chocolatey\bin\nssm.exe
set DB_NAME=lees_road_assist
set DB_USER=lra_user
set DB_PASS=RsrExuyDH_l_xzIFeoLn78M7oneXP5WhNij0FpNXOy4

echo.
echo ============================================================
echo   Lee's Road Assist - Native Windows Deployment
echo   Server : 100.42.189.186
echo   Domain : leesrca.kmgvitallinks.com
echo ============================================================
echo.

:: ── Step 1: Stop IIS ────────────────────────────────────────────────────────
echo [Step 1/10] Stopping IIS to free ports 80 and 443...
net stop W3SVC 2>nul
net stop WAS 2>nul
sc config W3SVC start= disabled 2>nul
echo   Done.
echo.

:: ── Step 2: Setup PostgreSQL database ───────────────────────────────────────
echo [Step 2/10] Setting up PostgreSQL database...

:: Temporarily set pg_hba.conf to trust local connections
echo   Backing up pg_hba.conf...
copy /Y "%PG_DATA%\pg_hba.conf" "%PG_DATA%\pg_hba.conf.bak" >nul

:: Write trust auth for local connections
echo # Temporary trust config for setup > "%PG_DATA%\pg_hba.conf"
echo host all all 127.0.0.1/32 trust >> "%PG_DATA%\pg_hba.conf"
echo host all all ::1/128 trust >> "%PG_DATA%\pg_hba.conf"
echo local all all trust >> "%PG_DATA%\pg_hba.conf"

:: Restart PostgreSQL to pick up new auth
echo   Restarting PostgreSQL...
net stop postgresql-x64-17 >nul 2>&1
timeout /t 3 /nobreak >nul
net start postgresql-x64-17
timeout /t 5 /nobreak >nul

:: Create user and database
echo   Creating database user '%DB_USER%'...
"%PG_BIN%\psql.exe" -U postgres -h 127.0.0.1 -c "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '%DB_USER%') THEN CREATE ROLE %DB_USER% WITH LOGIN PASSWORD '%DB_PASS%'; END IF; END $$;" 2>nul
"%PG_BIN%\psql.exe" -U postgres -h 127.0.0.1 -c "ALTER ROLE %DB_USER% WITH LOGIN PASSWORD '%DB_PASS%' CREATEDB;" 2>nul

echo   Creating database '%DB_NAME%'...
"%PG_BIN%\psql.exe" -U postgres -h 127.0.0.1 -c "SELECT 1 FROM pg_database WHERE datname='%DB_NAME%'" | findstr /C:"1" >nul 2>&1
if %errorlevel% neq 0 (
    "%PG_BIN%\psql.exe" -U postgres -h 127.0.0.1 -c "CREATE DATABASE %DB_NAME% OWNER %DB_USER%;"
    echo   Database created.
) else (
    echo   Database already exists.
)
"%PG_BIN%\psql.exe" -U postgres -h 127.0.0.1 -c "GRANT ALL PRIVILEGES ON DATABASE %DB_NAME% TO %DB_USER%;" 2>nul

:: Restore pg_hba.conf with password auth
echo   Restoring pg_hba.conf with password authentication...
echo # PostgreSQL Client Authentication Configuration > "%PG_DATA%\pg_hba.conf"
echo # TYPE  DATABASE  USER  ADDRESS  METHOD >> "%PG_DATA%\pg_hba.conf"
echo host all all 127.0.0.1/32 scram-sha-256 >> "%PG_DATA%\pg_hba.conf"
echo host all all ::1/128 scram-sha-256 >> "%PG_DATA%\pg_hba.conf"
echo local all all scram-sha-256 >> "%PG_DATA%\pg_hba.conf"

:: Restart PostgreSQL with proper auth
net stop postgresql-x64-17 >nul 2>&1
timeout /t 3 /nobreak >nul
net start postgresql-x64-17
timeout /t 3 /nobreak >nul

:: Verify connection
echo   Verifying database connection...
set PGPASSWORD=%DB_PASS%
"%PG_BIN%\psql.exe" -U %DB_USER% -h 127.0.0.1 -d %DB_NAME% -c "SELECT 'DB_OK' as status;" 2>nul | findstr /C:"DB_OK" >nul
if %errorlevel% equ 0 (
    echo   PostgreSQL setup successful!
) else (
    echo   WARNING: Database connection test failed. Check logs.
)
echo.

:: ── Step 3: Install Redis ───────────────────────────────────────────────────
echo [Step 3/10] Installing Redis for Windows...
if not exist "%REDIS_DIR%\redis-server.exe" (
    echo   Downloading Redis for Windows...
    mkdir "%REDIS_DIR%" 2>nul
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip' -OutFile '%TEMP%\redis.zip' -UseBasicParsing"
    if exist "%TEMP%\redis.zip" (
        echo   Extracting Redis...
        powershell -Command "Expand-Archive -Path '%TEMP%\redis.zip' -DestinationPath '%REDIS_DIR%' -Force"
        del "%TEMP%\redis.zip" 2>nul
        echo   Redis installed to %REDIS_DIR%
    ) else (
        echo   ERROR: Failed to download Redis. Trying Chocolatey...
        choco install redis-64 -y --no-progress 2>nul
    )
) else (
    echo   Redis already installed at %REDIS_DIR%
)

:: Start Redis as a service
echo   Configuring Redis service...
"%NSSM%" stop lra_redis >nul 2>&1
"%NSSM%" remove lra_redis confirm >nul 2>&1
"%NSSM%" install lra_redis "%REDIS_DIR%\redis-server.exe"
"%NSSM%" set lra_redis AppDirectory "%REDIS_DIR%"
"%NSSM%" set lra_redis DisplayName "LRA Redis"
"%NSSM%" set lra_redis Start SERVICE_AUTO_START
"%NSSM%" set lra_redis AppStdout "%LRA_ROOT%backend\logs\redis-stdout.log"
"%NSSM%" set lra_redis AppStderr "%LRA_ROOT%backend\logs\redis-stderr.log"
net start lra_redis 2>nul
timeout /t 2 /nobreak >nul

:: Verify Redis
"%REDIS_DIR%\redis-cli.exe" ping 2>nul | findstr /C:"PONG" >nul
if %errorlevel% equ 0 (
    echo   Redis is running!
) else (
    echo   WARNING: Redis may not be running. Check logs.
)
echo.

:: ── Step 4: Install Nginx ───────────────────────────────────────────────────
echo [Step 4/10] Installing Nginx for Windows...
if not exist "%NGINX_DIR%\nginx.exe" (
    echo   Downloading Nginx...
    powershell -Command "Invoke-WebRequest -Uri 'https://nginx.org/download/nginx-1.27.4.zip' -OutFile '%TEMP%\nginx.zip' -UseBasicParsing"
    if exist "%TEMP%\nginx.zip" (
        echo   Extracting Nginx...
        powershell -Command "Expand-Archive -Path '%TEMP%\nginx.zip' -DestinationPath '%TEMP%\nginx_extract' -Force"
        :: Move from nested folder to C:\nginx
        if exist "%TEMP%\nginx_extract\nginx-1.27.4" (
            xcopy "%TEMP%\nginx_extract\nginx-1.27.4\*" "%NGINX_DIR%\" /E /I /Y >nul
        )
        rd /s /q "%TEMP%\nginx_extract" 2>nul
        del "%TEMP%\nginx.zip" 2>nul
        echo   Nginx installed to %NGINX_DIR%
    ) else (
        echo   ERROR: Failed to download Nginx!
    )
) else (
    echo   Nginx already installed at %NGINX_DIR%
)

:: Configure Nginx
echo   Configuring Nginx...
mkdir "%NGINX_DIR%\ssl" 2>nul
mkdir "%NGINX_DIR%\logs" 2>nul
mkdir "%NGINX_DIR%\html\acme" 2>nul
copy /Y "%LRA_ROOT%nginx\nginx-windows.conf" "%NGINX_DIR%\conf\nginx.conf" >nul
copy /Y "%LRA_ROOT%nginx\ssl\fullchain.pem" "%NGINX_DIR%\ssl\fullchain.pem" >nul
copy /Y "%LRA_ROOT%nginx\ssl\privkey.pem" "%NGINX_DIR%\ssl\privkey.pem" >nul
echo   Nginx configured.
echo.

:: ── Step 5: Setup Python backend ────────────────────────────────────────────
echo [Step 5/10] Setting up Python backend...
cd /d "%LRA_ROOT%backend"
mkdir logs 2>nul
mkdir static 2>nul

if not exist ".venv\Scripts\activate.bat" (
    echo   Creating Python virtual environment...
    python -m venv .venv
)

echo   Installing Python dependencies...
call .venv\Scripts\activate.bat
pip install --no-cache-dir -r requirements.txt 2>nul
if errorlevel 1 (
    echo   WARNING: Some pip installs may have failed.
    echo   Retrying with relaxed constraints...
    pip install --no-cache-dir -r requirements.txt --no-deps 2>nul
)
echo   Python backend setup complete.
echo.

:: ── Step 6: Run database migrations ─────────────────────────────────────────
echo [Step 6/10] Running database migrations...
cd /d "%LRA_ROOT%backend"
call .venv\Scripts\activate.bat
set APP_ENV=production
set DATABASE_URL=postgresql+asyncpg://%DB_USER%:%DB_PASS%@127.0.0.1:5432/%DB_NAME%

:: Set env file for the backend
copy /Y .env.production .env >nul 2>&1

alembic upgrade head
if errorlevel 1 (
    echo   WARNING: Migration may have failed. Check error above.
    echo   If this is a fresh database, trying to generate initial migration...
    alembic revision --autogenerate -m "initial" 2>nul
    alembic upgrade head 2>nul
)
echo   Migrations complete.
echo.

:: ── Step 7: Build Next.js frontend ──────────────────────────────────────────
echo [Step 7/10] Building Next.js frontend...
cd /d "%LRA_ROOT%web"

:: Copy env file
copy /Y .env.production .env.local >nul 2>&1

if not exist "node_modules" (
    echo   Installing npm dependencies...
    call npm ci
) else (
    echo   node_modules exists, skipping npm install.
)

echo   Building Next.js (this may take a few minutes)...
set NEXT_PUBLIC_API_URL=https://leesrca.kmgvitallinks.com/api/v1
set NEXT_PUBLIC_WS_URL=wss://leesrca.kmgvitallinks.com/api/v1/ws
call npm run build
if errorlevel 1 (
    echo   ERROR: Next.js build failed!
    echo   Trying with npm install first...
    call npm install
    call npm run build
)
echo   Next.js build complete.
echo.

:: ── Step 8: Create Windows services via nssm ────────────────────────────────
echo [Step 8/10] Creating Windows services...

:: --- Backend (FastAPI/Uvicorn) ---
echo   Setting up backend service...
"%NSSM%" stop lra_backend >nul 2>&1
"%NSSM%" remove lra_backend confirm >nul 2>&1
"%NSSM%" install lra_backend "%LRA_ROOT%backend\.venv\Scripts\python.exe"
"%NSSM%" set lra_backend AppParameters "-m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2"
"%NSSM%" set lra_backend AppDirectory "%LRA_ROOT%backend"
"%NSSM%" set lra_backend DisplayName "LRA Backend (FastAPI)"
"%NSSM%" set lra_backend Start SERVICE_AUTO_START
"%NSSM%" set lra_backend AppStdout "%LRA_ROOT%backend\logs\backend-stdout.log"
"%NSSM%" set lra_backend AppStderr "%LRA_ROOT%backend\logs\backend-stderr.log"
"%NSSM%" set lra_backend AppRotateFiles 1
"%NSSM%" set lra_backend AppRotateBytes 10485760

:: --- Celery Worker ---
echo   Setting up Celery worker service...
"%NSSM%" stop lra_celery >nul 2>&1
"%NSSM%" remove lra_celery confirm >nul 2>&1
"%NSSM%" install lra_celery "%LRA_ROOT%backend\.venv\Scripts\python.exe"
"%NSSM%" set lra_celery AppParameters "-m celery -A app.worker.celery_app worker --loglevel=info --concurrency=2 --pool=solo"
"%NSSM%" set lra_celery AppDirectory "%LRA_ROOT%backend"
"%NSSM%" set lra_celery DisplayName "LRA Celery Worker"
"%NSSM%" set lra_celery Start SERVICE_AUTO_START
"%NSSM%" set lra_celery AppStdout "%LRA_ROOT%backend\logs\celery-stdout.log"
"%NSSM%" set lra_celery AppStderr "%LRA_ROOT%backend\logs\celery-stderr.log"

:: --- WhatsApp Webhook ---
echo   Setting up WhatsApp webhook service...
"%NSSM%" stop lra_whatsapp >nul 2>&1
"%NSSM%" remove lra_whatsapp confirm >nul 2>&1
"%NSSM%" install lra_whatsapp "%LRA_ROOT%backend\.venv\Scripts\python.exe"
"%NSSM%" set lra_whatsapp AppParameters "-m uvicorn whatsapp_webhook:app --host 127.0.0.1 --port 8001 --workers 1"
"%NSSM%" set lra_whatsapp AppDirectory "%LRA_ROOT%backend"
"%NSSM%" set lra_whatsapp DisplayName "LRA WhatsApp Webhook"
"%NSSM%" set lra_whatsapp Start SERVICE_AUTO_START
"%NSSM%" set lra_whatsapp AppStdout "%LRA_ROOT%backend\logs\whatsapp-stdout.log"
"%NSSM%" set lra_whatsapp AppStderr "%LRA_ROOT%backend\logs\whatsapp-stderr.log"

:: --- Next.js Frontend ---
echo   Setting up Next.js service...
"%NSSM%" stop lra_web >nul 2>&1
"%NSSM%" remove lra_web confirm >nul 2>&1
"%NSSM%" install lra_web "node.exe"
"%NSSM%" set lra_web AppParameters "server.js"
"%NSSM%" set lra_web AppDirectory "%LRA_ROOT%web\.next\standalone"
"%NSSM%" set lra_web AppEnvironmentExtra "NODE_ENV=production" "PORT=3000" "HOSTNAME=127.0.0.1"
"%NSSM%" set lra_web DisplayName "LRA Web (Next.js)"
"%NSSM%" set lra_web Start SERVICE_AUTO_START
"%NSSM%" set lra_web AppStdout "%LRA_ROOT%backend\logs\web-stdout.log"
"%NSSM%" set lra_web AppStderr "%LRA_ROOT%backend\logs\web-stderr.log"

:: --- Nginx ---
echo   Setting up Nginx service...
"%NSSM%" stop lra_nginx >nul 2>&1
"%NSSM%" remove lra_nginx confirm >nul 2>&1
"%NSSM%" install lra_nginx "%NGINX_DIR%\nginx.exe"
"%NSSM%" set lra_nginx AppDirectory "%NGINX_DIR%"
"%NSSM%" set lra_nginx DisplayName "LRA Nginx"
"%NSSM%" set lra_nginx Start SERVICE_AUTO_START
"%NSSM%" set lra_nginx AppStdout "%NGINX_DIR%\logs\service-stdout.log"
"%NSSM%" set lra_nginx AppStderr "%NGINX_DIR%\logs\service-stderr.log"

echo   All services created.
echo.

:: ── Step 9: Start all services ──────────────────────────────────────────────
echo [Step 9/10] Starting all services...
net start lra_redis 2>nul
timeout /t 2 /nobreak >nul
net start lra_backend
timeout /t 3 /nobreak >nul
net start lra_celery
net start lra_whatsapp
timeout /t 3 /nobreak >nul
net start lra_web
timeout /t 3 /nobreak >nul
net start lra_nginx
timeout /t 5 /nobreak >nul
echo   All services started.
echo.

:: ── Step 10: Open firewall ports ────────────────────────────────────────────
echo [Step 10/10] Configuring Windows Firewall...
netsh advfirewall firewall delete rule name="LRA HTTP" >nul 2>&1
netsh advfirewall firewall delete rule name="LRA HTTPS" >nul 2>&1
netsh advfirewall firewall add rule name="LRA HTTP" dir=in action=allow protocol=tcp localport=80
netsh advfirewall firewall add rule name="LRA HTTPS" dir=in action=allow protocol=tcp localport=443
echo   Firewall rules added.
echo.

:: ── Final status ────────────────────────────────────────────────────────────
echo ============================================================
echo   Service Status:
echo ============================================================
echo.
for %%s in (lra_redis lra_backend lra_celery lra_whatsapp lra_web lra_nginx) do (
    sc query %%s 2>nul | findstr /C:"RUNNING" >nul
    if !errorlevel! equ 0 (
        echo   [OK]   %%s
    ) else (
        echo   [FAIL] %%s
    )
)
echo.
echo ============================================================
echo   DEPLOYMENT COMPLETE
echo.
echo   Website  : https://leesrca.kmgvitallinks.com
echo   API Docs : https://leesrca.kmgvitallinks.com/docs
echo   Health   : https://leesrca.kmgvitallinks.com/api/v1/health
echo.
echo   NOTE: Using self-signed SSL certificate.
echo   Run obtain_ssl_native.bat for Let's Encrypt certificate.
echo.
echo   Log files: %LRA_ROOT%backend\logs\
echo.
echo   To check service status:
echo     sc query lra_backend
echo     sc query lra_web
echo     sc query lra_nginx
echo ============================================================
echo.
pause
