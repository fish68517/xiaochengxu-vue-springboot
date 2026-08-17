# 加装电梯后期管理平台 — PROJECT_STRUCTURE

> 版本：V2.0  
> 目标：Codex 可直接落地的“业主/师傅微信小程序 + 管理员 PC 后台 + API 契约”目录结构。  
> 原则：UI、业务、接口、权限、Mock 分层；缴费金额和支付逻辑不得写死在页面。

---

# 1. 推荐仓库结构

```text
elevator-platform/
├── README.md
├── docs/
│   ├── 需求.md
│   ├── UI_SPEC.md
│   ├── interaction.md
│   ├── PROJECT_STRUCTURE.md
│   └── CODEX_PROMPT.md
│
├── design/
│   ├── owner/
│   │   ├── owner-overview.png
│   │   ├── 01-home.png
│   │   ├── 02-payment-list.png
│   │   ├── 03-payment-detail.png
│   │   ├── 04-payment-records.png
│   │   ├── 05-repair-create.png
│   │   ├── 06-repair-list.png
│   │   ├── 07-maintenance.png
│   │   ├── 08-renovation.png
│   │   ├── 09-notice.png
│   │   └── 10-profile.png
│   ├── technician/
│   │   └── technician-overview.png
│   └── admin/
│       └── admin-payment-overview.png
│
├── miniprogram/
│   ├── app.ts
│   ├── app.json
│   ├── app.wxss
│   ├── sitemap.json
│   │
│   ├── assets/
│   │   ├── icons/
│   │   │   ├── payment.svg
│   │   │   ├── repair.svg
│   │   │   ├── maintenance.svg
│   │   │   ├── renovation.svg
│   │   │   ├── notice.svg
│   │   │   ├── company.svg
│   │   │   ├── profile.svg
│   │   │   ├── warning.svg
│   │   │   ├── phone.svg
│   │   │   └── pdf.svg
│   │   └── images/
│   │
│   ├── components/
│   │   ├── emergency-alert/
│   │   ├── feature-grid/
│   │   ├── feature-card/
│   │   ├── house-selector/
│   │   ├── bill-card/
│   │   ├── bill-item-list/
│   │   ├── amount-display/
│   │   ├── payment-status-tag/
│   │   ├── repair-card/
│   │   ├── image-uploader/
│   │   ├── pdf-record-card/
│   │   ├── status-tag/
│   │   ├── notice-card/
│   │   ├── empty-state/
│   │   └── loading-state/
│   │
│   ├── pages/
│   │   ├── home/index.*
│   │   ├── house/
│   │   │   ├── bind/index.*
│   │   │   └── list/index.*
│   │   ├── payment/
│   │   │   ├── list/index.*
│   │   │   ├── detail/index.*
│   │   │   ├── records/index.*
│   │   │   ├── record-detail/index.*
│   │   │   ├── receipt-apply/index.*
│   │   │   └── receipts/index.*
│   │   ├── repair/
│   │   │   ├── create/index.*
│   │   │   ├── list/index.*
│   │   │   └── detail/index.*
│   │   ├── maintenance/
│   │   │   ├── index.*
│   │   │   └── pdf/index.*
│   │   ├── renovation/
│   │   │   ├── index.*
│   │   │   ├── create/index.*
│   │   │   └── detail/index.*
│   │   ├── notice/
│   │   │   ├── index.*
│   │   │   └── detail/index.*
│   │   ├── company/index.*
│   │   ├── message/index.*
│   │   └── profile/index.*
│   │
│   ├── technician/
│   │   ├── pages/
│   │   │   ├── dashboard/index.*
│   │   │   ├── workorders/index.*
│   │   │   ├── workorder-detail/index.*
│   │   │   ├── workorder-progress/index.*
│   │   │   ├── maintenance-upload/index.*
│   │   │   ├── maintenance-list/index.*
│   │   │   ├── messages/index.*
│   │   │   └── profile/index.*
│   │   └── components/
│   │
│   ├── services/
│   │   ├── request.ts
│   │   ├── auth.ts
│   │   ├── user.ts
│   │   ├── house.ts
│   │   ├── billing.ts
│   │   ├── payment.ts
│   │   ├── receipt.ts
│   │   ├── repair.ts
│   │   ├── maintenance.ts
│   │   ├── renovation.ts
│   │   ├── notice.ts
│   │   ├── company.ts
│   │   ├── message.ts
│   │   └── upload.ts
│   │
│   ├── models/
│   │   ├── common.ts
│   │   ├── user.ts
│   │   ├── house.ts
│   │   ├── billing.ts
│   │   ├── payment.ts
│   │   ├── receipt.ts
│   │   ├── repair.ts
│   │   ├── maintenance.ts
│   │   ├── renovation.ts
│   │   ├── notice.ts
│   │   └── message.ts
│   │
│   ├── store/
│   │   ├── app-store.ts
│   │   ├── user-store.ts
│   │   └── house-store.ts
│   │
│   ├── mock/
│   │   ├── billing.ts
│   │   ├── payment.ts
│   │   ├── receipt.ts
│   │   ├── repair.ts
│   │   ├── maintenance.ts
│   │   ├── renovation.ts
│   │   ├── notice.ts
│   │   ├── house.ts
│   │   └── user.ts
│   │
│   ├── config/
│   │   ├── env.ts
│   │   ├── routes.ts
│   │   └── theme.ts
│   └── utils/
│       ├── money.ts
│       ├── date.ts
│       ├── validator.ts
│       ├── storage.ts
│       ├── phone.ts
│       └── file.ts
│
├── admin-web/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.ts
│       ├── router/
│       ├── layouts/
│       │   └── AdminLayout.vue
│       ├── views/
│       │   ├── dashboard/
│       │   ├── repair/
│       │   ├── maintenance/
│       │   ├── renovation/
│       │   ├── notice/
│       │   ├── company/
│       │   ├── billing/
│       │   │   ├── FeeItems.vue
│       │   │   ├── HouseholdRates.vue
│       │   │   ├── BillImport.vue
│       │   │   ├── Bills.vue
│       │   │   ├── Arrears.vue
│       │   │   ├── Payments.vue
│       │   │   └── Receipts.vue
│       │   ├── accounts/
│       │   └── settings/
│       ├── components/
│       │   ├── DataTable/
│       │   ├── SearchBar/
│       │   ├── MoneyInput/
│       │   ├── ImportPreview/
│       │   ├── StatusTag/
│       │   └── FileUploader/
│       ├── services/
│       │   ├── request.ts
│       │   ├── billing.ts
│       │   ├── repair.ts
│       │   ├── maintenance.ts
│       │   └── ...
│       ├── stores/
│       ├── types/
│       └── utils/
│
└── backend-contract/
    ├── api-contract.md
    ├── billing-import-template.md
    └── permissions.md
```

