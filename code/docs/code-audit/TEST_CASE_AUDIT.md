# 42 项手动测试用例代码审计

审计基线为《手动测试用例》。路径缩写：`C`=`apps/client/src`，`W`=`apps/workbench/src`，`A`=`apps/admin/src`，`GS`=`apps/client/uniCloud-aliyun/cloudfunctions/game-service`。腾讯云生产镜像与阿里云核心文件哈希一致。

## TC01 商品浏览

### 测试要求
只显示上架商品，支持分类，详情展示游戏、服务类型、档位、保底产出和价格。
### 前端实现
文件/页面：`C/pages/index/index.vue`、`C/pages/category/index.vue`、`C/pages/product/detail.vue`，列表再次过滤 `status==='ON'`。
### API
action：`listProducts`、`getProduct`。
### 后端
service：`GS/lib/services.cjs:601-614`；列表按品牌、游戏和 ON 状态过滤，详情按品牌返回。
### Database
`products`。
### 并发控制
只读，无并发写。
### 当前结论
PARTIAL
### 证据
- `C/pages/index/index.vue:67`
- `GS/lib/services.cjs:601-614`
### 问题
`getProduct` 没有校验商品为 ON；已知下架商品 ID 仍可直接读取详情。
### 修复建议
公开详情接口增加 ON 状态校验，并补下架详情反向测试。

## TC02 下单必填校验

### 测试要求
微信号或手机号至少一项；任填一项可提交；生成订单号和应付金额。
### 前端实现
文件/页面：`C/pages/h5-order/index.vue:122-139` 完成联系方式与手机号格式校验。
### API
action：`createOrderFromH5`。
### 后端
service：`GS/lib/services.cjs:670-744` 验 token、商品、动态表单并生成订单号/金额。
### Database
`orders`、`products`、`brands`、`commission_rules`、`vip_list`。
### 并发控制
有应用层幂等键查询；数据库唯一索引未见声明。
### 当前结论
PASS_CODE
### 证据
- `C/pages/h5-order/index.vue:122-139`
- `GS/lib/services.cjs:670-744`
### 问题
生产仍应补 `(idempotencyScope,idempotencyKey)` 唯一索引，避免并发重复下单。
### 修复建议
保留现有链路，补云数据库唯一索引和并发幂等测试。

## TC03 微信内支付

### 测试要求
识别微信环境，网页授权，拉起 JSAPI 收银台，回调后进入待受理。
### 前端实现
文件/页面：`C/pages/h5-order/index.vue:20,67,189-209,317-323`。
### API
action：`oauthExchange`、`getPaymentParams`、`payNotify`、`getPaymentStatus`。
### 后端
service：`GS/lib/services.cjs:747-828`；`GS/lib/payment-operations.cjs:51-98`。
### Database
`orders`、`payments`、`payment_events`、`customers`。
### 并发控制
支付回调以事件摘要幂等，订单由 status 条件更新。
### 当前结论
BLOCKED_BY_EXTERNAL_SERVICE
### 证据
- `C/pages/h5-order/index.vue:189-209`
- `GS/lib/payment-operations.cjs:67-95`
### 问题
源码具备真实路径，但商户号、证书、服务号 AppID、授权域名、回调公网可达性及真机收银台未验收。
### 修复建议
在 staging 用真实小额支付保存前端、微信商户平台、云函数和数据库四份证据。

## TC04 微信外 H5 支付

### 测试要求
外部浏览器使用 MWEB 支付，支持跳转、回跳和结果恢复。
### 前端实现
文件/页面：`C/pages/h5-order/index.vue:80-82,211-256` 保存 pending payment 并查询恢复。
### API
action：`getPaymentParams(payType=MWEB)`、`getPaymentStatus`。
### 后端
service：`GS/lib/services.cjs:747-825`、微信支付适配器。
### Database
`payments`、`orders`。
### 并发控制
支付单用 idempotencyKey 复用，回调使用 CAS。
### 当前结论
BLOCKED_BY_EXTERNAL_SERVICE
### 证据
- `C/pages/h5-order/index.vue:211-256`
- `GS/lib/services.cjs:749-825`
### 问题
MWEB 支付域名、redirect_url 和移动网络回跳只能在微信商户真实环境确认。
### 修复建议
分别在 Android Chrome、iOS Safari 做成功、取消、回跳丢失和刷新恢复测试。

## TC05 支付超时关单

### 测试要求
待支付超过默认 30 分钟自动关闭。
### 前端实现
订单页能显示 CLOSED；无独立定时执行入口。
### API
action：`timeoutCloseUnpaidOrders`，由 `system-runner` 内部签名调用。
### 后端
service：`GS/lib/services.cjs:1826-1843`，领域截止计算见 `packages/domain/src/order-machine.js:35,80-108`。
### Database
`orders`、`order_logs`、`system_nonces`、`audit_logs`。
### 并发控制
`updateWhere({_id,status:PENDING_PAYMENT})` 与支付回调互斥。
### 当前结论
MANUAL_TEST_REQUIRED
### 证据
- `GS/lib/services.cjs:1826-1843`
- `apps/client/uniCloud-aliyun/cloudfunctions/system-runner/package.json:1-7`
### 问题
仓库内没有能证明云端定时触发器已配置的声明或部署证据。
### 修复建议
云控制台配置触发器，缩短时限验证一次，再恢复 30 分钟并保存日志。

