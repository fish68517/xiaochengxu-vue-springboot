# 客户端“立即下单”提示微信登录失败分析与解决方案

## 一、问题结论

当前错误的直接原因是：**用户正在手机浏览器的 H5 页面中点击“立即下单”，但现有代码无条件执行了微信小程序专用的 `wx.login` 登录流程。**

`wx.login` 只适用于真正运行在微信小程序中的代码。普通手机浏览器、系统浏览器以及普通 H5 页面不能通过它获取小程序登录 `code`，所以页面直接提示“微信登录失败”。

这次错误发生在生成订单之前，和商品是否上架、商品价格、商品品牌数据无关。

已知小程序 AppID：

```text
wxe40bb897376601cc
```

该 AppID 已经配置在客户端的 `manifest.json` 中，但 **AppID 只说明小程序身份，不能让普通 H5 页面获得小程序 API 的运行能力**。

## 二、当前代码实际执行流程

商品详情页代码：

```text
code/apps/client/src/pages/product/detail.vue
```

点击“立即下单”后执行：

```text
orderNow()
  → ensureSession()
  → getWxLoginCode()
  → wx.login()
  → miniLogin(code)
  → h5Token(productId)
  → 打开 H5 下单页
```

`getWxLoginCode()` 位于：

```text
code/apps/client/src/api.js
```

当前实现明确调用：

```js
wx.login({
  success: ...,
  fail: () => reject(new ApiError('微信登录失败')),
});
```

因此当前产品详情页虽然也被编译并发布成 H5 页面，但“立即下单”逻辑仍按“小程序入口”处理，没有区分 H5 与微信小程序运行环境。

## 三、为什么浏览商品正常，点击下单却失败

这是因为两类接口的鉴权要求不同。

| 操作 | 当前接口 | 是否要求客户登录 |
| --- | --- | --- |
| 加载品牌 | `getBrandConfig` | 否 |
| 查看商品列表 | `listProducts` | 否 |
| 查看商品详情 | `getProduct` | 否 |
| 生成下单 Token | `h5Token` | 是，正常主链路要求 CUSTOMER 会话 |
| 创建订单 | `createOrderFromH5` | 依靠前一步生成的 H5 Token |

所以 H5 可以正常显示品牌和商品，但点击下单时需要先产生客户会话。现有客户会话只有“小程序 `wx.login` → 云端 `miniLogin`”这一条自动入口，H5 没有对应的登录或访客下单入口，于是流程在 `wx.login` 阶段中断。

## 四、与“小程序是否已经发布”的关系

### 4.1 当前 H5 报错不是因为小程序未正式发布

即使小程序已经正式发布，用户仍然是在普通 H5 浏览器环境中访问 `https://h5.qmhyjoy.com/`，浏览器也不能直接调用小程序的 `wx.login`。

因此：

```text
发布小程序 ≠ 让普通 H5 获得 wx.login 能力
```

### 4.2 未正式发布不影响小程序开发测试

如果在微信开发者工具、真机预览版或体验版中运行小程序，只要微信公众平台已把测试人员加入项目，并且配置正确，就可以测试 `wx.login`，不必等正式审核发布。

### 4.3 真正运行小程序时还必须满足的配置

除了前端 AppID，还需要同时满足：

1. `code/apps/client/src/manifest.json` 中 `mp-weixin.appid` 为 `wxe40bb897376601cc`。当前代码已满足。
2. uniCloud 云函数环境变量 `WECHAT_MP_APPID` 为同一个 AppID。
3. uniCloud 云函数环境变量 `WECHAT_MP_SECRET` 为该小程序真实 AppSecret。
4. AppSecret 必须和 AppID 配套，不能使用演示值或其他小程序的 Secret。
5. 使用微信开发者工具导入微信小程序构建产物，并以该 AppID 运行。
6. 真机用户应是项目成员、体验成员，或者使用已发布版本。

后端换取 OpenID 的代码位于：

```text
code/apps/client/uniCloud-aliyun/cloudfunctions/game-service/lib/oauth.cjs
```

后端调用微信 `jscode2session` 时需要 AppID 和 AppSecret。只在品牌配置中填写 AppID，并不能替代云函数中的 AppSecret。

## 五、品牌 AppID、登录 AppID 与 H5 的区别

当前项目中容易混淆的配置如下：

| 配置 | 用途 | H5 能否直接使用 |
| --- | --- | --- |
| 品牌配置 `brand.appId` | 根据小程序渠道识别品牌 | H5 通常通过 `brandCode`，不能据此调用 `wx.login` |
| `manifest.json` 的小程序 AppID | 构建、运行微信小程序 | 只对小程序运行环境有效 |
| `WECHAT_MP_APPID/SECRET` | 云端用登录 code 换小程序 OpenID | 必须先由小程序产生合法 code |
| `VITE_OAUTH_APPID` | 微信内 H5 的服务号网页授权 | 这是公众号/服务号 OAuth，不是小程序登录 |
| 微信支付配置 | 创建 JSAPI 或 MWEB 支付单 | 在创建订单以后才会使用 |

本次报错发生在第一步客户登录，尚未进入支付逻辑，因此不是微信支付商户配置造成的。

## 六、当前页面支持的原设计链路

现有代码主要按照以下链路设计：

```text
微信小程序商品详情
  → wx.login
  → 云端换取小程序 OpenID 和 CUSTOMER 会话
  → h5Token
  → 小程序 web-view 打开 H5 下单页
  → 填写联系方式
  → 创建订单
  → 微信内 JSAPI 支付
```

另外还存在客服兜底链路：

