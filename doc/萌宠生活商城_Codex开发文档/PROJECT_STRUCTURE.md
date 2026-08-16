# PROJECT_STRUCTURE.md

# 萌宠生活商城项目目录结构

```text
pet-life-mall/
├─ README.md
├─ CODEX_PROMPT.md
├─ UI_SPEC.md
├─ interaction.md
├─ PROJECT_STRUCTURE.md
│
├─ apps/
│  ├─ miniprogram/                 # uni-app 微信小程序
│  │  ├─ src/
│  │  │  ├─ pages/
│  │  │  │  ├─ home/
│  │  │  │  │  └─ index.vue
│  │  │  │  ├─ mall/
│  │  │  │  │  └─ index.vue
│  │  │  │  ├─ product/
│  │  │  │  │  └─ detail.vue
│  │  │  │  ├─ lottery/
│  │  │  │  │  ├─ detail.vue
│  │  │  │  │  ├─ result.vue
│  │  │  │  │  ├─ participants.vue
│  │  │  │  │  └─ history.vue
│  │  │  │  ├─ checkout/
│  │  │  │  │  └─ index.vue
│  │  │  │  ├─ order/
│  │  │  │  │  ├─ list.vue
│  │  │  │  │  └─ detail.vue
│  │  │  │  ├─ cart/
│  │  │  │  │  └─ index.vue
│  │  │  │  ├─ profile/
│  │  │  │  │  └─ index.vue
│  │  │  │  ├─ my-pets/
│  │  │  │  │  ├─ index.vue
│  │  │  │  │  └─ detail.vue
│  │  │  │  └─ login/
│  │  │  │     └─ index.vue
│  │  │  │
│  │  │  ├─ components/
│  │  │  │  ├─ AppNavbar.vue
│  │  │  │  ├─ AppTabBar.vue
│  │  │  │  ├─ ProductCard.vue
│  │  │  │  ├─ ProductGrid.vue
│  │  │  │  ├─ CategoryTabs.vue
│  │  │  │  ├─ ActivityNoticeCard.vue
│  │  │  │  ├─ LotteryPrizeCard.vue
│  │  │  │  ├─ Countdown.vue
│  │  │  │  ├─ ParticipantAvatars.vue
│  │  │  │  ├─ EmptyState.vue
│  │  │  │  ├─ ErrorState.vue
│  │  │  │  └─ LoadingSkeleton.vue
│  │  │  │
│  │  │  ├─ stores/
│  │  │  │  ├─ user.ts
│  │  │  │  ├─ cart.ts
│  │  │  │  ├─ lottery.ts
│  │  │  │  └─ order.ts
│  │  │  │
│  │  │  ├─ api/
│  │  │  │  ├─ http.ts
│  │  │  │  ├─ auth.ts
│  │  │  │  ├─ product.ts
│  │  │  │  ├─ lottery.ts
│  │  │  │  ├─ order.ts
│  │  │  │  ├─ payment.ts
│  │  │  │  └─ user.ts
│  │  │  │
│  │  │  ├─ models/
│  │  │  │  ├─ product.ts
│  │  │  │  ├─ lottery.ts
│  │  │  │  ├─ order.ts
│  │  │  │  └─ user.ts
│  │  │  │
│  │  │  ├─ composables/
│  │  │  │  ├─ useAuth.ts
│  │  │  │  ├─ useCountdown.ts
│  │  │  │  └─ useRequest.ts
│  │  │  │
│  │  │  ├─ utils/
│  │  │  │  ├─ money.ts
│  │  │  │  ├─ date.ts
│  │  │  │  ├─ mask.ts
│  │  │  │  └─ validator.ts
│  │  │  │
│  │  │  ├─ styles/
│  │  │  │  ├─ variables.scss
│  │  │  │  ├─ mixins.scss
│  │  │  │  └─ global.scss
│  │  │  │
│  │  │  ├─ static/
│  │  │  │  ├─ images/
│  │  │  │  └─ icons/
│  │  │  │
│  │  │  ├─ pages.json
│  │  │  ├─ manifest.json
│  │  │  └─ App.vue
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  │
│  └─ admin-web/
│     ├─ src/
│     │  ├─ views/
│     │  │  ├─ dashboard/
│     │  │  ├─ products/
│     │  │  ├─ lottery/
│     │  │  │  ├─ ActivityList.vue
│     │  │  │  ├─ ActivityEdit.vue
│     │  │  │  ├─ ParticipantList.vue
│     │  │  │  ├─ WinnerList.vue
│     │  │  │  └─ ClaimManagement.vue
│     │  │  ├─ orders/
│     │  │  ├─ users/
│     │  │  └─ audit/
│     │  ├─ api/
│     │  ├─ stores/
│     │  ├─ router/
│     │  ├─ components/
│     │  └─ utils/
│     └─ package.json
│
├─ backend/
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ core/
│  │  │  ├─ config.py
│  │  │  ├─ security.py
│  │  │  ├─ logging.py
│  │  │  └─ exceptions.py
│  │  ├─ db/
│  │  │  ├─ session.py
│  │  │  └─ base.py
│  │  ├─ models/
│  │  │  ├─ user.py
│  │  │  ├─ product.py
│  │  │  ├─ category.py
│  │  │  ├─ cart.py
│  │  │  ├─ order.py
│  │  │  ├─ payment.py
│  │  │  ├─ lottery_activity.py
│  │  │  ├─ lottery_participant.py
│  │  │  ├─ lottery_prize.py
│  │  │  ├─ lottery_winner.py
│  │  │  ├─ lottery_claim.py
│  │  │  ├─ coupon.py
│  │  │  ├─ points.py
│  │  │  ├─ pet_profile.py
│  │  │  └─ audit_log.py
│  │  ├─ schemas/
│  │  ├─ repositories/
│  │  ├─ services/
│  │  │  ├─ auth_service.py
│  │  │  ├─ product_service.py
│  │  │  ├─ order_service.py
│  │  │  ├─ payment_service.py
│  │  │  ├─ lottery_service.py
│  │  │  ├─ draw_service.py
│  │  │  ├─ notification_service.py
│  │  │  └─ pet_service.py
│  │  ├─ api/
│  │  │  └─ v1/
│  │  │     ├─ auth.py
│  │  │     ├─ products.py
│  │  │     ├─ lottery.py
│  │  │     ├─ orders.py
│  │  │     ├─ payments.py
│  │  │     ├─ profile.py
│  │  │     └─ admin/
│  │  ├─ tasks/
│  │  │  ├─ lottery_draw.py
│  │  │  └─ order_reconcile.py
│  │  └─ tests/
│  │     ├─ test_lottery.py
│  │     ├─ test_orders.py
│  │     └─ test_payment.py
│  ├─ migrations/
│  ├─ Dockerfile
│  └─ pyproject.toml
│
├─ deploy/
│  ├─ docker-compose.yml
│  ├─ nginx/
│  ├─ env.example
│  ├─ scripts/
│  │  ├─ deploy.sh
│  │  ├─ backup.sh
│  │  └─ healthcheck.sh
│  └─ README.md
│
├─ docs/
│  ├─ ui/
│  │  ├─ ui-overview.png
│  │  ├─ home.png
│  │  ├─ mall.png
│  │  ├─ product-detail.png
│  │  ├─ lottery-detail.png
│  │  ├─ lottery-result.png
│  │  ├─ checkout.png
│  │  └─ my-pets.png
│  └─ api/
│
└─ scripts/
```

