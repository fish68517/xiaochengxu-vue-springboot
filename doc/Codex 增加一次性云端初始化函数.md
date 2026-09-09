# 任务：为 uniCloud 阿里云生产环境增加一次性初始化函数

当前生产环境：
- uniCloud 阿里云
- 服务空间：pwfinal
- game-service 已部署成功
- 42 个 Schema 已部署
- users、brands、configs 等 Collection 当前为空
- Admin H5 已经可以正常调用 game-service

当前 Admin 页面演示账号：
手机号：13800000000
密码：admin123

但是云端 users 没有初始化数据，因此 authLogin 返回 UNAUTHORIZED。

## 现有代码事实

项目已有：
- packages/backend/test/helpers.js 中 seedAdmin
- scripts/api-server.mjs 中 seedDb
- game-service 内已有真实的认证、密码 Hash、PII、Repository 和 service 逻辑

注意：
测试 helper 和本地 memory DB seed 不能直接用于生产数据库。

## 目标

请创建一个临时的一次性 uniCloud 普通云函数：

apps/client/uniCloud-aliyun/cloudfunctions/bootstrap-seed/

入口必须是：

exports.main = async (event, context) => {}

不要做成云对象。

## 初始化内容

必须复用现有正式业务代码，不允许自己发明数据库字段结构。

至少初始化：

1. brands
   - 默认品牌 demo-a
   - 如果已有则跳过

2. configs
   - 当前 Client/Admin 启动所必须的基础配置
   - 使用现有品牌配置/项目配置逻辑生成
   - 不允许猜字段

3. users
   - 管理员：
     phone = 13800000000
     password = admin123
     role = ADMIN
   - 必须使用项目现有正式密码 Hash / auth 创建逻辑
   - 禁止把 admin123 明文直接保存数据库

4. user_brand_roles
   - 将管理员授权到 demo-a
   - 具体字段严格依据现有 schema/service

如果 Admin 正常运行还要求其它最小基础 Collection，也一并通过现有正式 service 初始化。

## 安全要求

增加：

BOOTSTRAP_SECRET

调用必须传：

{
  "secret": "<BOOTSTRAP_SECRET>"
}

secret 不正确直接拒绝。

同时做到幂等：

重复执行不能重复创建管理员、品牌或配置。

返回类似：

{
  "ok": true,
  "created": [...],
  "skipped": [...]
}

不要返回密码、Hash、PII key 等敏感信息。

## 代码复用

优先复用当前 game-service/lib 中正式实现，例如实际存在的：
- createUniCloudRepository
- createStaff
- password/hash helper
- Privacy
- auth/security helper
- brand/config service

请先搜索真实代码，然后复用，不要把 test helper 直接复制到生产。

特别参考：
- packages/backend/test/helpers.js 的 seedAdmin 行为
- scripts/api-server.mjs 的 seedDb 初始化内容
但最终必须适配 uniCloud.database()。

## 禁止

- 不修改 game-service 现有业务协议
- 不删除数据
- 不覆盖已有管理员
- 不保存明文密码
- 不自动创建大量测试订单
- 不初始化支付测试数据
- 不上传真实 Secret 到 Git

## 完成后

1. 给出创建的文件
2. 给出 HBuilderX 上传 bootstrap-seed 的步骤
3. 给出需要配置的环境变量
4. 给出一次性执行参数
5. 给出成功后的数据库验证清单
6. 明确提醒初始化完成后删除 bootstrap-seed 云函数