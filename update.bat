@echo off
:: ============================================================
:: Quick update script — pull latest code and restart
:: ============================================================
echo Updating Lee's Road Assist...
git pull
docker compose build --no-cache backend web
docker compose up -d
docker compose ps
echo Done!
pause
