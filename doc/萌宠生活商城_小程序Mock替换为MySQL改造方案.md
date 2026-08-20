# 萌宠生活商城：小程序 Mock 替换为 MySQL 项目改造方案

> 文档类型：本项目专用实施方案  
> 项目目录：`E:\bishe27\wxMiniProgram`  
> 编写日期：2026-08-20  
> 参考文档：`doc/小程序Mock替换为MySQL通用改造方案.md`  
> 当前数据库：MySQL 8.0.36 / `pet_life_dev`

## 1. 改造目标

本方案只针对萌宠生活商城的软件工程功能进行改造，包括 uni-app 小程序、Element Plus 管理后台、FastAPI REST API 和 MySQL 业务数据，不扩展与商城无关的功能。

改造完成后应满足：

1. 小程序商品、用户、购物车、地址、订单、优惠券、活动和报名结果全部从 FastAPI 获取并写入 MySQL。
2. Element Plus 管理后台和小程序使用同一套 MySQL 数据，后台修改商品后小程序刷新即可看到结果。
3. 删除固定用户 ID、固定收货地址、内存购物车、固定优惠券、固定抽奖人数和固定中奖结果等 Mock 数据。
4. 小程序不直接连接 MySQL，不保存数据库账号密码。
5. 小程序和管理后台统一使用数据库账号、密码哈希、JWT 和后端权限校验。
6. 创建订单、扣减库存、使用优惠券等操作由后端事务完成，金额不由前端决定。
7. 本地付款联调改为有 MySQL 支付记录的人工确认流程，不再由小程序按钮直接把订单改成已支付。
8. 数据库结构变更全部通过 Alembic migration 执行，不再依赖启动时自动建表。
9. 自动化测试使用独立测试库或 SQLite 临时库，不污染 `pet_life_dev`。
10. 通过小程序、管理后台、API 和 MySQL 四层联调证明数据闭环真实有效。

## 2. 本次不做的事项

本次改造不包含：

- 正式微信支付商户接入；
- 生产服务器部署；
- 微信订阅消息和短信；
- COS 文件存储；
- 与商品、用户、购物车、订单和活动无关的新业务模块。

正式微信登录和微信支付放在本地 MySQL 闭环完成后单独实施。

## 3. 当前项目审计结论

### 3.1 已经真实读取 MySQL 的部分

当前项目并不是“全部使用前端 Mock”。以下链路已经经过 FastAPI 和 SQLAlchemy 读写 MySQL：

| 功能 | 小程序入口 | 当前 FastAPI 接口 | 当前 MySQL 表 | 结论 |
|---|---|---|---|---|
| 商品列表 | `pages/home/index.vue`、`pages/mall/index.vue` | `GET /api/v1/products` | `products` | 已接 MySQL |
| 商品详情 | `pages/product/detail.vue` | `GET /api/v1/products/{id}` | `products` | 已接 MySQL |
| 活动详情 | `pages/lottery/detail.vue` | `GET /api/v1/lottery/activities/{id}` | `lottery_activities` | 已接 MySQL，但身份固定 |
| 活动报名 | `pages/lottery/detail.vue` | `POST /api/v1/lottery/activities/{id}/join` | `lottery_participants` | 已写 MySQL，但用户固定为 1 |
| 开奖结果 | `pages/lottery/result.vue` | `GET /api/v1/lottery/activities/{id}/result` | `lottery_activities.winners_json` | 数据来自 MySQL，但结果为 Seed 样例 |
| 创建订单 | `pages/checkout/index.vue` | `POST /api/v1/orders` | `orders` | 已写 MySQL，但仅支持单商品订单 |
| 订单列表 | `pages/profile/index.vue` | `GET /api/v1/orders` | `orders` | 已读 MySQL，但用户固定为 1 |
| 管理商品 | `apps/admin-web/src/App.vue` | `/api/v1/admin/products` | `products`、`audit_logs` | CRUD 已闭环 |
| 管理活动 | `apps/admin-web/src/App.vue` | `/api/v1/admin/lottery/activities` | 活动、报名、审计表 | 基础闭环已完成 |
| 管理订单 | `apps/admin-web/src/App.vue` | `/api/v1/admin/orders` | `orders`、`audit_logs` | 查询和发货已完成 |

