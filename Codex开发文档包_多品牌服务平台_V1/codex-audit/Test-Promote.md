# Codex 任务：基于《手动测试用例》全面审计当前项目代码是否符合业务要求

你现在位于项目根目录：

E:\bishe27\服务平台小程序\code

这是一个 uni-app + Vue + uniCloud 的多角色服务交易平台。

当前主要目录包括：

apps/
├─ client/
├─ workbench/
└─ admin/

以及：

uniCloud-tcb/
packages/
scripts/
script/
config/
docs/

当前生产后端核心为：

game-service
system-runner
wechat-callback

生产前端通过：

uniCloud.callFunction()
→ game-service

访问业务后端。

---

# 一、任务目标

请以项目中的《手动测试用例》作为唯一业务验收基线，
对当前完整代码进行一次“测试需求 → 代码实现 → 数据模型 → 权限 → 状态机 → 前端页面”的全面审计。

目标不是简单搜索关键字，而是回答：

1. 测试用例要求的每一个功能，当前代码是否真实实现；
2. 前端是否有页面和交互；
3. 后端是否有对应 action / service；
4. Repository / Database 是否支持；
5. Schema 是否支持；
6. 权限是否正确；
7. 状态流转是否正确；
8. 是否只有 UI，但后端没有实现；
9. 是否只有后端实现，但前端没有入口；
10. 是否使用 Mock 伪装成真实功能；
11. 是否存在与测试文档不一致的实现；
12. 当前代码达到什么完成度。

不要仅根据 README 或注释判断。
必须实际阅读源码。

---

# 二、重要原则

## 1. 测试文档优先

《手动测试用例》是本次审计的业务基准。

如果：

代码逻辑 ≠ 测试文档

请标记为：

REQUIREMENT_MISMATCH

不要擅自认为代码更合理。

---

## 2. 不允许只看前端

每个测试点至少验证：

前端
↓
API Adapter
↓
game-service action
↓
service
↓
repository
↓
database/schema

如果中间任何一层缺失，都不能标记为“完全实现”。

---

## 3. 不允许把 Mock 当生产实现

重点检查：

- mock
- demo
- fixture
- seed
- fake
- memoryDb
- local api-server
- hardcoded
- TODO
- FIXME
- placeholder

如果某功能只在：

scripts/api-server.mjs
packages/backend/test/
fixture
Memory DB

中存在，而生产 game-service / uniCloud Database 中不存在：

必须标记：

LOCAL_ONLY

不能标记为生产可用。

---

## 4. 不要立即修改代码

第一阶段只审计。

不要先修代码。

先生成完整差距报告。

只有报告完成后再给出：

建议修复顺序。

---

# 三、先理解项目架构

请先扫描：

apps/client
apps/workbench
apps/admin

识别：

- pages
- components
- api.js
- store
- composables
- manifest
- routes

然后扫描：

uniCloud-tcb/cloudfunctions/game-service
apps/client/uniCloud-aliyun/cloudfunctions/game-service

重点寻找：

- index.js
- lib/auth.cjs
- lib/services.cjs
- lib/repository.cjs
- lib/privacy.cjs
- lib/commercial-ops.cjs
- 其他业务模块

再扫描：

database/
*.schema.json

并建立：

页面
→ action
→ service
→ collection

之间的映射。

---

# 四、角色模型必须重点验证

当前测试文档对应四类角色：

CUSTOMER
客户

CS / CUSTOMER_SERVICE
客服

WORKER
接单人员

ADMIN
管理员

请重点检查：

## CUSTOMER

测试文档预期：

客户通过微信/客户入口使用系统。

主要能力：

- 商品浏览
- 下单
- 支付
- 我的订单
- 订单查询
- 异议
- 订阅消息

不要假定客户必须有传统手机号密码注册。

---

## WORKER

测试文档预期：

接单人员不是自由注册。

应该：

