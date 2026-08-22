可以，而且这正适合你现在的阶段。我们把架构定成 **“服务器配置尽量固定，HTTP/HTTPS 切换主要由本地构建决定”**，同时兼顾后台管理和微信小程序。

关键是：**后台管理与小程序不能完全采用同一种 API 地址策略。** 后台是浏览器网页，可以使用 `/api/...` 相对路径；微信小程序没有网页的同源基地址，`wx.request` 仍需要完整 API 地址。因此最合适的是下面这个长期架构。

```text
                         腾讯云 124.222.131.30
                                  │
                              Nginx
                ┌─────────────────┴────────────────┐
                │                                  │
     admin.petlifemall.com              api.petlifemall.com
                │                                  │
         ┌──────┴──────┐                           │
         │             │                           │
       / 页面        /api/*                       /*
         │             │                           │
    admin-web           └──────────┬────────────────┘
                                   ↓
                           127.0.0.1:8000
                                   ↓
                               FastAPI
                                   ↓
                                MySQL
```

这样以后有三个很大的好处：

* **后台 admin-web 只构建一次**，HTTP 和 HTTPS 都能使用。
* 小程序只需要在本地构建时切换 `http` / `https`。
* FastAPI、MySQL、`.env.local` 基本不用为了 HTTP/HTTPS 来回修改。

---

## 一、服务器只需要再改这一次 Nginx

你目前 `admin.petlifemall.com` 的 Nginx 应该只有静态页面：