因此本次正确做法不是推翻现有代码，而是在现有 MySQL 基础上补齐真实身份、购物车、地址、优惠券、订单明细、支付记录和活动数据一致性。

### 3.2 当前数据库实测快照

2026-08-20 对当前 development 数据库进行了只读检查：

```text
SQLAlchemy dialect: mysql
MySQL version:      8.0.36
Alembic current:    0001_initial (head)

users:                   1
products:                9
orders:                  1
lottery_activities:      3
lottery_participants:    0
audit_logs:              9
```

活动人数存在明确的数据不一致：

```text
活动 1：participant_count=1286，真实报名记录=0
活动 2：participant_count=1268，真实报名记录=0
活动 3：participant_count=0，   真实报名记录=0
```

这说明 `participant_count` 和历史中奖名单虽然保存在 MySQL 中，但仍属于 Seed 写入的演示数据，不能作为真实报名结果。

### 3.3 必须删除或替换的 Mock 入口

| Mock/占位入口 | 当前文件 | 当前问题 | 改造结果 |
|---|---|---|---|
| `X-Demo-User: 1` | `apps/miniprogram/src/api/http.ts` | 可伪造且后端未使用真实会话 | 改为 `Authorization: Bearer <JWT>` |
| 固定 `user_id=1` | `backend/app/main.py` | 所有用户共用一套数据 | 从 JWT 解析当前用户 |
| 当前活动固定 ID 1 | `backend/app/main.py` | 后台新活动无法自动成为小程序当前活动 | 根据状态和时间查询当前活动 |
| Pinia 内存购物车 | `apps/miniprogram/src/stores/cart.ts` | 刷新或换设备后丢失，后台不可见 | 改为 `cart_items` API + MySQL |
| 固定收货地址 | `pages/checkout/index.vue` | 地址写死在前端源码 | 改为 `addresses` CRUD 和默认地址 |
| 固定优惠券和前端金额 | `pages/checkout/index.vue` | 前端任意切换优惠和计算减 30 | 改为数据库优惠券，后端试算和核销 |
| 本地按钮直接支付成功 | `api/order.ts`、`pages/checkout/index.vue` | 没有支付表，也没有确认记录 | 改为 `payments=PENDING`，后台人工确认 |
| 商品收藏 `ref(false)` | `pages/product/detail.vue` | 仅当前页面有效 | 改为 `favorites` API + MySQL |
| 我的页面固定卡片 | `backend/app/main.py` 的 `pets`、`reminders` | API 返回硬编码数组 | 当前商城阶段删除这些占位区块，不新增无关模块 |
| 固定 Seed 商品和活动 | `backend/app/services/seed.py` | 每次空库自动插入演示业务记录 | 改为显式开发初始化命令，生产启动不执行 |
| 固定报名人数和中奖名单 | `backend/app/services/seed.py` | 与真实报名记录不一致 | 删除固定统计值，人数和中奖结果由表记录计算 |
| `Base.metadata.create_all()` | `backend/app/main.py` | 可能绕过 migration | 启动时只检查数据库，建表统一交给 Alembic |
| 管理员明文配置和固定 Token | `backend/app/core/config.py`、`security.py` | 不是数据库用户，也不是可过期 JWT | 管理员迁入 `users`，密码哈希并签发 JWT |

### 3.4 不应误删的静态内容

以下内容属于 UI 结构或展示资源，不等同于业务 Mock：

- 页面标题、按钮文字、空状态提示；
- 底部导航定义；
- 固定排序选项“综合、销量、价格、新品”；
- 本地 UI 图标、装饰背景、占位图片组件；
- TypeScript 类型定义；
- 单元测试中的隔离测试数据。

商品名称、价格、库存、地址、优惠券、订单状态、报名人数等业务记录必须来自 MySQL；纯 UI 文案可以继续保留在前端。

## 4. 改造后的项目架构

```text
uni-app 小程序（5173/H5 或微信开发者工具）
        │
        │ Authorization: Bearer <JWT>
        ▼
FastAPI /api/v1
        │
        ├─ 身份认证与数据归属校验
        ├─ Pydantic 参数校验
        ├─ SQLAlchemy 事务
        └─ Alembic migration
        │
        ▼
MySQL 8 / pet_life_dev
        ▲
        │
Element Plus 管理后台（5174）
```

必须保持以下数据边界：