管理员创建账号
↓
初始密码
↓
接单人员首次登录
↓
强制修改密码
↓
正常使用

还要支持：

- 实名
- 抢单
- 指派
- 退单
- 完成申请
- 钱包
- 提现

---

## CS

客服账号应由管理员创建。

客服使用：

/workbench/

进入客服工作台。

---

## ADMIN

管理员使用：

/admin/

管理员拥有：

- 员工管理
- 商品管理
- 字典配置
- VIP
- 钱包
- 退款审批
- 提现审批
- 报表
- 品牌配置

请检查：

CS / WORKER 是否能够越权登录 Admin。

---

# 五、逐条审计 42 个测试用例

必须建立 1~42 的完整测试矩阵。

---

# A. 客户下单与支付

## TC01 商品浏览

检查：

- 是否只显示上架商品
- 下架商品是否隐藏
- 是否支持游戏分类
- 商品详情是否包含：
  - 游戏
  - 服务类型
  - 档位
  - 保底产出
  - 价格

---

## TC02 下单必填校验

检查：

- H5 下单页
- 至少手机号或微信号一个联系方式
- 两者任意填写一个是否允许提交
- 是否生成订单号
- 是否生成应付金额

---

## TC03 微信内支付

检查：

- 微信环境识别
- 微信网页授权
- 支付参数
- 微信收银台
- 支付回调
- 支付后订单状态

如果当前 PAYMENT_MODE=mock，
不能标记真实支付已完成。

标记：

MOCK_ONLY

或：

NEEDS_REAL_ENVIRONMENT

---

## TC04 微信外 H5 支付

检查：

- 外部浏览器支付
- H5 微信支付
- redirect
- 回跳
- 支付结果恢复

---

## TC05 支付超时关单

检查：

待支付
↓
超时
↓
已关闭

重点看：

system-runner

以及：

支付时限配置

默认是否 30 分钟。

---

## TC06 支付成功页

检查：

- 订单号
- 复制订单号
- 联系客服
- 返回订单列表
- 客服消息是否携带订单号

---

## TC07 订单查询

检查：

- 本人订单
- 外链订单
- 订单号 + 手机号查询
- 手机号错误不能查到
- PII 是否脱敏

---

## TC08 异议提交

检查：

已结单
↓
异议窗口
↓
异议中

要求：

- 不能重复提交
- 超过异议期不能提交

---

## TC09 订阅消息

检查：

- 微信订阅授权
- 授权不影响下单
- 状态变化通知

若只存在接口占位：

标记 PARTIAL。

---

# B. 客服操作

## TC10 客服登录

检查：

/workbench/

客服登录后应进入客服工作台。

测试文档还要求：

连续输错 5 次
↓
锁定 30 分钟

如果当前开发阶段通过配置关闭此功能：

请分别报告：

代码能力：SUPPORTED
当前部署配置：DISABLED

不要简单判失败。

---

## TC11 工作台待办

检查待办：

- 新支付
- 待核对
- 异议中
- 待审批退款
- 待审批提现

检查：

- 数量
- 页面跳转
- 声音提醒

---

## TC12 订单录入

检查客服能否录入：

- 游戏
- 区服
- 服务类型
- 客户游戏账号
- 昵称
- 期望时间
- 备注

成功：

待受理
↓
待抢单

还必须有：

操作记录。

---

## TC13 抢单池与超时标记

检查：

- 入池时间
- 入池时长
- 被谁抢
- 超时标记
- 超时置顶

注意：

超时订单不能自动关闭。

---

## TC14 指派

检查：

待抢单
↓
指派待确认

接受：

→ 服务中

拒绝：

→ 待抢单

还要留下：

拒绝记录。

---

## TC15 未开工取消

检查：

客服申请
↓
退款流程
↓
管理员审批

通过：

→ 已取消

驳回：

→ 恢复原状态

---

## TC16 核对结单

检查：

