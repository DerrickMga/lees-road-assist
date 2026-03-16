@echo off
:: ============================================================
:: Lee's Road Assist - Service Management
:: Usage: services.bat [start|stop|restart|status]
:: Must be run as Administrator for start/stop/restart.
:: ============================================================

set ACTION=%1
if "%ACTION%"=="" set ACTION=status

set SERVICES=lra_redis lra_backend lra_celery lra_whatsapp lra_web lra_nginx

if /i "%ACTION%"=="status" goto :status
if /i "%ACTION%"=="start"  goto :start
if /i "%ACTION%"=="stop"   goto :stop
if /i "%ACTION%"=="restart" goto :restart

echo Usage: services.bat [start^|stop^|restart^|status]
exit /b 1

:status
echo.
echo   Lee's Road Assist - Service Status
echo   ===================================
setlocal enabledelayedexpansion
for %%s in (%SERVICES%) do (
    sc query %%s 2>nul | findstr /C:"RUNNING" >nul
    if !errorlevel! equ 0 (
        echo   [RUNNING]  %%s
    ) else (
        sc query %%s 2>nul | findstr /C:"STOPPED" >nul
        if !errorlevel! equ 0 (
            echo   [STOPPED]  %%s
        ) else (
            echo   [MISSING]  %%s
        )
    )
)
endlocal
echo.
exit /b 0

:start
net session >nul 2>&1 || (echo ERROR: Run as Administrator! & exit /b 1)
echo Starting all LRA services...
for %%s in (%SERVICES%) do (
    echo   Starting %%s...
    net start %%s 2>nul
)
echo Done.
exit /b 0

:stop
net session >nul 2>&1 || (echo ERROR: Run as Administrator! & exit /b 1)
echo Stopping all LRA services...
for %%s in (lra_nginx lra_web lra_whatsapp lra_celery lra_backend lra_redis) do (
    echo   Stopping %%s...
    net stop %%s 2>nul
)
echo Done.
exit /b 0

:restart
net session >nul 2>&1 || (echo ERROR: Run as Administrator! & exit /b 1)
echo Restarting all LRA services...
call :stop
timeout /t 3 /nobreak >nul
call :start
exit /b 0
