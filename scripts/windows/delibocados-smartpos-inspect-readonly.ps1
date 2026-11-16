<#
READ ONLY: locate the locally installed SmartPOS 3.9.9 runtime, listeners and
Windows kitchen printers. Does not read or display credentials and does not
run SQL, modify POS tables, generate tickets, print or open firewall ports.

Run in PowerShell on the Windows machine where SmartPOS is installed.
#>
$ErrorActionPreference="Continue"
Write-Host "=== DELIBOCADOS: SMARTPOS WINDOWS / PUENTE (SOLO LECTURA) ==="
$root=Join-Path $env:USERPROFILE "Downloads\SmartPOS-Laboratorio"
foreach($path in @(
 (Join-Path $root "smartpos-3.9.9"),
 (Join-Path $root "motor\smartpos_db\bin\mysql.exe"),
 "C:\SmartPOS","C:\POS360"
)){
 Write-Host ("RUTA: "+$path+" | "+$(if(Test-Path $path){"EXISTE"}else{"AUSENTE"}))
}
Write-Host "=== PROCESOS POS/Java (sin parámetros privados) ==="
Get-CimInstance Win32_Process |
 Where-Object {$_.Name -match 'smartpos|javaw?|mysql|printserver|pos360'} |
 Select-Object Name,ProcessId,ExecutablePath | Format-Table -AutoSize
Write-Host "=== PUERTOS LOCALES DE POS/HTTP ==="
if(Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue){
 Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
   Where-Object {$_.LocalPort -in @(3306,3307,8080,8081,8181,8765,9000,9090,9191,3000)} |
   Select-Object LocalAddress,LocalPort,OwningProcess | Format-Table -AutoSize
}
Write-Host "=== IMPRESORAS INSTALADAS (sin imprimir) ==="
if(Get-Command Get-Printer -ErrorAction SilentlyContinue){
 Get-Printer -ErrorAction SilentlyContinue |
   Select-Object Name,DriverName,PortName,PrinterStatus | Format-Table -AutoSize
}
Write-Host "=== COMPONENTES DE LA INSTALACION (solo nombres) ==="
$dir=Join-Path $root "smartpos-3.9.9"
if(Test-Path $dir){
 Get-ChildItem -Path $dir -File -Recurse -Depth 2 -ErrorAction SilentlyContinue |
   Where-Object {$_.Extension -in @(".jar",".exe",".dll",".cmd",".ps1",".properties")} |
   Select-Object -First 35 @{Name="Ruta";Expression={$_.FullName.Replace($env:USERPROFILE,"~")}},Length |
   Format-Table -AutoSize
}
Write-Host "=== FIN: no hubo conexión al servidor, consulta SQL ni impresión ==="
