[CmdletBinding()]
param(
    [string]$ApiBaseUrl = '/api',
    [string]$OutputPath = ""
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$SourceRoot = Join-Path $ProjectRoot 'miniprogram'
$DistRoot = Join-Path $SourceRoot 'dist\build\h5'
$ReleaseRoot = Join-Path $ProjectRoot 'release'
$NpmCommand = (Get-Command 'npm.cmd' -ErrorAction Stop).Source
$TarCommand = (Get-Command 'tar.exe' -ErrorAction Stop).Source

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $ReleaseRoot 'elevator-h5-update.tar.gz'
}
else {
    $OutputPath = [System.IO.Path]::GetFullPath($OutputPath)
}

New-Item -ItemType Directory -Path (Split-Path -Parent $OutputPath) -Force | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $SourceRoot 'node_modules'))) {
    Push-Location $SourceRoot
    try {
        & $NpmCommand ci
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE" }
    }
    finally { Pop-Location }
}

$PreviousApiBaseUrl = $env:VITE_API_BASE_URL
Push-Location $SourceRoot
try {
    $env:VITE_API_BASE_URL = $ApiBaseUrl
    & $NpmCommand run build:h5
    if ($LASTEXITCODE -ne 0) { throw "H5 build failed with exit code $LASTEXITCODE" }
}
finally {
    Pop-Location
    if ($null -eq $PreviousApiBaseUrl) { Remove-Item Env:VITE_API_BASE_URL -ErrorAction SilentlyContinue }
    else { $env:VITE_API_BASE_URL = $PreviousApiBaseUrl }
}

if (-not (Test-Path -LiteralPath (Join-Path $DistRoot 'index.html'))) {
    throw "H5 build output is missing: $DistRoot"
}
if (Test-Path -LiteralPath $OutputPath) { Remove-Item -LiteralPath $OutputPath -Force }
& $TarCommand -czf $OutputPath -C $DistRoot '.'
if ($LASTEXITCODE -ne 0) { throw "tar.exe failed with exit code $LASTEXITCODE" }

$Package = Get-Item -LiteralPath $OutputPath
$Hash = (Get-FileHash -LiteralPath $OutputPath -Algorithm SHA256).Hash
Write-Host "H5 package: $($Package.FullName)"
Write-Host "API base URL: $ApiBaseUrl"
Write-Host "Size: $($Package.Length) bytes"
Write-Host "SHA256: $Hash"
