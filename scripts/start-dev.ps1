$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot '.runtime'
$backendDir = Join-Path $projectRoot 'backend'
$frontendDir = Join-Path $projectRoot 'apps\miniprogram'
$pythonExe = Join-Path $backendDir '.venv\Scripts\python.exe'
$nodeExe = (Get-Command 'node.exe' -ErrorAction Stop).Source
$uniScript = Join-Path $frontendDir 'node_modules\@dcloudio\vite-plugin-uni\bin\uni.js'

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

if (-not (Test-Path -LiteralPath $pythonExe)) {
    throw "Backend virtual environment not found: $pythonExe"
}
if (-not (Test-Path -LiteralPath $uniScript)) {
    throw "Frontend dependencies not installed: $uniScript"
}

$backendOut = Join-Path $runtimeDir 'backend.out.log'
$backendErr = Join-Path $runtimeDir 'backend.err.log'
$frontendOut = Join-Path $runtimeDir 'frontend.out.log'
$frontendErr = Join-Path $runtimeDir 'frontend.err.log'

$backend = Start-Process -FilePath $pythonExe `
    -ArgumentList '-m','uvicorn','app.main:app','--reload','--host','127.0.0.1','--port','8000' `
    -WorkingDirectory $backendDir -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $backendOut -RedirectStandardError $backendErr

$frontend = Start-Process -FilePath $nodeExe `
    -ArgumentList $uniScript,'--host','127.0.0.1','--port','5173' `
    -WorkingDirectory $frontendDir -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $frontendOut -RedirectStandardError $frontendErr

Set-Content -LiteralPath (Join-Path $runtimeDir 'backend.pid') -Value $backend.Id -Encoding ascii
Set-Content -LiteralPath (Join-Path $runtimeDir 'frontend.pid') -Value $frontend.Id -Encoding ascii

$backendReady = $false
$frontendReady = $false
for ($attempt = 0; $attempt -lt 40; $attempt++) {
    if (-not $backendReady) {
        try {
            $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 2
            $backendReady = $health.status -eq 'ok'
        } catch { }
    }
    if (-not $frontendReady) {
        try {
            $response = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing -TimeoutSec 2
            $frontendReady = $response.StatusCode -eq 200
        } catch { }
    }
    if ($backendReady -and $frontendReady) { break }
    Start-Sleep -Milliseconds 500
}

if (-not $backendReady -or -not $frontendReady) {
    Write-Host 'Development services did not become ready. Check logs:'
    Write-Host $backendErr
    Write-Host $frontendErr
    exit 1
}

Write-Host 'Pet Life Mall development environment is running.'
Write-Host 'H5:   http://127.0.0.1:5173/'
Write-Host 'API:  http://127.0.0.1:8000/docs'
Write-Host 'Stop: powershell -ExecutionPolicy Bypass -File .\scripts\stop-dev.ps1'
