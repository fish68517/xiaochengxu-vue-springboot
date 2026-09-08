// 微信支付 APIv3 签名自检
// 用法：配好环境变量后执行（PowerShell 示例）：
//   $env:WECHAT_PAY_MCHID="1116677386"
//   $env:WECHAT_PAY_SERIAL_NO="<证书序列号>"
//   $env:WECHAT_PAY_PRIVATE_KEY="<apiclient_key.pem 内容，可用 \n 转义>"
//   $env:WECHAT_PAY_APIV3_KEY="<APIv3密钥>"
//   $env:WECHAT_PAY_APPID="<已绑定APPID>"
//   node scripts/verify-wechat-pay-sign.mjs
// 判定：用假 openid 调 JSAPI 下单。
//   - 返回参数错误（PARAM_ERROR/NO_AUTH 等）-> 签名已被微信接受，证书配置正确
//   - 返回 SIGN_ERROR/UNAUTHORIZED -> 证书序列号或私钥与商户号不匹配
//   - 返回 APPID_MCHID_NOT_MATCH -> appid 未与商户号绑定
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Pay = require('../uniCloud-tcb/cloudfunctions/game-service/lib/wechat-pay.cjs');

const client = Pay.createClient({ env: process.env });

if (!client.isConfigured()) {
  console.error('FAIL：缺少环境变量 WECHAT_PAY_MCHID / WECHAT_PAY_SERIAL_NO / WECHAT_PAY_PRIVATE_KEY / WECHAT_PAY_APIV3_KEY / WECHAT_PAY_APPID');
  process.exit(2);
}

try {
  const prepayId = await client.jsapiPrepay({
    outTradeNo: `SIGNTEST-${Date.now()}`,
    amountFen: 1,
    description: '签名自检(不会产生真实订单)',
    openid: 'o-signcheck-fake-openid',
  });
  console.log(`PASS：微信接受请求并返回 prepay_id（${prepayId}），证书签名有效。`);
  process.exit(0);
} catch (error) {
  const msg = String(error && error.message);
  if (msg.includes('APPID_MCHID_NOT_MATCH')) {
    console.error('WARN：签名有效，但 APPID 未与商户号绑定（商户平台-产品中心-AppID账号管理 关联）。' + msg);
    process.exit(1);
  }
  if (msg.includes('SIGN_ERROR') || msg.includes('UNAUTHORIZED')) {
    console.error('FAIL：签名被微信拒绝。请检查证书序列号/商户私钥是否与该商户号匹配（注意 API 证书 ≠ APIv3 密钥）。' + msg);
    process.exit(1);
  }
  if (msg.includes('PARAM_ERROR') || msg.includes('INVALID_REQUEST') || msg.includes('NO_AUTH') || msg.includes('openid')) {
    console.log('PASS：签名有效（假 openid 被业务参数拦截，符合预期）。证书配置正确，可继续配置回调与真实下单。');
    console.log(`  微信返回：${msg}`);
    process.exit(0);
  }
  console.error(`UNKNOWN：${msg}`);
  process.exit(1);
}
