# 多品牌服务平台 Codex 开发文档（合并版）

本文件用于快速阅读。正式施工时以同目录 7 文件开发包中的 `AGENTS.md` 与 `docs/*.md` 为准。

---

# README

# 多品牌服务平台 — Codex 开发入口

> 项目代号：MultiBrand Service Platform  
> 文档状态：V1 工程施工版  
> 目标：把一期“三端 + uniCloud 后端 + 订单全生命周期 + 资金/仲裁 + 多品牌配置中心”转换成 Codex 可直接执行的工程约束。

## 1. 项目一句话

建设一个多品牌服务平台：一期包含客户微信小程序、客服/接单 Web 工作台、管理后台，三端共用同一套 uniCloud 后端；未来新增品牌/小程序时复用同一份业务代码，仅替换品牌配置、Logo、图片、商品及必要的渠道配置。

## 2. 一期业务范围

- 客户微信小程序
  - 浏览品牌内容与商品
  - 创建订单
  - 通过 `web-view` 进入 H5 支付页
  - 查询订单
  - 发起退款/异议（具体入口与规则待确认）
- 客服/接单 Web 工作台
  - 订单录入/查看
  - 订单池
  - 抢单
  - 指派
  - 服务完成提交
  - 完成核对
  - 结单
- 管理后台
  - 订单管理
  - 佣金结算
  - 退款与追佣
  - 提现审批
  - 异议仲裁
  - 多品牌配置中心
  - 商品/资产配置
  - 用户、角色、权限、审计

## 3. 核心架构原则

### 3.1 一套业务代码，多品牌运行

禁止为每个品牌复制一套前端或后端业务代码。

```text
同一代码仓库
   │
   ├── 品牌 A 小程序 ── BRAND_CODE=A ─┐
   ├── 品牌 B 小程序 ── BRAND_CODE=B ─┤
   └── 品牌 N 小程序 ── BRAND_CODE=N ─┤
                                      ↓
                               Brand Bootstrap
                                      ↓
                           同一个 uniCloud 后端
                                      ↓
                  品牌配置 / 商品 / 订单 / 资金 / 权限
```

品牌差异优先由配置驱动：
- Logo
- 首页图片/Banner
- 主题 Token
- 商品及上下架
- 客服信息
- 品牌文案
- 小程序 AppID 映射
- H5 域名/渠道参数
- 支付渠道引用（敏感参数只能保存在服务端）

### 3.2 所有核心数据必须带品牌边界

订单、商品、支付、佣金、退款、提现、仲裁、角色授权、审计日志等必须具有明确的 `brandId` 归属或可追溯品牌上下文。

### 3.3 服务端是业务真相来源

以下内容不得由前端自行决定：
- 最终支付金额
- 订单合法状态流转
- 抢单/指派资格
- 佣金金额
- 退款金额
- 追佣金额
- 可提现余额
- 提现审批结果
- 仲裁结果
- 用户品牌权限

## 4. 推荐技术基线

以下为本项目 V1 推荐基线；如果现有仓库已确定其他技术栈，优先保持现有技术，不得擅自迁移。

- 客户小程序：`uni-app + Vue 3 + TypeScript`，编译到微信小程序
- H5 支付承载页：`uni-app H5` 或独立 Vue 3 H5（优先复用共享模块）
- 客服/接单工作台：`Vue 3 + TypeScript + Vite`
- 管理后台：`Vue 3 + TypeScript + Vite`
- 状态管理：Pinia
- 后端：uniCloud Cloud Objects / Cloud Functions
- 数据库：uniCloud Database
- 身份认证：优先使用 uni-id 体系；如仓库已有认证方案则保持
- 文件：uniCloud Storage / 对象存储 Adapter
- 支付：Payment Adapter；development 使用 Mock，production 使用真实渠道
- 测试：Vitest + 关键业务服务单测；必要时补 E2E
- 代码规范：ESLint + TypeScript strict

## 5. 文档阅读顺序

Codex 每次开始新开发任务前按以下顺序读取：

1. `AGENTS.md`
2. `docs/需求梳理.md`
3. `docs/interaction.md`
4. `docs/UI_SPEC.md`
5. `docs/PROJECT_STRUCTURE.md`
6. `docs/CODEX_PROMPT.md`
7. `design/` 下现有设计图（当前未提供，后续可补）

需求冲突优先级：

```text
用户最新确认
> docs/需求梳理.md
> docs/interaction.md
> docs/UI_SPEC.md
> design/*
> Codex 默认推断
```

## 6. 当前未确认，禁止自行发明

