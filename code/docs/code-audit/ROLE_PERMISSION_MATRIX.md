# 角色权限矩阵

依据：`apps/client/uniCloud-aliyun/cloudfunctions/game-service/lib/auth.cjs:14-148` 与各 service 的对象级检查。`✓` 表示角色矩阵允许；`条件` 表示还需 owner/指派/品牌等校验；`—` 表示拒绝。

| action / 能力 | CUSTOMER | CS | WORKER | ADMIN | 当前代码位置 |
|---|---:|---:|---:|---:|---|
| `miniLogin` | 公开入口 | — | — | — | `auth.cjs:14-20`、`services.cjs:482-494` |
| `authLogin` | — | 公开登录 | — | 公开登录 | `services.cjs:503-505` |
| `workerLogin` | — | — | 公开登录 | — | `services.cjs:509-511` |
| `changePassword` | — | ✓ | ✓ | ✓ | `auth.cjs:63` |
| 商品列表/详情 | 公开 | 公开 | 公开 | 公开 | `auth.cjs:14-20`、`services.cjs:601-614` |
| H5 下单 | H5 token | — | — | — | `auth.cjs:22-24`、`services.cjs:670-744` |
| 我的订单 | 条件：本人 | — | 条件：本人接单 | — | `auth.cjs:71-72`、`services.cjs:837-857` |
| 公开查单 | 订单号+联系方式 | 同左 | 同左 | 同左 | `services.cjs:618-625` |
| 客户异议 | 条件：本人 | — | — | — | `auth.cjs:73`、`services.cjs:860-876` |
| 客服订单列表/详情 | — | 条件：品牌 | — | 条件：品牌 | `auth.cjs:77-81` |
| 录入订单 | — | 条件：品牌 | — | 条件：品牌 | `auth.cjs:80` |
| 抢单池 | — | 条件：品牌 | ✓ | ✓ | `auth.cjs:82` |
| 抢单 | — | — | 条件：状态/本人能力 | — | `auth.cjs:130`、`services.cjs:1054-1071` |
| 指派/改派 | — | 条件：品牌 | — | 条件：品牌 | `auth.cjs:83-84` |
| 接受/拒绝指派 | — | — | 条件：被指派人 | — | `auth.cjs:132-133` |
| 退单 | — | — | 条件：当前 Worker | — | `auth.cjs:131` |
| 完成申请 | — | — | 条件：当前 Worker | — | `auth.cjs:134` |
| 核对/退回/结单/补单 | — | 条件：品牌 | — | 条件：品牌 | `auth.cjs:90-94` |
| 取消/发起退款 | — | ✓ | — | 取消可；普通退款角色矩阵未给 ADMIN | `auth.cjs:86-89` |
| 退款审批 | — | — | — | ✓ | `auth.cjs:88-89` |
| 异议审理/维持 | — | ✓ | — | ✓ | `auth.cjs:95-100`、service 二次判定 |
| 异议退款裁决 | — | service 拒绝 | — | ✓ | `services.cjs:1299-1315` |
| 订单留言 | — | 条件不足 | 条件不足 | 条件不足 | `auth.cjs:128-129`、`services.cjs:1769-1781` |
| Worker 钱包/流水 | — | — | 条件：本人 | 条件：指定 Worker | `auth.cjs:136-137` |
| 申请提现 | — | — | 条件：本人/实名/余额 | — | `auth.cjs:138` |
| 提现审核/出款 | — | — | — | ✓ | `auth.cjs:114-120` |
| Worker 资料 | — | — | 条件：本人 | 审核走 `updateWorker` | `auth.cjs:103,140-141` |
| 员工管理 | — | — | — | ✓ | `auth.cjs:65-69,102-103` |
| 商品管理 | — | — | — | ✓ | `auth.cjs:108-109` |
| 字典/配置 | — | — | — | ✓ | `auth.cjs:110-113` |
| VIP | — | — | — | ✓ | `auth.cjs:105-107` |
| 钱包调账/冻结 | — | — | — | ✓ | `auth.cjs:104,142` |
| 品牌配置 | — | — | — | ✓ | `auth.cjs:145-146` |
| 报表 | — | — | — | ✓ | `auth.cjs:121-127` |

## 扩展角色说明

代码还包含 `SUPER_ADMIN`、`BRAND_ADMIN`、`FINANCE_REVIEWER`、`ARBITRATOR`、`DISPATCHER`。这套模型比测试文档四角色更细，但 TC30 明确要求“只有 ADMIN 可以登录 /admin/”，当前管理端却允许前四类管理角色，故按规则标记 `REQUIREMENT_MISMATCH`，不能以“更合理”为由改判。

## SECURITY_RISK

### 订单留言

角色矩阵允许 WORKER 调用 `sendOrderMessage/listOrderMessages`，但 service 没有要求 `order.workerId === session.userId`。`listOrderMessages` 还未加载订单做品牌校验。该缺口是对象级授权漏洞。

### 报表

报表 action 对品牌/财务角色开放，但 `reportOrders/reportWorkers/reportWithdrawals/reportProfit` 读取全量集合，未按 `brandScopes` 过滤。属于跨品牌数据泄露风险。

## 已验证的正向安全控制

- 客户订单按 `customerId/openid` 隔离：`services.cjs:837-857`。
- Worker 抢单、退单、完成均有主体或状态约束：`services.cjs:1054-1111`。
- 受保护 action 未注册角色矩阵即拒绝：`auth.cjs:237-239`。
- 直接由客户端覆写 `openid/customerId/workerId` 会被拒绝：`auth.cjs:251-258`。
- 所有 42 个生产 schema 都设置客户端 read/create/update/delete 为 false。
