继续排查当前微信小程序 H5 下单白屏问题。

项目：

E:\bishe27\服务平台小程序\code

本轮只做只读分析，不修改代码。

==================================================
一、当前已经实测确认
==================================================

微信小程序流程：

微信小程序
→ CUSTOMER Session
→ game-service action=h5Token
→ h5Token 成功返回
→ pages/order/webview-shell
→ 生成：

https://h5.qmhyjoy.com/#/pages/h5-order/index?token=<REDACTED>

h5Token Payload 已确认包含：

productId
brandId=demo-a
purpose=h5-order
mode=app
jti
iat
exp
openid

因此不要再排查：

wx.login
miniLogin
AppID
CUSTOMER Session
brandId
productId

这些阶段已经成功。

当前有两个现象：

现象 A：

微信小程序：
webview-shell
→ WebView 白屏

现象 B：

把同一个 URL 复制到 Chrome：

https://h5.qmhyjoy.com/#/pages/h5-order/index?token=<REDACTED>

H5 页面能够正常加载，
能够显示：

游戏服务
填写信息 → 确认支付 → 完成

但是页面显示：

“下单页暂不可用”
“无效的 H5 下单链接”

因此：

H5 域名可访问
H5 Web Build 已部署
h5-order 路由存在
Vue 页面可以渲染

这些不要继续当成主要嫌疑。

==================================================
二、第一任务：确认 H5 Token 是否为一次性 Token
==================================================

请搜索：

h5Token
h5_token_revocations
jti
consume
consumeToken
verifyToken
verifyH5Token
revoke
revocation
used
purpose
h5-order

重点检查：

game-service
apps/client
packages/backend
uniCloud-tcb

必须回答：

1. h5Token 是否允许重复使用？
2. jti 的作用是什么？
3. 是否存在 h5_token_revocations 集合？
4. token 第一次使用后是否会：
   - 标记 used
   - 写 revocation
   - 删除
   - 禁止第二次使用

5. 如果：
   微信 WebView 已经访问过一次，
   然后把同一个 URL 再放 Chrome，
   是否必然显示：
   “无效的 H5 下单链接”

如果源码明确证明是一次性 token：

标记：

CONFIRMED_ONE_TIME_TOKEN

==================================================
三、追踪 H5 页面如何验证 Token
==================================================

从：

apps/client/src/pages/h5-order/index.vue

开始追踪。

完整给出：

onLoad
→ 获取 token
→ 调用 API
→ game-service action
→ Token 校验
→ product/context
→ 页面初始化

重点找：

consumeH5Token
h5OrderContext
verifyH5Token
getH5OrderContext
或真实函数名。

每一步必须给：

文件
行号
函数名

==================================================
四、分析为什么显示“无效的 H5 下单链接”
==================================================

找到这段 UI 文案：

“下单页暂不可用”
“无效的 H5 下单链接”

追踪究竟什么条件会触发该错误。

必须给出：

具体 if 条件
具体 error code
具体 API Response

例如：

TOKEN_USED
TOKEN_INVALID
TOKEN_EXPIRED
TOKEN_REVOKED
INVALID_PURPOSE
PRODUCT_NOT_FOUND
BRAND_MISMATCH
SESSION_INVALID
其他

不能只说“token 无效”。

==================================================
五、检查 Token 签发和 Token 验证是否使用同一规则
==================================================

比较：

h5Token 签发逻辑

与

H5 Token 验证/消费逻辑。

检查：

H5_TOKEN_SECRET

iat
exp
jti
purpose
mode
openid
brandId
productId

尤其检查：

1. 签发和验证是否使用同一个 secret
2. exp 使用毫秒还是秒
3. purpose 是否要求严格等于 h5-order
4. mode=app 是否允许 H5 页面消费
5. 是否绑定 openid
6. 是否绑定 CUSTOMER
7. 是否要求 auth session
8. 是否要求 product.status=ON
9. 是否要求 brandId 与商品一致

==================================================
六、第二任务：确认微信 WebView 白屏原因
==================================================

因为：

Chrome 能正常显示 H5 页面 UI

但：

微信小程序 WebView 完全白屏

所以不要再怀疑 H5 路由不存在。

检查：

pages/order/webview-shell

确认：

<web-view :src="...">

以及：

@load
@error

当前是否存在。

如果没有 load/error 日志，
给出建议，但先不要改代码。

必须说明：

微信小程序 web-view 加载：

https://h5.qmhyjoy.com

是否需要微信公众平台配置：

业务域名：
h5.qmhyjoy.com

这一项属于微信后台外部配置。

代码仓库不能证明已经配置。

因此标记：

EXTERNAL_CONFIG_REQUIRED

==================================================
七、给出最小调试方案
==================================================

建议后续临时给 web-view 增加：

@load
@error

例如：

<web-view
  :src="webviewUrl"
  @load="onWebViewLoad"
  @error="onWebViewError"
/>

这里只给建议，
暂时不要修改。

目标是判断：

如果 onError：
→ WebView / 业务域名问题

如果 onLoad：
→ H5 已进入，再查 H5 初始化

==================================================
八、输出最终报告
==================================================

生成：

docs/debug/H5_ORDER_TOKEN_AND_WEBVIEW_AUDIT.md

最后终端只输出：

H5 页面本身是否能加载：
是

H5 Token 是否一次性：
是 / 否 / 未确认

同一个 Token 是否允许重复打开：
是 / 否

Chrome 显示“无效链接”的直接代码原因：
xxxxx

Token 签发和验证 secret 是否一致：
是 / 否 / 无法从代码确认

Token 是否过期：
是 / 否

Token purpose 是否正确：
是 / 否

WebView 是否存在代码级 src 问题：
是 / 否

微信业务域名是否需要人工确认：
是

当前问题 1（Chrome 无效 Token）最高概率根因：
xxxxx

当前问题 2（微信 WebView 白屏）最高概率根因：
xxxxx

建议下一步：
xxxxx

==================================================
九、安全要求
==================================================
由于文档是自己查看

可以打印真实 CUSTOMER Token
可以打印真实 H5 Token
可以打印 AppSecret



不要部署。
不要重新发行。
不要修改环境变量。
不要上传微信平台。
先完成诊断。