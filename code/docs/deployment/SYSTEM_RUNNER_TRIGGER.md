# system-runner 定时触发器部署说明

## 目标

`system-runner` 是唯一的定时入口，不开启 URL 化。它通过独立的 `SCHEDULER_SECRET` 校验调度请求，再以内部 HMAC 调用 `game-service`。业务时限由 `configs` 读取，不在触发器中重复配置。

## 控制台配置

当前 DCloud uniCloud 定时触发器无法由本仓库可靠声明并自动验收，因此保留控制台配置，避免提交一个平台不识别的伪配置。上传 `game-service` 与 `system-runner` 后，在对应云空间为 `system-runner` 建立 3 个定时任务：

| 名称 | Cron 建议 | 事件参数 |
| --- | --- | --- |
| `close-unpaid-orders` | 每分钟一次 | `{"action":"timeoutCloseUnpaidOrders","schedulerSecret":"<SCHEDULER_SECRET>"}` |
| `mark-pool-timeout` | 每分钟一次 | `{"action":"timeoutMarkPool","schedulerSecret":"<SCHEDULER_SECRET>"}` |
| `reject-assignment-timeout` | 每分钟一次 | `{"action":"timeoutRejectAssignments","schedulerSecret":"<SCHEDULER_SECRET>"}` |

`<SCHEDULER_SECRET>` 必须与 `system-runner` 环境变量完全一致，并与 `INTERNAL_SECRET` 使用不同的高强度随机值。不要写入 Git。

## 上线核验

1. 临时把支付、入池、指派超时分别设为 2、3、4 分钟。
2. 分别准备一条待支付、待抢单、指派待确认数据。
3. 等待触发器执行，检查订单状态/超时标记以及 `order_logs`。
4. 恢复商用配置，保存控制台截图和执行日志到验收记录。

本文件是可执行的控制台部署清单；真实触发成功仍属于人工/云端验收项。
