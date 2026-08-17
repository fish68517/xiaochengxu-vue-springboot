# CODEX_PROMPT.md

# Codex 开发总提示词：萌宠生活商城微信小程序

你现在需要开发一个 **萌宠生活商城微信小程序**。

请严格阅读并遵守：

```text
README.md
UI_SPEC.md
interaction.md
PROJECT_STRUCTURE.md
```

不要脱离这些文档自行重新设计产品。

---

# 1. 技术栈

必须采用：

## 微信小程序

```text
uni-app
Vue 3
TypeScript
Pinia
SCSS
```

## 后端

```text
Python 3.12
FastAPI
Pydantic 2
SQLAlchemy 2.x
Alembic
MySQL 8.4 LTS（本地/自建）
```

## 管理后台

```text
Vue 3
TypeScript
Vite
Element Plus
```

## 部署

```text
Local-First：本地优先开发
Production：Docker Compose + Nginx + 腾讯云

本地开发：
- uni-app / Vue Admin 本地运行
- FastAPI 使用 uvicorn --reload
- Scheduler 使用独立 Python 进程
- MySQL 8.4 LTS 使用 Docker
- PAYMENT_MODE=mock
- STORAGE_BACKEND=local

生产环境：
- Docker Compose
- Nginx
- 腾讯云 Lighthouse
- TencentDB for MySQL（推荐）
- 腾讯云 COS
- PAYMENT_MODE=wechat
- STORAGE_BACKEND=cos
```

---


# 1.1 Local-First 本地优先开发策略

本项目必须采用 **Local-First** 开发模式：

```text
先本地完整开发和调试
→ Mock 跑通核心业务
→ 本地真实数据库验证
→ staging 联调
→ 最后切换 production 配置部署腾讯云
```

不要在前期因为：

```text
腾讯云服务器
域名
HTTPS
ICP备案
微信支付商户号
COS
TencentDB
```

尚未准备完成，而阻塞页面和业务开发。

---

## 1.1.1 三套环境

项目必须明确支持：

```text
development
staging
production
```

推荐环境变量：

```env
APP_ENV=development
```

禁止在业务代码中通过硬编码判断环境。

所有环境差异必须通过：

```text
.env
+
统一 Settings / Config
```

控制。

---

## 1.1.2 Development 本地开发模式

本地开发推荐：

```text
uni-app
    ↓
本地 Node / HBuilderX / CLI

Vue Admin
    ↓
Vite Dev Server

FastAPI
    ↓
uvicorn --reload

Scheduler
    ↓
独立 Python 进程

MySQL
    ↓
Docker MySQL 8.4 LTS
```

推荐启动方式：

```bash
# MySQL
docker compose up -d mysql

# FastAPI
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Scheduler
python -m app.tasks.scheduler

# Admin Web
pnpm dev
```

开发阶段 **不要求** 所有服务都运行在 Docker 中。

目标是：

```text
修改 Vue → 立即热更新
修改 Python → uvicorn 自动 reload
数据库保持真实 MySQL 行为
```

---

## 1.1.3 本地数据库

本地不要使用 SQLite 替代生产数据库。

必须使用：

```text
MySQL 8.4 LTS
```

原因：

```text
订单
库存
报名唯一约束
抽奖开奖
事务
行锁
幂等
```

都需要尽量在开发阶段验证真实 MySQL 行为。

推荐：

```yaml
mysql:
  image: mysql:8.4
```

---

## 1.1.4 本地支付必须支持 Mock

开发阶段必须支持：

```env
PAYMENT_MODE=mock
```

支付服务采用统一接口：

```text
PaymentService
      │
 ┌────┴─────┐
 ↓          ↓
Mock       WeChat
本地       staging / production
```

本地 Mock 支付流程：

```text
创建订单
→ 模拟支付成功
→ 更新订单为 PAID
→ 进入订单结果页
→ 我的订单可查询
```

切换生产：

```env
PAYMENT_MODE=wechat
```

页面层不得因为支付模式不同而重写业务逻辑。

---

## 1.1.5 本地文件存储与 COS 切换

开发阶段：

```env
STORAGE_BACKEND=local
```

图片保存到：

```text
data/uploads/
```

