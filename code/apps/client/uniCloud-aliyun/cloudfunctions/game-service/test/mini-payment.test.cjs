'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.SESSION_SECRET = 'unit-test-session-only';
process.env.H5_TOKEN_SECRET = 'unit-test-h5-only';
process.env.APP_ENV = 'development';
process.env.PAYMENT_MODE = 'wechat';
process.env.WECHAT_MP_APPID = 'wxMiniTest';
const { createMemoryRepository } = require('../lib/repository.cjs');
const { createAuth } = require('../lib/auth.cjs');
const Payment = require('../lib/payment-operations.cjs');
const services = require('../lib/services.cjs');
const session = { userId: 'c1', role: 'CUSTOMER', openid: 'mini-openid', brandScopes: ['b1'] };

test('原生支付：会话归属、身份参数、重复支付、查单确认和错误处理', async t => {
  const repo = createMemoryRepository();
  // 模拟云端查询返回独立快照，事务仅允许doc单记录更新，避免内存引用掩盖问题。
  const originalGet = repo.getById.bind(repo);
  repo.getById = async (...args) => structuredClone(await originalGet(...args));
  const originalTransaction = repo.transaction.bind(repo);
  repo.transaction = fn => originalTransaction(tr => fn({ ...tr, updateWhere: async () => { throw new Error('Aliyun transaction does not support where().update()'); } }));
  await repo.insert('brands', { _id: 'b1', brandId: 'b1', appId: 'wxMiniTest', channelRefs: { paymentSecretRef: 'secret/test' }, binding: { merchant: '123' } });
  await repo.insert('customers', { _id: 'c1', openid: session.openid, brandId: 'b1' });
  await repo.insert('orders', { _id: 'o1', orderNo: 'TEST1', brandId: 'b1', customerId: session.openid, productId: 'p1', amountFen: 1, status: 'PENDING_PAYMENT', createdAt: Date.now(), payDeadline: Date.now() + 600000 });
  const original = Payment.clientFor;
  const snapshot = { brandCode: 'b1', appId: 'wxMiniTest', mchid: '123' };
  let sent; let trade = 'NOTPAY'; let queryError; let payer = session.openid; let amount = 1;
  const client = {
    isConfigured: () => true,
    jsapiPrepay: async payload => { sent = payload; return 'prepay-test'; },
    jsapiPayParams: async ({ prepayId, appid }) => ({ appId: appid, package: `prepay_id=${prepayId}` }),
    queryTransaction: async () => { if (queryError) throw queryError; return { out_trade_no: 'TEST1', mchid: '123', appid: 'wxMiniTest', trade_state: trade, transaction_id: 'tx1', amount: { total: amount, currency: 'CNY' }, payer: { openid: payer } }; },
  };
  Payment.clientFor = (_order, _secret, appId) => { if (appId) assert.equal(appId, 'wxMiniTest'); return { client, snapshot }; };
  t.after(() => { Payment.clientFor = original; });
  const auth = createAuth({ env: process.env });
  await assert.rejects(() => auth.require(repo, 'getMiniPaymentParams', { payload: { orderId: 'o1' } }));
  const token = auth.issueSession({ _id: 'c1', role: 'CUSTOMER' }, { roles: ['CUSTOMER'], brandScopes: ['b1'] }).token;
  const context = await auth.require(repo, 'getMiniPaymentParams', { token, payload: { orderId: 'o1' } });
  assert.equal(context.session.openid, session.openid);
  await assert.rejects(() => services.getMiniPaymentParams(repo, { orderId: 'o1' }, { ...session, openid: 'other' }), /无权/);
  await assert.rejects(() => services.getMiniPaymentStatus(repo, { orderId: 'o1' }, { ...session, brandScopes: ['b2'] }), /无权/);
  await assert.rejects(() => services.getMiniPaymentParams(repo, { orderId: 'o1' }, null), /重新登录/);
  await repo.updateById('orders', 'o1', { customerId: '' });
  await assert.rejects(() => services.getMiniPaymentParams(repo, { orderId: 'o1' }, session), /无权/);
  await repo.updateById('orders', 'o1', { customerId: session.openid });
  const first = await services.getMiniPaymentParams(repo, { orderId: 'o1', amountFen: 999, openid: 'forged', appId: 'wxForged' }, session);
  assert.equal(sent.openid, session.openid); assert.equal(sent.appid, 'wxMiniTest'); assert.equal(sent.amountFen, 1);
  assert.equal(first.params.appId, 'wxMiniTest');
  const second = await services.getMiniPaymentParams(repo, { orderId: 'o1' }, session);
  assert.equal(second.paymentId, first.paymentId);
  assert.equal((await repo.find('payments', {})).length, 1);
  assert.equal((await repo.getById('payments', first.paymentId)).configSnapshot.appId, 'wxMiniTest');
  queryError = Object.assign(new Error('not created'), { code: 'ORDER_NOT_EXIST' });
  assert.equal((await services.getMiniPaymentStatus(repo, { orderId: 'o1' }, session)).status, 'PENDING');
  queryError = new Error('signature invalid');
  await assert.rejects(() => services.getMiniPaymentStatus(repo, { orderId: 'o1' }, session), /signature/);
  queryError = null;
  assert.equal((await services.getMiniPaymentStatus(repo, { orderId: 'o1' }, session)).status, 'PENDING');
  trade = 'SUCCESS'; payer = 'other';
  await assert.rejects(() => services.getMiniPaymentStatus(repo, { orderId: 'o1' }, session), /付款人/);
  payer = session.openid; amount = 2;
  await assert.rejects(() => services.getMiniPaymentStatus(repo, { orderId: 'o1' }, session), /金额/);
  amount = 1;
  const workingTransaction = repo.transaction;
  repo.transaction = fn => originalTransaction(tr => fn({ ...tr, insert: async () => { throw new Error('test commit rollback'); }, updateWhere: async () => { throw new Error('where forbidden'); } }));
  await assert.rejects(() => services.getMiniPaymentStatus(repo, { orderId: 'o1' }, session), /rollback/);
  assert.equal((await repo.getById('orders', 'o1')).status, 'PENDING_PAYMENT');
  assert.equal((await repo.getById('payments', first.paymentId)).status, 'PENDING');
  repo.transaction = workingTransaction;
  const confirmed = await services.getMiniPaymentStatus(repo, { orderId: 'o1' }, session);
  assert.equal(confirmed.status, 'SUCCESS');
  assert.equal(confirmed.orderStatus, 'PENDING_ACCEPT');
  assert.equal((await repo.getById('orders', 'o1')).status, 'PENDING_ACCEPT');
  assert.equal((await services.getMiniPaymentStatus(repo, { orderId: 'o1' }, session)).status, 'SUCCESS');
  assert.equal((await repo.find('order_logs', {})).length, 1);
  // 兼容支付单成功但订单状态未推进的历史不一致，仍需真实查单确认。
  await repo.updateById('orders', 'o1', { status: 'PENDING_PAYMENT' });
  assert.equal((await services.getMiniPaymentStatus(repo, { orderId: 'o1' }, session)).orderStatus, 'PENDING_ACCEPT');
  assert.equal((await repo.find('order_logs', {})).length, 1);
  await assert.rejects(() => services.getMiniPaymentParams(repo, { orderId: 'o1' }, session), /已支付/);
  await repo.updateById('orders', 'o1', { status: 'PENDING_PAYMENT', payDeadline: Date.now() - 1 });
  await assert.rejects(() => services.getMiniPaymentParams(repo, { orderId: 'o1' }, session), /超时/);
  await repo.updateById('orders', 'o1', { payDeadline: Date.now() + 600000 });
  await repo.updateById('payments', first.paymentId, { channel: 'WECHAT_JSAPI', status: 'PENDING' });
  await assert.rejects(() => services.getMiniPaymentParams(repo, { orderId: 'o1' }, session), /网页支付/);
});
