'use strict';
const { createHash, createHmac, randomBytes, timingSafeEqual } = require('node:crypto');

const INTERNAL_AUTH_MAX_SKEW_MS = 5 * 60 * 1000;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function payloadDigest(payload = {}) {
  return createHash('sha256').update(JSON.stringify(stable(payload))).digest('hex');
}

function canonical(action, payload, timestamp, nonce) {
  return `${action}\n${timestamp}\n${nonce}\n${payloadDigest(payload)}`;
}

function signInternalRequest({ action, payload = {}, secret, timestamp = Date.now(), nonce = randomBytes(18).toString('base64url') }) {
  if (!secret) throw new Error('缺少 INTERNAL_SECRET，无法签名内部请求');
  if (!action) throw new Error('内部请求 action 不能为空');
  const signature = createHmac('sha256', secret).update(canonical(action, payload, timestamp, nonce)).digest('base64url');
  return { timestamp, nonce, signature };
}

function verifyInternalRequest({ action, payload = {}, auth, secret, now = Date.now(), maxSkewMs = INTERNAL_AUTH_MAX_SKEW_MS }) {
  if (!secret) throw new Error('缺少 INTERNAL_SECRET 环境变量(fail-closed)');
  if (!auth || !auth.timestamp || !auth.nonce || !auth.signature) throw new Error('缺少内部请求签名');
  const timestamp = Number(auth.timestamp);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > maxSkewMs) throw new Error('内部请求签名已过期');
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(String(auth.nonce))) throw new Error('内部请求 nonce 非法');
  const expected = createHmac('sha256', secret).update(canonical(action, payload, timestamp, auth.nonce)).digest();
  let actual;
  try { actual = Buffer.from(String(auth.signature), 'base64url'); } catch (_) { throw new Error('内部请求签名非法'); }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('内部请求签名非法');
  return { timestamp, nonce: String(auth.nonce), expiresAt: timestamp + maxSkewMs };
}

module.exports = { INTERNAL_AUTH_MAX_SKEW_MS, payloadDigest, signInternalRequest, verifyInternalRequest };

