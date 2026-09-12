# H5 下单 Token 与微信 WebView 白屏审计

审计日期：2026-09-11  
审计范围：`apps/client`、阿里云/腾讯云 `game-service`、`packages/backend`、线上 H5 只读验证。  
执行边界：未修改业务代码、云函数环境变量或微信后台配置，未部署、未重新发行。报告不记录完整 CUSTOMER token、H5 token 或 AppSecret。

## 结论

1. H5 下单 token **不是一次性 token**。读取商品、打开页面或创建订单都不会自动把 token 标记为 used，也不会自动写入撤销表。它可以在有效期内重复打开，除非过期或被客服/管理员显式撤销。
2. `jti` 是每枚 token 的唯一标识，当前只用于 `h5_token_revocations` 的撤销主键和幂等撤销，不是“已使用”标记。
3. 本轮从已有本地调试日志提取同一枚 H5 token 后，仅在内存中解码并进行了脱敏验证。该 token：
   - `purpose=h5-order`、`mode=app`、`brandId=demo-a`；
   - 签发时间为 2026-09-11 19:14:01（北京时间）；
   - 过期时间为 2026-09-12 19:14:01（北京时间）；
   - 审计时尚未过期。
4. 同一枚 token 在三个全新 Chromium 浏览器上下文中连续打开三次，均成功显示“订单确认”和“提交订单”。这同时证明当前线上签发/验证规则兼容、token 未被撤销、商品仍上架且品牌匹配。
5. 因此，先前 Chrome 中的“无效的 H5 下单链接”不是 token 被 WebView 消费造成的。本轮已无法复现。最高概率是复制的 URL/token 不完整、混用了另一枚旧 token，或当时存在短暂的部署/配置不一致。
6. 微信小程序 WebView 的纯白屏仍优先指向微信后台“业务域名”或 WebView 加载层问题。代码仓库无法证明 `h5.qmhyjoy.com` 已配置到当前小程序 AppID。
7. 另有一个可重复的 H5 初始化缺陷：当页面被识别为小程序 WebView、没有 `h5_openid`，且线上 `OAUTH_APPID` 为空时，页面会永久停在 loading。模拟微信小程序 WebView 后已复现持续显示“正在准备订单”。它是第二条独立问题，但正常渲染时并非纯白。

## 1. H5 Token 是否一次性

### 1.1 签发结构

阿里云部署源位于：

- `apps/client/uniCloud-aliyun/cloudfunctions/game-service/lib/services.cjs:33-43`
- `apps/client/uniCloud-aliyun/cloudfunctions/game-service/lib/services.cjs:109-149`
- `apps/client/uniCloud-aliyun/cloudfunctions/game-service/lib/services.cjs:730-743`

`h5Token()` 查询上架商品并调用 `issueH5Token()`。token payload 包含：

- `productId`
- `brandId`
- `purpose=h5-order`
- `mode=app|cs`
- `jti`
- `iat`
- `exp`
- app 模式下的 `openid`

token 格式是：

```text
base64url(payload).HMAC-SHA256-signature
```

默认 TTL 为 24 小时；云函数允许通过 `H5_TOKEN_TTL_MS` 设置 5 分钟至 24 小时。

### 1.2 验证结构

`verifyH5Token()` 执行：

1. token 必须存在且是字符串；
2. 必须恰好包含 payload、signature 两段；
3. 使用 `H5_TOKEN_SECRET` 对 payload 重新计算 HMAC；
4. 解码 JSON；
5. 校验 `productId`、`purpose=h5-order`、`mode=app|cs`；
6. 校验 `jti`、`iat`、`exp` 结构；
7. 校验尚未生效和过期时间。

`verifyActiveH5Token()` 随后只读取：

```text
h5_token_revocations[_id = payload.jti]
```

找到记录才抛出“已失效”。它没有写数据库。

### 1.3 jti 与撤销表

项目确实存在 `h5_token_revocations`：

- `apps/client/uniCloud-aliyun/database/brand-indexes.json:23`
- `uniCloud-tcb/database/brand-indexes.json:23`
- `packages/backend/src/db.js:34,80`

全仓库写入该集合的位置都位于显式 `revokeH5Token()`：

