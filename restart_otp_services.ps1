Restart-Service lra_backend -Force
Restart-Service lra_celery -Force
Start-Sleep -Seconds 5
Get-Service lra_backend, lra_celery | Format-Table Name, Status, StartType -AutoSize
