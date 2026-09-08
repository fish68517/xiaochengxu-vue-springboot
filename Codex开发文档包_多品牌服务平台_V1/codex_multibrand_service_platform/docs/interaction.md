# interaction.md — 核心交互、状态机与异常路径

## 1. 品牌启动

```text
App Start
  ↓
读取构建配置 BRAND_CODE
  ↓
brand.getBootstrap(BRAND_CODE)
  ├─ unknown/disabled → 品牌不可用页
  ├─ network error → 重试
  └─ success
       ↓
    写入 BrandStore
       ↓
    应用 Theme + Assets
       ↓
    加载商品/首页
```

后端同时校验：
- BRAND_CODE 是否存在
- 是否启用
- 与请求渠道/AppID 是否匹配（当接入真实渠道后）

## 2. 下单 → H5 支付

```text
用户选择商品
  ↓
填写订单
  ↓
前端基础校验
  ↓
按钮 loading + disabled
  ↓
order.create(payload, idempotencyKey)
  ↓
服务端：
  - 校验用户
  - 校验品牌
  - 校验商品
  - 创建商品/价格快照
  - 计算最终金额
  - 创建 PENDING_PAYMENT 订单
  ↓
返回 orderId + paymentSession
  ↓
小程序 web-view 打开 H5
  ↓
H5 payment.create/pay
  ↓
支付渠道
  ↓
支付结果
  ├─ 渠道同步返回：仅提示处理中
  └─ 服务端回调：验签 + 幂等 + 金额/订单校验
                    ↓
                 Payment=SUCCESS
                    ↓
                 Order 合法推进
  ↓
小程序 order.get 查询最终状态
```

异常：
- 重复点击：幂等键避免重复下单
- H5 页面关闭：订单仍可查询
- 支付成功但前端没收到：以后端为准
- 支付回调重复：幂等
- 支付金额不匹配：拒绝推进订单，记录审计/告警

## 3. 订单进入订单池

```text
支付确认
  ↓
订单进入 READY_FOR_ASSIGNMENT
  ↓
工作台刷新/订阅
  ↓
有权限人员看到订单
```

如果“录入”是支付后的人工动作，可在业务确认后增加：
`PAID → PENDING_INTAKE → READY_FOR_ASSIGNMENT`

当前不擅自冻结该细节。

## 4. 抢单

```text
订单池
  ↓ 点击“抢单”
按钮 loading + disabled
  ↓
order.claim(orderId)
  ↓
服务端事务/原子条件更新：
  - brand 权限
  - role 权限
  - 当前状态 == READY_FOR_ASSIGNMENT
  - assignee 为空
  ├─ 失败：409 已被抢 / 无权限 / 状态变化
  └─ 成功：
       Assignment 记录
       Order → ASSIGNED
       OrderEvent 记录
  ↓
前端进入我的订单
```

并发要求：
- 两人同时抢单只能一个成功；
- 失败方明确显示“订单已被其他人员接单”。

## 5. 指派/改派

```text
调度选择订单
  ↓
选择人员
  ↓
order.assign(orderId, workerId)
  ↓
服务端校验：
  - 操作人权限
  - worker 品牌范围
  - worker 状态
  - 订单当前状态
  ↓
写 Assignment History
  ↓
更新当前 assignee
  ↓
写 OrderEvent + AuditLog
```

改派不能覆盖历史。

## 6. 履约 → 完成 → 核对 → 结单

```text
ASSIGNED
  ↓ start
IN_SERVICE
  ↓ submitCompletion
PENDING_VERIFY
  ├─ reject → IN_SERVICE / REWORK（规则待确认）
  └─ verify
       ↓
    VERIFIED
       ↓ close
    CLOSED
```

说明：
- `REWORK` 是否存在待确认。
- 结单条件待确认。
- Codex 不允许把 `submitCompletion()` 直接写成 `CLOSED`。

## 7. 结单 → 佣金

```text
Order CLOSED
  ↓
CommissionService.calculate(orderSnapshot, activeRuleVersion)
  ↓
生成 CommissionLedger
  ↓
冻结/待结算
  ↓
满足规则后 AVAILABLE
```

要求：
- 佣金规则必须带版本；
- 历史订单关联当时规则/结果快照；
- 规则升级不重写历史。

## 8. 退款 → 追佣

```text
refund.create(orderId)
  ↓
退款规则校验
  ↓
REFUND_PENDING
  ↓
渠道退款
  ↓
Refund SUCCESS
  ↓
RefundService.applyResult()
  ↓
CommissionService.createClawback()
  ↓
新增反向 Ledger
  ↓
余额更新
  ↓
Audit
```

异常：
- 重复退款
- 超额退款
- 已关闭/不可退款状态
- 原支付不存在
- 追佣后余额不足：具体处置策略待确认，必须 TODO，不得 Codex 猜

## 9. 提现

```text
人员查看可提现余额
  ↓
withdrawal.create(amount)
  ↓
服务端校验余额/规则
  ↓
冻结金额
  ↓
SUBMITTED
  ↓
管理员审核
  ├─ REJECTED → 解冻
  └─ APPROVED
       ↓
     PAYING
       ├─ PAY_FAILED
       └─ PAID
```

提现费率、最低额、到账渠道待确认。

## 10. 异议仲裁

```text
用户/工作人员发起异议
  ↓
Dispute OPEN
  ↓
双方补充说明/证据
  ↓
EVIDENCE_COLLECTION
  ↓
仲裁人员受理
  ↓
UNDER_REVIEW
  ↓
DECIDED
  ↓
根据裁决调用领域服务
  ├─ 不影响资金
  ├─ 触发退款
  ├─ 触发订单处理
  └─ 触发佣金调整
  ↓
CLOSED
```

仲裁页面不得直接操作订单金额字段或账本字段。

## 11. 品牌配置发布

推荐把“编辑中”和“线上生效”分开：

```text
品牌管理员编辑配置
  ↓
保存 Draft
  ↓
校验资源/字段
  ↓
Publish
  ↓
version + 1
  ↓
生成 Published Snapshot
  ↓
客户端下次 bootstrap 获取新版本
```

如果一期不需要发布工作流，可以简化为直接保存，但必须保留 `version` 和审计。

## 12. 权限交互

Web 页面渲染逻辑：

```text
login
  ↓
auth.getProfile()
  ↓
roles + brandScopes + permissions
  ↓
生成菜单
```

每次敏感请求仍由后端再次校验。

## 13. 通用异常状态

必须统一处理：
- 400 参数错误
- 401 未登录
- 403 无权限
- 404 资源不存在
- 409 并发冲突/状态冲突
- 422 业务规则不满足
- 429 频率限制（如启用）
- 500 服务异常
- 网络超时
- 重复提交

用户可重试的异常与不可重试异常必须区分。
