# 数据替换成 MySQL 修改方案

## 1. 方案目标

本方案用于完成以下两项工作：

1. 清理当前项目中的演示种子数据、Mock 身份、Mock 支付和 Mock 通知等开发占位逻辑，业务数据统一通过 FastAPI 读写本机 MySQL 8.0.36。
2. 完成小程序、维修师傅端和后台管理网站的接口联调，形成“前端操作 → FastAPI 接口 → MySQL 写入 → 另一端查询到结果”的完整闭环。

本阶段先输出修改方案，不在本次操作中删除数据库数据或修改正在运行的腾讯云环境。

## 2. 当前项目真实状态

### 2.1 已确认的本机 MySQL

本机已实际连接并验证：

```text
MySQL：8.0.36 Community Server
地址：127.0.0.1:3306
开发账号：root
开发密码：root
项目数据库：elevator_service
Alembic版本：508aac2de30d
```

本机开发配置 `backend/.env.development` 已经指向：

```text
mysql+pymysql://root:root@127.0.0.1:3306/elevator_service?charset=utf8mb4
```

说明：`root/root` 只允许用于本机 development。腾讯云生产环境必须继续使用部署脚本创建的 `elevator_app` 独立账号和随机密码，不能把生产数据库改成 `root/root`，也不能把本机 3306 暴露到公网。

### 2.2 当前业务数据已经来自 MySQL

当前小程序和管理后台并不是直接读取前端 JSON 假数据。账单、报修、维保、公告等接口已经通过 SQLAlchemy 访问 `elevator_service` 数据库。

当前数据库表的实际 `COUNT(*)` 结果如下（检查时间：2026-08-20）：

| 表 | 当前记录数 | 作用 |
|---|---:|---|
| `buildings` | 2 | 楼栋 |
| `houses` | 3 | 房屋和住户编码 |
| `users` | 4 | 业主、师傅、管理员 |
| `fee_items` | 9 | 收费项目 |
| `bills` | 6 | 按户账单 |
| `bill_items` | 33 | 账单明细 |
| `payments` | 4 | 缴费记录 |
| `receipts` | 2 | 收据申请 |
| `repair_orders` | 4 | 报修工单 |
| `maintenance_records` | 3 | 维保档案 |
| `notices` | 3 | 公告 |
| `renovations` | 1 | 装修登记 |
| `notification_outbox` | 12 | 消息发送队列记录 |
| `import_batches` | 1 | 账单导入批次 |

### 2.3 当前 MySQL 中仍然是演示数据

本机 `elevator_service` 中检查到的内容与 `backend/app/seed.py` 一致，例如：

```text
小区：五山新苑
房屋：101室、102室、201室
用户：owner_101、owner_102、technician_01、admin_01
账单：BILL-101-202608、BILL-102-202608
```

所以，“改成 MySQL”本身不能自动得到真实业务数据。当前数据虽然存储在 MySQL 中，但数据来源仍然是演示种子和此前联调记录。

实施前必须准备真正要导入的楼栋、房屋、业主、维修师傅、收费项目和账单资料。如果目前还没有真实资料，可先使用规范化的测试资料，但应和 `app.seed` 演示数据分开管理并明确标记。

## 3. 项目中 Mock 的准确分类

“Mock 数据”需要拆成以下几类处理，不能只修改数据库连接字符串。

| 类别 | 当前实现 | 是否已经写 MySQL | 修改目标 |
|---|---|---:|---|
| 业务演示数据 | `backend/app/seed.py` | 是 | 停止生产环境 Seed，导入正式资料 |
| 身份认证 | `X-Dev-User`、`/api/dev/session`、固定账号 | 查询 MySQL 用户，但身份由前端伪造 | 改为登录接口、JWT和服务端身份校验 |
| 支付 | `/api/payments/mock`，前端选择成功/取消/失败 | 会写 `payments` 和 `bills` | 本地改为数据库化人工确认；生产接微信支付 |
| 通知 | `MockNotificationService` | 会写 `notification_outbox` | 状态改为 `PENDING`，后续由正式消息适配器发送 |
| 文件 | `LocalStorageService` | 文件在磁盘，URL写数据库 | Local-First 可继续使用，不属于假数据 |
| 企业介绍 | 本地占位弹窗 | 否 | 增加系统配置表或后台配置接口 |
| 管理后台骨架 | 多个菜单只有占位内容 | 部分 | 补齐完整列表、详情、新增、编辑和状态流转 |