生产阶段：

```env
STORAGE_BACKEND=cos
```

通过统一接口：

```text
StorageService
      │
 ┌────┴────────┐
 ↓             ↓
LocalStorage   COSStorage
```

页面和业务服务不能直接依赖本地文件路径。

---

## 1.1.6 Scheduler 本地就必须开发

抽奖的：

```text
到点开奖
```

必须在本地阶段完成验证。

推荐：

```text
FastAPI
  │
  └── 用户报名

Scheduler
  │
  └── 每 30~60 秒扫描 WAITING_DRAW
          ↓
      draw_at <= NOW()
          ↓
      数据库事务开奖
```

禁止依赖：

```text
用户打开页面
```

才触发开奖。

禁止用前端时间作为开奖权威时间。

---

## 1.1.7 Production 生产模式

生产部署只允许通过配置切换：

```env
APP_ENV=production
PAYMENT_MODE=wechat
STORAGE_BACKEND=cos
```

数据库：

```text
优先 TencentDB for MySQL
```

图片：

```text
腾讯云 COS
```

入口：

```text
Nginx + HTTPS
```

部署：

```text
Docker Compose
```

生产拓扑：

```text
微信小程序
    ↓
  HTTPS
    ↓
  Nginx
    ↓
 FastAPI
  ↙   ↘
MySQL  COS
  ↑
Scheduler
```

---

## 1.1.8 同一份代码，多环境运行

必须保证：

```text
同一份业务代码
        │
   ┌────┴────┐
   ↓         ↓
development production
   │         │
Mock支付     微信支付
Local文件    COS
Local MySQL  TencentDB
```

不得为生产环境复制一套新的业务代码。

---

## 1.1.9 Local-First 开发优先级

开发顺序优先：

```text
1. UI
2. Mock API
3. FastAPI
4. 本地 MySQL
5. Scheduler
6. 本地完整业务闭环
7. staging
8. 微信支付
9. COS
10. 腾讯云 production
```

只有在本地核心流程通过后，才进入云端部署阶段。

---


# 2. 核心产品定义

这是：

```text
萌宠交易商城
+
抽奖运营活动
+
积分/优惠券
+
我的萌宠服务
```

不是付费抽奖平台。

严格禁止实现：

```text
支付1元抽一次
支付5元抽五次
充值购买抽奖次数
购买积分换抽奖次数
```

用户付款只能购买确定商品。

---

# 3. 商品分类

商城一级分类必须：

```text
爬宠
用品
套餐
```

其中：

```text
乌龟
小兔
```

统一归类在：

```text
爬宠
```

开发时不要再新增“乌龟”“小兔”两个一级 Tab。

---

# 4. 必须完成的 7 个页面

按照 `UI_SPEC.md` 开发：

```text
1. 首页
2. 萌宠商城
3. 萌宠详情
4. 抽奖活动页
5. 抽奖结果页
6. 下单支付
7. 我的萌宠
```

页面样式必须接近当前设计：

- 奶油白背景；
- 暖橙主色；
- 圆角卡片；
- 可爱萌宠插画/图片；
- 信息层级清晰；
- 不做过度复杂动画。

---

# 5. 抽奖功能必须按照新逻辑开发

## 管理端

```text
管理员创建活动
→ 配置报名时间
→ 配置开奖时间
→ 配置奖品
→ 配置数量
→ 配置规则
→ 发布
```

## 用户端

```text
收到活动通知
→ 打开活动
→ 查看规则
→ 查看奖品
→ 查看参与人数
→ 查看开奖时间
→ 点击报名
→ 报名成功
→ 等待开奖
→ 系统定时开奖
→ 查看结果
→ 查看完整中奖名单
→ 中奖用户联系管理员领奖
```

---

# 6. 抽奖关键规则

### 前端不能决定中奖结果

禁止：

```ts
Math.random()
```

用于真实业务开奖。

### 报名必须唯一

数据库：

```text
UNIQUE(activity_id, user_id)
```

### 开奖必须幂等

如果定时任务重复执行：

```text
同一活动不能产生第二批非预期中奖结果
```

### 中奖记录必须可审计

开奖结果一旦落库：

