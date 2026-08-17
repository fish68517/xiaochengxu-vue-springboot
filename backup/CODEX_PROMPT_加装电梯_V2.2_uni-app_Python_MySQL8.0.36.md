# 加装电梯后期管理平台 — CODEX_PROMPT

> 版本：V2.2（uni-app + Python + MySQL 8.0.36 + Local-First 本地优先开发版）  
> 本提示词与 `需求.md`、`UI_SPEC.md`、`interaction.md`、`PROJECT_STRUCTURE.md`、`design/` 下 UI 图一起使用。

---

# 1. 你的角色

你是本项目的主开发工程师。需要实现：

```text
A. 业主微信小程序
B. 维修师傅移动端
C. 管理员 PC 后台
D. 对应的 API 契约 / Mock / 数据模型
```

在开始编码前先完整阅读：

```text
docs/需求.md
docs/UI_SPEC.md
docs/interaction.md
docs/PROJECT_STRUCTURE.md
design/**/*
```

---

# 1.1 Local-First：本地优先开发原则

本项目必须采用 **Local-First（本地优先开发）** 模式。Codex 的默认目标不是“先把系统部署到服务器”，而是：

```text
先让完整业务在本地 development 环境可靠运行
↓
再进入 staging 联调
↓
最后使用同一份代码切换 production 配置部署
```

开发主链路：

```text
UI / 页面
→ Mock API
→ 本地真实 API
→ 本地真实数据库
→ 本地文件上传
→ Mock 支付 / Mock 消息
→ 三端核心业务本地闭环
→ staging
→ 微信支付 / 正式消息 / 对象存储
→ production
```

不得因为以下生产资源尚未准备完成而阻塞前期开发：

```text
正式域名
HTTPS
ICP备案
微信支付商户号
微信支付 APIv3 密钥
微信订阅消息模板
生产数据库
腾讯云 COS / 其他对象存储
云服务器
正式小程序业务域名
```

本地阶段必须优先保证以下流程可完整演示：

```text
业主绑定房屋
业主查看每户不同金额的账单
Mock 缴费成功 / 取消 / 失败
缴费记录与收据申请
管理员收费标准配置
Excel / CSV 导入 → 预览 → 校验 → 入库
欠费识别 / 催缴
普通报修 → 管理员派单 → 师傅处理 → 业主查看进度
维修图片上传
维保 PDF 上传 / 查询 / 权限隔离
装修登记与线下押金状态跟踪
公告发布与消息查看
企业介绍 H5 的开发占位 / 配置模式
```

---

## 1.1.1 必须支持三套环境

项目必须统一支持：

```text
development
staging
production
```

推荐使用：

```env
APP_ENV=development
```

禁止在 uni-app Page、Vue View、业务 Service 中通过硬编码判断环境：

```ts
if (process.env.NODE_ENV === 'development') {
  // 在页面里写一套 Mock 业务
}
```

所有环境差异统一由：

```text
.env / .env.*
+
Config / Settings
+
Service Adapter
```

控制。

必须提供：

```text
.env.example
```

真实密钥、数据库密码、微信支付密钥不得提交 Git。

---

## 1.1.2 Development 本地运行拓扑与固定技术栈

本项目技术栈已明确，Codex **不得自行改回微信原生 WXML/WXSS，也不得替换为 Taro、React Native 或 Flutter**。

### 微信小程序（业主端 + 维修师傅端）

统一采用：

```text
uni-app
Vue 3
TypeScript
Pinia
SCSS
```

目标平台：

```text
mp-weixin
```

原则：

```text
业主端与维修师傅端优先复用同一个 uni-app 工程
↓
通过登录角色 / 权限 / 路由控制区分：
OWNER        业主
TECHNICIAN   维修师傅
```

如果现有仓库已经有两个独立 uni-app 工程，不强制合并，但必须复用：

```text
API 层
类型定义
主题 Token
基础组件
上传能力
鉴权逻辑
错误处理
```

### 管理员 PC 后台

采用：

```text
Vue 3
TypeScript
Vite
Element Plus
Pinia
```

### 后端服务

采用 Python 技术栈：