- 真实品牌名称、品牌数量
- Logo、主题色、Banner、商品图片
- 商品字段全集及商品计价规则
- 服务类目与履约方式
- 佣金比例/阶梯/结算周期
- 退款条件、退款比例、部分退款规则
- 追佣公式和追佣顺序
- 提现最低金额、手续费、到账渠道
- 仲裁时限、证据规则、裁决规则
- 客服、接单人员是否属于同一角色
- 真实支付通道及参数
- 真实短信/消息/订阅通知策略
- 发票、税务、合同规则
- 生产域名、AppID、商户号、密钥

未确认项必须以配置、Mock、`TODO`、`DEMO_ONLY` 处理。

## 7. 快速启动目标

第一阶段不接生产资源，先完成：
- 三端工程可启动
- 品牌 A / 品牌 B Mock 配置可切换
- 两个品牌看到不同 Logo/图片/商品
- 数据请求走统一 Service
- Mock 下单 → Mock H5 支付 → 回写支付成功 → 订单进入待分配
- Web 工作台可抢单/指派
- 管理后台可查看品牌隔离后的订单

## 8. Codex 第一次执行指令

```text
请先不要大范围写代码。

1. 阅读 AGENTS.md 和 docs/ 下全部 Markdown。
2. 检查当前仓库目录、package.json、manifest、uniCloud 目录和现有技术栈。
3. 总结你理解的：
   - 三个端及其用户角色
   - 多品牌配置中心
   - 订单主状态机
   - 支付链路
   - 佣金/退款追佣/提现/仲裁
   - brandId 数据隔离
4. 列出当前资料仍未确认、禁止自行猜测的规则。
5. 列出 Batch 1 准备新增/修改的文件。
6. 只执行 docs/CODEX_PROMPT.md 的 Batch 1。
7. 完成后运行 lint/typecheck/test/build，并输出：
   - 新增文件
   - 修改文件
   - 已完成
   - TODO
   - 测试结果
   - 下一批建议
```


---

# AGENTS

# AGENTS.md — 多品牌服务平台仓库级硬规则

本文件是 Codex 在本仓库内必须遵守的最高级工程约束之一。除非用户有更新确认，否则不得违反。

## 1. 阅读与修改规则

1. 写代码前先阅读 `README.md` 与 `docs/` 全部文档。
2. 不得在未理解现有目录和技术栈前大范围重构。
3. 不得为了“更现代”擅自替换框架、状态管理、后端形态或数据库。
4. 已有可运行代码优先兼容和增量修改。
5. 每个 Batch 必须可独立构建、测试和验收。

## 2. 多品牌硬规则

1. **禁止复制多套业务代码来支持品牌。**
2. 品牌差异必须优先通过 `brandCode/brandId + BrandConfig` 驱动。
3. Logo、Banner、主题、商品、客服信息等不得散落硬编码在页面。
4. 前端不得自行信任 URL/LocalStorage 中的 `brandId` 作为权限依据。
5. 后端每次查询、写入、状态变更都必须验证品牌上下文。
6. 管理员跨品牌访问必须由后端 RBAC 授权。
7. 订单创建后必须保存必要品牌/商品快照，品牌配置后续变化不得篡改历史订单语义。
8. 品牌密钥、支付密钥、AppSecret 等绝不返回客户端。

## 3. 订单硬规则

1. 订单状态只能通过 Domain Service/Cloud Object 中的业务方法转换。
2. 禁止前端直接提交任意目标状态并由后端无条件更新。
3. 每次状态变化必须写入 `order_events` 或等价事件日志。
4. 抢单必须原子化；同一订单不能被两人同时抢到。
5. 指派操作必须检查角色、品牌权限和订单当前状态。
6. 完成、核对、结单应是不同业务动作，不允许 UI 一键跳过全部状态。
7. 状态更新建议使用 `version`/乐观锁或数据库事务，防止并发覆盖。

## 4. 支付与金额硬规则

1. 金额采用整数最小货币单位（例如分）或安全 Decimal 方案，禁止浮点金额运算。
2. 最终应付金额由服务端根据订单快照计算。
3. 客户端传入的 `amount` 只能作为展示/校验信息，不能作为扣款权威值。
4. 支付单必须有独立 `paymentId`、第三方流水号和幂等键。
5. 支付回调必须验签、幂等处理、校验订单/金额/品牌。
6. H5 页面不得保存生产支付密钥。
7. development 默认使用 Mock Payment，禁止误调用生产支付。

## 5. 佣金与追佣硬规则

1. 佣金必须使用账本（ledger）思路，不直接修改“历史已结算数字”。
2. 原始佣金、冻结、可用、提现、退款追佣均应有可审计流水。
3. 退款发生后，追佣通过新增反向流水/reversal 实现，不删除原佣金记录。
4. 佣金规则未确认时必须配置化并标记 `TODO/DEMO_ONLY`，不得猜比例。
5. 任何余额变化都必须可从账本重算或核验。

## 6. 提现硬规则

