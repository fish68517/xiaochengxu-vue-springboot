[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('api', 'client', 'workbench', 'admin')]
    [string]$Component,

    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,

    [Parameter(Mandatory = $true)]
    [int]$Port,

    [string]$BindHost = '127.0.0.1',

    [string]$ApiBase = 'http://127.0.0.1:4176'
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

Set-Location -LiteralPath $ProjectRoot

$env:APP_ENV = 'development'
$env:API_MODE = 'local'
$env:PAYMENT_MODE = 'mock'
$env:MESSAGE_MODE = 'mock'
$env:BRAND_CODE = 'demo-a'
$env:VITE_API_BASE = $ApiBase
$env:VITE_BRAND_CODE = 'demo-a'
$env:VITE_BRAND_DISPLAY_NAME = '星河服务'
$env:VITE_WECHAT_APP_ID = 'wxdemoa20260001'
$env:VITE_PUBLIC_CHANNEL_ID = 'demo-a-mini-program'
$env:SESSION_SECRET = 'local-development-session-secret-change-before-production'
$env:H5_TOKEN_SECRET = 'local-development-h5-secret-change-before-production'

switch ($Component) {
    'api' {
        $env:PORT = [string]$Port
        $env:HOST = $BindHost
        & node 'scripts/api-server.mjs'
    }
    'client' {
        Set-Location -LiteralPath (Join-Path $ProjectRoot 'apps/client')
        & npm.cmd run dev:h5 -- --host $BindHost --port $Port --strictPort
    }
    'workbench' {
        Set-Location -LiteralPath (Join-Path $ProjectRoot 'apps/workbench')
        & npm.cmd run dev:h5 -- --host $BindHost --port $Port --strictPort
    }
    'admin' {
        Set-Location -LiteralPath (Join-Path $ProjectRoot 'apps/admin')
        & npm.cmd run dev:h5 -- --host $BindHost --port $Port --strictPort
    }
}

if ($LASTEXITCODE -ne 0) {
    throw "组件 $Component 异常退出，退出码：$LASTEXITCODE"
}