1. 小程序和管理后台只能访问 FastAPI，不能直接访问 MySQL。
2. FastAPI 根据 JWT 中的 `user_id` 和 `role` 判断身份。
3. 普通用户只能操作自己的购物车、地址、优惠券、订单、收藏和活动报名记录。
4. 管理员能够管理商品、分类、活动、订单和用户，但管理操作必须写入 `audit_logs`。
5. 所有金额和库存以 MySQL 提交后的值为准。

## 5. MySQL 表结构改造

当前 `0001_initial` 已经应用，禁止回头直接修改该 migration。后续通过新的 Alembic 版本增量改造。

### 5.1 保留并完善的现有表

#### `products`

保留当前商品字段，并建议增加：

```text
category_id        分类外键
cover_url          商品封面 URL
detail_images_json 详情图片列表
version            乐观锁版本号（可选）
created_at
updated_at
```

`price` 暂时可以继续使用 `DECIMAL(10,2)`，后续正式支付阶段再统一为“分”的整数金额。任何阶段都禁止使用浮点数保存金额。

#### `users`

当前只有昵称和统计字段，必须增加：

```text
username
password_hash
role                USER / ADMIN
enabled
wechat_openid       可空，正式微信登录阶段使用
created_at
updated_at
```

约束：

- `username` 唯一；
- 非空 `wechat_openid` 唯一；
- 密码只保存 Argon2 或 bcrypt 哈希；
- 禁止保存明文密码；
- 管理员和普通用户由数据库 `role` 区分。

#### `orders`

现有 `orders` 继续作为订单主表，增加：

```text
coupon_id
payment_status
remark
cancelled_at
completed_at
updated_at
```

收货人信息继续保留为订单快照，即使用户之后修改地址，历史订单也不能变化。

#### `lottery_activities`

保留活动主表，但进行以下调整：

- `participant_count` 不再由 Seed 写固定值；
- 列表和详情优先使用 `COUNT(lottery_participants.id)` 计算；
- 开奖后可以把最终人数快照写入活动表；
- `winners_json` 迁移到中奖记录表后废弃；
- 当前活动由状态和时间查询，不固定 ID。

### 5.2 新增核心表

#### `product_categories`

```text
id
name
sort_order
enabled
created_at
updated_at
```

小程序分类栏和管理后台分类选择统一查询此表，不再把业务分类只写在前端数组和 Pydantic 正则中。

#### `cart_items`

```text
id
user_id
product_id
quantity
created_at
updated_at
UNIQUE(user_id, product_id)
```

购物车不保存商品名称和价格副本，展示时关联当前商品；创建订单时才生成不可变订单快照。

#### `addresses`

```text
id
user_id
receiver_name
phone
province
city
district
detail
is_default
created_at
updated_at
```

每个用户最多一个默认地址。设为默认地址时，在同一事务中取消该用户其他地址的默认状态。

#### `favorites`

```text
id
user_id
product_id
created_at
UNIQUE(user_id, product_id)
```

#### `coupons`

```text
id
name
threshold_amount
discount_amount
start_at
end_at
enabled
created_at
updated_at
```

#### `user_coupons`

```text
id
user_id
coupon_id
status              AVAILABLE / USED / EXPIRED
order_id
received_at
used_at
UNIQUE(user_id, coupon_id, received_at)
```

#### `order_items`

```text
id
order_id
product_id
product_name
product_image_url
unit_price
quantity
line_amount
```

订单创建后，小程序订单详情和管理后台订单详情都读取 `order_items`，不再限制一张订单只能购买一个商品。

#### `inventory_records`

```text
id
product_id
change_quantity
before_stock
after_stock
business_type       ORDER_CREATE / ORDER_CANCEL / ADMIN_ADJUST
business_id
created_at
```

#### `payments`

```text
id
payment_no
order_id
provider            MANUAL / WECHAT
amount
status              PENDING / SUCCESS / FAILED / REFUNDED
provider_transaction_id
confirmed_by
confirmed_at
created_at
updated_at
UNIQUE(payment_no)
UNIQUE(provider_transaction_id)  -- 允许空值
```

Local-First 阶段使用 `provider=MANUAL`，由管理后台人工确认。正式接入微信支付时复用此表，不改变订单主流程。

#### `lottery_prizes`

```text
id
activity_id
level_name
prize_name
quantity
sort_order
```

