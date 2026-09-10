# 订单状态机审计

## 状态源

生产状态机定义在 `packages/domain/src/order-machine.js:4-39`，共 12 个订单状态和 4 个退款子状态。生产云函数通过生成的 `lib/domain.cjs` 调用这些纯函数，副作用由 `lib/services.cjs` 与 `lib/payment-operations.cjs` 完成。

## 实际流转矩阵

| 当前状态 | action | 目标状态 | 允许角色 | 失败条件 | `order_logs` | `audit_logs` |
|---|---|---|---|---|---|---|
| 无 | `createOrderFromH5` | PENDING_PAYMENT | H5 token | token/商品/联系方式/表单/限额失败 | 未写创建日志 | 否 |
| PENDING_PAYMENT | `payNotify` / mock `confirmMockPayment` | PENDING_ACCEPT | SYSTEM / CUSTOMER(mock) | 验签、金额、品牌、状态或 CAS 冲突 | 是 | 支付事件另记 `payment_events` |
| PENDING_PAYMENT | `timeoutCloseUnpaidOrders` | CLOSED | SYSTEM | 未超时或 CAS 冲突 | 是 | 系统 action 审计 |
| PENDING_ACCEPT | `enterOrder` | PENDING_GRAB | CS/管理 | 六个必填缺失、品牌/状态不符 | 是 | 是 |
| PENDING_GRAB | `assignOrder` | ASSIGN_PENDING | CS/管理 | Worker 停用、品牌不符、状态变化 | 是 | 是 |
| ASSIGN_PENDING | `acceptAssignment` | IN_SERVICE | 被指派 WORKER | 非指派对象、状态变化 | 是 | 是 |
| ASSIGN_PENDING | `rejectAssignment` | PENDING_GRAB | 被指派 WORKER | 非指派对象、状态变化 | 是 | 是，另写 assignment |
| ASSIGN_PENDING | `timeoutRejectAssignments` | PENDING_GRAB | SYSTEM | 未到时限、CAS 冲突 | 是 | 系统 action 审计 |
| PENDING_GRAB | `grabOrder` | IN_SERVICE | WORKER | 停用/冻结、超过上限、版本或 CAS 冲突 | 是 | 是，另写 assignment |
| IN_SERVICE | `releaseOrder` | PENDING_GRAB | 当前 WORKER | 非订单 Worker、状态变化 | 是 | 是，另写 assignment |
| IN_SERVICE | `submitCompletion` | PENDING_CONFIRM | 当前 WORKER | 实际产出非法、无附件、重复提交 | 是 | 是 |
| PENDING_CONFIRM | `verifyCompletion` | PENDING_CONFIRM（VERIFIED） | CS/管理 | 品牌或状态不符 | 是 | 是 |
| PENDING_CONFIRM | `rejectCompletion` | IN_SERVICE | CS/管理 | 原因空、状态不符 | 是 | 是 |
| PENDING_CONFIRM | `reworkOrder` | IN_SERVICE | CS/管理 | 补单次数达到 1、状态不符 | 是 | 是 |
| PENDING_CONFIRM | `confirmSettlement` | SETTLED | CS/管理 | 未核对、未勾客户确认、无 Worker、CAS 冲突 | 是 | 是；钱包同事务 |
| PENDING_ACCEPT/PENDING_GRAB | `requestCancellation` | 原状态（取消审批挂起） | CS/管理 | 无成功支付、重复申请、状态不符 | 是 | 是 |
| 原状态 + 取消审批 | `approveRefund` + 退款成功回调 | CANCELLED | ADMIN/财务 + SYSTEM | 审批并发、支付关联/微信退款失败 | 回调链路无独立取消日志缺口 | 审批有 |
| 原状态 + 取消审批 | `rejectRefund` | 原状态 | ADMIN/财务 | 非待审批 | 是 | 是 |
| IN_SERVICE | `requestRefund` | REFUNDING / PENDING_APPROVAL | CS/调度/品牌管理 | 无成功支付、比例/状态不符、重复申请 | 是 | 是 |
| PENDING_CONFIRM | `requestRefund` | REFUNDING / PENDING_APPROVAL | CS/调度/品牌管理 | 同上 | 是 | 是 |
| REFUNDING/PENDING_APPROVAL | `approveRefund` | REFUNDING/PROCESSING | ADMIN/财务 | 预算、支付关联、并发、微信退款失败 | 审批阶段无统一状态日志缺口 | 是 |
| REFUNDING | `payNotify` 退款事件 / `compensatePayments` | REFUNDED | SYSTEM | 验签、关联、金额、币种失败 | 未见退款成功 `order_logs` | 事件/补偿有审计 |
| REFUNDING/PENDING_APPROVAL | `rejectRefund` | `fromStatus` | ADMIN/财务 | 非待审批 | 是 | 是 |
| SETTLED | `submitDispute` | DISPUTING | 订单 CUSTOMER | 超 72h、重复、非本人、CAS 冲突 | 是 | 否（disputes 有时间线） |
| DISPUTING | `resolveDispute(MAINTAIN)` | SETTLED | CS/ADMIN/仲裁 | 未进入 UNDER_REVIEW、备注空、状态不符 | 是 | 是 |
| DISPUTING | `resolveDispute(PARTIAL/FULL)` | REFUNDING/PENDING_APPROVAL | ADMIN/仲裁 | 未审理、比例/支付关联失败 | 是 | 是 |