## TC06 支付成功页

### 测试要求
展示/复制订单号，联系客服，返回订单列表，客服消息携带订单号。
### 前端实现
文件/页面：`C/pages/h5-order/index.vue:6,282-305` 有订单号、复制和返回小程序。
### API
使用支付状态结果，无独立成功页 action。
### 后端
支付成功由 `payNotify/confirmMockPayment` 返回订单状态。
### Database
`orders`、`payments`。
### 并发控制
继承支付幂等控制。
### 当前结论
PARTIAL
### 证据
- `C/pages/h5-order/index.vue:6`
- `C/pages/h5-order/index.vue:282-305`
### 问题
成功态只有“请联系”提示，没有直接客服按钮，也没有从该按钮携带订单号。
### 修复建议
增加 `open-type=contact`/H5 联系方式按钮并设置含订单号的 `session-from`。

## TC07 订单查询

### 测试要求
本人订单隔离；外链订单须订单号+手机号/微信；错误联系方式查不到；PII 脱敏。
### 前端实现
文件/页面：`C/pages/order/list.vue:34-45`。
### API
action：`listMyOrders`、`queryOrderByNo`、`getMyOrder`。
### 后端
service：`GS/lib/services.cjs:617-625,837-857`。
### Database
`orders`、`order_messages`。
### 并发控制
只读；身份来自会话，公开查询按精确联系方式匹配。
### 当前结论
PASS_CODE
### 证据
- `GS/lib/services.cjs:618-625`
- `GS/lib/services.cjs:837-857`
### 问题
需在真实加密数据上确认 blind index 精确查询性能，但未发现功能缺口。
### 修复建议
做客户 A/B 越权与错误手机号回归并保留证据。

## TC08 异议提交

### 测试要求
已结单且在异议窗口内可提交；不能重复；超期拒绝；状态进入异议中。
### 前端实现
文件/页面：`C/pages/order/detail.vue:13,32-41`。
### API
action：`submitDispute`。
### 后端
service：`GS/lib/services.cjs:860-876`；领域校验 `order-machine.js:351-362`。
### Database
`orders`、`disputes`、`order_logs`、`attachments`。
### 并发控制
事务内对 SETTLED 做条件更新，并预查重复 dispute。
### 当前结论
PASS_CODE
### 证据
- `GS/lib/services.cjs:860-876`
- `packages/domain/src/order-machine.js:351-362`
### 问题
`disputes(orderId)` 唯一索引未见声明，建议加强并发重复保护。
### 修复建议
补唯一索引和同订单并发提交测试。

## TC09 订阅消息

### 测试要求
请求微信订阅授权；拒绝不影响下单；状态变化通知。
### 前端实现
文件：`C/subscribe.js:1-23`，拒绝/不可用返回 false，不阻断主流程。
### API
action：`requestSubscribe`、内部 `notify`。
### 后端
service：`GS/lib/services.cjs:927-937,1784-1789`；`GS/lib/subscribe.cjs` 扣额度并下发。
### Database
`subscribe_quota`、`notifications`。
### 并发控制
一单一模板应用层幂等；数据库复合唯一索引未见声明。
### 当前结论
BLOCKED_BY_EXTERNAL_SERVICE
### 证据
- `C/subscribe.js:1-23`
- `GS/lib/services.cjs:927-937`
### 问题
模板 ID、用户授权、access token 与真实送达无法静态确认。
### 修复建议
真实小程序分别验证允许、拒绝、模板未配置和发送失败不阻断订单。

## TC10 客服登录

### 测试要求
客服登录 `/workbench/`；连续输错 5 次锁 30 分钟。
### 前端实现
文件/页面：`W/pages/login/index.vue:27-61`，客服模式调用 `authLogin` 并跳工作台。
### API
action：`authLogin`、`getAccessProfile`。
### 后端
service：`GS/lib/auth.cjs:9-11,201-213`；持久限流见 `account-security.cjs:190-208`。
### Database
`users`、`security_rate_limits`、`login_events`、`auth_sessions`。
### 并发控制
持久限流记录和会话版本控制。
### 当前结论
PASS_CODE
### 证据
- `W/pages/login/index.vue:35-57`
- `GS/lib/account-security.cjs:190-208`
### 问题
真实云函数配额耗尽时登录仍会失败，这属于基础设施而非账号密码逻辑。
### 修复建议
在部署验收中增加锁定倒计时、解锁和云函数容量检查。

## TC11 工作台待办

### 测试要求
新支付、待核对、异议、待退款、待提现的数量、跳转和声音提醒。
### 前端实现
文件/页面：`W/pages/cs/workbench.vue:21-77`，五卡片、10 秒刷新、总数增加时响铃。
### API
action：页面调用 `listOrders`、`listWithdrawals`；后端另有 `dashboard`。
### 后端
service：`GS/lib/services.cjs:1886-1908` 可按品牌统计 8 项，但页面未使用。
### Database
`orders`、`refunds`、`withdrawals`、`disputes`。
### 并发控制
只读聚合。
### 当前结论
PARTIAL
### 证据
- `W/pages/cs/workbench.vue:38-54`
- `GS/lib/services.cjs:1886-1908`
### 问题
页面自行统计；提现仅计 `PENDING_REVIEW`，遗漏七态中的 SUBMITTED/REVIEWING 等；退款按订单 REFUNDING 粗计。
### 修复建议
改用 `dashboard` 统一口径并让每张卡跳到同一筛选集合。

