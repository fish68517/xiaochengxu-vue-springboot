# interaction.md

# 萌宠生活商城交互规范

## 1. 全局页面关系

```text
                    ┌──────────────┐
                    │     首页      │
                    └──────┬───────┘
              ┌────────────┼─────────────┐
              │            │             │
              ▼            ▼             ▼
          萌宠商城      抽奖活动页      我的
              │            │             │
              ▼            ▼             ▼
          萌宠详情      报名/等待       我的萌宠
              │            │             │
              ▼            ▼             ▼
          下单支付      抽奖结果页      订单/活动
```

---

# 2. 商城购买主流程

```text
首页
→ 点击“爬宠”
→ 萌宠商城
→ 点击商品卡
→ 萌宠详情
→ 点击立即购买
→ 确认订单
→ 选择地址
→ 选择优惠券
→ 点击微信支付
→ 调起微信支付
→ 支付后查询订单最终状态
→ 支付成功
→ 我的订单
→ 我的萌宠
```

## 2.1 商品详情操作

### 收藏

```text
点击收藏
→ 未登录：触发登录
→ 已登录：POST 收藏接口
→ UI 改为已收藏
```

### 加购物车

```text
点击加入购物车
→ 校验商品库存
→ 加入购物车
→ Toast：已加入购物车
```

### 立即购买

```text
点击立即购买
→ 校验商品状态
→ 校验库存
→ 创建结算草稿
→ 跳转确认订单
```

---

# 3. 抽奖活动新流程

## 3.1 管理端发起

```text
管理员登录后台
→ 抽奖活动管理
→ 新建活动
→ 填写标题
→ 上传 Banner
→ 设置报名开始时间
→ 设置报名截止时间
→ 设置开奖时间
→ 配置奖项
→ 配置奖品数量
→ 填写活动规则
→ 保存草稿
→ 发布活动
```

发布之后：

```text
系统生成活动通知
→ 首页活动卡展示
→ 消息中心展示
→ 符合通知条件的用户看到活动
```

---

# 4. 用户报名交互

## 4.1 未报名

进入活动：

```text
GET /lottery/activities/{id}
GET /lottery/activities/{id}/participants/count
GET /lottery/activities/{id}/my-status
```

页面显示：

```text
报名中
当前参与人数
奖品
规则
开奖倒计时
[立即报名参加]
```

点击报名：

```text
点击立即报名
→ Button loading
→ POST /lottery/activities/{id}/join
```

成功：

```text
Toast：报名成功
→ Button 变为“已成功报名”
→ participantCount + 1
→ 保存 participationId
```

重复点击：

```text
后端返回 ALREADY_JOINED
→ 前端按“已报名”处理
```

---

# 5. 活动状态机

```text
DRAFT
  ↓ publish
PUBLISHED
  ↓ 到报名开始时间
REGISTERING
  ↓ 报名截止
WAITING_DRAW
  ↓ 到开奖时间
DRAWING
  ↓ 完成随机选取与持久化
DRAWN
  ↓ 活动结束/领奖结束
CLOSED
```

## 页面展示映射

| 状态 | UI |
|---|---|
| DRAFT | 用户不可见 |
| PUBLISHED | 活动预告 |
| REGISTERING | 可报名 |
| WAITING_DRAW | 已截止，等待开奖 |
| DRAWING | 开奖中 |
| DRAWN | 查看中奖名单 |
| CLOSED | 历史活动 |

---

# 6. 参与人数更新

活动页打开后：

首版建议：

```text
每 15~30 秒请求一次参与人数
```

接口：

```http
GET /api/v1/lottery/activities/{activityId}/stats
```

响应：

```json
{
  "participantCount": 1286,
  "recentParticipants": [
    {
      "nickname": "萌宠用户***",
      "avatarUrl": "..."
    }
  ]
}
```

后续可升级为 WebSocket/SSE，但首版不需要。

---

# 7. 开奖逻辑

## 7.1 禁止前端开奖

以下做法禁止：

