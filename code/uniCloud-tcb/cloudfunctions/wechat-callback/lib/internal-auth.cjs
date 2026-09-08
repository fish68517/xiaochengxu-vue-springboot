'use strict';
const { createHash, createHmac, randomBytes } = require('node:crypto');

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function payloadDigest(payload = {}) {
  return createHash('sha256').update(JSON.stringify(stable(payload))).digest('hex');
}

function signInternalRequest({ action, payload = {}, secret, timestamp = Date.now(), nonce = randomBytes(18).toString('base64url') }) {
  if (!secret) throw new Error('缺少 INTERNAL_SECRET，无法签名内部请求');
  const canonical = `${action}\n${timestamp}\n${nonce}\n${payloadDigest(payload)}`;
  const signature = createHmac('sha256', secret).update(canonical).digest('base64url');
  return { timestamp, nonce, signature };
}

module.exports = { payloadDigest, signInternalRequest };

