# 腾讯云 Windows Server 部署实战手册  
## FastAPI + MySQL + Nginx + Web 管理后台 + uni-app 微信小程序/H5 灰度

> 版本：V1.0（基于一次完整实战部署沉淀）  
> 适用场景：腾讯云轻量应用服务器 / Windows Server；后端 FastAPI；数据库 MySQL 8；Web 管理后台（Vue/Element Plus）；uni-app 微信小程序；备案审核期间需要 HTTP/IP 灰度测试，备案和 SSL 完成后切换 HTTPS 正式上线。  
> 目标：下一次部署同类项目时，尽量只替换“项目名、目录、域名、IP、数据库名、构建命令”，其余流程直接复用。

---

# 1. 先看最终架构

本次实战项目参数：

| 项目 | 当前值 |
|---|---|
| 腾讯云公网 IP | `124.222.131.30` |
| 根域名 | `petlifemall.com` |
| API 子域名 | `api.petlifemall.com` |
| 管理后台子域名 | `admin.petlifemall.com` |
| 服务器项目目录 | `C:\PetLifeMall` |
| 发布包目录 | `C:\packages` |
| FastAPI | `127.0.0.1:8000` |
| MySQL | `127.0.0.1:3306` |
| 后台 HTTP 灰度 | `http://124.222.131.30/` |
| H5 手机灰度 | `http://124.222.131.30:8081/` |
| 正式后台（备案+SSL 后） | `https://admin.petlifemall.com` |
| 正式 API（备案+SSL 后） | `https://api.petlifemall.com` |

## 1.1 备案审核期间的灰度架构

```text
                         Internet
                            │
                  腾讯云轻量实例防火墙
                    │               │
                  TCP 80          TCP 8081
                    │               │
                    └───────┬───────┘
                            ▼
                       Windows Server
                            │
                          Nginx
           ┌────────────────┼─────────────────┐
           │                │                 │
     IP:80 /          IP:80 /api/*       IP:8081 /
           │                │                 │
       admin-web            │             uni-app H5
                            │                 │
                            └───────┬─────────┘
                                    ▼
                          FastAPI 127.0.0.1:8000
                                    │
                                    ▼
                           MySQL 127.0.0.1:3306
```

灰度期间：

- 电脑后台：`http://124.222.131.30`
- 手机 H5：`http://124.222.131.30:8081`
- 微信开发者工具小程序 API：可临时使用 `http://124.222.131.30/api/v1`
- `8000` 和 `3306` 不需要暴露公网。

## 1.2 正式上线架构

```text
微信小程序
   │ HTTPS
   ▼
https://api.petlifemall.com/api/v1
   │
   ▼
Nginx :443
   │
   ▼
FastAPI 127.0.0.1:8000
   │
   ▼
MySQL 127.0.0.1:3306


电脑浏览器
   │ HTTPS
   ▼
https://admin.petlifemall.com
   │
   ├─ /           → admin-web
   └─ /api/*      → FastAPI
```

核心设计原则：

1. `admin-web` 永久使用相对 API：`/api/v1/admin`。
2. 管理后台从 HTTP 切到 HTTPS 时，不需要重新构建前端。
3. 小程序必须使用完整 API URL，因此灰度/正式分别构建。
4. FastAPI 永久只监听 `127.0.0.1:8000`。
5. MySQL 永久只监听 `127.0.0.1:3306`。
6. Nginx 是唯一公网入口。

---

# 2. 新项目先替换这些变量

以后复制本文部署其他项目时，先建立自己的参数表：

```text
PROJECT_NAME=PetLifeMall
SERVER_IP=124.222.131.30

ROOT_DOMAIN=petlifemall.com
API_DOMAIN=api.petlifemall.com
ADMIN_DOMAIN=admin.petlifemall.com

SERVER_ROOT=C:\PetLifeMall
PACKAGE_DIR=C:\packages

LOCAL_PROJECT=E:\bishe27\wxMiniProgram

DEV_DATABASE=pet_life_dev
PROD_DATABASE=pet_life_prod

FASTAPI_PORT=8000
MYSQL_PORT=3306
H5_GRAY_PORT=8081
```

不要复制真实密码、JWT_SECRET、证书私钥到其他项目。

---

# 3. 域名、DNS、备案：必须先理解的关系

## 3.1 只注册一个根域名

只需要购买：

```text
petlifemall.com
```

不需要另外购买：

```text
api.petlifemall.com
admin.petlifemall.com
```

因为 `api` 和 `admin` 都是免费创建的 DNS 子域名。

## 3.2 DNSPod 添加两条 A 记录

```text
api      A      124.222.131.30
admin    A      124.222.131.30
```

得到：

```text
api.petlifemall.com   → 124.222.131.30
admin.petlifemall.com → 124.222.131.30
```

服务器验证：

```powershell
nslookup api.petlifemall.com 119.29.29.29
nslookup admin.petlifemall.com 119.29.29.29
```

预期均返回：

```text
124.222.131.30
```

## 3.3 VPN/TUN Fake-IP 陷阱

