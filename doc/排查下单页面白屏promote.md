你现在继续排查微信小程序“立即下单后白屏”的问题。

项目根目录：

E:\bishe27\服务平台小程序\code

==============================
一、已经确认的事实
==============================

请不要重新猜测前面的链路，以下信息已经通过微信开发者工具 Console 实际验证。

当前微信小程序：

首页商品正常显示
→ 商品详情正常
→ 点击“立即下单”
→ 成功进入页面：

pages/order/webview-shell

微信开发者工具执行：

const pages = getCurrentPages()
const page = pages[pages.length - 1]

console.log(page.route)
console.log(page.options)
console.log(page.data)

实际结果：

route =
pages/order/webview-shell

options 中有：

token = "<h5 token>"

page.data 中已经存在 H5 URL，实际类似：

https://h5.qmhyjoy.com/#/pages/h5-order/index?token=xxxxx

也就是说：

微信小程序
→ h5Token
→ pages/order/webview-shell
→ H5 下单地址

这条链已经跑通到 WebView Shell。

现在的问题：

页面顶部标题“下单”正常出现，
但是 WebView 主体完全白屏。

==============================
二、本轮排查目标
==============================

这次不要再泛化分析整个登录体系。

请精准回答：

为什么：

pages/order/webview-shell

已经拿到了：

https://h5.qmhyjoy.com/#/pages/h5-order/index?token=...

但微信小程序 WebView 仍然白屏？

必须区分以下几层：

1. web-view 组件本身
2. src URL 拼接
3. 微信小程序业务域名限制
4. H5 页面是否真实存在
5. H5 路由是否正确
6. h5Token 是否有效
7. H5 下单页初始化是否报错
8. H5 页面是否要求额外 Session
9. uniCloud / game-service 接口是否失败
10. H5 页面是否在微信 WebView 中存在兼容问题

不要立即修改代码。

==============================
三、第一优先级：审计 webview-shell
==============================

找到：

pages/order/webview-shell

对应源码。

必须输出：

- 文件路径
- pages.json 注册位置
- template
- script
- onLoad
- data/ref
- web-view 的 src 绑定变量

重点检查是否类似：

<web-view :src="url" />

或者：

<web-view :src="webviewUrl" />

确认：

1. token 从 options 如何读取
2. URL 如何生成
3. URL 最终赋值给哪个变量
4. template 实际绑定哪个变量
5. 是否存在：

URL 已经生成，
但 `<web-view>` 绑定的却是另一个空变量

这种问题。

特别检查当前 page.data 中出现的混淆字段：

b
uI
uP
uR
uRIF
uT
...

由于生产编译代码变量已经压缩，
请回到 src 源码找到真实变量名，
不要根据编译后的 b/uI 等变量猜。

==============================
四、确认 H5 下单页面是否真实存在
==============================

搜索：

pages/h5-order/index

必须确认：

1. 源码文件是否存在
2. pages.json 是否注册
3. HBuilderX Web 构建是否生成该页面
4. 当前线上生产包是否包含它

重点路径：

apps/client/src
apps/client/dist/build/web

搜索：

h5-order
pages/h5-order/index
下单
h5Token

输出：

真实文件路径 + 行号。

==============================
五、确认 H5 URL 是否正确
==============================

当前实际 URL：

https://h5.qmhyjoy.com/#/pages/h5-order/index?token=xxxxx

请根据当前项目的 Web 部署配置确认：

这个 URL 是否真的应该是：

https://h5.qmhyjoy.com/#/pages/h5-order/index?token=...

还是应该：

https://h5.qmhyjoy.com/client/#/pages/h5-order/index?token=...

或者其他路径。

必须检查：

- manifest.json
- vite.config
- H5 base
- publicPath
- router base
- VITE_*
- build config
- deployment docs

不能根据经验猜。

明确输出：

当前代码期望 URL：
当前线上部署 URL：
两者是否一致。

==============================
六、检查 WebView URL 在普通浏览器是否能工作
==============================

请给出一个安全测试方案。

注意：

不要把真实 token 写进文档。

建议生成：

https://h5.qmhyjoy.com/#/pages/h5-order/index?token=<REDACTED>

并说明：

如果同一个真实 URL：

A. Chrome 打开正常
B. 微信 WebView 白屏

则重点检查：

微信小程序业务域名 / WebView 限制。

如果：

Chrome 也白屏

则优先检查：

H5 页面代码 / 路由 / token / API。

==============================
七、重点检查微信小程序 web-view 业务域名
==============================

请检查代码中是否能判断：

web-view src =
https://h5.qmhyjoy.com

但是注意：

微信公众平台的“业务域名”配置不是代码仓库中的配置，
不能仅凭源码判断已经配置成功。

因此输出必须分成：

CODE_CONFIRMED
EXTERNAL_CONFIG_REQUIRED

请明确说明：

微信小程序使用 `<web-view>` 打开：

https://h5.qmhyjoy.com

是否要求：

h5.qmhyjoy.com

配置到微信小程序后台的业务域名。

如果这是必须的外部配置，
请写入：

docs/debug/WECHAT_WEBVIEW_DOMAIN_CHECK.md