1. 提现申请必须创建独立记录并冻结相应可用余额。
2. 审批拒绝应释放冻结金额。
3. 审批通过与实际出款若不是同一步，状态必须分开表达。
4. 禁止仅通过前端隐藏按钮实现提现权限。
5. 金额、审批人、审批时间、出款流水必须审计。

## 7. 退款与仲裁硬规则

1. 退款必须引用原订单和原支付记录。
2. 支持退款的具体条件未确认前，不得自行发明业务规则。
3. 仲裁必须保留双方提交内容、证据、处理人、时间和裁决结果。
4. 仲裁结果涉及订单/退款/佣金时，应通过领域服务联动，不得直接在页面改数据库。

## 8. 权限与安全

1. 权限后端强校验，前端菜单仅用于体验控制。
2. 至少支持：客户、客服、接单人员、品牌管理员、财务/审核、仲裁、超级管理员等角色模型；具体合并关系可配置。
3. 敏感信息不得写入前端代码、日志或 Git。
4. 关键操作必须写审计日志：
   - 指派/改派
   - 状态流转
   - 金额调整
   - 退款
   - 追佣
   - 提现审批
   - 仲裁
   - 品牌配置修改
   - 权限修改
5. 所有列表接口必须防越权，必须带后端品牌/用户范围过滤。

## 9. UI 与资源

1. 当前没有正式 UI 图，不得虚构像素级设计。
2. 不得把设计图作为整页背景图实现。
3. 所有品牌资源通过 Brand Asset 层读取。
4. 必须覆盖 loading / empty / error / disabled / success / permission denied 状态。
5. 同一组件不得包含大量 `if (brandA) ... else if (brandB)`。

## 10. 环境

必须至少区分：
- development
- staging
- production

要求：
- 同一份业务代码
- 环境变量/Adapter 切换
- development 可 Mock 支付、消息、第三方服务
- 不得复制 production 代码形成第二套系统

## 11. Codex 输出规范

每个 Batch 完成后固定汇报：

```text
Batch:
新增文件:
修改文件:
完成内容:
未完成 TODO:
lint:
typecheck:
unit test:
build:
风险/需确认:
下一批:
```


---

# 需求梳理

# 需求梳理.md — 多品牌服务平台

## 1. 需求来源与已确认事实

一期已确认：
- 三个端：
  1. 客户微信小程序
  2. 客服/接单 Web 工作台
  3. 管理后台
- 三端共用同一个 uniCloud 后端。
- 客户在小程序下单，经 `web-view` 跳转 H5 完成支付。
- 业务包含订单全生命周期：
  - 下单
  - 支付
  - 录入
  - 抢单/指派
  - 完成核对
  - 结单
- 资金/治理能力：
  - 佣金结算
  - 退款追佣
  - 提现审批
  - 异议仲裁
- 核心拓展：
  - 多品牌配置中心
  - 后续拓展多个小程序
  - 同一前端，不同 Logo / 图片 / 商品等资产

## 2. 产品目标

### 2.1 一期目标

完成从客户下单到订单履约、结单、佣金、售后、提现、仲裁的完整业务闭环。

### 2.2 扩展目标

新增品牌时不复制业务代码，通过新增品牌配置和渠道配置完成新小程序上线。

```text
业务代码 = 稳定
品牌资产 = 可替换
商品目录 = 可配置
渠道参数 = 可配置
权限范围 = 可配置
```

## 3. 用户角色

> 以下角色拆分属于工程模型。客服与接单人员最终是否合并为一个账号角色，待业务确认。

| 角色 | 主要端 | 核心能力 |
|---|---|---|
| CUSTOMER | 微信小程序 | 浏览、下单、支付、查看订单、售后/异议 |
| CUSTOMER_SERVICE | Web 工作台 | 订单录入、查询、客户协助 |
| ORDER_TAKER | Web 工作台 | 订单池、抢单、履约、完成提交 |
| DISPATCHER | Web/管理后台 | 指派、改派、处理异常订单 |
| BRAND_ADMIN | 管理后台 | 本品牌商品、资产、订单、人员配置 |
| FINANCE_REVIEWER | 管理后台 | 退款、佣金、提现相关审核 |
| ARBITRATOR | 管理后台 | 异议处理与裁决 |
| SUPER_ADMIN | 管理后台 | 跨品牌配置、角色与系统级配置 |

## 4. 核心领域

```text
Brand
├── BrandConfig
├── BrandAsset
├── BrandChannel
└── Product

Customer
└── Order
    ├── Payment
    ├── Assignment
    ├── Service/Completion
    ├── OrderEvent
    ├── Refund
    ├── CommissionLedger
    └── Dispute

Worker/Staff
├── Role
├── BrandScope
├── CommissionAccount
└── Withdrawal
```

## 5. 多品牌配置中心

### 5.1 核心目标

