# Obtain Let's Encrypt SSL certificate
# Run with: Start-Process powershell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File C:\inetpub\wwwroot\lees-road-assist\obtain_ssl.ps1"

$ErrorActionPreference = "Continue"
$LraRoot = "C:\inetpub\wwwroot\lees-road-assist"
$NginxDir = "C:\nginx"
$domain = "leesrca.kmgvitallinks.com"
$certbot = "C:\Users\Administrator\AppData\Roaming\Python\Python313\Scripts\certbot.exe"
$Nssm = "C:\ProgramData\chocolatey\bin\nssm.exe"

$logFile = Join-Path $LraRoot "backend\logs\ssl-obtain.log"
Start-Transcript -Path $logFile -Force

Write-Host "=== Obtaining Let's Encrypt SSL ===" -ForegroundColor Cyan

# Ensure ACME challenge directory exists
$acmeDir = "$NginxDir\html\acme"
New-Item -ItemType Directory -Path $acmeDir -Force | Out-Null

# Run certbot with webroot plugin
Write-Host "Running certbot..."
& $certbot certonly --webroot `
    -w $acmeDir `
    -d $domain `
    --agree-tos `
    --email admin@kmgvitallinks.com `
    --non-interactive `
    --no-eff-email 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Certificate obtained!" -ForegroundColor Green
    
    # Copy certs to nginx ssl directory
    $certDir = "C:\Certbot\live\$domain"
    Copy-Item "$certDir\fullchain.pem" "$NginxDir\conf\ssl\fullchain.pem" -Force
    Copy-Item "$certDir\privkey.pem" "$NginxDir\conf\ssl\privkey.pem" -Force
    Write-Host "Certificates installed." -ForegroundColor Green
    
    # Reload nginx
    & $Nssm restart lra_nginx 2>&1 | Out-Null
    Start-Sleep -Seconds 3
    Write-Host "Nginx restarted." -ForegroundColor Green
} else {
    Write-Host "Certbot failed. Keeping self-signed certificate." -ForegroundColor Yellow
}

"SSL_DONE $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File "$LraRoot\backend\logs\ssl-status.txt" -Encoding ASCII
Write-Host "=== Done ===" -ForegroundColor Green
Stop-Transcript
