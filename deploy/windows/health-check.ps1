param(
    [string]$BaseUrl = 'http://127.0.0.1'
)

$ErrorActionPreference = 'Stop'
$Health = Invoke-RestMethod -Uri "$BaseUrl/api/health" -TimeoutSec 15
if ($Health.code -ne 0 -or $Health.data.status -ne 'ok') {
    throw "Health check failed: $($Health | ConvertTo-Json -Depth 5 -Compress)"
}

Write-Host 'Health check passed:'
$Health.data | Format-List
