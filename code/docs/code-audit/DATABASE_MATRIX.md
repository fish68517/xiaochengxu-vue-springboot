# 数据库与 Schema 矩阵

## 扫描结果

- 阿里云：`apps/client/uniCloud-aliyun/database/`，42 份 `*.schema.json`。
- 腾讯云：`uniCloud-tcb/database/`，42 份 `*.schema.json`。
- 两侧同名 schema 的 SHA-256 全部一致。
- 42 份 schema 均设置客户端 `read/create/update/delete=false`，数据只能经云函数访问。
- 目录中未发现独立索引定义。schema 对“唯一”的描述不等于数据库唯一索引，需在云控制台另行核对。

| Collection | 用途 | 主要 Service / 模块 | 对应用例 | Schema 审计 |
|---|---|---|---|---|
| `account_security` | MFA、登录安全状态 | `account-security.cjs` | TC10、TC23、TC30 | 字段覆盖；索引未声明 |
| `assignments` | 指派、抢单、退单历史 | assign/grab/release actions | TC13、TC14、TC25～TC27 | 字段覆盖；orderId/workerId 索引未声明 |
| `attachments` | 完成/实名/异议/回单附件 | `upload.cjs`、`uploadFile` | TC08、TC28、TC31、TC37 | 字段覆盖；私有访问由 service 控制 |
| `audit_logs` | 管理和系统操作审计 | `appendAudit`、路由审计 | TC12～TC20、TC31～TC39 | 字段覆盖；查询索引未声明 |
| `auth_sessions` | 会话撤销与版本 | `account-security.cjs` | TC10、TC23、TC30 | 字段覆盖；TTL/用户索引需外置 |
| `brand_config_versions` | 品牌配置发布快照 | `saveBrandConfig` | TC39 | 字段覆盖；brandId+version 唯一未声明 |
| `brands` | 品牌、AppID、主题、文案、渠道引用 | brand services | TC39、TC41 | 字段覆盖；brandId/code/appId 唯一索引未声明 |
| `commission_rules` | 佣金规则版本 | commission services、下单快照 | TC16、TC18、TC32、TC38 | 字段覆盖；版本索引未声明 |
| `configs` | 全局业务参数 | `getConfig/getConfigs/updateConfigs` | TC05、TC13、TC17、TC27、TC29、TC33 | Schema 有键值；部分参数未被执行逻辑消费 |
| `customers` | 微信客户身份 | `miniLogin` | TC03、TC07～TC09 | 字段覆盖；openid 唯一索引未声明 |
| `data_rights_requests` | 数据权利申请 | privacy services | 通用合规 | 字段覆盖；非 42 项主链路 |
| `dicts` | 游戏/区服/服务类型字典 | `listDicts/saveDict` | TC12、TC33 | 缺停用/引用保护的完整服务能力 |
| `disputes` | 异议、证据、审理时间线 | dispute services | TC08、TC20 | 字段覆盖；orderId 唯一未声明 |
| `financial_exports` | 财务导出记录 | reconciliation/export | TC38 | 字段覆盖；非报表页面直接数据源 |
| `h5_token_revocations` | H5 token 撤销 | `revokeH5Token` | TC02～TC04 | 字段覆盖；TTL 需云端配置 |
| `login_events` | 登录历史 | account security | TC10、TC23、TC30 | 字段覆盖；查询索引未声明 |
| `mfa_recovery_codes` | MFA 恢复码 | account security | 管理安全 | 字段覆盖；非测试基线必测项 |
| `notifications` | 站内通知 | `notify/listNotifications/markRead` | TC09、TC11、TC37 | 字段覆盖；receiverId+时间索引未声明 |
| `operational_alerts` | 运维告警 | commercial ops | 商用运维 | 字段覆盖 |
| `operational_events` | 调用指标与失败事件 | `recordOperation` | 全局可运维性 | 字段覆盖；高频写入索引/保留期未声明 |
| `order_logs` | 订单状态和操作流水 | `transition/addOrderLog` | TC05、TC12～TC20、TC25～TC28 | 字段较全；退款成功/取消成功存在写入缺口 |
| `order_messages` | 订单站内留言 | message services | TC22 | 字段覆盖；对象权限缺口在 service；orderId+createdAt 索引未声明 |
| `orders` | 订单聚合与状态 | 几乎全部订单 services | TC02～TC28、TC32、TC38 | 主字段齐；未声明 version/poolTimeout 等部分运行字段及唯一索引 |
| `payment_events` | 微信支付/退款通知幂等与重试 | `payment-operations.cjs` | TC03～TC05、TC15、TC18～TC20、TC36 | 字段覆盖；nextRetryAt 索引/触发器需外置 |
| `payments` | 支付单 | payment services | TC03～TC05、TC15、TC36 | 字段覆盖；支付流水和幂等键唯一索引未声明 |
| `privacy_audit_logs` | 敏感信息访问审计 | `privacy.cjs` | TC07/合规 | 字段覆盖 |
| `privacy_consents` | 隐私协议同意记录 | privacy services | 合规 | 字段覆盖 |
| `products` | 商品、表单、价格、佣金 | product services | TC01、TC02、TC32、TC40 | 字段覆盖；brandId+status 查询索引未声明 |
| `reconciliation_cases` | 对账异常工单 | reconciliation | TC38 | 字段覆盖 |
| `reconciliation_runs` | 对账批次 | reconciliation | TC38 | 字段覆盖 |
| `refunds` | 退款申请/审批/回调 | refund services | TC15、TC18～TC20、TC36 | 主字段齐；状态集合与订单 RefundStatus 表达并非完全一致 |
| `security_rate_limits` | 账号/IP/设备限流 | account security | TC10、TC30 | 字段覆盖；过期清理策略需云端验证 |
| `subscribe_quota` | 一次性订阅授权额度 | subscribe services | TC09 | 字段覆盖；orderId+templateKey 唯一索引未声明 |
| `system_nonces` | 内部 HMAC 防重放 | auth | TC05、TC27 | 字段覆盖；TTL 清理需云端配置 |
| `transfer_records` | 人工出款凭证/批次 | withdrawal services | TC37 | 字段覆盖；batchNo 唯一索引未声明 |
| `user_brand_roles` | 用户品牌范围与权限 | access services | TC30、TC31、TC38、TC39、TC41 | 字段覆盖；userId+brandId 唯一索引未声明 |
| `users` | CS/Worker/Admin 账号 | auth/staff/worker services | TC10、TC23、TC30、TC31 | 字段覆盖；phone 唯一索引未声明 |
| `vip_list` | VIP 手机/微信匹配 | VIP services、下单 | TC21、TC34 | 字段覆盖；matchType+matchKey 唯一索引未声明 |
| `wallet_transactions` | 钱包不可变流水 | wallet/refund/withdraw services | TC16、TC18、TC19、TC29、TC35～TC38 | 字段覆盖；refId 幂等唯一未声明 |
| `wallets` | 可用/冻结/累计余额 | wallet services | TC16、TC18、TC19、TC29、TC35～TC38 | 字段覆盖；ownerId 唯一索引未声明 |
| `withdrawals` | 提现状态机 | withdrawal services | TC11、TC29、TC37、TC38 | 字段覆盖；状态兼容旧值，索引未声明 |
| `worker_profiles` | 实名与提现资料 | profile/worker services | TC23、TC29、TC31 | 字段覆盖；workerId 唯一索引未声明 |

## 建议的最小生产索引清单

以下为审计建议，不代表本轮已经创建：

1. `users(phone)` unique；`customers(openid)` unique。
2. `orders(orderNo)` unique；`orders(idempotencyScope,idempotencyKey)` unique（空键策略需设计）；`orders(brandId,status,createdAt)`。
3. `payments(providerTransactionId)` unique；`payments(brandId,idempotencyKey)` unique；`refunds(outRefundNo)` unique。
4. `wallets(ownerId)` unique；`wallet_transactions(refId,type)` 结合业务幂等设计。
5. `vip_list(matchType,matchKey)` unique；`dicts(type,code)` unique。
6. `brands(brandId)`、`brands(code)`、`brands(appId)` unique；`brand_config_versions(brandId,version)` unique。
7. `order_messages(orderId,createdAt)`、`order_logs(orderId,createdAt)`、`notifications(receiverId,createdAt)`。
8. `payment_events(status,nextRetryAt)`、`system_nonces(expiresAt)`、`auth_sessions(expiresAt)` 的查询/TTL 索引。