本地 Windows 如果开启 Clash/Mihomo/TUN/Fake-IP，可能看到：

```text
api.petlifemall.com → 198.19.x.x
```

不要把 DNSPod 改成这个地址。

`198.18.0.0/15` 常见于本机代理 Fake-IP。  
正确做法是到腾讯云服务器直接执行 `nslookup` 验证真实公网 DNS。

## 3.4 中国大陆服务器的备案拦截

如果服务器位于上海等中国大陆地域，域名未备案时，即使：

- DNS 正确；
- Nginx 正确；
- TCP 80 已开放；

访问：

```text
http://admin.petlifemall.com
```

仍可能被腾讯云跳转到类似：

```text
dnspod.qcloud.com/static/webblock.html
```

提示：

```text
网站暂时无法访问
您的网站未完成备案
```

这不是 Nginx 故障。

备案审核期间应使用公网 IP 做灰度：

```text
后台：http://124.222.131.30
H5 ：http://124.222.131.30:8081
```

备案与服务器部署可以并行进行，不需要等待备案完成才安装 FastAPI/MySQL/Nginx。

---

# 4. 服务器目录规划

推荐固定：

```text
C:\
├─ packages\
│   ├─ pet-life-server-版本.tar.gz
│   ├─ Python 安装包
│   ├─ MySQL 安装包
│   └─ H5 灰度包
│
├─ PetLifeMall\
│   ├─ backend\
│   │   ├─ app\
│   │   ├─ migrations\
│   │   ├─ alembic.ini
│   │   ├─ pyproject.toml
│   │   ├─ .venv\
│   │   └─ .env.local
│   │
│   ├─ admin-web\
│   │   ├─ index.html
│   │   └─ assets\
│   │
│   ├─ database\
│   │   └─ pet_life_prod.sql
│   │
│   ├─ miniprogram-h5\
│   │   ├─ index.html
│   │   └─ assets\
│   │
│   └─ start-api.cmd
│
└─ nginx\
    ├─ nginx.exe
    └─ conf\nginx.conf
```

创建：

```powershell
New-Item -ItemType Directory -Path C:\packages -Force | Out-Null
New-Item -ItemType Directory -Path C:\PetLifeMall -Force | Out-Null
```

---

# 5. 本地发布包：应该打什么、不应该打什么

服务器包只需要：

```text
backend/
├─ app/
├─ migrations/
├─ alembic.ini
└─ pyproject.toml

admin-web/
├─ index.html
└─ assets/

database/
└─ pet_life_prod.sql
```

不要上传：

```text
.venv
node_modules
.git
.env.local
__pycache__
*.pyc
pytest cache
ruff cache
微信小程序源码
```

清理 Python 缓存：

```bash
find release/pet-life-server -type d -name "__pycache__" -prune -exec rm -rf {} +
find release/pet-life-server -type f \( -name "*.pyc" -o -name "*.pyo" \) -delete
```

安全检查：

```bash
if tar -tzf release/pet-life-server-20260821-01.tar.gz | grep -E '(^|/)(\.env\.local|node_modules|\.venv|\.git)(/|$)'; then
  echo "ERROR: package contains forbidden files"
else
  echo "package content check passed"
fi
```

上传：

```text
本机：
E:\bishe27\wxMiniProgram\release\pet-life-server-20260821-01.tar.gz

服务器：
C:\packages\pet-life-server-20260821-01.tar.gz
```

解压：

```powershell
tar -xzf C:\packages\pet-life-server-20260821-01.tar.gz -C C:\PetLifeMall
Get-ChildItem C:\PetLifeMall
```

应看到：

```text
admin-web
backend
database
```

---

# 6. Python 3.12 安装：经过实战验证的方式

## 6.1 下载 Python 3.12.10 x64

```powershell
curl.exe -L `
  "https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe" `
  -o "C:\packages\python-3.12.10-amd64.exe"
```

检查大小：

```powershell
(Get-Item "C:\packages\python-3.12.10-amd64.exe").Length
```

本次实测完整文件：

```text
26964224
```

检查 MD5：

```powershell
Get-FileHash "C:\packages\python-3.12.10-amd64.exe" -Algorithm MD5
```

本次实测：

```text
5EDDB0B6F12C852725DE071AE681DDE4
```

如果下载中断，文件可能只有 15MB 左右，安装会返回异常退出码。必须重新下载并校验完整性。

## 6.2 静默安装

```powershell
$installer = "C:\packages\python-3.12.10-amd64.exe"

$p = Start-Process `
    -FilePath $installer `
    -ArgumentList '/quiet InstallAllUsers=1 PrependPath=1 Include_pip=1 Include_launcher=1 InstallLauncherAllUsers=1 Include_test=0' `
    -Wait `
    -PassThru

Write-Host "Python installer exit code:" $p.ExitCode
```

期望：

```text
0
```

验证：

```powershell
Test-Path "C:\Program Files\Python312\python.exe"
& "C:\Program Files\Python312\python.exe" --version
```

应得到：

