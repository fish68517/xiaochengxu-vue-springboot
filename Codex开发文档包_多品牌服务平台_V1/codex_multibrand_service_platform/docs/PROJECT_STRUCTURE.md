# PROJECT_STRUCTURE.md — 工程蓝图、数据模型与接口

## 1. 总体架构

```text
┌─────────────────────┐
│ 客户微信小程序       │
│ uni-app / Vue3 / TS │
└─────────┬───────────┘
          │ web-view
          ▼
┌─────────────────────┐
│ H5 支付承载页        │
└─────────┬───────────┘
          │
          │ unified service adapter
          ▼
┌─────────────────────────────────────────┐
│               uniCloud                  │
│                                         │
│ Auth / Brand / Product / Order          │
│ Payment / Assignment / Commission       │
│ Refund / Withdrawal / Dispute / Audit   │
└──────────────┬──────────────────────────┘
               │
               ▼
        uniCloud Database
               ▲
               │
     ┌─────────┴─────────┐
     │                   │
┌────┴────────┐    ┌─────┴────────┐
│ Web 工作台   │    │ 管理后台      │
│ Vue3 + TS   │    │ Vue3 + TS    │
└─────────────┘    └──────────────┘
```

## 2. 推荐 Monorepo

```text
project/
├── README.md
├── AGENTS.md
├── package.json
├── pnpm-workspace.yaml
├── apps/
│   ├── customer-miniapp/
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   ├── stores/
│   │   │   ├── services/
│   │   │   ├── config/
│   │   │   └── assets/
│   │   └── manifest.json
│   ├── payment-h5/
│   │   └── src/
│   ├── workbench-web/
│   │   └── src/
│   │       ├── views/
│   │       ├── components/
│   │       ├── stores/
│   │       ├── services/
│   │       └── router/
│   └── admin-web/
│       └── src/
├── packages/
│   ├── domain-types/
│   ├── api-contracts/
│   ├── brand-runtime/
│   ├── shared-ui/
│   ├── shared-utils/
│   └── mock-data/
├── uniCloud/
│   ├── cloudfunctions/
│   ├── cloudobjects/
│   │   ├── auth/
│   │   ├── brand/
│   │   ├── product/
│   │   ├── order/
│   │   ├── payment/
│   │   ├── commission/
│   │   ├── refund/
│   │   ├── withdrawal/
│   │   ├── dispute/
│   │   └── audit/
│   └── database/
│       ├── schemas/
│       └── seed/
├── docs/
└── design/
```

如果现有项目不是 Monorepo，不强制迁移；保持等价分层即可。

## 3. 前端调用分层

```text
Page/View
   ↓
Component
   ↓
Store / UseCase
   ↓
Service Interface
   ↓
Mock Adapter | uniCloud Adapter
   ↓
Cloud Object
```

禁止：

```text
页面
  ├── 直接拼数据库查询
  ├── 直接算佣金
  ├── 直接判断可退款金额
  └── 直接改订单状态
```

## 4. 服务端模块职责

### BrandService
- resolveBrand
- getBootstrap
- updateBrand
- updateAssets
- publishConfig
- validateChannel

### ProductService
- listByBrand
- get
- create/update
- publish/unpublish
- snapshotForOrder

### OrderService
- create
- get/list
- intake/record
- claim
- assign
- start
- submitCompletion
- verify
- close
- getAllowedActions

### PaymentService
- createSession
- query
- handleCallback
- verifySignature
- applyPaymentSuccess

### CommissionService
- calculate
- accrue
- makeAvailable
- createClawback
- getBalance
- getLedger

### RefundService
- create
- review
- execute
- handleResult

### WithdrawalService
- create
- review
- markPaying
- markPaid
- markFailed

### DisputeService
- create
- addEvidence
- accept
- decide
- close
- applyDecision

### AuditService
- append
- query

## 5. 核心 Collection

### brands

```ts
{
  _id,
  code,
  name,
  status,
  publicConfig,
  channelRefs,
  publishedVersion,
  createdAt,
  updatedAt
}
```

### brand_config_versions

```ts
{
  _id,
  brandId,
  version,
  configSnapshot,
  status, // DRAFT/PUBLISHED
  createdBy,
  publishedBy,
  timestamps
}
```

### products

```ts
{
  _id,
  brandId,
  sku,
  name,
  description,
  priceMinor,
  assets,
  status,
  sort,
  version,
  timestamps
}
```

### orders

```ts
{
  _id,
  orderNo,
  brandId,
  customerId,
  productId,
  productSnapshot,
  brandSnapshot,
  amountMinor,
  currency,
  paymentStatus,
  orderStatus,
  assigneeId,
  version,
  createdAt,
  paidAt,
  closedAt
}
```

### order_events

```ts
{
  _id,
  brandId,
  orderId,
  fromStatus,
  toStatus,
  action,
  operatorId,
  operatorRole,
  payloadSnapshot,
  requestId,
  createdAt
}
```

### assignments

```ts
{
  _id,
  brandId,
  orderId,
  workerId,
  type, // CLAIM / ASSIGN / REASSIGN
  operatorId,
  active,
  createdAt
}
```

### payments

```ts
{
  _id,
  brandId,
  orderId,
  paymentNo,
  channel,
  amountMinor,
  status,
  providerTransactionId,
  idempotencyKey,
  createdAt,
  paidAt
}
```

### commission_rules

```ts
{
  _id,
  brandId,
  version,
  config,
  status,
  effectiveAt
}
```

规则结构当前未定义，不得猜比例。

### commission_ledger

```ts
{
  _id,
  brandId,
  accountId,
  orderId,
  refundId,
  withdrawalId,
  type,
  direction,
  amountMinor,
  ruleVersion,
  referenceId,
  createdAt
}
```