#### `lottery_winners`

```text
id
activity_id
participant_id
user_id
prize_id
created_at
UNIQUE(activity_id, participant_id)
```

中奖结果从真实报名记录中产生，不再从固定 JSON 名单返回。

## 6. Alembic migration 规划

建议按可验证的小步迁移，不把全部结构塞进一个 migration。

### `0002_database_auth_and_categories`

1. 扩展 `users` 的登录、角色和启停字段。
2. 创建 `product_categories`。
3. 给 `products` 增加 `category_id`、图片和时间字段。
4. 把现有“爬宠、用品、套餐”去重写入分类表。
5. 根据旧 `products.category` 回填 `category_id`。
6. 创建本地管理员和本地普通用户时使用一次性初始化命令，不在 migration 中写明文密码。

### `0003_cart_address_favorite_coupon`

创建：

```text
cart_items
addresses
favorites
coupons
user_coupons
```

旧前端固定地址和固定优惠券不迁移，直接删除；需要联调的数据通过后台或显式 development 初始化命令创建。

### `0004_order_items_inventory_payments`

1. 创建 `order_items`、`inventory_records`、`payments`。
2. 扩展 `orders` 状态和关联字段。
3. 把现有单商品订单转换成一条 `order_items` 快照。
4. 对现有 `PAID` 本地联调订单生成明确标注为 `MANUAL` 的历史支付记录，或在备份后清理该联调订单。

### `0005_lottery_normalization`

1. 创建 `lottery_prizes` 和 `lottery_winners`。
2. 将活动奖项配置从 `prizes_json` 转换到奖项表。
3. 删除 Seed 造成的固定报名人数和固定中奖名单。
4. 报名人数以 `lottery_participants` 实际行数为准。
5. 确认业务数据完成转换后，再在后续 migration 中删除废弃 JSON 字段。

### migration 验收

```powershell
cd E:\bishe27\wxMiniProgram\backend
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic current
.\.venv\Scripts\python.exe -m alembic heads
```

要求 `current` 与 `heads` 完全一致，并对每个 migration 至少验证一次 downgrade 能否恢复上一版本。

## 7. FastAPI 接口改造

建议把当前集中在 `app/main.py` 的业务路由按模块拆分，但只做必要拆分，不改动无关功能：

```text
backend/app/api/v1/auth.py
backend/app/api/v1/products.py
backend/app/api/v1/cart.py
backend/app/api/v1/addresses.py
backend/app/api/v1/orders.py
backend/app/api/v1/payments.py
backend/app/api/v1/lottery.py
backend/app/api/v1/profile.py
backend/app/api/v1/admin.py
```

### 7.1 身份认证

Local-First 阶段先完成数据库账号登录：

```text
POST /api/v1/auth/login
GET  /api/v1/auth/me
POST /api/v1/auth/logout
```

登录过程：

```text
账号和密码
→ 查询 users
→ 检查 enabled
→ 验证 password_hash
→ 签发包含 user_id、role、exp 的 JWT
→ 小程序/后台保存 token
```

普通接口使用 `get_current_user()`，管理员接口再叠加 `require_role("ADMIN")`。删除固定 `ADMIN_TOKEN` 和所有 `user_id=1`。

### 7.2 商品与分类

```text
GET /api/v1/categories
GET /api/v1/products
GET /api/v1/products/{id}
GET /api/v1/products/{id}/favorite
PUT /api/v1/products/{id}/favorite
DELETE /api/v1/products/{id}/favorite
```

管理端保留现有商品 CRUD，并补充分类 CRUD、图片 URL 和库存调整记录。

### 7.3 购物车

```text
GET    /api/v1/cart
POST   /api/v1/cart/items
PUT    /api/v1/cart/items/{id}
DELETE /api/v1/cart/items/{id}
DELETE /api/v1/cart
```

后端根据 JWT 获取用户，禁止小程序传入 `user_id`。

### 7.4 收货地址

```text
GET    /api/v1/addresses
POST   /api/v1/addresses
PUT    /api/v1/addresses/{id}
DELETE /api/v1/addresses/{id}
PUT    /api/v1/addresses/{id}/default
```

每个接口都必须校验地址属于当前用户。

### 7.5 优惠券与订单试算