## TC12 订单录入

### 测试要求
客服录入六个必填和备注，待受理转待抢单并记录操作。
### 前端实现
文件/页面：`W/pages/cs/order-detail.vue:18-21,80,130-136`。
### API
action：`enterOrder`。
### 后端
service：`GS/lib/services.cjs:994-1008`；领域必填校验 `order-machine.js:155-190`。
### Database
`orders`、`order_logs`。
### 并发控制
统一 `transition` 对 PENDING_ACCEPT 条件更新并同事务写日志。
### 当前结论
PASS_CODE
### 证据
- `W/pages/cs/order-detail.vue:130-136`
- `GS/lib/services.cjs:994-1008`
### 问题
无阻断性缺口；字典选择体验另计 TC33。
### 修复建议
增加品牌字典下拉和真实页面回归。

## TC13 抢单池与超时标记

### 测试要求
显示入池时间/时长/被谁抢；按配置超时标记并置顶，不能自动关闭。
### 前端实现
文件/页面：`W/pages/cs/pool.vue:2-20` 有时长、超时样式与置顶。
### API
action：`listPool`、`timeoutMarkPool`。
### 后端
service：`GS/lib/services.cjs:978-991,1846-1856` 只打 `poolTimeout`，不关单。
### Database
`orders`、`configs`。
### 并发控制
定时扫描的标记更新未用条件更新；重复执行基本幂等。
### 当前结论
REQUIREMENT_MISMATCH
### 证据
- `W/pages/cs/pool.vue:18-20`
- `GS/lib/services.cjs:1851-1854`
### 问题
前端硬编码 30 分钟且检查 `order.timeout`，后端字段为 `poolTimeout`；后端也没有读取 `poolTimeoutMinutes` 配置。
### 修复建议
统一字段名，服务端读取配置/订单快照并返回 `pooledTimeout`，前端只使用服务端结论。

## TC14 指派

### 测试要求
待抢单→指派待确认；接受→服务中；拒绝→待抢单；保留拒绝记录。
### 前端实现
文件/页面：`W/pages/cs/pool.vue`、`W/pages/worker/hall.vue:5,21-24`。
### API
action：`assignOrder`、`acceptAssignment`、`rejectAssignment`。
### 后端
service：`GS/lib/services.cjs:1011-1023,1074-1091`。
### Database
`orders`、`assignments`、`order_logs`。
### 并发控制
状态条件更新；每次指派事件另写 assignments。
### 当前结论
PASS_CODE
### 证据
- `packages/domain/src/order-machine.js:207-239`
- `GS/lib/services.cjs:1011-1023,1074-1091`
### 问题
超时处理的配置缺口归 TC27。
### 修复建议
补真实双角色页面回归和拒绝原因必填规则确认。

## TC15 未开工取消

### 测试要求
客服申请，经管理员审批；通过变已取消，驳回恢复原状态。
### 前端实现
文件/页面：`W/pages/cs/order-detail.vue`、`W/pages/cs/approvals.vue`、`A/pages/refunds/index.vue`。
### API
action：`requestCancellation`、`approveRefund`、`rejectRefund`。
### 后端
service：`GS/lib/services.cjs:1190-1208,1247-1275`；退款执行 `payment-operations.cjs:99-129`。
### Database
`orders`、`refunds`、`payments`、`order_logs`。
### 并发控制
退款审批条件更新；退款调用/回调幂等。
### 当前结论
BLOCKED_BY_EXTERNAL_SERVICE
### 证据
- `GS/lib/services.cjs:1191-1208`
- `GS/lib/payment-operations.cjs:99-129`
### 问题
通过后的 CANCELLED 依赖真实微信退款成功；退款成功时订单日志留痕还不完整。
### 修复建议
真退款验收并补取消成功 order_log。

## TC16 核对结单

### 测试要求
完成申请→待确认→客服核对并勾选客户确认→已结单；钱包增加佣金。
### 前端实现
文件/页面：`W/pages/cs/order-detail.vue` 有核对、客户确认与结单动作。
### API
action：`verifyCompletion`、`confirmSettlement/closeOrder`。
### 后端
service：`GS/lib/services.cjs:1114-1123,1142-1183`。
### Database
`orders`、`wallets`、`wallet_transactions`、`order_logs`。
### 并发控制
订单、钱包、流水、日志在事务中；重复结单以 `completedAt` 幂等。
### 当前结论
PASS_CODE
### 证据
- `GS/lib/services.cjs:1143-1180`
- `packages/backend/test/fund-atomicity.test.js`（事务回归）
### 问题
真实数据库事务仍需 staging 验证。
### 修复建议
保留现有实现，补云端重复点击和事务失败注入测试。

## TC17 未达标补单

