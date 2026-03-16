@echo off
:: ============================================================
:: Lee's Road Assist — Windows Deployment Script
:: Server: 100.42.189.186  |  Domain: leesrca.kmgvitallinks.com
:: Requirements: Docker Desktop for Windows (with WSL2 backend)
:: ============================================================

echo.
echo ====================================================
echo  Lee's Road Assist - Deployment
echo ====================================================
echo.

:: Set Docker host and check Docker is running
set DOCKER_HOST=tcp://127.0.0.1:2375
docker info >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running or not accessible.
    echo Run deploy_full.bat as Administrator for first-time setup.
    pause
    exit /b 1
)

:: Check .env files exist
if not exist "backend\.env.production" (
    echo ERROR: backend\.env.production not found.
    echo Copy backend\.env.example to backend\.env.production and fill in secrets.
    pause
    exit /b 1
)

if not exist ".env" (
    echo ERROR: .env not found in project root.
    echo Copy .env.example to .env and fill in POSTGRES_PASSWORD.
    pause
    exit /b 1
)

if not exist "nginx\ssl\fullchain.pem" (
    echo ERROR: nginx\ssl\fullchain.pem not found.
    echo Place your SSL certificate files in nginx\ssl\
    echo   fullchain.pem  - full certificate chain
    echo   privkey.pem    - private key
    pause
    exit /b 1
)

echo [1/5] Pulling latest images...
docker-compose pull --ignore-buildable

echo [2/5] Building services...
docker-compose build --no-cache

echo [3/5] Starting database and redis first...
docker-compose up -d db redis
timeout /t 10 /nobreak >nul

echo [4/5] Running database migrations...
docker-compose run --rm backend alembic upgrade head

echo [5/5] Starting all services...
docker-compose up -d

echo.
echo Waiting for services to be healthy...
timeout /t 15 /nobreak >nul

echo.
echo ====================================================
echo  Deployment complete!
echo  Open: https://leesrca.kmgvitallinks.com
echo ====================================================
echo.
docker compose ps

pause
