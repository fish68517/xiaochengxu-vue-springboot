'use strict';
// 服务端映射只持有引用；不同环境、主体不可回退到共用凭证。
function resolvePaymentConfig({ brandCode, secretRef = '', env = process.env }) {
  const environment = env.APP_ENV || 'development';
  let map;
  try { map = JSON.parse(env.WECHAT_PAY_CONFIG_MAP || '{}'); } catch (_) { throw new Error('支付配置映射格式错误'); }
  const brands = map[environment] || {};
  const entry = brands[brandCode];
  if (!entry) throw new Error('当前环境品牌支付映射不存在');
  if (!/^[A-Z][A-Z0-9_]{1,64}$/.test(entry.envPrefix || '') || !entry.entityId || !entry.secretRef) throw new Error('支付Secret引用不完整');
  if (secretRef && entry.secretRef !== secretRef) throw new Error('品牌支付Secret引用不一致');
  for (const other of Object.values(brands)) {
    if (other.entityId !== entry.entityId && (other.secretRef === entry.secretRef || other.envPrefix === entry.envPrefix || other.mchid === entry.mchid)) throw new Error('不同主体禁止共用支付Secret或商户号');
  }
  if (!entry.appId || !entry.mchid || !Array.isArray(entry.boundAppIds) || !entry.boundAppIds.includes(entry.appId)) throw new Error('AppID与商户号绑定未确认');
  const resolved = { APP_ENV: environment, WECHAT_PAY_APPID: entry.appId, WECHAT_PAY_MCHID: entry.mchid, WECHAT_PAY_H5_ENABLED: entry.h5Enabled === true ? 'true' : 'false' };
  for (const key of ['SERIAL_NO', 'PRIVATE_KEY', 'APIV3_KEY', 'NOTIFY_URL', 'PUBLIC_KEY', 'PUBLIC_KEY_ID', 'PLATFORM_CERT', 'PLATFORM_SERIAL']) resolved[`WECHAT_PAY_${key}`] = env[`${entry.envPrefix}_${key}`] || '';
  if (!['SERIAL_NO', 'PRIVATE_KEY', 'APIV3_KEY', 'NOTIFY_URL'].every((key) => resolved[`WECHAT_PAY_${key}`])) throw new Error('品牌支付Secret缺失');
  if (Buffer.byteLength(resolved.WECHAT_PAY_APIV3_KEY) !== 32) throw new Error('APIv3 Key必须为32字节');
  const notify = new URL(resolved.WECHAT_PAY_NOTIFY_URL);
  if (notify.protocol !== 'https:' || /^(localhost|127\.|0\.)/i.test(notify.hostname)) throw new Error('品牌回调必须为公网HTTPS');
  if (!(resolved.WECHAT_PAY_PUBLIC_KEY && resolved.WECHAT_PAY_PUBLIC_KEY_ID) && !(resolved.WECHAT_PAY_PLATFORM_CERT && resolved.WECHAT_PAY_PLATFORM_SERIAL)) throw new Error('缺少可信微信支付公钥或平台证书');
  return { env: resolved, snapshot: { brandCode, environment, secretRef: entry.secretRef, entityId: entry.entityId, appId: entry.appId, mchid: entry.mchid, currency: 'CNY' } };
}
module.exports = { resolvePaymentConfig };