只给出检查步骤，
不要假装源码能够证明微信后台已经配置。

==============================
八、检查 h5-order 页面初始化
==============================

找到：

pages/h5-order/index

完整追踪：

onLoad
onMounted
onShow

检查：

token 从哪里读取。

特别确认 Hash Router 下：

https://h5.qmhyjoy.com/#/pages/h5-order/index?token=xxx

query 参数能否被 uni-app 正确解析。

重点检查：

options.token

是否真的能得到 token。

如果 H5 页面使用：

location.search

读取 token，

而 token 实际位于：

# 后面的 hash URL

则可能读取不到。

请重点检查这一点。

必须明确回答：

H5 页面到底通过什么方式读取 token？

- uni-app onLoad(options)
- location.search
- URLSearchParams
- location.hash
- router query
- 其他方式

如果存在：

URL 把 token 放在 hash 后，
但代码使用 location.search

则标记为：

CONFIRMED BUG

==============================
九、检查 h5Token 的消费链
==============================

不要只检查 h5Token 如何生成。

重点检查 H5 页面如何消费它。

追踪：

H5 page
→ token
→ 调用哪个 API
→ game-service 哪个 action
→ 如何换取 CUSTOMER / order context
→ 如何加载 product
→ 如何创建 order

回答：

h5Token 里面是否包含：

productId
customerId
brandId
expiration

以及 H5 页面是否正确解码/提交。

不要在报告中打印真实 token。

==============================
十、检查白屏是不是条件渲染
==============================

检查 h5-order 页面是否存在：

v-if
loading
ready
product
session
order
error

特别关注：

<view v-if="xxx">

如果初始化失败后：

xxx = false/null

且没有：

loading UI
error UI

那么页面就会表现为纯白。

必须输出：

是否存在整页隐藏条件：
是 / 否

失败后是否有错误提示：
是 / 否

==============================
十一、检查 API 调用
==============================

列出 h5-order 页面启动后所有 API：

例如：

consumeH5Token
getProduct
createOrder
getBrandConfig
其他 action

每个接口输出：

action
是否公开
是否要求 CUSTOMER
是否要求 token
是否要求 brandId
失败后 UI 如何表现

重点找：

UNAUTHORIZED
INVALID_TOKEN
TOKEN_EXPIRED
UNKNOWN_BRAND
PRODUCT_NOT_FOUND

==============================
十二、重新定义当前真实架构
==============================

根据源码判断当前项目到底是不是：

方案 A：

微信小程序
→ 原生订单页
→ createOrder
→ wx.requestPayment

还是：

方案 B：

微信小程序
→ h5Token
→ webview-shell
→ H5 下单页
→ 创建订单
→ 支付

还是：

方案 C：

部分 H5 + 部分原生混合。

必须以源码为准。

特别注意：

现在已经确认实际页面是：

pages/order/webview-shell

所以不要再把“出现 h5Token”本身当作 Bug。

只有当源码证明设计并非如此时，
才判定 h5Token 调用错误。

==============================
十三、检查最近 Codex 修改
==============================

查看 Git diff。

重点查看：

apps/client

与以下内容相关的改动：

webview-shell
h5-order
h5Token
miniLogin
ensureSession
立即下单
token

判断：

本次白屏是否由最近修改引入。

不要 reset。
不要 revert。
不要修改代码。

==============================
十四、输出最终诊断报告
==============================

生成：

docs/debug/MP_WEIXIN_WEBVIEW_WHITE_SCREEN_AUDIT.md

必须包含：

# 1. 已确认真实链路

商品
→ h5Token
→ webview-shell
→ H5 URL
→ WebView

# 2. webview-shell 源码分析

# 3. H5 下单页面分析

# 4. H5 URL 是否正确

# 5. Token 传递是否正确

# 6. 微信业务域名是否需要外部配置

# 7. H5 API 初始化链

# 8. 白屏根因排名

根因必须使用：

CONFIRMED
HIGH_PROBABILITY
POSSIBLE
EXTERNAL_CONFIG_REQUIRED
NOT_SUPPORTED_BY_CODE

# 9. 最小修复建议

先不要修改代码。

==============================
十五、终端最终只输出
==============================

最后只输出：

当前真实下单架构：
xxxxx

webview-shell 是否正确拿到 URL：
是 / 否

H5 下单路由是否存在：
是 / 否

token 是否成功传递到 H5：
是 / 否 / 待验证

H5 token 读取方式：
xxxxx

是否存在 Hash Query 解析问题：
是 / 否 / 待验证

是否存在整页 v-if 白屏风险：
是 / 否

业务域名是否需要微信后台确认：
是 / 否

当前白屏最高概率原因：
xxxxx

第二概率原因：
xxxxx

建议下一步：
xxxxx


==============================
十六、安全要求
==============================

非常重要：

当前调试截图中已经出现过真实 token。

从现在开始：

1. 报告中禁止写完整 token。
2. 日志中统一表示：
   <REDACTED_TOKEN>
3. 不要把 token 提交 Git。
4. 不要把 AppSecret 写入报告。
5. 不要修改云函数环境变量。
6. 不要部署。
7. 不要上传微信平台。
8. 先完成诊断后停止。