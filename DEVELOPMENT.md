# Development 本地运行指南

## 测试账号

| 账号 | 角色 | 范围 |
|---|---|---|
| `owner_101` | 业主 | 五山新苑 1栋101室 |
| `owner_102` | 业主 | 五山新苑 1栋102室 |
| `technician_01` | 维修师傅 | 已派给自己的工单、授权电梯 |
| `admin_01` | 管理员 | 管理后台 |

前端 development 模式默认使用这些 Mock 身份登录，但所有账单、工单、维保、公告等业务数据均来自本地 FastAPI + MySQL。

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
- Mock 支付支持 `success`、`cancel`、`fail`，重复支付成功请求返回幂等结果。
- 报修工单支持 `PENDING → REPAIRING → COMPLETED`。

## 环境切换

三端都提供 `.env.development`、`.env.staging`、`.env.production`。页面不判断环境，统一由配置和后端 Adapter 选择认证、支付、存储和消息实现。
