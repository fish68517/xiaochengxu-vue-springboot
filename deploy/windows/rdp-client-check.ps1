[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$ServerAddress,
    [ValidateRange(1, 65535)]
    [int]$Port = 3389,
    [ValidateNotNullOrEmpty()]
    [string]$UserName = 'Administrator',
    [switch]$ResetSavedCredential,
    [switch]$NoLaunch
)

$ErrorActionPreference = 'Stop'

function Test-TcpPort {
    param(
        [string]$HostName,
        [int]$RemotePort,
        [int]$TimeoutMilliseconds = 5000
    )

    $Client = [System.Net.Sockets.TcpClient]::new()
    try {
        $AsyncResult = $Client.BeginConnect($HostName, $RemotePort, $null, $null)
        if (-not $AsyncResult.AsyncWaitHandle.WaitOne($TimeoutMilliseconds)) {
            return $false
        }
        $Client.EndConnect($AsyncResult)
        return $true
    }
    catch {
        return $false
    }
    finally {
        $Client.Dispose()
    }
}

$Mstsc = Join-Path $env:WINDIR 'System32\mstsc.exe'
if (-not (Test-Path -LiteralPath $Mstsc)) {
    throw "Remote Desktop client was not found: $Mstsc"
}

$Target = "TERMSRV/$ServerAddress"
if ($ResetSavedCredential) {
    & cmdkey.exe "/delete:$Target" | Out-Null
}

$RdpRoot = Join-Path $env:LOCALAPPDATA 'ElevatorRdp'
New-Item -ItemType Directory -Path $RdpRoot -Force | Out-Null
$SafeName = ($ServerAddress -replace '[^a-zA-Z0-9._-]', '_')
$RdpFile = Join-Path $RdpRoot "TencentCloud-$SafeName.rdp"
$FullAddress = if ($Port -eq 3389) { $ServerAddress } else { "${ServerAddress}:$Port" }

$RdpContent = @(
    "full address:s:$FullAddress"
    "username:s:$UserName"
    'prompt for credentials:i:1'
    'promptcredentialonce:i:0'
    'authentication level:i:2'
    'enablecredsspsupport:i:1'
    'negotiate security layer:i:1'
    'redirectclipboard:i:1'
    'redirectdrives:i:0'
    'screen mode id:i:2'
)
Set-Content -LiteralPath $RdpFile -Value $RdpContent -Encoding Unicode

$TcpOk = Test-TcpPort -HostName $ServerAddress -RemotePort $Port
Write-Host "mstsc: $Mstsc"
Write-Host "RDP file: $RdpFile"
Write-Host "TCP ${ServerAddress}:$Port reachable: $TcpOk"

if (-not $TcpOk) {
    Write-Error 'The server RDP port is not reachable. Use Tencent Cloud TAT/OrcaTerm to inspect and repair the server listener and firewall.'
    exit 2
}

if (-not $NoLaunch) {
    Start-Process -FilePath $Mstsc -ArgumentList ('"{0}"' -f $RdpFile)
}