### 测试要求
实际产出低于保底时可补单，待确认→服务中→待确认，且有次数上限。
### 前端实现
文件/页面：`W/pages/cs/order-detail.vue` 提供补单操作。
### API
action：`reworkOrder`、后续 `submitCompletion`。
### 后端
service：`GS/lib/services.cjs:1136-1139`；领域默认上限 1 次 `order-machine.js:326-338`。
### Database
`orders`、`order_logs`。
### 并发控制
状态条件更新阻止重复并发补单。
### 当前结论
PASS_CODE
### 证据
- `packages/domain/src/order-machine.js:326-338`
- `GS/lib/services.cjs:1136-1139`
### 问题
“只有未达标才允许补单”未见强制比较，当前客服可对任意待确认订单补单。
### 修复建议
若业务要求强制未达标，补 `actualOutput < guaranteedOutput` 校验；不影响本用例给定前提下的主路径。

## TC18 未达标差额退款

### 测试要求
保底 100、实际 80 时按 20% 退款，并追回对应佣金。
### 前端实现
文件/页面：`W/pages/cs/order-detail.vue` 提供差额退款申请。
### API
action：`requestRefund`、`approveRefund`、退款回调/补偿。
### 后端
service：比例计算 `GS/lib/services.cjs:194-199,1212-1244`；追佣 `payment-operations.cjs:27-49`。
### Database
`orders`、`refunds`、`payments`、`wallets`、`wallet_transactions`。
### 并发控制
申请事务、审批 CAS、回调幂等；追佣流水 ID 基于 refundId。
### 当前结论
BLOCKED_BY_EXTERNAL_SERVICE
### 证据
- `GS/lib/services.cjs:1221-1244`
- `GS/lib/payment-operations.cjs:38-47`
### 问题
金额和追佣代码存在，但真实退款到账与通知未验收。
### 修复建议
staging 做 20% 小额真退款并对账订单、退款单、商户单和钱包流水。

## TC19 服务中取消

### 测试要求
服务中按未履约比例退款，追回佣金，最终已退款。
### 前端实现
文件/页面：`W/pages/cs/order-detail.vue` 可输入退款比例/原因。
### API
action：`requestRefund(type=partial_progress)`、`approveRefund`。
### 后端
service：`GS/lib/services.cjs:1212-1244`、`payment-operations.cjs:27-49`。
### Database
`orders`、`refunds`、`payments`、`wallets`、`wallet_transactions`。
### 并发控制
同 TC18。
### 当前结论
BLOCKED_BY_EXTERNAL_SERVICE
### 证据
- `packages/domain/src/order-machine.js:256-263`
- `GS/lib/services.cjs:1223-1235`
### 问题
未履约比例由调用方传入时没有独立进度证据校验；真退款仍未验收。
### 修复建议
确认比例授权口径并进行真实退款对账。

## TC20 异议仲裁

### 测试要求
异议中可维持结单、全额或部分退款；退款类结果仍需管理员审批。
### 前端实现
文件/页面：`A/pages/disputes/index.vue` 有开始审理和三类裁决；客服订单详情也有异议入口。
### API
action：`startDisputeReview`、`resolveDispute`、`approveRefund/rejectRefund`。
### 后端
service：`GS/lib/services.cjs:906-924,1278-1317`。
### Database
`disputes`、`orders`、`refunds`、`order_logs`、`audit_logs`。
### 并发控制
裁决写订单/异议/退款/日志事务；退款审批另做 CAS。
### 当前结论
BLOCKED_BY_EXTERNAL_SERVICE
### 证据
- `A/pages/disputes/index.vue:37`
- `GS/lib/services.cjs:1279-1315`
### 问题
维持结单代码完整；退款类最终完成依赖真实退款。部分退款必须显式比例。
### 修复建议
分别完成三条真实环境路径并检查审批职责分离。

## TC21 VIP

### 测试要求
手机号在 `vip_list` 时新订单自动带 VIP 标记。
### 前端实现
管理页：`A/pages/vips/index.vue`；下单结果由订单字段展示/使用。
### API
action：`addVip/listVips`、`createOrderFromH5`。
### 后端
service：`GS/lib/services.cjs:201-207,670-744,1614-1629`。
### Database
`vip_list`、`orders`。
### 并发控制
下单时读取 ACTIVE VIP 并写快照标记；唯一索引未声明。
### 当前结论
PASS_CODE
### 证据
- `GS/lib/services.cjs:201-207`
- `GS/lib/services.cjs:741`
### 问题
VIP 删除缺口归 TC34；多品牌 VIP 是否共享未在测试基线说明。
### 修复建议
补手机号/微信命中与非命中回归。

## TC22 站内消息

### 测试要求
客服与本订单接单人员按时间留言，双方可见，不能改删。
### 前端实现
文件/页面：`W/pages/cs/order-detail.vue` 和接单人员订单详情调用消息接口；未见编辑/删除入口。
### API
action：`sendOrderMessage`、`listOrderMessages`。
### 后端
service：`GS/lib/services.cjs:1769-1781`，按 createdAt 排序且只有新增/读取。
### Database
`order_messages`、`orders`。
### 并发控制
消息追加写；无需更新冲突控制。
### 当前结论
SECURITY_RISK
### 证据
- `GS/lib/auth.cjs:128-129`
- `GS/lib/services.cjs:1769-1781`
### 问题
WORKER 可调用接口，但 service 未验证 `order.workerId===session.userId`；读取接口连品牌检查也没有。同品牌非参与人可越权查看/发送留言。
### 修复建议
两接口统一做订单参与人和品牌范围校验，并增加跨订单反向测试。

