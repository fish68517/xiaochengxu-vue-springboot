[CmdletBinding()]
param(
    [string]$LanIp = '',
    [switch]$InstallDependencies,
    [switch]$OpenBrowser,
    [switch]$SkipFirewall,
    [int]$WaitSeconds = 90
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$startScript = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'start-local.ps1'
$parameters = @{
    LanAccess = $true
    ConfigureFirewall = -not $SkipFirewall
    InstallDependencies = $InstallDependencies
    OpenBrowser = $OpenBrowser
    WaitSeconds = $WaitSeconds
}
if ($LanIp) { $parameters.LanIp = $LanIp }

& $startScript @parameters
exit $LASTEXITCODE