- 阿里云：`apps/client/uniCloud-aliyun/cloudfunctions/game-service/lib/services.cjs:747-757`
- 腾讯云：`uniCloud-tcb/cloudfunctions/game-service/lib/services.cjs:747-757`
- 本地 backend：`packages/backend/src/services.js:1247-1259`

允许调用撤销接口的角色是客服或管理员类角色，见 `apps/client/uniCloud-aliyun/cloudfunctions/game-service/lib/auth.cjs:61`。

### 1.4 是否会首次使用即失效

不会。

仓库中没有 `consumeH5Token`、`consumeToken`、`TOKEN_USED` 或 H5 token `used` 字段。以下操作都只验证、不消费：

- `getH5Product`
- `createOrderFromH5`
- `getPaymentParams`
- `getPaymentStatus`

创建订单使用独立的 `idempotencyKey` 防重复提交；该机制不会撤销 H5 token。

结论标签：`NOT_ONE_TIME_TOKEN`。不能标记 `CONFIRMED_ONE_TIME_TOKEN`。

## 2. H5 页面 Token 验证链

### 步骤 1：WebView 壳页生成 URL

- 文件：`apps/client/src/pages/order/webview-shell.vue`
- 函数：`onLoad`
- 行号：18-28

`query.token` 经 `encodeURIComponent()` 后写入：

```text
https://h5.qmhyjoy.com/#/pages/h5-order/index?token=<REDACTED_TOKEN>
```

template 在第 5 行把同一个 `url` 绑定到 `<web-view :src="url" />`。

### 步骤 2：H5 页面读取 token

- 文件：`apps/client/src/pages/h5-order/index.vue`
- 函数：`onLoad`
- 行号：42-76

页面使用 uni-app `onLoad(query)` 的 `query.token`，其次才读取 `sessionStorage.h5_token`。token 不依赖 CUSTOMER Session，也不存在 hash query 被 `location.search` 漏读的问题。

### 步骤 3：调用 getH5Product

- 页面调用：`apps/client/src/pages/h5-order/index.vue:89-107`
- API 映射：`apps/client/src/api.js:180`
- 云函数 action：`getH5Product`

`api.getH5Product(token)` 通过 `uniCloud.callFunction` 发送：

```json
{
  "action": "getH5Product",
  "payload": {
    "token": "<REDACTED_TOKEN>"
  }
}
```

### 步骤 4：鉴权路由放行 H5 自证

- 文件：`apps/client/uniCloud-aliyun/cloudfunctions/game-service/lib/auth.cjs`
- 定义：22-23
- 入口：220-223

`getH5Product` 属于 `H5_TOKEN_ACTIONS`。鉴权入口返回 `mode=h5`、`session=null`，不要求 CUSTOMER 登录会话；真正的身份和商品上下文由 H5 token 自证。

### 步骤 5：验签、撤销、商品和品牌校验

- 文件：`apps/client/uniCloud-aliyun/cloudfunctions/game-service/lib/services.cjs`
- 函数：`verifyH5Token`，126-142
- 函数：`verifyActiveH5Token`，145-149
- 函数：`getH5Product`，761-766

成功后返回：

```text
product + openid + productId
```

其中 product 必须存在、`status=ON`，并且商品 `brandId` 必须与 token `brandId` 一致。

### 步骤 6：页面进入可见状态

- 成功：设置 `product`、生成动态表单；非小程序 WebView 时结束 loading。
- 失败：`catch` 将 `loading=false`、`errorMsg=服务端 message`。
- template 第 5 行显示固定标题“下单页暂不可用”及具体 `errorMsg`。

## 3. “无效的 H5 下单链接”的准确来源

### 前端固定外层文案

`apps/client/src/pages/h5-order/index.vue:5` 固定显示：

```text
下单页暂不可用
<errorMsg>
```

其中第二行来自 `getH5Product` 抛出的服务端 message。

### 服务端具体条件

阿里云 `verifyH5Token()` 中以下条件会精确抛出“无效的 H5 下单链接”：

| 条件 | 位置 | 返回 code/message |
|---|---|---|
| token 缺失或不是字符串 | `services.cjs:128` | `DOMAIN_ERROR / 无效的 H5 下单链接` |
| token 不是完整两段 | `services.cjs:129-130` | `DOMAIN_ERROR / 无效的 H5 下单链接` |
| HMAC 签名与当前 secret 不一致 | `services.cjs:131-134` | `DOMAIN_ERROR / 无效的 H5 下单链接` |
| payload 无法解码为 JSON | `services.cjs:135-136` | `DOMAIN_ERROR / 无效的 H5 下单链接` |