> PC 后台若已有技术栈必须沿用；如果是全新项目，可优先使用 Vue 3 + TypeScript + Vite + Element Plus。不要为了匹配本文档强制改写已有成熟框架。

---

# 2. 分层职责

## pages/views

只处理：

- 页面生命周期。
- 页面数据绑定。
- 调用 service。
- 路由与弹窗。
- 组合组件。

禁止：

- 页面内直接拼 HTTP URL。
- 页面内写支付签名逻辑。
- 页面内写复杂权限判断。
- 页面直接 import Mock 数据。

## services

负责：

- API 封装。
- Token 注入。
- Mock/真实接口切换。
- 统一错误处理。
- 上传文件。
- 支付订单查询。

## models/types

统一数据结构，避免页面用匿名对象散落字段。

---

# 3. 核心数据模型

## 3.1 House

```ts
export interface House {
  id: string
  communityId: string
  communityName: string
  buildingId: string
  buildingName: string
  roomNo: string
  residentCodeMasked?: string
  displayName: string
}
```

## 3.2 FeeItem

```ts
export interface FeeItem {
  id: string
  code: string
  name: string
  description?: string
  defaultAmountFen?: number
  enabled: boolean
  sortOrder: number
}
```

## 3.3 BillItem

```ts
export interface BillItem {
  id: string
  feeItemId: string
  feeItemCode: string
  feeItemName: string
  amountFen: number
  remark?: string
}
```

## 3.4 Bill

