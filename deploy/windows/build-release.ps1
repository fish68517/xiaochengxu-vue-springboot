param(
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ReleaseRoot = Join-Path $ProjectRoot 'release'
$StageRoot = Join-Path $ReleaseRoot 'stage'
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$ArchivePath = Join-Path $ReleaseRoot "elevator-release-$Timestamp.zip"
$MiniArchivePath = Join-Path $ReleaseRoot "elevator-mp-weixin-$Timestamp.zip"

function Invoke-NpmBuild {
    param([string]$Directory, [string]$Script)
    Push-Location $Directory
    try {
        if (-not $SkipInstall -and -not (Test-Path 'node_modules')) {
            & npm.cmd install
            if ($LASTEXITCODE -ne 0) { throw "npm install failed: $Directory" }
        }
        & npm.cmd run $Script
        if ($LASTEXITCODE -ne 0) { throw "npm run $Script failed: $Directory" }
    }
    finally {
        Pop-Location
    }
}

New-Item -ItemType Directory -Path $ReleaseRoot -Force | Out-Null
if (Test-Path $StageRoot) { Remove-Item -LiteralPath $StageRoot -Recurse -Force }
New-Item -ItemType Directory -Path $StageRoot -Force | Out-Null

Write-Host '[1/4] Building admin web with same-origin /api...'
$PreviousApiBase = $env:VITE_API_BASE_URL
$env:VITE_API_BASE_URL = '/api'
try {
    Invoke-NpmBuild -Directory (Join-Path $ProjectRoot 'admin-web') -Script 'build'
}
finally {
    $env:VITE_API_BASE_URL = $PreviousApiBase
}

Write-Host '[2/4] Building WeChat Mini Program...'
Invoke-NpmBuild -Directory (Join-Path $ProjectRoot 'miniprogram') -Script 'build:mp-weixin'

Write-Host '[3/4] Assembling server release package...'
$BackendTarget = Join-Path $StageRoot 'backend'
New-Item -ItemType Directory -Path $BackendTarget -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $ProjectRoot 'backend\app') -Destination $BackendTarget -Recurse
Copy-Item -LiteralPath (Join-Path $ProjectRoot 'backend\alembic') -Destination $BackendTarget -Recurse
Copy-Item -LiteralPath (Join-Path $ProjectRoot 'backend\alembic.ini') -Destination $BackendTarget
Copy-Item -LiteralPath (Join-Path $ProjectRoot 'backend\requirements.txt') -Destination $BackendTarget

$AdminTarget = Join-Path $StageRoot 'admin'
Copy-Item -LiteralPath (Join-Path $ProjectRoot 'admin-web\dist') -Destination $AdminTarget -Recurse

$DeployTarget = Join-Path $StageRoot 'deploy\windows'
New-Item -ItemType Directory -Path $DeployTarget -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'install-server.ps1') -Destination $DeployTarget
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'health-check.ps1') -Destination $DeployTarget

Get-ChildItem -LiteralPath $StageRoot -Directory -Filter '__pycache__' -Recurse -ErrorAction SilentlyContinue |
    Remove-Item -Recurse -Force
Get-ChildItem -LiteralPath $StageRoot -File -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -in @('.pyc','.pyo') } |
    Remove-Item -Force

if (Test-Path $ArchivePath) { Remove-Item -LiteralPath $ArchivePath -Force }
Compress-Archive -Path (Join-Path $StageRoot '*') -DestinationPath $ArchivePath -CompressionLevel Optimal

if (Test-Path $MiniArchivePath) { Remove-Item -LiteralPath $MiniArchivePath -Force }
Compress-Archive -Path (Join-Path $ProjectRoot 'miniprogram\dist\build\mp-weixin\*') -DestinationPath $MiniArchivePath -CompressionLevel Optimal

Write-Host '[4/4] Complete.'
Write-Host "Server release: $ArchivePath"
Write-Host "Mini Program package: $MiniArchivePath"