---

# 1. 前端职责边界

## pages

只负责：

- 页面组合；
- 页面生命周期；
- 路由参数；
- 用户交互。

不要把复杂 HTTP、开奖逻辑、金额计算直接写在页面组件。

## api

统一封装请求：

```text
api/lottery.ts
api/product.ts
api/order.ts
```

## stores

仅存跨页面共享状态，例如：

```text
user
cart
当前活动摘要
```

不要把所有后端列表永久塞进 Pinia。

---

# 2. 后端分层

```text
API Router
    ↓
Service
    ↓
Repository
    ↓
SQLAlchemy / MySQL
```

例如报名：

```text
POST /lottery/activities/{id}/join
        ↓
lottery.py router
        ↓
LotteryService.join_activity()
        ↓
LotteryParticipantRepository
        ↓
MySQL
```

---

# 3. 抽奖核心数据库建议

## lottery_activities

```text
id
title
banner_url
description
registration_start_at
registration_end_at
draw_at
status
rules
created_by
created_at
updated_at
```

## lottery_prizes

```text
id
activity_id
level
name
prize_type
quantity
sort_order
display_image
```

## lottery_participants

```text
id
activity_id
user_id
joined_at
status
```

唯一约束：

```text
UNIQUE(activity_id, user_id)
```

## lottery_winners

```text
id
activity_id
participant_id
user_id
prize_id
draw_batch
created_at
```

## lottery_claims

```text
id
winner_id
claim_status
contacted_at
verified_at
delivered_at
claimed_at
remark
operator_id
```

---

# 4. 商品分类

建议数据库：

```text
categories
```

初始化：

```text
爬宠
用品
套餐
```

爬宠下面的商品可以通过 tag/species 字段区分：

```text
乌龟
小兔
```

而不是再建两个一级栏目。

---

# 5. API 路径建议

```http
GET    /api/v1/products
GET    /api/v1/products/{id}

GET    /api/v1/lottery/activities
GET    /api/v1/lottery/activities/{id}
POST   /api/v1/lottery/activities/{id}/join
GET    /api/v1/lottery/activities/{id}/stats
GET    /api/v1/lottery/activities/{id}/my-status
GET    /api/v1/lottery/activities/{id}/result
GET    /api/v1/lottery/activities/{id}/my-result

POST   /api/v1/orders
GET    /api/v1/orders
GET    /api/v1/orders/{id}

POST   /api/v1/payments/wechat/prepay
POST   /api/v1/payments/wechat/notify

GET    /api/v1/me
GET    /api/v1/me/pets
GET    /api/v1/me/activities
```

后台：

```http
POST   /api/v1/admin/lottery/activities
PUT    /api/v1/admin/lottery/activities/{id}
POST   /api/v1/admin/lottery/activities/{id}/publish
GET    /api/v1/admin/lottery/activities/{id}/participants
GET    /api/v1/admin/lottery/activities/{id}/winners
PUT    /api/v1/admin/lottery/claims/{id}
```

---

# 6. 不建议首版引入

```text
微服务
Kubernetes
Kafka
复杂推荐算法
Redis Cluster
Elasticsearch
```

首版先确保：

```text
uni-app
FastAPI
MySQL
Nginx
Docker Compose
```

完整跑通。
