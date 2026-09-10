# 代码差距报告 V2

## 已关闭的 P0

| 编号 | 结果 | 关键实现 |
|---|---|---|
| GAP-P0-01 | CLOSED | 留言读写先加载订单；Worker 必须为当前接单人，客户必须为订单所有者，后台角色必须通过品牌范围校验 |
| GAP-P0-02 | CLOSED | 订单、人员、提现、钱包流水及对账指标按 `brandScopes` 和显式 `brandId` 过滤；无法可靠归属的数据按 fail-closed 排除 |

当前 `SECURITY_RISK=0`，P0 未发现遗留代码缺口。

## 已关闭的 P1

| 编号 | 结果 | 关键实现或交付物 |
|---|---|---|
| GAP-P1-01 | CODE_CLOSED / MANUAL_GATE | 已形成 `docs/deployment/SYSTEM_RUNNER_TRIGGER.md`，真实触发仍需云控制台验收 |
| GAP-P1-02 | CLOSED | 支付、入池、指派超时读取统一配置，并在订单进入阶段保存时限快照 |
| GAP-P1-03 | CLOSED | `minWithdrawFen` 与 `weeklyWithdrawLimit` 进入提现执行链路 |
| GAP-P1-04 | CLOSED | 保留合法管理角色；客户、客服、接单人员仍不能进入 Admin |
| GAP-P1-05 | CLOSED | Admin 支持 Worker/客服创建、停启用、实名通过和带原因驳回；员工读写增加品牌对象范围 |
| GAP-P1-06 | CLOSED | 红线词移至 `packages/domain/src/redline.js`，两套云函数由领域构建同步；后端覆盖商品、字典、订单备注和留言 |
| GAP-P1-07 | CLOSED | 字典使用软状态，VIP 统一 `vipId` 并软停用 |
| GAP-P1-08 | CODE_CLOSED / MANUAL_GATE | 阿里云、腾讯云均提供 `brand-indexes.json` 和控制台清单；云端创建结果仍需截图留证 |

配置写入还增加了整数与范围校验，未知配置键被忽略，避免无效配置破坏超时、提现和轮询链路。

## 已关闭的 P2

- TC01：公开 `getProduct` 只允许 `ON`，后台使用 `listManagedProducts/getManagedProduct`。
- TC06：支付成功页可携带订单号联系客服。
- TC11：客服待办以服务端 `dashboard` 为唯一统计来源，品牌范围和接单人员数量同样由后端约束。
- TC23：接单端首次改密提示与校验统一为 12～128 位、四类字符至少三类。
- TC24：接单上限和轮询间隔读取 `getRuntimeConfig`；新单增加声音和角标提醒。

## 剩余事项不是本轮代码缺口

- 真实微信 JSAPI/MWEB 支付、支付回调、退款回调、订阅消息。
- 云空间 `system-runner` 定时触发器真实运行。
- 阿里云/腾讯云数据库索引真实创建和重复写入验证。
- H5 域名/CDN、手机微信/Safari/Chrome、电脑 Chrome/Edge 的完整人工回归。
- 云函数资源配额、告警和峰值容量验收。

因此 V2 评级为：`MISSING=0`、`REQUIREMENT_MISMATCH=0`、`SECURITY_RISK=0`；项目仍不能仅凭源码宣称 Production Ready。
