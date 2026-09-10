# 本地实现与生产实现差异

## 架构边界

- 本地：`scripts/api-server.mjs` + `packages/backend/src/services.js` + `packages/backend/src/db.js`（Memory DB）。
- 生产：`apps/client/uniCloud-aliyun/cloudfunctions/game-service` 或 `uniCloud-tcb/cloudfunctions/game-service` + uniCloud Database。
- 三端生产 API 默认走 `uniCloud.callFunction()`；本地服务只用于开发和自动化测试。

| 功能 | Local | Production | 是否一致 | 风险 |
|---|---|---|---|---|
| action 路由 | `api-server.mjs` 映射 HTTP 路由 | `game-service/index.js` 读取 `event.action` | 名称大体一致 | HTTP 200/本地通过不证明云函数可用 |
| 数据库 | `createMemoryDb()` | uniCloud Database repository | 接口相似，事务语义不同 | Memory DB 不能证明云端索引、并发和配额 |
| 种子账号/商品 | `seedDb()` 自动创建 demo 数据 | 初始化函数/云数据库 | 不一致 | demo 账号密码不得用于生产 |
| 支付 | 开发默认 mock，可 `confirmMockPayment` | production 门禁要求 wechat | 设计上隔离 | 真实商户、证书、回调未验收时为外部阻塞 |
| OAuth | 可注入/模拟 | 微信 `code2session` 与网页 OAuth | 需真实环境 | 本地 openid 不能当真实身份 |
| 退款 | 注入支付客户端可模拟成功 | 微信退款 API + 通知/补偿 | 逻辑同源，环境不同 | 真退款和余额追佣必须实测 |
| 文件上传 | `mock/...`、本地扫描器 | 对象存储、私有签名 URL、扫描器 | 不一致 | 本地附件成功不证明生产可下载 |
| 订阅消息 | 可注入客户端 | 微信订阅模板 + access token | 需真实环境 | 用户授权与模板配置无法静态验证 |
| 定时任务 | 测试直接调用 action | `system-runner` + 云控制台触发器 | 代码有，调度未证明 | E1、TC13、TC27 需部署证据 |
| 身份安全 | 本地环境可关闭严格安全 | staging/production 自动严格 | 配置不同 | 本地短密码/免 MFA 不能代表生产体验 |
| 数据隐私 | 测试可用内存仓储 | repository 随机加密 + blind index | 生产更严格 | 必须验证密钥与轮换配置 |
| 品牌隔离 | Memory DB 单测覆盖部分场景 | action 门禁 + service 过滤 | 存在报表例外 | TC38 是 P0 |
| 前端入口 | 5173/5174/5175 三端开发服务器 | `/`、`/workbench/`、`/admin/` 静态托管 | 构建 base 一致 | 域名路由仍需真实托管验证 |

## 同源代码校验

本轮对阿里云与腾讯云 `game-service` 的以下文件计算 SHA-256，结果均一致：`index.js`、`lib/auth.cjs`、`lib/services.cjs`、`lib/repository.cjs`、`lib/privacy.cjs`、`lib/commercial-ops.cjs`、`lib/payment-operations.cjs`、`lib/subscribe.cjs`。

`node scripts/verify-domain-sync.mjs` 通过：56 个领域导出集合及抽样行为一致。

## 自动化测试边界

`npm test` 本轮 192 项全部通过，覆盖状态机、并发、幂等、资金事务、权限和本地端到端。它主要运行 Memory DB/注入适配器测试，因此没有把 TC03、TC04、TC09、TC15、TC18～TC20、TC36 判为 `PASS_CODE` 或生产通过。
