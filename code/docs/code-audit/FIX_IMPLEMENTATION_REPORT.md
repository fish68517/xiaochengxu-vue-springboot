# P0 → P1 → P2 修复实施报告

## 实施结论

已按优先级完成仓库内增量修复，没有推倒重来，没有修改真实支付/OAuth/退款/订阅实现，也没有部署或发布。`ADMIN_SIMPLE_LOGIN=true` 的联调兼容路径保留，后端账号、密码 Hash、角色、会话与 action 授权边界未移除。

## P0

- 订单留言：统一校验订单存在、品牌范围和参与人身份。
- 报表：四类报表、钱包流水、提现、接单人员及对账指标按品牌范围隔离。
- Gate 报告：`docs/code-audit/P0_FIX_REPORT.md`。

## P1

- 配置：支付、入池、指派、接单上限、每周提现、起提金额、补单次数和异议窗口进入执行链路；保存时校验数值范围。
- 定时任务：补充 `docs/deployment/SYSTEM_RUNNER_TRIGGER.md`，并让各 `system-runner` 入口同时兼容函数型 `module.exports` 与 `.main` 调用；真实触发保留人工 Gate。
- 员工：支持 Worker/客服创建、停启用、实名通过/驳回原因，并补员工对象品牌校验。
- VIP/字典：统一 `vipId`，使用软停用；历史引用不执行物理删除。
- 红线：新增领域单一源并生成两套 `domain.cjs`；商品、字典、订单备注、站内留言由后端最终校验。
- 索引：两套云空间目录均提供索引清单，补充手机号盲索引、openid、订单号、支付流水、退款流水和幂等键等关键索引。

## P2

- 商品公开详情只返回上架商品，管理端改走受保护的管理查询。
- H5 支付成功页增加携带订单号的联系客服入口。
- 客服工作台只消费后端 `dashboard` 待办统计。
- 首次改密规则前后端统一。
- 接单池从后端读取最大进行中数量和轮询间隔，并实现新单声音与角标。

## 主要修改范围

- 领域单一源：`packages/domain/src/index.js`、`order-machine.js`、`redline.js`。
- 本地镜像：`packages/backend/src/services.js`、`scripts/api-server.mjs`。
- 生产云函数：阿里云与腾讯云 `game-service/lib/auth.cjs`、`services.cjs`、生成的 `domain.cjs`，以及 `system-runner/index.js`。
- Client：H5 下单支付成功页。
- Workbench：客服首页、接单大厅、接单人员资料与 API。
- Admin：账号、商品、字典、VIP、红线工具与 API。
- 部署材料：`docs/deployment/`、两套 `database/brand-indexes.json`。

用户原有的 `apps/workbench/src/manifest.json` 改动和未跟踪的 HBuilderX/uni_modules 目录不属于本轮修复，未覆盖、未回退。

## 验证结果

| 检查 | 结果 |
|---|---|
| 领域构建 | 两套 `domain.cjs` 生成成功 |
| 领域同步 | 59 个导出及抽样行为一致 |
| JavaScript 语法检查 | 本地服务、两套云服务与鉴权文件通过 |
| 自动化 | `npm test`：255/255 通过 |
| Client H5 | 构建通过 |
| Workbench H5 | 构建通过 |
| Admin H5 | 构建通过 |
| Git diff whitespace | 通过；仅有 Windows 行尾转换提示 |

审计文档写作时记录的旧基线为 192 项；进入修复前仓库实际套件已扩展，本轮 P0 Gate 为 252 项，最终为 255 项。新增数量来自修复期回归用例，不是删除或跳过旧用例。

## 人工验收剩余

- 微信 JSAPI/MWEB、支付回调、退款回调和订阅消息。
- 云端定时触发器与数据库索引真实部署。
- 域名/CDN、手机与电脑浏览器回归。
- 云函数资源配额、监控告警和峰值容量。

以上事项在完成真实环境证据前维持 `MANUAL_TEST_REQUIRED` 或 `BLOCKED_BY_EXTERNAL_SERVICE`。
