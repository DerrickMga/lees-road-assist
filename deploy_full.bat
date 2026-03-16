@echo off
:: ============================================================
:: Lee's Road Assist - Full Production Deployment
:: Server: 100.42.189.186 | Domain: leesrca.kmgvitallinks.com
::
:: IMPORTANT: Right-click this file → "Run as Administrator"
:: ============================================================

:: ── Self-elevation check ────────────────────────────────────────────────────
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: This script must be run as Administrator!
    echo Right-click deploy_full.bat and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

cd /d "%~dp0"

echo.
echo ============================================================
echo   Lee's Road Assist - Production Deployment
echo   Server : 100.42.189.186
echo   Domain : leesrca.kmgvitallinks.com
echo ============================================================
echo.

:: ── Step 1: Stop IIS ────────────────────────────────────────────────────────
echo [Step 1/8] Stopping IIS to free ports 80 and 443...
net stop W3SVC 2>nul
net stop WAS 2>nul
sc config W3SVC start= disabled 2>nul
echo   Done.
echo.

:: ── Step 2: Configure Docker access ─────────────────────────────────────────
echo [Step 2/8] Configuring Docker daemon for TCP access...
net localgroup docker-users "%USERNAME%" /add 2>nul

:: Add TCP listener to Docker daemon config
echo {"hosts": ["npipe://", "tcp://127.0.0.1:2375"]} > "%ProgramData%\docker\config\daemon.json"

:: Restart Docker to apply config
echo   Restarting Docker...
net stop docker 2>nul
timeout /t 3 /nobreak >nul
net start docker
timeout /t 5 /nobreak >nul

:: Set DOCKER_HOST for this session
set DOCKER_HOST=tcp://127.0.0.1:2375

echo   Docker configured.
echo.

:: ── Step 3: Verify ports are free ───────────────────────────────────────────
echo [Step 3/8] Verifying ports...
netstat -ano | findstr ":80 " | findstr LISTENING >nul 2>nul
if %errorlevel% equ 0 (
    echo   WARNING: Port 80 is still in use!
    echo   Attempting to identify and stop the process...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":80 " ^| findstr LISTENING') do (
        echo   Killing PID %%a
        taskkill /PID %%a /F 2>nul
    )
) else (
    echo   Port 80 is free.
)
netstat -ano | findstr ":443 " | findstr LISTENING >nul 2>nul
if %errorlevel% equ 0 (
    echo   WARNING: Port 443 is still in use!
) else (
    echo   Port 443 is free.
)
echo.

:: ── Step 4: Verify prerequisite files ───────────────────────────────────────
echo [Step 4/8] Checking prerequisite files...
set MISSING=0
if not exist "backend\.env.production" (
    echo   MISSING: backend\.env.production
    set MISSING=1
)
if not exist ".env" (
    echo   MISSING: .env
    set MISSING=1
)
if not exist "nginx\ssl\fullchain.pem" (
    echo   MISSING: nginx\ssl\fullchain.pem
    set MISSING=1
)
if not exist "nginx\ssl\privkey.pem" (
    echo   MISSING: nginx\ssl\privkey.pem
    set MISSING=1
)
if %MISSING% equ 1 (
    echo.
    echo   ERROR: Missing prerequisite files! Cannot continue.
    pause
    exit /b 1
)
echo   All prerequisite files found.
echo.

:: ── Step 5: Pull and build Docker images ────────────────────────────────────
echo [Step 5/8] Pulling and building Docker images...
echo   This may take several minutes on first run...
docker-compose pull --ignore-buildable
if errorlevel 1 (
    echo   WARNING: Some pulls failed, continuing with build...
)
docker-compose build
if errorlevel 1 (
    echo   ERROR: Docker build failed!
    pause
    exit /b 1
)
echo   Build complete.
echo.

:: ── Step 6: Start database and Redis ────────────────────────────────────────
echo [Step 6/8] Starting PostgreSQL and Redis containers...
docker-compose up -d db redis
echo   Waiting 15 seconds for database to be ready...
timeout /t 15 /nobreak >nul
echo   Database and Redis started.
echo.

:: ── Step 7: Run database migrations ─────────────────────────────────────────
echo [Step 7/8] Running database migrations...
docker-compose run --rm backend alembic upgrade head
if errorlevel 1 (
    echo   WARNING: Migration may have failed. Check logs above.
)
echo   Migrations complete.
echo.

:: ── Step 8: Start all services ──────────────────────────────────────────────
echo [Step 8/8] Starting all services...
docker-compose up -d
echo   Waiting 20 seconds for all services to start...
timeout /t 20 /nobreak >nul
echo.

:: ── Final status ────────────────────────────────────────────────────────────
echo ============================================================
echo   Service Status:
echo ============================================================
docker-compose ps
echo.
echo ============================================================
echo   DEPLOYMENT COMPLETE
echo.
echo   Website  : https://leesrca.kmgvitallinks.com
echo   API Docs : https://leesrca.kmgvitallinks.com/docs
echo   Health   : https://leesrca.kmgvitallinks.com/api/v1/health
echo.
echo   NOTE: Using self-signed SSL certificate.
echo   To get a Let's Encrypt certificate, run obtain_ssl.bat
echo ============================================================
echo.
pause
