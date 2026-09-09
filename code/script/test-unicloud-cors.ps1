[CmdletBinding()]
param(
    [string]$Origin = "https://h5.qmhyjoy.com",
    [string]$SpaceId = "mp-d55868c9-2e64-41c5-baf6-ecbb16b511be",
    [string]$Endpoint = "https://api.next.bspapp.com/client"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding

Add-Type -AssemblyName System.Net.Http

$payload = @{
    method = "serverless.auth.user.anonymousAuthorize"
    params = "{}"
    spaceId = $SpaceId
    timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
} | ConvertTo-Json -Compress

$client = New-Object System.Net.Http.HttpClient
$request = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Post, $Endpoint)
$null = $request.Headers.TryAddWithoutValidation("Origin", $Origin)
$request.Content = New-Object System.Net.Http.StringContent($payload, [System.Text.Encoding]::UTF8, "application/json")

try {
    $response = $client.SendAsync($request).GetAwaiter().GetResult()
    $allowOriginValues = $null
    $hasAllowOrigin = $response.Headers.TryGetValues("Access-Control-Allow-Origin", [ref]$allowOriginValues)
    $allowOrigin = if ($hasAllowOrigin) { ($allowOriginValues -join ",") } else { "" }

    Write-Host "检测来源：$Origin"
    Write-Host "HTTP 状态：$([int]$response.StatusCode)"
    Write-Host "Access-Control-Allow-Origin：$allowOrigin"

    if ($allowOrigin -eq $Origin -or $allowOrigin -eq "*") {
        Write-Host "通过：该域名已获得 uniCloud 跨域访问许可。" -ForegroundColor Green
        exit 0
    }

    Write-Host "未通过：请在 uniCloud 服务空间 $SpaceId 的跨域配置中，将 $($Origin -replace '^https?://', '') 添加为 Web 安全域名。" -ForegroundColor Red
    exit 2
}
finally {
    if ($request) { $request.Dispose() }
    if ($client) { $client.Dispose() }
}