角色中的“管理”是当前代码的扩展角色集合，并不代表符合 TC30“只有 ADMIN”的测试口径。

## P1 / E1～E9 对照

| 路径 | 测试期望 | 当前代码 | 结论 |
|---|---|---|---|
| P1 | 待支付→待受理→待抢单→服务中→待确认→已结单 | `payNotify`→`enterOrder`→`grabOrder/acceptAssignment`→`submitCompletion`→`verifyCompletion`→`confirmSettlement` | PASS_CODE |
| E1 | 待支付→已关闭 | `timeoutCloseUnpaidOrders` 有 CAS 与日志；触发器部署需云端验证 | MANUAL_TEST_REQUIRED |
| E2 | 待受理/待抢单→已取消 | 先挂取消审批，退款成功回调后 `CANCELLED` | BLOCKED_BY_EXTERNAL_SERVICE |
| E3 | 待抢单→指派待确认→服务中/待抢单 | 指派、接受、拒绝均有；超时回池触发器需验证 | PARTIAL |
| E4 | 服务中→待抢单 | `releaseOrder` 校验当前 Worker 并留痕 | PASS_CODE |
| E5 | 服务中→退款中→已退款 | 比例退款、审批、退款回调、追佣存在 | BLOCKED_BY_EXTERNAL_SERVICE |
| E6 | 待确认→服务中→待确认→已结单 | `reworkOrder` 默认最多 1 次 | PASS_CODE |
| E7 | 待确认→退款中→已退款 | 差额比例公式与追佣存在 | BLOCKED_BY_EXTERNAL_SERVICE |
| E8 | 已结单→异议中→已结单/退款中→已退款 | 72h、重复防护、仲裁、退款链路存在 | BLOCKED_BY_EXTERNAL_SERVICE |
| E9 | 退款失败→重试→已退款 | `payment_events` RETRY 与 `compensatePayments` 查询补偿存在；订单退款子状态没有一致写成 FAILED，且触发器需验证 | PARTIAL |

## 状态机风险

1. `configs` 中支付/入池/指派时限没有完整进入订单快照，定时服务仍常量优先，缩短配置测试可能不生效。
2. 退款成功与未开工取消成功未统一写 `order_logs`，不满足“每次状态流转同事务留痕”的强口径。
3. E9 的生产实现使用退款记录 `PROCESSING/ABNORMAL/CLOSED` 与事件 RETRY，和领域 `RefundStatus.FAILED` 表达不一致。
4. 创建订单本身没有 `order_logs` 记录，首次状态来源只能从订单创建时间和审计外围推断。