```js
Math.random()
```

真实开奖只能发生在后端。

## 7.2 服务端开奖

```text
定时任务扫描 WAITING_DRAW 活动
→ current_time >= draw_time
→ 锁定活动记录
→ 状态改为 DRAWING
→ 读取有效报名用户
→ 按奖项配置生成中奖结果
→ 写 lottery_winners
→ 写审计记录
→ 状态改为 DRAWN
→ 用户端可查询结果
```

要求：

- 开奖接口幂等；
- 同一活动只能成功开奖一次；
- 一个用户是否能中多个奖由活动配置决定；
- 奖品数量不能超过实际配置；
- 中奖记录开奖后不可直接修改；
- 管理员如需补偿，必须单独产生审计记录。

---

# 8. 抽奖结果页

打开：

```text
GET /lottery/activities/{id}/result
GET /lottery/activities/{id}/my-result
```

### 未中奖

```text
我的参与结果
未中奖
感谢参与
```

### 中奖

```text
恭喜中奖
二等奖
爬宠专区优惠券
```

如果奖品需要线下/人工领取：

```text
[联系管理员领奖]
```

点击：

```text
打开客服能力 / 客服二维码页 / 管理员联系方式页面
```

不应直接在公开名单展示中奖用户完整手机号、地址。

---

# 9. 领奖状态

建议：

```text
PENDING_CONTACT
CONTACTED
VERIFIED
DELIVERED
CLAIMED
EXPIRED
```

后台流程：

```text
中奖
→ 等待用户联系
→ 管理员确认身份
→ 登记领奖方式
→ 发放奖品/优惠券
→ 标记完成
```

---

# 10. 首页活动通知

首页活动卡优先展示：

1. 报名中的活动；
2. 已报名且待开奖；
3. 已开奖但用户未查看结果；
4. 未来活动预告。

### 未报名

```text
限时抽奖活动已开启
[点击参与]
```

### 已报名

```text
您已报名
距离开奖还有 2天18小时
[查看活动]
```

### 已开奖

```text
活动已开奖
[查看结果]
```

---

# 11. 我的活动

入口：

```text
我的萌宠
→ 我的活动
```

Tab：

```text
全部
报名中
待开奖
已开奖
```

活动卡：

```text
活动名称
状态
报名时间
开奖时间
我的状态
查看详情
```

---

# 12. 异常处理

### 活动已截止

用户正准备报名时后台刚截止：

```text
POST join
→ ACTIVITY_REGISTRATION_CLOSED
→ Toast：报名已结束
→ 刷新活动状态
```

### 活动被取消

```text
ACTIVITY_CANCELLED
```

页面：

```text
活动已取消
查看活动说明
```

### 网络错误

```text
显示错误态
[重新加载]
```

### 开奖延迟

如果当前时间已超过 drawTime，但后端仍为 WAITING_DRAW：

```text
页面显示：
正在等待开奖结果
```

不要在前端强制改成已开奖。

---

# 13. 支付交互

```text
创建订单
→ 后端返回微信支付参数
→ uni.requestPayment
→ 客户端返回
→ 查询本地订单
→ 如状态未知，后端主动查微信支付
→ 返回最终状态
```

前端 `success` 不等价于订单最终支付成功。

---

# 14. 登录策略

首版建议：

- 浏览首页、商城、商品详情：可匿名；
- 报名抽奖：需要登录；
- 收藏：需要登录；
- 加购物车：建议登录；
- 下单：必须登录；
- 我的萌宠：必须登录。

---

# 15. 页面回退规则

```text
商品详情 → 返回商城
订单确认 → 返回商品详情/购物车
抽奖结果 → 返回活动页
我的萌宠 → TabBar
```

支付中禁止重复提交订单。

---

# 16. 埋点建议

```text
home_view
banner_click
activity_notice_click
mall_category_click
product_view
product_buy_click
lottery_view
lottery_join_click
lottery_join_success
lottery_result_view
coupon_use
order_submit
payment_success
my_pet_view
```
