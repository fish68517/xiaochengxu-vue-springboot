# 云函数接入说明

## 当前代码状态

- `game-service`：业务单入口，现有 105 个 action；
- `wechat-callback`：微信客服消息回调，验微信签名后生成客服下单链接；
- `system-runner`：定时任务入口，仅允许三个超时任务，不得开启 URL 化；
- `database/*.schema.json`：业务集合 schema，默认禁止客户端直读写；
- 本地镜像位于 `packages/backend` 和 `scripts/api-server.mjs`，只用于开发/Mock。

本地测试和构建通过不代表已部署或真实微信链路通过。真实结果必须保存到 `docs/commercial/staging/`。

## 商用 Batch 0～2 安全边界

1. 普通会话不能调用 `transferNotify`、`timeoutCloseUnpaidOrders`、`timeoutMarkPool`、`timeoutRejectAssignments`；
2. 内部调用使用 `INTERNAL_SECRET` 生成 HMAC，签名绑定 action、payload、时间戳和 nonce；
3. `system_nonces` 保存已使用 nonce，重复请求被拒绝；
4. `system-runner` 先校验 `SCHEDULER_SECRET`，再签名调用 `game-service`；
5. `wechat-callback` 不再把裸 `INTERNAL_SECRET` 发送给 `game-service`；
6. H5 下单链接固定为 `/#/pages/h5-order/index?token=...`；
7. H5 token 包含 `purpose=h5-order`、mode、jti、iat、exp，并支持写入 `h5_token_revocations` 后立即撤销。

## 部署步骤

1. 在 HBuilderX/uniCloud 控制台关联目标腾讯云服务空间；
2. 配置 `.env.example` 中 staging/production 所列服务端 Secret；
3. 运行 `npm run release:preflight -- --environment staging`；
4. 运行 `node scripts/deploy-unicloud.mjs` 上传三个云函数和全部 schema；
5. 只给 `game-service` 配置 `/pay-notify` URL 化，只给 `wechat-callback` 配置微信消息回调 URL；
6. `system-runner` 不开启 URL 化，定时触发参数携带控制台保存的 `schedulerSecret`；
7. 分别为以下 action 配置触发器：`timeoutCloseUnpaidOrders`、`timeoutMarkPool`、`timeoutRejectAssignments`；
8. 按 `database/brand-indexes.json` 建立唯一/联合索引；
9. 在真实 staging 验证签名错误、过期、payload 篡改和 nonce 重放均被拒绝。

示例触发参数仅展示结构，真实 `schedulerSecret` 不得写入仓库：

```json
{
  "action": "timeoutCloseUnpaidOrders",
  "payload": {},
  "schedulerSecret": "由控制台 Secret 注入的真实值"
}
```

## 仍未完成的真实环境事项

- 真实 uniCloud 空间部署和权限验证；
- 正式域名、证书和微信后台绑定；
- 真实微信客服事件、支付和退款证据；
- `system-runner` 定时触发器的控制台配置；
- 数据库索引、备份、恢复和告警的真实环境验收。

