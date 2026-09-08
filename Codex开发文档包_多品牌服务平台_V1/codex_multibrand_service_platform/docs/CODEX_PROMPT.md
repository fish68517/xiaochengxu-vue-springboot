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
