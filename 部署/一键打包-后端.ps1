[CmdletBinding()]
param(
    [string]$OutputPath = ""
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ReleaseRoot = Join-Path $ProjectRoot 'release'
$StageRoot = Join-Path $ReleaseRoot '.backend-package-stage'
$TarCommand = (Get-Command 'tar.exe' -ErrorAction Stop).Source

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $ReleaseRoot 'elevator-backend-update.tar.gz'
}
else {
    $OutputPath = [System.IO.Path]::GetFullPath($OutputPath)
}

$OutputDirectory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $ReleaseRoot -Force | Out-Null

$resolvedRelease = (Resolve-Path $ReleaseRoot).Path.TrimEnd('\')
$fullStage = [System.IO.Path]::GetFullPath($StageRoot)
if (-not $fullStage.StartsWith($resolvedRelease + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Unsafe stage path: $fullStage"
}

if (Test-Path -LiteralPath $StageRoot) {
    Remove-Item -LiteralPath $StageRoot -Recurse -Force
}

try {
    $BackendTarget = Join-Path $StageRoot 'backend'
    New-Item -ItemType Directory -Path $BackendTarget -Force | Out-Null

    Copy-Item -LiteralPath (Join-Path $ProjectRoot 'backend\app') -Destination $BackendTarget -Recurse
    Copy-Item -LiteralPath (Join-Path $ProjectRoot 'backend\alembic') -Destination $BackendTarget -Recurse
    Copy-Item -LiteralPath (Join-Path $ProjectRoot 'backend\alembic.ini') -Destination $BackendTarget
    Copy-Item -LiteralPath (Join-Path $ProjectRoot 'backend\requirements.txt') -Destination $BackendTarget

    Get-ChildItem -LiteralPath $StageRoot -Directory -Filter '__pycache__' -Recurse -ErrorAction SilentlyContinue |
        Remove-Item -Recurse -Force
    Get-ChildItem -LiteralPath $StageRoot -File -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -in @('.pyc', '.pyo') } |
        Remove-Item -Force

    if (Test-Path -LiteralPath $OutputPath) {
        Remove-Item -LiteralPath $OutputPath -Force
    }
    & $TarCommand -czf $OutputPath -C $StageRoot 'backend'
    if ($LASTEXITCODE -ne 0) { throw "tar.exe failed with exit code $LASTEXITCODE" }
}
finally {
    if (Test-Path -LiteralPath $StageRoot) {
        Remove-Item -LiteralPath $StageRoot -Recurse -Force
    }
}

$Package = Get-Item -LiteralPath $OutputPath
$Hash = (Get-FileHash -LiteralPath $OutputPath -Algorithm SHA256).Hash
Write-Host "Backend package: $($Package.FullName)"
Write-Host "Size: $($Package.Length) bytes"
Write-Host "SHA256: $Hash"