### refunds

```ts
{
  _id,
  brandId,
  orderId,
  paymentId,
  refundNo,
  amountMinor,
  status,
  reason,
  providerRefundId,
  createdBy,
  reviewedBy,
  timestamps
}
```

### withdrawals

```ts
{
  _id,
  brandId,
  accountId,
  applicantId,
  amountMinor,
  status,
  reviewNote,
  reviewedBy,
  payoutRef,
  timestamps
}
```

### disputes

```ts
{
  _id,
  brandId,
  orderId,
  creatorId,
  reasonCode,
  description,
  evidence,
  respondentContent,
  arbitratorId,
  decision,
  decisionNote,
  status,
  timestamps
}
```

### user_brand_roles

```ts
{
  _id,
  userId,
  brandId,
  roles[],
  permissions[],
  status
}
```

### audit_logs

```ts
{
  _id,
  brandId,
  operatorId,
  action,
  resourceType,
  resourceId,
  before,
  after,
  requestId,
  ipMeta,
  createdAt
}
```

## 6. 索引建议

必须根据最终数据库能力创建等价索引：

- `brands.code` unique
- `products(brandId, status, sort)`
- `orders.orderNo` unique
- `orders(brandId, customerId, createdAt)`
- `orders(brandId, orderStatus, createdAt)`
- `orders(brandId, assigneeId, orderStatus)`
- `order_events(orderId, createdAt)`
- `payments.paymentNo` unique
- `payments(providerTransactionId)` unique where applicable
- `refunds.refundNo` unique
- `commission_ledger(accountId, createdAt)`
- `withdrawals(brandId, status, createdAt)`
- `disputes(brandId, status, createdAt)`
- `user_brand_roles(userId, brandId)`

## 7. Cloud Object API 契约建议

### brand

```ts
brand.getBootstrap({ brandCode })
brand.list()
brand.get({ brandId })
brand.create(payload)
brand.update({ brandId, patch })
brand.publish({ brandId })
brand.updateAssets({ brandId, assets })
```

### product

```ts
product.list({ brandContext, filters })
product.get({ productId })
product.create(payload)
product.update({ productId, patch })
product.publish({ productId })
product.unpublish({ productId })
```

### order

```ts
order.create({ productId, formData, idempotencyKey })
order.get({ orderId })
order.list(filters)
order.claim({ orderId })
order.assign({ orderId, workerId })
order.start({ orderId })
order.submitCompletion({ orderId, result })
order.verify({ orderId, result })
order.close({ orderId })
order.getAllowedActions({ orderId })
```

### payment

```ts
payment.createSession({ orderId })
payment.query({ orderId })
payment.handleCallback(rawRequest)
```

### refund

```ts
refund.create({ orderId, reason, amountMinor? })
refund.review({ refundId, decision, note })
refund.query({ refundId })
```

是否允许客户端指定 `amountMinor` 取决于正式退款规则；后端必须复核。

### commission

```ts
commission.getAccount()
commission.getLedger(filters)
commission.previewForOrder({ orderId }) // 管理用途
```

### withdrawal

```ts
withdrawal.create({ amountMinor })
withdrawal.list(filters)
withdrawal.review({ withdrawalId, decision, note })
withdrawal.markPaid({ withdrawalId, payoutRef })
```

### dispute

```ts
dispute.create({ orderId, reasonCode, description, evidence })
dispute.addEvidence({ disputeId, evidence })
dispute.list(filters)
dispute.decide({ disputeId, decision, note })
```

## 8. 品牌上下文

前端请求可携带 `brandCode`，但后端最终解析：

```text
request
  + authenticated user
  + app/channel context
  + route brandCode
        ↓
BrandContextResolver
        ↓
{ brandId, channelId, allowedScope }
```

所有 Repository 查询必须显式带 `brandId` 或通过受控 Context 自动注入。

## 9. Local-First / 多环境

### development

- `API_MODE=mock|unicloud-dev`
- `PAYMENT_MODE=mock`
- `MESSAGE_MODE=mock`
- `BRAND_CODE=demo-a/demo-b`
- 使用测试/本地资源
- 不需要生产密钥

### staging

- uniCloud 测试服务空间
- 测试品牌
- 测试支付/沙箱（如果渠道支持）
- 测试对象存储

### production

- uniCloud 生产服务空间
- 真实品牌
- 真实渠道
- Secret 管理
- 审计与监控开启

原则：
- 同一份业务代码
- Adapter/环境变量切换
- 禁止复制业务逻辑

## 10. 多品牌构建

推荐维护：

```text
config/brands/
├── demo-a.env
├── demo-b.env
├── brand-a.env
└── brand-b.env
```

文件只放非敏感构建参数，例如：
- BRAND_CODE
- APP_DISPLAY_NAME
- PUBLIC_CHANNEL_ID

AppSecret、支付密钥不得进入这些文件。

构建脚本目标：

```text
build:mp:demo-a
build:mp:demo-b
build:mp:<brand>
```

每个品牌构建前执行配置校验，防止 AppID/brandCode 错配。

## 11. 测试分层

### 单元测试

重点：
- Order 状态机
- 抢单并发
- BrandContext
- 金额计算工具
- Commission Ledger
- Refund Clawback
- Withdrawal freeze/release
- 权限规则

### 集成测试

- 下单 → 支付回调 → 订单推进
- 抢单并发
- 退款 → 追佣
- 提现审批
- 仲裁结果联动
- 跨品牌越权

### Brand Matrix Smoke Test

至少使用 demo-a / demo-b：
- 同一构建代码
- 不同品牌资产
- 不同商品
- A 用户不可读取 B 数据
