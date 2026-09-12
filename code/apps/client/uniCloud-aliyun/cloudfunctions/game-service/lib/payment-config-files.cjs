'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../private-config');
const present = v => v !== undefined && v !== null && v !== '';
function fail(code, field) {
  const error = new Error(`支付文件配置错误${code === 'ENVIRONMENT' ? '：当前环境品牌支付映射不存在或无效' : ''}: ${code}${field ? ` (${field})` : ''}`);
  error.code = `PAY_CONFIG_${code}`;
  throw error;
}
function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}
function read(root, name, limit, optional = false) {
  if (typeof name !== 'string' || !name || /[:\\]/.test(name) || path.isAbsolute(name) || name.split('/').some(p => p === '..' || p === '.')) fail('PATH');
  try {
    const target = path.resolve(root, name);
    // Optional files may be absent, but dangling links and permission errors are not absence.
    try { fs.lstatSync(target); } catch (e) { if (optional && e.code === 'ENOENT') return null; throw e; }
    const base = fs.realpathSync(root);
    const real = fs.realpathSync(target);
    const relative = path.relative(base, real);
    if (relative.startsWith('..') || path.isAbsolute(relative)) fail('PATH');
    const stat = fs.statSync(real);
    if (!stat.isFile() || stat.size > limit) fail('SIZE');
    return fs.readFileSync(real, 'utf8');
  } catch (e) {
    if (e.code?.startsWith('PAY_CONFIG_')) throw e;
    fail(e.code === 'ENOENT' ? 'FILE_MISSING' : 'FILE_READ');
  }
}
function parse(text) {
  try { const value = JSON.parse(text.replace(/^\uFEFF/, '')); if (!object(value)) fail('JSON'); return value; }
  catch (_) { fail('JSON'); }
}
function loadPaymentMap(env = process.env, root = ROOT) {
  const text = present(env.WECHAT_PAY_CONFIG_MAP) ? env.WECHAT_PAY_CONFIG_MAP : read(root, 'wechat-pay.json', 256 * 1024, true);
  if (text === null) return null;
  if (typeof text !== 'string') fail('JSON');
  const map = parse(text);
  const brands = map[env.APP_ENV || 'development'];
  if (!object(brands) || Object.values(brands).some(v => !object(v))) fail('ENVIRONMENT');
  if (Object.keys(brands).length > 50) fail('BRAND_LIMIT');
  return map;
}
function readCredentials(env, entry, root = ROOT) {
  let file;
  let used = false;
  const getFile = () => {
    if (file !== undefined) return file;
    const text = read(root, 'credentials.json', 256 * 1024, true);
    if (text === null) return (file = {});
    const all = parse(text);
    const environment = all[env.APP_ENV || 'development'];
    if (!object(environment) || !object(environment[entry.envPrefix])) fail('CREDENTIALS_SCOPE');
    return (file = environment[entry.envPrefix]);
  };
  const result = {};
  for (const field of ['SERIAL_NO', 'PRIVATE_KEY', 'APIV3_KEY', 'NOTIFY_URL', 'PUBLIC_KEY', 'PUBLIC_KEY_ID', 'PLATFORM_CERT', 'PLATFORM_SERIAL']) {
    const direct = env[`${entry.envPrefix}_${field}`];
    let value = direct;
    if (!present(direct)) {
      if ((field === 'PUBLIC_KEY' || field === 'PUBLIC_KEY_ID') && present(env[`${entry.envPrefix}_PLATFORM_CERT`]) && present(env[`${entry.envPrefix}_PLATFORM_SERIAL`])) { result[`WECHAT_PAY_${field}`] = ''; continue; }
      // An already complete trust pair does not require the alternate pair's files.
      if (field.startsWith('PLATFORM_') && result.WECHAT_PAY_PUBLIC_KEY && result.WECHAT_PAY_PUBLIC_KEY_ID) { result[`WECHAT_PAY_${field}`] = ''; continue; }
      const item = getFile();
      const pem = ['PRIVATE_KEY', 'PUBLIC_KEY', 'PLATFORM_CERT'].includes(field);
      value = pem && present(item[`${field}_FILE`]) ? read(root, item[`${field}_FILE`], 32 * 1024) : (pem ? '' : item[field]);
      if (present(value)) used = true;
    }
    if (present(value) && (typeof value !== 'string' || !value.trim())) fail('FIELD', field);
    result[`WECHAT_PAY_${field}`] = value || '';
  }
  if (used) {
    const item = getFile();
    if (!item.MERCHANT_CERT_FILE) fail('CERT_REQUIRED');
    try {
      const key = crypto.createPrivateKey(result.WECHAT_PAY_PRIVATE_KEY.replace(/\\n/g, '\n'));
      const cert = new crypto.X509Certificate(read(root, item.MERCHANT_CERT_FILE, 32 * 1024));
      if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength < 2048) fail('PRIVATE_KEY');
      if (!cert.checkPrivateKey(key) || cert.serialNumber.toUpperCase() !== result.WECHAT_PAY_SERIAL_NO.toUpperCase() || !cert.subject.split('\n').includes(`CN=${entry.mchid}`)) fail('CERT_MISMATCH');
      if (Date.now() < Date.parse(cert.validFrom) || Date.now() > Date.parse(cert.validTo)) fail('CERT_EXPIRED');
      if (result.WECHAT_PAY_PUBLIC_KEY) {
        const pub = crypto.createPublicKey(result.WECHAT_PAY_PUBLIC_KEY.replace(/\\n/g, '\n'));
        if (pub.asymmetricKeyType !== 'rsa' || pub.asymmetricKeyDetails.modulusLength < 2048 || pub.export({type:'spki',format:'der'}).equals(cert.publicKey.export({type:'spki',format:'der'}))) fail('PUBLIC_KEY');
      }
      if (result.WECHAT_PAY_PLATFORM_CERT) {
        const platform = new crypto.X509Certificate(result.WECHAT_PAY_PLATFORM_CERT.replace(/\\n/g, '\n'));
        if (platform.serialNumber.toUpperCase() !== result.WECHAT_PAY_PLATFORM_SERIAL.toUpperCase() || platform.publicKey.asymmetricKeyType !== 'rsa' || platform.publicKey.asymmetricKeyDetails.modulusLength < 2048 || Date.now() > Date.parse(platform.validTo) || Date.now() < Date.parse(platform.validFrom) || platform.publicKey.export({type:'spki',format:'der'}).equals(cert.publicKey.export({type:'spki',format:'der'}))) fail('PLATFORM_CERT');
      }
    } catch (e) { if (e.code?.startsWith('PAY_CONFIG_')) throw e; fail('KEY_OR_CERT'); }
  }
  return result;
}
module.exports = { ROOT, loadPaymentMap, readCredentials };