```text
GET  /api/v1/coupons/available
POST /api/v1/orders/preview
POST /api/v1/orders
GET  /api/v1/orders
GET  /api/v1/orders/{id}
POST /api/v1/orders/{id}/cancel
```

`orders/preview` 和 `orders` 只接收：

```text
cart_item_ids
address_id
user_coupon_id（可选）
remark（可选）
```

商品价格、优惠金额、运费和订单总额全部由后端查询 MySQL 后计算。

### 7.6 Local-First 支付

```text
POST /api/v1/orders/{id}/payment-request
GET  /api/v1/orders/{id}/payment

PUT  /api/v1/admin/payments/{id}/confirm
PUT  /api/v1/admin/payments/{id}/fail
```

小程序提交付款请求后只显示“等待确认”，不能直接调用接口把订单改成 `PAID`。管理员确认时在一个事务中：

```text
锁定 payment
→ 检查幂等状态
→ payment=PENDING → SUCCESS
→ order=PENDING_PAYMENT → PAID
→ 写 audit_logs
→ commit
```

### 7.7 抽奖活动

```text
GET  /api/v1/lottery/activities/current
GET  /api/v1/lottery/activities/{id}
POST /api/v1/lottery/activities/{id}/join
GET  /api/v1/lottery/activities/{id}/result
```

关键修改：

- 当前活动按 `status`、`registration_start_at`、`registration_end_at` 查询；
- 报名记录写入当前 JWT 用户；
- 唯一约束继续防止重复报名；
- 报名人数来自实际报名记录；
- 开奖只从真实参与人中抽取；
- `my_result` 根据当前用户的中奖记录计算，不再固定返回未中奖和 10 积分。

## 8. 小程序端逐页改造

### 8.1 统一请求层

修改 `apps/miniprogram/src/api/http.ts`：

1. 删除 `X-Demo-User`。
2. 从认证 Store 读取 JWT。
3. 添加 `Authorization: Bearer <token>`。
4. 统一处理 401，清理 token 并跳转登录页。
5. 继续保留统一超时和错误解析。
6. H5 与微信小程序使用各自环境变量配置 API 地址。

### 8.2 新增认证 Store 和登录页

建议新增：

```text
src/stores/auth.ts
src/api/auth.ts
src/pages/login/index.vue
```

Store 提供：

```text
login()
restoreSession()
loadCurrentUser()
logout()
```

### 8.3 首页与商城

现有商品查询已经走 API，主要改造：

- 分类从 `GET /categories` 获取；
- 排序和关键字建议交给后端参数处理；
- 管理后台商品上下架、价格和库存修改后，小程序刷新得到最新值；
- 商品图片使用数据库 `cover_url`，本地图形组件只作为加载失败时的回退资源。

### 8.4 商品详情

修改 `pages/product/detail.vue`：

- 收藏状态从 API 查询；
- 收藏/取消收藏调用 MySQL 写接口；
- 加入购物车调用 `POST /cart/items`；
- 后端返回库存不足时展示明确错误。

### 8.5 购物车

修改 `stores/cart.ts` 和 `pages/cart/index.vue`：

- Store 只缓存 API 查询结果，不再是最终数据源；
- 页面进入时调用 `GET /cart`；
- 加减数量和删除均调用接口；
- 写入成功后重新查询购物车；
- 结算提交选中的 `cart_item_ids`，不只取第一件商品。

### 8.6 确认订单

修改 `pages/checkout/index.vue`：

- 删除源码中的固定姓名、手机号和地址；
- 读取默认地址并支持进入地址管理页；
- 可用优惠券从 API 获取；
- 调用 `orders/preview` 展示服务端试算结果；
- 创建订单后展示服务端返回金额；
- 付款按钮改为创建付款请求，状态显示“等待后台确认”。

### 8.7 我的页面

修改 `pages/profile/index.vue`：

- 用户资料来自 `/auth/me` 或 `/me`；
- 订单数量按真实订单状态统计；
- 最近订单读取当前用户的订单；
- 收藏数量查询 `favorites`；
- 删除当前没有数据库功能支撑的固定“我的萌宠”和固定提醒数组区块；
- 保留订单、收藏、地址、优惠券等本次商城范围内的入口。

### 8.8 活动和结果页

现有页面可以保留视觉结构，但数据全部改为：