```text
管理员不能直接编辑历史中奖记录
```

如需补偿：

```text
新增补偿记录
+
audit_log
```

---

# 7. UI 页面状态

必须实现：

```text
loading
empty
error
success
disabled
```

抽奖：

```text
预告
报名中
已报名
报名截止
等待开奖
开奖中
已开奖
活动关闭
```

---

# 8. 活动页

必须包含：

```text
活动 Banner
活动名称
报名时间
开奖时间
倒计时
奖品列表
参与人数
最近参与用户
报名按钮
活动规则
往期中奖名单入口
客服入口
```

按钮状态：

```text
立即报名参加
已成功报名
报名已截止
等待开奖
查看开奖结果
```

---

# 9. 抽奖结果页

必须包含：

```text
活动状态：已开奖
我的参与结果
开奖时间
参与人数
中奖名单
奖项设置
领奖方式
往期中奖名单
```

如果用户中奖：

```text
显示奖项
显示奖品
显示“联系管理员领奖”
```

如果没有中奖：

```text
显示未中奖
感谢参与
```

---

# 10. 首页活动通知

首页不显示：

```text
免费抽一次
```

而应该是：

```text
限时抽奖活动已开启
春日萌宠抽奖季
报名截止：xx
[点击参与]
```

如果用户已经报名：

```text
您已报名
距离开奖还有 xx
```

如果已经开奖：

```text
活动已开奖
查看结果
```

---

# 11. API 层

所有页面不要直接写：

```ts
uni.request(...)
```

统一使用：

```text
src/api/http.ts
```

业务接口：

```text
src/api/product.ts
src/api/lottery.ts
src/api/order.ts
src/api/payment.ts
```

要求：

- 类型完整；
- 错误统一处理；
- token 自动携带；
- 401 统一处理；
- loading 不重复提交。

---

# 12. Local-First：先做 Mock，再接真实 API

如果后端尚未完成，优先使用 Mock 完成 UI 和交互闭环：

允许：

```text
mockProducts
mockLotteryActivity
mockLotteryResult
```

但是：

页面必须通过 service/api 层读取 Mock。

禁止：

```text
在 Vue 页面模板里写死大量业务数据
```

以便后续无痛替换 FastAPI。

---

# 13. 推荐开发批次

## Batch 1

```text
工程初始化
全局主题
TabBar
Navbar
Button
Card
```

## Batch 2

```text
首页
萌宠商城
ProductCard
CategoryTabs
```

## Batch 3

```text
萌宠详情
购物车
```

## Batch 4

```text
抽奖活动页
Countdown
ParticipantAvatars
报名逻辑
```

## Batch 5

```text
抽奖结果页
中奖名单
我的参与结果
```

## Batch 6

```text
确认订单
支付
订单状态
```

## Batch 7

```text
我的萌宠
我的订单
我的活动
```

## Batch 8

```text
FastAPI
MySQL 8.4 LTS（本地 Docker）
Alembic
Scheduler Worker
环境配置 Settings
```

## Batch 9

```text
后台抽奖管理
后台商品管理
```

---

# 14. Codex 每完成一个批次必须做

```text
1. pnpm/npm 构建检查
2. TypeScript 检查
3. ESLint
4. 列出新增文件
5. 列出修改文件
6. 说明尚未完成的 TODO
```

后端：

```text
pytest
ruff
mypy（如配置）
```

Local-First 额外检查：

```text
development 环境可启动
Mock 支付可跑通
LocalStorage 可上传
MySQL 8.4 可迁移
Scheduler 可独立运行
.env.example 字段完整
不依赖腾讯云也能完成核心业务演示
```

---

# 15. 不要做

未经要求不要：

- 改用 React；
- 改用原生微信小程序；
- 引入微服务；
- 引入 Kubernetes；
- 重构产品分类；
- 把兔子独立成一级分类；
- 把抽奖重新设计成即时转盘抽奖；
- 把支付和抽奖资格绑定；
- 把抽奖逻辑放到前端；
- 在 UI 中使用硬编码的开奖结果；
- 在 Git 提交密钥；
- 本地开发阶段强依赖腾讯云服务；
- 使用 SQLite 替代 MySQL 做核心交易/抽奖开发；
- 在页面代码中直接判断 development / production；
- 为生产环境复制另一套业务代码。