```text
True
Python 3.12.10
```

---

# 7. FastAPI 虚拟环境与依赖

```powershell
cd C:\PetLifeMall\backend

& "C:\Program Files\Python312\python.exe" -m venv .venv

.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install .
```

验证：

```powershell
.\.venv\Scripts\python.exe -c "import fastapi, sqlalchemy, pymysql; print('python dependencies ok')"
```

## 7.1 Pydantic Core 找不到版本的实战问题

曾遇到：

```text
pydantic 2.7.0 depends on pydantic-core==2.18.1
ERROR: No matching distribution found for pydantic-core==2.18.1
```

服务器环境本身确认：

```text
Python 3.12.10
AMD64
64bit Windows
```

这种情况下优先切换国内 PyPI 镜像：

```powershell
.\.venv\Scripts\python.exe -m pip install `
  "pydantic-core==2.18.1" `
  -i https://mirrors.cloud.tencent.com/pypi/simple
```

再：

```powershell
.\.venv\Scripts\python.exe -m pip install `
  . `
  -i https://mirrors.cloud.tencent.com/pypi/simple `
  --prefer-binary
```

最终实测依赖：

```text
FastAPI:    0.116.1
Pydantic:   2.7.0
SQLAlchemy: 2.0.43
```

---

# 8. MySQL 8.0.46：网页 PowerShell 环境下的稳定安装方法

腾讯云网页 PowerShell 看不到 GUI 安装窗口时，不要依赖图形安装器。

## 8.1 完整 MySQL Installer 下载

本次使用：

```text
mysql-installer-community-8.0.46.0.msi
```

网络中断时使用断点续传：

```powershell
curl.exe -L -C - `
  --retry 20 `
  --retry-delay 5 `
  --retry-all-errors `
  "https://dev.mysql.com/get/Downloads/MySQLInstaller/mysql-installer-community-8.0.46.0.msi" `
  -o "C:\packages\mysql-installer-community-8.0.46.0.msi"
```

本次实测：

```text
Length = 593346560
MD5    = 270575E788F414C29A42E41203161727
```

## 8.2 若 Installer Console 配置语法异常

实战中新版 Installer Console 出现过：

```text
'root_passwd' is not recognized as a valid keyword
config is deprecated, use main instead
```

此时不建议继续猜参数。

完整 Installer 会缓存 MySQL Server MSI：

```text
C:\ProgramData\MySQL\MySQL Installer for Windows\Product Cache\
mysql-8.0.46-winx64.msi
```

查找：

```powershell
Get-ChildItem `
  "C:\ProgramData\MySQL\MySQL Installer for Windows\Product Cache" `
  -Recurse -File -Filter "*.msi" |
  Where-Object { $_.Name -match '8\.0\.46' } |
  Select-Object FullName, Length
```

直接静默安装 Server MSI：

```powershell
$msi = "C:\ProgramData\MySQL\MySQL Installer for Windows\Product Cache\mysql-8.0.46-winx64.msi"

$p = Start-Process msiexec.exe `
  -ArgumentList "/i `"$msi`" /qn /norestart" `
  -Wait `
  -PassThru

Write-Host "MySQL Server MSI exit code:" $p.ExitCode
```

期望：

```text
0
```

验证：

```powershell
Test-Path "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe"

& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" --version
```

应得到 MySQL 8.0.46。

---

# 9. MySQL 初始化与服务注册

定义：

```powershell
$base   = "C:\Program Files\MySQL\MySQL Server 8.0"
$data   = "C:\ProgramData\MySQL\MySQL Server 8.0\Data"
$ini    = "C:\ProgramData\MySQL\MySQL Server 8.0\my.ini"
$mysqld = "$base\bin\mysqld.exe"
```

创建空 Data：

```powershell
New-Item -ItemType Directory -Path $data -Force | Out-Null
Get-ChildItem $data -Force
```

只有确认目录为空才初始化：

```powershell
& $mysqld `
  --initialize-insecure `
  --console `
  "--basedir=$base" `
  "--datadir=$data"
```

成功日志会出现：

```text
InnoDB initialization has started.
InnoDB initialization has ended.
root@localhost is created with an empty password
```

> `--initialize-insecure` 只用于首次初始化。服务启动后必须立即设置 root 密码。

## 9.1 my.ini

```ini
[mysqld]
basedir=C:/Program Files/MySQL/MySQL Server 8.0
datadir=C:/ProgramData/MySQL/MySQL Server 8.0/Data

port=3306
bind-address=127.0.0.1

character-set-server=utf8mb4
collation-server=utf8mb4_0900_ai_ci

[client]
port=3306
default-character-set=utf8mb4
```

PowerShell 创建：

```powershell
@"
[mysqld]
basedir=C:/Program Files/MySQL/MySQL Server 8.0
datadir=C:/ProgramData/MySQL/MySQL Server 8.0/Data

port=3306
bind-address=127.0.0.1

character-set-server=utf8mb4
collation-server=utf8mb4_0900_ai_ci

[client]
port=3306
default-character-set=utf8mb4
"@ | Set-Content -Path $ini -Encoding ASCII
```