关键结论：MySQL 负责保存业务状态，但不能替代登录认证、微信支付或微信通知。支付和通知属于外部能力，只能将业务记录保存到 MySQL，不能通过把环境变量改成 `mysql` 来替代外部平台。

## 4. 目标架构

### 4.1 本机 development

```text
小程序/H5（5181） ─┐
                    ├─ HTTP API → FastAPI（8010）→ MySQL 8.0.36（3306）
管理后台（5180） ──┘                            └→ 本地 uploads 文件目录
```

要求：

1. 前端禁止直接连接 MySQL。
2. 所有查询、新增、编辑、状态修改都通过 FastAPI。
3. FastAPI 使用 SQLAlchemy Session 和事务写入 MySQL。
4. 数据库金额继续使用“分”为单位的整数，避免浮点金额误差。
5. 接口响应继续保持 `{code, message, data}` 结构。

### 4.2 腾讯云 production

```text
微信小程序/浏览器 → HTTPS/Nginx → FastAPI → 腾讯云服务器本机 MySQL
```

腾讯云不能直接读取开发电脑中的 MySQL。数据上线时应使用以下流程：

```text
本机 MySQL 备份/导出
→ 上传 SQL 或数据导入包到腾讯云
→ 服务器本机 MySQL 导入
→ FastAPI 继续连接 127.0.0.1 的 elevator_service
```

## 5. 数据库替换策略

### 5.1 推荐：新建数据库并切换，不直接删除旧库

为了避免误删当前联调记录，推荐在本机创建：

```text
旧库：elevator_service       保留，用于回滚和对照
新库：elevator_service_real  用于正式资料联调
```

实施步骤：

1. 对旧库做完整备份。
2. 创建 `elevator_service_real`。
3. 将 `backend/.env.development` 临时切换到新库。
4. 执行 `alembic upgrade head` 创建表结构。
5. 不执行 `python -m app.seed`。
6. 按依赖顺序导入真实资料。
7. 完成三端联调和验收。
8. 验收通过后再决定是否保留旧库。

这样可以通过修改一个环境变量立即回滚，不需要执行危险的批量删除。

### 5.2 数据导入顺序

必须按照外键依赖顺序导入：

```text
1. buildings          小区和楼栋
2. houses             房屋
3. users              业主、维修师傅、管理员
4. fee_items          收费项目
5. bills              账单主表
6. bill_items         账单费用明细
7. maintenance_records 维保档案
8. notices            公告
9. renovations        装修登记
10. repair_orders     历史工单（如果需要迁移）
11. payments/receipts 历史支付和收据（必须经过核对后迁移）
```

`payments`、`receipts` 和已缴账单具有财务含义，不能随意生成。导入时必须保证：

```text
bills.paid_amount_fen
= 对应成功 payments.amount_fen 的业务核对结果

bills.status=PAID
时必须存在可信的支付或人工入账依据
```

### 5.3 数据准备模板

在实施阶段应新增 `backend/data/import_templates/`，至少提供：

```text
buildings.csv
houses.csv
users.csv
fee_items.csv
bills.xlsx
maintenance_records.xlsx
notices.xlsx
```

每次导入必须支持：

1. 上传文件。
2. 字段校验。
3. 外键校验。
4. 重复数据检查。
5. 预览正确/错误行。
6. 用户确认后使用单个事务写入。
7. 记录导入批次和结果。

现有账单 CSV/XLSX 的“解析 → 预览 → 确认入库”代码可以继续复用并扩展。

## 6. 后端修改方案

### 6.1 配置和 Seed

涉及文件：

```text
backend/app/config.py
backend/.env.development
backend/app/seed.py
deploy/windows/install-server.ps1
```

修改内容：

