# 微信小程序 WebView 业务域名检查

检查对象：小程序 AppID `wxe40bb897376601cc` 打开的 `https://h5.qmhyjoy.com`。

## 必须在微信后台确认

1. 登录微信公众平台，确认当前操作的小程序 AppID 是 `wxe40bb897376601cc`。
2. 进入“开发管理 → 开发设置 → 业务域名”。这里检查的是“业务域名”，不是“request 合法域名”。
3. 确认列表中存在 `https://h5.qmhyjoy.com`，协议、域名和子域名必须完全对应。
4. 若尚未配置，按后台提示下载校验文件，并原样放到站点根目录；确认 `https://h5.qmhyjoy.com/<校验文件名>` 可以直接返回该文件且状态为 200，再保存配置。
5. 若后台没有“业务域名”入口，检查小程序主体类型、认证状态及账号是否具备 `web-view` 能力。

微信官方参考：[web-view 组件](https://developers.weixin.qq.com/miniprogram/dev/component/web-view.html)、[业务域名](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/business-domain.html)。

## 真机复验

1. 使用同一 AppID 重新预览或上传体验版，避免使用测试号或另一小程序 AppID。
2. 关闭开发者工具中的“不校验合法域名”后再测一次；真机测试不要依赖调试绕过。
3. 进入下单壳页后，在开发者工具中右键 `web-view` 调试，检查第一个文档请求是否为：
   `https://h5.qmhyjoy.com/#/pages/h5-order/index?token=<REDACTED_TOKEN>`。
4. 记录文档请求状态、Console 首个错误和 `game-service/getH5Product` 的业务结果；截图或日志必须遮蔽完整 token。

## 不要混淆的配置

- `manifest.json` 中的 `urlCheck: false` 只是开发调试设置，不能证明微信后台已配置业务域名，也不能替代正式版校验。
- `request 合法域名` 管小程序网络请求；`业务域名` 管 `<web-view>` 打开的网页。
- 服务号网页授权域名、微信支付目录和 uniCloud Web 安全域名是后续独立配置项，不等同于小程序业务域名。

## 通过标准

- 微信后台业务域名列表中能看到 `https://h5.qmhyjoy.com`；
- 校验文件从域名根目录访问返回 200；
- 关闭调试绕过后，体验版/真机能加载 H5 的“正在准备订单”或明确错误页，而不是只有原生标题栏和空白主体。
