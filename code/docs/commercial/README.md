# 商用化实施证据目录

本目录用于保存商用 Batch 的决策、风险和真实环境证据。代码构建通过不等于真实环境通过。

## 当前批次

- 商用 Batch 0：配置契约、发布门禁、决策与风险模板；
- 商用 Batch 1：H5 Hash 路由、token 用途/jti/撤销；
- 商用 Batch 2：系统 action HMAC、时间窗、nonce 防重放及独立 system-runner。

## 证据分层

- `local/`：单元测试、构建和本地 Mock；
- `staging/`：真实 uniCloud、域名、微信、支付与恢复演练；
- `production/`：生产发布审批、备份 ID、回滚包和灰度记录。

真实 Secret、身份证明、支付证书和完整客户数据禁止写入本目录或提交到代码仓库。

