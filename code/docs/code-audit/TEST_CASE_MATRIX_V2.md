# 手动测试用例代码审计矩阵 V2

复核基线：`codex-audit/手动测试用例.pdf`，共 42 项。复核时间：2026-09-10。

> 本表只评价当前源码。`PASS_CODE` 表示代码链路满足用例，不代表云端、微信、域名或真机已验收。

| 编号 | 测试项 | V2 结论 | 本轮结论依据 |
|---|---|---|---|
| TC01 | 商品浏览 | PASS_CODE | 公开列表与详情均只返回 `ON` 商品；后台改用独立管理查询 action |
| TC02 | 下单必填校验 | PASS_CODE | 保持原有动态表单服务端校验 |
| TC03 | 微信内支付 | BLOCKED_BY_EXTERNAL_SERVICE | 需真实商户、服务号及 JSAPI 验收 |
| TC04 | 微信外 H5 支付 | BLOCKED_BY_EXTERNAL_SERVICE | 需真实 MWEB、支付回跳及浏览器验收 |
| TC05 | 支付超时关单 | MANUAL_TEST_REQUIRED | 执行逻辑已读取配置；定时触发器须在云空间实跑 |
| TC06 | 支付成功页 | PASS_CODE | 已增加携带订单号的联系客服入口 |
| TC07 | 订单查询 | PASS_CODE | 保持本人订单与联系方式校验 |
| TC08 | 异议提交 | PASS_CODE | 保持订单所有者与状态校验 |
| TC09 | 订阅消息 | BLOCKED_BY_EXTERNAL_SERVICE | 需微信模板与真机授权送达验收 |
| TC10 | 客服登录 | PASS_CODE | 保持账号、密码、角色与会话校验 |
| TC11 | 工作台待办 | PASS_CODE | 客服页面统一消费后端 `dashboard` 口径 |
| TC12 | 订单录入 | PASS_CODE | 保持必填校验，备注新增后端红线校验 |
| TC13 | 抢单池与超时标记 | MANUAL_TEST_REQUIRED | 配置已进入列表与扫描链路；真实定时触发待验收 |
| TC14 | 指派 | PASS_CODE | 指派时快照后台超时配置 |
| TC15 | 未开工取消 | BLOCKED_BY_EXTERNAL_SERVICE | 真实退款依赖微信商户回调 |
| TC16 | 核对结单 | PASS_CODE | 保持事务结算与佣金入账 |
| TC17 | 未达标补单 | PASS_CODE | 补单上限读取后台配置 |
| TC18 | 未达标差额退款 | BLOCKED_BY_EXTERNAL_SERVICE | 真实退款依赖微信商户回调 |
| TC19 | 服务中取消 | BLOCKED_BY_EXTERNAL_SERVICE | 真实退款依赖微信商户回调 |
| TC20 | 异议仲裁 | BLOCKED_BY_EXTERNAL_SERVICE | 代码闭环存在，退款完成需真实回调 |
| TC21 | VIP 自动标记 | PASS_CODE | 保持手机号/微信匹配逻辑 |
| TC22 | 站内消息 | PASS_CODE | Worker 按订单参与人、后台按品牌范围做对象级校验 |
| TC23 | 接单登录与首次改密 | PASS_CODE | 前后端统一为 12～128 位且四类字符至少三类 |
| TC24 | 接单订单池 | PASS_CODE | 进行中上限读取后端配置，并有新单声音与角标 |
| TC25 | 抢单并发 | PASS_CODE | 保持条件更新与事务控制 |
| TC26 | 退单 | PASS_CODE | 保持状态、主体和日志校验 |
| TC27 | 指派处理 | MANUAL_TEST_REQUIRED | 接受/拒绝及配置代码完成；自动超时需云端定时实跑 |
| TC28 | 完成申请 | PASS_CODE | 保持凭证上传与状态流转 |
| TC29 | 钱包与提现 | PASS_CODE | 起提金额与每周次数均读取后台配置 |
| TC30 | 管理后台登录 | PASS_CODE | 管理角色保留，客户/客服/接单人员不能进入 Admin |
| TC31 | 员工管理 | PASS_CODE | 支持 Worker/客服创建、停启用、实名通过/驳回及原因 |
| TC32 | 商品管理 | PASS_CODE | 上下架管理 action 与公开读取分离 |
| TC33 | 字典与配置 | PASS_CODE | 字典使用 `ACTIVE/DISABLED` 软状态；配置值校验并进入业务链路 |
| TC34 | VIP 管理 | PASS_CODE | 删除协议统一为 `vipId`，后端执行软停用 |
| TC35 | 钱包调账与冻结 | PASS_CODE | 保持资金流水与审计留痕 |
| TC36 | 退款审批 | BLOCKED_BY_EXTERNAL_SERVICE | 真实微信退款与回调尚待外部验收 |
| TC37 | 提现审批 | PASS_CODE | 保持七态提现、打款证据与钱包事务 |
| TC38 | 报表 | PASS_CODE | 四类报表及对账指标按 `brandScopes`/显式品牌隔离 |
| TC39 | 品牌配置 | MANUAL_TEST_REQUIRED | 源码链路存在，三端刷新与云端版本需人工验收 |
| TC40 | 文案红线 | PASS_CODE | 共享单一词表，商品、字典、订单备注、留言均由后端最终拦截 |
| TC41 | 多入口隔离 | MANUAL_TEST_REQUIRED | 三端构建通过，部署路径与真实权限跳转待人工验收 |
| TC42 | 手机与电脑浏览器 | MANUAL_TEST_REQUIRED | 响应式源码与 H5 构建通过，仍需真机浏览器矩阵 |

## V2 统计

| 状态 | 数量 |
|---|---:|
| PASS_CODE | 28 |
| PARTIAL | 0 |
| MISSING | 0 |
| REQUIREMENT_MISMATCH | 0 |
| SECURITY_RISK | 0 |
| MANUAL_TEST_REQUIRED | 6 |
| BLOCKED_BY_EXTERNAL_SERVICE | 8 |
| 合计 | 42 |

- Code Implementation Coverage：`42 / 42 = 100%`。
- Strict Code Acceptance：`28 / 42 = 66.7%`。
- 其余 14 项不是代码缺失：6 项需要部署/真机人工验收，8 项受微信等外部服务验收约束。
