# 微信小程序“立即下单”会话失效代码审计

## 1. 当前真实调用链

### 1.1 小程序启动阶段

```text
apps/client/src/App.vue:6 onLaunch
  → App.vue:16 ensureSession()
  → apps/client/src/api.js:145 ensureSession(force=false)
  → api.js:146 读取本地 __client_session_v1__
  → 有 token：直接返回，不重新登录
  → 无 token：api.js:156 getWxLoginCode()
  → wx.login 获取 code
  → api.js:149 / api.js:172 api.miniLogin(code)
  → 云函数 game-service/miniLogin
  → 返回 CUSTOMER token
  → api.js:151 setSession(session)
```

`App.vue` 的登录异常会被捕获，只打印“会话初始化跳过”，不会阻止首页公开商品加载。

### 1.2 点击“立即下单”阶段

```text
apps/client/src/pages/product/detail.vue:26 orderNow()
  → ensureSession()
  → 本地已有 token 时直接复用
  → api.h5Token(productId)
  → apps/client/src/api.js:176 call('h5Token')
  → api.js:127 doCall() 自动从本地会话取 token
  → uniCloud game-service action=h5Token
  → 鉴权失败：UNAUTHORIZED / 会话已失效，请重新登录
```

如果 `h5Token` 成功，后续原设计是：

```text
product/detail.vue:26
  → uni.navigateTo('/pages/order/webview-shell?token=...')
  → pages/order/webview-shell.vue:18 onLoad
  → webview-shell.vue:28 组装 https://h5.qmhyjoy.com/#/pages/h5-order/index?token=...
  → web-view 打开 H5 下单页
  → pages/h5-order/index.vue:122 submitOrder()
  → h5-order/index.vue:138 api.createOrderFromH5()
  → 根据环境进入 JSAPI 或 MWEB 支付
```

## 2. miniLogin 实际调用链

### 2.1 前端

`apps/client/src/api.js:145` 的 `ensureSession(force=false)` 只判断本地是否存在 token：

```js
const existing = getSession();
if (!force && existing && existing.token) return existing;
```

它不会在前端检查：

- token 是否过期；
- token 是否包含 `role`；
- token 签名是否仍与云端 `SESSION_SECRET` 匹配；
- token 对应客户是否仍存在。

没有本地 token 时，执行 `api.js:156 getWxLoginCode()`，通过 `wx.login` 获取 code，再调用 `api.js:172 miniLogin`。

### 2.2 uniCloud 后端

```text
apps/client/uniCloud-aliyun/cloudfunctions/game-service/lib/services.cjs:547 miniLogin
  → lib/oauth.cjs:37 miniLogin(code)
  → oauth.cjs:38-39 读取 WECHAT_MP_APPID / WECHAT_MP_SECRET
  → 微信 jscode2session
  → 得到 openid
  → services.cjs:550 解析 demo-a 品牌
  → customers 表创建或读取客户
  → services.cjs:558 auth.issueSession(customer, access)
```

当前微信 AppID 配置在 `apps/client/src/manifest.json:8-9`：

```text
wxe40bb897376601cc
```

DCloud AppID 位于 `manifest.json:3`：

```text
__UNI__80260AB
```

两者用途不同，当前错误与 DCloud AppID 无关。

## 3. h5Token 实际用途

结论：`h5Token` 的实际设计是题目选项 **B**。

```text
微信小程序 CUSTOMER Session
  → 申请 h5Token
  → 将小程序客户身份、商品和品牌绑定到短期 Token
  → 小程序 web-view 打开 H5 下单页面
  → H5 页面使用该 Token 创建订单和支付
```

证据：

- `auth.cjs:60`：`h5Token` 只允许 `CUSTOMER` 角色。
- `services.cjs:732-743`：有客户会话时生成 `mode='app'` 的 H5 Token，并绑定 `session.openid`、`productId` 和 `brandId`。
- `product/detail.vue:26`：小程序详情页主动申请 `h5Token`。
- `webview-shell.vue:10-28`：明确把 Token 传入 H5 下单页。
- `h5-order/index.vue:138`：H5 页面调用 `createOrderFromH5`。

因此小程序调用 `h5Token` 本身是当前架构的正常设计，不是错误复用了接口。函数名中的 H5 指它是“小程序到 H5 下单页的桥接凭证”。

## 4. mp-weixin 与 H5 的差异

### 4.1 mp-weixin

```text
wx.login
→ miniLogin
→ CUSTOMER Session
→ h5Token
→ 小程序 web-view
→ H5 下单页
```

### 4.2 普通 H5

