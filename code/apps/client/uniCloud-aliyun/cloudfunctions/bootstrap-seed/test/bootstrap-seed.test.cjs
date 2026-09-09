'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryRepository } = require('../lib/repository.cjs');
const Privacy = require('../lib/privacy.cjs');
const bootstrapSeed = require('../index.js');

const encryptionKey = Buffer.alloc(32, 17).toString('base64');
const blindIndexKey = Buffer.alloc(32, 29).toString('base64');

function createEnv() {
  return {
    APP_ENV: 'production',
    BOOTSTRAP_SECRET: 'bootstrap-test-secret-must-be-at-least-32-characters',
    BOOTSTRAP_BRAND_APPID: 'wx-bootstrap-test',
    PII_KEY_VERSION: 'v1',
    PII_KEYS_JSON: JSON.stringify({ v1: encryptionKey }),
    PII_BLIND_INDEX_KEY: blindIndexKey,
  };
}

test('入口拒绝缺失或错误的 secret，且不暴露配置值', async () => {
  const env = createEnv();
  const before = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  const missing = await bootstrapSeed({}, {});
  const wrong = await bootstrapSeed({ secret: 'wrong-secret' }, {});
  for (const [key, value] of Object.entries(before)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  assert.equal(missing.ok, false);
  assert.equal(missing.code, 'BOOTSTRAP_FORBIDDEN');
  assert.deepEqual(wrong, missing);
  assert.equal(JSON.stringify(wrong).includes(env.BOOTSTRAP_SECRET), false);
});

test('入口拒绝从客户端网关直接重复执行', async () => {
  const env = createEnv();
  const before = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  const result = await bootstrapSeed({ secret: env.BOOTSTRAP_SECRET }, { SOURCE: 'client' });
  for (const [key, value] of Object.entries(before)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  assert.deepEqual(result, { ok: false, code: 'BOOTSTRAP_FORBIDDEN', message: '仅允许从云端控制台执行初始化' });
});

test('初始化正式最小数据且重复执行保持幂等', async () => {
  const env = createEnv();
  const rawRepo = createMemoryRepository();
  const repo = Privacy.protectRepository(rawRepo, env);
  repo.transaction = async () => { throw new Error('云端事务不支持条件查询'); };

  const first = await bootstrapSeed.initialize(repo, env);
  const second = await bootstrapSeed.initialize(repo, env);

  assert.equal(first.ok, true);
  assert.equal(first.created.includes('brands:demo-a'), true);
  assert.equal(first.created.includes('users:admin'), true);
  assert.equal(first.created.includes('user_brand_roles:demo-a'), true);
  assert.equal(first.created.filter((item) => item.startsWith('configs:')).length, 10);
  assert.deepEqual(second.created, []);
  assert.equal(second.skipped.includes('brands:demo-a'), true);
  assert.equal(second.skipped.includes('users:admin'), true);
  assert.equal(second.skipped.includes('user_brand_roles:demo-a'), true);
  assert.equal(second.skipped.filter((item) => item.startsWith('configs:')).length, 10);

  const [storedUser] = await rawRepo.find('users', {});
  assert.match(storedUser.phone, /^pii:v1:/);
  assert.equal(typeof storedUser.phoneBlindIndex, 'string');
  assert.equal(storedUser.phoneBlindIndex.length, 64);
  assert.match(storedUser.passwordHash, /^scrypt\$/);
  assert.equal(storedUser.passwordHash.includes('admin123'), false);
  assert.equal(storedUser.mustChangePwd, true);

  const brand = await rawRepo.findOne('brands', { brandId: 'demo-a' });
  assert.equal(brand.appId, env.BOOTSTRAP_BRAND_APPID);
  assert.equal(brand.isDefault, true);

  const role = await rawRepo.findOne('user_brand_roles', { userId: storedUser._id, brandId: 'demo-a' });
  assert.deepEqual(role.roles, ['ADMIN']);
  assert.deepEqual(role.permissions, []);
  assert.equal(role.status, 'ACTIVE');

  const configs = await rawRepo.find('configs', {});
  assert.equal(configs.length, 10);
  assert.equal(first.created.some((item) => item.includes('13800000000')), false);
  assert.equal(JSON.stringify(first).includes('admin123'), false);
});

test('已有管理员信息冲突时拒绝覆盖', async () => {
  const env = createEnv();
  const rawRepo = createMemoryRepository();
  const repo = Privacy.protectRepository(rawRepo, env);
  await repo.insert('users', {
    _id: 'existing-user',
    role: 'WORKER',
    phone: '13800000000',
    passwordHash: 'existing-hash',
    status: 'ACTIVE',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  await assert.rejects(
    bootstrapSeed.initialize(repo, env),
    (error) => error && error.code === 'BOOTSTRAP_DATA_CONFLICT',
  );
  const stored = await repo.findOne('users', { phone: '13800000000' });
  assert.equal(stored.role, 'WORKER');
  assert.equal(stored.passwordHash, 'existing-hash');
});
