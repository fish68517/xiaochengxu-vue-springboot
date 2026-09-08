'use strict';
const { createHash, createHmac, randomBytes } = require('node:crypto');

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function signInternalRequest({ action, payload = {}, secret, timestamp = Date.now(), nonce = randomBytes(18).toString('base64url') }) {
  if (!secret) throw new Error('缺少 INTERNAL_SECRET');
  const digest = createHash('sha256').update(JSON.stringify(stable(payload))).digest('hex');
  const signature = createHmac('sha256', secret).update(`${action}\n${timestamp}\n${nonce}\n${digest}`).digest('base64url');
  return { timestamp, nonce, signature };
}

module.exports = { signInternalRequest };