```nginx
server {
    listen 80;
    server_name admin.petlifemall.com;

    root C:/PetLifeMall/admin-web;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

现在把它改成：

```nginx
server {
    listen 80;
    server_name admin.petlifemall.com;

    root C:/PetLifeMall/admin-web;
    index index.html;

    # 管理后台的 API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Vue 管理后台
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

原来的 API 域名继续保留：

```nginx
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
```

也就是说同时保留两条 API 入口：

```text
后台：
admin.petlifemall.com/api/*
              ↓
           FastAPI

小程序：
api.petlifemall.com/api/*
              ↓
           FastAPI
```

这是整个方案的核心。

---

## 二、修改 Nginx 后检查

服务器 PowerShell：

```powershell
cd C:\nginx
.\nginx.exe -t
```

必须看到：

```text
syntax is ok
test is successful
```

然后：

```powershell
.\nginx.exe -s reload
```

测试后台同源 API：

```powershell
Invoke-RestMethod `
  "http://127.0.0.1/health" `
  -Headers @{ Host="admin.petlifemall.com" }
```

这里 `/health` 本身不是 `/api`，因此更准确测试 `/api` 是否进入 FastAPI，可以先测试一个你项目中实际存在的 `/api/v1/...` 路径。即使返回 `401/404`，只要是 FastAPI 的响应而不是 Nginx 404，就证明代理生效。

原部署文档里 Nginx 本来就是负责把请求转给 `127.0.0.1:8000`，这里我们只是额外让 admin 域名的 `/api/` 也走同一套 FastAPI。

---

# 三、本地 admin-web 从此固定使用相对地址

你的本机 Windows CMD：

```cmd
cd /d E:\bishe27\wxMiniProgram\apps\admin-web
```

以后不要再写：

```text
http://api.petlifemall.com/api/v1/admin
```

也不要写：

```text
https://api.petlifemall.com/api/v1/admin
```

统一改为：

```cmd
set "VITE_ADMIN_API_BASE=/api/v1/admin"
npm.cmd run build
```

你的项目本身就是通过 `VITE_ADMIN_API_BASE` 在构建阶段写 API 地址。

然后上传新的：

```text
E:\bishe27\wxMiniProgram\apps\admin-web\dist\
```

覆盖：

```text
C:\PetLifeMall\admin-web\
```

以后管理员浏览器打开：

```text
http://admin.petlifemall.com
```

登录请求会自动成为：

```text
http://admin.petlifemall.com/api/v1/admin/auth/login
```

以后证书好了，打开：

```text
https://admin.petlifemall.com
```

同一份 JS 自动变成：

```text
https://admin.petlifemall.com/api/v1/admin/auth/login
```

**admin-web 不需要重新 build。**

---

# 四、这样 CORS 也基本不用折腾了

原来你的结构是：

```text
http://admin.petlifemall.com
          ↓ 跨域
https://api.petlifemall.com
```

浏览器会触发：

```text
OPTIONS
CORS
```

现在变成：

```text
http://admin.petlifemall.com
          ↓
http://admin.petlifemall.com/api/...
```

这是：

```text
协议相同   ✅
域名相同   ✅
端口相同   ✅
```

属于**同源请求**。

所以后台管理基本不再依赖 CORS。

你的 `.env.local` 也不需要因为：

```text
HTTP → HTTPS
```

反复修改 `FRONTEND_ORIGINS`。

这正符合你“不想频繁修改腾讯云服务器配置”的目标。

---

# 五、小程序采用另一套策略

这里必须特别说明：

> **小程序不能把 API_BASE 设置成 `/api/v1`。**

因为 admin-web 是网页：

```text
页面地址：
http://admin.petlifemall.com

/api/v1
↓ 浏览器自动补全
http://admin.petlifemall.com/api/v1
```

但微信小程序不是一个运行在：

```text
admin.petlifemall.com
```

上的网页，所以：

```text
/api/v1
```

没有我们需要的服务器 Origin。

因此小程序继续使用：

```text
VITE_API_BASE_URL
```

的完整地址。你的部署文档本来也通过这个环境变量控制小程序生产 API。

---

# 六、现在备案审核期间：小程序灰度版本

本机 Windows CMD：

```cmd
cd /d E:\bishe27\wxMiniProgram\apps\miniprogram
```

灰度构建：

```cmd
set "VITE_API_BASE_URL=http://api.petlifemall.com/api/v1"
pnpm.cmd build:mp-weixin
```

生成：

```text
E:\bishe27\wxMiniProgram\apps\miniprogram\dist\build\mp-weixin
```

然后导入微信开发者工具。

开发者工具阶段开启：

```text
不校验合法域名、TLS版本及HTTPS证书
```

于是开发阶段就是：

```text
微信开发者工具
       ↓
http://api.petlifemall.com/api/v1
       ↓
Nginx :80
       ↓
FastAPI
       ↓
MySQL
```

这样商品、登录、购物车、订单、抽奖等后端业务都可以直接连接腾讯云真实数据库调试。

不过这里有明确边界：

> **备案/HTTPS 尚未完成时，这种 HTTP 方案主要用于微信开发者工具灰度调试，不应该把它当成正式体验版/正式版方案。**

你的部署文档也明确写了：“不校验合法域名”只能临时调试，体验版和正式版本最终仍需要 HTTPS 合法域名。

---

# 七、备案 + SSL 完成之后，小程序只改一条本地构建命令

届时服务器 FastAPI、MySQL、业务代码都不需要动。

本地：

```cmd
cd /d E:\bishe27\wxMiniProgram\apps\miniprogram
```

正式构建：

```cmd
set "VITE_API_BASE_URL=https://api.petlifemall.com/api/v1"
pnpm.cmd build:mp-weixin
```

于是：

```text
微信正式小程序
       ↓
https://api.petlifemall.com/api/v1
       ↓
Nginx :443
       ↓
FastAPI
       ↓
MySQL
```

然后微信公众平台添加：

```text
request 合法域名：

https://api.petlifemall.com
```

注意只填域名，不加 `/api/v1`。部署文档也是这样要求的。

---

# 八、以后你的实际发布方式就非常简单

### Admin 后台

以后永远：

```cmd
set "VITE_ADMIN_API_BASE=/api/v1/admin"
npm.cmd run build
```

不区分 HTTP / HTTPS。

同一份构建产物：

```text
HTTP 灰度：
http://admin.petlifemall.com

HTTPS 正式：
https://admin.petlifemall.com
```

都可以。

### 小程序灰度

```cmd
set "VITE_API_BASE_URL=http://api.petlifemall.com/api/v1"
pnpm.cmd build:mp-weixin
```

用于当前开发者工具联调。

### 小程序正式

```cmd
set "VITE_API_BASE_URL=https://api.petlifemall.com/api/v1"
pnpm.cmd build:mp-weixin
```

用于备案、证书、微信合法域名全部完成以后。

---

## 最终我们把环境固定成这样

```text
                         【腾讯云：长期基本不改】
                                  │
                             Nginx
                ┌─────────────────┴─────────────────┐
                │                                   │
        admin.petlifemall.com               api.petlifemall.com
                │                                   │
      ┌─────────┴──────────┐                        │
      │                    │                        │
      /                 /api/*                      /*
      │                    │                        │
 admin-web                  └───────────┬────────────┘
                                       │
                                 FastAPI :8000
                                       │
                                 MySQL :3306


【本地 Windows】

admin-web
VITE_ADMIN_API_BASE=/api/v1/admin
               │
               └── HTTP / HTTPS 通吃


miniprogram
               │
        ┌──────┴──────┐
        │             │
      灰度           正式
        │             │
      HTTP          HTTPS
        │             │
        └──────┬──────┘
               ↓
      api.petlifemall.com
```

我建议**就定这个方案，不再改变总体架构**。

现在第一件事不是改小程序，而是先完成一次性服务器配置：**给 `admin.petlifemall.com` 增加 `location /api/ → 127.0.0.1:8000`**。然后重新以：

```cmd
VITE_ADMIN_API_BASE=/api/v1/admin
```

构建 admin-web。

先把管理员登录跑通后，再用：

```cmd
VITE_API_BASE_URL=http://api.petlifemall.com/api/v1
```

构建小程序灰度版。这样后台和小程序会同时操作**同一台腾讯云、同一个 FastAPI、同一个 MySQL `pet_life_prod`**。