注册服务：

```powershell
& $mysqld --install MySQL80 "--defaults-file=$ini"

Set-Service MySQL80 -StartupType Automatic
Start-Service MySQL80
```

检查：

```powershell
Get-Service MySQL80

Get-NetTCPConnection -LocalPort 3306 |
  Select-Object LocalAddress,LocalPort,State,OwningProcess
```

理想：

```text
MySQL80 = Running
127.0.0.1:3306 = Listen
```

---

# 10. MySQL 常见坑：服务启动失败但 3306 已被占用

如果：

```powershell
Start-Service MySQL80
```

失败，而：

```powershell
Get-Process mysqld
Get-NetTCPConnection -LocalPort 3306
```

发现已有一个手工启动的 `mysqld.exe`：

```text
127.0.0.1:3306 Listen
```

那么服务失败原因通常只是 **3306 被临时 MySQL 进程占用**。

处理：

```powershell
Stop-Process -Id <PID> -Force
Start-Sleep -Seconds 2
Start-Service MySQL80
```

再次验证：

```powershell
Get-Service MySQL80
Get-NetTCPConnection -LocalPort 3306
```

---

# 11. 数据库导出：必须检查 SQL 不是 0 字节

本机 MySQL 如果装在 D 盘：

```cmd
where mysql
where mysqldump
```

实测路径：

```text
D:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe
D:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe
```

检查开发数据库：

```cmd
"D:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root -p -e "SHOW DATABASES;"
```

导出：

```cmd
"D:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe" -h 127.0.0.1 -P 3306 -u root -p --single-transaction --routines --triggers --set-gtid-purged=OFF --default-character-set=utf8mb4 pet_life_dev > "E:\bishe27\wxMiniProgram\release\pet_life_prod.sql"
```

检查大小：

```cmd
for %I in ("E:\bishe27\wxMiniProgram\release\pet_life_prod.sql") do @echo SQL文件大小：%~zI bytes
```

本次实测：

```text
33124 bytes
```

大小不大不代表失败，还要检查：

```cmd
find /c "CREATE TABLE" "E:\bishe27\wxMiniProgram\release\pet_life_prod.sql"
find /c "INSERT INTO" "E:\bishe27\wxMiniProgram\release\pet_life_prod.sql"
findstr /i /c:"Dump completed" "E:\bishe27\wxMiniProgram\release\pet_life_prod.sql"
```

本次实测：

```text
CREATE TABLE : 18
INSERT INTO  : 13
Dump completed ...
```

这才证明导出有效。

> 经验：如果 SQL 是 0 字节，不要继续导入服务器。先确认 `mysqldump.exe` 路径、数据库名和命令是否真的成功。

---

# 12. 服务器生产库导入

创建：

```sql
CREATE DATABASE IF NOT EXISTS pet_life_prod
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
```

正式推荐创建应用账号：

```sql
CREATE USER 'pet_life_app'@'127.0.0.1'
IDENTIFIED BY 'REPLACE_WITH_STRONG_PASSWORD';

GRANT ALL PRIVILEGES ON pet_life_prod.*
TO 'pet_life_app'@'127.0.0.1';

FLUSH PRIVILEGES;
```

验证：

```sql
SELECT user, host
FROM mysql.user
WHERE user='pet_life_app';
```

导入：

```sql
USE pet_life_prod;
SOURCE C:/PetLifeMall/database/pet_life_prod.sql;
```

检查：

```sql
SHOW TABLES;

SELECT COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_schema='pet_life_prod';

SELECT * FROM alembic_version;
```

本次项目预期：

```text
18 张表
Alembic: 0005_lottery_real_data
```

## 12.1 灰度快速部署时使用 root

为了快速打通链路，可以临时：

```text
FastAPI → root → pet_life_prod
```

但正式上线建议改回：

```text
FastAPI → pet_life_app → pet_life_prod
```

不要把 root 密码、JWT_SECRET 写入 Git。

---

# 13. `.env.local`

服务器单独创建：

```text
C:\PetLifeMall\backend\.env.local
```

正式推荐：

```dotenv
APP_ENV=production
APP_NAME=萌宠生活商城 API
DATABASE_URL=mysql+pymysql://pet_life_app:URL_ENCODED_PASSWORD@127.0.0.1:3306/pet_life_prod?charset=utf8mb4
FRONTEND_ORIGINS=https://admin.petlifemall.com
JWT_SECRET=REPLACE_WITH_RANDOM_SECRET
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=720
```

灰度期间若临时使用 root：

```dotenv
DATABASE_URL=mysql+pymysql://root:URL_ENCODED_ROOT_PASSWORD@127.0.0.1:3306/pet_life_prod?charset=utf8mb4
```

生成 JWT：

```powershell
cd C:\PetLifeMall\backend
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
```

不要把 `.env.local` 整份截图或上传。

## 13.1 Settings 实际读取方式

本项目 `app.core.config` 中是 `Settings` 类，而不是全局 `settings` 变量。

