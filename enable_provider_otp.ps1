Set-Service SMTPSVC -StartupType Automatic
Start-Service SMTPSVC
Restart-Service lra_backend -Force
Restart-Service lra_celery -Force
Start-Sleep -Seconds 8
Get-Service SMTPSVC, lra_backend, lra_celery | Format-Table Name, Status, StartType -AutoSize
