# 萌宠生活商城（Local-First development）

当前已实现小程序、管理后台、FastAPI 与 MySQL 的本地数据闭环：

- uni-app + Vue 3 + TypeScript + Pinia 的 H5/微信小程序代码；
- 数据库账号登录、商品分类、收藏、MySQL 购物车、收货地址、优惠券、订单与活动；
- FastAPI + SQLAlchemy 2 + Alembic 后端；
- Vue 3 + TypeScript + Element Plus 管理后台，覆盖分类、商品、用户、活动、付款、订单发货和审计；
- 当前本机 development 已切换到 MySQL 8，连接参数保存在忽略提交的 `backend/.env.local`；
- 所有金额、库存和数据归属都由后端校验；付款申请写入 MySQL，由管理后台人工确认。

## 一键启动

在 PowerShell 中执行：

```powershell
cd E:\bishe27\wxMiniProgram
powershell -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1
```

访问：

- 商城 H5：<http://127.0.0.1:5173/>（本地账号 `user`，密码 `user123`）
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
`alembic upgrade head`，再启动 FastAPI；服务启动不会自动建表或写入 Seed 数据。

空数据库首次开发时显式初始化本地账号、分类、地址和优惠券：

```powershell
cd E:\bishe27\wxMiniProgram\backend
.\.venv\Scripts\python.exe -m app.cli.init_dev_data
```

该命令只允许在 development 环境运行且可重复执行，不会自动插入商品和活动。

连接账号使用仅授权 `pet_life_dev` 的本地应用用户，不由程序直接使用 MySQL 管理员账号。
连接密码只保存在已被 `.gitignore` 排除的 `backend/.env.local` 中。

## Local-First 付款边界

小程序提交付款申请后会新增 `payments=PENDING` 记录，但不能自行把订单改为已支付。管理员在 5174 的“付款管理”页面确认后，FastAPI 在同一事务中将付款改为 `SUCCESS`、订单改为 `PAID` 并写入审计日志。该流程不会调用微信或真实扣款；正式微信支付需要另行接入。
