# P0 修复报告

## 修复结论

P0-01 与 P0-02 已完成，完整测试通过。未触碰真实支付、OAuth、退款回调、订阅消息、部署或云端发布。

## P0-01 订单留言对象级权限

- `sendOrderMessage` 与 `listOrderMessages` 均先读取订单并校验品牌范围。
- WORKER 仅能读写 `order.workerId === session.userId` 的订单。
- CS/后台角色受 `brandScopes` 约束；品牌 A 会话不能访问品牌 B 订单。
- SUPER_ADMIN/`brandScopes=['*']` 可执行平台级巡检。
- 本地替身、腾讯云镜像、阿里云生产目录同步实现。

## P0-02 报表品牌隔离

- 四类报表均支持并校验显式 `brandId`。
- 单品牌范围仅返回该品牌，多品牌范围合并授权品牌，`*` 返回平台范围。
- 订单、提现、钱包流水直接按 `brandId` 过滤；缺少直接品牌字段时，仅通过订单、提现、退款或唯一用户品牌关系推导，无法可靠归属的数据在品牌报表中按 fail-closed 排除。
- 接单人员业绩与余额只按可见品牌订单、流水统计。
- 对账指标与主报表共用相同品牌范围。

## 测试证据

- 修复前新增的 3 个 P0 回归用例：`0/3` 通过，证明确实覆盖原缺陷。
- 修复后 P0 本地用例：`3/3` 通过。
- 云函数镜像新增对象权限与报表隔离用例：通过。
- `npm test`：`252/252` 通过，退出码 `0`。

## 文件范围

- `packages/backend/src/services.js`
- `packages/backend/test/p0-security.test.js`
- `apps/client/uniCloud-aliyun/cloudfunctions/game-service/lib/auth.cjs`
- `apps/client/uniCloud-aliyun/cloudfunctions/game-service/lib/services.cjs`
- `uniCloud-tcb/cloudfunctions/game-service/lib/auth.cjs`
- `uniCloud-tcb/cloudfunctions/game-service/lib/services.cjs`
- `uniCloud-tcb/cloudfunctions/game-service/test/game-service.test.cjs`