1. development 保留 `root/root`，数据库切换为新建的正式资料联调库。
2. 生产环境继续使用 `elevator_app`，不允许使用 root。
3. 将 `seed.py` 定位为仅供演示环境使用，不再作为正式部署步骤。
4. 正式部署和后续更新取消 `-SeedDemoData`。
5. 基础收费项目如果确实属于系统初始化数据，应拆成单独、幂等的初始化脚本，不能和演示业主、演示账单混在一起。

### 6.2 身份认证替换

当前问题：

```text
小程序通过 X-Dev-User 指定 owner_101/technician_01
后台固定发送 X-Dev-User: admin_01
用户可通过前端按钮直接切换角色
```

这只能用于开发演示，不能作为实际登录。

计划新增：

```text
POST /api/auth/admin/login          管理员账号密码登录
POST /api/auth/wechat/login         小程序 wx.login code 登录
GET  /api/auth/me                   获取当前登录用户
POST /api/auth/logout               注销/令牌失效
```

数据库模型需要增加或扩展：

```text
users.password_hash     管理员/师傅密码哈希，不保存明文
users.wechat_openid     微信用户唯一标识，可空且唯一
users.enabled           是否启用
users.created_at
users.updated_at
```

后端增加 `get_current_user()` 依赖，从 JWT 中确认用户身份和角色。业务接口不再相信前端传入的 `X-Dev-User`。

本机联调阶段可先实现数据库账号登录；微信 `wx.login` 在 AppID、AppSecret 和合法域名准备完成后切换正式 Adapter。

### 6.3 业务 CRUD 补齐

当前后端已经支持账单查询、账单导入、报修新增、师傅处理工单、收据申请等，但管理后台大部分菜单还缺少真正的 CRUD。

建议补齐以下接口：

| 模块 | 必需接口 |
|---|---|
| 楼栋/房屋 | 列表、详情、新增、编辑、停用、批量导入 |
| 用户/权限 | 登录、列表、新增、编辑、绑定房屋、绑定楼栋、启停 |
| 收费项目 | 列表、新增、编辑、启停、排序 |
| 账单 | 列表、详情、手工新增、批量导入、作废、导出 |
| 缴费 | 列表、人工确认、取消/退款记录、对账查询 |
| 收据 | 列表、详情、标记已开具、驳回 |
| 报修 | 管理员列表、详情、派单、状态流转、师傅处理、业主查询 |
| 维保 | 列表、上传 PDF、新增、编辑、删除/作废 |
| 装修 | 业主提交、管理员审核、状态流转、业主查询 |
| 公告 | 管理员新增、编辑、发布、撤回、置顶，小程序查询 |
| 消息队列 | 列表、发送状态、失败原因、重试 |

所有写接口都应包含：

```text
Pydantic请求模型校验
角色权限检查
数据库事务
不存在/冲突处理
写入后重新查询返回
必要的操作日志
```

### 6.4 支付替换

当前 `/api/payments/mock` 和小程序“模拟成功/取消/失败”菜单必须移除。

Local-First 第一阶段推荐实现：

```text
管理员后台人工确认到账
→ POST /api/admin/payments/manual-confirm
→ 在一个数据库事务中写 payments(provider=MANUAL)
→ 更新 bills.status/paid_amount_fen/paid_at
→ 写 notification_outbox(status=PENDING)
```

这样可以完成真实的 MySQL 读写联调，但不会伪装成微信支付。

生产微信支付属于下一步外部集成：

```text
服务端下单
→ 小程序 wx.requestPayment
→ 服务端验签回调
→ 主动查单兜底
→ 幂等更新 payments 和 bills
```

不能仅根据小程序前端“支付成功”回调把账单改为已支付。

### 6.5 通知和文件

1. 将 `MockNotificationService` 改名为数据库 Outbox 服务。
2. 新记录初始状态从 `MOCKED` 改为 `PENDING`。
3. 本机联调只验证消息事件已经写入 MySQL。
4. 生产阶段再增加微信订阅消息发送器和失败重试。
5. `LocalStorageService` 在本地继续保留；图片/PDF真实保存在磁盘，文件元数据和 URL 保存在 MySQL。

## 7. 小程序修改方案

涉及核心文件：

```text
miniprogram/src/api/http.ts
miniprogram/src/stores/session.ts
miniprogram/src/pages/**
miniprogram/.env.development
miniprogram/.env.production
```