```text
Python 3.12（如本机版本不同，可在兼容前提下使用现有 Python 3.x）
FastAPI
Pydantic 2
SQLAlchemy 2.x
Alembic
PyMySQL
```

后端必须提供：

```text
REST API
统一响应结构
统一异常处理
登录鉴权
RBAC 权限
文件上传接口
账单 / 支付 / 报修 / 维保 / 装修 / 公告接口
管理员接口
维修师傅接口
```

### 数据库

本地数据库固定为用户当前 Windows 环境：

```text
MySQL Ver 8.0.36 for Win64 on x86_64
Host: 127.0.0.1
Port: 3306
Username: root
Password: root
Database: elevator_service
Charset: utf8mb4
```

开发环境连接示例：

```env
DATABASE_URL=mysql+pymysql://root:root@127.0.0.1:3306/elevator_service?charset=utf8mb4
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=elevator_service
MYSQL_USER=root
MYSQL_PASSWORD=root
```

`root/root` **仅作为当前本地 development 环境约定**。staging / production 不得继续使用 root/root，真实生产密码不得提交 Git。

### 本地推荐运行方式

```text
uni-app
    ↓
pnpm/npm + CLI 或 HBuilderX
    ↓
编译目标 mp-weixin
    ↓
微信开发者工具预览 / 调试

管理员后台
    ↓
Vite Dev Server

Python FastAPI
    ↓
uvicorn --reload

MySQL 8.0.36
    ↓
Windows 本机 MySQL 服务
    ↓
127.0.0.1:3306

本地上传目录
    ↓
data/uploads/
```

推荐启动命令（按实际 package manager 调整）：

```bash
# 业主端 / 师傅端 uni-app
pnpm dev:mp-weixin

# 管理员后台
pnpm dev

# Python 后端
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

数据库已按 Windows 本地 MySQL 使用，不要求 development 阶段再启动 Docker MySQL。

目标是：

```text
修改 uni-app 页面 → 热更新 / 重新编译到 mp-weixin
修改 Vue Admin → Vite 热更新
修改 Python → uvicorn 自动 reload
数据库 → 直接验证 MySQL 8.0.36 的真实约束、事务与索引行为
```

---

## 1.1.3 本地数据库原则

收费、支付、账单导入、工单和权限数据必须尽量在开发阶段验证真实数据库约束。

如果生产数据库确定为 MySQL，则 development 也必须使用：

```text
MySQL 8.0.36（Win64 x86_64）
```

核心业务禁止使用 SQLite 替代 MySQL 进行最终本地验证，尤其是：

```text
账单唯一约束
按户收费标准
Excel 批量导入
Payment 幂等
支付回调
事务
行锁
收据状态
工单状态流转
楼栋权限关联
```

当前 development 环境优先直接使用已经安装的 Windows MySQL 8.0.36：

```text
Host: 127.0.0.1
Port: 3306
User: root
Password: root
Database: elevator_service
```

初始化数据库示例：

```sql
CREATE DATABASE IF NOT EXISTS elevator_service
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
```

所有表结构变更必须通过迁移工具管理；使用 SQLAlchemy 时统一采用 Alembic。

不得因为本地已经存在 MySQL，而绕过迁移直接长期手工改表。

---

## 1.1.4 本地支付必须支持 Mock

开发阶段必须支持：

```env
PAYMENT_MODE=mock
```

支付服务必须抽象为统一接口：

```text
PaymentService
      │
  ┌───┴────────┐
  ↓            ↓
MockPayment   WeChatPayment
本地开发       staging / production
```

本地 Mock 支付至少支持：

```text
支付成功
支付取消
支付失败
重复回调
已支付账单再次支付
支付后刷新账单最终状态
```

本地成功流程：

```text
业主打开账单
→ 前端只提交 billId
→ 后端读取真实本地 MySQL Bill
→ 创建 Payment
→ MockPayment 返回模拟支付参数/结果
→ 服务端执行与正式回调相同的幂等状态更新逻辑
→ Bill = PAID
→ Payment = SUCCESS
→ 缴费记录可查询
→ 可申请收据
```

切换 staging / production：

```env
PAYMENT_MODE=wechat
```

页面层不得因为支付模式不同而重写业务流程。

禁止：

```text
development 页面直接把账单改成 PAID
前端自行决定最终支付金额
Mock 支付绕开 PaymentService
正式支付另复制一套 Billing 代码
```

---

## 1.1.5 本地文件存储与生产对象存储切换

本项目存在：

```text
报修故障图片
维修进度图片
完工照片
维保 PDF
Excel / CSV 收费导入文件
可能的公告附件
```

开发阶段必须支持：

```env
STORAGE_BACKEND=local
LOCAL_UPLOAD_DIR=./data/uploads
```

统一抽象：

```text
StorageService
      │
  ┌───┴──────────────┐
  ↓                  ↓
