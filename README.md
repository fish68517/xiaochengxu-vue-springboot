# 加装电梯后期管理平台

Local-First 单仓库，包含：

- `miniprogram/`：uni-app + Vue 3 + TypeScript + Pinia，业主端和维修师傅端共用工程。
- `admin-web/`：Vue 3 + TypeScript + Vite + Element Plus 管理后台。
- `backend/`：FastAPI + SQLAlchemy + Alembic + MySQL 8。

## Development 默认地址

- 业主/师傅 H5 预览：`http://127.0.0.1:5181`
- 管理后台：`http://127.0.0.1:5180`
- API 与 Swagger：`http://127.0.0.1:8010/docs`

本地使用 `AUTH_MODE=mock`、`PAYMENT_MODE=mock`、`STORAGE_BACKEND=local`、`NOTIFICATION_MODE=mock`。小程序同时支持编译到 `mp-weixin`，H5 仅用于本地快速验收。

详细运行与测试账号见 `DEVELOPMENT.md`。