修改内容：

1. 移除默认 `owner_101`、`technician_01` 和角色切换按钮。
2. 登录成功后保存 JWT，统一发送 `Authorization: Bearer <token>`。
3. 401 时清除会话并回到登录页。
4. 移除 `/dev/session` 和 `/payments/mock` 调用。
5. 缴费页面不再出现“模拟成功/取消/失败”选择框。
6. 报修图片先调用 `/api/uploads`，再把返回 URL 写入报修工单。
7. 补齐装修登记提交接口，而不是只显示空列表。
8. 维修师傅端从登录用户角色进入，不再自动切换固定师傅。
9. 所有列表在新增或状态更新后重新请求接口，确保显示的是 MySQL 最新数据。
10. production API 地址替换 `https://api.example.com/api`，使用实际备案域名和 HTTPS 地址。

## 8. 管理后台修改方案

涉及核心文件：

```text
admin-web/src/api.ts
admin-web/src/App.vue
admin-web/src/router/
admin-web/src/views/
admin-web/src/stores/
```

当前 `App.vue` 集中了全部页面，且报修、维保、装修、公告、账号、系统设置等菜单大多只有交互骨架。建议拆分为路由和独立页面：

```text
views/Login.vue
views/Dashboard.vue
views/Billing/*.vue
views/Repairs/*.vue
views/Maintenance/*.vue
views/Renovations/*.vue
views/Notices/*.vue
views/Users/*.vue
views/Settings/*.vue
```

管理后台必须完成以下数据库闭环：

1. 管理员登录并获取 JWT。
2. 新增/编辑楼栋、房屋和账号。
3. 配置收费项目。
4. 导入账单并确认写入。
5. 查询缴费、处理收据。
6. 查询业主报修并派单。
7. 上传维保档案。
8. 审核装修登记。
9. 发布/编辑/撤回公告。
10. 操作成功后刷新列表，页面数据必须与 MySQL 查询结果一致。

## 9. 三端联调验收矩阵

每个验收项必须同时保留“前端结果、API响应、MySQL变化”三类证据。

| 场景 | 操作端 | 验收端 | MySQL证据 |
|---|---|---|---|
| 管理员发布公告 | 管理后台 | 业主小程序立即显示 | `notices` 新增1行 |
| 管理员导入账单 | 管理后台 | 对应房屋业主看到新账单 | `bills`、`bill_items` 新增且金额一致 |
| 业主提交报修 | 业主小程序 | 管理后台出现待处理工单 | `repair_orders.status=PENDING` |
| 管理员派单 | 管理后台 | 指定师傅工作台显示 | `technician_id` 正确 |
| 师傅接单/完工 | 师傅小程序 | 业主端看到进度 | 状态依次 `REPAIRING`、`COMPLETED` |
| 业主提交装修登记 | 业主小程序 | 管理后台可以审核 | `renovations` 新增并流转状态 |
| 上传维保 PDF | 管理后台/师傅端 | 同楼栋业主可查看 | 文件存在且 `maintenance_records` 新增 |
| 人工确认到账 | 管理后台 | 业主账单变成已缴 | `payments` 与 `bills` 同一事务更新 |
| 业主申请收据 | 业主小程序 | 管理后台可处理 | `receipts.status=PENDING` |
| 管理员处理收据 | 管理后台 | 业主看到最终状态 | `receipts.status` 更新 |

## 10. 测试和验证方案

### 10.1 数据库验证

实施前后分别记录：

```sql
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM houses;
SELECT COUNT(*) FROM bills;
SELECT COUNT(*) FROM repair_orders;
SELECT COUNT(*) FROM notices;
SELECT COUNT(*) FROM payments;
```

对写入场景使用唯一业务号查询，不能只看总数。

### 10.2 后端验证

需要新增自动化测试，当前仓库还没有测试目录。建议：

```text
backend/tests/test_auth.py
backend/tests/test_billing.py
backend/tests/test_repairs.py
backend/tests/test_maintenance.py
backend/tests/test_renovations.py
backend/tests/test_notices.py
backend/tests/test_receipts.py
```

