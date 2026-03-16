# Lee's Road Assist - Elevated Deployment Script
# Output is logged to deploy.log
$logFile = "C:\inetpub\wwwroot\lees-road-assist\deploy.log"
Start-Transcript -Path $logFile -Force

Set-Location "C:\inetpub\wwwroot\lees-road-assist"

Write-Host "=== Lee's Road Assist Deployment ==="
Write-Host "User: $(whoami)"
Write-Host "Time: $(Get-Date)"
Write-Host ""

# Step 1: Stop IIS to free ports 80/443
Write-Host "[1/6] Stopping IIS..."
try {
    Stop-Service W3SVC -Force -ErrorAction Stop
    Write-Host "  W3SVC stopped."
} catch {
    Write-Host "  WARNING: Could not stop W3SVC: $_"
}
try {
    Stop-Service WAS -Force -ErrorAction Stop
    Write-Host "  WAS stopped."
} catch {
    Write-Host "  WARNING: Could not stop WAS: $_"
}

# Step 2: Disable IIS auto-start
Write-Host "[2/6] Disabling IIS auto-start..."
try {
    Set-Service W3SVC -StartupType Disabled -ErrorAction Stop
    Write-Host "  IIS disabled."
} catch {
    Write-Host "  WARNING: Could not disable W3SVC: $_"
}

# Step 3: Verify ports are free
Write-Host "[3/6] Checking ports..."
$port80 = netstat -ano | Select-String ":80\s.*LISTENING"
$port443 = netstat -ano | Select-String ":443\s.*LISTENING"
Write-Host "  Port 80: $port80"
Write-Host "  Port 443: $port443"

# Step 4: Pull and build Docker images
Write-Host "[4/6] Building Docker services..."
docker-compose pull --ignore-buildable 2>&1
docker-compose build --no-cache 2>&1

# Step 5: Start DB and Redis first
Write-Host "[5/6] Starting database and Redis..."
docker-compose up -d db redis
Start-Sleep -Seconds 15

# Step 6: Run migrations and start all services
Write-Host "[6/6] Running migrations and starting all services..."
docker-compose run --rm backend alembic upgrade head 2>&1
docker-compose up -d

Write-Host ""
Write-Host "=== Waiting for services... ==="
Start-Sleep -Seconds 20
docker-compose ps

Write-Host ""
Write-Host "=== Deployment Complete ==="
Write-Host "Open: https://leesrca.kmgvitallinks.com"

Stop-Transcript
