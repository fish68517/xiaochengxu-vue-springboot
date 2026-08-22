# Development 本地运行指南

## 测试账号

| 账号 | 密码 | 角色 | 范围 |
|---|---|---|---|
| `owner_101` | `Owner@123456` | 业主 | 五山新苑 1栋101室 |
| `owner_102` | `Owner@123456` | 业主 | 五山新苑 1栋102室 |
| `technician_01` | `Tech@123456` | 维修师傅 | 已派给自己的工单、授权电梯 |
| `admin_01` | `Admin@123456` | 管理员 | 管理后台 |

这些账号保存在本机 MySQL 的 `users` 表中，密码以 PBKDF2 哈希保存。登录成功后由后端签发 JWT；前端不再发送 `X-Dev-User`，也不能直接切换身份。

## 启动顺序

```powershell
# 1. 后端
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8010

# 2. 管理后台
cd ..\admin-web
npm run dev -- --host 127.0.0.1 --port 5180

# 3. 小程序 H5 验收预览
cd ..\miniprogram
npm run dev:h5 -- --host 127.0.0.1 --port 5181
```

微信开发者工具版本：

```powershell
cd miniprogram
npm run dev:mp-weixin
```

然后用微信开发者工具导入 `miniprogram\dist\dev\mp-weixin`。

## 本地验收数据

- `owner_101`：2026-08 账单 ¥388.00。
- `owner_102`：2026-08 账单 ¥428.00。
- `backend/data/sample_billing_import.csv`：包含 4 行正确数据和 1 行错误数据，用于验证“上传 → 预览 → 错误提示 → 确认入库”。
- 本地缴费使用人工确认闭环：业主提交缴费请求，管理员在管理后台确认到账；`payments` 与 `bills` 在同一事务中更新。
- 报修工单支持 `PENDING → REPAIRING → COMPLETED`。

## 环境切换

三端都提供 `.env.development`、`.env.staging`、`.env.production`。本机 development 固定使用数据库认证、人工缴费、本地文件和数据库 Outbox；生产环境需另外接入微信登录、微信支付和订阅消息。

## 数据库初始化与接口测试

首次迁移或恢复数据库后执行：

```powershell
cd backend
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m app.bootstrap_auth admin_01 Admin@123456
.\.venv\Scripts\python.exe -m app.bootstrap_auth owner_101 Owner@123456
.\.venv\Scripts\python.exe -m app.bootstrap_auth owner_102 Owner@123456
.\.venv\Scripts\python.exe -m app.bootstrap_auth technician_01 Tech@123456
```

接口联调测试会验证管理员、业主和师傅的权限隔离，并执行公告、报修、装修、账单和人工缴费的跨端 MySQL 闭环；测试数据结束后自动清理：

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
```