- 当前用户的真实报名状态；
- 真实报名记录数量；
- 真实奖项表；
- 真实中奖记录；
- 当前用户对应的 `my_result`。

头像图标等装饰性 UI 可以保留，不参与人数和中奖计算。

## 9. Element Plus 管理后台改造

现有管理端已经能操作 MySQL 商品、活动和订单，不需要重写。应在此基础上补齐：

1. 管理员改为数据库账号登录和 JWT。
2. 商品管理补充分类、封面 URL 和库存调整。
3. 新增分类管理。
4. 新增用户列表和启停操作。
5. 订单页展示 `order_items`、优惠、付款状态和收货快照。
6. 新增待确认付款列表和人工确认按钮。
7. 活动管理展示真实报名数、真实名单和中奖记录。
8. 所有新增、编辑、启停、确认付款、发货和开奖操作写入 `audit_logs`。

建议在功能扩充前把当前单文件 `App.vue` 按最小必要范围拆为：

```text
src/api/
src/views/LoginView.vue
src/views/DashboardView.vue
src/views/ProductView.vue
src/views/CategoryView.vue
src/views/UserView.vue
src/views/OrderView.vue
src/views/PaymentView.vue
src/views/ActivityView.vue
src/views/AuditView.vue
src/types/
```

该拆分服务于后续 CRUD，不进行与功能无关的视觉重构。

## 10. 订单、库存和优惠券事务

创建订单必须在一个数据库事务中完成：

```text
验证当前用户和地址归属
→ 查询购物车项
→ 锁定商品或执行带库存条件的 UPDATE
→ 校验商品在售状态和库存
→ 查询并校验用户优惠券
→ 服务端计算金额
→ 创建 orders
→ 创建 order_items 快照
→ 扣减 products.stock
→ 创建 inventory_records
→ 核销 user_coupons
→ 清理已结算 cart_items
→ commit
```

任一步骤失败都必须 rollback，不能出现“订单创建成功但库存未扣”“优惠券已使用但订单失败”等半完成状态。

取消未支付订单时，在一个事务中恢复库存、写库存流水、释放优惠券并更新订单状态。

## 11. Seed 和 Mock 数据清理策略

“删除 Mock 数据”不能直接执行 `TRUNCATE` 或删除整张表，正确流程如下：

1. 先备份 `pet_life_dev`。
2. 给联调记录增加可识别前缀，例如 `DEV-` 或 `TEST-<uuid>`。
3. 通过 Alembic 修复结构，通过专用清理脚本删除明确的演示记录。
4. 保留用户在管理后台新增且希望继续使用的商品。
5. 删除固定 Seed 活动人数和固定中奖名单。
6. 自动化测试只清理本次 UUID 对应的数据。
7. 移除 FastAPI 启动时的 `seed_database()`。
8. 如需首次开发数据，提供显式命令，例如：

```powershell
.\.venv\Scripts\python.exe -m app.cli.init_dev_data
```

该命令只能在 `APP_ENV=development` 时运行；production 禁止执行。

### 改造前备份命令

```powershell
New-Item -ItemType Directory -Force .\backups | Out-Null
mysqldump -h 127.0.0.1 -P 3306 -u root -p `
  --single-transaction `
  --routines `
  --triggers `
  --set-gtid-purged=OFF `
  --default-character-set=utf8mb4 `
  pet_life_dev > .\backups\pet_life_dev_before_mock_cleanup.sql
```

备份目录必须加入 `.gitignore`，并确认 SQL 文件存在且大小不为零。

## 12. 三阶段实施顺序

### 第一阶段：真实身份和基础数据源

目标：先消除最危险的固定身份，并证明后台商品修改能实时进入小程序。

任务：

1. 完成数据库备份。
2. 执行 `0002_database_auth_and_categories`。
3. 实现数据库用户、密码哈希和 JWT。
4. 删除 `X-Demo-User` 和所有 `user_id=1`。
5. 小程序增加登录页和认证 Store。
6. 分类改为 MySQL 查询。
7. 移除启动时 `create_all()` 和自动 Seed。
8. 联调“后台改商品 → 小程序刷新显示”。

第一阶段验收：

- 两个普通测试账号只能看到各自数据；
- 后台账号不能使用普通用户接口伪造他人数据；
- 管理后台修改商品价格、库存和上下架后，小程序显示一致；
- Alembic `current=heads`。