## TC23 接单登录 + 首次改密

### 测试要求
管理员建号、初始密码、首次登录强制改密；未改密不能使用其他功能。
### 前端实现
文件/页面：`W/pages/login/index.vue:35-56` 跳资料页；`W/pages/worker/profile.vue:4,28,39-40` 修改密码。
### API
action：`createWorker`、`workerLogin`、`changePassword`。
### 后端
service：`GS/lib/services.cjs:509-516,1337-1348`；安全阻断 `account-security.cjs:218-233`。
### Database
`users`、`account_security`、`auth_sessions`、`wallets`。
### 并发控制
改密增加 securityVersion 并使旧会话失效。
### 当前结论
PARTIAL
### 证据
- `GS/lib/account-security.cjs:19-26,218-233,299-309`
- `W/pages/worker/profile.vue:39-40`
### 问题
其他 action 的强制阻断仅在 strict 环境生效；页面提示至少 8 位字母数字，后端要求至少 12 位且四类中三类，用户会被服务端拒绝。
### 修复建议
确认所有部署的 strict 口径，并复用服务端密码规则到前端；改密成功后明确要求重新登录。

## TC24 接单订单池

### 测试要求
约 10 秒刷新、新订单提示/声音/角标；卡片显示六项且不显示佣金。
### 前端实现
文件/页面：`W/pages/worker/hall.vue:1-25`，10 秒轮询、新 ID 响铃、卡片字段齐全且未展示佣金。
### API
action：`listPool`、`listMyOrders`、`grabOrder`。
### 后端
service：`GS/lib/services.cjs:978-991,1054-1071`。
### Database
`orders`。
### 并发控制
只读池 + 抢单 CAS。
### 当前结论
PARTIAL
### 证据
- `W/pages/worker/hall.vue:2-11,19-25`
- `W/common.js:123-154`
### 问题
未找到新订单角标；页面 `MAX_ACTIVE=3` 硬编码，配置改变后 UI 容量与后端不一致。
### 修复建议
后端返回当前上限和未读计数，页面移除硬编码并实现角标。

## TC25 抢单并发

### 测试要求
两个 Worker 同抢仅一人成功；同时进行中订单上限默认示例为 3。
### 前端实现
文件/页面：`W/pages/worker/hall.vue:22` 传 expectedVersion，冲突后刷新。
### API
action：`grabOrder`。
### 后端
service：`GS/lib/services.cjs:1054-1071`；通用 transition `services.cjs:174-191`。
### Database
`orders`、`assignments`、`configs`、`wallets`。
### 并发控制
version 预检 + `updateWhere({_id,status:PENDING_GRAB})` + 事务，只有一个更新成功；上限从配置读取。
### 当前结论
PASS_CODE
### 证据
- `GS/lib/services.cjs:1054-1071`
- `packages/backend/test/concurrency-idempotency.test.js`
### 问题
进行中计数与抢单不是同一数据库原子约束，极端并发抢不同订单时仍可能同时越过上限。
### 修复建议
商用高并发时增加 Worker 活跃计数原子配额；当前“同一订单只能一人”已满足。

## TC26 退单

### 测试要求
当前接单人员把服务中订单退回待抢单并保留记录。
### 前端实现
文件/页面：接单人员订单详情提供退单与原因输入。
### API
action：`releaseOrder`。
### 后端
service：`GS/lib/services.cjs:1094-1102`；领域 `order-machine.js:242-253`。
### Database
`orders`、`assignments`、`order_logs`。
### 并发控制
校验当前 workerId，并按 IN_SERVICE 条件更新。
### 当前结论
PASS_CODE
### 证据
- `packages/domain/src/order-machine.js:242-253`
- `GS/lib/services.cjs:1094-1102`
### 问题
未发现阻断性缺口。
### 修复建议
人工验证退单后原 Worker 看不到私有订单、池内重新可抢。

## TC27 指派处理

### 测试要求
接单人员可接受/拒绝；超时未处理按规则回池。
### 前端实现
文件/页面：`W/pages/worker/hall.vue:5,21-24`。
### API
action：`acceptAssignment`、`rejectAssignment`、`timeoutRejectAssignments`。
### 后端
service：`GS/lib/services.cjs:1074-1091,1859-1874`。
### Database
`orders`、`assignments`、`order_logs`、`configs`。
### 并发控制
手工处理走条件更新；超时回池用 status 条件更新。
### 当前结论
PARTIAL
### 证据
- `GS/lib/services.cjs:1859-1874`
- `apps/client/uniCloud-aliyun/cloudfunctions/system-runner/package.json:1-7`
### 问题
超时服务没有读取 `assignmentTimeoutMinutes` 配置，且定时触发器部署未证明。
### 修复建议
配置贯通并在云端缩短至 1 分钟验证自动拒绝日志。