LocalStorage     ObjectStorage
本地文件         COS / 其他生产存储
```

生产环境再切换，例如：

```env
STORAGE_BACKEND=cos
```

页面和业务层不能直接依赖：

```text
C:\xxx\uploads
/data/uploads/xxx
COS SDK
某个固定 Bucket URL
```

业务层只保存统一的文件标识 / URL 元数据。

---

## 1.1.6 本地消息通知必须可 Mock

正式微信订阅消息、模板消息或其他通知能力不应阻塞本地业务开发。

开发环境：

```env
NOTIFICATION_MODE=mock
```

统一抽象：

```text
NotificationService
       │
   ┌───┴───────────┐
   ↓               ↓
MockNotification  WeChatNotification
本地记录/日志      staging / production
```

本地至少可以验证以下通知事件已经被正确触发：

```text
报修提交
管理员派单
维修状态更新
维修完成
新账单生成
欠费催缴
缴费成功
收据状态变化
维保通知
公告发布
装修状态变化
```

Mock 模式可写入：

```text
notification_outbox 表
或本地日志
```

这样可以检查“应该通知谁、通知什么、关联哪个业务单据”，而无需真实微信模板。

---

## 1.1.7 本地认证与测试账号

不得因为正式微信用户、正式手机号或后台真实账号尚未准备而阻塞三端联调。

开发环境可以支持：

```env
AUTH_MODE=mock
```

至少提供固定测试身份：

```text
owner_101      业主，1栋101室
owner_102      业主，1栋102室
technician_01  维修师傅
admin_01       管理员
```

其中：

```text
owner_101 与 owner_102 的收费金额必须允许不同
不同楼栋业主的维保权限必须不同
technician_01 只能看到自己的派单/权限数据
admin_01 才能访问后台管理接口
```

staging / production 再切换正式微信登录或正式后台认证。

业务 Service 不得为 Mock 用户复制另一套业务逻辑。

---

## 1.1.8 本地 Excel / CSV 导入必须完整实现

“管理员上传每户不同收费金额”属于核心功能，不能等生产环境再开发。

本地必须完整验证：

```text
下载模板
→ 本地选择 Excel / CSV
→ 上传到 LocalStorage
→ 服务端解析
→ 数据校验
→ 导入预览
→ 错误行标红
→ 管理员确认
→ MySQL 事务入库
→ 生成/更新账单
→ 业主端立即可查询
```

至少验证：

```text
不同房屋不同金额
同一房屋多个费用项目
未知房号
住户编码错误
金额格式错误
重复费用项
重复账单
部分错误行
全部错误
重复点击确认导入
```

导入确认必须具备幂等保护，不能因为重复请求生成两套相同账单。

---

## 1.1.9 本地欠费扫描 / 定时任务

如果系统采用后台定时任务自动识别欠费、发送预警或进行支付状态补偿，该任务在本地阶段就必须可运行。

推荐：

```text
Scheduler / Worker
    ↓
定时扫描未支付 Bill
    ↓
dueDate < NOW()
    ↓
标记 / 计算 OVERDUE
    ↓
生成 Notification Outbox
```

可通过环境变量控制：

```env
SCHEDULER_ENABLED=true
```

禁止依赖：

```text
业主打开页面
管理员打开 Dashboard
```

才触发系统级欠费状态变化。

若当前实现采用“查询时动态计算欠费”而不是落库状态，也必须保证服务端时间是权威来源，不能以前端时间为准。

---

## 1.1.10 企业介绍 H5 的 Local-First 处理

正式 `web-view` 可能依赖业务域名配置，因此 development 阶段不得因为 H5 域名未备案/未配置而阻塞页面开发。

建议：

```env
COMPANY_H5_MODE=mock
```

开发模式可以：

```text
显示本地 H5 占位页 / Mock 企业介绍页
或使用开发环境可访问的测试 H5 URL
```

production 再切换后台配置的正式企业 H5 地址。

页面结构、加载状态、异常状态必须在本地先完成。

---

## 1.1.11 同一份代码，多环境运行

必须保证：

```text
同一份业务代码
       │
 ┌─────┼─────────┐
 ↓     ↓         ↓