字段检查：

```powershell
.\.venv\Scripts\python.exe -c "from app.core.config import Settings; print(Settings.model_fields.keys())"
```

本次实测字段：

```text
app_env
app_name
database_url
frontend_origins
jwt_secret
jwt_algorithm
jwt_expire_minutes
```

验证配置：

```powershell
.\.venv\Scripts\python.exe -c "from app.core.config import Settings; s=Settings(); print('Settings loaded OK'); print('APP_ENV =', s.app_env); print('DB configured =', bool(s.database_url)); print('JWT configured =', bool(s.jwt_secret))"
```

不要打印完整 `DATABASE_URL` 或 JWT。

---

# 14. Alembic 与 FastAPI 验收

```powershell
cd C:\PetLifeMall\backend

.\.venv\Scripts\python.exe -m alembic current
.\.venv\Scripts\python.exe -m alembic heads
.\.venv\Scripts\python.exe -m alembic upgrade head
```

本项目预期：

```text
0005_lottery_real_data (head)
```

启动：

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app `
  --host 127.0.0.1 `
  --port 8000 `
  --workers 1
```

不要在 production 使用：

```text
--reload
```

健康检查：

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

本次实测成功：

```text
status      environment database
------      ----------- --------
ok          production  mysql
```

---

# 15. FastAPI 后台常驻

启动脚本：

```text
C:\PetLifeMall\start-api.cmd
```

内容：

```bat
@echo off
cd /d C:\PetLifeMall\backend
C:\PetLifeMall\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

创建开机任务：

```powershell
schtasks /Create `
  /TN "PetLifeMall-API" `
  /SC ONSTART `
  /RU SYSTEM `
  /RL HIGHEST `
  /TR "C:\PetLifeMall\start-api.cmd" `
  /F
```

测试：

```powershell
schtasks /Run /TN "PetLifeMall-API"
Start-Sleep -Seconds 3

Invoke-RestMethod http://127.0.0.1:8000/health
```

---

# 16. Nginx：本次最终灰度配置

这是备案审核期间最实用的配置：

```nginx
worker_processes 1;