服务人员提交完成
↓
待确认
↓
客服确认
↓
已结单

客服必须勾选：

已与客户确认

结单后：

接单钱包增加佣金。

---

## TC17 未达标补单

检查：

实际产出 < 保底产出

客服选择：

补单

状态：

待确认
↓
服务中
↓
待确认

并检查：

补单次数上限。

---

## TC18 未达标差额退款

例如：

保底 100
实际 80

应该支持：

20% 差额退款

同时：

追回对应佣金。

---

## TC19 服务中取消

检查：

服务中
↓
退款
↓
按未履约比例退款
↓
追回佣金
↓
已退款

---

## TC20 异议仲裁

检查：

异议中

可选择：

- 维持结单
- 全额退款
- 部分退款

退款类仲裁是否需要管理员审批。

---

## TC21 VIP

检查：

vip_list

如果手机号在 VIP 名单：

新订单自动带 VIP 标记。

---

## TC22 站内消息

检查：

客服
↔
接单人员

订单留言。

要求：

- 时间排序
- 双方可见
- 不允许修改
- 不允许删除

---

# C. 接单人员

## TC23 接单登录 + 首次改密

检查：

管理员创建接单账号
↓
初始密码
↓
首次登录
↓
强制改密

不改密：

不能使用其他功能。

---

## TC24 接单订单池

检查：

- 自动刷新，约 10 秒
- 新订单提醒
- 声音
- 角标

卡片显示：

- 游戏
- 区服
- 服务类型
- 保底
- 金额
- 期望时间

不显示佣金。

---

## TC25 抢单并发

这是重点测试。

两个 Worker 同时抢同一订单：

只能一个成功。

检查代码是否有：

- transaction
- CAS
- 条件更新
- version
- atomic update

而不是：

先 find
再普通 update

否则存在并发漏洞。

同时验证：

进行中订单上限。

测试文档示例：

3 单。

---

## TC26 退单

服务中
↓
退单
↓
待抢单

必须留下：

退单记录。

---

## TC27 指派处理

检查：

接受
拒绝
超时不处理

超时应按规则处理。

---

## TC28 完成申请

检查必填：

- 实际产出
- 至少一张截图

成功：

服务中
↓
待确认

不能重复提交。

---

## TC29 钱包与提现

检查：

- 钱包余额
- 钱包流水
- 最低提现金额
- 实名
- 周提现次数
- 冻结金额

测试文档示例：

低于 10 元不能提。

---

# D. 管理员

## TC30 管理后台登录

检查：

/admin/

只有 ADMIN 可以登录。

客服和接单人员不能登录。

---

## TC31 员工管理

检查：

- 创建 Worker
- 创建 CS
- 初始密码
- 首次改密
- 停用账号
- 实名审核
- 实名驳回

---

## TC32 商品管理

检查：

新增商品字段：

- 游戏
- 服务类型
- 档位
- 保底产出
- 单位
- 价格
- 抽成

检查：

上架
下架
客户端实时可见变化

还要检查：

违规词拦截。

---

## TC33 字典与配置

检查：

dicts
configs

支持：

- 新增字典
- 停用字典
- 支付时限
- 同时接单上限
- 周提现次数
- 起提金额

配置保存后：

刷新仍存在。

被订单引用的字典：

不能直接删除。

---

## TC34 VIP 管理

检查：

新增
删除
重复添加

---

## TC35 钱包调账与冻结

检查：

管理员可：

增加余额
减少余额
冻结提现
冻结接单
解除冻结

每次必须有：

原因
wallet transaction
audit log

---

## TC36 退款审批

检查：

退款申请

管理员：

通过
驳回

通过：

退款
+
佣金追回
+
订单状态

驳回：

恢复订单状态。

---

## TC37 提现审批

检查：

待审批提现
↓
人工打款
↓
凭证号
↓
已打款

驳回：

冻结金额恢复可用余额。

---

## TC38 报表

