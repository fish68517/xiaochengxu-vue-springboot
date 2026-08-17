# 萌宠生活商城（Local-First development）

当前已实现可本地运行的第一版完整用户演示链路：

- uni-app + Vue 3 + TypeScript + Pinia 的 H5/微信小程序代码；
- 首页、商城、商品详情、免费活动报名、历史开奖结果、确认订单、本地模拟支付、购物车、我的萌宠；
- FastAPI + SQLAlchemy 2 + Alembic 后端；
- Vue 3 + TypeScript + Element Plus 管理后台，覆盖商品 CRUD、活动、订单发货和审计；
- 当前本机 development 已切换到 MySQL 8，连接参数保存在忽略提交的 `backend/.env.local`；
- 所有商品价格和订单金额都由后端计算；抽奖为免费运营活动，支付不发放抽奖资格。

## 一键启动

在 PowerShell 中执行：

```powershell
cd E:\bishe27\wxMiniProgram
powershell -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1
```

访问：

- 商城 H5：<http://127.0.0.1:5173/>
- 管理后台：<http://127.0.0.1:5174/>（本地账号 `admin`，密码 `admin123`）
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
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

前端：

```powershell
cd E:\bishe27\wxMiniProgram\apps\miniprogram
pnpm.cmd dev:h5
```

管理后台：

```powershell
cd E:\bishe27\wxMiniProgram\apps\admin-web
npm run dev
```

## 本地检查

```powershell
cd E:\bishe27\wxMiniProgram\backend
.\.venv\Scripts\python.exe -m ruff check app migrations tests
.\.venv\Scripts\python.exe -m pytest -q

cd E:\bishe27\wxMiniProgram\apps\miniprogram
pnpm.cmd type-check
pnpm.cmd lint
pnpm.cmd build:h5
pnpm.cmd build:mp-weixin

cd E:\bishe27\wxMiniProgram\apps\admin-web
npm run build
```

## development 数据库

当前 development 数据库为本机 MySQL 8 的 `pet_life_dev`。一键启动脚本会先执行
`alembic upgrade head`，再启动 FastAPI 并写入首次运行所需的演示数据。

连接账号使用仅授权 `pet_life_dev` 的本地应用用户，不由程序直接使用 MySQL 管理员账号。
连接密码只保存在已被 `.gitignore` 排除的 `backend/.env.local` 中。

## 本地支付边界

“微信支付（本地模拟）”只在 `APP_ENV=development` 且 `LOCAL_PAYMENT_ENABLED=true` 时可用。它仅把本地订单从 `PENDING_PAYMENT` 更新为 `PAID`，不会调用微信，也不会扣款。正式微信支付必须在完成认证、商户绑定、HTTPS 回调和支付验签后单独接入。