同一套前端和后端服务多个品牌，品牌差异由配置中心提供。

### 5.2 Brand 基础字段建议

```ts
Brand {
  id
  code
  name
  status
  appIdRef
  themeConfig
  assetConfig
  contactConfig
  legalConfig
  createdAt
  updatedAt
  version
}
```

注意：
- `appIdRef` 是服务端引用，不等于把 AppSecret 暴露给前端。
- 支付密钥、AppSecret 等应放在服务端 Secret/安全配置，不放普通品牌文档中。

### 5.3 可配置资产

- Logo
- 启动/首页品牌图
- Banner
- 默认商品图
- 客服二维码/联系方式
- 分享图
- 主题 Token
  - primaryColor
  - secondaryColor
  - borderRadius
  - textColor
  - backgroundColor

当前没有 UI 设计，不锁死具体视觉值。

### 5.4 商品隔离

商品至少按 `brandId` 归属：
- 品牌 A 只返回 A 商品
- 品牌 B 只返回 B 商品
- 超级管理员可跨品牌
- 历史订单保存商品快照，商品改名/改价后历史订单不被覆盖

### 5.5 小程序启动识别

推荐：

```text
小程序构建时写入 BRAND_CODE
        ↓
App 启动
        ↓
brand.getBootstrap(BRAND_CODE)
        ↓
服务端校验 BRAND_CODE / AppID 映射
        ↓
返回公开品牌配置 + 主题 + 资产
        ↓
初始化页面
```

禁止仅通过用户可任意修改的 query 参数决定品牌权限。

## 6. 客户微信小程序

### 6.1 首页/商品

入口：打开小程序。

展示：
- 当前品牌 Logo
- Banner
- 商品
- 活动/服务入口（若后续提供）

操作：
- 查看商品
- 进入商品详情
- 创建订单

数据来源：
- `brand.getBootstrap`
- `product.list`

### 6.2 创建订单

输入字段目前未提供，必须按商品/服务类型配置，不得猜。

基础流程：

```text
选择商品/服务
→ 填写订单信息
→ 前端格式校验
→ order.create
→ 服务端生成订单快照与应付金额
→ 返回 orderId + paymentSession
```

### 6.3 H5 支付

已确认产品流：

```text
小程序订单
→ web-view
→ H5 支付页
→ 支付渠道
→ 服务端支付回调
→ 更新 Payment
→ 合法推进 Order
→ 小程序查询最终状态
```

要求：
- 小程序不得仅依赖 H5 URL 返回参数判定“已支付”。
- 最终支付成功状态由服务端支付结果决定。

### 6.4 订单查询

客户只能读取自己的订单，且品牌必须一致。

## 7. 客服/接单 Web 工作台

### 7.1 订单列表

过滤建议：
- 品牌（仅有授权时显示）
- 订单号
- 手机号/客户标识
- 状态
- 创建时间
- 接单人
- 支付状态

### 7.2 订单录入

“录入”的具体业务含义当前未定义。

工程处理：
- 建立 `order.record/intake` 能力占位；
- 表单字段配置化；
- 不把截图或示例字段视为正式规则；
- 待业务确认后再冻结字段。

### 7.3 抢单

基本约束：
- 仅处于可抢状态的订单可抢；
- 仅具备对应品牌/业务权限人员可抢；
- 后端原子校验；
- 抢单成功写 Assignment + OrderEvent；
- 并发抢单只有一个成功。

### 7.4 指派/改派

- 调度/管理员可指派；
- 检查被指派人品牌权限；
- 改派保留历史；
- 必须审计。

### 7.5 完成 → 核对 → 结单

三个动作分离：
1. 接单人员提交完成结果；
2. 有权限人员核对；
3. 满足结单条件后结单。

具体核对字段/结单条件待确认。

## 8. 订单状态机

### 8.1 已确认业务节点

```text
下单 → 支付 → 录入 → 抢单/指派 → 完成核对 → 结单
```

### 8.2 V1 推荐工程状态

> 这是工程建议，不是原始需求逐字定义。若业务后续给出正式状态，以正式状态替换。

```text
PENDING_PAYMENT
    ↓ 支付确认
PAID
    ↓ 进入受理/录入
READY_FOR_ASSIGNMENT
    ├─ 抢单
    └─ 指派
        ↓
ASSIGNED
    ↓ 开始履约
IN_SERVICE
    ↓ 提交完成
PENDING_VERIFY
    ↓ 核对通过
VERIFIED
    ↓ 结单
CLOSED
```

旁路状态建议：
- CANCELLED
- REFUND_PENDING
- PARTIALLY_REFUNDED（仅当业务确认支持部分退款）
- REFUNDED
- DISPUTED

禁止 Codex 自行增加业务跳转。

## 9. 佣金结算

已确认：系统包含佣金结算。

