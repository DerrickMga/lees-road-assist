@echo off
:: ============================================================
:: Quick update script — pull latest code and restart
:: ============================================================
echo Updating Lee's Road Assist...
set DOCKER_HOST=tcp://127.0.0.1:2375
git pull
docker-compose build --no-cache backend web
docker-compose up -d
docker-compose ps
echo Done!
pause
