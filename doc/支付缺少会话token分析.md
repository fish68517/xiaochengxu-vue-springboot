# 支付未完成：缺少会话 token

截图对应 H5 的 `completeMockPayment` 错误状态。该函数仅在支付参数返回 `paymentMode: mock` 时执行，然后调用 `confirmMockPayment`。此接口要求 CUSTOMER 登录会话，而 H5 只持有下单 token，无法通过该鉴权。这次错误发生在模拟支付确认阶段，不是微信扣款失败。

最可能的部署配置是 `game-service` 仍使用 `PAYMENT_MODE=mock`；实际远程变量未由本次工具读取。小程序登录 token 与 H5 下单 token 用途不同，不能通过将模拟确认接口公开来解决。

本次修复：

- 阿里云服务端拒绝非 development 环境使用模拟支付，返回可定位的 `PAYMENT_MOCK_NOT_ALLOWED`。
- 正式 H5 收到 mock 支付参数时停止模拟确认，避免误报会话过期。
- 创建订单后保存订单 ID，使重新支付复用当前订单。

## 部署配置

在阿里云 game-service 设置 `APP_ENV=production`、`PAYMENT_MODE=wechat`，并部署更新的云函数与客户 H5。真实支付还需当前品牌的 `WECHAT_PAY_CONFIG_MAP` 映射、品牌 `channelRefs.paymentSecretRef`、商户号及其关联的服务号 AppID，以及映射 `envPrefix` 对应的证书/私钥等服务端变量。仅配置 OAUTH_APPID/OAUTH_SECRET 不代表已配置微信商户支付。

具体字段以 `code/apps/client/uniCloud-aliyun/cloudfunctions/game-service/lib/payment-config.cjs` 为准；本次没有修改支付凭据、线上环境变量或绕过支付鉴权。完成配置后需重新从小程序打开下单页验证真实预支付，不能把模拟成功视为真实付款。