---

# 16. 第一阶段验收目标

至少完成：

```text
首页
↓
萌宠商城
↓
萌宠详情
↓
下单页
```

以及：

```text
首页活动通知
↓
抽奖活动页
↓
用户报名
↓
参与人数更新
↓
等待开奖
↓
抽奖结果页
```

均必须能在 **完全不依赖腾讯云、不依赖正式微信支付** 的本地 development 环境中，用 Mock API / Mock Payment 完整演示。

---

# 17. 第二阶段验收目标

后端真实实现：

```text
登录
商品
活动
报名
开奖
中奖名单
订单
支付
我的萌宠
```

并用 MySQL 保存数据。

---


# 17.1 第三阶段：生产环境切换验收目标

本地与 staging 流程稳定后，再完成：

```text
腾讯云 Lighthouse
Nginx
HTTPS
TencentDB for MySQL
腾讯云 COS
微信支付
Docker Compose
```

要求：

```text
业务代码不重写
仅通过 production 配置切换
```

生产环境必须验证：

```text
/health
数据库迁移
Scheduler
COS 上传
微信支付下单
支付回调
订单状态
抽奖开奖
日志
备份
```

---

# 18. 编码要求

- 函数职责单一；
- 页面组件化；
- TypeScript 不大量使用 `any`；
- FastAPI 使用 schema 校验；
- SQLAlchemy 使用事务；
- 订单、报名、开奖实现幂等；
- 关键操作写审计日志；
- 用户手机号、地址对普通接口脱敏；
- 错误响应使用统一 error code；
- 不允许通过前端参数控制商品最终价格；
- 不允许前端提交中奖结果。

---

# 19. 开始工作方式

执行前：

1. 阅读这 5 个 Markdown；
2. 输出你理解的页面和业务；
3. 检查现有仓库；
4. 不破坏现有可运行代码；
5. 按 Batch 顺序实施；
6. 默认先使用 `development` 环境；
7. 在腾讯云配置完成前，不得阻塞本地功能开发；
8. 优先保证本地 UI + API + MySQL + Scheduler + Mock Payment 完整闭环。

如果仓库已有组件，优先复用。

如果设计稿中的文字与文档冲突：

```text
以最新 Markdown 业务规则为准
```

特别是：

```text
乌龟 + 小兔 → 一级分类“爬宠”
```

以及：

```text
抽奖 = 后台活动通知 + 用户报名 + 定时开奖
```

这两个规则不可自行恢复为旧版本。


---

# 20. 推荐环境变量

## development

```env
APP_ENV=development
API_HOST=0.0.0.0
API_PORT=8000

DATABASE_URL=mysql+pymysql://pet_user:pet_password@127.0.0.1:3306/pet_mall

PAYMENT_MODE=mock
STORAGE_BACKEND=local
LOCAL_UPLOAD_DIR=./data/uploads

SCHEDULER_ENABLED=true
LOTTERY_SCAN_INTERVAL_SECONDS=30

LOG_LEVEL=DEBUG
```

## staging

```env
APP_ENV=staging

PAYMENT_MODE=wechat
STORAGE_BACKEND=cos

SCHEDULER_ENABLED=true

LOG_LEVEL=INFO
```

## production

```env
APP_ENV=production

DATABASE_URL=<TencentDB DSN>

PAYMENT_MODE=wechat

STORAGE_BACKEND=cos
COS_BUCKET=<bucket>
COS_REGION=<region>

SCHEDULER_ENABLED=true

LOG_LEVEL=INFO
```

真实密钥：

```text
微信支付 APIv3 Key
商户私钥
COS Secret
数据库密码
JWT Secret
```

只能放在：

```text
服务器环境变量
或
受保护的 Secret 文件
```

严禁提交 Git。

---

# 21. Local-First 最终原则

Codex 必须遵循：

```text
本地先跑通
环境可切换
业务代码不分叉
生产仅换配置
```

默认目标不是“先部署服务器”。

默认目标是：

```text
先让完整业务在本地 development 环境可靠运行
```

之后再使用同一代码仓库部署到腾讯云。

