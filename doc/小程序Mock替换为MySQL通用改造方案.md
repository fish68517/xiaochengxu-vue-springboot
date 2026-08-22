# 小程序 Mock 替换为 MySQL 通用改造方案

## 1. 文档用途

本方案用于把“前端 Mock 数据、固定测试身份、模拟支付、占位管理页面”的小程序项目，改造成可本地运行、可联调、可部署的真实数据库应用。

方案与具体业务无关，可用于电梯管理、商城、预约、工单、内容管理等不同类型的小程序。另一个萌宠商城项目只需要把本文的“业务模块”替换为商品、分类、购物车、订单、库存、收货地址等商城模块，不需要照搬电梯项目的数据表或接口。

本文只讨论普通软件工程、商城业务和系统部署，不涉及动物饲养、医疗、实验或其他生命科学内容。

## 2. 最终目标

改造完成后必须满足：

1. 小程序和管理后台不保存硬编码业务记录。
2. 前端不能通过修改请求头、用户名或页面变量伪造用户身份。
3. 所有业务查询和写入都经过后端 API。
4. 后端统一通过 ORM 和事务读写 MySQL。
5. 管理后台新增或修改数据后，小程序能够查询到同一条数据库记录。
6. 小程序提交订单或业务申请后，管理后台能够查询和处理。
7. 支付、库存、订单金额等关键状态不能仅由前端决定。
8. 本地 development 与 production 使用不同配置和数据库账号。
9. 项目能够通过自动化测试、前端构建和浏览器实际联调。
10. 数据库和上传文件有备份、迁移与回滚方案。

## 3. 推荐通用架构

```text
微信小程序 / H5 ─┐
                  ├─ HTTPS/HTTP API → 后端服务 → MySQL
管理后台网站 ────┘                    ├→ 文件存储
                                      └→ 消息 Outbox
```

推荐技术组合可以是：

```text
小程序：uni-app + Vue 3 + TypeScript + Pinia
管理后台：Vue 3 + TypeScript + Vite + Element Plus
后端：FastAPI + SQLAlchemy + Alembic
数据库：MySQL 8
认证：JWT
本地文件：服务器磁盘
生产文件：本地磁盘或 COS
```

技术栈可以替换，但以下边界不能改变：

- 前端不能直接连接 MySQL。
- 前端不保存数据库密码。
- 数据权限由后端判断。
- 财务、订单和库存状态由后端事务维护。

## 4. 开始改造前的项目审计

### 4.1 先阅读项目约束

首先检查项目根目录中的：

```text
AGENTS.md
README.md
DEVELOPMENT.md
package.json
requirements.txt / pyproject.toml
.env.example
部署文档
数据库迁移目录
```

确认真实源码目录、启动方式、端口、数据库版本和生产部署方式，不根据项目名称猜测技术栈。

### 4.2 搜索所有 Mock 入口

建议搜索：

```powershell
rg -n -i "mock|fixture|fake|demo|模拟|测试数据|X-Dev-User|dev/session|localStorage" . `
  --glob "!**/node_modules/**" `
  --glob "!**/dist/**"
```

搜索结果要按类别整理，不能看到 `mock` 就直接删除：

| 类型 | 常见形式 | 改造方式 |
|---|---|---|
| 前端硬编码数据 | JSON、数组、延迟 Promise | 替换为 API 查询 |
| 固定测试身份 | 默认用户名、角色切换按钮 | 数据库登录 + JWT |
| 开发请求头 | `X-Dev-User` | `Authorization: Bearer` |
| 模拟写入 | 前端直接修改列表 | 调用后端写接口后重新查询 |
| 模拟支付 | 前端选择成功或失败 | 人工确认或正式支付回调 |
| 模拟消息 | 只打印日志或固定成功 | 数据库 Outbox |
| 演示 Seed | 自动插入业务样例 | 仅保留在明确的演示环境 |
| 本地文件存储 | 上传到磁盘 | 可以保留，不属于 Mock |

### 4.3 建立接口和页面清单

对每个页面记录：

```text
页面名称
使用角色
当前数据来源
需要的查询接口
需要的写接口
对应数据库表
权限范围
验收场景
```