检查：

- 订单流水
- 接单业绩
- 提现记录
- 利润分析
- CSV
- 钱包余额对账

不能只看页面。

需要检查：

报表数据计算逻辑。

---

## TC39 品牌配置

检查：

brands
brand_config_versions
configs

支持：

- 品牌名
- AppID
- Logo
- 主题色
- 文案
- 横幅

关键要求：

改配置
不改代码
不重新发版

前端即可展示不同品牌。

---

# E. 订单状态路径

逐一验证：

P1

待支付
→ 待受理
→ 待抢单
→ 服务中
→ 待确认
→ 已结单


E1

待支付
→ 已关闭


E2

待受理 / 待抢单
→ 已取消


E3

待抢单
→ 指派待确认
→ 服务中 / 待抢单


E4

服务中
→ 待抢单


E5

服务中
→ 退款中
→ 已退款


E6

待确认
→ 服务中
→ 待确认
→ 已结单


E7

待确认
→ 退款中
→ 已退款


E8

已结单
→ 异议中
→ 已结单 / 退款中 → 已退款


E9

退款中（失败）
→ 重试
→ 已退款

请找到每个状态：

谁可以触发
对应 action
前置状态
目标状态
失败条件
是否写 order_logs
是否有审计

生成完整状态机审计表。

---

# F. 通用测试

## TC40 文案红线

扫描：

apps/client
apps/workbench
apps/admin
game-service

以及：

商品默认数据
消息文案
订单备注模板

测试文档要求不能出现指定红线词。

请输出命中：

文件
行号
文本

---

## TC41 多入口隔离

检查：

/
→ Client

/workbench/
→ Workbench

/admin/
→ Admin

验证：

页面隔离
+
后端权限隔离

不要只验证路由。

---

## TC42 手机与电脑浏览器

检查代码层面的：

- 响应式布局
- 固定宽度
- overflow
- touch
- hover-only interaction
- viewport
- 手机 Web 兼容性

无法通过静态代码确认真实性能时：

标记：

MANUAL_TEST_REQUIRED

不要伪造“已通过”。

---

# 六、额外重点：订单状态机

请专门搜索：

order status
status transition
transition
ORDER_STATUS
allowedStatus
assertStatus
updateOrder
order_logs

然后生成：

docs/code-audit/ORDER_STATE_MACHINE_AUDIT.md

内容包括：

当前代码真实状态
↓
允许的前置状态
↓
action
↓
目标状态
↓
调用角色

并与测试文档 P1/E1~E9 对照。

---

# 七、额外重点：权限矩阵

生成：

docs/code-audit/ROLE_PERMISSION_MATRIX.md

表格：

| action | CUSTOMER | CS | WORKER | ADMIN | 当前代码位置 |
|---|---|---|---|---|---|

至少包含：

authLogin
商品
订单
抢单
指派
完成
结单
退款
提现
钱包
员工
配置
VIP
品牌
报表

发现越权风险：

标记：

SECURITY_RISK

---

# 八、额外重点：生产与本地实现差异

当前项目存在：

本地：

scripts/api-server.mjs

生产：

game-service + uniCloud

请检查是否存在：

本地支持
但生产不支持

例如：

seedDb
fixture
Memory DB
demo data

生成：

docs/code-audit/LOCAL_VS_PRODUCTION.md

格式：

| 功能 | Local | Production | 是否一致 | 风险 |

---

# 九、额外重点：数据库支持情况

扫描所有 Schema。

生成：

docs/code-audit/DATABASE_MATRIX.md

格式：

| Collection | 用途 | 被哪些 Service 使用 | 对应测试用例 | Schema 是否完整 |

重点：

users
products
orders
assignments
payments
refunds
wallets
wallet_transactions
withdrawals
brands
configs
dicts
vip_list
audit_logs
order_logs

---

# 十、结果评级标准

每个测试用例只能使用以下状态：

