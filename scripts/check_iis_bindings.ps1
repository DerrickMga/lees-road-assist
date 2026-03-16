$ErrorActionPreference = 'Continue'
$log = 'C:\inetpub\wwwroot\lees-road-assist\backend\logs\iis-binding-check.txt'

"=== IIS binding check: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Out-File -FilePath $log -Encoding ASCII

sc.exe config WAS start= auto | Out-File -FilePath $log -Append -Encoding ASCII
sc.exe config W3SVC start= auto | Out-File -FilePath $log -Append -Encoding ASCII

Start-Service WAS -ErrorAction SilentlyContinue
Start-Service W3SVC -ErrorAction SilentlyContinue

"`n=== Service Status ===" | Out-File -FilePath $log -Append -Encoding ASCII
Get-Service WAS, W3SVC | Format-Table Name, Status, StartType -AutoSize | Out-String | Out-File -FilePath $log -Append -Encoding ASCII

"`n=== IIS Sites (appcmd) ===" | Out-File -FilePath $log -Append -Encoding ASCII
& "$env:windir\System32\inetsrv\appcmd.exe" list site /text:name,bindings,state | Out-File -FilePath $log -Append -Encoding ASCII

"`n=== netsh SSL cert (leesrca) ===" | Out-File -FilePath $log -Append -Encoding ASCII
netsh http show sslcert hostnameport=leesrca.kmgvitallinks.com:443 | Out-File -FilePath $log -Append -Encoding ASCII
netsh http show sslcert hostnameport=www.leesrca.kmgvitallinks.com:443 | Out-File -FilePath $log -Append -Encoding ASCII

"`n=== LISTENING 80/443 ===" | Out-File -FilePath $log -Append -Encoding ASCII
(netstat -ano -p tcp | Select-String 'LISTENING' | Select-String ':80\s|:443\s' | Out-String) | Out-File -FilePath $log -Append -Encoding ASCII

"DONE" | Out-File -FilePath $log -Append -Encoding ASCII
