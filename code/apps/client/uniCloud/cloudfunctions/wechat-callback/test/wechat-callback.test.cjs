'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { verifyWechatSignature } = require('../lib/wechat-signature.cjs');
const { buildH5OrderLink } = require('../lib/h5-link.cjs');
const { signInternalRequest } = require('../lib/internal-auth.cjs');
const { verifyInternalRequest } = require('../../game-service/lib/internal-auth.cjs');

function signature(token, timestamp, nonce) {
  return createHash('sha1').update([token, timestamp, nonce].sort().join('')).digest('hex');
}

test('微信回调签名：正确签名通过', () => {
  const token = 'test-token';
  const timestamp = '1700000000';
  const nonce = 'abc123';
  assert.equal(verifyWechatSignature({ token, signature: signature(token, timestamp, nonce), timestamp, nonce }), true);
});

test('微信回调签名：错误签名拒绝', () => {
  assert.equal(verifyWechatSignature({ token: 'test-token', signature: 'bad', timestamp: '1', nonce: '2' }), false);
});

test('微信客服链接：使用客户端真实 Hash 路由', () => {
  assert.equal(buildH5OrderLink('https://h5.xinghe.cn/', 'a.b'), 'https://h5.xinghe.cn/#/pages/h5-order/index?token=a.b');
});

test('微信客服内部调用：签名与 game-service 验证契约一致', () => {
  const secret = 'internal-secret-at-least-32-characters-x';
  const payload = { productId: 'p-1', openid: 'o-1' };
  const auth = signInternalRequest({ action: 'h5Token', payload, secret, timestamp: 1_700_000_000_000, nonce: 'nonce_abcdefghijklmnop' });
  assert.equal(verifyInternalRequest({ action: 'h5Token', payload, auth, secret, now: 1_700_000_001_000 }).nonce, auth.nonce);
});
