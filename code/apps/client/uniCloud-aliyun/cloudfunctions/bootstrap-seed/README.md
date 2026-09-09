# bootstrap-seed 一次性生产初始化函数

本函数只初始化 `demo-a` 品牌、10 项正式配置、演示管理员和管理员品牌授权；不会覆盖已有数据，也不会创建订单、支付或提现测试数据。

## 执行前

在 HBuilderX 中右键 `bootstrap-seed`，选择“配置云函数环境变量”，将下列变量配置到阿里云服务空间 `pwfinal`：

- `BOOTSTRAP_SECRET`：至少 32 位随机字符串；
- `PII_KEY_VERSION`、`PII_KEYS_JSON`、`PII_BLIND_INDEX_KEY`：必须与 `game-service` 完全一致；
- `BOOTSTRAP_BRAND_APPID`：默认可省略，代码会使用当前客户端 AppID `wxe40bb897376601cc`。

不要为初始化函数生成另一套 PII 密钥，否则 `game-service` 将无法按手机号查询管理员。

## 上传和执行

1. 右键 `bootstrap-seed`，选择“上传部署”，不要设置 URL 化；
2. 右键 `bootstrap-seed`，选择“上传并运行”或“运行云函数”；
3. 参数只填写：

```json
{
  "secret": "<与 BOOTSTRAP_SECRET 完全一致的值>"
}
```

成功返回 `ok: true`，并在 `created`/`skipped` 中列出结果。重复执行只会返回 `skipped`。

## 完成后

确认 Admin 可以使用 `13800000000 / admin123` 登录并进入强制改密流程后，立即在 uniCloud Web 控制台删除云端 `bootstrap-seed`，同时删除本地真实环境变量和执行参数。保留本目录源代码用于审计即可。

