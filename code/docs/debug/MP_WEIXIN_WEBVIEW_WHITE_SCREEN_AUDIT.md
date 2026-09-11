# 微信小程序 WebView 下单白屏审计

审计日期：2026-09-11  
范围：只读检查源码、构建产物、线上静态站点及匿名安全测试；未修改业务代码、云函数环境变量和微信后台配置，未部署。报告不包含真实 token 或 AppSecret。

## 结论摘要

`webview-shell` 的取参、URL 生成和 `<web-view>` 绑定一致，H5 路由也真实存在。线上 `https://h5.qmhyjoy.com/` 及 H5 下单路由的 JS/CSS 均返回 200；使用占位无效 token 在普通 Chromium 打开时，页面能正常渲染“下单页暂不可用 / 无效的 H5 下单链接”，同时 `getH5Product` 请求到达 uniCloud。因此，当前证据不支持“壳页绑定错变量”“URL 应加 `/client/`”“Hash 后 token 读取不到”或“线上根本没有该路由”。

目前最符合“原生标题栏正常、WebView 主体完全空白”的首要原因，是微信后台的 `h5.qmhyjoy.com` 业务域名未配置、配置在错误 AppID、校验未生效，或开发工具/真机使用了不同校验条件。该项只能从微信后台和 WebView 调试器确认，源码无法证明。

另外确认了一处会导致 WebView 加载状态无法结束的代码缺陷：线上生产包把 `VITE_OAUTH_APPID` 编译为空字符串；当页面识别为小程序 WebView 且没有 `h5_openid` 时，`loadProduct()` 调用 `redirectToOauth()` 后直接返回，而 `redirectToOauth()` 只显示“未配置服务号网页授权”并返回，未清除 `loading`、未设置错误态。这会表现为长期停留在加载页，在部分 WebView 中容易被用户描述为白屏。该问题排在第二位，但它发生的前提是 H5 文档已经成功进入 WebView。

## 1. 已确认真实链路

```text
商品详情
  → wx.login / miniLogin 建立 CUSTOMER 会话
  → h5Token(productId)
  → pages/order/webview-shell
  → https://h5.qmhyjoy.com/#/pages/h5-order/index?token=<REDACTED_TOKEN>
  → <web-view>
  → getH5Product(token)
  → 填写联系方式并 createOrderFromH5(h5Token)
  → JSAPI 或 MWEB 支付
```

这属于方案 B 为主、支付环境分流的混合架构。小程序没有在原生订单页直接 `wx.requestPayment`；当前设计就是“小程序签发 H5 token，再由 WebView 中的 H5 页面创建订单和发起支付”。出现 `h5Token` 本身不是 Bug。

## 2. webview-shell 源码分析

### 文件与注册

- 页面源码：`apps/client/src/pages/order/webview-shell.vue`
- 页面注册：`apps/client/src/pages.json:9`
- 当前小程序构建产物：
  - `apps/client/dist/build/mp-weixin/pages/order/webview-shell.wxml`
  - `apps/client/dist/build/mp-weixin/pages/order/webview-shell.js`

### 数据流

- template 在 `webview-shell.vue:4-5` 使用 `v-if="!url"`，随后绑定 `<web-view v-else :src="url" />`。
- `url` 在 `webview-shell.vue:16` 定义为 `ref('')`。
- `onLoad` 在 `webview-shell.vue:18-28` 从 `query.token`、`query.orderId` 取参，执行 `encodeURIComponent`，最终仍赋值给同一个 `url.value`。
- H5 根地址来自 `apps/client/src/api.js:13`，默认值为 `https://h5.qmhyjoy.com`。
- 最新 mp-weixin 产物把源码变量压缩成 `a/b` 等字段，但生成的 WXML 确实将 `<web-view src>` 绑定到计算后的字段。不能用编译后的混淆名反推源码变量错误。

结论：

- token 从 options 读取：正确。
- URL 赋值变量和 template 绑定变量：一致。
- URL 编码：正确。
- “page.data 中 URL 已生成，但 web-view 绑定另一空变量”：`NOT_SUPPORTED_BY_CODE`。

## 3. H5 下单页面分析

### 页面存在性