## TC28 完成申请

### 测试要求
实际产出和至少一张截图必填；服务中→待确认；不能重复提交。
### 前端实现
文件/页面：接单人员订单详情提供数值和上传；提交按钮按 allowedActions 控制。
### API
action：`uploadFile`、`submitCompletion`。
### 后端
service：`GS/lib/services.cjs:1105-1111`；领域校验 `order-machine.js:266-280`。
### Database
`orders`、`attachments`、`order_logs`。
### 并发控制
仅 IN_SERVICE 条件更新，首次成功后重复提交失败。
### 当前结论
PASS_CODE
### 证据
- `packages/domain/src/order-machine.js:266-280`
- `GS/lib/services.cjs:1105-1111`
### 问题
生产对象存储、病毒扫描和私有 URL 仍需部署验收，但必填/状态逻辑完整。
### 修复建议
上传真实图片验证扫描、存储和客服查看。

## TC29 钱包与提现

### 测试要求
余额/流水；实名、起提 10 元、周次数、冻结和余额约束。
### 前端实现
文件/页面：`W/pages/worker/wallet.vue`、`W/pages/worker/profile.vue`。
### API
action：`getWallet`、`walletTransactions`、`applyWithdrawal`、`listWithdrawals`、`getProfile`。
### 后端
service：`GS/lib/services.cjs:1367-1381,1415-1454`；领域钱包/提现规则。
### Database
`wallets`、`wallet_transactions`、`withdrawals`、`worker_profiles`、`configs`。
### 并发控制
申请提现在事务中冻结余额并写流水；钱包 version 增加。
### 当前结论
PASS_CODE
### 证据
- `GS/lib/services.cjs:1415-1442`
- `packages/domain/src/wallet.js`
### 问题
`minWithdrawalFen` 配置未由 service 显式读取；默认 10 元满足用例，但配置能力缺口归 TC33。
### 修复建议
保留默认规则，补配置化起提金额贯通测试。

## TC30 管理后台登录

### 测试要求
只有 ADMIN 可登录 `/admin/`；CS/WORKER 必须拒绝。
### 前端实现
文件/页面：`A/pages/login/index.vue:33-52`。
### API
action：`authLogin`、`getAccessProfile`。
### 后端
service：`GS/lib/services.cjs:503-505`，action 登录接受多个后台角色。
### Database
`users`、`auth_sessions`、`user_brand_roles`。
### 并发控制
登录限流与会话版本控制。
### 当前结论
REQUIREMENT_MISMATCH
### 证据
- `A/pages/login/index.vue:33-45`
- `GS/lib/services.cjs:503-505`
### 问题
管理端允许 SUPER_ADMIN、BRAND_ADMIN、FINANCE_REVIEWER、ARBITRATOR，与“只有 ADMIN”不一致；CS/WORKER 的确被页面挡住。
### 修复建议
按测试基线收窄到 ADMIN，或先让客户书面更新测试基线再保留扩展角色。

## TC31 员工管理

### 测试要求
创建 Worker/CS、初始密码、首次改密、停用、实名通过/驳回。
### 前端实现
文件/页面：`A/pages/accounts/index.vue:4,33-38,74-109`。
### API
页面使用 `createWorker/updateWorker`；后端另有 `createStaff/updateStaff`，管理端 API/页面未完整接入。
### 后端
service：`GS/lib/services.cjs:530-570,1337-1362`。
### Database
`users`、`user_brand_roles`、`worker_profiles`、`wallets`、`audit_logs`。
### 并发控制
手机号只做应用层重复查询；停用通过 securityVersion 使会话失效。
### 当前结论
PARTIAL
### 证据
- `A/pages/accounts/index.vue:74-109`
- `GS/lib/services.cjs:530-570`
### 问题
页面只能建 Worker；没有创建 CS，也没有实名驳回按钮。后端能力未形成完整前端链路。
### 修复建议
复用账号页接入 createStaff/updateStaff，并增加实名驳回原因与审计。

## TC32 商品管理

### 测试要求
完整字段、抽成、上下架并实时影响客户端；违规词拦截。
### 前端实现
文件/页面：`A/pages/products/index.vue:15-17,131-200`，字段与上下架齐全，提交前用全量红线词表。
### API
action：`saveProduct`、`updateProductStatus`、公开 `listProducts`。
### 后端
service：`GS/lib/services.cjs:1634-1681`。
### Database
`products`、`commission_rules`、`audit_logs`。
### 并发控制
普通 upsert；version 递增，无 CAS 编辑冲突控制。
### 当前结论
REQUIREMENT_MISMATCH
### 证据
- `A/utils/redline.js:3-6`
- `GS/lib/services.cjs:47,1634-1656`
### 问题
生产后端红线词表缺“博彩、赌博、抽奖返现”，可绕过前端直接写入；公开 `getProduct` 也未拒绝 OFF。
### 修复建议
红线词同源生成且以后端为最终门禁，并增加所有词语的 API 反向测试。

## TC33 字典与配置

