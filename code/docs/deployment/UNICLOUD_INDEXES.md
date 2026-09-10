# uniCloud 数据库索引清单

索引源文件为 `uniCloud-tcb/database/brand-indexes.json`（腾讯云）和 `apps/client/uniCloud-aliyun/database/brand-indexes.json`（阿里云），两份清单保持一致。数据库 schema 负责字段和权限，联合索引、唯一索引由 uniCloud 控制台按下表创建。

## 必须创建

| 集合 | 索引字段 | 类型 | 用途 |
| --- | --- | --- | --- |
| `brands` | `code` | 唯一 | 品牌编码唯一 |
| `brands` | `appId` | 唯一 | 小程序 AppID 唯一 |
| `users` | `phoneBlindIndex` | 稀疏唯一 | 加密手机号盲索引唯一，避免明文索引 |
| `customers` | `openid` | 唯一 | 客户微信身份唯一 |
| `products` | `brandId,status,sort` | 普通联合 | 客户端商品列表 |
| `orders` | `orderNo` | 唯一 | 订单号查询 |
| `orders` | `idempotencyScope,idempotencyKey` | 稀疏唯一联合 | 防重复下单 |
| `orders` | `brandId,status,createdAt(desc)` | 普通联合 | 订单池/后台列表/报表 |
| `payments` | `paymentNo` | 唯一 | 支付单号 |
| `payments` | `brandId,idempotencyKey` | 唯一联合 | 支付请求幂等 |
| `payments` | `providerTransactionId` | 稀疏唯一 | 微信流水防重 |
| `payments` | `orderId,status,createdAt(desc)` | 普通联合 | 订单支付记录 |
| `assignments` | `orderId,createdAt` | 普通联合 | 指派历史 |
| `refunds` | `wechatRefundId` | 稀疏唯一 | 微信退款流水防重 |
| `commission_rules` | `brandId,version` | 唯一联合 | 佣金规则版本 |
| `wallet_transactions` | `brandId,orderId,type` | 普通联合 | 品牌财务报表 |
| `user_brand_roles` | `userId,brandId` | 唯一联合 | 用户品牌授权 |
| `brand_config_versions` | `brandId,version` | 唯一联合 | 品牌配置版本 |
| `audit_logs` | `brandId,action,createdAt(desc)` | 普通联合 | 审计查询 |
| `h5_token_revocations` | `expiresAt` | 普通 | 过期撤销记录清理 |
| `system_nonces` | `expiresAt` | 普通 | 防重放 nonce 清理 |

`orders`、`payments`、`withdrawals`、`refunds` 的 `_id` 由数据库主键保证唯一；表中额外列出需要业务唯一性的订单号、支付单号、微信流水和幂等键。

## 操作步骤

1. 进入 uniCloud Web 控制台的云数据库。
2. 逐集合打开“索引管理”。
3. 按 `brand-indexes.json` 的 `keys` 顺序创建；`-1` 表示倒序。
4. 唯一索引创建失败时先处理重复数据，不要降级成普通索引。
5. 用同一 `orderNo`、幂等键和品牌版本做重复写入测试，确认数据库直接拒绝。

索引属于云空间外部状态；仓库内清单完成不等于云端已创建，发布验收必须保留控制台截图。