```text
客服/管理员生成下单链接
  → sendCustomerServiceLink
  → 生成不依赖客户小程序登录的 H5 Token
  → 客户打开 H5 下单页
```

因此目前的 H5 下单页本身可以运行，但它要求 URL 中已经带有合法 Token。直接访问 H5 商品详情并点击按钮时，没有 Token，也没有 H5 登录入口。

## 七、可选解决方案

### 方案 A：只允许从微信小程序下单

适用于项目最终只把客户端小程序作为正式入口。

需要：

1. 构建并上传微信小程序版本。
2. 在开发版、体验版或正式版中测试商品详情。
3. H5 商品详情的“立即下单”改成“请在微信小程序中下单”，展示小程序二维码或打开引导。
4. H5 页面不再调用 `wx.login`，避免显示错误提示。

优点是身份链路最清晰；缺点是当前通过手机浏览器演示时不能直接完成下单。

### 方案 B：增加 H5 访客下单能力（当前演示阶段推荐）

让用户在普通手机浏览器中浏览商品、填写联系方式并创建订单，不依赖小程序登录。

建议实施：

1. 商品详情页判断运行平台。
2. 微信小程序环境继续执行 `ensureSession → h5Token`。
3. H5 环境不再调用 `wx.login`。
4. 后端新增受限的 H5 访客 Token 接口，例如 `guestH5Token`。
5. 访客 Token 必须绑定 `productId`、`brandId`、过期时间和唯一 `jti`。
6. Token 有效期设置为 10～30 分钟，并增加 IP/设备频率限制。
7. H5 用户填写手机号或微信号后才能创建订单。
8. 创建订单后通过订单号和联系方式查询订单。
9. 普通浏览器支付使用微信 H5 支付 `MWEB`，不能直接调用小程序支付。

建议的新流程：

```text
普通手机浏览器 H5
  → 点击立即下单
  → guestH5Token(productId, brandCode)
  → 打开 H5 下单表单
  → 填写联系方式
  → createOrderFromH5
  → MWEB 支付或演示环境 Mock 支付
```

不能简单地把现有 `h5Token` 完全改成公开接口，否则容易被批量生成下单链接和垃圾订单。需要独立访客接口、短期 Token、限流和后端品牌校验。

### 方案 C：H5 使用独立客户登录

适合后续商用：

- 普通浏览器使用手机号和短信验证码登录；或
- 微信内 H5 使用认证服务号 OAuth；或
- 使用统一账号体系绑定手机号、小程序 OpenID、公众号 OpenID。

这是更完整的商用方案，但需要短信服务、用户协议、隐私授权、账号绑定和风控，实现量大于方案 B。

## 八、建议的实施顺序

当前目标是先在手机 H5 上演示，建议顺序如下：

1. 先实施方案 B，让 H5 访客能够生成短期下单 Token。
2. H5 和小程序使用不同的入口逻辑，禁止 H5 调用 `wx.login`。
3. 开发环境可以继续使用 Mock 支付；真实支付上线前再配置 MWEB。
4. 同时构建微信小程序体验版，验证 AppID、AppSecret 和 OpenID 登录链路。
5. 商用前再决定是否增加短信登录或服务号 OAuth。

## 九、需要修改的代码位置

后续实施 H5 访客下单时，主要涉及：

```text
code/apps/client/src/pages/product/detail.vue
code/apps/client/src/api.js
code/apps/client/uniCloud-aliyun/cloudfunctions/game-service/lib/auth.cjs
code/apps/client/uniCloud-aliyun/cloudfunctions/game-service/lib/services.cjs
code/apps/client/uniCloud/cloudfunctions/game-service/lib/auth.cjs
code/apps/client/uniCloud/cloudfunctions/game-service/lib/services.cjs
code/uniCloud-tcb/cloudfunctions/game-service/lib/auth.cjs
code/uniCloud-tcb/cloudfunctions/game-service/lib/services.cjs
code/packages/backend/src/services.js
```

需要同步增加：

- H5 与 MP-WEIXIN 平台分流。
- `guestH5Token` API 契约。
- Token 绑定与过期校验。
- 访客接口限流。
- 品牌与商品状态校验。
- H5 创建订单、重复点击幂等处理。
- 普通浏览器 MWEB/Mock 支付分流。

## 十、验收标准

### 手机浏览器 H5

1. 点击“立即下单”不再调用 `wx.login`。
2. 不再出现“微信登录失败”。
3. 能进入 H5 下单表单。
4. 未填写手机号和微信号时不能提交。
5. 提交后能生成唯一订单号。
6. 重复点击不会重复创建订单。
7. 演示环境能够完成 Mock 支付，或明确显示暂未开放支付。

### 微信小程序

1. `wx.login` 成功返回 code。
2. 云函数使用匹配的 AppID/AppSecret 换取 OpenID。
3. `miniLogin` 返回 CUSTOMER 会话。
4. 点击下单可以生成绑定客户 OpenID 的 H5 Token。
5. web-view 能打开 H5 下单页。

## 十一、最终判断

- **直接原因：H5 页面错误调用了微信小程序专用的 `wx.login`。**
- **不是因为商品配置错误。**
- **不是单纯因为小程序尚未正式发布。**
- AppID `wxe40bb897376601cc` 只能在真正的小程序运行环境中发挥作用。
- 即使小程序已经发布，普通浏览器 H5 仍需要独立的访客下单或 H5 登录方案。
- 当前手机 H5 演示建议增加“访客短期 Token + 联系方式下单 + MWEB/Mock 支付”的独立链路。