```ts
export type BillStatus = 'PENDING' | 'OVERDUE' | 'PAID' | 'CLOSED'

export interface Bill {
  id: string
  billNo: string
  houseId: string
  houseDisplayName: string
  title: string
  billingPeriod: string
  items: BillItem[]
  totalAmountFen: number
  paidAmountFen: number
  dueDate: string
  status: BillStatus
  generatedBy: 'MANUAL' | 'IMPORT' | 'SYSTEM'
  createdAt: string
  paidAt?: string
}
```

> `totalAmountFen` 必须来自服务端；前端可以做显示合计校验，但不能以自己的合计覆盖服务端应缴金额。

## 3.5 PaymentOrder

```ts
export type PaymentStatus =
  | 'CREATED'
  | 'PAYING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CLOSED'
  | 'REFUNDED'

export interface PaymentOrder {
  id: string
  paymentNo: string
  billId: string
  amountFen: number
  status: PaymentStatus
  provider: 'WECHAT'
  providerTransactionId?: string
  createdAt: string
  paidAt?: string
}
```

## 3.6 ReceiptApplication

```ts
export type ReceiptStatus = 'PENDING' | 'ISSUED' | 'REJECTED'

export interface ReceiptApplication {
  id: string
  billId: string
  paymentId: string
  applicantName: string
  phone: string
  title?: string
  remark?: string
  status: ReceiptStatus
  rejectReason?: string
  createdAt: string
}
```

## 3.7 RepairOrder

```ts
export type RepairStatus = 'PENDING' | 'REPAIRING' | 'COMPLETED'

export interface RepairOrder {
  id: string
  orderNo: string
  houseId: string
  houseDisplayName: string
  description: string
  imageUrls: string[]
  contactName: string
  contactPhone: string
  status: RepairStatus
  technicianId?: string
  technicianName?: string
  progressText?: string
  resultText?: string
  completionImages?: string[]
  createdAt: string
  updatedAt: string
}
```

## 3.8 MaintenanceRecord

```ts
export interface MaintenanceRecord {
  id: string
  buildingId: string
  elevatorId: string
  elevatorName: string
  maintenanceDate: string
  title: string
  pdfUrl?: string
  fileSize?: number
  uploaderId: string
  uploaderName: string
  createdAt: string
}
```

---

# 4. 缴费导入数据模型

推荐 Excel/CSV 长表模板：

```text
communityName
buildingName
roomNo
residentCode
billingPeriod
billTitle
feeItemCode
feeItemName
amountYuan
dueDate
remark
```

示例：

```csv
communityName,buildingName,roomNo,residentCode,billingPeriod,billTitle,feeItemCode,feeItemName,amountYuan,dueDate,remark
五山新苑,1栋,101室,H1101,2026-08,2026年8月电梯后期管理费,MAINT,维护保养费,90.00,2026-08-31,
五山新苑,1栋,101室,H1101,2026-08,2026年8月电梯后期管理费,ELECTRIC,电梯相关电费,80.00,2026-08-31,
五山新苑,1栋,102室,H1102,2026-08,2026年8月电梯后期管理费,MAINT,维护保养费,110.00,2026-08-31,
```

聚合键：

```text
community/building/room + billingPeriod + billTitle
```

导入阶段生成 `ImportBatch` 与 `ImportRowResult`，便于预览、追踪和错误报告。

---

# 5. API 建议

## 5.1 登录/房屋

```text
POST /auth/wechat/login
GET  /houses/my
POST /houses/bind
```

## 5.2 业主账单

```text
GET /bills/my
GET /bills/:id
GET /payments/my
GET /payments/:id
```

查询必须验证账单属于当前用户绑定的房屋。

## 5.3 支付

```text
POST /payments/orders
GET  /payments/orders/:id/status
POST /payments/wechat/notify        # 服务端回调，不由前端调用
```

创建支付订单请求只需账单 ID 等必要信息，不应接受前端可随意修改的结算金额作为权威值。

## 5.4 收据

```text
POST /receipts
GET  /receipts/my
GET  /receipts/:id
```

## 5.5 管理员收费

