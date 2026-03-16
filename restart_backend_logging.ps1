Restart-Service lra_backend -Force
Start-Sleep -Seconds 8
Get-Service lra_backend | Format-Table Name, Status, StartType -AutoSize
