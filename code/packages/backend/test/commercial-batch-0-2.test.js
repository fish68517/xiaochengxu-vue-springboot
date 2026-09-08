import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';
import { validateReleaseEnvironment } from '../../../scripts/release-preflight.mjs';
import { startApiServer } from '../../../scripts/api-server.mjs';
import { signInternalRequest, verifyInternalRequest } from '../src/internal-auth.js';
import { buildH5OrderLink } from '../src/h5-link.js';
import { issueH5Token, verifyH5Token } from '../src/token.js';
import { createMemoryDb } from '../src/db.js';
import { getH5Product, revokeH5Token } from '../src/services.js';

function productionEnv(overrides = {}) {
  return {
    API_MODE: 'unicloud', PAYMENT_MODE: 'wechat', MESSAGE_MODE: 'wechat', BRAND_CODE: 'xinghe',
    VITE_APP_ENV: 'production', VITE_API_MODE: 'unicloud', VITE_BRAND_CODE: 'xinghe',
    SESSION_SECRET: 'session-secret-32-characters-minimum-001',
    H5_TOKEN_SECRET: 'h5-token-secret-32-characters-minimum-02',
    INTERNAL_SECRET: 'internal-secret-32-characters-minimum-03',
    SCHEDULER_SECRET: 'scheduler-secret-32-characters-minimum-4',
    UNICLOUD_SPACE: 'prod-space-xinghe',
    HOSTING_CLIENT_URL: 'https://h5.xinghe.cn',
    HOSTING_BACKEND_URL: 'https://admin.xinghe.cn',
    H5_ORDER_BASE_URL: 'https://h5.xinghe.cn',
    WECHAT_PAY_MCHID: '1900000001', WECHAT_PAY_SERIAL_NO: 'SERIAL001',
    WECHAT_PAY_PRIVATE_KEY: 'private-key-is-loaded-from-secret-manager',
    WECHAT_PAY_APIV3_KEY: 'api-v3-key-is-loaded-from-secrets',
    WECHAT_PAY_APPID: 'wx1234567890abcd', WECHAT_PAY_NOTIFY_URL: 'https://api.xinghe.cn/pay-notify',
    WECHAT_MP_KF_TOKEN: 'wechat-kf-token-secret', WECHAT_MP_APPID: 'wx1234567890abcd',
    WECHAT_MP_SECRET: 'wechat-mp-secret-32-characters-minimum',
    ACCOUNT_SECURITY_ENFORCE: 'true',
    MFA_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'), MFA_ENCRYPTION_KEY_VERSION: 'v1',
    PII_KEY_VERSION: 'v1', PII_KEYS_JSON: JSON.stringify({ v1: Buffer.alloc(32, 2).toString('base64') }),
    PII_BLIND_INDEX_KEY: Buffer.alloc(32, 3).toString('base64'), BACKUP_ENCRYPTION_KEY: Buffer.alloc(32, 4).toString('base64'),
    PRIVACY_LEGAL_DOCUMENTS_JSON: JSON.stringify(['privacy', 'terms', 'minors', 'service', 'refund'].map((type) => ({ brandId: 'xinghe', type, title: type, version: '2026-09', url: `https://legal.xinghe.cn/${type}` }))),
    PRIVACY_RETENTION_POLICY_JSON: JSON.stringify({ approved: true, version: '2026-09' }), ACCOUNT_CLOSURE_COOLING_DAYS: '7',
    WECHAT_PAY_CONFIG_MAP: JSON.stringify({ production: { xinghe: { envPrefix: 'WECHAT_PAY', entityId: 'entity-xinghe', appId: 'wx1234567890abcd', mchid: '1900000001', boundAppIds: ['wx1234567890abcd'] } } }),
    ALERT_WEBHOOK_URL: 'https://alerts.xinghe.cn/webhook',
    RELEASE_APPROVED: 'true', COMMERCIAL_DECISIONS_APPROVED: 'true',
    BRAND_ENTITY_MODE: 'single-entity', PRODUCTION_BRAND_CODES: 'xinghe,qinglan', DEMO_DATA_ENABLED: 'false',
    DB_BACKUP_ID: 'backup-20260906', ROLLBACK_BUNDLE_PATH: 'rollback/prod-20260906.zip',
    COMMERCIAL_EVIDENCE_MANIFEST: 'artifacts/acceptance.json', SECURITY_SCAN_REPORT: 'artifacts/security-scan.json',
    SBOM_PATH: 'artifacts/sbom.json', CAPACITY_REPORT: 'artifacts/capacity.json',
    ...overrides,
  };
}