规则未确认：
- 佣金对象
- 比例
- 阶梯
- 生效节点
- 冻结期
- 税费
- 结算周期

推荐账本事件：
- COMMISSION_ACCRUED
- COMMISSION_FROZEN
- COMMISSION_AVAILABLE
- WITHDRAWAL_FROZEN
- WITHDRAWAL_RELEASED
- WITHDRAWAL_PAID
- REFUND_CLAWBACK

所有比例/公式配置化。

## 10. 退款与追佣

已确认：系统包含退款追佣。

推荐链路：

```text
退款申请
→ 审核/渠道退款
→ Refund 成功
→ 计算受影响佣金
→ 新增 REFUND_CLAWBACK 反向账本
→ 更新可用/冻结余额
→ 写审计
```

禁止删除历史佣金流水来“回滚”。

## 11. 提现审批

已确认：系统包含提现审批。

推荐状态：

```text
SUBMITTED
→ REVIEWING
├─ REJECTED
└─ APPROVED
    → PAYING
    ├─ PAY_FAILED
    └─ PAID
```

如果一期审批通过即视为支付完成，可在业务确认后简化，Codex 不自行简化。

## 12. 异议仲裁

已确认：系统包含异议仲裁。

建议模型：
- disputeId
- brandId
- orderId
- creatorId
- reasonCode
- description
- evidence[]
- respondentContent
- arbitratorId
- decision
- decisionNote
- status
- timestamps

建议状态：

```text
OPEN
→ EVIDENCE_COLLECTION
→ UNDER_REVIEW
→ DECIDED
→ CLOSED
```

裁决规则、SLA、证据时限待确认。

## 13. 管理后台

一期模块：
- Dashboard（统计口径待定义）
- 品牌管理
- 品牌资产管理
- 商品管理
- 订单管理
- 人员/角色/品牌权限
- 佣金账本
- 退款与追佣
- 提现审批
- 异议仲裁
- 审计日志
- 系统配置

## 14. 明确不做/暂不承诺

当前资料不足，不在 V1 文档中默认承诺：
- 自动智能派单算法
- 动态定价算法
- 复杂 CRM
- ERP
- 财务总账/税务系统
- 发票系统
- 多币种
- 海外支付
- AI 客服
- 自定义工作流引擎

如果后续需要，作为独立迭代进入需求。

## 15. V1 验收闭环

### 闭环 A：多品牌

```text
Brand A 启动 → A Logo/A 商品
Brand B 启动 → B Logo/B 商品
同一业务组件
同一后端
数据互不可越权读取
```

### 闭环 B：订单

```text
客户下单
→ Mock H5 支付
→ 支付确认
→ 工作台订单池
→ 抢单/指派
→ 完成
→ 核对
→ 结单
```

### 闭环 C：资金

```text
结单
→ 生成佣金账本
→ 退款
→ 生成追佣反向流水
→ 提现申请
→ 管理员审批
```

### 闭环 D：治理

```text
订单产生异议
→ 提交证据
→ 仲裁处理
→ 结果审计
```


---

# UI SPEC

# UI_SPEC.md — 三端页面与多品牌 UI 工程规范

> 当前未提供正式 UI 图。本文件只冻结页面结构、组件职责和品牌化规则，不虚构像素级视觉值。

## 1. 全局 UI 原则

1. 品牌视觉来自 `BrandTheme` 和 `BrandAsset`。
2. 页面不得硬编码品牌 Logo、品牌名、Banner、商品图。
3. 页面不得大量出现 `if (brandCode === 'xxx')`。
4. 所有异步页面必须提供：
   - loading
   - empty
   - error
   - retry
   - permission denied
5. 金额展示使用统一 Money 组件/formatMoney。
6. 订单状态统一使用 OrderStatusTag 映射。
7. 危险操作必须二次确认。

## 2. Design Tokens

```ts
type BrandTheme = {
  primaryColor: string
  secondaryColor?: string
  backgroundColor?: string
  textPrimary?: string
  textSecondary?: string
  borderColor?: string
  borderRadius?: number
}
```

当前值均由品牌配置返回，不能在本文档写死。

## 3. 客户微信小程序页面

### MP-01 品牌启动页

职责：
- 读取构建态 `BRAND_CODE`
- 请求 Brand Bootstrap
- 应用主题
- 失败时展示品牌加载失败，不进入业务页面

状态：
- loading
- success
- unknown brand
- disabled brand
- network error

### MP-02 首页

区域：
1. 品牌 Header：Logo / 品牌名
2. Banner
3. 商品/服务分类（如有）
4. 商品卡片列表
5. 我的订单入口

组件：
- BrandHeader
- BrandBanner
- ProductCard
- EmptyState

### MP-03 商品列表

字段：
- 商品图
- 名称
- 简介
- 展示价
- 状态

