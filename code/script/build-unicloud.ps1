[CmdletBinding()]
param(
    [string]$BrandCode = $env:VITE_BRAND_CODE
)

$ErrorActionPreference = 'Stop'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
$PSDefaultParameterValues['*:Encoding'] = 'utf8'

$codeRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$apps = @(
    @{ Name = 'Client'; RelativePath = 'apps/client'; Output = 'apps/client/dist/build/h5' },
    @{ Name = 'Workbench'; RelativePath = 'apps/workbench'; Output = 'apps/workbench/dist/build/h5' },
    @{ Name = 'Admin'; RelativePath = 'apps/admin'; Output = 'apps/admin/dist/build/h5' }
)
$localMarkers = @('127.0.0.1', 'localhost', ':4176', ':5173', ':5174', ':5175')
$textExtensions = @('.html', '.js', '.css', '.json', '.map', '.txt', '.svg')
$exitCode = 0

$oldAppEnv = $env:VITE_APP_ENV
$oldApiMode = $env:VITE_API_MODE
$oldApiBase = $env:VITE_API_BASE
$oldBrandCode = $env:VITE_BRAND_CODE
$hadApiBase = Test-Path Env:VITE_API_BASE
$hadBrandCode = Test-Path Env:VITE_BRAND_CODE

function Invoke-NpmBuild {
    param([hashtable]$App)

    $appPath = Join-Path $codeRoot $App.RelativePath
    $packagePath = Join-Path $appPath 'package.json'
    $uniCliPath = Join-Path $appPath 'node_modules/.bin/uni.cmd'
    if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) {
        throw "缺少项目配置：$packagePath"
    }
    if (-not (Test-Path -LiteralPath $uniCliPath -PathType Leaf)) {
        throw "$($App.Name) 依赖未安装。请先在 $appPath 执行 npm install。"
    }

    Write-Host "[$($App.Name)] 正在执行生产构建..." -ForegroundColor Cyan
    & npm.cmd --prefix $appPath run build:prod
    if ($LASTEXITCODE -ne 0) {
        throw "[$($App.Name)] 构建失败，退出码：$LASTEXITCODE"
    }
}

try {
    if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) { throw '未找到 Node.js，请先安装并加入 PATH。' }
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw '未找到 npm，请先安装并加入 PATH。' }

    Set-Location -LiteralPath $codeRoot
    $env:VITE_APP_ENV = 'production'
    $env:VITE_API_MODE = 'unicloud'
    Remove-Item Env:VITE_API_BASE -ErrorAction SilentlyContinue
    if ([string]::IsNullOrWhiteSpace($BrandCode)) {
        Remove-Item Env:VITE_BRAND_CODE -ErrorAction SilentlyContinue
    } else {
        $env:VITE_BRAND_CODE = $BrandCode.Trim()
    }

    Write-Host '生产环境：uniCloud / game-service' -ForegroundColor Cyan
    foreach ($app in $apps) { Invoke-NpmBuild -App $app }

    $leaks = New-Object System.Collections.Generic.List[object]
    foreach ($app in $apps) {
        $outputPath = Join-Path $codeRoot $app.Output
        $indexPath = Join-Path $outputPath 'index.html'
        if (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) {
            throw "[$($app.Name)] 缺少构建入口：$indexPath"
        }

        $files = Get-ChildItem -LiteralPath $outputPath -Recurse -File |
            Where-Object { $textExtensions -contains $_.Extension.ToLowerInvariant() }
        foreach ($file in $files) {
            $content = [System.IO.File]::ReadAllText($file.FullName)
            foreach ($marker in $localMarkers) {
                if ($content.IndexOf($marker, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                    $relativeFile = $file.FullName.Substring($codeRoot.Length).TrimStart('\')
                    $leaks.Add([pscustomobject]@{
                        App = $app.Name
                        File = $relativeFile
                        Match = $marker
                    })
                }
            }
        }
    }

    if ($leaks.Count -gt 0) {
        Write-Host '发现本地开发地址残留：' -ForegroundColor Red
        $leaks | Format-Table -AutoSize | Out-Host
        throw "生产构建安全检查失败，共发现 $($leaks.Count) 个匹配。"
    }

    Write-Host ''
    Write-Host 'BUILD SUCCESS' -ForegroundColor Green
    foreach ($app in $apps) {
        Write-Host "$($app.Name)："
        Write-Host (Join-Path $codeRoot $app.Output)
        Write-Host '  localhost residue = 0'
        Write-Host '  127.0.0.1 residue = 0'
        Write-Host '  local port residue = 0'
    }
} catch {
    $exitCode = 1
    Write-Error $_
} finally {
    $env:VITE_APP_ENV = $oldAppEnv
    $env:VITE_API_MODE = $oldApiMode
    if ($hadApiBase) { $env:VITE_API_BASE = $oldApiBase } else { Remove-Item Env:VITE_API_BASE -ErrorAction SilentlyContinue }
    if ($hadBrandCode) { $env:VITE_BRAND_CODE = $oldBrandCode } else { Remove-Item Env:VITE_BRAND_CODE -ErrorAction SilentlyContinue }
    Set-Location -LiteralPath $codeRoot
}

exit $exitCode