- 源码：`apps/client/src/pages/h5-order/index.vue`
- 注册：`apps/client/src/pages.json:10`
- 本地 Web 产物：`apps/client/dist/build/web/assets/pages-h5-order-index.Bq7-5sar.js`
- 本地 H5 产物：`apps/client/dist/build/h5/assets/pages-h5-order-index.B5Xxv7gN.js`
- 线上主包明确引用：`assets/pages-h5-order-index.Bq7-5sar.js`
- 线上该 JS 与配套 CSS 均返回 HTTP 200。

线上当前使用的是 `dist/build/web` 对应的 2026-09-09 构建，而本地还有 2026-09-10 的 `dist/build/h5` 构建。线上产物较旧是发布一致性风险，但旧包本身包含 H5 下单路由及错误态，不能单独解释本次纯白屏。

### 初始化与条件渲染

`apps/client/src/pages/h5-order/index.vue` 的初始化顺序为：

1. `onLoad(query)` 从 `query.token` 读取 token，sessionStorage 仅作网页授权回跳兜底。
2. 若 token 缺失，立即退出 loading 并显示“下单链接无效或已过期”。
3. 若 URL 带 OAuth `code`，尝试 `oauthExchange`；失败被捕获，不会直接卸载页面。
4. `loadProduct()` 调用 `getH5Product(token)`。
5. 商品成功后判断是否为小程序 WebView、是否已有服务号 `openid`，必要时跳网页授权。

模板具备 loading、error、success、processing、continue、product 六类可见状态。初始化 API 失败会设置 `errorMsg` 并渲染错误页。因此不存在“失败后所有根节点都被 `v-if` 隐藏且无兜底”的一般性风险。

但是存在一个具体的 loading 死锁：

```text
loadProduct 成功
  → isMiniProgramWebview() === true
  → sessionStorage 没有 h5_openid
  → redirectToOauth()
  → OAUTH_APPID 为空，只 toast 后 return
  → loadProduct 再次 return
  → loading 仍为 true
```

证据：`h5-order/index.vue:98-103`、`:323-331`；`apps/client/.env.production` 没有 `VITE_OAUTH_APPID`；线上主包的编译结果也是 `VITE_OAUTH_APPID || ""`，即空值。

状态判定：`CONFIRMED` 条件缺陷；是否正是用户所见纯白屏，还需 WebView Console 确认 H5 已进入且 `window.__wxjs_environment === 'miniprogram'`。

## 4. H5 URL 是否正确

当前代码配置：

- `apps/client/src/manifest.json:15-20`：H5 使用 hash router，`base` 为 `/`。
- `apps/client/vite.config.js:4`：Vite `base` 为 `/`。
- `apps/client/src/api.js:13`：H5 根地址为 `https://h5.qmhyjoy.com`。
- 部署文档约定客户 H5 发布在客户域根目录，而工作台和管理台才分别使用 `/workbench/`、`/admin/`。

因此当前代码期望地址就是：

```text
https://h5.qmhyjoy.com/#/pages/h5-order/index?token=<REDACTED_TOKEN>
```

线上首页和静态资源也部署在域名根目录。加 `/client/` 会偏离当前构建和部署约定。

结论：当前代码期望 URL 与线上部署 URL 一致；“缺少 `/client/`”为 `NOT_SUPPORTED_BY_CODE`。

## 5. Token 传递是否正确

### H5 如何读取 token

H5 页面通过 uni-app `onLoad(options)` 的 `query.token` 读取 hash 路由查询参数，见 `h5-order/index.vue:42-62`。它没有使用 `location.search` 读取下单 token。

`location.search` 只在 `getQueryCode()` 中用于读取服务号 OAuth 回调的 `code`，见 `h5-order/index.vue:350-353`，不影响初次 H5 token。

匿名浏览器安全测试使用：

```text
https://h5.qmhyjoy.com/#/pages/h5-order/index?token=<REDACTED_TOKEN>
```

页面能渲染“无效的 H5 下单链接”，且网络请求中出现 `getH5Product`。这证明线上 hash query 已被路由器解析并传给页面；如果 token 根本未读到，页面应显示“下单链接无效或已过期”，且不会调用 `getH5Product`。

结论：

