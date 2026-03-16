@echo off
:: ============================================================
:: Obtain Let's Encrypt SSL cert - Native Windows Deployment
:: Run AFTER deploy_native.bat succeeds. Must be run as Admin.
:: ============================================================

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Run as Administrator!
    pause
    exit /b 1
)

cd /d "%~dp0"

set NGINX_DIR=C:\nginx
set CERTBOT=C:\Users\Administrator\AppData\Roaming\Python\Python313\Scripts\certbot.exe
set DOMAIN=leesrca.kmgvitallinks.com

echo.
echo === Obtaining Let's Encrypt SSL Certificate ===
echo Domain: %DOMAIN%
echo.

:: Use webroot through nginx
"%CERTBOT%" certonly --webroot -w "%NGINX_DIR%\html\acme" -d %DOMAIN% --agree-tos --email admin@kmgvitallinks.com --no-eff-email --force-renewal

if errorlevel 1 (
    echo.
    echo Webroot failed. Trying standalone method...
    echo Temporarily stopping Nginx...
    nssm stop lra_nginx >nul 2>&1
    "%CERTBOT%" certonly --standalone -d %DOMAIN% --agree-tos --email admin@kmgvitallinks.com --no-eff-email --force-renewal
    if errorlevel 1 (
        echo.
        echo ERROR: Certificate obtainment failed.
        echo Restarting Nginx with existing cert...
        nssm start lra_nginx
        pause
        exit /b 1
    )
)

:: Copy certs to nginx ssl directory
echo Copying certificates...
copy /Y "C:\Certbot\live\%DOMAIN%\fullchain.pem" "%NGINX_DIR%\ssl\fullchain.pem"
copy /Y "C:\Certbot\live\%DOMAIN%\privkey.pem" "%NGINX_DIR%\ssl\privkey.pem"

:: Also copy to project directory
copy /Y "C:\Certbot\live\%DOMAIN%\fullchain.pem" "%~dp0nginx\ssl\fullchain.pem"
copy /Y "C:\Certbot\live\%DOMAIN%\privkey.pem" "%~dp0nginx\ssl\privkey.pem"

:: Reload nginx
echo Reloading Nginx...
nssm restart lra_nginx >nul 2>&1
if errorlevel 1 (
    nssm start lra_nginx
)

echo.
echo === SSL Certificate installed successfully! ===
echo.
pause