### 测试要求
字典新增/停用/引用后禁删；六类配置保存并刷新保留、执行生效。
### 前端实现
文件/页面：`A/pages/dicts/index.vue:80-99` 仅新增/编辑；`A/pages/configs/index.vue:66-132` 可读写配置。
### API
action：`listDicts/saveDict/getConfigs/updateConfigs`。
### 后端
service：`GS/lib/services.cjs:1686-1718`。
### Database
`dicts`、`configs`、`orders`。
### 并发控制
配置逐键 upsert，不是全量事务；字典 type+code 无数据库唯一索引声明。
### 当前结论
PARTIAL
### 证据
- `GS/lib/services.cjs:1691-1718`
- `A/pages/configs/index.vue:104-128`
### 问题
字典无停用/删除/引用保护；支付、池、指派、起提等多个保存项没有完整被业务执行读取。
### 修复建议
建立配置读取单源与订单快照；字典增加 INACTIVE 和引用检查，不做物理删除。

## TC34 VIP 管理

### 测试要求
新增、删除并拒绝重复添加。
### 前端实现
文件/页面：`A/pages/vips/index.vue:65-86`。
### API
action：`addVip`、`removeVip`、`listVips`。
### 后端
service：`GS/lib/services.cjs:1614-1629`。
### Database
`vip_list`。
### 并发控制
重复检查仅应用层查询；无复合唯一索引声明。
### 当前结论
PARTIAL
### 证据
- `A/pages/vips/index.vue:82-86`
- `GS/lib/services.cjs:1622-1625`
### 问题
前端删除发送 `matchType/matchKey`，后端只接收 `vipId`，实际会查找 undefined 并报“记录不存在”。
### 修复建议
前端传 `_id` 或后端统一按复合键；补重复并发添加唯一索引。

## TC35 钱包调账与冻结

### 测试要求
增减余额、冻结提现/接单、解冻；每次要求原因、钱包流水和审计。
### 前端实现
文件/页面：`A/pages/wallets/index.vue:160-190` 有冻结范围和调账原因。
### API
action：`adjustWallet`、`freezeWallet`。
### 后端
service：`GS/lib/services.cjs:1553-1580`；路由审计集合 `GS/index.js:73-80`。
### Database
`wallets`、`wallet_transactions`、`audit_logs`。
### 并发控制
调账事务；钱包 version 增加。冻结由路由审计并写零金额状态流水。
### 当前结论
PASS_CODE
### 证据
- `GS/lib/services.cjs:1553-1580`
- `GS/index.js:73-90`
### 问题
冻结接口本身没有要求“原因”参数，而测试要求每次必须有原因；当前审计可记录前后值但原因不足。
### 修复建议
建议把 freezeWallet 的原因也设为必填；主功能链路已完整。

## TC36 退款审批

### 测试要求
管理员通过/驳回；通过后退款、追佣、订单状态正确，驳回恢复。
### 前端实现
文件/页面：`A/pages/refunds/index.vue`、`W/pages/cs/approvals.vue`。
### API
action：`approveRefund`、`rejectRefund`。
### 后端
service：`GS/lib/services.cjs:1247-1275`；`GS/lib/payment-operations.cjs:99-129`。
### Database
`refunds`、`payments`、`orders`、`wallets`、`wallet_transactions`、`audit_logs`。
### 并发控制
审批抢占使用 status 条件更新；退款回调和追佣幂等。
### 当前结论
BLOCKED_BY_EXTERNAL_SERVICE
### 证据
- `GS/lib/payment-operations.cjs:99-129`
- `GS/lib/payment-operations.cjs:27-49`
### 问题
真实退款请求、回调、异常补偿和商户账单未验收。
### 修复建议
staging 验证通过、驳回、回调延迟、回调重复和查询补偿。

## TC37 提现审批

### 测试要求
待审批→人工打款→凭证号→已打款；驳回时冻结余额退回。
### 前端实现
文件/页面：`A/pages/withdrawals/index.vue` 提供审核、批准、出款、凭证和驳回。
### API
action：`startWithdrawalReview/approveWithdrawal/startWithdrawalPayment/markWithdrawalPaid/rejectWithdrawal`。
### 后端
service：`GS/lib/services.cjs:1472-1550`。
### Database
`withdrawals`、`transfer_records`、`wallets`、`wallet_transactions`、`attachments`。
### 并发控制
打款与驳回均在事务内变更冻结余额；重复出款受状态和 externalReference 限制。
### 当前结论
PASS_CODE
### 证据
- `GS/lib/services.cjs:1508-1531`
- `GS/lib/services.cjs:1534-1550`
### 问题
严格环境要求私有凭证和职责分离，需部署时正确配置。
### 修复建议
人工演练批准/驳回各一次，并核对三张表余额。

## TC38 报表

### 测试要求
订单、业绩、提现、利润、CSV 和钱包余额对账，计算正确。
### 前端实现
文件/页面：`A/pages/reports/index.vue:64-205` 四类报表和 CSV 导出。
### API
action：`reportOrders/reportWorkers/reportWithdrawals/reportProfit/reconcileWalletLedger`。
### 后端
service：`GS/lib/services.cjs:1723-1764,1401-1412`。
### Database
`orders`、`users`、`withdrawals`、`wallets`、`wallet_transactions`、对账集合。
### 并发控制
只读快照聚合；未提供一致性读版本。
### 当前结论
SECURITY_RISK
### 证据
- `GS/lib/auth.cjs:121-127`
- `GS/lib/services.cjs:1723-1764`
### 问题
action 对 BRAND_ADMIN/FINANCE_REVIEWER 开放，但四类 report service 读取全量集合且不按 brandScopes 过滤，存在跨品牌数据泄露。
### 修复建议
先修品牌过滤再核验计算；未修前禁止给非平台管理员开放报表。