test('商用 Batch 0：production 合法配置通过，demo/localhost/短密钥被门禁拒绝', () => {
  assert.equal(validateReleaseEnvironment('production', productionEnv()).ok, true);
  const bad = validateReleaseEnvironment('production', productionEnv({
    BRAND_CODE: 'demo-a', PRODUCTION_BRAND_CODES: 'demo-a', HOSTING_CLIENT_URL: 'http://127.0.0.1:5173', INTERNAL_SECRET: 'short',
  }));
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((item) => item.includes('demo 品牌')));
  assert.ok(bad.errors.some((item) => item.includes('必须使用 https')));
  assert.ok(bad.errors.some((item) => item.includes('长度至少 32')));
});

test('商用 Batch 1：H5 链接固定 Hash 路由，token 绑定 purpose/jti 且支持撤销', () => {
  const token = issueH5Token({ productId: 'p-1', brandId: 'xinghe', openid: 'openid-1' }, process.env.H5_TOKEN_SECRET);
  const link = buildH5OrderLink('https://h5.xinghe.cn/', token);
  assert.match(link, /^https:\/\/h5\.xinghe\.cn\/#\/pages\/h5-order\/index\?token=/);
  const claims = verifyH5Token(token, process.env.H5_TOKEN_SECRET);
  assert.equal(claims.purpose, 'h5-order');
  assert.ok(claims.jti);

  const db = createMemoryDb();
  db.products.push({ _id: 'p-1', brandId: 'xinghe', status: 'ON', title: '服务' });
  assert.equal(getH5Product(db, { token }).product._id, 'p-1');
  const session = { userId: 'cs-1', role: 'CUSTOMER_SERVICE', brandScopes: ['xinghe'] };
  assert.equal(revokeH5Token(db, { token, reason: '误发' }, session).revoked, true);
  assert.throws(() => getH5Product(db, { token }), /已失效/);
  assert.equal(revokeH5Token(db, { token }, session).duplicate, true);
});

test('商用 Batch 2：内部签名绑定 payload，过期或篡改均拒绝', () => {
  const secret = 'internal-secret-32-characters-minimum-03';
  const payload = { now: 123, nested: { b: 2, a: 1 } };
  const auth = signInternalRequest({ action: 'timeoutMarkPool', payload, secret, timestamp: 1_700_000_000_000, nonce: 'nonce_abcdefghijklmnop' });
  assert.equal(verifyInternalRequest({ action: 'timeoutMarkPool', payload, auth, secret, now: 1_700_000_001_000 }).nonce, auth.nonce);
  assert.throws(() => verifyInternalRequest({ action: 'timeoutMarkPool', payload: { now: 124 }, auth, secret, now: 1_700_000_001_000 }), /签名非法/);
  assert.throws(() => verifyInternalRequest({ action: 'timeoutMarkPool', payload, auth, secret, now: 1_700_001_000_000 }), /已过期/);
});

test('商用 Batch 2：本地镜像系统 action 无签名拒绝，正确签名一次成功并防重放', async () => {
  const previous = process.env.INTERNAL_SECRET;
  process.env.INTERNAL_SECRET = 'local-internal-secret-32-characters-0001';
  const server = await startApiServer({ port: 0, seed: false });
  try {
    const url = `http://127.0.0.1:${server.port}/api/timeoutMarkPool`;
    const unsigned = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(unsigned.status, 401);

    const payload = {};
    const auth = signInternalRequest({ action: 'timeoutMarkPool', payload, secret: process.env.INTERNAL_SECRET });
    const headers = {
      'content-type': 'application/json',
      'x-internal-timestamp': String(auth.timestamp),
      'x-internal-nonce': auth.nonce,
      'x-internal-signature': auth.signature,
    };
    const ok = await fetch(url, { method: 'POST', headers, body: '{}' });
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { marked: 0 });
    const replay = await fetch(url, { method: 'POST', headers, body: '{}' });
    assert.equal(replay.status, 401);
  } finally {
    await server.close();
    if (previous === undefined) delete process.env.INTERNAL_SECRET; else process.env.INTERNAL_SECRET = previous;
  }
});
