import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = require('../../../uniCloud-tcb/cloudfunctions/game-service/lib/privacy.cjs');
const { createMemoryRepository } = require('../../../uniCloud-tcb/cloudfunctions/game-service/lib/repository.cjs');
const env = { APP_ENV: 'staging', PII_KEY_VERSION: 'v1', PII_KEYS_JSON: JSON.stringify({ v1: Buffer.alloc(32, 17).toString('base64'), v2: Buffer.alloc(32, 18).toString('base64') }), PII_BLIND_INDEX_KEY: Buffer.alloc(32, 19).toString('base64'), ACCOUNT_CLOSURE_COOLING_DAYS: '7', PRIVACY_LEGAL_DOCUMENTS_JSON: JSON.stringify([{ type: 'privacy', title: '隐私政策', version: '2026-09', url: 'https://legal.example.org/privacy', brandId: 'a' }]) };
const customer = { userId: 'c1', role: 'CUSTOMER', brandScopes: ['a'] };
const admin = { userId: 'a1', role: 'ADMIN', brandScopes: ['a'] };
function setup(options = {}) { const repo = createMemoryRepository(); return { repo, svc: P.createPrivacyServices({ env, verifyStepUp: async (_repo, _session, token) => token === 'verified', ...options }) }; }
test('PII uses authenticated random encryption, version rotation, brand-bound AAD, and blind indexes', () => {
  const a = P.encryptPii('13800138000', 'users.phone:a', env);
  const b = P.encryptPii('13800138000', 'users.phone:a', env);
  assert.notEqual(a, b); assert.ok(!a.includes('13800138000'));
  assert.equal(P.decryptPii(a, 'users.phone:a', env), '13800138000');
  assert.throws(() => P.decryptPii(a, 'users.phone:b', env));
  const rotated = P.encryptPii(P.decryptPii(a, 'users.phone:a', env), 'users.phone:a', { ...env, PII_KEY_VERSION: 'v2' });
  assert.equal(P.decryptPii(rotated, 'users.phone:a', env), '13800138000');
  assert.notEqual(P.blindIndex('13800138000', 'users.phone:a', env), P.blindIndex('13800138000', 'users.phone:b', env));
  assert.throws(() => P.encryptPii('x', 'ctx', { APP_ENV: 'production' }), /密钥/);
});
test('repository stores encrypted PII and supports exact lookup + legacy gradual migration', async () => {
  const raw = createMemoryRepository(); const repo = P.protectRepository(raw, env);
  await repo.insert('users', { _id: 'u1', brandId: 'a', phone: '13800138000', role: 'WORKER' });
  const stored = await raw.getById('users', 'u1'); assert.match(stored.phone, /^pii:v1:/);
  assert.equal((await repo.findOne('users', { phone: '13800138000' }))._id, 'u1');
  assert.equal((await repo.getById('users', 'u1')).phone, '13800138000');
  await raw.insert('users', { _id: 'legacy', phone: '13900139000', role: 'WORKER' });
  assert.equal((await repo.findOne('users', { phone: '13900139000' }))._id, 'legacy');
  assert.equal(P.redactPrivacy({ phone: '13800138000', idCard: '110101199001011234', profile: { realName: '张三' } }).phone, '138****8000');
});
test('legal consent binds official version, logs withdrawal, and never fabricates official documents', async () => {
  const { repo, svc } = setup();
  await assert.rejects(svc.recordLegalConsent(repo, { brandId: 'a', type: 'privacy', version: 'old' }, customer), /版本/);
  const consent = await svc.recordLegalConsent(repo, { brandId: 'a', type: 'privacy', version: '2026-09' }, customer);
  assert.equal(consent.status, 'GRANTED');
  await svc.withdrawLegalConsent(repo, { brandId: 'a', consentId: consent._id }, customer);
  assert.equal((await repo.getById('privacy_consents', consent._id)).status, 'WITHDRAWN');
  assert.equal((await P.createPrivacyServices({ env: {} }).getLegalDocuments(repo, { brandId: 'a' })).configured, false);
});
test('PII full view requires administrator, fresh server step-up, purpose, scope and audit before return', async () => {
  const { repo, svc } = setup(); await repo.insert('worker_profiles', { _id: 'p', brandId: 'a', workerId: 'w', realName: '张三' });
  await assert.rejects(svc.viewSensitiveProfile(repo, { profileId: 'p', purpose: '实名复核', stepUpToken: 'verified' }, { ...admin, role: 'CS' }), /权限/);
  await assert.rejects(svc.viewSensitiveProfile(repo, { profileId: 'p', purpose: '实名复核' }, admin), /二次/);
  await assert.rejects(svc.viewSensitiveProfile(repo, { profileId: 'p', purpose: '实名复核', stepUpToken: 'verified' }, { ...admin, brandScopes: ['b'] }), /品牌/);
  const result = await svc.viewSensitiveProfile(repo, { profileId: 'p', purpose: '实名复核', stepUpToken: 'verified' }, admin);
  assert.equal(result.realName, '张三'); const logs = await repo.find('privacy_audit_logs');
  assert.equal(logs.length, 1); assert.ok(logs[0].integrity); assert.ok(!JSON.stringify(logs).includes('张三'));
});
test('account closure enforces cooling period and blocking obligations, executes and notifies once', async () => {
  let now = 1000000000; const { repo, svc } = setup({ now: () => now });
  await repo.insert('users', { _id: 'c1', phone: '13800138000', status: 'ACTIVE', sessionVersion: 3 });
  const request = await svc.requestDataRight(repo, { brandId: 'a', type: 'CLOSE_ACCOUNT', reason: '不再使用' }, customer);
  await svc.reviewDataRequest(repo, { requestId: request._id, decision: 'APPROVE', note: '身份已核实', stepUpToken: 'verified' }, admin);
  await assert.rejects(svc.executeDataRequest(repo, { requestId: request._id, stepUpToken: 'verified' }, admin), /冷静/);
  now += 8 * 86400000; await repo.insert('orders', { _id: 'o', customerId: 'c1', status: 'IN_SERVICE' });
  await assert.rejects(svc.executeDataRequest(repo, { requestId: request._id, stepUpToken: 'verified' }, admin), /未完成/);
  await repo.updateById('orders', 'o', { status: 'SETTLED' });
  const done = await svc.executeDataRequest(repo, { requestId: request._id, stepUpToken: 'verified' }, admin);
  assert.equal(done.status, 'COMPLETED'); const user = await repo.getById('users', 'c1');
  assert.equal(user.status, 'CLOSED'); assert.equal(user.phone, ''); assert.equal(user.sessionVersion, 4);
  await svc.executeDataRequest(repo, { requestId: request._id, stepUpToken: 'verified' }, admin);
  assert.equal((await repo.find('notifications', { template: 'DATA_RIGHT_COMPLETED' })).length, 1);
});
test('data-right owner scope, cross-brand review and malformed correction are rejected', async () => {
  const { repo, svc } = setup();
  await assert.rejects(svc.requestDataRight(repo, { brandId: 'b', type: 'COPY', reason: '副本' }, customer), /品牌/);
  const request = await svc.requestDataRight(repo, { brandId: 'a', type: 'COPY', reason: '副本' }, customer);
  await assert.rejects(svc.cancelDataRequest(repo, { requestId: request._id }, { ...customer, userId: 'c2' }), /本人/);
  await assert.rejects(svc.requestDataRight(repo, { brandId: 'a', type: 'CORRECT', correction: { role: 'ADMIN' }, reason: '修改' }, customer), /更正/);
});
test('private attachment rejects spoofed or unscanned content and never persists a public URL', async () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  const file = { brandId: 'a', bizType: 'id_card', fileName: 'id.png', mimeType: 'image/png', size: png.length, content: png.toString('base64') };
  const worker = { userId: 'w', role: 'WORKER', brandScopes: ['a'] };
  const noScan = setup(); await assert.rejects(noScan.svc.uploadFile(noScan.repo, file, worker), /扫描/);
  const { repo, svc } = setup({ scanner: async () => ({ clean: true }), storage: { upload: async () => ({ fileID: 'private://file-1' }), sign: async () => ({ url: 'https://private.example.org/signed', expiresAt: Date.now() + 60000 }) } });
  await assert.rejects(svc.uploadFile(repo, { ...file, mimeType: 'application/pdf' }, worker), /类型/);
  await assert.rejects(svc.uploadFile(repo, { ...file, fileID: 'someone-else' }, worker), /文件引用/);
  const upload = await svc.uploadFile(repo, file, worker); const stored = await repo.getById('attachments', upload.attachmentId);
  assert.equal(stored.visibility, 'PRIVATE'); assert.equal(stored.url, undefined); assert.equal(stored.scanStatus, 'CLEAN');
  await assert.rejects(svc.getPrivateAttachmentUrl(repo, { attachmentId: stored._id }, customer), /权限/);
});
