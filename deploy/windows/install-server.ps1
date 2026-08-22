param(
    [Parameter(Mandatory = $true)]
    [string]$PackageRoot,
    [string]$InstallRoot = 'C:\elevator-service',
    [switch]$SeedDemoData
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$PackageRoot = (Resolve-Path -LiteralPath $PackageRoot).Path
$PackageBackend = Join-Path $PackageRoot 'backend'
$PackageAdmin = Join-Path $PackageRoot 'admin'
$PackageDeploy = Join-Path $PackageRoot 'deploy'
if (-not (Test-Path (Join-Path $PackageBackend 'app\main.py'))) {
    throw "Invalid package: backend\app\main.py is missing. PackageRoot=$PackageRoot"
}
if (-not (Test-Path (Join-Path $PackageAdmin 'index.html'))) {
    throw "Invalid package: admin\index.html is missing. PackageRoot=$PackageRoot"
}

$InfraRoot = Join-Path $InstallRoot 'infra'
$DownloadRoot = Join-Path $InstallRoot 'downloads'
$CurrentRoot = Join-Path $InstallRoot 'current'
$BackupRoot = Join-Path $InstallRoot 'backups'
$ConfigRoot = Join-Path $InstallRoot 'config'
$DataRoot = Join-Path $InstallRoot 'data'
$LogRoot = Join-Path $InstallRoot 'logs'
$ScriptRoot = Join-Path $InstallRoot 'scripts'
$SharedEnv = Join-Path $ConfigRoot 'backend.env'
$PythonHome = 'C:\Program Files\Python312'
$PythonExe = Join-Path $PythonHome 'python.exe'
$MySqlHome = Join-Path $InfraRoot 'mysql-8.0.36-winx64'
$MySqlExe = Join-Path $MySqlHome 'bin\mysql.exe'
$MySqlService = 'ElevatorMySQL'
$NginxHome = Join-Path $InfraRoot 'nginx-1.26.3'
$NginxExe = Join-Path $NginxHome 'nginx.exe'

foreach ($Path in @($InstallRoot,$InfraRoot,$DownloadRoot,$BackupRoot,$ConfigRoot,$DataRoot,$LogRoot,$ScriptRoot)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
}

function Get-RandomAlphaNumeric {
    param([int]$Length = 32)
    $Chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
    -join (1..$Length | ForEach-Object { $Chars[(Get-Random -Maximum $Chars.Length)] })
}

function Download-File {
    param([string]$Url, [string]$Destination)
    if (Test-Path $Destination) { return }
    Write-Host "Downloading: $Url"
    Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $Destination
}

Write-Host '[1/8] Checking or installing Python 3.12...'
if (-not (Test-Path $PythonExe)) {
    $PythonInstaller = Join-Path $DownloadRoot 'python-3.12.10-amd64.exe'
    Download-File -Url 'https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe' -Destination $PythonInstaller
    $Process = Start-Process -FilePath $PythonInstaller -ArgumentList '/quiet','InstallAllUsers=1','PrependPath=1','Include_test=0','Include_launcher=1','TargetDir=C:\Program Files\Python312' -Wait -PassThru -WindowStyle Hidden
    if ($Process.ExitCode -ne 0 -or -not (Test-Path $PythonExe)) { throw "Python installation failed. ExitCode=$($Process.ExitCode)" }
}

Write-Host '[2/8] Checking or installing MySQL 8.0.36...'
if (-not (Test-Path $MySqlExe)) {
    $VcRuntime = Join-Path $DownloadRoot 'vc_redist.x64.exe'
    Download-File -Url 'https://aka.ms/vs/17/release/vc_redist.x64.exe' -Destination $VcRuntime
    Start-Process -FilePath $VcRuntime -ArgumentList '/install','/quiet','/norestart' -Wait -WindowStyle Hidden

    $MySqlArchive = Join-Path $DownloadRoot 'mysql-8.0.36-winx64.zip'
    Download-File -Url 'https://dev.mysql.com/get/Downloads/MySQL-8.0/mysql-8.0.36-winx64.zip' -Destination $MySqlArchive
    Expand-Archive -LiteralPath $MySqlArchive -DestinationPath $InfraRoot -Force
}

$MySqlData = Join-Path $DataRoot 'mysql'
$MyIni = Join-Path $ConfigRoot 'my.ini'
$MyIniContent = @"
[client]
port=3306
default-character-set=utf8mb4

[mysqld]
basedir=$($MySqlHome.Replace('\','/'))
datadir=$($MySqlData.Replace('\','/'))
port=3306
bind-address=127.0.0.1
character-set-server=utf8mb4
collation-server=utf8mb4_0900_ai_ci
default-time-zone=+08:00
"@
Set-Content -LiteralPath $MyIni -Value $MyIniContent -Encoding UTF8

$Service = Get-Service -Name $MySqlService -ErrorAction SilentlyContinue
if (-not $Service) {
    if (Test-Path $MySqlData) {
        $ResolvedData = (Resolve-Path -LiteralPath $MySqlData).Path
        if ((Get-ChildItem -LiteralPath $ResolvedData -Force | Measure-Object).Count -gt 0) {
            throw "MySQL service is missing but the data directory is not empty. Refusing to overwrite: $ResolvedData"
        }
    }
    else {
        New-Item -ItemType Directory -Path $MySqlData -Force | Out-Null
    }
    & (Join-Path $MySqlHome 'bin\mysqld.exe') "--defaults-file=$MyIni" --initialize-insecure --console
    if ($LASTEXITCODE -ne 0) { throw 'MySQL initialization failed.' }
    & (Join-Path $MySqlHome 'bin\mysqld.exe') "--defaults-file=$MyIni" --install $MySqlService
    if ($LASTEXITCODE -ne 0) { throw 'MySQL Windows service installation failed.' }
    Start-Service -Name $MySqlService

    $RootPassword = Get-RandomAlphaNumeric 36
    $AppPassword = Get-RandomAlphaNumeric 36
    $JwtSecret = Get-RandomAlphaNumeric 64
    $Sql = @"
ALTER USER 'root'@'localhost' IDENTIFIED BY '$RootPassword';
CREATE DATABASE IF NOT EXISTS elevator_service DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'elevator_app'@'127.0.0.1' IDENTIFIED BY '$AppPassword';
ALTER USER 'elevator_app'@'127.0.0.1' IDENTIFIED BY '$AppPassword';
GRANT ALL PRIVILEGES ON elevator_service.* TO 'elevator_app'@'127.0.0.1';
FLUSH PRIVILEGES;
"@
    $Sql | & $MySqlExe -u root --protocol=TCP --host=127.0.0.1
    if ($LASTEXITCODE -ne 0) { throw 'MySQL database or application account initialization failed.' }

    $RootSecretFile = Join-Path $ConfigRoot 'mysql-root-password.txt'
    Set-Content -LiteralPath $RootSecretFile -Value $RootPassword -Encoding ASCII
    & icacls.exe $RootSecretFile /inheritance:r /grant:r 'SYSTEM:(F)' 'Administrators:(F)' | Out-Null

    $UploadPath = (Join-Path $DataRoot 'uploads').Replace('\','/')
    $SharedEnvContent = @"
APP_ENV=staging
API_HOST=127.0.0.1
API_PORT=8010
DATABASE_URL=mysql+pymysql://elevator_app:$AppPassword@127.0.0.1:3306/elevator_service?charset=utf8mb4
AUTH_MODE=database
PAYMENT_MODE=manual
STORAGE_BACKEND=local
NOTIFICATION_MODE=outbox
LOCAL_UPLOAD_DIR=$UploadPath
SCHEDULER_ENABLED=true
LOG_LEVEL=INFO
CORS_ORIGINS=http://127.0.0.1
JWT_SECRET=$JwtSecret
JWT_EXPIRE_MINUTES=720
"@
    Set-Content -LiteralPath $SharedEnv -Value $SharedEnvContent -Encoding UTF8
    & icacls.exe $SharedEnv /inheritance:r /grant:r 'SYSTEM:(F)' 'Administrators:(F)' | Out-Null
}
else {
    if ($Service.Status -ne 'Running') { Start-Service -Name $MySqlService }
    if (-not (Test-Path $SharedEnv)) {
        throw "Existing $MySqlService service found, but $SharedEnv is missing. Restore it before deployment; this script will not guess database credentials."
    }
}

Write-Host '[3/8] Checking or installing Nginx...'
if (-not (Test-Path $NginxExe)) {
    $NginxArchive = Join-Path $DownloadRoot 'nginx-1.26.3.zip'
    Download-File -Url 'https://nginx.org/download/nginx-1.26.3.zip' -Destination $NginxArchive
    Expand-Archive -LiteralPath $NginxArchive -DestinationPath $InfraRoot -Force
}

Write-Host '[4/8] Backing up the previous release and copying the new release...'
$Time = Get-Date -Format 'yyyyMMdd-HHmmss'
if (Test-Path $CurrentRoot) {
    $VersionBackup = Join-Path $BackupRoot $Time
    Copy-Item -LiteralPath $CurrentRoot -Destination $VersionBackup -Recurse
    Remove-Item -LiteralPath (Join-Path $VersionBackup 'backend\.env') -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $CurrentRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $CurrentRoot -Force | Out-Null
Copy-Item -LiteralPath $PackageBackend -Destination (Join-Path $CurrentRoot 'backend') -Recurse
Copy-Item -LiteralPath $PackageAdmin -Destination (Join-Path $CurrentRoot 'admin') -Recurse
Copy-Item -LiteralPath $PackageDeploy -Destination (Join-Path $CurrentRoot 'deploy') -Recurse
Copy-Item -LiteralPath $SharedEnv -Destination (Join-Path $CurrentRoot 'backend\.env') -Force
New-Item -ItemType Directory -Path (Join-Path $DataRoot 'uploads') -Force | Out-Null

Write-Host '[5/8] Creating venv, installing dependencies, and migrating the database...'
$VenvRoot = Join-Path $InstallRoot 'venv'
if (-not (Test-Path (Join-Path $VenvRoot 'Scripts\python.exe'))) {
    & $PythonExe -m venv $VenvRoot
}
$VenvPython = Join-Path $VenvRoot 'Scripts\python.exe'
& $VenvPython -m pip install --upgrade pip
& $VenvPython -m pip install -r (Join-Path $CurrentRoot 'backend\requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed.' }
Push-Location (Join-Path $CurrentRoot 'backend')
try {
    & $VenvPython -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) { throw 'Alembic migration failed.' }
    if ($SeedDemoData) {
        & $VenvPython -m app.seed
        if ($LASTEXITCODE -ne 0) { throw 'Demo data seeding failed.' }
    }
}
finally {
    Pop-Location
}

Write-Host '[6/8] Configuring Nginx and startup tasks...'
$NginxConfig = Join-Path $NginxHome 'conf\nginx.conf'
$AdminRoot = (Join-Path $CurrentRoot 'admin').Replace('\','/')
$NginxConfigContent = @"
worker_processes 1;
error_log logs/error.log;
pid logs/nginx.pid;

events { worker_connections 1024; }

http {
    include mime.types;
    default_type application/octet-stream;
    sendfile on;
    keepalive_timeout 65;
    client_max_body_size 30m;

    server {
        listen 80;
        server_name _;
        root $AdminRoot;
        index index.html;

        location / {
            try_files `$uri `$uri/ /index.html;
        }

        location /api/ {
            proxy_pass http://127.0.0.1:8010;
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto `$scheme;
        }

        location /uploads/ {
            proxy_pass http://127.0.0.1:8010;
        }

        location = /docs { proxy_pass http://127.0.0.1:8010/docs; }
        location = /openapi.json { proxy_pass http://127.0.0.1:8010/openapi.json; }
    }
}
"@
Set-Content -LiteralPath $NginxConfig -Value $NginxConfigContent -Encoding UTF8

$BackendCmd = Join-Path $ScriptRoot 'start-backend.cmd'
$BackendWorkDir = Join-Path $CurrentRoot 'backend'
$BackendLog = Join-Path $LogRoot 'backend.log'
$BackendCommand = @"
@echo off
cd /d "$BackendWorkDir"
"$VenvPython" -m uvicorn app.main:app --host 127.0.0.1 --port 8010 >> "$BackendLog" 2>&1
"@
Set-Content -LiteralPath $BackendCmd -Value $BackendCommand -Encoding ASCII

$NginxCmd = Join-Path $ScriptRoot 'start-nginx.cmd'
$NginxCommand = @"
@echo off
cd /d "$NginxHome"
"$NginxExe" -p "$($NginxHome.Replace('\','/'))/" -c conf/nginx.conf
"@
Set-Content -LiteralPath $NginxCmd -Value $NginxCommand -Encoding ASCII

foreach ($TaskName in @('ElevatorBackend','ElevatorNginx')) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
}
Get-Process -Name 'nginx' -ErrorAction SilentlyContinue | Stop-Process -Force
Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*uvicorn app.main:app*8010*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

$Principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Settings = New-ScheduledTaskSettingsSet -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
Register-ScheduledTask -TaskName 'ElevatorBackend' -Action (New-ScheduledTaskAction -Execute $BackendCmd) -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null
Register-ScheduledTask -TaskName 'ElevatorNginx' -Action (New-ScheduledTaskAction -Execute $NginxCmd) -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null

$Port80 = Get-NetTCPConnection -State Listen -LocalPort 80 -ErrorAction SilentlyContinue
if ($Port80) {
    $Owners = $Port80 | Select-Object -ExpandProperty OwningProcess -Unique
    $Processes = $Owners | ForEach-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue }
    throw "Port 80 is already in use. Resolve the conflict and rerun: $($Processes.ProcessName -join ', ')"
}

Start-ScheduledTask -TaskName 'ElevatorBackend'
Start-Sleep -Seconds 3
Start-ScheduledTask -TaskName 'ElevatorNginx'

Write-Host '[7/8] Configuring Windows Firewall for ports 80 and 443...'
if (-not (Get-NetFirewallRule -DisplayName 'Elevator HTTP 80' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName 'Elevator HTTP 80' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 80 | Out-Null
}
if (-not (Get-NetFirewallRule -DisplayName 'Elevator HTTPS 443' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName 'Elevator HTTPS 443' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 443 | Out-Null
}

Write-Host '[8/8] Running health check...'
$Healthy = $false
for ($Index = 0; $Index -lt 20; $Index++) {
    try {
        $Result = Invoke-RestMethod -Uri 'http://127.0.0.1/api/health' -TimeoutSec 5
        if ($Result.code -eq 0 -and $Result.data.status -eq 'ok') { $Healthy = $true; break }
    }
    catch { Start-Sleep -Seconds 2 }
}
if (-not $Healthy) {
    throw "Deployment finished, but health check failed. Inspect $BackendLog and $NginxHome\logs\error.log"
}

Write-Host 'Deployment succeeded.'
Write-Host "Application directory: $CurrentRoot"
Write-Host 'Admin web: http://SERVER_PUBLIC_IP/'
Write-Host 'API docs: http://SERVER_PUBLIC_IP/docs'
Write-Host 'Next: allow TCP 80 in the Lighthouse firewall. Production also requires a domain, ICP filing, and HTTPS.'