无 code 的领域异常由 `apps/client/uniCloud-aliyun/cloudfunctions/game-service/index.js:40-45` 统一包装为：

```json
{
  "ok": false,
  "code": "DOMAIN_ERROR",
  "message": "无效的 H5 下单链接"
}
```

其他失败不会使用这段 message：

| 条件 | message |
|---|---|
| purpose 不等于 `h5-order`、mode 非法或缺 productId | `H5 下单链接用途非法` |
| jti/iat/exp 结构非法 | `H5 下单链接结构非法` |
| iat 超前超过 5 分钟 | `H5 下单链接尚未生效` |
| 当前时间超过 exp | `H5 下单链接已过期` |
| jti 存在于撤销表 | `H5 下单链接已失效` |
| 商品不存在或非 ON | `商品已下架或不存在` |
| token brandId 与商品不一致 | `BRAND_CHANNEL_MISMATCH` |

因此，先前 Chrome 的文案可以排除 `TOKEN_USED`、过期、撤销、purpose、商品下架和品牌不匹配；它只对应“缺失/格式破坏/签名不匹配/JSON 破坏”这一组校验。

### 当前复验结论

本轮对调试日志中的原始 token 做了以下只读验证：

- payload 两段结构正确；
- `purpose`、`mode`、`brandId`、`productId` 正确；
- 审计时未过期；
- 线上连续打开三次都显示订单表单；
- 没有出现“下单页暂不可用”。

所以“同一 token 在 WebView 首次访问后，复制到 Chrome 必然无效”的判断被源码和实测共同否定。先前无效链接当前无法复现，优先检查复制完整性、是否混用了 CUSTOMER token 与 H5 token、浏览器地址栏是否截断，以及是否打开了旧 URL。

## 4. 签发规则与验证规则对比

| 字段/规则 | 签发 | 验证 | 结论 |
|---|---|---|---|
| secret | `getH5Secret()` 读取 `H5_TOKEN_SECRET` | 同一模块的 `getH5Secret()` | 代码内一致；线上同 token 当前验签成功 |
| 时间单位 | `Date.now()` 毫秒 | `Date.now()` 毫秒 | 一致 |
| exp | `iat + H5_TOKEN_TTL_MS` | `now > exp` 判过期 | 一致 |
| purpose | 固定 `h5-order` | 严格等于 `h5-order` | 一致 |
| mode | `app` 或 `cs` | 两者均允许 | `mode=app` 可被 H5 消费 |
| openid | app 模式写入 | 不要求额外 Session；建单时作客户身份 | 一致 |
| brandId | 从商品写入 | 与商品 brandId 比较 | 一致 |
| productId | 必须写入 | 必须存在、商品 ON | 一致 |
| jti | 随机唯一值 | 查询撤销表 | 不是使用次数标记 |
| CUSTOMER Session | 仅签发 `h5Token` 时需要 | `getH5Product` 不需要 | H5 页面无需额外登录 |

仓库有多份实现副本，这是部署漂移风险，但阿里云实际部署源中的签发与验证使用同一个函数和同一个环境变量；当前线上复验进一步证明这枚 token 在现行部署上可以通过验签。源码仍无法读取云平台里 secret 的明文值，本报告也不输出该值。

## 5. 微信 WebView 白屏分析

### 5.1 src 绑定

`apps/client/src/pages/order/webview-shell.vue:5`：

```vue
<web-view v-else :src="url" />
```

`onLoad` 最终赋值同一个 `url.value`。最新 mp-weixin 构建产物也把计算结果绑定到 `<web-view src>`。未发现代码级 src 变量错绑。

### 5.2 缺少加载事件诊断

当前 `<web-view>` 没有：

- `@load`
- `@error`

因此壳页不能区分“微信未加载顶层网页”和“H5 已进入但初始化卡住”。建议下一轮临时加入事件日志，但本轮按要求未修改。

建议形态：

```vue
<web-view
  :src="url"
  @load="onWebViewLoad"
  @error="onWebViewError"
/>
```