普通 H5 没有小程序 `wx.login` 能力。直接从普通 H5 商品详情调用 `ensureSession` 会失败，这是另一个已经识别的问题。

### 4.3 当前没有原生小程序支付页

在 `apps/client/src` 中未找到 `wx.requestPayment` 或 `uni.requestPayment` 调用。当前支付不是：

```text
小程序原生页面 → wx.requestPayment
```

而是混合模式：

```text
小程序负责登录和选择商品
→ H5 web-view 负责填写订单与发起支付
→ 微信内 web-view 使用 WeixinJSBridge JSAPI 支付
→ 微信外 H5 使用 MWEB 支付
```

相关代码：

- `h5-order/index.vue:190`：`payInWechatWebview`。
- `h5-order/index.vue:212`：`payOutsideWechat`。
- `h5-order/index.vue:262-268`：通过 `WeixinJSBridge.invoke('getBrandWCPayRequest')` 拉起支付。
- `h5-order/index.vue:220`：普通浏览器跳转 MWEB 地址。
- `services.cjs:851-883`：云端生成 JSAPI/MWEB 支付参数。

## 5. UNAUTHORIZED 根因候选

### 5.1 CONFIRMED：miniLogin 签发的 CUSTOMER token 缺少 `role`

这是本次错误的直接根因。

`services.cjs:558` 当前调用：

```js
auth.issueSession(customer, {
  roles: ['CUSTOMER'],
  brandScopes: [brand.brandId],
  permissions: [],
});
```

但是 `customers` 记录只包含 `_id`、`openid`、`brandId`、`isVip` 等字段，没有 `role` 字段。

`auth.cjs:189-190` 的 `issueSession` 却从 `user.role` 读取主角色：

```js
const role = normalizeRole(user.role);
```

因此最终 Token 的实际结构是：

```json
{
  "userId": "customer-...",
  "roles": ["CUSTOMER"],
  "brandScopes": ["demo-a"]
}
```

其中有 `roles=["CUSTOMER"]`，但没有 `role="CUSTOMER"`。本地只读复现也确认 `auth.issueSession(customer, ...)` 生成的 claims 会遗漏 `role`。

### 5.2 CONFIRMED：角色矩阵放行后，又因为主角色为空走错分支

`auth.cjs:238`：

```js
const role = normalizeRole(payload.role);
```

因为 Token 没有 `role`，这里得到 `undefined`。

随后角色集合仍包含 `payload.roles` 中的 `CUSTOMER`，所以 `h5Token` 的角色矩阵校验能够通过。但 `auth.cjs:243` 的客户专用分支判断失败：

```js
if (role === 'CUSTOMER') {
  // 不会进入
}
```

程序继续执行 `auth.cjs:249`：

```js
await security(repo).validateSession(payload, action);
```

### 5.3 CONFIRMED：customerId 被错误地拿到 users 表校验

`account-security.cjs:224-230` 的 `validateSession` 面向员工/管理账号：

```text
使用 session.userId 查询 users
→ CUSTOMER 的 userId 实际对应 customers._id
→ users 中找不到该记录
→ 抛出“会话已失效，请重新登录”
```

这与现场返回的错误文本完全一致。

正常情况下，如果 Token 正确包含 `role='CUSTOMER'`，`auth.cjs:243-247` 会在 `customers` 表校验客户并直接返回，不会进入员工账号的 `validateSession`。

### 5.4 CONFIRMED：auth_sessions 不是正常 CUSTOMER 会话的必要条件

当前客户登录使用 `auth.issueSession`，没有调用 `account-security.createSession`，因此不会写入 `auth_sessions`，Token 也没有 `sid`。

按当前设计，CUSTOMER 应由 `auth.cjs:243-247` 在 `customers` 集合校验。只有员工和管理员会进入 `account-security.validateSession` 并检查 `users`、`securityVersion` 和 `auth_sessions`。

本次由于 `role` 丢失，CUSTOMER 被错误送进了员工会话校验路径。不能通过手工给客户补 `auth_sessions` 来掩盖这个问题。

### 5.5 HIGH_PROBABILITY：本地会话会持续复用这枚错误 Token

`api.js:145-147` 只要本地存在 token 就直接返回。因此重新编译、热更新或重新点击按钮，不一定会重新执行 `wx.login/miniLogin`。

修复云函数后，微信开发者工具仍需清理 Storage 或让前端强制重新登录，否则可能继续携带旧 Token。

### 5.6 POSSIBLE：云端代码与本地代码版本不一致

只构建微信小程序不会自动部署 `game-service` 云函数。如果修复后仅重新构建 client、没有上传云函数，云端仍会执行旧逻辑。

