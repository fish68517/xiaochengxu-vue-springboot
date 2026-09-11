# uni-app / uniCloud Web 页面上线后打不开：快速排查方案

> 适用场景：本地新增页面，例如 `pages/security/index.vue`，HBuilderX 已重新发行并上传到 uniCloud 前端网页托管，但线上访问仍打不开、跳回首页、跳登录页，或怀疑线上仍是旧代码。

## 1. 排查顺序

```text
源码页面是否存在
→ pages.json 是否注册
→ HBuilderX 构建包是否包含新页面
→ 云端 index.html 是否是新版本
→ 云端动态 JS chunk 是否存在
→ 浏览器是否加载该 chunk
→ 路由 / 登录 / 权限逻辑是否重定向
```

## 2. 检查 pages.json 是否注册页面

```powershell
cd E:\bishe27\服务平台小程序\code

Select-String `
  -Path .\apps\admin\src\pages.json `
  -Pattern 'pages/security/index','security' `
  -Context 3,5
```

正确应看到：

```json
{
  "path": "pages/security/index",
  "style": {
    "navigationBarTitleText": "安全中心"
  }
}
```

如果没有，说明 `.vue` 文件虽然存在，但 uni-app 没注册路由。

## 3. 检查 HBuilderX 是否刚刚重新构建

```powershell
Get-Item `
  .\apps\admin\dist\build\web\index.html |
Select-Object FullName,LastWriteTime
```

确认 `LastWriteTime` 是刚刚 HBuilderX Web 发行的时间。

## 4. 检查本地生产包是否包含新页面

```powershell
Get-ChildItem `
  .\apps\admin\dist\build\web `
  -Recurse -File |
Select-String `
  -Pattern '安全中心','修改登录密码','pages/security/index' `
  -SimpleMatch |
Select-Object Path,LineNumber |
Format-Table -AutoSize
```

如果能看到类似：

```text
assets\pages-security-index.xxxxx.js
```

说明：

```text
源码            ✅
pages.json      ✅
HBuilderX 编译  ✅
```

## 5. 获取云端实际返回的 index.html

```powershell
$Url = "https://h5.qmhyjoy.com/admin/index.html?v=$([DateTimeOffset]::Now.ToUnixTimeSeconds())"

$remote = (Invoke-WebRequest `
  -Uri $Url `
  -UseBasicParsing).Content

$remote | Set-Content `
  .\remote-admin-index.html `
  -Encoding UTF8

$remote
```

`?v=时间戳` 用于避免浏览器/CDN 返回旧缓存。

## 6. 比较本地和云端 index.html 使用的主 JS

本地：

```powershell
Select-String `
  -Path .\apps\admin\dist\build\web\index.html `
  -Pattern '\.js'
```

云端：

```powershell
Select-String `
  -Path .\remote-admin-index.html `
  -Pattern '\.js'
```

如果两边主 JS 文件名一致，例如：

```text
/admin/assets/index-h8zZ6JRb.js
```

说明云端 `index.html` 已经是新版本。

如果不同，说明可能是：

```text
上传失败 / CDN 缓存 / 云端仍是旧 index.html
```

## 7. 检查云端安全中心 chunk 是否存在

假设本地生成：

```text
pages-security-index.HJi5DZsG.js
```

执行：

```powershell
$url = "https://h5.qmhyjoy.com/admin/assets/pages-security-index.HJi5DZsG.js?v=$([DateTimeOffset]::Now.ToUnixTimeSeconds())"

$r = Invoke-WebRequest `
  -Uri $url `
  -UseBasicParsing

$r.StatusCode
$r.Content.Length
```

正常应为：

```text
200
```

如果是 `404`，说明 `index.html` 已更新，但 `assets` 没有完整上传。

## 8. 比较本地和云端 chunk 是否一致

```powershell
$local = ".\apps\admin\dist\build\web\assets\pages-security-index.HJi5DZsG.js"
$remote = ".\remote-security.js"

Invoke-WebRequest `
  "https://h5.qmhyjoy.com/admin/assets/pages-security-index.HJi5DZsG.js?v=$([DateTimeOffset]::Now.ToUnixTimeSeconds())" `
  -OutFile $remote `
  -UseBasicParsing

Write-Host "LOCAL:"
Get-FileHash $local -Algorithm SHA256

Write-Host "REMOTE:"
Get-FileHash $remote -Algorithm SHA256
```

如果 SHA256 一致，说明安全中心代码已经成功部署到阿里云。

## 9. 搜索路由 / 登录 / 权限重定向

```powershell
Get-ChildItem `
  .\apps\admin\src `
  -Recurse -File |
