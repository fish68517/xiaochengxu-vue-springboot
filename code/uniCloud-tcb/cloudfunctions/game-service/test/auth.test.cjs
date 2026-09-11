'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuth, hashPassword, PUBLIC_ACTIONS } = require('../lib/auth.cjs');
const { createMemoryRepository } = require('../lib/repository.cjs');
const { signInternalRequest } = require('../lib/internal-auth.cjs');

test('公开白名单:核心 8 action 无需会话', () => {
  for (const a of ['miniLogin', 'authLogin', 'workerLogin', 'listProducts', 'getProduct', 'getBrandConfig', 'payNotify', 'oauthExchange']) {
    assert.ok(PUBLIC_ACTIONS.has(a), `${a} 应在公开白名单`);
  }
  // 受保护 action 不在公开白名单
  assert.ok(!PUBLIC_ACTIONS.has('grabOrder'));
  assert.ok(!PUBLIC_ACTIONS.has('approveRefund'));
  assert.ok(!PUBLIC_ACTIONS.has('markWithdrawalPaid'));
});

test('角色矩阵:合法角色放行,越权拒绝,坏 token 拒绝', async () => {
  const auth = createAuth({ env: { SESSION_SECRET: 'test-secret' } });
  const repo = createMemoryRepository();
  await repo.insert('users', { _id: 'w1', role: 'WORKER', phone: '138', passwordHash: hashPassword('x'), status: 'ACTIVE' });
  const { token } = auth.issueSession({ _id: 'w1', role: 'WORKER' });

  const ok = await auth.require(repo, 'grabOrder', { token });
  assert.equal(ok.session.role, 'WORKER');
  assert.equal(ok.session.userId, 'w1');

  await assert.rejects(() => auth.require(repo, 'approveRefund', { token }), /无权执行该操作/);
  await assert.rejects(() => auth.require(repo, 'grabOrder', { token: 'bad.token' }), /无效的会话 token/);
  await assert.rejects(() => auth.require(repo, 'grabOrder', {}), /缺少会话 token/);
});

test('会话签发：缺少主角色时拒绝生成不完整 token', () => {
  const auth = createAuth({ env: { SESSION_SECRET: 'test-secret' } });
  assert.throws(
    () => auth.issueSession({ _id: 'c1' }, { roles: ['CUSTOMER'], brandScopes: ['demo-a'] }),
    /会话主角色不能为空/,
  );
});

test('owner 校验:拒绝 payload 把身份字段当主体传入', () => {
  const auth = createAuth({ env: { SESSION_SECRET: 'test-secret' } });
  assert.throws(() => auth.rejectIdentityOverride({ openid: 'o1' }, 'CUSTOMER'), /身份字段/);
  assert.throws(() => auth.rejectIdentityOverride({ customerId: 'c1' }, 'CUSTOMER'), /身份字段/);
  assert.throws(() => auth.rejectIdentityOverride({ workerId: 'w1' }, 'WORKER'), /身份字段/);
  // 非身份字段(target)不应拦截
  assert.doesNotThrow(() => auth.rejectIdentityOverride({ orderId: 'o1' }, 'WORKER'));
});

test('登录失败锁定:连续 5 次错误后锁定,正确密码也被拒', async () => {
  const auth = createAuth({ env: { SESSION_SECRET: 'test-secret' } });
  const repo = createMemoryRepository();
  await repo.insert('users', { _id: 'a1', role: 'ADMIN', phone: '13800000000', passwordHash: hashPassword('right-pass'), status: 'ACTIVE' });
  for (let i = 0; i < 5; i++) {
    await assert.rejects(() => auth.login(repo, { phone: '13800000000', password: 'wrong', roles: ['ADMIN'] }), /手机号或密码错误/);
  }
  await assert.rejects(() => auth.login(repo, { phone: '13800000000', password: 'right-pass', roles: ['ADMIN'] }), /锁定/);
  const user = await repo.getById('users', 'a1');
  assert.equal(user.loginFailCount, 5);
  assert.ok(user.lockedUntil > Date.now());
});

test('action 覆盖:每个 service action 都在鉴权层归类(公开/H5/系统/角色矩阵)', () => {
  const services = require('../lib/services.cjs');
  const a = createAuth({ env: { SESSION_SECRET: 'test-secret' } });
  for (const action of Object.keys(services)) {
    const covered = PUBLIC_ACTIONS.has(action) || a.H5_TOKEN_ACTIONS.has(action) || a.SYSTEM_ACTIONS.has(action) || a.ROLE_MATRIX[action];
    assert.ok(covered, `action ${action} 未在鉴权层归类`);
  }
});

test('系统间调用:HMAC 放行白名单 action，错误签名/重放/非白名单拒绝', async () => {
  const secret = 'internal-secret-at-least-32-chars-x';
  const auth = createAuth({ env: { SESSION_SECRET: 'test-secret', INTERNAL_SECRET: secret } });
  const repo = createMemoryRepository();
  const payload = { productId: 'p-1', openid: 'o-1' };
  const internalAuth = signInternalRequest({ action: 'h5Token', payload, secret });
  const ok = await auth.require(repo, 'h5Token', { internalAuth, payload });
  assert.equal(ok.mode, 'system');
  assert.equal(ok.session.role, 'SYSTEM');
  assert.equal(ok.session.internalNonce, internalAuth.nonce);
  await assert.rejects(() => auth.require(repo, 'h5Token', { internalAuth, payload }), /重放/);
  const bad = signInternalRequest({ action: 'h5Token', payload, secret: 'wrong-secret-at-least-32-chars-x' });
  await assert.rejects(() => auth.require(repo, 'h5Token', { internalAuth: bad, payload }), /签名非法/);
  await assert.rejects(() => auth.require(repo, 'h5Token', {}), /缺少会话 token/);
  // 非白名单 action 不接受系统密钥
  const other = signInternalRequest({ action: 'grabOrder', payload: {}, secret });
  await assert.rejects(() => auth.require(repo, 'grabOrder', { internalAuth: other, payload: {} }), /缺少会话 token/);
  // 未配置 INTERNAL_SECRET:系统通道关闭(fail-closed)
  const auth2 = createAuth({ env: { SESSION_SECRET: 'test-secret' } });
  const signed = signInternalRequest({ action: 'h5Token', payload, secret });
  await assert.rejects(() => auth2.require(createMemoryRepository(), 'h5Token', { internalAuth: signed, payload }), /缺少 INTERNAL_SECRET/);
});