PASS_CODE
代码完整实现，链路完整。

PARTIAL
部分实现。

FRONTEND_ONLY
只有前端。

BACKEND_ONLY
只有后端。

LOCAL_ONLY
只有本地 Mock/Memory DB。

MOCK_ONLY
生产仍为 Mock。

MISSING
未实现。

REQUIREMENT_MISMATCH
代码与测试需求不一致。

SECURITY_RISK
存在明显权限/资金/并发风险。

MANUAL_TEST_REQUIRED
静态代码无法判断，需要真实环境人工测试。

BLOCKED_BY_EXTERNAL_SERVICE
依赖微信支付、微信授权、短信等外部平台。

不要滥用 PASS。

---

# 十一、完成度计算

请计算：

总测试项：42

分别统计：

PASS_CODE
PARTIAL
MISSING
LOCAL_ONLY
MOCK_ONLY
MANUAL_TEST_REQUIRED
其他

给出两个完成度：

## Code Implementation Coverage

代码实现覆盖率。

## Production Ready Coverage

生产环境可用覆盖率。

不要把 MANUAL_TEST_REQUIRED 自动计为 PASS。

---

# 十二、最终生成以下文档

创建目录：

docs/code-audit/

生成：

1. TEST_CASE_AUDIT.md
   42 个测试用例逐项审计

2. TEST_CASE_MATRIX.md
   简明矩阵

3. ORDER_STATE_MACHINE_AUDIT.md
   状态机审计

4. ROLE_PERMISSION_MATRIX.md
   权限矩阵

5. DATABASE_MATRIX.md
   数据库映射

6. LOCAL_VS_PRODUCTION.md
   本地与生产差异

7. CODE_GAP_REPORT.md
   代码缺口

8. FIX_PRIORITY_PLAN.md
   修复优先级

9. PROJECT_READINESS_SUMMARY.md
   项目总体完成度

---

# 十三、TEST_CASE_AUDIT.md 每项必须采用统一格式

例如：

## TC25 抢单

### 测试要求
两个接单人员同时抢同一订单，只能一人成功。

### 前端实现
文件：
xxx

页面：
xxx

### API
action：
xxx

### 后端
service：
xxx

文件：
xxx:123

### Database
orders
assignments

### 并发控制
transaction / atomic / conditional update：
xxx

### 当前结论
PARTIAL

### 证据
- 文件 A 第 xx 行
- 文件 B 第 xx 行

### 问题
目前使用 find → update，
可能产生并发重复抢单。

### 修复建议
xxx

---

# 十四、修复优先级

最终按：

P0
P1
P2
P3

划分。

P0：

- 无法登录
- 无法下单
- 权限绕过
- 重复抢单
- 资金计算错误
- 退款错误
- 数据越权

P1：

- 状态机错误
- 钱包错误
- 提现错误
- 配置不生效

P2：

- 页面交互
- 消息提醒
- 体验问题

P3：

- UI
- 文案
- 非关键优化

---

# 十五、特别要求

1. 不要猜测。
2. 所有结论必须提供源码证据。
3. 每个 PASS 必须给出文件路径。
4. 如果找不到实现，明确写 MISSING。
5. 如果只能人工测试，写 MANUAL_TEST_REQUIRED。
6. 不要为了提高完成率把 Mock 标记 PASS。
7. 不要修改测试需求。
8. 第一阶段不要修改源码。
9. 完成审计后停止。
10. 最后在终端输出一个简短汇总：

=====================================
PROJECT TEST AUDIT
=====================================

Total cases:
PASS_CODE:
PARTIAL:
MISSING:
LOCAL_ONLY:
MOCK_ONLY:
MANUAL_TEST_REQUIRED:

Code coverage:
Production readiness:

P0 issues:
P1 issues:

Reports:
docs/code-audit/
=====================================

完成以后，不要自动开始修复，
等待我确认审计报告以后再进入修复阶段。