Select-String -Pattern `
'pages/security/index',
'reLaunch',
'redirectTo',
'navigateTo',
'switchTab',
'mustChange',
'forceChange',
'passwordExpired',
'initialPassword',
'security' |
Select-Object Path,LineNumber,Line |
Format-Table -AutoSize
```

重点检查：

```text
App.vue
main.js
AdminShell
auth
login
security
```

尤其关注：

```js
uni.reLaunch(...)
uni.redirectTo(...)
uni.navigateTo(...)
```

以及“未登录、角色不匹配、必须修改密码、Session 失效”等逻辑。

## 10. 浏览器 F12 最终确认

打开：

```text
https://h5.qmhyjoy.com/admin/#/pages/security/index
```

然后：

```text
F12
→ Network
→ JS
```

观察是否请求：

```text
pages-security-index.xxxxx.js
```

判断：

```text
200
→ 页面代码已加载
→ 查页面逻辑 / 权限 / 重定向

404
→ assets 上传不完整

完全没有请求
→ 进入页面前就被路由/登录逻辑重定向
```

再观察地址栏：

```text
/admin/#/pages/login/index
→ 登录状态 / Session 问题

/admin/#/
→ Router / 权限重定向

/admin/#/pages/security/index 保持不变但白屏
→ 看 Console 运行时报错
```

## 11. 浏览器全局搜索线上代码

Chrome：

```text
F12
→ Sources
→ Ctrl + Shift + F
```

搜索：

```text
安全中心
修改登录密码
pages/security/index
```

如果线上能搜到这些文本，说明云端 JS 已包含新页面代码。

## 12. 最简判断表

| 现象 | 结论 |
|---|---|
| `pages.json` 找不到页面 | 页面未注册 |
| 本地 `dist/build/web` 搜不到页面 | HBuilderX 未编译进去 |
| 本地主 JS 与云端主 JS 不一致 | 云端旧版本 / CDN 缓存 |
| 主 JS 一致，但 security chunk 404 | assets 上传不完整 |
| security chunk 200，SHA256 一致 | 云端代码正确 |
| chunk 正确但页面打不开 | 路由 / 登录 / 权限问题 |
| URL 跳到 login | 登录状态 / Session 问题 |
| URL 跳到首页 | Router / 权限重定向 |
| URL 不变但白屏 | 页面运行时 JS 错误 |

## 13. 推荐的实际执行顺序

```powershell
cd E:\bishe27\服务平台小程序\code
```

```powershell
Select-String `
  -Path .\apps\admin\src\pages.json `
  -Pattern 'pages/security/index','security' `
  -Context 3,5
```

```powershell
Get-Item `
  .\apps\admin\dist\build\web\index.html |
Select-Object FullName,LastWriteTime
```

```powershell
Get-ChildItem `
  .\apps\admin\dist\build\web `
  -Recurse -File |
Select-String `
  -Pattern '安全中心','修改登录密码','pages/security/index' `
  -SimpleMatch |
Select-Object Path,LineNumber
```

```powershell
$Url = "https://h5.qmhyjoy.com/admin/index.html?v=$([DateTimeOffset]::Now.ToUnixTimeSeconds())"

$remote = (Invoke-WebRequest `
  -Uri $Url `
  -UseBasicParsing).Content

$remote | Set-Content `
  .\remote-admin-index.html `
  -Encoding UTF8
```

```powershell
Select-String `
  -Path .\apps\admin\dist\build\web\index.html `
  -Pattern '\.js'

Select-String `
  -Path .\remote-admin-index.html `
  -Pattern '\.js'
```

然后按本地实际生成的 security 文件名检查：

```powershell
$url = "https://h5.qmhyjoy.com/admin/assets/pages-security-index.HJi5DZsG.js?v=$([DateTimeOffset]::Now.ToUnixTimeSeconds())"

$r = Invoke-WebRequest `
  -Uri $url `
  -UseBasicParsing

$r.StatusCode
$r.Content.Length
```

最后搜索重定向：

```powershell
Get-ChildItem `
  .\apps\admin\src `
  -Recurse -File |
Select-String -Pattern `
'pages/security/index',
'reLaunch',
'redirectTo',
'navigateTo',
'mustChange',
'initialPassword',
'security' |
Select-Object Path,LineNumber,Line
```

## 14. 一句话总结

不要反复盲目重新上传。

正确排查链路是：

```text
源码
→ 路由注册
→ HBuilderX 构建
→ 云端 index.html
→ 动态 chunk
→ CDN
→ Router
→ Auth / 权限
```

按这条链逐层确认，就能定位问题到底发生在哪一层。
