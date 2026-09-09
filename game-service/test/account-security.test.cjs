'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const S = require('../lib/account-security.cjs');
const { createMemoryRepository } = require('../lib/repository.cjs');
const env = { SESSION_SECRET: 'session-secret-for-commercial-tests-only-32', MFA_ENCRYPTION_KEY: Buffer.alloc(32, 41).toString('base64'), APP_ENV: 'staging' };
async function fixture() {
  const repo = createMemoryRepository();
  await repo.insert('users', { _id: 'admin', role: 'ADMIN', phone: '13800000000', passwordHash: crypto.createHash('sha256').update('Valid-Password-123').digest('hex'), status: 'ACTIVE' });
  return { repo, engine: S.createAccountSecurity({ repo, env, async: true }) };
}
test('scrypt uses random salts, bounds work factors and rejects wrong/oversized passwords', () => {
  const a = S.hashPassword('Valid-Password-123');
  assert.match(a, /^scrypt\$/);
  assert.notEqual(a, S.hashPassword('Valid-Password-123'));
  assert.equal(S.verifyPassword('Valid-Password-123', a).valid, true);
  assert.equal(S.verifyPassword('wrong', a).valid, false);
  assert.equal(S.verifyPassword('x', 'scrypt$1073741824$8$1$AA$AA').valid, false);
  assert.throws(() => S.assertPasswordStrength('admin123'), /密码/);
});
test('legacy successful login migrates hash, setup-restricted session cannot perform refunds, revoke invalidates immediately', async () => {
  const { repo, engine } = await fixture();
  const user = await engine.login({ phone: '13800000000', password: 'Valid-Password-123', roles: ['ADMIN'] }, { sourceIp: '192.0.2.1' });
  assert.match((await repo.getById('users', 'admin')).passwordHash, /^scrypt\$/);
  const claims = await engine.createSession(user, { roles: ['ADMIN'] });
  assert.equal(claims.scope, 'security-setup');
  await assert.rejects(engine.validateSession(claims, 'approveRefund'), /MFA/);
  await engine.revokeSessions({}, claims);
  await assert.rejects(engine.validateSession(claims, 'getSecurityStatus'), /会话/);
});
test('persistent account, IP and device limits survive a new service instance', async () => {
  const { repo, engine } = await fixture();
  for (let i = 0; i < 5; i++) await assert.rejects(engine.login({ phone: '13800000000', password: 'bad' }, { sourceIp: '192.0.2.2', deviceId: 'browser-1' }));
  const restarted = S.createAccountSecurity({ repo, env, async: true });
  await assert.rejects(restarted.login({ phone: '13800000000', password: 'Valid-Password-123' }, { sourceIp: '192.0.2.3', deviceId: 'browser-2' }), /锁定|频繁/);
  const events = await repo.find('login_events', {});
  assert.ok(events.length >= 5);
  assert.ok(events.every((row) => !JSON.stringify(row).includes('Valid-Password')));
});
test('TOTP RFC vector, encrypted enrollment, replay prevention, single-use recovery and step-up expiry', async () => {
  assert.equal(S.totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59000, 8), '94287082');
  const { repo, engine } = await fixture();
  const user = await engine.login({ phone: '13800000000', password: 'Valid-Password-123', roles: ['ADMIN'] });
  const session = await engine.createSession(user, { roles: ['ADMIN'] });
  const setup = await engine.setupMfa({ password: 'Valid-Password-123' }, session);
  const stored = await repo.getById('account_security', 'admin');
  assert.ok(!JSON.stringify(stored).includes(setup.secret));
  const enabled = await engine.enableMfa({ code: S.totp(setup.secret) }, session);
  assert.equal(enabled.recoveryCodes.length, 8);
  await assert.rejects(engine.login({ phone: '13800000000', password: 'Valid-Password-123', mfaCode: S.totp(setup.secret) }), /登录|验证码|密码/);
  const recovered = await engine.login({ phone: '13800000000', password: 'Valid-Password-123', recoveryCode: enabled.recoveryCodes[0] });
  await assert.rejects(engine.login({ phone: '13800000000', password: 'Valid-Password-123', recoveryCode: enabled.recoveryCodes[0] }));
  const current = await engine.createSession(recovered, { roles: ['ADMIN'] });
  const proof = await engine.verifySecurityChallenge({ password: 'Valid-Password-123', recoveryCode: enabled.recoveryCodes[1] }, current);
  assert.ok(proof.token);
  assert.equal(S.verifyStepUpToken(proof.token, current, env).userId, 'admin');
  assert.throws(() => S.verifyStepUpToken(proof.token, { ...current, sid: 'other' }, env), /二次/);
  assert.throws(() => S.verifyStepUpToken(proof.token, current, env, Date.now() + 6 * 60e3), /二次/);
});
test('password change invalidates every session and public user never exposes hashes or MFA material', async () => {
  const { repo, engine } = await fixture();
  const user = await engine.login({ phone: '13800000000', password: 'Valid-Password-123' });
  const session = await engine.createSession(user);
  await engine.changePassword({ oldPassword: 'Valid-Password-123', newPassword: 'New-Password-789' }, session);
  await assert.rejects(engine.validateSession(session, 'getSecurityStatus'), /会话/);
  const publicUser = S.publicUser(await repo.getById('users', 'admin'));
  assert.equal(publicUser.passwordHash, undefined);
  assert.equal(publicUser.loginFailCount, undefined);
});
