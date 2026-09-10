# 代码差距报告

## P0：必须先修

### GAP-P0-01 订单留言对象级权限缺失

- 关联用例：TC22。
- 证据：`lib/auth.cjs:128-129` 允许 WORKER 调留言接口；`lib/services.cjs:1769-1781` 只校验品牌，`listOrderMessages` 甚至未读取订单并校验参与人。
- 风险：同品牌任意接单人员只要获得 `orderId`，即可读取或发送其他订单留言。
- 修复：发送与读取前统一加载订单；WORKER 必须 `order.workerId === session.userId`，CS/管理角色必须有品牌范围；增加越权自动化测试。

### GAP-P0-02 报表跨品牌泄露

- 关联用例：TC38。
- 证据：`lib/auth.cjs:121-124` 对 BRAND_ADMIN/FINANCE_REVIEWER 放行；`lib/services.cjs:1723-1764` 直接读取全部订单、用户、提现和钱包流水，未调用 `canAccessBrand`。
- 风险：品牌管理员或财务角色可能看到其他品牌订单、人员、提现和利润。
- 修复：所有 report action 必须在仓储查询或返回前按 `brandScopes` 与显式 `brandId` 过滤，并覆盖 `*` 平台管理员场景。

## P1：业务正确性与配置一致性

| 编号 | 关联用例 | 缺口 | 证据 |
|---|---|---|---|
| GAP-P1-01 | TC05、TC27 | `system-runner/package.json` 没有触发器声明，无法从仓库证明定时任务已部署 | `apps/client/uniCloud-aliyun/cloudfunctions/system-runner/package.json:1` |
| GAP-P1-02 | TC13、TC27、TC33 | `poolTimeoutMinutes/assignmentTimeoutMinutes` 可保存，但业务读取 `DEFAULTS` 或订单字段；前端也硬编码 30 分钟 | `services.cjs:50-65,990,1851,1864`；`cs/pool.vue:18-20` |
| GAP-P1-03 | TC29、TC33 | `minWithdrawalFen` 可保存，但 `applyWithdrawal` 未读取该配置，领域默认值控制起提金额 | `services.cjs:1415-1433` |
| ~~GAP-P1-04~~ | TC30 | 已复核：后台内部管理角色合法保留，CUSTOMER/WORKER/CS 不可登录 `/admin/`；不再视为需求偏差 | `admin/login/index.vue` |
| GAP-P1-05 | TC31 | 页面只创建 Worker、只支持实名通过；无创建 CS 与实名驳回入口 | `admin/accounts/index.vue:4,36,74-109` |
| GAP-P1-06 | TC32、TC40 | 生产后端红线词表缺少“博彩、赌博、抽奖返现” | `services.cjs:47`；对照 `admin/src/utils/redline.js:3-6` |
| GAP-P1-07 | TC33、TC34 | 字典无停用/删除/引用保护；VIP 删除前端发 `matchType/matchKey`，后端要求 `vipId` | `services.cjs:1691-1697,1622-1625`；`vips/index.vue:82-86` |
| GAP-P1-08 | 多项 | 42 份 schema 中未见唯一索引声明，关键唯一性依赖应用层查询 | `apps/client/uniCloud-aliyun/database/*.schema.json` |

## P2：交互与提示

- TC01：`getProduct` 没有校验 `status === 'ON'`，已下架商品通过已知 ID 仍可读取。
- TC06：支付成功态有订单号、复制和回小程序，但没有直接“联系客服”按钮并携带订单号。
- TC11：客服待办前端自行聚合，提现只统计 `PENDING_REVIEW`，与后端七态/迁移口径不一致。
- TC23：页面提示“至少 8 位且包含字母和数字”，后端要求 12～128 位且四类中至少三类；首次改密阻断又受严格安全环境开关影响。
- TC24：接单池前端将最大进行中订单数硬编码为 3，且未找到角标实现。

## P3：治理与可维护性

- 为每个 schema 提供索引清单和云控制台导入脚本/截图证据。
- 将 `dashboard` 作为客服待办唯一计数来源，避免页面重复定义状态集合。
- 建立 42 项用例到自动化测试名称的追踪表，当前 192 项测试不能直接等价于 42 项人工验收。