```text
GET    /admin/fee-items
POST   /admin/fee-items
PUT    /admin/fee-items/:id

GET    /admin/household-rates
POST   /admin/household-rates
PUT    /admin/household-rates/:id

POST   /admin/billing-imports/parse
POST   /admin/billing-imports/:batchId/commit
GET    /admin/billing-imports/:batchId

GET    /admin/bills
GET    /admin/bills/:id
PUT    /admin/bills/:id             # 仅允许未支付账单的可编辑字段
POST   /admin/bills/:id/close
POST   /admin/bills/:id/remind
POST   /admin/bills/remind-batch

GET    /admin/payments
GET    /admin/receipts
PUT    /admin/receipts/:id/status
```

## 5.6 报修

```text
POST /repairs
GET  /repairs/my
GET  /repairs/:id

GET  /admin/repairs
POST /admin/repairs/:id/assign

GET  /technician/repairs
GET  /technician/repairs/:id
POST /technician/repairs/:id/accept
POST /technician/repairs/:id/progress
POST /technician/repairs/:id/complete
```

## 5.7 维保

```text
GET  /maintenance-records
GET  /maintenance-records/:id/pdf-url
POST /technician/maintenance-records
POST /admin/maintenance-records
```

业主接口按绑定楼栋过滤。

## 5.8 装修/公告/企业介绍

```text
POST /renovations
GET  /renovations/my
GET  /renovations/:id
GET  /admin/renovations
PUT  /admin/renovations/:id/status

GET  /notices
GET  /notices/:id
POST /notices/:id/read
POST /admin/notices
PUT  /admin/notices/:id
DELETE /admin/notices/:id

GET /config/company-h5
PUT /admin/config/company-h5
```

---

# 6. 支付安全约束

代码层必须做到：

1. 金额用整数分存储。
2. 创建支付订单时从数据库重新读取账单。
3. 校验账单归属、状态、应缴金额。
4. 生成唯一业务支付单号。
5. 支付回调验签和幂等。
6. 数据库事务内更新支付记录与账单状态。
7. 前端 `wx.requestPayment` 成功后再次查询服务端状态。
8. 不在前端保存商户密钥、API v3 key、私钥等秘密。

具体微信支付参数与证书配置以项目接入时的官方规则和后端环境为准。

---

# 7. 权限模型

```ts
export type Role = 'OWNER' | 'TECHNICIAN' | 'ADMIN' | 'SUPER_ADMIN'
```

最小权限：

- OWNER：本人绑定房屋范围。
- TECHNICIAN：被派工单和授权楼栋/电梯。
- ADMIN：运营管理范围。
- SUPER_ADMIN：账号与权限等全局配置。

管理员后台建议 RBAC：

```text
role
permission
role_permission
user_role
```

---

# 8. Mock 机制

```ts
export const USE_MOCK = true
```

页面调用链：

```text
Page/View
↓
service
↓
mock adapter 或 HTTP adapter
```

禁止页面直接 import Mock。

缴费 Mock 必须至少准备：

```text
不同房屋不同金额
待缴
欠费
已缴
多费用明细
导入成功/失败行
支付成功/取消/失败
收据待处理/已开具/已驳回
```

---

# 9. 推荐开发顺序

```text
阶段1  项目骨架、主题、路由、权限
阶段2  房屋绑定、用户/角色
阶段3  业主首页
阶段4  缴费：账单列表/详情/记录/收据 + Mock
阶段5  管理后台缴费：项目/按户标准/Excel导入/台账/催缴/对账/收据
阶段6  接微信支付后端接口
阶段7  报修与师傅工单流程
阶段8  维保 PDF 上传与本栋查询
阶段9  装修登记
阶段10 公告/企业介绍/消息/个人中心
阶段11 三端权限、安全和联调
阶段12 UI 对照 PNG 精修
```

---

# 10. 编码验收底线

- 不硬编码每户收费金额。
- 不用统一金额覆盖按户金额。
- 管理后台可以批量导入收费数据。
- 导入先校验预览，再提交。
- 已缴账单不可任意改金额。
- 前端不能控制最终支付金额。
- 楼栋维保权限后端必须校验。
- 师傅只能处理授权工单/档案。
- 装修押金仍按需求线下办理。
- UI 与最新设计保持同一视觉系统。
