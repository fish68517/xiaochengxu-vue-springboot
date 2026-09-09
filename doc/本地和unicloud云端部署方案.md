# 任务：重构前端 API 访问方案，使项目同时支持本地开发与 uniCloud 阿里云生产部署

## 一、项目背景

当前项目根目录：

E:\bishe27\服务平台小程序\code

项目是多前端结构：

apps/
├── client
├── workbench
└── admin

三个前端目前都可以在本地运行。

本地开发 API：

http://127.0.0.1:4176

当前三个 H5 构建产物中都检测到了：

127.0.0.1:4176

具体包括：

apps/admin/dist/build/h5/assets/*.js
apps/client/dist/build/h5/assets/*.js
apps/workbench/dist/build/h5/assets/*.js

因此这些构建产物不能直接部署到 uniCloud。

---

# 二、最终部署目标

生产环境部署到：

DCloud uniCloud
云厂商：阿里云
服务空间：pwfinal

当前新的后端核心为：

game-service
system-runner
wechat-callback

其中：

system-runner
    ↓
调用 game-service

wechat-callback
    ↓
调用 game-service

前端业务主要应该访问：

game-service

game-service 当前采用类似：

uniCloud.callFunction({
    name: 'game-service',
    data: {
        action,
        payload,
        ...
    }
})

或项目现有兼容方案进行访问。

请根据当前源码真实实现确认最终生产调用方式，不允许凭空重写业务协议。

---

# 三、核心目标

实现两套运行模式：

## 1. 本地开发模式

保持现有开发体验：

client
workbench
admin
    ↓
http://127.0.0.1:4176
    ↓
本地 API / Mock API

本地启动时仍然可以正常使用当前 4176 API。

例如：

API_MODE=local

或：

VITE_API_MODE=local

开发环境允许：

VITE_API_BASE=http://127.0.0.1:4176

---

## 2. uniCloud 生产模式

执行生产 build 后：

client
workbench
admin
    ↓
uniCloud
    ↓
game-service
    ↓
uniCloud 云数据库

生产构建产物中：

禁止存在：

127.0.0.1
localhost
127.0.0.1:4176
localhost:4176
127.0.0.1:5173
127.0.0.1:5174
127.0.0.1:5175

生产环境不得依赖开发电脑。

---

# 四、第一步：全面检查现有实现

请先搜索整个项目，重点检查：

apps/client
apps/workbench
apps/admin
packages
config
.env*
package.json

重点搜索：

127.0.0.1
localhost
4176
VITE_API_BASE
VITE_API_MODE
API_MODE
fetch(
axios
uni.request
uniCloud.callFunction
uniCloud.importObject
api.js
request.js
http.js

排除：

node_modules
dist
.git
.runtime

先理解当前三个前端调用 API 的真实架构。

不要直接对 dist 中压缩后的 JS 做修改。

所有修改必须发生在源码和构建配置层。

---

# 五、设计统一 API Adapter

请尽量建立统一的 API 访问层。

推荐逻辑：

业务页面
    ↓
统一 API Adapter
    │
    ├── local
    │      ↓
    │   HTTP 127.0.0.1:4176
    │
    └── unicloud
           ↓
       game-service

例如概念上：

request(action, payload)
    ↓
判断 API_MODE
    ↓
local:
fetch(`${API_BASE}/...`)

production/unicloud:
uniCloud.callFunction({
    name: 'game-service',
    data: {
        action,
        payload
    }
})

但是：

必须根据当前 game-service 与本地 API 的真实请求协议实现。

不要臆造 action 名称、字段名或者返回结构。

尽量保持现有：

页面
→ api.js
→ 业务调用

接口不变，只修改 api.js / request adapter 内部实现。

目标是尽量不需要修改大量业务页面。

---

# 六、环境配置要求

建议建立清晰的环境配置。

例如：

.env.development

VITE_APP_ENV=development
VITE_API_MODE=local
VITE_API_BASE=http://127.0.0.1:4176

以及：

.env.production

VITE_APP_ENV=production
VITE_API_MODE=unicloud

生产环境：

不要配置：

VITE_API_BASE=http://127.0.0.1:4176

如果 production 使用 uniCloud.callFunction，则 production 根本不应该依赖本地 HTTP API 地址。

如果当前项目架构必须使用 URL 化 HTTP 云函数，请根据源码真实情况实现：

VITE_API_BASE=https://正式云端API地址

但不要随意编造域名。

如果域名目前尚未确定，应采用可配置占位方式，并在 README 中明确说明。

优先判断当前 uni-app 项目是否适合直接：

uniCloud.callFunction({
    name: 'game-service'
})

如果可以，则优先使用直接云函数调用方案，避免额外 HTTP API 地址。

---

# 七、安全要求

绝对禁止把这些服务器 Secret 打包到前端：

INTERNAL_SECRET
SCHEDULER_SECRET
SESSION_SECRET
H5_TOKEN_SECRET
WECHAT_MP_SECRET
WECHAT_MP_KF_TOKEN
WECHAT_PAY_PRIVATE_KEY
WECHAT_PAY_APIV3_KEY
PII_KEYS_JSON
MFA_ENCRYPTION_KEY

任何：

VITE_*

变量都必须视为公开前端变量。

严禁把服务器密钥放进 VITE_*。

---

# 八、三个前端部署路径

生产部署路径固定为：

client
→ /

workbench
→ /workbench/

admin
→ /admin/

因此必须检查对应：

manifest.json
vite.config.js
router 配置
base 配置

确保最终生产构建：

client:
/

workbench:
/workbench/

admin:
/admin/

不要破坏 hash router。

当前 admin 已存在类似：

"h5": {
    "router": {
        "mode": "hash",
        "base": "/admin/"
    }
}

请检查另外两个应用并统一正确配置。

---

# 九、构建产物要求

三个项目最终生产构建产物目标：

apps/client/dist/build/h5
apps/workbench/dist/build/h5
apps/admin/dist/build/h5

每个目录必须存在：

index.html

以及对应 assets/static 等文件。

---

# 十、package.json 构建命令

请检查三个：

apps/client/package.json
apps/workbench/package.json
apps/admin/package.json

以及根目录 package.json。

在不破坏已有命令的情况下，提供明确的：

本地开发命令

和：

生产构建命令。

如果合适，可以增加：

dev
build
build:prod

或者根项目统一：

dev:client
dev:workbench
dev:admin

build:client
build:workbench
build:admin
build:all

具体以当前 package.json 架构为准，不要机械增加重复命令。

---

# 十一、最好提供一个一键生产构建脚本

请优先在：

script/

或：

scripts/

下增加：

build-unicloud.ps1

目标：

1. 检查依赖
2. 设置/使用 production 环境
3. 构建 client
4. 构建 workbench
5. 构建 admin
6. 检查三个 index.html 是否存在
7. 扫描构建产物是否存在 localhost / 127.0.0.1
8. 如果存在则构建失败并退出非 0
9. 如果全部正常，则显示三个最终部署目录

例如最终输出：

BUILD SUCCESS

Client:
apps/client/dist/build/h5

Workbench:
apps/workbench/dist/build/h5

Admin:
apps/admin/dist/build/h5

---

# 十二、构建后的强制安全检查

在 build-unicloud.ps1 中自动扫描：

127.0.0.1
localhost
:4176
:5173
:5174
:5175

扫描范围：

apps/client/dist/build/h5
apps/workbench/dist/build/h5
apps/admin/dist/build/h5

如果发现任何本地地址：

输出具体：

应用
文件
匹配内容

然后：

exit 1

禁止把错误构建包作为成功产物。

---

# 十三、本地开发不能被破坏

修改完成后必须验证：

本地开发：

client
→ Local API :4176

workbench
→ Local API :4176

admin
→ Local API :4176

仍然可以正常运行。

不能为了部署 uniCloud 而把本地开发方案彻底删除。

最终设计必须是：

                   API Adapter
                       │
             ┌─────────┴─────────┐
             │                   │
       development            production
             │                   │
             ↓                   ↓
    127.0.0.1:4176          uniCloud
                              │
                              ↓
                         game-service

---

# 十四、不要修改的内容

本次任务不要：

1. 删除或修改 uniCloud 云端资源。
2. 删除数据库。
3. 自动上传云函数。
4. 自动上传网页托管。
5. 修改真实微信支付配置。
6. 修改真实微信 Secret。
7. 修改 game-service 的业务规则，除非为兼容前端调用确实必要。
8. 修改 dist 压缩 JS 来“掩盖”localhost。
9. 硬编码生产域名。
10. 破坏当前本地运行流程。

本次只负责：

前端环境架构
+
API Adapter
+
生产构建
+
生产构建校验。

---

# 十五、完成后实际执行测试

请实际执行：

1. 三个项目 build
2. 检查 build 是否成功
3. 检查三个 index.html
4. 扫描 localhost
5. 扫描 127.0.0.1
6. 扫描 4176

要求最终生产构建：

0 个 localhost
0 个 127.0.0.1
0 个 :4176

注意：

如果第三方依赖内部包含与业务无关的字符串，必须说明来源，不能简单误判。

---

# 十六、最终需要输出给我

任务完成后请给出：

## 1. 修改文件清单

例如：

apps/client/src/api.js
apps/workbench/src/api.js
apps/admin/src/api.js
apps/*/.env.production
apps/*/.env.development
script/build-unicloud.ps1
package.json
...

## 2. 修改后的架构

简单说明：

本地：
Frontend → 4176

生产：
Frontend → uniCloud → game-service

## 3. 本地运行命令

必须给完整 PowerShell 命令。

## 4. uniCloud 生产构建命令

必须给完整 PowerShell 命令。

最好最终能够：

powershell -ExecutionPolicy Bypass -File .\script\build-unicloud.ps1

完成三个前端的一键生产构建。

## 5. 最终构建产物

明确告诉我：

client 上传哪个目录
workbench 上传哪个目录
admin 上传哪个目录

## 6. 检查结果

明确列出：

client localhost residue = 0
workbench localhost residue = 0
admin localhost residue = 0

## 7. 不允许只给方案

请直接检查当前代码并完成修改。

修改后实际执行构建和检查。

如果发现当前源码结构与上述假设不同，以真实源码为准调整实现，但必须满足：

“本地可以继续调试 + production 可以直接部署 uniCloud + production 构建不包含本地 API 地址”

这一最终目标。