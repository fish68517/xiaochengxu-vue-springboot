# 手动测试用例代码审计矩阵

审计基线：`codex-audit/手动测试用例.pdf`，共 42 项。审计时间：2026-09-10。

> 结论只代表当前源码链路。`PASS_CODE` 不等于真实云环境已经验收；微信、域名、云函数配额、定时触发器和浏览器兼容性仍以实测为准。

| 编号 | 测试项 | 前端 | API / action | 生产后端 | 数据 | 主要结论 |
|---|---|---|---|---|---|---|
| TC01 | 商品浏览 | 有 | `listProducts/getProduct` | 有 | `products` | PARTIAL |
| TC02 | 下单必填校验 | 有 | `createOrderFromH5` | 有 | `orders` | PASS_CODE |
| TC03 | 微信内支付 | 有 | `oauthExchange/getPaymentParams/payNotify` | 有 | `payments/payment_events/orders` | BLOCKED_BY_EXTERNAL_SERVICE |
| TC04 | 微信外 H5 支付 | 有 | `getPaymentParams/getPaymentStatus` | 有 | `payments/orders` | BLOCKED_BY_EXTERNAL_SERVICE |
| TC05 | 支付超时关单 | 无独立页 | `timeoutCloseUnpaidOrders` | 有 | `orders/order_logs` | MANUAL_TEST_REQUIRED |
| TC06 | 支付成功页 | 有 | 支付状态查询 | 有 | `orders/payments` | PARTIAL |
| TC07 | 订单查询 | 有 | `listMyOrders/queryOrderByNo` | 有 | `orders` | PASS_CODE |
| TC08 | 异议提交 | 有 | `submitDispute` | 有 | `orders/disputes/order_logs` | PASS_CODE |
| TC09 | 订阅消息 | 有 | `requestSubscribe` | 有 | `subscribe_quota/notifications` | BLOCKED_BY_EXTERNAL_SERVICE |
| TC10 | 客服登录 | 有 | `authLogin` | 有 | `users/security_rate_limits/auth_sessions` | PASS_CODE |
| TC11 | 工作台待办 | 有 | `listOrders/listWithdrawals` | 有 | 多集合 | PARTIAL |
| TC12 | 订单录入 | 有 | `enterOrder` | 有 | `orders/order_logs` | PASS_CODE |
| TC13 | 抢单池与超时标记 | 有 | `listPool/timeoutMarkPool` | 有 | `orders` | REQUIREMENT_MISMATCH |
| TC14 | 指派 | 有 | `assignOrder/acceptAssignment/rejectAssignment` | 有 | `orders/assignments/order_logs` | PASS_CODE |
| TC15 | 未开工取消 | 有 | `requestCancellation/approveRefund/rejectRefund` | 有 | `refunds/payments/orders` | BLOCKED_BY_EXTERNAL_SERVICE |
| TC16 | 核对结单 | 有 | `verifyCompletion/confirmSettlement` | 有 | `orders/wallets/wallet_transactions/order_logs` | PASS_CODE |
| TC17 | 未达标补单 | 有 | `reworkOrder` | 有 | `orders/order_logs` | PASS_CODE |
| TC18 | 未达标差额退款 | 有 | `requestRefund/approveRefund` | 有 | `refunds/wallets/wallet_transactions` | BLOCKED_BY_EXTERNAL_SERVICE |
| TC19 | 服务中取消 | 有 | `requestRefund/approveRefund` | 有 | `refunds/orders/wallets` | BLOCKED_BY_EXTERNAL_SERVICE |
| TC20 | 异议仲裁 | 有 | `startDisputeReview/resolveDispute/approveRefund` | 有 | `disputes/refunds/orders` | BLOCKED_BY_EXTERNAL_SERVICE |
| TC21 | VIP 自动标记 | 有 | `addVip/listVips/createOrderFromH5` | 有 | `vip_list/orders` | PASS_CODE |
| TC22 | 站内消息 | 有 | `sendOrderMessage/listOrderMessages` | 有但对象权限不足 | `order_messages/orders` | SECURITY_RISK |
| TC23 | 接单登录与首次改密 | 有 | `workerLogin/changePassword` | 有 | `users/account_security/auth_sessions` | PARTIAL |
| TC24 | 接单订单池 | 有 | `listPool/listMyOrders` | 有 | `orders` | PARTIAL |
| TC25 | 抢单并发 | 有 | `grabOrder` | 条件更新 + 事务 | `orders/assignments` | PASS_CODE |
| TC26 | 退单 | 有 | `releaseOrder` | 有 | `orders/assignments/order_logs` | PASS_CODE |
| TC27 | 指派处理 | 有 | `acceptAssignment/rejectAssignment/timeoutRejectAssignments` | 有 | `orders/assignments/order_logs` | PARTIAL |
| TC28 | 完成申请 | 有 | `submitCompletion/uploadFile` | 有 | `orders/attachments/order_logs` | PASS_CODE |
| TC29 | 钱包与提现 | 有 | 钱包、提现 actions | 起提金额配置尚未接入执行链路 | `wallets/wallet_transactions/withdrawals/worker_profiles` | PARTIAL |
| TC30 | 管理后台登录 | 有 | `authLogin` | 后台仅允许 ADMIN/SUPER_ADMIN/BRAND_ADMIN/FINANCE_REVIEWER/ARBITRATOR，业务端角色不可登录 | `users/auth_sessions` | PASS_CODE |
| TC31 | 员工管理 | 部分 | `createWorker/updateWorker` | 另有 `createStaff/updateStaff` | `users/worker_profiles/user_brand_roles` | PARTIAL |
| TC32 | 商品管理 | 有 | `saveProduct/updateProductStatus` | 有 | `products/commission_rules` | REQUIREMENT_MISMATCH |
| TC33 | 字典与配置 | 部分 | `listDicts/saveDict/getConfigs/updateConfigs` | 部分 | `dicts/configs` | PARTIAL |
| TC34 | VIP 管理 | 有 | `addVip/removeVip/listVips` | 有但删除参数不一致 | `vip_list` | PARTIAL |
| TC35 | 钱包调账与冻结 | 有 | `adjustWallet/freezeWallet` | 有 | `wallets/wallet_transactions/audit_logs` | PASS_CODE |
| TC36 | 退款审批 | 有 | `approveRefund/rejectRefund` | 有 | `refunds/payments/orders/wallets` | BLOCKED_BY_EXTERNAL_SERVICE |
| TC37 | 提现审批 | 有 | 提现审核、出款 actions | 有 | `withdrawals/transfer_records/wallets` | PASS_CODE |
| TC38 | 报表 | 有 | 四类 report actions | 有但品牌范围未过滤 | 多集合 | SECURITY_RISK |
| TC39 | 品牌配置 | 有 | `getBrandConfig/saveBrandConfig` | 有 | `brands/brand_config_versions` | MANUAL_TEST_REQUIRED |
| TC40 | 文案红线 | 前端有全表 | `saveProduct` | 后端词表不完整 | `products` | REQUIREMENT_MISMATCH |
| TC41 | 多入口隔离 | 三个独立应用 | 三端共享鉴权后端 | 有 | 无 | MANUAL_TEST_REQUIRED |
| TC42 | 手机与电脑浏览器 | 有响应式规则 | 无 | 无 | 无 | MANUAL_TEST_REQUIRED |

## 统计

| 状态 | 数量 |
|---|---:|
| PASS_CODE | 15 |
| PARTIAL | 10 |
| MISSING | 0 |
| FRONTEND_ONLY | 0 |
| BACKEND_ONLY | 0 |
| LOCAL_ONLY | 0 |
| MOCK_ONLY | 0 |
| REQUIREMENT_MISMATCH | 3 |
| SECURITY_RISK | 2 |
| MANUAL_TEST_REQUIRED | 4 |
| BLOCKED_BY_EXTERNAL_SERVICE | 8 |
| 合计 | 42 |

## 完成度口径

- Code Implementation Coverage：`42 / 42 = 100%`。口径是“至少存在一段生产代码链路”，不代表链路正确或已验收。
- Strict Code Acceptance：`15 / 42 = 35.7%`。只统计 `PASS_CODE`。
- Production Ready Coverage：`15 / 42 = 35.7%`。外部服务、人工测试、需求偏差和安全风险均不计入通过。