禁止：
- 前端依据展示价直接生成最终支付金额

### MP-04 商品详情

展示：
- 品牌资产
- 商品图
- 商品名称
- 说明
- 价格展示
- 下单所需字段（由配置/业务定义）

底部：
- 立即下单

### MP-05 确认订单

展示：
- 商品快照
- 服务信息
- 客户输入
- 服务端返回的价格明细
- 最终应付金额

按钮：
- 提交订单

状态：
- form invalid
- submitting
- duplicate submit
- create failed
- created

### MP-06 H5 支付承载页 / Bridge

用途：
- 小程序 `web-view` 打开 H5 支付地址
- 展示订单号、金额、支付状态
- 调用 Payment Adapter

必须有：
- 支付初始化失败
- 支付处理中
- 支付成功
- 支付失败
- 支付结果未知 → 主动查询服务端

禁止：
- 仅凭前端回调直接把订单设为已支付

### MP-07 我的订单

Tabs/筛选可按状态配置：
- 全部
- 待支付
- 待服务
- 服务中
- 待核对/完成
- 已结单
- 售后/异议

### MP-08 订单详情

展示：
- 订单号
- 品牌
- 商品快照
- 金额
- 支付状态
- 订单状态
- 服务人员
- 时间轴
- 售后/异议入口（权限/状态允许时）

## 4. 客服/接单 Web 工作台

### WORK-01 登录

- 账号登录
- 获取角色与品牌范围
- 登录后路由由后端权限决定

### WORK-02 工作台首页

卡片：
- 待录入
- 待分配
- 可抢单
- 我的进行中
- 待核对
- 今日完成

统计口径由后端提供，不硬编码。

### WORK-03 订单池

表格字段建议：
- 订单号
- 品牌
- 商品/服务
- 客户摘要
- 支付状态
- 订单状态
- 创建时间
- 当前接单人
- 操作

操作：
- 查看
- 抢单
- 指派（有权限）
- 录入/补录（规则确认后）

### WORK-04 我的订单

- 进行中
- 待提交完成
- 历史完成

### WORK-05 订单处理页

区块：
1. 基本信息
2. 客户信息
3. 商品/服务快照
4. 支付信息
5. 分派信息
6. 履约记录
7. 订单事件时间轴
8. 操作区

操作按后端返回的 `allowedActions` 渲染，前端不可自行推断全部权限。

### WORK-06 完成提交

字段待业务确认。
至少支持：
- 结果说明
- 附件/图片（如果业务启用）
- 提交完成

### WORK-07 核对

- 查看完成结果
- 核对通过/退回
- 原因
- 审计信息

具体规则待确认。

## 5. 管理后台

### ADMIN-01 Dashboard

只展示后端聚合结果。
建议：
- 订单量
- 支付金额
- 待处理订单
- 退款
- 待提现审批
- 待仲裁
- 品牌分布

统计定义待确认。

### ADMIN-02 品牌列表

字段：
- 品牌名称
- code
- 状态
- AppID 引用
- 商品数
- 更新时间

操作：
- 新增
- 编辑
- 启用/停用
- 进入品牌配置

### ADMIN-03 品牌配置

Tab：
1. 基本信息
2. 主题
3. Logo/Banner/资产
4. 商品
5. 客服信息
6. 小程序渠道
7. 支付渠道引用
8. 法务/协议
9. 发布版本

敏感字段以掩码/引用显示。

### ADMIN-04 商品管理

- 品牌筛选
- 商品增删改查
- 上下架
- 排序
- 资产关联

### ADMIN-05 订单管理

- 多条件检索
- 查看详情
- 指派/改派
- 异常操作
- 查看事件日志

### ADMIN-06 佣金账本

字段：
- 人员
- 品牌
- 订单
- 流水类型
- 方向
- 金额
- 余额影响
- 状态
- 时间

禁止直接编辑历史账本。

### ADMIN-07 退款/追佣

- 退款申请
- 原支付
- 退款金额
- 退款状态
- 关联追佣流水
- 审计

### ADMIN-08 提现审批

- 申请人
- 可用余额
- 申请金额
- 冻结金额
- 状态
- 审批
- 出款信息

### ADMIN-09 异议仲裁

- 订单
- 双方内容
- 证据
- 时间线
- 裁决
- 结果影响
- 审计

### ADMIN-10 用户/角色/品牌权限

- 用户
- 角色
- 可访问品牌
- 状态
- 权限矩阵

### ADMIN-11 审计日志

检索：
- 操作人
- 品牌
- 业务对象
- 动作
- 时间
- requestId

## 6. 品牌切换规则

### 客户小程序

不提供随意品牌切换。品牌由当前小程序 AppID/构建配置决定。

### Web 工作台/后台

