// 发布环境门禁：只检查变量是否存在及组合是否合法，不打印任何 secret 值。
import { pathToFileURL } from 'node:url';

const PLACEHOLDER = /replace|example|changeme|placeholder/i;
const LOCAL_URL = /^https?:\/\/(?:127\.0\.0\.1|localhost|0\.0\.0\.0)(?::|\/|$)/i;
const REQUIRED_WECHAT = ['WECHAT_PAY_MCHID', 'WECHAT_PAY_SERIAL_NO', 'WECHAT_PAY_PRIVATE_KEY', 'WECHAT_PAY_APIV3_KEY', 'WECHAT_PAY_APPID', 'WECHAT_PAY_NOTIFY_URL'];
const REQUIRED_MESSAGE = ['WECHAT_MP_KF_TOKEN', 'WECHAT_MP_APPID', 'WECHAT_MP_SECRET'];
const REQUIRED_FRONTEND = ['VITE_APP_ENV', 'VITE_API_MODE', 'VITE_BRAND_CODE'];
const REQUIRED_REMOTE = [
  'SESSION_SECRET', 'H5_TOKEN_SECRET', 'INTERNAL_SECRET', 'SCHEDULER_SECRET',
  'UNICLOUD_SPACE', 'HOSTING_CLIENT_URL', 'HOSTING_BACKEND_URL', 'H5_ORDER_BASE_URL',
  ...REQUIRED_WECHAT, ...REQUIRED_MESSAGE, ...REQUIRED_FRONTEND,
];
const SECRET_KEYS = ['SESSION_SECRET', 'H5_TOKEN_SECRET', 'INTERNAL_SECRET', 'SCHEDULER_SECRET'];
const STRONG_SECRET_KEYS = [...SECRET_KEYS, 'WECHAT_PAY_APIV3_KEY', 'WECHAT_MP_SECRET'];

export function validateReleaseEnvironment(environment, source = process.env) {
  if (!['development', 'staging', 'production'].includes(environment)) throw new Error('environment 必须为 development/staging/production');
  const values = {
    API_MODE: source.API_MODE || (environment === 'development' ? 'local' : ''),
    PAYMENT_MODE: source.PAYMENT_MODE || (environment === 'development' ? 'mock' : ''),
    MESSAGE_MODE: source.MESSAGE_MODE || (environment === 'development' ? 'mock' : ''),
    BRAND_CODE: source.BRAND_CODE || source.VITE_BRAND_CODE || (environment === 'development' ? 'demo-a' : ''),
  };
  const errors = [];
  if (!['local', 'unicloud'].includes(values.API_MODE)) errors.push('API_MODE 必须为 local/unicloud');
  if (!['mock', 'wechat'].includes(values.PAYMENT_MODE)) errors.push('PAYMENT_MODE 必须为 mock/wechat');
  if (!['mock', 'wechat'].includes(values.MESSAGE_MODE)) errors.push('MESSAGE_MODE 必须为 mock/wechat');
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(values.BRAND_CODE)) errors.push('BRAND_CODE 不合法');
  if (environment === 'development') {
    if (values.PAYMENT_MODE !== 'mock') errors.push('development 必须使用 PAYMENT_MODE=mock');
    if (values.MESSAGE_MODE !== 'mock') errors.push('development 必须使用 MESSAGE_MODE=mock');
  } else {
    if (values.API_MODE !== 'unicloud') errors.push(`${environment} 必须使用 API_MODE=unicloud`);
    if (values.PAYMENT_MODE !== 'wechat') errors.push(`${environment} 必须使用 PAYMENT_MODE=wechat`);
    if (values.MESSAGE_MODE !== 'wechat') errors.push(`${environment} 必须使用 MESSAGE_MODE=wechat`);
    if (source.VITE_APP_ENV !== environment) errors.push(`VITE_APP_ENV 必须与发布环境 ${environment} 一致`);
    if (source.VITE_API_MODE !== values.API_MODE) errors.push('VITE_API_MODE 必须与 API_MODE 一致');
    if (source.VITE_BRAND_CODE !== values.BRAND_CODE) errors.push('VITE_BRAND_CODE 必须与 BRAND_CODE 一致');
    for (const key of REQUIRED_REMOTE) if (!source[key] || PLACEHOLDER.test(source[key])) errors.push(`缺少有效 ${key}`);
    for (const key of ['HOSTING_CLIENT_URL', 'HOSTING_BACKEND_URL', 'H5_ORDER_BASE_URL', 'WECHAT_PAY_NOTIFY_URL']) {
      if (source[key] && !/^https:\/\//.test(source[key])) errors.push(`${key} 必须使用 https`);
      if (source[key] && LOCAL_URL.test(source[key])) errors.push(`${key} 禁止使用本机地址`);
    }
    if (source.VITE_API_BASE && LOCAL_URL.test(source.VITE_API_BASE)) errors.push(`${environment} 的 VITE_API_BASE 禁止使用本机地址`);
    if (values.API_MODE === 'unicloud' && source.VITE_API_BASE) errors.push(`${environment} 使用 uniCloud 时 VITE_API_BASE 必须留空`);
    const h5TtlMs = Number(source.H5_TOKEN_TTL_MS || 24 * 60 * 60 * 1000);
    if (!Number.isSafeInteger(h5TtlMs) || h5TtlMs < 5 * 60 * 1000 || h5TtlMs > 24 * 60 * 60 * 1000) errors.push('H5_TOKEN_TTL_MS 必须在 5 分钟到 24 小时之间');
    for (const key of STRONG_SECRET_KEYS) if (source[key] && String(source[key]).length < 32) errors.push(`${key} 长度至少 32 字符`);
    const secretValues = SECRET_KEYS.map((key) => source[key]).filter(Boolean);
    if (new Set(secretValues).size !== secretValues.length) errors.push('SESSION/H5/INTERNAL/SCHEDULER 密钥必须相互独立');
  }
  if (environment === 'production') {
    if (source.RELEASE_APPROVED !== 'true') errors.push('production 需要 RELEASE_APPROVED=true');
    if (!source.DB_BACKUP_ID) errors.push('production 需要 DB_BACKUP_ID');
    if (!source.ROLLBACK_BUNDLE_PATH) errors.push('production 需要 ROLLBACK_BUNDLE_PATH');
    if (source.COMMERCIAL_DECISIONS_APPROVED !== 'true') errors.push('production 需要 COMMERCIAL_DECISIONS_APPROVED=true');
    if (!['single-entity', 'isolated-entity'].includes(source.BRAND_ENTITY_MODE)) errors.push('production 需要明确 BRAND_ENTITY_MODE=single-entity/isolated-entity');
    if (source.DEMO_DATA_ENABLED !== 'false') errors.push('production 需要 DEMO_DATA_ENABLED=false');
    if (/^demo(?:-|$)/.test(values.BRAND_CODE)) errors.push('production 禁止使用 demo 品牌');
    const allowlist = String(source.PRODUCTION_BRAND_CODES || '').split(',').map((item) => item.trim()).filter(Boolean);
    if (!allowlist.length || !allowlist.includes(values.BRAND_CODE)) errors.push('BRAND_CODE 不在 PRODUCTION_BRAND_CODES 白名单');
  }
  return { ok: errors.length === 0, environment, modes: values, checkedSecretKeys: environment === 'development' ? 0 : REQUIRED_REMOTE.length, errors };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const index = process.argv.indexOf('--environment');
  const environment = index >= 0 ? process.argv[index + 1] : (process.env.APP_ENV || 'development');
  const result = validateReleaseEnvironment(environment);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 2);
}