不要只改首页。详情页、弹窗、搜索、分页、状态流转、上传和管理后台都要纳入清单。

## 5. Local-First 安全实施流程

### 5.1 先备份

修改表结构或业务数据前执行完整备份：

```powershell
mysqldump -h 127.0.0.1 -P 3306 -u root -p `
  --single-transaction `
  --routines `
  --triggers `
  --set-gtid-purged=OFF `
  --default-character-set=utf8mb4 `
  数据库名 > 改造前备份.sql
```

备份文件放在不参与发布的目录，并加入 `.gitignore`。备份后检查文件存在且大小不为零。

### 5.2 保留可回滚基线

有真实资料时，推荐保留旧库并新建联调库：

```text
旧库：project_demo
新库：project_development
```

如果必须在原库迁移：

1. 先完成 SQL 备份。
2. Alembic 迁移必须包含 downgrade。
3. 不执行批量删除演示数据。
4. 使用唯一标识隔离自动化测试记录。
5. 测试结束后只删除测试本身创建的数据。

### 5.3 development 配置

本地环境变量示例：

```dotenv
APP_ENV=development
DATABASE_URL=mysql+pymysql://本地账号:本地密码@127.0.0.1:3306/数据库名?charset=utf8mb4
AUTH_MODE=database
PAYMENT_MODE=manual
STORAGE_BACKEND=local
NOTIFICATION_MODE=outbox
JWT_SECRET=仅用于本机开发的随机字符串
JWT_EXPIRE_MINUTES=720
CORS_ORIGINS=http://127.0.0.1:前端端口
```

`.env.example` 只能保留占位值，不能提交真实生产密码。

## 6. 数据库设计与迁移

### 6.1 通用基础表

多数项目都需要：

```text
users                   用户与角色
notification_outbox     待发送消息
operation_logs          管理操作日志
uploads                 文件元数据（可选）
system_settings         系统配置（可选）
```

`users` 推荐字段：

```text
id
username
password_hash
display_name
phone
role
wechat_openid
enabled
created_at
updated_at
```

必须满足：

- 密码只保存安全哈希，不保存明文。
- `username` 和非空 `wechat_openid` 建立唯一约束。
- 用户启停状态由后端检查。
- 时间字段统一时区规则。

### 6.2 按业务增加表

以商城项目为例，可采用：

```text
product_categories      商品分类
products                商品
product_skus            规格与价格
inventory_records       库存流水
carts                    购物车
cart_items               购物车明细
addresses                收货地址
orders                   订单主表
order_items              订单商品快照
payments                 支付记录
refunds                  退款记录
notices                  公告或活动内容
```

需要特别注意：

1. 金额统一使用“分”的整数，不使用浮点数。
2. 订单明细保存下单时的商品名称、规格和价格快照。
3. 库存变化使用事务和条件更新，不能只在前端判断。
4. 支付回调必须幂等。
5. 已支付订单不能随意物理删除。
6. 状态字段必须定义合法流转规则。

### 6.3 Alembic 迁移原则

每次模型变更都创建独立迁移：

```powershell
python -m alembic revision -m "database auth and business tables"
python -m alembic upgrade head
python -m alembic current
python -m alembic heads
```

验收要求：`current` 与 `heads` 一致。

迁移中处理旧字段值时，要显式转换，例如：

```sql
UPDATE payments SET provider='MANUAL' WHERE provider='MOCK';
UPDATE notification_outbox SET status='PENDING' WHERE status='MOCKED';
```

## 7. 后端通用改造

### 7.1 统一响应结构

推荐所有接口返回：

```json
{
  "code": 0,
  "message": "操作成功",
  "data": {}
}
```

错误状态仍要使用正确的 HTTP 状态码，例如 `400`、`401`、`403`、`404` 和 `409`。

### 7.2 数据库账号登录和 JWT

通用接口：

