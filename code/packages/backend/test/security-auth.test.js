import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';
import {
  createMemoryDb,
  seedAdmin,
  seedWorker,
  seedCs,
  seedProduct,
  createPaidOrder,
  enterPool,
  grabToService,
  customerSession,
} from './helpers.js';
import {
  authLogin,
  verifySessionToken,
  issueSessionToken,
  getSessionSecret,
  dispatch,
  saveProduct,
  listOrders,
  listWorkers,
  getWallet,
  getMyOrder,
  releaseOrder,
  listProducts,
  getProduct,
} from '../src/services.js';

test('安全：匿名调用受保护 action 被拒', () => {
  const db = createMemoryDb();
  assert.throws(() => listOrders(db, {}, null), /未登录|会话/);
  assert.throws(() => saveProduct(db, { title: 'x', priceFen: 100, commission: { type: 'fixed', valueFen: 0 } }, null), /未登录|会话/);
});

test('安全：越权（WORKER 调用 ADMIN action）被拒', () => {
  const db = createMemoryDb();
  const w = seedWorker(db);
  assert.throws(() => saveProduct(db, { title: 'x', priceFen: 100, commission: { type: 'fixed', valueFen: 0 } }, w.session), /无权限/);
});

test('安全：伪造/篡改会话 token 校验失败', () => {
  assert.throws(() => verifySessionToken('garbage', getSessionSecret()), /无效/);
  assert.throws(() => verifySessionToken('a.b.c', getSessionSecret()), /无效/);
  const forged = issueSessionToken({ userId: 'u1', role: 'ADMIN' }, 'other-secret');
  assert.throws(() => verifySessionToken(forged, getSessionSecret()), /无效/);
});

test('安全：客户 A 不能查看客户 B 的订单（owner 隔离）', () => {
  const db = createMemoryDb();
  seedAdmin(db); seedCs(db); seedWorker(db);
  const p = seedProduct(db);
  const orderA = createPaidOrder(db, p, { openid: 'mp-a', contactWechat: 'wx-a' });
  assert.throws(() => getMyOrder(db, { orderId: orderA._id }, customerSession('mp-b')), /无权/);
  assert.ok(getMyOrder(db, { orderId: orderA._id }, customerSession('mp-a')));
});

test('安全：接单人员不能操作他人订单（篡改 ID 被拒）', () => {
  const db = createMemoryDb();
  seedAdmin(db); const cs = seedCs(db);
  const w1 = seedWorker(db);
  const w2 = seedWorker(db, { phone: '13800000009' });
  const p = seedProduct(db);
  const order = grabToService(db, enterPool(db, createPaidOrder(db, p), cs.session), w1.session);
  assert.throws(() => releaseOrder(db, { orderId: order._id }, w2.session), /只能退自己的订单/);
});

test('安全：公开 action 无需会话可访问', () => {
  const db = createMemoryDb();
  seedAdmin(db);
  const p = seedProduct(db);
  assert.equal(listProducts(db).length, 1);
  assert.ok(getProduct(db, { productId: p._id }));
});

test('安全：authLogin 签发 token 可经 verifySessionToken 还原角色', () => {
  const db = createMemoryDb();
  seedAdmin(db);
  const login = authLogin(db, { phone: '13800000000', password: 'admin123' });
  const session = verifySessionToken(login.token, getSessionSecret());
  assert.equal(session.role, 'ADMIN');
});

test('安全：角色归一化（CS 兼容 CUSTOMER_SERVICE）', () => {
  const db = createMemoryDb();
  const cs = { userId: 'cs-1', role: 'CS' };
  assert.doesNotThrow(() => listWorkers(db, {}, cs)); // CS 可访问（K-07）
  assert.throws(() => getWallet(db, {}, cs), /无权限/); // WORKER/ADMIN 专属仍拒绝
});

test('错误封套：dispatch 业务错误返回 {ok:false, code, message} 不 throw', () => {
  const db = createMemoryDb();
  const r1 = dispatch(db, 'listOrders', {}, null);
  assert.equal(r1.ok, false);
  assert.equal(r1.code, 'UNAUTHORIZED');
  assert.ok(r1.message);
  const r2 = dispatch(db, 'noSuchAction', {}, null);
  assert.equal(r2.ok, false);
  assert.equal(r2.code, 'NOT_FOUND');
  seedAdmin(db);
  seedProduct(db);
  const r3 = dispatch(db, 'listProducts', {}, null);
  assert.ok(Array.isArray(r3));
  assert.equal(r3.length, 1);
});
