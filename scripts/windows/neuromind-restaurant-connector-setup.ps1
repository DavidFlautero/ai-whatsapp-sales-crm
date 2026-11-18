<#
Neuromind multi-tenant restaurant connector bootstrap.
Only prepares a local, disabled manifest; no network, SQL, QR activation or POS writes.
Usage: .\neuromind-restaurant-connector-setup.ps1 -CompanyId restaurante-demo -ApiBaseUrl https://panel.example.com/api
Use -WhatIf to preview. Never put API secrets or vendor passwords on the command line.
#>
[CmdletBinding(SupportsShouldProcess=$true)]
param(
    [Parameter(Mandatory=$true)][string]$CompanyId,
    [Parameter(Mandatory=$true)][string]$ApiBaseUrl
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ($CompanyId -cnotmatch '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$') {
    throw "INVALID_COMPANY_ID: use lowercase letters, digits and hyphens."
}

$url = $null
if (-not [Uri]::TryCreate($ApiBaseUrl, [UriKind]::Absolute, [ref]$url)) {
    throw "INVALID_API_URL"
}
if ($url.Scheme -ne "https" -or [string]::IsNullOrWhiteSpace($url.DnsSafeHost) -or
    $url.UserInfo -ne "" -or $url.Query -ne "" -or $url.Fragment -ne "") {
    throw "HTTPS_API_URL_REQUIRED"
}

$normalized = $url.AbsoluteUri.TrimEnd("/")
$folder = Join-Path $env:LOCALAPPDATA ("Neuromind\RestaurantConnectors\" + $CompanyId)
$manifestPath = Join-Path $folder "manifest.json"

if (Test-Path -LiteralPath $manifestPath -PathType Leaf) {
    $existing = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($existing.companyId -cne $CompanyId -or $existing.apiBaseUrl -cne $normalized) {
        throw "TENANT_MANIFEST_CONFLICT: existing configuration was NOT overwritten."
    }
    Write-Host "MANIFEST_ALREADY_EXISTS=YES"
    Write-Host "CONFIG_CHANGED=NO"
    Write-Host "AUTO_START=OFF; MYSQL_WRITE=OFF; QR=OFF; FISCAL=OFF"
    return
}

$manifest = [ordered]@{
    schemaVersion = 1
    companyId = $CompanyId
    apiBaseUrl = $normalized
    state = "prepared-disabled"
    installedAtUtc = [DateTime]::UtcNow.ToString("o")
    connector = [ordered]@{
        provider = "pos360"
        protocol = "claim-ack"
        running = $false
        nativeAcceptanceVerified = $false
        kitchenVerified = $false
        mappingReviewed = $false
    }
    features = [ordered]@{
        qr = $false
        whatsapp = $false
        fiscal = $false
        posBridge = $false
    }
}
if ($PSCmdlet.ShouldProcess($manifestPath, "Create DISABLED tenant manifest")) {
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
    $payload = $manifest | ConvertTo-Json -Depth 10
    $tmpPath = $manifestPath + "." + [Guid]::NewGuid().ToString("N") + ".tmp"
    try {
        [IO.File]::WriteAllText(
            $tmpPath, $payload + [Environment]::NewLine,
            (New-Object System.Text.UTF8Encoding($false))
        )
        Move-Item -LiteralPath $tmpPath -Destination $manifestPath -ErrorAction Stop
    } finally {
        if (Test-Path -LiteralPath $tmpPath) {
            Remove-Item -LiteralPath $tmpPath -Force
        }
    }
    Write-Host "MANIFEST_PREPARED=YES"
    Write-Host ("COMPANY_ID=" + $CompanyId)
    Write-Host ("CONFIG_PATH=" + $manifestPath)
    Write-Host "AUTO_START=OFF; MYSQL_WRITE=OFF; QR=OFF; FISCAL=OFF"
    Write-Host "NATIVE_SMARTPOS_RECEIPT_REQUIRED=YES"
}