## TC39 品牌配置

### 测试要求
品牌名、AppID、Logo、主题、文案、横幅可配置；不改代码/不发版即可展示新品牌。
### 前端实现
管理页：`A/pages/brands/index.vue:183-257`；客户端 `C/App.vue:6-10`、`C/brand.js:68-132` 动态读取并写 CSS 变量。
### API
action：`listBrands/getBrandConfig/saveBrandConfig`。
### 后端
service：`GS/lib/services.cjs:1913-1972`，发布版本快照。
### Database
`brands`、`brand_config_versions`、`configs`。
### 并发控制
版本递增，但同品牌并发编辑无 CAS；code/AppID 唯一只做应用层查询。
### 当前结论
MANUAL_TEST_REQUIRED
### 证据
- `C/brand.js:68-132`
- `GS/lib/services.cjs:1926-1972`
### 问题
代码支持运行时加载，但真实 AppID、静态资源、缓存刷新和“无需重新发版”的展示效果只能部署验证。
### 修复建议
staging 修改品牌配置，清缓存/刷新三种终端并录屏；补唯一索引。

## TC40 文案红线

### 测试要求
三端页面、商品、备注和消息不得出现测试文档列出的 13 类红线词。
### 前端实现
扫描 `apps/client/src`、`apps/workbench/src`、`apps/admin/src`；业务页面未发现红线展示命中，管理端有校验词表定义。
### API
商品保存最终由 `saveProduct` 拦截。
### 后端
service：`GS/lib/services.cjs:47,1634-1641`。
### Database
`products`，以及可能承载用户输入的 `orders/order_messages`。
### 并发控制
无关。
### 当前结论
REQUIREMENT_MISMATCH
### 证据
- `A/utils/redline.js:3-6`（完整词表定义）
- `GS/lib/services.cjs:47`（生产词表）
### 问题
生产词表能用子串覆盖“资金托管/担保交易/充值返利”，但缺少“博彩、赌博、抽奖返现”；订单备注和站内消息也未调用红线校验。
### 修复建议
共享完整词表，并在商品、订单录入备注和站内消息的服务端写入前统一校验。

## TC41 多入口隔离

### 测试要求
客户域 `/`、后台 `/workbench/`、`/admin/` 分别打开对应应用；互不暴露页面，并有后端权限隔离。
### 前端实现
三个独立 uni-app；`apps/workbench/vite.config.js:4` base 为 `/workbench/`，`apps/admin/vite.config.js:4` base 为 `/admin/`，客户端为 `/`。
### API
共享 `game-service`，受 PUBLIC/H5/ROLE_MATRIX 分类控制。
### 后端
鉴权：`GS/lib/auth.cjs:14-148,216-248`。
### Database
所有 schema 禁止客户端直连。
### 并发控制
无关。
### 当前结论
MANUAL_TEST_REQUIRED
### 证据
- `scripts/deploy-hosting.mjs:16-22`
- `GS/lib/auth.cjs:216-248`
### 问题
代码/构建 base 正确，但域名静态托管路由、回退规则和反向路径暴露只能在线验证。
### 修复建议
部署后直接请求六个正反 URL，并验证未授权 action 返回拒绝而非仅前端隐藏。

## TC42 手机与电脑浏览器

### 测试要求
微信内置浏览器、Safari、Chrome、Edge 完成登录/查单/审批；布局可用、按钮可点、列表 2 秒内加载。
### 前端实现
三端有移动断点和 viewport；现有 `scripts/e2e-ui-smoke.mjs:85-306` 覆盖部分本地视口与页面冒烟。
### API
三端 API 均有加载/错误封套，但 2 秒 SLA 依赖网络和云函数。
### 后端
生产调用记录写 operational events，可用于时延观测。
### Database
查询涉及订单、用户、退款、提现、报表集合；索引未声明会影响数据量增长后的 SLA。
### 并发控制
无关。
### 当前结论
MANUAL_TEST_REQUIRED
### 证据
- `W/pages/login/index.vue:65-69`
- `A/pages/login/index.vue:61-63`
- `scripts/e2e-ui-smoke.mjs:85-306`
### 问题
静态 CSS 和本地 Playwright 不能证明指定真机浏览器、触控、微信 WebView 和生产 2 秒性能。
### 修复建议
按测试文档设备矩阵执行真机回归，并记录 p50/p95 加载时间与失败率。

## 汇总结论

详见 `TEST_CASE_MATRIX.md`。本轮主结论为：PASS_CODE 15、PARTIAL 9、REQUIREMENT_MISMATCH 4、SECURITY_RISK 2、MANUAL_TEST_REQUIRED 4、BLOCKED_BY_EXTERNAL_SERVICE 8；其他状态均为 0。