判断标准：

- 触发 `onError`：优先查业务域名、证书、网络和微信 WebView 拦截。
- 触发 `onLoad`：说明 H5 顶层文档已进入，再查 `getH5Product` 和 OAuth/loading。

### 5.3 EXTERNAL_CONFIG_REQUIRED

微信小程序使用 `<web-view>` 打开 `https://h5.qmhyjoy.com`，必须在当前小程序 AppID 的微信公众平台后台确认对应“业务域名”。这不是 `request 合法域名`，也不能由仓库中的 `urlCheck: false` 证明已经配置。

状态：`EXTERNAL_CONFIG_REQUIRED`。

核对步骤见 `docs/debug/WECHAT_WEBVIEW_DOMAIN_CHECK.md`。

### 5.4 已确认的 OAuth/loading 缺陷

`apps/client/src/pages/h5-order/index.vue:98-103` 在识别为小程序 WebView且没有 `h5_openid` 时调用 `redirectToOauth()` 并直接 return。`redirectToOauth()` 在 `OAUTH_APPID` 为空时只 toast 后返回，见第 323-331 行，没有清除 `loading` 或设置 `errorMsg`。

本轮使用同一枚有效 token 模拟：

```text
MicroMessenger UA
window.__wxjs_environment = miniprogram
```

结果在 0.5 秒和 4 秒后都保持：

```text
正在准备订单
请稍候，不要关闭页面
```

且没有 JavaScript exception。说明该 loading 死锁可稳定复现。它证明 H5 进入微信小程序环境后确实还有初始化问题；但由于正常 H5 UI 仍会渲染加载文字，它不能完全等同于“顶层网页根本没加载”的纯白屏。

## 6. 两个现象的根因排名

### 问题 1：Chrome 曾显示“无效的 H5 下单链接”

1. `HIGH_PROBABILITY`：复制/粘贴的 token 不完整、URL 被截断、混用了 CUSTOMER token 或打开了另一枚旧 token。
2. `POSSIBLE`：当时刚好处于云函数部署或 `H5_TOKEN_SECRET` 调整窗口，签发和验证请求命中了不一致配置；当前无法从仓库或现状证明。
3. `NOT_SUPPORTED_BY_CODE`：token 首次访问即消费。
4. `NOT_CURRENTLY_REPRODUCIBLE`：当前同一枚 token 连续打开三次均成功，且尚未过期。

### 问题 2：微信小程序 WebView 完全白屏

1. `EXTERNAL_CONFIG_REQUIRED / HIGH_PROBABILITY`：`h5.qmhyjoy.com` 未在当前 AppID 下正确配置为业务域名，或配置/校验尚未生效。纯白且看不到 H5 的 loading/error UI，更符合顶层网页未真正载入。
2. `CONFIRMED / HIGH_PROBABILITY`：H5 已进入后，空 `OAUTH_APPID` 导致 OAuth 分支永久 loading。模拟小程序 WebView 已复现。
3. `POSSIBLE`：微信 WebView 的 `window.__wxjs_environment` 注入时机或网络环境差异导致初始化分支与普通 Chrome 不同。
4. `NOT_SUPPORTED_BY_CODE`：路由不存在、URL 应加 `/client/`、Hash token 无法解析、`web-view` 绑定空变量。

## 7. 最小调试方案

建议下一步仅做可观测性补丁，不改业务流程：

1. 给 `<web-view>` 增加 `@load`、`@error`，日志只输出 origin/path，不打印 query token。
2. 在微信开发者工具右键 WebView 调试，确认顶层 document 是否请求成功。
3. 若 `onError`：先核对 `wxe40bb897376601cc` 后台的 `https://h5.qmhyjoy.com` 业务域名。
4. 若 `onLoad`：查看页面是否卡在“正在准备订单”，并确认是否提示“未配置服务号网页授权”。
5. 若需要再次比对 token，只比较 token 长度或 SHA-256 摘要，不在 Console/文档打印完整值。
6. 确认加载层后，再单独修复 OAuth 缺省分支：缺少 `OAUTH_APPID` 时必须结束 loading 并显示明确错误，或在未启用 JSAPI 支付时不要在页面加载阶段强制 OAuth。

本轮到此停止，没有部署、重新发行、修改环境变量或上传微信平台。