```text
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

登录流程：

```text
用户名和密码
→ 查询 users
→ 检查 enabled
→ 验证 password_hash
→ JWT 写入 user_id、role、过期时间
→ 返回 token 和用户资料
```

后续接口统一使用：

```http
Authorization: Bearer <token>
```

不能信任前端传入的 `userId`、`role` 或用户名。需要当前用户时，必须从 JWT 解析并重新查询数据库。

### 7.3 角色与数据范围

角色校验分成两层：

```text
第一层：角色能否访问接口
第二层：该用户能否访问这条记录
```

例如商城项目：

- 普通用户只能查询和修改自己的地址、购物车与订单。
- 管理员可以管理商品、库存、订单和账号。
- 客服角色只能访问被授权的订单字段。
- 即使前端传入别人的订单 ID，后端也必须拒绝。

### 7.4 CRUD 标准

每个业务模块至少实现：

```text
列表（分页、筛选）
详情
新增
编辑
启停或状态流转
必要的导入导出
```

每个写接口应包含：

1. Pydantic 请求校验。
2. 当前用户和角色校验。
3. 数据归属校验。
4. 不存在和重复数据处理。
5. 数据库事务。
6. 操作日志或消息 Outbox。
7. 提交后重新查询并返回数据库结果。

### 7.5 事务与幂等

以下操作必须放在同一事务中：

```text
创建订单 + 创建订单明细 + 扣减库存
支付成功 + 更新订单状态 + 写支付记录
取消订单 + 恢复库存
退款成功 + 写退款记录 + 更新订单
管理员人工确认款项 + 更新业务单据
```

关键写接口建议使用业务幂等键：

```text
order_no
payment_no
provider_transaction_id
request_id
import_batch_no
```

数据库建立唯一索引，不能只用代码中的“先查再写”防止重复。

## 8. 支付改造原则

### 8.1 Local-First 阶段

本地没有微信商户资料时，使用明确标注的人工确认流程：

```text
用户提交付款请求
→ payments 写入 PENDING、provider=MANUAL
→ 管理员确认实际到账
→ 同一事务更新 payments 和订单/账单
→ 写 notification_outbox
```

不能把“点击模拟成功”伪装成正式支付。

### 8.2 正式微信支付

生产阶段标准流程：

```text
后端创建预支付订单
→ 小程序 wx.requestPayment
→ 微信服务端回调
→ 后端验签并校验金额、商户号和订单号
→ 幂等更新 payment 和业务订单
→ 主动查单作为兜底
```

小程序端的成功回调只能用于页面提示，不能作为后端确认收款的唯一依据。

## 9. 文件和消息

### 9.1 文件上传

流程：

```text
前端选择文件
→ 调用上传接口
→ 后端验证类型、大小和扩展名
→ 保存文件
→ 返回 URL 和文件信息
→ 业务接口只保存返回的 URL
```

开发环境可保存到本地磁盘，生产环境可切换 COS。上传目录必须与程序发布目录分离，更新程序时不能覆盖用户文件。

### 9.2 数据库 Outbox

业务事务中只写待发送事件：

```text
event_type
payload
status=PENDING
retry_count
last_error
created_at
sent_at
```

后台任务再负责调用微信订阅消息、短信或邮件。业务写入成功不依赖第三方消息服务是否在线。

## 10. 小程序端改造

### 10.1 统一请求层

统一封装：

```text
API_BASE_URL
Authorization 请求头
请求超时
统一响应解包
401 清理会话并跳转登录
文件上传
错误提示
```

页面不能各自拼接后端地址。

### 10.2 会话 Store

Store 保存：

```text
token
currentUser
authenticated
```

需要提供：

```text
login()
restoreSession()
loadCurrentUser()
logout()
```

本地缓存只用于保持登录状态，不能把缓存中的角色当作最终权限依据。

### 10.3 页面数据原则

每个列表页面遵循：

```text
进入页面 → API 查询 → 展示 loading/empty/error/data
新增或修改 → API 写入 → 成功后重新查询
```

不要只在前端数组中 `push`、`splice` 或修改状态后假装成功。

商城项目重点联调：

```text
商品分类和列表
商品详情与实时价格
购物车新增、修改、删除
收货地址 CRUD
订单创建和明细查询
库存不足提示
订单取消和状态显示
支付请求与支付结果查询
个人订单列表
公告或活动内容
```

## 11. 管理后台改造

管理后台至少需要：

```text
登录页
数据概览
用户与权限
业务基础资料
核心业务列表和详情
新增与编辑表单
状态操作
文件上传
消息队列
系统设置
```

商城项目通常对应：

```text
商品分类管理
商品和 SKU 管理
库存管理
订单管理
支付与退款记录
用户管理
公告/轮播内容管理
消息队列
```

避免把所有页面长期集中在一个 `App.vue`。功能稳定后建议拆分路由、页面、Store 和 API 模块：

```text
src/api/
src/router/
src/stores/
src/views/
src/components/
src/types/
```

TypeScript 构建应使用 `vue-tsc --noEmit`，避免在 `src` 中生成容易过期的 `.js` 副本。

## 12. 自动化联调测试

### 12.1 测试层级

```text
模型和工具单元测试
API 集成测试
前端类型检查
生产构建
浏览器可视化测试
微信开发者工具测试
```

### 12.2 跨端数据库闭环

每个核心场景都验证：

```text
操作端结果
API 响应
MySQL 变化
另一个客户端查询结果
```

商城示例矩阵：

| 场景 | 操作端 | 验收端 | MySQL 证据 |
|---|---|---|---|
| 新增商品 | 管理后台 | 小程序商品列表 | `products`、`product_skus` 新增 |
| 修改价格 | 管理后台 | 商品详情显示新价格 | SKU 价格已更新 |
| 加入购物车 | 小程序 | 购物车页面 | `cart_items` 新增或数量更新 |
| 创建订单 | 小程序 | 后台订单列表 | `orders`、`order_items` 新增 |
| 扣减库存 | 创建订单 | 后台库存 | 库存与流水一致 |
| 取消订单 | 小程序/后台 | 双端状态一致 | 订单取消并恢复库存 |
| 人工确认款项 | 管理后台 | 用户订单变为已支付 | payment 与 order 同事务更新 |
| 发布公告 | 管理后台 | 小程序显示 | `notices` 新增 |

### 12.3 测试数据清理

自动化测试使用随机唯一标记：

```text
TEST-<uuid>
```

测试结束后只清理本次创建的数据。清理顺序必须遵循外键关系，不能清空整张表。

## 13. 构建与本地运行验收

后端：

```powershell
cd backend
.\.venv\Scripts\python.exe -m compileall -q app tests
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8010
```

管理后台：

```powershell
cd admin-web
npm run type-check
npm run build
npm run dev -- --host 127.0.0.1 --port 5180
```

小程序：

```powershell
cd miniprogram
npm run type-check
npm run build:h5
npm run build:mp-weixin
npm run dev:h5 -- --host 127.0.0.1 --port 5181
```

必须检查：

1. 健康检查返回 200。
2. 数据库账号能够登录。
3. 不同角色访问越权接口返回 403。
4. 小程序和后台展示 MySQL 数据。
5. 浏览器控制台没有运行错误。
6. 微信开发者工具可以导入构建目录。

## 14. 生产部署原则

### 14.1 生产环境不能照搬本机配置

禁止：

```text
生产 MySQL 使用 root/root
把 3306 开放到公网
提交 .env 和真实密钥
生产部署自动执行演示 Seed
在 ZIP 中包含本地数据库备份
使用 development JWT_SECRET
使用模拟支付入口
```

生产推荐：

```text
Nginx → FastAPI → 127.0.0.1 MySQL
独立的低权限数据库账号
随机高强度数据库密码
随机 JWT 密钥
HTTPS 域名
独立上传目录
日志和备份目录
数据库定时备份
```

### 14.2 数据迁移

```text
本机联调通过
→ 导出经过确认的数据
→ 备份生产数据库
→ 上传 SQL/导入包
→ 暂停生产写入
→ 导入数据
→ 执行 Alembic upgrade head
→ 启动服务
→ 健康检查和业务回归
→ 失败时按备份回滚
```

程序 ZIP、数据库 SQL、上传文件和 `.env` 是不同资产，不能混为一个包。

## 15. 推荐实施阶段

### 阶段一：审计和备份

1. 阅读项目说明和部署文档。
2. 搜索 Mock 和硬编码入口。
3. 建立页面、接口和数据表清单。
4. 备份 MySQL。

### 阶段二：数据库和认证

1. 设计或完善表结构。
2. 创建 Alembic 迁移。
3. 实现密码哈希和 JWT。
4. 移除前端固定身份和角色切换。

### 阶段三：核心 CRUD

1. 后端补齐业务接口。
2. 小程序接入统一 API。
3. 后台完成管理页面。
4. 实现文件上传和消息 Outbox。

### 阶段四：关键事务

1. 订单、库存和金额事务。
2. 人工确认款项。
3. 幂等与状态流转限制。
4. 权限和数据归属检查。

### 阶段五：自动化和可视化验收

1. API 集成测试。
2. 三端构建。
3. 浏览器实际登录和操作。
4. 微信开发者工具测试。
5. 查询 MySQL 验证结果。

### 阶段六：生产外部能力

1. 微信登录。
2. 微信支付。
3. 订阅消息。
4. COS 或正式文件存储。
5. HTTPS 和小程序合法域名。

## 16. 可复制的任务提示模板

将下面内容复制到另一个项目，并替换方括号中的信息：

```text
请先阅读项目根目录 AGENTS.md、README.md 和部署文档。