development staging production
 │     │         │
Mock支付 微信测试 微信正式
本地文件 测试存储 生产对象存储
Mock消息 微信测试 微信正式
Local DB 测试DB 生产DB
```

不得：

```text
为生产环境复制一套项目
为微信支付复制一套账单业务
为 COS 复制一套上传页面
页面中到处写 if development
```

生产切换应主要通过配置和 Adapter 完成。

---

## 1.1.12 Local-First 开发优先级

Codex 默认按以下顺序推进：

```text
1. 三端 UI / 路由 / 公共组件
2. Mock 数据与 Service 接口
3. 本地 API
4. 本地 MySQL 8.0.36 + 数据迁移
5. LocalStorage 文件上传
6. Mock Payment
7. Mock Notification
8. Excel / CSV 导入闭环
9. 报修 → 派单 → 师傅处理闭环
10. 维保 PDF 上传与楼栋权限闭环
11. 装修 / 公告 / H5 / 个人中心
12. 本地完整业务回归
13. staging
14. 正式微信登录/支付/消息
15. 生产对象存储
16. production 部署
```

只有本地核心流程通过后，才进入云端依赖和正式支付阶段。

---

# 2. 冲突处理优先级

```text
1. 用户最新明确确认
2. 需求.md
3. UI_SPEC.md
4. interaction.md
5. PROJECT_STRUCTURE.md
6. UI PNG
7. 你自己的推断
```

重要：之前“删除物业缴费”的旧规则已经失效。**当前版本必须实现缴费服务。**

---

# 3. 当前版本必须实现的业主端功能

```text
1. 缴费服务
2. 报修服务
3. 维保记录
4. 装修登记
5. 公告通知
6. 企业介绍
7. 个人中心
```

不要因为某张 UI 图遗漏“装修登记”就删除该功能。

---

# 4. 缴费服务是本轮最高优先级

## 4.1 核心业务约束

```text
每一户的缴费金额可以不同。
```

不能写成：

```ts
const amount = 388
```

也不能使用一个全局收费金额覆盖所有房屋。

正确模型：

```text
House
↓
Bill
↓
BillItem[]
↓
每个 Bill / BillItem 都由后台数据决定
```

例如：

```text
1栋101室 ¥388
1栋102室 ¥428
1栋103室 ¥346
```

## 4.2 费用明细

支持后台配置：

```text
电梯相关电费
电梯大、小零件费
维护保养费
人工费
通讯费
年审费用
清洁费
保险费
电梯安全管理员相关服务费
其他自定义费用
```

不要把这些费用写死成每户都必须完全相同。

## 4.3 业主页面

至少开发：

```text
payment/list
payment/detail
payment/records
payment/record-detail
payment/receipt-apply
payment/receipts
```

账单列表 Tab：

```text
全部 | 待缴 | 欠费 | 已缴
```

详情必须展示：

```text
房屋
账单标题
收费周期
截止日期
费用明细
应缴总额
状态
```

已支付账单提供“申请收据”。

---

# 5. 管理后台缴费服务

管理员后台必须增加一级菜单：

```text
缴费服务管理
```

二级功能：

```text
收费项目配置
按户收费标准
批量上传账单
账单台账
欠费预警/催缴
缴费记录/对账
收据申请管理
```

## 5.1 管理员上传

必须支持 Excel / CSV。

流程：

```text
下载模板
→ 上传文件
→ 服务端解析
→ 导入预览
→ 标红错误行
→ 管理员确认
→ 提交入库
→ 生成账单
```

不要上传后无预览直接写数据库。

推荐导入字段：

```text
communityName
buildingName
roomNo
residentCode
billingPeriod
billTitle
feeItemCode
feeItemName
amountYuan
dueDate
remark
```

支持同一房屋多行费用项目，服务端聚合成一个账单。

必须校验：

```text
楼栋/房号存在
住户编码匹配
收费项目合法
金额格式
截止日期
重复账单/重复费用项
```

## 5.2 按户编辑

管理员也必须可以不用 Excel，直接对某一户配置费用项和金额。

保存时：

```text
items 合计
↓
服务端计算 totalAmountFen
↓
生成/更新未支付账单
```

---

# 6. 微信支付实现原则

小程序调用：

```text
uni.requestPayment
```

但支付金额、签名、商户秘密都不能放前端。

必须采用：

```text
前端：billId
↓
后端：读取 Bill
↓
校验归属/状态/金额
↓
创建支付订单
↓
返回支付参数
↓
uni.requestPayment
↓
后端支付回调
↓
幂等更新 Payment + Bill
```

支付成功判断：以后端最终状态为准。

金额服务端使用整数“分”。

---

# 7. 欠费和催缴

欠费条件：

```text
当前日期超过 dueDate
AND 未支付
AND 未关闭
```

管理员支持：

```text
单户催缴
批量催缴
```

并记录：

```text
最近催缴时间
催缴次数
```

业主收到缴费通知后可直接跳到对应账单详情。

---

# 8. 收据

需求是“收据”，不要未经确认改成“发票”。

流程：

```text
缴费成功
→ 业主申请收据
→ 管理员审核/处理
→ 已开具或驳回
→ 消息通知业主
```

---

# 9. 业主首页

视觉以最新业主端 UI 为准：蓝白背景、圆角卡片、浅阴影。

首页至少包含：

```text
当前房屋
用户问候
紧急故障提示 + 一键呼救
缴费服务
报修服务
维保记录
装修登记
公告通知
企业介绍
个人中心
最新公告
```

缴费入口可使用蓝色“¥”图标，并优先展示待缴/欠费红点。

---

# 10. 报修模块

开发：

```text
repair/create
repair/list
repair/detail
```

字段：

```text
房号
故障描述
故障图片
联系人
联系电话
```

顶部必须：

```text
困梯、紧急故障禁止小程序报修！
请直接拨打现场救援电话。
```

工单：

```text
PENDING → REPAIRING → COMPLETED
```

---

# 11. 维修师傅端

实现：

```text
工作台
工单列表
工单详情
接单
维修进度更新
维修结果
完工照片
维保PDF上传
维保记录
消息
个人中心
```

师傅只能看到被派给自己或权限范围内的数据。

---

# 12. 维保记录

管理员/师傅上传时：

```text
楼栋
电梯编号
维保日期
PDF
```

业主端：

```text
当前房屋 → buildingId → 当前楼栋维保数据
```

不能通过 URL 参数越权读取其他楼栋。

前端和后端都做权限控制，后端为最终权限边界。

---

# 13. 装修登记

保留：

```text
装修须知
在线登记
2000元装修押金提示
线下缴押金
线下签承诺书
状态跟踪
```

装修押金默认不要接入本轮在线缴费。

---

# 14. 公告 / 企业介绍 / 个人中心

公告分类至少：

```text
电梯通知
缴费通知
维保通知
小区公告
```

企业介绍：后台 H5 URL → 小程序 web-view。

个人中心：

```text
我的房屋
我的缴费
缴费记录
我的收据
我的报修
我的装修记录
我的楼栋维保记录
消息通知
账户信息
```

---

# 15. 管理员 PC 后台

UI 使用最新 PC 设计：

```text
左侧菜单
顶部导航/用户区
卡片式数据概览
筛选栏
标准数据表格
抽屉/弹窗编辑
蓝色主操作
红色危险操作
```

至少开发：

```text
Dashboard
Repair Management
Maintenance Archive
Renovation Management
Notice Management
Company H5
Billing Management
Accounts & RBAC
Settings
```

PC 项目已有技术栈时沿用；如果是新项目，可使用 Vue 3 + TypeScript + Vite + Element Plus。

---

# 16. 代码分层要求

必须遵循：

```text
UI(uni-app Page / Vue View)
↓
Service
↓
Mock / HTTP
```

禁止：

```text
uni-app Page 直接 uni.request
uni-app Page 直接 import mock
Vue View 直接拼后端 URL
在组件内写支付商户密钥
```

uni-app 所有网络请求必须统一经过：

```text
src/api/http.ts
或项目现有统一 request 封装
```

推荐调用链：

```text
uni-app Page / Component
↓
业务 Service / API
↓
统一 HTTP Adapter
↓
Mock / FastAPI
```

不要在页面中直接散落：

```ts
uni.request(...)
uni.uploadFile(...)
```

上传、下载、支付均应通过独立 Service 封装。

所有 API 类型定义放 `models/types`。

---

# 17. Mock 场景

没有后端时必须能跑完整 UI；有本地后端后，仍必须保留可配置的 Mock Payment / Mock Notification / LocalStorage，以保证 development 不依赖生产资源。

缴费至少 Mock：

```text
房屋 A：待缴 388
房屋 B：待缴 428
房屋 C：欠费 346
已缴账单
多项费用明细
支付成功
支付取消
支付失败
Excel 导入部分成功
Excel 导入全部失败
收据待处理/已开具/已驳回
```

---

# 18. 实施顺序

不要一次性生成大量未经验证的代码。

按阶段：

```text
Step 1  检查现有仓库和技术栈
Step 2  建立 development / staging / production 配置与 .env.example
Step 3  输出计划修改/新增的文件
Step 4  建立公共模型、路由、主题、Request / Service Adapter 层
Step 5  完成三端基础 UI + Mock 数据
Step 6  完成房屋绑定 + 业主首页
Step 7  完成缴费 UI + 本地 Billing API + MySQL
Step 8  完成 Mock Payment，本地跑通缴费闭环
Step 9  完成管理员缴费管理 + Excel/CSV 导入预览/事务入库
Step 10 完成欠费识别 + Mock Notification
Step 11 完成报修 + 管理员派单 + 师傅工单全流程
Step 12 完成 LocalStorage 图片 / PDF 上传 + 维保权限闭环
Step 13 完成装修、公告、企业介绍、个人中心
Step 14 本地三端完整业务回归、权限/异常/安全检查
Step 15 对照设计图逐页视觉验收
Step 16 进入 staging，替换正式微信能力进行联调
Step 17 production 仅通过配置切换部署，不复制业务代码
```

每阶段都：

```text
实现
→ 编译/静态检查
→ 修复
→ 总结
→ 再进入下一阶段
```

---

# 19. 首轮执行指令

现在先做：

```text
1. 阅读仓库目录。
2. 阅读 docs 全部文件。
3. 阅读 design 下最新业主、师傅、管理员 UI。
4. 判断小程序、师傅端、PC 后台和后端现有技术栈。
5. 默认使用 APP_ENV=development，不依赖生产云资源启动开发。
6. 检查/补齐 .env.example 与 Config/Settings；禁止页面硬编码环境。
7. 列出准备修改/新增的文件。
8. 标记旧代码中“删除缴费”的逻辑并移除该限制。
9. 不立即大范围写代码。
10. 先建立 Billing/Payment/Receipt 数据模型和路由骨架。
11. 建立 PaymentService / StorageService / NotificationService Adapter。
12. 先使用 PAYMENT_MODE=mock、STORAGE_BACKEND=local、NOTIFICATION_MODE=mock。
13. 再完成业主首页缴费入口和缴费列表/详情 Mock。
14. 接本地 MySQL 后端并跑通真实本地数据闭环。
15. 运行编译、类型、迁移与基础测试检查。
```

---

# 20. 最终验收清单

```text
[ ] 首页存在缴费服务入口
[ ] 首页仍保留装修登记
[ ] 每户账单金额允许不同
[ ] 每户费用明细允许不同
[ ] 管理员可按户手动配置费用
[ ] 管理员可 Excel/CSV 批量上传
[ ] 导入有预览和错误行校验
[ ] 业主可看全部/待缴/欠费/已缴
[ ] 业主可查看账单费用明细
[ ] 微信支付金额由服务端决定
[ ] 支付回调幂等
[ ] 缴费记录可查询
[ ] 业主可申请收据
[ ] 后台可处理收据申请
[ ] 欠费可预警和催缴
[ ] 普通报修可提交和跟踪
[ ] 困梯/紧急故障提示明显
[ ] 师傅可接单、更新进度、上传完工照片
[ ] 师傅/管理员可上传维保PDF
[ ] 业主只能查看本栋维保记录
[ ] 装修押金仍为线下办理
[ ] 公告支持缴费通知
[ ] 企业介绍 H5 可配置
[ ] 三端权限隔离正确
[ ] Mock 与 Service 解耦
[ ] 无明显编译错误
[ ] UI 与最新设计图基本一致
[ ] development / staging / production 三环境可配置
[ ] .env.example 完整且无真实密钥
[ ] development 不依赖正式域名、COS、微信支付或正式消息模板
[ ] 本地 MySQL 可完成迁移和核心数据验证
[ ] PAYMENT_MODE=mock 可跑通成功/取消/失败/重复回调
[ ] STORAGE_BACKEND=local 可上传报修图片、完工照片、维保PDF和导入文件
[ ] NOTIFICATION_MODE=mock 可检查各类业务通知事件
[ ] Excel/CSV 在本地可完成上传、解析、预览、校验、确认入库
[ ] 本地可完成业主→管理员→维修师傅→业主的报修闭环
[ ] 本地可完成管理员生成账单→业主Mock支付→缴费记录→收据申请闭环
[ ] 同一份业务代码可通过配置切换 staging / production
[ ] 未为生产环境复制另一套业务代码
```

---

# 21. 推荐环境变量

以下仅为推荐命名；若现有项目已经有统一配置体系，应映射到现有体系，不要制造重复配置。

## development

```env
APP_ENV=development