### 第二阶段：购物车、地址和订单闭环

目标：删除小程序内存购物车、固定地址、固定优惠券和单商品订单限制。

任务：

1. 执行 `0003`、`0004` migration。
2. 完成购物车、地址、收藏和优惠券 API。
3. 完成订单试算、订单明细、库存事务和取消恢复库存。
4. 小程序逐页切换到 API。
5. 管理后台补充订单详情、库存流水和付款管理。
6. 将“本地模拟支付成功”替换为人工确认付款。

第二阶段验收：

- 小程序加入购物车后刷新页面数据仍存在；
- 创建订单后管理后台立即可见；
- 后台确认付款后小程序订单变为已支付；
- 库存、订单明细、优惠券和付款记录保持一致；
- 用户不能查询或修改其他用户的订单和地址。

### 第三阶段：活动真实化、清理和全链路验收

目标：删除固定活动人数、固定中奖名单和剩余占位业务数据。

任务：

1. 执行 `0005_lottery_normalization`。
2. 报名人数改为真实记录统计。
3. 开奖结果写入中奖表。
4. 删除固定 `pets/reminders` 页面数据和无后端支撑的占位入口。
5. 移除自动 Seed 和本地直接支付接口。
6. 运行 API 测试、管理端构建、H5 构建和微信小程序构建。
7. 使用浏览器和微信开发者工具完成可视化联调。
8. 精确清理自动化测试记录。

第三阶段验收：

- MySQL 报名行数与页面人数一致；
- 开奖名单中的每个用户都存在真实报名记录；
- 小程序和后台的商品、订单、付款、活动状态一致；
- `rg` 不再发现固定用户、固定地址、固定优惠券和固定中奖名单；
- production 配置不能访问 development 支付或 Seed 入口。

## 13. 跨端联调验收矩阵

| 场景 | 操作端 | 验收端 | MySQL 证据 |
|---|---|---|---|
| 管理员新增商品 | 管理后台 | 小程序商品列表和详情 | `products` 新增 |
| 管理员修改价格 | 管理后台 | 小程序刷新显示新价格 | `products.price` 更新，`audit_logs` 新增 |
| 管理员下架商品 | 管理后台 | 小程序列表不可见 | `products.is_active=0` |
| 用户加入购物车 | 小程序 | 刷新后购物车仍存在 | `cart_items` 新增/更新 |
| 用户收藏商品 | 小程序 | 我的收藏可见 | `favorites` 新增 |
| 用户新增地址 | 小程序 | 结算页可选 | `addresses` 新增 |
| 用户创建订单 | 小程序 | 管理后台订单列表 | `orders`、`order_items`、`inventory_records` 新增 |
| 用户使用优惠券 | 小程序 | 后台订单优惠一致 | `user_coupons=USED`、订单金额一致 |
| 用户申请付款 | 小程序 | 后台待确认付款列表 | `payments=PENDING` |
| 管理员确认付款 | 管理后台 | 小程序订单变为已支付 | `payments=SUCCESS`、`orders=PAID` |
| 管理员发货 | 管理后台 | 小程序显示物流信息 | `orders=SHIPPED`、运单字段更新 |
| 用户报名活动 | 小程序 | 后台报名名单 | `lottery_participants` 新增 |
| 管理员开奖 | 管理后台 | 小程序结果页 | `lottery_winners` 新增 |

## 14. 自动化测试计划

### 后端 API 集成测试

至少覆盖：

```text
登录成功、密码错误、禁用用户
普通用户访问管理员接口返回 403
两个用户的数据隔离
商品上下架与小程序查询
购物车增删改查
地址归属和默认地址切换
订单试算与服务端金额
库存不足和并发扣减
优惠券重复使用
订单取消恢复库存
付款重复确认的幂等性
活动重复报名
真实报名人数和开奖结果
```

### 前端检查

```powershell
cd E:\bishe27\wxMiniProgram\apps\miniprogram
pnpm.cmd type-check
pnpm.cmd lint
pnpm.cmd build:h5
pnpm.cmd build:mp-weixin

cd E:\bishe27\wxMiniProgram\apps\admin-web
npm run build
```

### 后端检查

```powershell
cd E:\bishe27\wxMiniProgram\backend
.\.venv\Scripts\python.exe -m ruff check app migrations tests
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m alembic current
.\.venv\Scripts\python.exe -m alembic heads
```