仅当用户拥有多个品牌权限时显示 Brand Switcher。

切换后：
- 清理上一品牌列表缓存
- 所有请求重新获取
- 不允许把前端 brandId 当最终授权依据

## 7. 响应式

Web 最低要求：
- 1366×768 可完整使用
- 1920×1080 正常布局
- 表格支持横向滚动
- Drawer/Modal 避免超屏

具体设计规范在 UI 图提供后补充。


---

# Interaction

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


---

# Project Structure

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


---

# Codex Prompt

# CODEX_PROMPT.md — 多品牌服务平台施工总控

## 0. 你的角色

你是本项目的工程实现 Agent。目标不是“一次性生成整个项目”，而是根据本文件按 Batch 小步施工，每批都能运行、测试、验收。

## 1. 资料优先级

发生冲突时严格按：

```text
1. 用户最新确认
2. docs/需求梳理.md
3. docs/interaction.md
4. docs/UI_SPEC.md
5. design/*
6. 现有实现（若与最新确认冲突则最小化迁移）
7. 你的默认推断
```

若规则缺失，不得静默猜测。

处理方式：
- 配置化
- Mock
- TODO
- `DEMO_ONLY`
- 报告“需业务确认”

## 2. 固定产品边界

一期必须围绕：

1. 客户微信小程序
2. H5 支付承载
3. 客服/接单 Web 工作台
4. 管理后台
5. 共用 uniCloud 后端
6. 订单全生命周期
7. 佣金结算
8. 退款追佣
9. 提现审批
10. 异议仲裁
11. 多品牌配置中心

核心扩展能力：

> 同一套前端业务代码，通过品牌配置、资产、商品和渠道配置支撑多个品牌/多个小程序。

## 3. 推荐技术栈

如果仓库为空，使用：
- miniapp: uni-app + Vue3 + TypeScript
- payment-h5: uni-app H5 或 Vue3 + TypeScript
- workbench/admin: Vue3 + TypeScript + Vite
- state: Pinia
- backend: uniCloud Cloud Objects / Functions
- db: uniCloud Database
- auth: uni-id compatible
- tests: Vitest
- lint: ESLint

如果仓库已有不同但可运行的等价技术：
- 不擅自迁移；
- 先报告差异；
- 优先遵循现有项目。

## 4. Local-First

development 必须能在不接生产资源的前提下完成主闭环：

```text
Brand Mock
+ Product Mock
+ Mock Payment
+ Mock Message
+ Dev uniCloud / Mock Adapter
=
完整演示闭环
```

真实支付、生产 AppID、商户号、密钥进入后续 staging/production。

## 5. 业务硬规则

### 5.1 多品牌

- `brandId` 是一级数据边界。
- 关键业务 Collection 必须可追溯 `brandId`。
- 禁止每品牌复制一份页面/服务/云函数。
- 品牌差异通过 BrandConfig/Asset/Product/Channel。
- 后端验证品牌权限。
- 客户小程序品牌由构建/渠道上下文确定，不允许用户随意跨品牌。

### 5.2 订单

- 状态流转必须通过 Order Domain Service。
- 抢单必须原子化。
- 指派/改派必须保留历史。
- 完成、核对、结单分开。
- 所有关键动作写 OrderEvent/Audit。

### 5.3 支付

- 服务端计算最终金额。
- 支付回调验签、金额校验、品牌校验、幂等。
- 前端回调不等于最终支付成功。
- Mock 与 Real Payment 使用 Adapter。

### 5.4 佣金/退款/提现

- 使用账本，不覆盖历史。
- 退款追佣新增反向流水。
- 提现申请冻结余额，拒绝释放。
- 规则未确认前配置化，不发明比例。

### 5.5 权限

- 后端 RBAC 强校验。
- 前端菜单隐藏不是安全边界。
- 跨品牌读取属于安全缺陷，测试必须覆盖。

## 6. 编码约束

1. TypeScript strict。
2. 业务类型统一放共享 package。
3. 页面不直接访问 DB。
4. 页面不直接计算佣金/退款/最终金额。
5. API/Cloud Object 返回统一：
   - requestId
   - code
   - message
   - data
6. 关键写操作支持幂等。
7. 金额禁止浮点。
8. 日期统一存 UTC/标准时间，展示时本地化。
9. 写操作记录 operator 与 requestId。
10. 错误必须可区分权限、状态冲突、业务校验和系统异常。

## 7. Batch 施工顺序

### Batch 0：仓库审计

先做，不大改代码。

输出：
- 当前目录
- 技术栈
- 可运行状态
- 与本文档差异
- 风险
- 计划新增/修改文件

### Batch 1：工程骨架 + 品牌运行时

目标：
- 三端/四应用骨架可启动
- shared packages
- BrandContext/BrandStore
- Mock Adapter
- demo-a/demo-b 两品牌
- 环境变量
- lint/typecheck/test/build 基线