- Shell 到 URL 的 token 拼接：`CONFIRMED` 正确。
- 线上 H5 对 hash query 的解析：`CONFIRMED` 正确。
- 用户截图中的那枚真实 token 是否未过期、未撤销、与当前云函数 `H5_TOKEN_SECRET` 一致：仍需真实 WebView 网络响应确认，报告不记录该 token。
- Hash 后 token 被 `location.search` 漏读：`NOT_SUPPORTED_BY_CODE`。

### token 内容与消费

阿里云当前实现位于 `apps/client/uniCloud-aliyun/cloudfunctions/game-service/lib/services.cjs:109-149`：

- 包含：`productId`、`brandId`、`purpose`、`mode`、`jti`、`iat`、`exp`；app 模式还包含小程序 `openid`。
- 不包含名为 `customerId` 的字段；app 模式用 `openid` 作为客户身份。
- 默认有效期 24 小时，可通过 `H5_TOKEN_TTL_MS` 配置在 5 分钟至 24 小时范围内。
- HMAC 验签后还检查用途、结构、签发时间、过期时间和撤销表。

`getH5Product` 再校验商品存在、上架状态和 `brandId` 一致；`createOrderFromH5` 继续校验 token 与商品，并将 app 模式的 `openid` 写作订单客户身份。

## 6. 微信业务域名是否需要外部配置

### CODE_CONFIRMED

- `<web-view>` 的实际目标主机是 `h5.qmhyjoy.com`。
- 小程序 AppID 是 `wxe40bb897376601cc`，见 `apps/client/src/manifest.json:8-13`。
- `manifest.json` 设置了 `urlCheck: false`，这只代表开发调试设置，不能证明微信公众平台配置已经存在。

### EXTERNAL_CONFIG_REQUIRED

微信 `<web-view>` 打开外部网页要求相应域名进入该小程序账号的业务域名配置。因此必须在 AppID `wxe40bb897376601cc` 的微信公众平台后台确认 `https://h5.qmhyjoy.com`，并确认域名校验文件和主体能力有效。源码无法读取或证明该后台状态。

详细核对步骤见 `docs/debug/WECHAT_WEBVIEW_DOMAIN_CHECK.md`。

## 7. H5 API 初始化链

| 阶段/action | 鉴权方式 | 关键要求 | 失败后的 UI |
|---|---|---|---|
| App `getBrandConfig` | `PUBLIC_ACTIONS` | 可带 brandCode/appId；H5 当前为空时由后端解析默认品牌 | App 捕获并记录警告；H5 下单页本身仍挂载 |
| App `ensureSession → miniLogin` | `miniLogin` 为公开入口 | 只在小程序有 `wx.login`；普通 H5 不具备 | App 捕获“微信登录失败”，不阻塞 H5 页面 |
| `getH5Product` | `H5_TOKEN_ACTIONS`，不要求 CUSTOMER Session | 有效 H5 token、未撤销、商品上架、品牌一致 | `loading=false`，显示明确错误页 |
| `oauthExchange` | `PUBLIC_ACTIONS` | URL 有 code；后端需服务号 OAuth 配置 | 当前 catch 后继续；缺 openid 时稍后再授权 |
| `createOrderFromH5` | `H5_TOKEN_ACTIONS` | `h5Token`、匹配 productId、至少一种联系方式 | 用户点击提交后 toast，不会造成初始白屏 |
| `getPaymentParams` | `H5_TOKEN_ACTIONS` | 有效 H5 token、待支付订单；JSAPI 还需服务号 openid | 用户提交后 toast/支付状态页 |
| `getPaymentStatus` | 公开入口，服务层再验 H5 token | paymentId/orderId 与 token 的商品、品牌一致 | 显示“暂时无法查询/支付结果确认中” |

初始页面不要求 CUSTOMER Session。它依赖的是 URL 中的专用 H5 token；普通 H5 的 `ensureSession()` 失败已被 App 捕获，并非白屏原因。

审计同时发现一个后续支付缺陷：`payInWechatWebview()` 和 `payOutsideWechat()` 调用 `getPaymentParams` 时没有把 `h5Token: token.value` 放入 payload。服务端 `getPaymentParams` 会自验 H5 token，因此正式支付阶段可能返回“订单不可支付”。该问题发生在用户填写并提交订单之后，不是当前初始白屏根因，本轮按要求未修改。