重点验证：权限隔离、事务一致性、幂等、重复导入、非法状态流转和跨房屋访问拒绝。

### 10.3 前端验证

```powershell
cd admin-web
npm run type-check
npm run build

cd ..\miniprogram
npm run type-check
npm run build:h5
npm run build:mp-weixin
```

还必须进行浏览器和微信开发者工具的可视化验收，不能只以构建成功代替接口联调。

## 11. 本机数据上线腾讯云方案

### 11.1 本机导出

先完成本机完整联调，再用 `mysqldump` 导出。密码应交互输入，不写入脚本：

```powershell
mysqldump -h 127.0.0.1 -P 3306 -u root -p `
  --single-transaction `
  --routines `
  --triggers `
  --set-gtid-purged=OFF `
  --default-character-set=utf8mb4 `
  elevator_service_real > elevator_service_real.sql
```

### 11.2 腾讯云导入

1. 导入前创建服务器快照和 MySQL 备份。
2. 停止后端计划任务，避免导入期间产生写入。
3. 上传 SQL 到 `C:\elevator-service\packages\`。
4. 使用服务器保存的数据库管理员凭据导入服务器本机 MySQL。
5. 执行 `alembic upgrade head`。
6. 启动后端并检查 `/api/health`。
7. 验证公告、账单、工单和后台数据。

生产数据库密码不得写入本文档、Git、聊天截图或发布 ZIP。

## 12. 推荐实施顺序

### 第一阶段：安全的数据基线

1. 备份当前 `elevator_service`。
2. 创建 `elevator_service_real`。
3. 执行 Alembic。
4. 准备并导入楼栋、房屋、用户、收费项目。
5. 停止使用演示 Seed。

### 第二阶段：认证与基础 CRUD

1. 数据库账号/JWT登录。
2. 管理后台楼栋、房屋、用户、收费项目 CRUD。
3. 小程序移除固定测试身份。

### 第三阶段：核心业务联调

1. 账单导入和业主查询。
2. 报修、派单、师傅处理、业主查看。
3. 维保、装修、公告、收据闭环。
4. 人工确认缴费的数据库事务闭环。

### 第四阶段：生产外部能力

1. 微信登录。
2. 微信支付。
3. 微信订阅消息。
4. COS/正式文件存储。
5. HTTPS域名和小程序合法域名。

### 第五阶段：腾讯云数据迁移和生产验收

1. 导出已验收的本机数据库。
2. 备份腾讯云数据库。
3. 导入并迁移。
4. 三端生产环境回归。
5. 确认无误后再清理服务器演示数据。

## 13. 实施前需要确认的资料

开始修改代码前，应准备或确认：

1. 实际小区、楼栋、房屋和住户数据文件。
2. 管理员和维修师傅账号资料。
3. 收费项目及每户金额规则。
4. 是否存在需要迁移的历史账单、支付、报修、维保和装修数据。
5. 本地第一阶段支付采用“管理员人工确认到账”，还是已经具备微信支付商户资料。
6. 微信小程序 AppID、AppSecret、正式 HTTPS 域名是否已经具备。
7. 公告和企业介绍的初始内容。

如果暂时没有真实资料，建议先制作一套“业务验收数据”，但不要继续使用 `五山新苑/owner_101` 这些演示 Seed；验收数据也要通过导入或后台新增进入 MySQL，以验证真实数据链路。

## 14. 本方案的最终验收标准

完成后必须满足：

1. 小程序和后台页面没有硬编码业务记录。
2. 前端不能通过修改 `X-Dev-User` 冒充其他角色。
3. 停止后端后前端不能伪造成功数据；启动后端后所有数据来自 MySQL。
4. 管理后台新增公告后，小程序能读取同一条 MySQL 记录。
5. 小程序提交报修后，后台和师傅端能处理同一条工单。
6. 所有写操作都能在 MySQL 中查到对应记录和正确状态。
7. 支付记录与账单更新保持事务一致性。
8. 本机重启后 MySQL、后端和前端仍能按文档启动并读取原数据。
9. 腾讯云只使用服务器本机数据库账号，不连接开发电脑 MySQL。
10. 生产环境不执行演示 Seed，不使用 `root/root`，不保留 Mock 支付入口。