验收：
- demo-a 显示 A Logo/主题
- demo-b 显示 B Logo/主题
- 不复制业务页面

### Batch 2：多品牌配置中心基础

目标：
- brands
- brand_config_versions
- brand assets
- Brand Cloud Object
- bootstrap
- 后台品牌列表/编辑
- 品牌发布/版本（可先简化）
- demo 数据

验收：
- 后台修改 demo 品牌资产
- 客户端重新 bootstrap 可更新
- A/B 配置隔离

### Batch 3：商品与客户下单

目标：
- products
- 商品列表/详情
- 订单创建
- 商品/品牌快照
- 服务端金额
- 我的订单

验收：
- A 只能看到 A 商品
- B 只能看到 B 商品
- 下单生成 brandId 与快照

### Batch 4：H5 Mock 支付

目标：
- payment-h5
- payment session
- Mock Payment Adapter
- 支付回调/模拟回调
- 幂等
- 支付后推进订单

验收：
- 小程序下单 → web-view/H5 → Mock 支付成功 → 小程序查询已支付
- 重复回调不重复入账

### Batch 5：工作台 + 订单状态机

目标：
- 订单池
- 抢单
- 指派/改派
- 我的订单
- 开始履约
- 提交完成
- 核对
- 结单
- OrderEvent

验收：
- 两人并发抢单只有一个成功
- 非法状态跳转返回 409/业务错误
- 所有状态变化可审计

### Batch 6：佣金账本

目标：
- commission_rules 占位
- ledger
- 结单生成佣金
- 冻结/可用状态
- 余额查询

规则：
- 比例用 Demo 配置，并标记 `DEMO_ONLY`
- 不写死正式比例

验收：
- 结单后出现可追溯账本
- 改规则不覆盖历史账本

### Batch 7：退款 + 追佣

目标：
- refund
- Mock Refund Adapter
- 退款成功
- clawback 反向账本
- 管理后台退款页

验收：
- 原佣金保留
- 新增追佣流水
- 重复退款被拦截

### Batch 8：提现审批

目标：
- withdrawal
- 冻结/释放
- 审批
- Mock 出款
- 审计

验收：
- 余额不足不能申请
- 拒绝后金额释放
- 成功出款有流水

### Batch 9：异议仲裁

目标：
- dispute
- 证据
- 受理
- 裁决
- 审计
- 与退款/订单/佣金通过领域服务联动

验收：
- 仲裁人员不能绕过领域服务直接改账本

### Batch 10：RBAC + 跨品牌安全

目标：
- user_brand_roles
- permission middleware
- 菜单权限
- 后端资源权限
- 越权测试
- audit logs 完善

验收：
- A 品牌人员请求 B 订单返回 403/404（按安全策略）
- SUPER_ADMIN 明确授权后可跨品牌

### Batch 11：真实渠道 staging

前提：
- 用户提供真实渠道资料
- 明确支付/退款接口
- 明确小程序/H5 域名与平台配置

目标：
- Real Payment Adapter
- Real Refund Adapter
- staging
- 回调验签
- 真实联调

禁止：
- 没有真实参数时自行填假密钥
- development 直接使用生产商户

### Batch 12：生产发布

前提：
- staging 核心闭环全部通过
- 权限测试通过
- 资金一致性测试通过
- 品牌构建矩阵通过
- 备份/回滚方案明确

输出：
- production 配置清单
- brand build matrix
- migration/seed
- smoke test
- rollback
- release note

## 8. 每批测试要求

至少运行项目存在的：
- lint
- typecheck
- unit test
- build

涉及核心领域时增加：
- 状态机测试
- 并发测试
- 幂等测试
- 品牌隔离测试
- 金额/账本一致性测试

测试失败不得写“完成”。

## 9. 首批必须准备的 Demo 数据

仅用于 development，必须标 `DEMO_ONLY`：

```text
Brand demo-a
- Logo A
- Banner A
- Product A1/A2

Brand demo-b
- Logo B
- Banner B
- Product B1/B2

Users
- customer-a
- worker-a
- admin-a
- customer-b
- worker-b
- admin-b
- super-admin
```

不要使用真实品牌、真实手机号、真实商户号。

## 10. Definition of Done

一个功能只有同时满足以下条件才算完成：

- 代码实现
- 类型定义
- 权限校验
- loading/error/empty 状态
- 核心异常路径
- 测试
- build 通过
- 文档/TODO 更新
- 不破坏另一品牌
- 不破坏已有业务

## 11. 第一次真正执行

执行顺序：

```text
1. 仓库审计
2. 输出差异
3. 执行 Batch 1
4. 测试
5. 汇报
6. 停止
```

不要在第一次执行时自动连续做完 Batch 2~12。
