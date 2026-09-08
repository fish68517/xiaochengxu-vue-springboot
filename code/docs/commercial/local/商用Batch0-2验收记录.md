# 商用 Batch 0～2 本地验收记录

> 执行时间：2026-09-06  
> 环境：Windows / 本地 Mock  
> 结论：代码和本地验证通过；真实 staging 未执行。

## 实施内容

- Batch 0：扩展 `.env.example` 和 production 发布门禁，校验前后端环境/API 模式/品牌一致，阻止 demo 品牌、本机 URL、短/复用 Secret、Mock 模式和未审批发布；
- Batch 1：统一 `/#/pages/h5-order/index?token=`，H5 token 增加 purpose、mode、jti、iat、exp 及撤销集合；
- Batch 2：系统 action 改为内部 HMAC，签名绑定 action/payload/时间戳/nonce，落 `system_nonces` 防重放；新增非 URL 化 `system-runner`。

## 自动验证

执行命令：

```powershell
npm run verify:all
```

结果：

| 检查项 | 结果 |
|---|---|
| release-preflight | PASS |
| brand-matrix | PASS |
| lint | PASS |
| domain-sync | PASS |
| tests | PASS（225 项） |
| build-all | PASS |
| api-smoke | PASS |
| ui-smoke | PASS |

机器可读结果：`TestEvidence/verify-summary.json`，生成时间 `2026-09-06T15:37:36.695Z`。

## 已覆盖负向测试

- production 使用 demo 品牌、本机 URL 或短 Secret 被拒绝；
- H5 token 用途错误、结构错误、过期或撤销后被拒绝；
- 系统 action 无内部签名被拒绝；
- 内部签名 payload 被篡改、时间过期或 nonce 重放被拒绝；
- `system-runner` 调度 Secret 错误或 action 不在白名单时被拒绝；
- 微信客服内部签名与 `game-service` 验证契约一致。

## staging 待验收

- 真实域名下的微信内 H5 Hash 路由；
- 发布切换后废止历史无 `purpose/jti` 的 H5 token，由客服重新生成并发送存量未完成订单链接；
- `INTERNAL_SECRET`、`SCHEDULER_SECRET` 的 Secret 管理与轮换；
- `system_nonces`、`h5_token_revocations` schema 和索引；
- `system-runner` 三个定时触发器；
- 微信客服真实事件触发、链接发送和撤销；
- 真实云函数审计日志和重放测试。
