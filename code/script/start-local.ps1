[CmdletBinding()]
param(
    [switch]$InstallDependencies,
    [switch]$OpenBrowser,
    [switch]$LanAccess,
    [string]$LanIp = '',
    [switch]$ConfigureFirewall,
    [int]$WaitSeconds = 90
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptRoot
$RuntimeRoot = Join-Path $ProjectRoot '.runtime/local-dev'
$LogRoot = Join-Path $RuntimeRoot 'logs'
$StateFile = Join-Path $RuntimeRoot 'processes.json'
$Runner = Join-Path $ScriptRoot 'run-component.ps1'
$PowerShellExe = (Get-Process -Id $PID).Path

function Get-PreferredLanIPv4 {
    $addresses = @(Get-NetIPConfiguration -ErrorAction SilentlyContinue |
        Where-Object { $_.NetAdapter.Status -eq 'Up' -and $_.IPv4DefaultGateway } |
        ForEach-Object {
            $alias = $_.InterfaceAlias
            foreach ($address in @($_.IPv4Address.IPAddress)) {
                if ($address -match '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)') {
                    [pscustomobject]@{
                        Address = $address
                        Priority = if ($alias -match 'WLAN|Wi-Fi|无线') { 0 } else { 1 }
                    }
                }
            }
        } | Sort-Object Priority, Address)
    if ($addresses.Count -eq 0) { return '' }
    return [string]$addresses[0].Address
}

if ($LanAccess) {
    if (-not $LanIp) { $LanIp = Get-PreferredLanIPv4 }
    if (-not $LanIp -or $LanIp -notmatch '^\d{1,3}(\.\d{1,3}){3}$') {
        throw '无法自动识别局域网 IPv4 地址，请使用 -LanIp 192.168.x.x 明确指定本机 WiFi 地址。'
    }
}

$ApiHost = if ($LanAccess) { $LanIp } else { '127.0.0.1' }
$ApiBase = "http://${ApiHost}:4176"
$ClientHost = if ($LanAccess) { $LanIp } else { '127.0.0.1' }
$PublicBindHost = if ($LanAccess) { '0.0.0.0' } else { '127.0.0.1' }

$Components = @(
    [pscustomobject]@{ Name = 'api'; Label = '本地 API'; Port = 4176; BindHost = $PublicBindHost; Url = "$ApiBase/api/getBrandConfig" },
    [pscustomobject]@{ Name = 'client'; Label = '客户 H5'; Port = 5173; BindHost = $PublicBindHost; Url = "http://${ClientHost}:5173/#/pages/index/index" },
    [pscustomobject]@{ Name = 'workbench'; Label = '客服/接单工作台'; Port = 5174; BindHost = '127.0.0.1'; Url = 'http://127.0.0.1:5174/workbench/#/pages/login/index' },
    [pscustomobject]@{ Name = 'admin'; Label = '管理后台'; Port = 5175; BindHost = '127.0.0.1'; Url = 'http://127.0.0.1:5175/admin/#/pages/login/index' }
)

function Test-PortListening {
    param([int]$Port)
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $task = $client.ConnectAsync('127.0.0.1', $Port)
        if (-not $task.Wait(500)) { return $false }
        return $client.Connected
    }
    catch { return $false }
    finally { $client.Dispose() }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw '未找到 node，请先安装 Node.js 20/22 LTS 并重新打开 PowerShell。'
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw '未找到 npm.cmd，请检查 Node.js/npm 安装。'
}
if (-not (Test-Path -LiteralPath $Runner)) {
    throw "缺少组件启动器：$Runner"
}

if ($LanAccess -and $ConfigureFirewall) {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    $isAdministrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if ($isAdministrator) {
        $ruleName = '多品牌服务平台-局域网演示'
        $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
        if (-not $existingRule) {
            New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow `
                -Protocol TCP -LocalPort 4176,5173 -RemoteAddress LocalSubnet `
                -Profile Private,Public | Out-Null
            Write-Host '已创建局域网防火墙规则，仅允许本地子网访问 4176、5173 端口。' -ForegroundColor Green
        }
    }
    else {
        Write-Warning '当前 PowerShell 不是管理员，无法自动创建防火墙规则。如手机仍打不开，请以管理员身份重新运行。'
    }
}

New-Item -ItemType Directory -Path $LogRoot -Force | Out-Null

if (Test-Path -LiteralPath $StateFile) {
    $oldState = Get-Content -LiteralPath $StateFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $alive = @($oldState.processes | Where-Object { Get-Process -Id $_.pid -ErrorAction SilentlyContinue })
    if ($alive.Count -gt 0) {
        Write-Host '本地环境已经运行。如需重启，请先执行 .\script\stop-local.ps1。' -ForegroundColor Yellow
        foreach ($component in $Components) {
            Write-Host ("{0,-18} {1}" -f $component.Label, $component.Url)
        }
        exit 0
    }
    Remove-Item -LiteralPath $StateFile -Force
}

