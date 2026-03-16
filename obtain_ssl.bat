@echo off
:: ============================================================
:: Obtain Let's Encrypt SSL certificate for leesrca.kmgvitallinks.com
:: Run AFTER deploy_full.bat has completed successfully.
:: Must be run as Administrator.
:: ============================================================

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Run as Administrator!
    pause
    exit /b 1
)

cd /d "%~dp0"
set DOCKER_HOST=tcp://127.0.0.1:2375

echo.
echo === Obtaining Let's Encrypt SSL Certificate ===
echo Domain: leesrca.kmgvitallinks.com
echo.

:: Obtain certificate via webroot through nginx
docker-compose run --rm certbot certonly --webroot -w /var/www/certbot -d leesrca.kmgvitallinks.com --agree-tos --email admin@kmgvitallinks.com --no-eff-email --force-renewal

if errorlevel 1 (
    echo.
    echo ERROR: Certificate obtainment failed.
    echo Ensure:
    echo   1. Docker stack is running (deploy_full.bat)
    echo   2. DNS for leesrca.kmgvitallinks.com points to 100.42.189.186
    echo   3. Port 80 is accessible from the internet
    pause
    exit /b 1
)

:: Copy certs to nginx ssl directory
echo Copying certificates...
copy /Y "nginx\ssl\live\leesrca.kmgvitallinks.com\fullchain.pem" "nginx\ssl\fullchain.pem"
copy /Y "nginx\ssl\live\leesrca.kmgvitallinks.com\privkey.pem" "nginx\ssl\privkey.pem"

:: Reload nginx
echo Reloading nginx...
docker-compose exec nginx nginx -s reload

echo.
echo === SSL Certificate installed successfully! ===
echo The certbot container will auto-renew the certificate.
echo.
pause