## 8. 白屏根因排名

### 1. EXTERNAL_CONFIG_REQUIRED / HIGH_PROBABILITY

`h5.qmhyjoy.com` 未加入当前 AppID 的业务域名、校验文件失效、配置在另一 AppID，或开发者工具与真机的域名校验状态不一致。

理由：原生标题栏属于 `webview-shell`，可以正常显示；当内嵌文档被微信拦截时，主体可能为空。与此同时，普通浏览器已确认线上文档、H5 路由、静态资源和匿名 uniCloud 请求可以工作。

### 2. CONFIRMED 条件缺陷 / HIGH_PROBABILITY

生产包 `OAUTH_APPID` 为空，而小程序 WebView 无 `h5_openid` 时 `loadProduct()` 提前返回且不退出 loading。若 WebView 已成功加载 H5，WebView 调试器应能看到“未配置服务号网页授权”toast 或页面一直停在“正在准备订单”。

### 3. POSSIBLE

真实 H5 token 在打开前已过期/撤销，或者签发 token 与线上验签使用了不同 `H5_TOKEN_SECRET`。正常情况下这应渲染错误页而不是纯白，因此概率低于前两项。需在 WebView 的 `getH5Product` 响应中确认，常见信息包括“无效”“已过期”“已失效”“商品已下架”或品牌不匹配。

### 4. POSSIBLE（低）

微信 WebView 环境检测时机不稳定。当前代码同步读取 `window.__wxjs_environment`，没有等待 `WeixinJSBridgeReady`，也没有通过微信 JSSDK `getEnv` 兜底。这可能造成支付环境误判，但按现有逻辑误判为非小程序时仍应显示商品表单，不能很好解释初始纯白。

### 5. NOT_SUPPORTED_BY_CODE

- `<web-view>` 绑定了错误变量；
- H5 URL 应为 `/client/`；
- H5 页面或线上路由不存在；
- token 因位于 hash 后而被 `location.search` 漏读；
- H5 初始加载必须依赖 CUSTOMER Session；
- 初始化失败后没有任何 loading/error 兜底。

## 9. 最小修复建议

本轮先诊断、不改代码。建议严格按以下顺序处理：

1. 先执行 `WECHAT_WEBVIEW_DOMAIN_CHECK.md`，确认同一 AppID 的业务域名并在关闭调试绕过后真机复验。
2. 在 `web-view` 调试窗口查看顶层 document、Console 和 `getH5Product`。若 document 未请求或被域名策略拦截，先修微信后台配置；不要改前端路由。
3. 若 H5 已进入且 `getH5Product` 返回成功，修复 OAuth 缺省分支：`redirectToOauth()` 应返回明确结果；缺 `OAUTH_APPID` 时必须 `loading=false` 并进入可见错误态，不能让 `loadProduct()`静默返回。
4. 如果项目短期不启用服务号 JSAPI 支付，应在配置层显式选择可支持的支付路线，不应在页面加载阶段强制 OAuth。
5. 修复支付参数调用，将当前 H5 token 明确传给 `getPaymentParams`；随后再做“加载页面 → 建单 → 拉起支付”的真机闭环。
6. 统一客户 H5 的唯一生产构建目录，并发布比对后的新产物，避免 `dist/build/web` 与 `dist/build/h5` 两套产物长期漂移。

## 安全测试结果与复验方法

已完成的安全测试没有使用真实 token：

- `GET https://h5.qmhyjoy.com/`：200。
- 线上主 JS、H5 下单 chunk、对应 CSS：200。
- Chromium 打开带占位无效 token 的 H5 下单路由：页面正常挂载，显示明确 token 错误。
- 网络中 `getBrandConfig` 与 `getH5Product` 到 `https://api.next.bspapp.com/client`：HTTP 200；业务层正确拒绝占位 token。
- 未观察到导致页面挂载失败的 JavaScript exception；统计上报失败和 favicon 404 与订单页渲染无关。

下一次真机只需用微信开发者工具的 WebView 调试器复验同一个真实 URL。任何截图、HAR、Console 或云函数日志中的 `token`、`h5Token`、`code` 均替换为 `<REDACTED_TOKEN>` 后再保存或分享。
