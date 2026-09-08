[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptRoot
$RuntimeRoot = Join-Path $ProjectRoot '.runtime/local-dev'
$StateFile = Join-Path $RuntimeRoot 'processes.json'

function Get-DescendantProcessIds {
    param([int]$ParentId)
    $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$ParentId" -ErrorAction SilentlyContinue)
    $ids = @()
    foreach ($child in $children) {
        $ids += Get-DescendantProcessIds -ParentId ([int]$child.ProcessId)
        $ids += [int]$child.ProcessId
    }
    return $ids
}

if (-not (Test-Path -LiteralPath $StateFile)) {
    Write-Host '未发现由启动脚本记录的本地服务，不会终止其他进程。' -ForegroundColor Yellow
    exit 0
}

$state = Get-Content -LiteralPath $StateFile -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($entry in @($state.processes)) {
    $process = Get-Process -Id $entry.pid -ErrorAction SilentlyContinue
    if (-not $process) {
        Write-Host ("已停止：{0}" -f $entry.label)
        continue
    }
    $descendants = @(Get-DescendantProcessIds -ParentId ([int]$entry.pid))
    foreach ($childId in $descendants) {
        Stop-Process -Id $childId -Force -ErrorAction SilentlyContinue
    }
    Stop-Process -Id $entry.pid -Force -ErrorAction SilentlyContinue
    Write-Host ("已停止：{0}（PID {1}）" -f $entry.label, $entry.pid) -ForegroundColor Green
}

Remove-Item -LiteralPath $StateFile -Force
Write-Host '本地多品牌服务平台已全部停止。' -ForegroundColor Green
