# 萌宠生活商城（Local-First development）

当前已实现可本地运行的第一版完整用户演示链路：

- uni-app + Vue 3 + TypeScript + Pinia 的 H5/微信小程序代码；
- 首页、商城、商品详情、免费活动报名、历史开奖结果、确认订单、本地模拟支付、购物车、我的萌宠；
- FastAPI + SQLAlchemy 2 后端；
- development 默认使用项目内 SQLite，避免依赖本机未知的 MySQL 密码；
- `DATABASE_URL` 可直接切换至本机 MySQL 8，生产环境仍按文档使用 MySQL 8；
- 所有商品价格和订单金额都由后端计算；抽奖为免费运营活动，支付不发放抽奖资格。

## 一键启动

在 PowerShell 中执行：

```powershell
cd E:\bishe27\wxMiniProgram
powershell -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1
```

访问：

- 商城 H5：<http://127.0.0.1:5173/>
- 后端健康检查：<http://127.0.0.1:8000/health>
- FastAPI 接口文档：<http://127.0.0.1:8000/docs>

停止服务：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-dev.ps1
```

## 手动启动

后端：

```powershell
cd E:\bishe27\wxMiniProgram\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

前端：

```powershell
cd E:\bishe27\wxMiniProgram\apps\miniprogram
pnpm.cmd dev:h5
```

## 本地检查

```powershell
cd E:\bishe27\wxMiniProgram\backend
.\.venv\Scripts\python.exe -m ruff check app tests
.\.venv\Scripts\python.exe -m pytest -q

cd E:\bishe27\wxMiniProgram\apps\miniprogram
pnpm.cmd type-check
pnpm.cmd lint
pnpm.cmd build:h5
pnpm.cmd build:mp-weixin
```

## development 数据库

默认文件：`backend/data/pet_life_dev.db`。第一次启动自动建表并写入演示商品、用户、报名中活动和已开奖活动。

如需改用 MySQL 8，复制 `backend/.env.example` 为 `backend/.env.local`，修改 `DATABASE_URL`。不要把本地数据库密码提交到代码中。

## 本地支付边界

“微信支付（本地模拟）”只在 `APP_ENV=development` 且 `LOCAL_PAYMENT_ENABLED=true` 时可用。它仅把本地订单从 `PENDING_PAYMENT` 更新为 `PAID`，不会调用微信，也不会扣款。正式微信支付必须在完成认证、商户绑定、HTTPS 回调和支付验签后单独接入。

