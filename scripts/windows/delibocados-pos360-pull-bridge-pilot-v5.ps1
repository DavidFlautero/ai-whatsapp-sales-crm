<#
POS360 / SmartPOS Windows connector: pull verified Neuromind QR orders once and
hand them to a LOCAL NATIVE ADAPTER. Does not write SmartPOS MySQL itself.

Your adapter MUST be a tested, vendor-compatible script that accepts:
  -JobPath <local UTF-8 JSON path>
and outputs exactly one JSON object:
 {"outcome":"accepted","externalOrderId":"POS360_NATIVE_ORDER_ID"}
or {"outcome":"rejected"} or {"outcome":"unknown"}.
Only report accepted after SmartPOS explicitly returns a durable order receipt.
Sending to a printer or a success HTTP status without a POS order ID is NOT
accepted by POS360. Unknown results are never blindly resent.

Do not run until a tested native SmartPOS adapter and reviewed SKU mappings
are installed. Use -Once for a single controlled test before running as a service.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$AdapterScript,
  [Parameter(Mandatory=$true)][string]$BridgeKeyFile,
  [string]$BaseUrl="https://panel.delibocados.online/api/public/delibocados-pos360-bridge",
  [switch]$RunPilotOnce,
  [switch]$Once,
  [int]$PollSeconds=7
)
$ErrorActionPreference="Stop"
if(-not (Test-Path -LiteralPath $AdapterScript -PathType Leaf)){
  throw "BLOQUEADO: no existe el adaptador nativo SmartPOS validado. No se reclamó ninguna comanda."
}
if(-not (Test-Path -LiteralPath $BridgeKeyFile -PathType Leaf)){
  throw "BLOQUEADO: falta clave privada del puente. No se reclamó ninguna comanda."
}
if($PollSeconds -lt 5){throw "BLOQUEADO: intervalo mínimo 5 segundos."}
$allowedBase="https://panel.delibocados.online/api/public/delibocados-pos360-bridge"
if($BaseUrl.TrimEnd("/") -ne $allowedBase){
  throw "BLOQUEADO: por seguridad solo se acepta el dominio de producción previsto."
}
$bridgeKey=(Get-Content -LiteralPath $BridgeKeyFile -Raw).Trim()
if($bridgeKey -notmatch '^[A-Za-z0-9_-]{40,128}$'){
  throw "BLOQUEADO: formato de clave inválido."
}
$headers=@{ "x-deli-pos360-bridge-key"=$bridgeKey }
$uri=$allowedBase.TrimEnd("/")

function Call-Bridge([string]$endpoint,[object]$payload){
  return Invoke-RestMethod -Uri "$uri/$endpoint" -Method Post -Headers $headers `
      -Body ($payload | ConvertTo-Json -Depth 24 -Compress) `
      -ContentType "application/json" -TimeoutSec 20
}
# Check before claiming, to avoid reserving an order on an offline channel.
$health=Call-Bridge "health" @{}
if($health.ok -ne $true){throw "BLOQUEADO: puente no autenticado."}
Write-Host "POS360: puente autenticado. Ninguna aceptación/impresión se presume."
if(-not $RunPilotOnce){
  Write-Host "PILOTO_EN_MODO_SOLO_HEALTH: NO SE RECLAMO NINGUN PEDIDO."
  return
}
if(-not $Once){throw "PILOTO_REQUIERE_-Once: no hay sondeo continuo en esta fase."}
if([IO.Path]::GetFileName($AdapterScript) -ne "SmartPOS-Adapter-v5.ps1"){
  throw "PILOTO_REQUIERE_ADAPTADOR_V5_PROBADO"
}
$confirmation=Read-Host "Escribe RECLAMAR-PILOTO-VERIFICADO"
if($confirmation -cne "RECLAMAR-PILOTO-VERIFICADO"){
  throw "CANCELADO_SIN_CLAIM"
}

do{
  $job=$null
  try {
    $claimed=Call-Bridge "claim-pilot" @{}
    if($claimed.ok -ne $true){throw "Error consultando cola."}
    $job=$claimed.job
  } catch {
    # A failed claim may have reserved a job; never blindly retry it.
    throw "RESULTADO DE CLAIM INCIERTO. Revisar outbox en Neuromind. No reintentar sin conciliar."
  }

  if($null -ne $job){
    $tmp=Join-Path $env:TEMP ("dlb-pos360-"+[guid]::NewGuid().ToString("N")+".json")
    $outcome="unknown";$receiptId=$null
    try{
      if($job.externalReference -notmatch '^delibocados-qr-[a-f0-9-]{36}$'){
        throw "Referencia externa incompatible."
      }
      if($job.tableId -notmatch '^[a-f0-9-]{36}$' -or
         $job.items.Count -lt 1){throw "Comanda incompleta."}
      $job | ConvertTo-Json -Depth 24 | Set-Content -LiteralPath $tmp -Encoding UTF8
      # Adapter must be implemented against SmartPOS's actual interface.
      # No SQL writes or generic POST guessing is performed here.
      $output=@(& $AdapterScript -JobPath $tmp -Mode Dispatch)
      if($LASTEXITCODE -and $LASTEXITCODE -ne 0){throw "Adaptador devolvió fallo."}
      $result=($output -join "") | ConvertFrom-Json -ErrorAction Stop
      if($result.outcome -notin @("accepted","rejected","unknown")){
        throw "Resultado del adaptador incompatible."
      }
      if($result.outcome -eq "accepted"){
        if([string]::IsNullOrWhiteSpace([string]$result.externalOrderId)){
          throw "Sin comprobante nativo, no se puede confirmar aceptación."
        }
        $receiptId=[string]$result.externalOrderId
      }
      $outcome=[string]$result.outcome
    } catch {
      # If the local adapter might have sent, preserve UNKNOWN for manual reconciliation.
      Write-Warning "Resultado nativo desconocido: verificar POS360 antes de otro intento."
      $outcome="unknown";$receiptId=$null
    } finally{
      if(Test-Path -LiteralPath $tmp){Remove-Item -LiteralPath $tmp -Force}
    }
    try {
      $ack=@{exportId=[string]$job.exportId;outcome=$outcome}
      if($outcome -eq "accepted"){$ack.externalOrderId=$receiptId}
      $saved=Call-Bridge "ack" $ack
      if($saved.ok -ne $true){throw "Acuse no confirmado."}
      Write-Host ("Comanda "+$job.orderNumber+": "+$outcome+
        " (POS360 requiere verificar impresión física aparte)")
    } catch {
      throw "ACK INCIERTO: revisar exportId en VPS y POS360. Nunca repetir automáticamente."
    }
  }
  if(-not $Once){Start-Sleep -Seconds $PollSeconds}
} while(-not $Once)