# API
API_BASE_URL=http://127.0.0.1:8000

# uni-app
UNI_PLATFORM=mp-weixin
VITE_API_BASE_URL=http://127.0.0.1:8000

# Database（后端）
DATABASE_URL=mysql+pymysql://elevator_user:elevator_password@127.0.0.1:3306/elevator_service

# Local-First adapters
AUTH_MODE=mock
PAYMENT_MODE=mock
STORAGE_BACKEND=local
NOTIFICATION_MODE=mock
COMPANY_H5_MODE=mock

LOCAL_UPLOAD_DIR=./data/uploads
SCHEDULER_ENABLED=true
LOG_LEVEL=DEBUG
```

## staging

```env
APP_ENV=staging

AUTH_MODE=wechat
PAYMENT_MODE=wechat
STORAGE_BACKEND=cos
NOTIFICATION_MODE=wechat
COMPANY_H5_MODE=remote

SCHEDULER_ENABLED=true
LOG_LEVEL=INFO
```

## production

```env
APP_ENV=production

DATABASE_URL=<PRODUCTION_DATABASE_DSN>

AUTH_MODE=wechat
PAYMENT_MODE=wechat
STORAGE_BACKEND=cos
NOTIFICATION_MODE=wechat
COMPANY_H5_MODE=remote

COS_BUCKET=<bucket>
COS_REGION=<region>

SCHEDULER_ENABLED=true
LOG_LEVEL=INFO
```

真实生产配置，例如：

```text
微信 AppSecret
微信支付 APIv3 Key
商户私钥
平台证书相关密钥
COS SecretId / SecretKey
数据库密码
JWT / Session Secret
```

只能放入：

```text
服务器环境变量
CI/CD Secret
受保护的 Secret 文件
```

严禁提交到 Git。

---

# 22. Local-First 最终原则

Codex 必须始终遵守：

```text
本地先跑通
Mock 不穿透 UI 层
真实数据库尽早验证
外部能力通过 Adapter 切换
环境可切换
业务代码不分叉
生产仅换配置和基础设施实现
```

对本项目而言，**“本地完成”** 不是只把页面画出来，而是至少做到：

```text
业主端 + 维修师傅端 + 管理员后台
          ↓
       本地 API
          ↓
       本地 MySQL
          ↓
Mock Payment + LocalStorage + Mock Notification
          ↓
账单 / 缴费 / 收据 / 报修 / 派单 / 维修 / 维保PDF / 装修 / 公告
全部核心流程可以演示和回归测试
```

完成上述闭环后，再进入 staging 和 production。

