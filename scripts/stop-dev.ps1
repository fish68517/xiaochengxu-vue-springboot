$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot '.runtime'

function Stop-ProcessTree {
    param([int]$RootProcessId)

    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$RootProcessId" -ErrorAction SilentlyContinue
    foreach ($child in $children) {
        Stop-ProcessTree -RootProcessId $child.ProcessId
    }
    Stop-Process -Id $RootProcessId -Force -ErrorAction SilentlyContinue
}

foreach ($name in @('admin', 'frontend', 'backend')) {
    $pidPath = Join-Path $runtimeDir "$name.pid"
    if (Test-Path -LiteralPath $pidPath) {
        $processId = [int](Get-Content -LiteralPath $pidPath -Raw)
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
        $expectedPattern = switch ($name) {
            'backend' { 'uvicorn.+app\.main:app' }
            'frontend' { 'uni\.js.+5173' }
            'admin' { 'vite\.js.+5174' }
        }
        if ($process -and $process.CommandLine -match $expectedPattern) {
            Stop-ProcessTree -RootProcessId $processId
            Write-Host "Stopped $name (PID $processId)"
        } elseif ($process) {
            Write-Host "Skipped stale $name PID $processId (process does not belong to this project)"
        }
    }
}
