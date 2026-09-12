'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createAuth } = require('../lib/auth.cjs');
const { createMemoryRepository } = require('../lib/repository.cjs');
const policy = require('../lib/staff-brand-access.cjs');
const services = require('../lib/services.cjs');
const auth = createAuth({ env: { APP_ENV: 'development', SESSION_SECRET: 'staff-brand-test-only' } });

async function setup(role = 'CS') {
  const repo = createMemoryRepository();
  const user = await repo.insert('users', { _id: 'staff', role, status: 'ACTIVE', phone: 'test-staff', passwordHash: auth.hashPassword('Staff-Test-123456'), mustChangePwd: false, securityVersion: 0 });
  await repo.insert('brands', { _id: 'b', brandId: 'demo-a', name: '星河服务' });
  await repo.insert('orders', { _id: 'o', orderNo: 'TEST', brandId: 'demo-a', status: 'PENDING_GRAB', workerId: 'other' });
  const token = auth.issueSession(user, { brandScopes: ['default'] }).token;
  return { repo, user, token };
}

test('旧客服会话直接获得全品牌范围，登录返回相同范围', async () => {
  const { repo, token } = await setup('CUSTOMER_SERVICE');
  const { session } = await auth.require(repo, 'listOrders', { token });
  assert.deepEqual(session.brandScopes, ['*']);
  assert.equal((await services.listOrders(repo, {}, session)).length, 1);
  assert.deepEqual((await auth.login(repo, { phone: 'test-staff', password: 'Staff-Test-123456' })).brandScopes, ['*']);
  assert.equal((await services.getAccessProfile(repo, {}, session)).staffAllBrands, true);
});

test('工作人员跨品牌接单资格放开，但他人订单与管理员接口仍禁止', async () => {
  const { repo, token } = await setup('WORKER');
  const { session } = await auth.require(repo, 'listMyOrders', { token });
  assert.deepEqual(session.brandScopes, ['*']);
  assert.equal((await services.listPool(repo, {}, session)).length, 1);
  assert.equal((await services.listMyOrders(repo, {}, session)).length, 0);
  await assert.rejects(() => services.getMyOrder(repo, { orderId: 'o' }, session), /他人订单/);
  await assert.rejects(() => auth.require(repo, 'listOrders', { token }), /无权/);
  await assert.rejects(() => auth.require(repo, 'enterOrder', { token }), error => error.code === 'ROLE_FORBIDDEN' && /客服录入权限/.test(error.message));
  const cs = { userId: 'cs', role: 'CS', brandScopes: ['*'] };
  assert.equal((await services.listWorkers(repo, { brandId: 'demo-a' }, cs)).length, 1);
  assert.equal((await services.assignOrder(repo, { orderId: 'o', workerId: 'staff' }, cs)).status, 'ASSIGN_PENDING');
});

test('停用账号不能因全品牌策略继续访问', async () => {
  const { repo, token } = await setup('WORKER');
  await repo.updateById('users', 'staff', { status: 'DISABLED' });
  await assert.rejects(() => auth.require(repo, 'listPool', { token }), /会话已失效/);
  assert.equal((await services.listWorkers(repo, { brandId: 'demo-a' }, { role: 'CS', brandScopes: ['*'] })).length, 0);
});

test('客户身份与品牌范围不扩大', async () => {
  const repo = createMemoryRepository();
  await repo.insert('customers', { _id: 'customer', openid: 'customer-test', brandId: 'demo-a' });
  const token = auth.issueSession({ _id: 'customer', role: 'CUSTOMER' }, { brandScopes: ['demo-a'] }).token;
  const { session } = await auth.require(repo, 'listMyOrders', { token });
  assert.deepEqual(session.brandScopes, ['demo-a']);
  await assert.rejects(() => auth.require(repo, 'listPool', { token }), /无权/);
});

test('关闭开关后按数据库授权收回旧 token 中的全品牌范围', async (t) => {
  const original = { ...policy };
  const context = { module: { exports: {} } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../lib/staff-brand-access.cjs'), 'utf8').replace('STAFF_ALL_BRANDS = true', 'STAFF_ALL_BRANDS = false'), context);
  Object.assign(policy, context.module.exports);
  t.after(() => Object.assign(policy, original));
  const { repo, user } = await setup();
  await repo.insert('user_brand_roles', { _id: 'grant', userId: user._id, brandId: 'only-b', status: 'ACTIVE' });
  const token = auth.issueSession(user, { brandScopes: ['*'] }).token;
  const { session } = await auth.require(repo, 'listOrders', { token });
  assert.equal(JSON.stringify(session.brandScopes), '["only-b"]');
  assert.equal((await services.listOrders(repo, {}, session)).length, 0);
});