$occupied = @($Components | Where-Object { Test-PortListening -Port $_.Port })
if ($occupied.Count -gt 0) {
    $ports = ($occupied | ForEach-Object { "端口 $($_.Port)（$($_.Label)）" }) -join '、'
    throw "$ports 已被其他进程占用。请释放端口后重试，脚本不会终止未知进程。"
}

if ($InstallDependencies) {
    Write-Host '正在安装依赖，请稍候……' -ForegroundColor Cyan
    Push-Location $ProjectRoot
    try {
        & npm.cmd install
        if ($LASTEXITCODE -ne 0) { throw '根目录依赖安装失败。' }
        foreach ($app in @('client', 'workbench', 'admin')) {
            & npm.cmd install --prefix "apps/$app"
            if ($LASTEXITCODE -ne 0) { throw "$app 依赖安装失败。" }
        }
    }
    finally { Pop-Location }
}

foreach ($required in @(
    'node_modules',
    'apps/client/node_modules',
    'apps/workbench/node_modules',
    'apps/admin/node_modules'
)) {
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot $required))) {
        throw "缺少依赖目录 $required。请使用 -InstallDependencies 参数重新运行。"
    }
}

$started = @()
try {
    foreach ($component in $Components) {
        $stdout = Join-Path $LogRoot "$($component.Name).out.log"
        $stderr = Join-Path $LogRoot "$($component.Name).err.log"
        $arguments = @(
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-File', $Runner,
            '-Component', $component.Name,
            '-ProjectRoot', $ProjectRoot,
            '-Port', [string]$component.Port,
            '-BindHost', $component.BindHost,
            '-ApiBase', $ApiBase
        )
        $process = Start-Process -FilePath $PowerShellExe `
            -ArgumentList $arguments `
            -WindowStyle Hidden `
            -RedirectStandardOutput $stdout `
            -RedirectStandardError $stderr `
            -PassThru
        $started += [pscustomobject]@{
            name = $component.Name
            label = $component.Label
            port = $component.Port
            url = $component.Url
            pid = $process.Id
            stdout = $stdout
            stderr = $stderr
        }
        Write-Host ("已启动：{0}（PID {1}）" -f $component.Label, $process.Id) -ForegroundColor Cyan
    }

    $state = [pscustomobject]@{
        startedAt = [DateTime]::UtcNow.ToString('o')
        projectRoot = $ProjectRoot
        processes = $started
    }
    $state | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $StateFile -Encoding UTF8

    $deadline = [DateTime]::UtcNow.AddSeconds($WaitSeconds)
    do {
        $pending = @($Components | Where-Object { -not (Test-PortListening -Port $_.Port) })
        if ($pending.Count -eq 0) { break }
        foreach ($entry in $started) {
            if (-not (Get-Process -Id $entry.pid -ErrorAction SilentlyContinue)) {
                $errorText = if (Test-Path -LiteralPath $entry.stderr) {
                    Get-Content -LiteralPath $entry.stderr -Raw -Encoding UTF8
                } else { '' }
                throw "$($entry.label) 启动进程已经退出。$errorText"
            }
        }
        Start-Sleep -Milliseconds 500
    } while ([DateTime]::UtcNow -lt $deadline)

    if ($pending.Count -gt 0) {
        throw "等待服务启动超时：$(($pending.Label) -join '、')。请检查 $LogRoot 下的日志。"
    }

    Write-Host ''
    Write-Host '本地多品牌服务平台已启动成功。' -ForegroundColor Green
    foreach ($component in $Components | Where-Object { $_.Name -ne 'api' }) {
        Write-Host ("{0,-18} {1}" -f $component.Label, $component.Url)
    }
    Write-Host ("{0,-18} {1}" -f 'API 地址', $ApiBase)
    if ($LanAccess) {
        Write-Host ("{0,-18} {1}" -f '手机客户分类页', "http://${LanIp}:5173/#/pages/category/index") -ForegroundColor Green
        Write-Host '请确保手机和电脑位于同一 WiFi，手机不要再使用 127.0.0.1。' -ForegroundColor Yellow
    }
    Write-Host ("{0,-18} {1}" -f '日志目录', $LogRoot)
    Write-Host ''
    Write-Host '停止服务：powershell -ExecutionPolicy Bypass -File .\script\stop-local.ps1'

    if ($OpenBrowser) {
        Start-Process ($Components[1].Url)
        Start-Process ($Components[2].Url)
        Start-Process ($Components[3].Url)
    }
}
catch {
    Write-Error $_
    if (Test-Path -LiteralPath $StateFile) {
        Write-Host '启动未完成，可执行 stop-local.ps1 清理已启动的进程。' -ForegroundColor Yellow
    }
    exit 1
}
