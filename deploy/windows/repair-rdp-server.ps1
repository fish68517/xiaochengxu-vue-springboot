[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 3389,
    [string]$AllowedRemoteAddress = 'Any',
    [switch]$InstallStartupSelfHeal
)

$ErrorActionPreference = 'Stop'

function Assert-Administrator {
    $Identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $Principal = [Security.Principal.WindowsPrincipal]::new($Identity)
    if (-not $Principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Run this script as Administrator or through Tencent Cloud TAT.'
    }
}

function Test-RdpListener {
    param([int]$ListenerPort)
    $Tcp = Get-NetTCPConnection -State Listen -LocalPort $ListenerPort -ErrorAction SilentlyContinue
    return $null -ne $Tcp
}

function Set-RegistryDword {
    param(
        [string]$Path,
        [string]$Name,
        [int]$Value
    )
    New-ItemProperty -LiteralPath $Path -Name $Name -PropertyType DWord -Value $Value -Force | Out-Null
}

Assert-Administrator

$Root = 'C:\elevator-service'
$ToolRoot = Join-Path $Root 'tools'
$LogRoot = Join-Path $Root 'logs'
New-Item -ItemType Directory -Path $ToolRoot,$LogRoot -Force | Out-Null
$LogFile = Join-Path $LogRoot 'rdp-self-heal.log'

function Write-RepairLog {
    param([string]$Message)
    $Line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'),$Message
    Add-Content -LiteralPath $LogFile -Value $Line -Encoding UTF8
    Write-Host $Line
}

$TerminalServerKey = 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server'
$RdpTcpKey = Join-Path $TerminalServerKey 'WinStations\RDP-Tcp'
$PolicyKey = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\Terminal Services'

if (-not (Test-Path -LiteralPath $RdpTcpKey)) {
    throw 'RDP-Tcp registry key is missing. Do not create it from guessed values; restore it from the same Windows Server version or contact Tencent Cloud support.'
}

$BackupFile = Join-Path $ToolRoot ('RDP-Tcp-{0}.reg' -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
& reg.exe export 'HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' $BackupFile /y | Out-Null
Write-RepairLog "Registry backup: $BackupFile"

Set-RegistryDword -Path $TerminalServerKey -Name fDenyTSConnections -Value 0
Set-RegistryDword -Path $RdpTcpKey -Name fEnableWinStation -Value 1
Set-RegistryDword -Path $RdpTcpKey -Name PortNumber -Value $Port
if (Test-Path -LiteralPath $PolicyKey) {
    Set-RegistryDword -Path $PolicyKey -Name fDenyTSConnections -Value 0
}

Set-Service -Name TermService -StartupType Automatic
if ((Get-Service -Name TermService).Status -ne 'Running') {
    Start-Service -Name TermService
}
if ((Get-Service -Name UmRdpService).Status -ne 'Running') {
    Start-Service -Name UmRdpService
}

$FirewallName = 'Elevator-RDP-TCP'
if (Get-NetFirewallRule -DisplayName $FirewallName -ErrorAction SilentlyContinue) {
    Get-NetFirewallRule -DisplayName $FirewallName |
        Set-NetFirewallRule -Enabled True -Direction Inbound -Action Allow -Profile Any
    Get-NetFirewallRule -DisplayName $FirewallName |
        Get-NetFirewallPortFilter |
        Set-NetFirewallPortFilter -Protocol TCP -LocalPort $Port
    Get-NetFirewallRule -DisplayName $FirewallName |
        Get-NetFirewallAddressFilter |
        Set-NetFirewallAddressFilter -RemoteAddress $AllowedRemoteAddress
}
else {
    New-NetFirewallRule -DisplayName $FirewallName -Direction Inbound -Action Allow `
        -Protocol TCP -LocalPort $Port -Profile Any -RemoteAddress $AllowedRemoteAddress | Out-Null
}

Restart-Service -Name TermService -Force
Start-Sleep -Seconds 5

$ListenerOk = Test-RdpListener -ListenerPort $Port
$Qwinsta = (& qwinsta.exe 2>&1 | Out-String).Trim()
Write-RepairLog "TCP $Port listener: $ListenerOk"
Add-Content -LiteralPath $LogFile -Value $Qwinsta -Encoding UTF8

if ($InstallStartupSelfHeal) {
    $InstalledScript = Join-Path $ToolRoot 'repair-rdp-server.ps1'
    if ($PSCommandPath -ne $InstalledScript) {
        Copy-Item -LiteralPath $PSCommandPath -Destination $InstalledScript -Force
    }
    $Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument (
        '-NoProfile -ExecutionPolicy Bypass -File "{0}" -Port {1} -AllowedRemoteAddress "{2}"' -f `
            $InstalledScript,$Port,$AllowedRemoteAddress
    )
    $Trigger = New-ScheduledTaskTrigger -AtStartup
    $Principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
    $Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
    Register-ScheduledTask -TaskName 'Elevator-RDP-SelfHeal' -Action $Action -Trigger $Trigger `
        -Principal $Principal -Settings $Settings -Force | Out-Null
    Write-RepairLog 'Startup self-heal task installed: Elevator-RDP-SelfHeal'
}

if (-not $ListenerOk) {
    throw "RDP settings and services were repaired, but TCP $Port is still not listening. Inspect Event Viewer and the RDP certificate/listener as documented."
}

Write-RepairLog 'RDP repair completed successfully.'
