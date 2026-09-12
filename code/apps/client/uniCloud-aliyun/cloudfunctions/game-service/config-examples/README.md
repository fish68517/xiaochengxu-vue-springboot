# 支付文件配置

模板不是生产配置。将填写后的文件放到函数根目录 `private-config/wechat-pay.json` 和 `private-config/credentials.json`，PEM 路径相对此目录。已有非空前缀环境变量优先；无效环境变量不会自动回退。

先确认实际品牌 Code、主体、后台 secretRef、服务号绑定和云函数 HTTPS 回调 URL。不要直接使用模板占位符。APIV3_KEY 为秘密，真实 JSON 与 PEM 不得提交 Git、放入前端或公开存储。

发布整个阿里云 game-service 时，必须确认 private-config 也包含在服务端部署包中；Git 忽略不代表部署工具会自动包含或排除它。现有环境变量无需删除。此目录只存不含秘密的示例。

详情见项目 `doc/文件读取支付.md`。文件读取代码通过本地校验不等于真实微信支付验收完成。