项目类型：[例如 uni-app 小程序 + Vue 管理后台 + FastAPI + MySQL 8]
项目业务：[例如商城]
本机数据库：[地址、端口、数据库名；密码不要提交到 Git]

目标：
1. 按 Local-First 原则，先备份数据库并完成本地 development 改造。
2. 搜索并分类所有 Mock 数据、固定身份、模拟支付和占位页面。
3. 前端业务数据全部改为通过后端 API 读写 MySQL。
4. 实现数据库账号登录、密码哈希、JWT、角色权限和数据归属校验。
5. 补齐小程序与管理后台的核心 CRUD。
6. 本地没有微信商户资料时，使用明确的人工确认款项流程，不伪造微信支付成功。
7. 增加 Alembic 迁移和跨端 API 集成测试。
8. 运行后端测试、前端类型检查、H5/管理后台/微信小程序构建。
9. 启动三个本地服务，并通过浏览器验证登录和 MySQL 实时数据。
10. 不修改生产服务器，除非我明确授权部署。

验收时提供：
- 修改文件清单
- 数据库备份位置
- Alembic 当前版本
- 自动化测试结果
- 构建结果
- 本地运行地址和测试账号
- 仍需外部资料才能完成的事项
```

## 17. 最终验收清单

- [ ] 已阅读项目级约束文件。
- [ ] 已创建改造前数据库备份。
- [ ] 前端无硬编码业务列表。
- [ ] 已移除固定开发身份和角色切换。
- [ ] 密码使用安全哈希。
- [ ] 所有受保护接口使用 JWT。
- [ ] 已实现角色和数据归属校验。
- [ ] 核心 CRUD 全部经过后端和 MySQL。
- [ ] 订单、金额、库存等关键操作使用事务。
- [ ] 支付回调或人工确认具有幂等性。
- [ ] 文件先上传再保存 URL。
- [ ] 消息采用 Outbox，不阻塞业务事务。
- [ ] Alembic `current` 与 `heads` 一致。
- [ ] API 集成测试通过。
- [ ] 管理后台类型检查和构建通过。
- [ ] 小程序 H5 和微信构建通过。
- [ ] 浏览器登录和实时数据展示通过。
- [ ] 测试记录已精确清理。
- [ ] 生产环境未使用本机 root 账号。
- [ ] 生产环境没有演示 Seed 和模拟支付入口。

## 18. 关键结论

“替换成 MySQL”不是只修改数据库连接字符串，而是同时完成以下改造：

```text
真实数据库模型
+ 数据迁移
+ 服务端身份认证
+ 权限与数据归属
+ 完整 CRUD
+ 关键业务事务
+ 前端接口接入
+ 跨端联调测试
+ 可回滚部署
```

只要保持这些边界，业务从电梯管理替换为商城、预约或其他小程序时，整体实施流程都可以复用；需要重新设计的是具体业务表、接口、页面和状态机，而不是认证、配置、迁移、测试与部署的基础方法。