events {
    worker_connections 1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    sendfile      on;
    keepalive_timeout 65;

    # -------------------------------------------------
    # 1. API 域名
    # 备案/SSL 完成后供正式小程序使用
    # -------------------------------------------------
    server {
        listen 80;
        server_name api.petlifemall.com;

        location / {
            proxy_pass http://127.0.0.1:8000;
            proxy_http_version 1.1;

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }

    # -------------------------------------------------
    # 2. 管理后台域名
    # /      → admin-web
    # /api/* → FastAPI
    # -------------------------------------------------
    server {
        listen 80;
        server_name admin.petlifemall.com;

        root C:/PetLifeMall/admin-web;
        index index.html;

        location /api/ {
            proxy_pass http://127.0.0.1:8000;
            proxy_http_version 1.1;

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location / {
            try_files $uri $uri/ /index.html;
        }
    }

    # -------------------------------------------------
    # 3. 备案期间公网 IP 灰度后台
    # http://SERVER_IP/
    #
    # /      → admin-web
    # /api/* → FastAPI
    # -------------------------------------------------
    server {
        listen 80 default_server;
        server_name _;

        root C:/PetLifeMall/admin-web;
        index index.html;

        location = /health {
            proxy_pass http://127.0.0.1:8000/health;
            proxy_http_version 1.1;
        }

        location /api/ {
            proxy_pass http://127.0.0.1:8000;
            proxy_http_version 1.1;

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location / {
            try_files $uri $uri/ /index.html;
        }
    }

    # -------------------------------------------------
    # 4. uni-app H5 手机灰度
    # http://SERVER_IP:8081/
    #
    # /      → H5
    # /api/* → FastAPI
    # -------------------------------------------------
    server {
        listen 8081;
        server_name _;

        root C:/PetLifeMall/miniprogram-h5;
        index index.html;

        location /api/ {
            proxy_pass http://127.0.0.1:8000;
            proxy_http_version 1.1;

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location / {
            try_files $uri $uri/ /index.html;
        }
    }
}
```

检查：

```powershell
cd C:\nginx
.\nginx.exe -t
```

必须：

```text
syntax is ok
test is successful
```

重载：

```powershell
.\nginx.exe -s reload
```

---

# 17. 防火墙：最容易遗漏的关键点

腾讯云 Windows Server 至少有两层防火墙：

```text
Internet
   ↓
① 腾讯云轻量应用服务器防火墙
   ↓
② Windows Defender 防火墙
   ↓
Nginx / 应用
```

**只开放 Windows 防火墙是不够的。**

## 17.1 灰度阶段端口

| 端口 | 公网 | 用途 |
|---|---:|---|
| `80` | ✅ | Web 后台 HTTP、API/IP 灰度 |
| `8081` | ✅ 临时 | 手机 H5 灰度 |
| `443` | ⏳ SSL 后 | 正式 HTTPS |
| `8000` | ❌ | FastAPI 内部 |
| `3306` | ❌ | MySQL 内部 |
| `3389` | 按需/限制来源 | Windows RDP |

Windows 放行 H5：

```powershell
New-NetFirewallRule `
  -DisplayName "PetLifeMall H5 Gray 8081" `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 8081 `
  -Action Allow
```

腾讯云轻量应用服务器控制台也必须增加：

```text
来源：0.0.0.0/0
协议：TCP
端口：8081
策略：允许
```

本次 H5 无法打开的最终原因就是：

```text
Windows 8081 已放行        ✅
Nginx 8081 本机可访问      ✅
腾讯云实例防火墙 8081      ❌
```

放行云防火墙后立即恢复正常。

检查服务端：

```powershell
Get-NetTCPConnection -LocalPort 8081 -State Listen |
  Select-Object LocalAddress,LocalPort,State,OwningProcess
```

期望：

```text
0.0.0.0  8081  Listen
```

服务器内部 HTTP：

```powershell
$r = Invoke-WebRequest http://127.0.0.1:8081/ -UseBasicParsing
$r.StatusCode
$r.Content.Length
```

公网电脑：

```powershell
Test-NetConnection 124.222.131.30 -Port 8081
```

期望：

```text
TcpTestSucceeded : True
```

---

# 18. admin-web：永久使用相对 API

这是整套方案中最重要的前端设计之一。

不要再构建成：

```text
http://api.petlifemall.com/api/v1/admin
```

也不要构建成：

```text
https://api.petlifemall.com/api/v1/admin
```

永久使用：

```text
/api/v1/admin
```

本地 Windows CMD：

```cmd
cd /d E:\bishe27\wxMiniProgram\apps\admin-web

set "VITE_ADMIN_API_BASE=/api/v1/admin"

npm.cmd run build
```

优点：

当前 IP 灰度：

```text
打开：
http://124.222.131.30

浏览器自动请求：
http://124.222.131.30/api/v1/admin/...
```

备案后正式：

```text
打开：
https://admin.petlifemall.com

浏览器自动请求：
https://admin.petlifemall.com/api/v1/admin/...
```

**同一份 admin-web dist 可以同时兼容 HTTP 和 HTTPS。**

而且页面/API 同源，浏览器 CORS 问题大幅减少。

检查旧 HTTPS 地址是否已消失：

```cmd
findstr /S /I /C:"https://api.petlifemall.com" dist\assets\*.js
```

最好无输出。

---

# 19. 管理后台发布

打包：

```cmd
cd /d E:\bishe27\wxMiniProgram\apps\admin-web

tar -czf "E:\bishe27\wxMiniProgram\release\admin-web-relative-api.tar.gz" -C dist .
```

上传：

```text
C:\packages\admin-web-relative-api.tar.gz
```

备份旧后台：

```powershell
$backup = "C:\PetLifeMallBackup\admin-web-" + (Get-Date -Format "yyyyMMdd-HHmmss")
New-Item -ItemType Directory -Path $backup -Force | Out-Null

Copy-Item C:\PetLifeMall\admin-web\* $backup -Recurse -Force
```

替换：

```powershell
Remove-Item C:\PetLifeMall\admin-web\* -Recurse -Force

tar -xzf `
  C:\packages\admin-web-relative-api.tar.gz `
  -C C:\PetLifeMall\admin-web
```

灰度访问：

```text
http://124.222.131.30
```

成功后浏览器 Network 应看到：

```text
POST http://124.222.131.30/api/v1/admin/auth/login
```

而不是：

```text
https://api.petlifemall.com/...
```

本次已实测后台登录成功，并能够读取云端 MySQL 数据。

---

# 20. uni-app H5：备案期间手机灰度测试

微信小程序编译产物 `mp-weixin` 不能直接在浏览器打开。

为了手机直接访问，额外构建 H5。

本地：

```cmd
cd /d E:\bishe27\wxMiniProgram\apps\miniprogram

set "VITE_API_BASE_URL=/api/v1"

pnpm.cmd build:h5
```

输出通常：

```text
dist\build\h5
```

使用相对 API 的意义：

```text
手机打开：
http://124.222.131.30:8081

H5 请求：
/api/v1/products

自动变成：
http://124.222.131.30:8081/api/v1/products

Nginx：
/api/* → FastAPI
```

因此也是同源请求。

打包：

```cmd
tar -czf "E:\bishe27\wxMiniProgram\release\miniprogram-h5-gray.tar.gz" -C "E:\bishe27\wxMiniProgram\apps\miniprogram\dist\build\h5" .
```

服务器：

```powershell
New-Item -ItemType Directory `
  -Path "C:\PetLifeMall\miniprogram-h5" `
  -Force | Out-Null

tar -xzf `
  C:\packages\miniprogram-h5-gray.tar.gz `
  -C C:\PetLifeMall\miniprogram-h5
```

手机访问：

```text
http://124.222.131.30:8081
```

此方案可用于：

- 商品浏览
- 登录
- 购物车
- 地址
- 下单
- 抽奖
- 后台新增数据后手机端验证

---

# 21. 真正的微信小程序：灰度与正式构建

小程序不同于 Web 页面，不能使用 `/api/v1` 作为独立服务器地址，因此必须给完整 URL。

## 21.1 备案期间 / 微信开发者工具灰度

```cmd
cd /d E:\bishe27\wxMiniProgram\apps\miniprogram

set "VITE_API_BASE_URL=http://124.222.131.30/api/v1"

pnpm.cmd build:mp-weixin
```

导入：

```text
E:\bishe27\wxMiniProgram\apps\miniprogram\dist\build\mp-weixin
```

微信开发者工具调试期间可开启：

```text
不校验合法域名、web-view 域名、TLS 版本以及 HTTPS 证书
```

这只用于本地/开发工具调试。

## 21.2 备案 + SSL 完成后的正式构建

```cmd
cd /d E:\bishe27\wxMiniProgram\apps\miniprogram

set "VITE_API_BASE_URL=https://api.petlifemall.com/api/v1"

pnpm.cmd build:mp-weixin
```

微信公众平台：

```text
request 合法域名：
https://api.petlifemall.com
```

不要添加：

```text
/api/v1
```

---

# 22. HTTP → HTTPS 正式上线时哪些需要改，哪些不用改

## 22.1 不需要改

以下基本保持不动：

```text
FastAPI
MySQL
数据库
API 路由
admin-web 的 VITE_ADMIN_API_BASE=/api/v1/admin
admin-web dist
FastAPI 127.0.0.1:8000
MySQL 127.0.0.1:3306
```

## 22.2 需要改

Nginx 增加：

```nginx
listen 443 ssl;
ssl_certificate ...
ssl_certificate_key ...
```

并配置证书：

```text
api.petlifemall.com
admin.petlifemall.com
```

小程序重新构建：

```cmd
set "VITE_API_BASE_URL=https://api.petlifemall.com/api/v1"
pnpm.cmd build:mp-weixin
```

微信公众平台添加合法域名。

正式上线后可删除临时 H5 8081 公网规则，或继续只用于内部测试。

---

# 23. 常用验收命令

## 23.1 FastAPI

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

目标：

```text
ok / production / mysql
```

## 23.2 Nginx

```powershell
cd C:\nginx
.\nginx.exe -t
```

## 23.3 端口

```powershell
Get-NetTCPConnection -LocalPort 80,8081,8000,3306 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess
```

合理状态：

```text
0.0.0.0:80       Listen   Nginx
0.0.0.0:8081     Listen   Nginx
127.0.0.1:8000   Listen   FastAPI
127.0.0.1:3306   Listen   MySQL
```

## 23.4 后台

浏览器：

```text
http://124.222.131.30
```

Network：

```text
/api/v1/admin/...
```

## 23.5 H5

浏览器/手机：

```text
http://124.222.131.30:8081
```

公网端口测试：

```powershell
Test-NetConnection 124.222.131.30 -Port 8081
```

---

# 24. 本次遇到的典型故障与定位方法

## 24.1 `nslookup` 返回 `198.19.x.x`

**原因：** 本机 VPN/TUN/Fake-IP。  
**处理：** 不改 DNSPod，到云服务器使用 `119.29.29.29` 验证。

---

## 24.2 域名打开后进入腾讯云“未备案”页面

**现象：**

```text
dnspod.qcloud.com/static/webblock.html
```

**原因：** 大陆服务器域名备案未完成。  
**处理：**

```text
备案期间 → 公网 IP 灰度
备案完成 → 域名 + HTTPS
```

---

## 24.3 admin 登录超时，Network 请求 `https://api...`

**原因：** admin-web 构建时把 HTTPS API 写死。  
**最终解决方案：**

```text
VITE_ADMIN_API_BASE=/api/v1/admin
```

并让 `admin` Nginx：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8000;
}
```

---

## 24.4 H5 8081 服务器本机正常，手机/电脑公网超时

检查：

```powershell
Test-NetConnection 127.0.0.1 -Port 8081
```

如果：

```text
True
```

但公网：

```text
ERR_CONNECTION_TIMED_OUT
NS_ERROR_NET_EMPTY_RESPONSE
```

优先检查：

```text
腾讯云轻量应用服务器防火墙 TCP 8081
```

不要只检查 Windows 防火墙。

---

## 24.5 SQL 导出文件是 0 字节

检查：

```cmd
where mysql
where mysqldump
```

不要假设 MySQL 安装在 C 盘。

导出完成后必须：

```cmd
for %I in ("...\pet_life_prod.sql") do @echo %~zI
find /c "CREATE TABLE" "...\pet_life_prod.sql"
find /c "INSERT INTO" "...\pet_life_prod.sql"
findstr /i /c:"Dump completed" "...\pet_life_prod.sql"
```

---

## 24.6 在 PowerShell 输入 `SELECT ... FROM ...`

PowerShell 提示：

```text
FROM keyword not supported
Where-Object ...
```

原因：

```text
SQL 被输入到了 PowerShell
```

判断提示符：

```text
PS C:\...>  → PowerShell
mysql>      → MySQL，可以输入 SQL
->          → SQL 尚未结束
'>          → 单引号没闭合
">          → 双引号没闭合
```

MySQL 输入状态乱了：

```text
\c   取消当前语句
\q   退出 MySQL
```

---

## 24.7 Nginx 502

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

如果失败，先修 FastAPI，而不是继续改 Nginx。

---

## 24.8 FastAPI 后台窗口一关就停止

使用：

```text
start-api.cmd
+
Windows schtasks ONSTART
```

不要依赖人工保持 PowerShell 窗口。

---

# 25. 下一次部署另一个项目的推荐最短流程

```text
01. 服务器创建 C:\新项目 和 C:\packages
02. 本地 backend/admin/db 打包
03. 上传并解压
04. 安装/复用 Python 3.12
05. 创建 backend\.venv
06. pip install .
07. 安装/复用 MySQL 8
08. 创建生产数据库
09. mysqldump 本地数据 → 导入服务器
10. 创建服务器 .env.local
11. alembic upgrade head
12. 启动 FastAPI 127.0.0.1:8000
13. /health 验收
14. 配置 Nginx
15. admin-web 使用相对 API
16. IP:80 做 Web 灰度
17. H5 使用相对 API，IP:8081 做手机灰度
18. 同时放行 Windows + 腾讯云实例防火墙
19. 域名备案并行审核
20. SSL 完成后配置 443
21. 小程序构建从 HTTP/IP 切换 HTTPS API 域名
22. 微信公众平台配置 request 合法域名
23. 正式发布
```

---

# 26. 推荐的跨项目通用约定

为了以后每个项目都可以套模板，建议统一：

```text
服务器项目目录：
C:\Apps\<ProjectName>

发布包：
C:\packages\<ProjectName>-<Version>.tar.gz

FastAPI：
127.0.0.1:<内部端口>

MySQL：
127.0.0.1:3306

Web：
80 / 443

H5灰度：
8081、8082、8083... 每项目独立一个临时端口
```

管理后台统一采用：

```text
VITE_ADMIN_API_BASE=/api/v1/admin
```

H5 统一采用：

```text
VITE_API_BASE_URL=/api/v1
```

小程序：

```text
灰度：
VITE_API_BASE_URL=http://公网IP/api/v1

正式：
VITE_API_BASE_URL=https://api.域名/api/v1
```

这样服务器结构固定，本地构建参数清晰，部署第二个、第三个项目时会快很多。

---

# 27. 安全边界：灰度可以简化，但不要无必要暴露核心端口

可以接受的灰度简化：

```text
HTTP 80 公网                ✅
H5 临时 8081 公网           ✅
暂不配置 SSL                ✅
测试阶段临时 root DB 用户    ⚠️
```

不建议为了方便直接暴露：

```text
FastAPI 8000 公网           ❌
MySQL 3306 公网             ❌
```

原因是 Nginx 已经能够完成所有 Web/H5/API 转发，开放 8000/3306 没有实际收益。

正式上线前建议：

1. FastAPI 从 root 切回专用 MySQL 用户。
2. 配置 SSL / 443。
3. 微信小程序使用 HTTPS 合法域名。
4. 备案完成。
5. 关闭不再使用的 8081 灰度公网规则。
6. 3389 只允许可信来源 IP（如业务允许）。
7. 定期备份数据库与服务器发布包。

---

# 28. 最终验收清单

```text
[ ] Python 3.12 正常
[ ] backend\.venv 正常
[ ] FastAPI dependencies 正常
[ ] MySQL80 Running
[ ] MySQL 只监听 127.0.0.1:3306
[ ] 生产数据库已导入
[ ] Alembic current == heads
[ ] .env.local 为 production
[ ] FastAPI /health = ok / production / mysql
[ ] FastAPI 只监听 127.0.0.1:8000
[ ] Nginx -t successful
[ ] 80 → admin-web 正常
[ ] 80 /api/* → FastAPI 正常
[ ] 8081 → H5 正常
[ ] 8081 /api/* → FastAPI 正常
[ ] Windows 防火墙 80/8081 正确
[ ] 腾讯云实例防火墙 80/8081 正确
[ ] 8000/3306 未向公网开放
[ ] admin-web 使用 /api/v1/admin
[ ] H5 使用 /api/v1
[ ] 小程序灰度构建使用公网 IP
[ ] 备案完成后切换 SSL
[ ] 正式小程序使用 https://api.<domain>/api/v1
[ ] 微信 request 合法域名只填写 https://api.<domain>
```

---

## 一句话总结

> **FastAPI/MySQL 放在服务器内部，Nginx 负责所有公网入口；Web 后台与 H5 使用相对 `/api/...` 实现同源和 HTTP/HTTPS 自动兼容；备案期间通过公网 IP + 80/8081 灰度测试，备案与 SSL 完成后后台无需重构，小程序只切换本地 `VITE_API_BASE_URL` 到 HTTPS 域名即可正式上线。**