自动化测试数据库必须与 `pet_life_dev` 隔离，不允许测试运行时删除 development 中的真实联调记录。

## 15. 预计修改文件

### 后端

```text
backend/app/main.py
backend/app/core/config.py
backend/app/core/security.py
backend/app/models/entities.py
backend/app/schemas/api.py
backend/app/schemas/admin.py
backend/app/api/v1/*.py
backend/app/services/seed.py
backend/migrations/versions/0002_*.py
backend/migrations/versions/0003_*.py
backend/migrations/versions/0004_*.py
backend/migrations/versions/0005_*.py
backend/tests/*.py
```

### 小程序

```text
apps/miniprogram/src/api/http.ts
apps/miniprogram/src/api/auth.ts
apps/miniprogram/src/api/product.ts
apps/miniprogram/src/api/cart.ts
apps/miniprogram/src/api/address.ts
apps/miniprogram/src/api/order.ts
apps/miniprogram/src/api/lottery.ts
apps/miniprogram/src/stores/auth.ts
apps/miniprogram/src/stores/cart.ts
apps/miniprogram/src/pages/login/index.vue
apps/miniprogram/src/pages/home/index.vue
apps/miniprogram/src/pages/mall/index.vue
apps/miniprogram/src/pages/product/detail.vue
apps/miniprogram/src/pages/cart/index.vue
apps/miniprogram/src/pages/checkout/index.vue
apps/miniprogram/src/pages/profile/index.vue
apps/miniprogram/src/pages/lottery/*.vue
apps/miniprogram/src/models/index.ts
apps/miniprogram/src/pages.json
```

### 管理后台

```text
apps/admin-web/src/api.ts
apps/admin-web/src/App.vue
apps/admin-web/src/views/*.vue
apps/admin-web/src/types/*.ts
```

## 16. 最终验收清单

- [ ] 已生成并验证改造前 MySQL 备份。
- [ ] `0001_initial` 未被直接修改，所有变化使用新 migration。
- [ ] Alembic `current` 与 `heads` 一致。
- [ ] FastAPI 启动不再调用 `Base.metadata.create_all()`。
- [ ] FastAPI 启动不再自动写入 Seed 业务数据。
- [ ] 小程序请求中不存在 `X-Demo-User`。
- [ ] 后端业务代码中不存在固定 `user_id=1`。
- [ ] 普通用户和管理员均使用数据库账号、密码哈希和 JWT。
- [ ] 商品分类、商品、购物车、地址、收藏、优惠券、订单、支付和活动来自 MySQL。
- [ ] 购物车刷新后不丢失。
- [ ] 订单支持多商品快照。
- [ ] 订单金额由后端计算。
- [ ] 创建/取消订单与库存变化处于同一事务。
- [ ] 本地付款具有 MySQL 记录并由后台确认。
- [ ] 活动人数等于实际报名记录数。
- [ ] 中奖结果来自实际报名用户。
- [ ] 管理后台修改商品后小程序能看到同一条记录。
- [ ] 小程序创建订单后管理后台能处理同一张订单。
- [ ] 后端测试、管理后台构建、H5 构建和微信小程序构建通过。
- [ ] 浏览器控制台和微信开发者工具无阻断性错误。
- [ ] 测试记录按唯一标记精确清理。
- [ ] 未修改本项目范围外的业务代码。

## 17. 实施结论

本项目当前已经完成了“商品、活动、订单和管理后台能够连接 MySQL”的第一层基础，但还没有完成“真实用户、真实购物车、真实地址、真实优惠券、真实付款记录和真实活动统计”的完整闭环。

因此本次改造的核心不是再次切换数据库连接，而是：

```text
保留现有 MySQL 商品/活动/订单基础
+ 数据库用户与 JWT
+ 购物车/地址/收藏/优惠券表
+ 订单明细/库存流水/付款记录
+ 抽奖报名与中奖记录一致性
+ 小程序逐页 API 化
+ 管理后台跨端联调
+ Alembic 可回滚迁移
+ 精确删除 Seed 和固定业务 Mock
```

按照本文三个阶段实施，可以在不重写现有项目、不修改无关模块的前提下，将当前演示型小程序升级为真正由 MySQL 支撑的小程序与后台一体化本地开发系统。