应核对实际上传目标是否为：

```text
apps/client/uniCloud-aliyun/cloudfunctions/game-service
```

### 5.7 NOT_SUPPORTED_BY_CODE：h5Token 比其他 CUSTOMER action 强制检查 MFA

没有证据支持。`h5Token` 只要求 CUSTOMER 角色、商品有效、品牌 scope 匹配，不要求 MFA。

### 5.8 NOT_SUPPORTED_BY_CURRENT_ERROR：SESSION_SECRET 不一致

如果 Token 签名密钥变化，`auth.verify` 会提示“无效的会话 token”；如果过期，会提示“会话已过期,请重新登录”。这两种文本都与当前“会话已失效，请重新登录”不同，因此不是当前最匹配的根因。

## 6. 当前微信小程序正确业务链

依据现有源码，正确链路不是原生小程序直接创建订单，而是：

```text
微信 AppID wxe40bb897376601cc
→ 根据 appId/brandCode 解析 demo-a
→ wx.login 获取临时 code
→ miniLogin
→ jscode2session 换取 openid
→ 创建/读取 customers 记录
→ 签发包含 role=CUSTOMER 的客户 Session
→ 加载商品
→ h5Token 绑定 CUSTOMER openid + productId + demo-a
→ 小程序 web-view 打开 H5 下单页
→ createOrderFromH5
→ 微信内 WeixinJSBridge JSAPI 支付
→ 支付回调确认订单
```

当前链路断在“签发包含 `role=CUSTOMER` 的客户 Session”这一步。

## 7. 当前问题最小修复建议

本次审计不修改代码。建议后续按以下最小范围修复：

1. 在云函数 `miniLogin` 签发会话时显式传入客户主角色：

   ```js
   auth.issueSession({ ...customer, role: 'CUSTOMER' }, {
     roles: ['CUSTOMER'],
     brandScopes: [brand.brandId],
     permissions: [],
   });
   ```

2. 在 `issueSession` 增加防御校验：主角色为空时拒绝签发，避免再次生成只有 `roles`、没有 `role` 的 Token。
3. 同步修改阿里云部署目录、uniCloud 兼容目录、TCB 镜像和本地 backend 镜像，避免不同部署源漂移。
4. 增加最小回归验证：`miniLogin` 返回的 Token 必须同时包含：

   ```text
   role = CUSTOMER
   roles 包含 CUSTOMER
   brandScopes 包含 demo-a
   userId 对应 customers._id
   ```

5. 部署 `game-service` 后，在微信开发者工具清除 Storage，再重新编译/登录，确保重新调用 `miniLogin`。
6. 前端可增加一次受控恢复：`h5Token` 返回 `UNAUTHORIZED` 时清除客户会话，执行一次 `ensureSession(true)` 后重试；必须限制为一次，避免死循环。

不建议：

- 不建议把 `h5Token` 改成完全公开接口。
- 不建议把 CUSTOMER 数据复制进 `users` 表。
- 不建议手工伪造 `auth_sessions`。
- 不需要修改支付配置。
- 不需要重构当前小程序 → H5 web-view 的整体下单架构。

## 8. 修复后的验收点

1. 清空微信开发者工具 Storage 后启动小程序。
2. Network 中确认先出现 `miniLogin`，且返回成功。
3. 解码测试 Token，确认同时存在 `role='CUSTOMER'` 和 `roles=['CUSTOMER']`。
4. 点击“立即下单”，`h5Token` 返回 `{ token: ... }`。
5. 页面进入 `pages/order/webview-shell`。
6. web-view 地址包含 `/#/pages/h5-order/index?token=...`。
7. H5 下单页能够读取商品并提交订单。
8. 此阶段不要用支付配置问题替代会话问题；先确认 `h5Token` 已通过。

## 9. 极简结论

```text
微信小程序当前下单链：
wx.login → miniLogin → CUSTOMER Session → h5Token → H5 web-view → createOrderFromH5 → JSAPI/MWEB 支付

h5Token 是否合理：
条件合理；它是小程序客户会话进入 H5 下单页的桥接 Token

miniLogin 是否被正确调用：
会被调用，但签发 Token 时未显式设置 role=CUSTOMER，生成的 Token 结构不完整

UNAUTHORIZED 最可能原因：
Token 只有 roles=[CUSTOMER]、没有 role=CUSTOMER，鉴权误入 users/auth_sessions 校验并返回会话已失效

建议下一步：
最小修复 miniLogin 的 CUSTOMER 主角色签发，同步部署 game-service，然后清理小程序 Storage 重新登录
```
