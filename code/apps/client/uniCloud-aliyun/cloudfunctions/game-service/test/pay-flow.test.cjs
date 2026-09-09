'use strict';
// 支付链路测试(Phase 3 波次 5a):getPaymentParams 两态 + 继续支付校验 + payNotify 幂等/对账 + 退款回调 + URL 化路由。
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SESSION_SECRET = 'test-secret';
process.env.H5_TOKEN_SECRET = 'test-h5-secret';

const { createAuth, hashPassword } = require('../lib/auth.cjs');
const { createUniCloudRepository } = require('../lib/repository.cjs');
const { main } = require('../index.js');

function createMockDb() {
  const store = new Map();
  const coll = (name) => {
    if (!store.has(name)) store.set(name, []);
    return store.get(name);
  };
  const where = (name, whereObj) => ({
    async get() {
      return { data: coll(name).filter((doc) => Object.entries(whereObj).every(([k, v]) => doc[k] === v)) };
    },
    limit() { return this; },
    async update(patch) {
      const list = coll(name).filter((doc) => Object.entries(whereObj).every(([k, v]) => doc[k] === v));
      list.forEach((doc) => Object.assign(doc, patch));
      return { updated: list.length };
    },
  });
  const doc = (name, id) => ({
    async get() { return { data: [coll(name).find((d) => d._id === id || d.id === id)] }; },
    async update(patch) {
      const d = coll(name).find((x) => x._id === id || x.id === id);
      if (d) Object.assign(d, patch);
      return { updated: d ? 1 : 0 };
    },
  });
  const collection = (name) => ({
    where: (w) => where(name, w),
    doc: (id) => doc(name, id),
    async add(item) {
      const _id = `auto-${name}-${coll(name).length + 1}`;
      const docItem = { _id, ...item };
      coll(name).push(docItem);
      return { id: _id };
    },
  });
  return { collection, runTransaction: async (fn) => fn({ collection }) };
}

function setPayClient(client) { globalThis.__PAY_CLIENT__ = client; }
function clearPayClient() { delete globalThis.__PAY_CLIENT__; }

async function setup() {
  const mockDb = createMockDb();
  globalThis.uniCloud = { database: () => mockDb };
  const repo = createUniCloudRepository(mockDb);
  const admin = await repo.insert('users', { _id: 'u-admin', role: 'ADMIN', phone: '13800000000', passwordHash: hashPassword('admin123'), nickname: '管理员', status: 'ACTIVE' });
  const worker = await repo.insert('users', { _id: 'u-worker', role: 'WORKER', phone: '13800000001', passwordHash: hashPassword('worker123'), nickname: '小王', status: 'ACTIVE', acceptEnabled: true });
  const cs = await repo.insert('users', { _id: 'u-cs', role: 'CS', phone: '13800000002', passwordHash: hashPassword('cs123'), nickname: '客服', status: 'ACTIVE' });
  await repo.insert('customers', { _id: 'c1', openid: 'openid-c1', isVip: false });
  const auth = createAuth({ env: process.env });
  const tokens = {
    admin: auth.issueSession(admin).token,
    worker: auth.issueSession(worker).token,
    cs: auth.issueSession(cs).token,
    customer: auth.issueSession({ _id: 'c1', role: 'CUSTOMER' }).token,
  };
  const call = (action, payload, token) => main({ action, payload, token });
  return { mockDb, repo, call, tokens };
}

// 走主链路建单(admin 建商品,customer 申 H5 token,公开 createOrderFromH5)。
async function seedOrder(call, tokens, { priceFen = 10000 } = {}) {
  const product = await call('saveProduct', { title: '陪玩一小时', priceFen, status: 'ON', commission: { type: 'percent', valuePercent: 20 } }, tokens.admin);
  const h5 = await call('h5Token', { productId: product._id }, tokens.customer);
  const order = await call('createOrderFromH5', { h5Token: h5.token, contactWechat: 'wx1', contactPhone: '13800000000' });
  return { product, h5, order };
}

test('getPaymentParams(JSAPI):返回微信规范 jsapi 参数并落库 prepayId', async () => {
  const { call, tokens } = await setup();
  const { h5, order } = await seedOrder(call, tokens);
  let prepayCall = null;
  setPayClient({
    isConfigured: () => true,
    jsapiPrepay: async (p) => { prepayCall = p; return 'prepay_x'; },
    jsapiPayParams: async ({ prepayId }) => ({ appId: 'wx', timeStamp: '1', nonceStr: 'n', package: `prepay_id=${prepayId}`, signType: 'RSA', paySign: 'sig' }),
  });
  try {
    const params = await call('getPaymentParams', { orderId: order.orderId, payType: 'JSAPI', openid: 'o1', token: h5.token });
    assert.equal(params.payType, 'JSAPI');
    assert.equal(params.jsapi.package, 'prepay_id=prepay_x');
    assert.equal(prepayCall.outTradeNo, order.orderNo);
    assert.equal(prepayCall.amountFen, 10000);
    assert.equal(prepayCall.openid, 'o1');
    const saved = await call('getOrder', { orderId: order.orderId }, tokens.admin);
    assert.equal(saved.order.prepayId, 'prepay_x');
    assert.equal(saved.order.payType, 'JSAPI');
  } finally {
    clearPayClient();
  }
});

test('getPaymentParams(MWEB):返回 mwebUrl 并兼容 h5Url 别名', async () => {
  const { call, tokens } = await setup();
  const { h5, order } = await seedOrder(call, tokens);
  setPayClient({
    isConfigured: () => true,
    h5Prepay: async (p) => {
      assert.equal(p.outTradeNo, order.orderNo);
      return 'https://wx.tenpay.com/checkmweb?x=1';
    },
  });
  try {
    const params = await call('getPaymentParams', { orderId: order.orderId, payType: 'MWEB', token: h5.token, clientIp: '1.2.3.4' });
    assert.equal(params.payType, 'MWEB');
    assert.equal(params.mwebUrl, 'https://wx.tenpay.com/checkmweb?x=1');
    assert.equal(params.h5Url, 'https://wx.tenpay.com/checkmweb?x=1');
    const saved = await call('getOrder', { orderId: order.orderId }, tokens.admin);
    assert.equal(saved.order.payType, 'MWEB');
  } finally {
    clearPayClient();
  }
});

test('getPaymentParams 继续支付校验:非待支付/坏 token 返回 ORDER_NOT_PAYABLE', async () => {
  const { call, tokens } = await setup();
  const { h5, order } = await seedOrder(call, tokens);
  // 先支付成功转待受理
  setPayClient({
    isConfigured: () => true,
    handleNotify: async () => ({
      eventType: 'TRANSACTION.SUCCESS', outTradeNo: order.orderNo, transactionId: '4200001',
      amount: { total: 10000 }, successTime: '2026-08-19T12:00:01+08:00', payerOpenid: 'openid-c1',
    }),
  });
  await call('payNotify', { headers: {}, body: '' });
  clearPayClient();

  const again = await call('getPaymentParams', { orderId: order.orderId, payType: 'JSAPI', openid: 'o1', token: h5.token });
  assert.equal(again.ok, false);
  assert.equal(again.code, 'ORDER_NOT_PAYABLE');

  const badToken = await call('getPaymentParams', { orderId: order.orderId, payType: 'JSAPI', token: 'bad.token' });
  assert.equal(badToken.code, 'ORDER_NOT_PAYABLE');
});

test('payNotify:支付成功转待受理,重复回调幂等', async () => {
  const { call, tokens } = await setup();
  const { order } = await seedOrder(call, tokens);
  setPayClient({
    isConfigured: () => true,
    handleNotify: async () => ({
      eventType: 'TRANSACTION.SUCCESS', outTradeNo: order.orderNo, transactionId: '4200001',
      amount: { total: 10000 }, successTime: '2026-08-19T12:00:01+08:00', payerOpenid: 'openid-c1',
    }),
  });
  try {
    const res = await call('payNotify', { headers: {}, body: '' });
    assert.deepEqual(res, { code: 'SUCCESS', message: '成功' });
    const saved = await call('getOrder', { orderId: order.orderId }, tokens.admin);
    assert.equal(saved.order.status, 'PENDING_ACCEPT');
    assert.equal(saved.order.transactionId, '4200001');
    const replay = await call('payNotify', { headers: {}, body: '' });
    assert.equal(replay.code, 'SUCCESS');
    const after = await call('getOrder', { orderId: order.orderId }, tokens.admin);
    assert.equal(after.order.status, 'PENDING_ACCEPT');
  } finally {
    clearPayClient();
  }
});

test('payNotify:金额不一致返回 DOMAIN_ERROR,订单保持待支付', async () => {
  const { call, tokens } = await setup();
  const { order } = await seedOrder(call, tokens);
  setPayClient({
    isConfigured: () => true,
    handleNotify: async () => ({
      eventType: 'TRANSACTION.SUCCESS', outTradeNo: order.orderNo, transactionId: '4200002',
      amount: { total: 9999 }, successTime: '2026-08-19T12:00:01+08:00',
    }),
  });
  try {
    const res = await call('payNotify', { headers: {}, body: '' });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'DOMAIN_ERROR');
    assert.match(res.message, /金额不一致/);
    const saved = await call('getOrder', { orderId: order.orderId }, tokens.admin);
    assert.equal(saved.order.status, 'PENDING_PAYMENT');
  } finally {
    clearPayClient();
  }
});

test('未开工取消审批:approveRefund 调微信退款,失败不落库可重试,成功后 CANCELLED', async () => {
  const { call, tokens } = await setup();
  const { order } = await seedOrder(call, tokens);
  setPayClient({
    isConfigured: () => true,
    handleNotify: async () => ({
      eventType: 'TRANSACTION.SUCCESS', outTradeNo: order.orderNo, transactionId: '4200003',
      amount: { total: 10000 }, successTime: '2026-08-19T12:00:01+08:00', payerOpenid: 'openid-c1',
    }),
  });
  await call('payNotify', { headers: {}, body: '' });
  clearPayClient();

  const req = await call('requestCancellation', { orderId: order.orderId, reason: '不想要了' }, tokens.cs);
  assert.ok(req.refundId);

  // 第一次:微信退款接口失败 → 整体不落库,可重试
  setPayClient({ isConfigured: () => true, refund: async () => { throw new Error('REFUND_FAIL'); } });
  try {
    const failRes = await call('approveRefund', { refundId: req.refundId }, tokens.admin);
    assert.equal(failRes.ok, false);
    assert.equal(failRes.code, 'DOMAIN_ERROR');
    assert.match(failRes.message, /REFUND_FAIL/);
    const after = await call('getOrder', { orderId: order.orderId }, tokens.admin);
    assert.equal(after.order.status, 'PENDING_ACCEPT');
    assert.equal(after.refund.status, 'PENDING_APPROVAL');
  } finally {
    clearPayClient();
  }

  // 第二次:退款成功 → 订单已取消
  setPayClient({ isConfigured: () => true, refund: async () => ({ status: 'SUCCESS', refundId: 'refund-10' }) });
  try {
    const ok = await call('approveRefund', { refundId: req.refundId }, tokens.admin);
    assert.equal(ok.status, 'SUCCESS');
    const after = await call('getOrder', { orderId: order.orderId }, tokens.admin);
    assert.equal(after.order.status, 'CANCELLED');
  } finally {
    clearPayClient();
  }
});

test('服务中退款全链路:requestRefund→approveRefund PROCESSING→REFUND.SUCCESS 回调转 REFUNDED', async () => {
  const { call, tokens } = await setup();
  const { order } = await seedOrder(call, tokens);
  setPayClient({
    isConfigured: () => true,
    handleNotify: async () => ({
      eventType: 'TRANSACTION.SUCCESS', outTradeNo: order.orderNo, transactionId: '4200004',
      amount: { total: 10000 }, successTime: '2026-08-19T12:00:01+08:00', payerOpenid: 'openid-c1',
    }),
  });
  await call('payNotify', { headers: {}, body: '' });
  clearPayClient();

  await call('enterOrder', { orderId: order.orderId, game: '王者', region: '微信区', serviceType: '陪玩', customerUid: 'uid1', customerNickname: '客', expectStartAt: Date.now() }, tokens.cs);
  await call('grabOrder', { orderId: order.orderId }, tokens.worker);
  const req = await call('requestRefund', { orderId: order.orderId, ratio: 0.5, reason: '服务不满意' }, tokens.cs);
  assert.ok(req.refundId);

  setPayClient({
    isConfigured: () => true,
    refund: async () => ({ status: 'PROCESSING', refundId: 'refund-9' }),
    handleNotify: async () => ({
      eventType: 'REFUND.SUCCESS', outTradeNo: order.orderNo, outRefundNo: 'R-refund-9', refundId: 'refund-9', refundStatus: 'SUCCESS',
    }),
  });
  try {
    const approved = await call('approveRefund', { refundId: req.refundId }, tokens.admin);
    assert.equal(approved.status, 'PROCESSING');
    const mid = await call('getOrder', { orderId: order.orderId }, tokens.admin);
    assert.equal(mid.order.status, 'REFUNDING'); // 退款回调前保持退款中

    const notifyRes = await call('payNotify', { headers: {}, body: '' });
    assert.equal(notifyRes.code, 'SUCCESS');
    const after = await call('getOrder', { orderId: order.orderId }, tokens.admin);
    assert.equal(after.order.status, 'REFUNDED');
    assert.equal(after.order.refundStatus, 'SUCCESS');
  } finally {
    clearPayClient();
  }
});

test('URL 化路由:/pay-notify 返回成功报文,未知路径 404 封套', async () => {
  const mockDb = createMockDb();
  globalThis.uniCloud = { database: () => mockDb };
  setPayClient({
    isConfigured: () => true,
    handleNotify: async ({ headers }) => {
      assert.equal(headers['x-test'], '1');
      return { eventType: 'IGNORED' };
    },
  });
  try {
    const res = await main({ httpMethod: 'POST', path: '/pay-notify', headers: { 'x-test': '1' }, body: '{}' });
    assert.equal(res.mpserverlessComposedResponse, true);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, '{"code":"SUCCESS","message":"已忽略"}');
    const notFound = await main({ httpMethod: 'POST', path: '/other', headers: {}, body: '' });
    assert.equal(notFound.statusCode, 404);
    assert.equal(JSON.parse(notFound.body).code, 'UNKNOWN_PATH');
  } finally {
    clearPayClient();
  }
});

test('payNotify:微信支付未配置返回 DOMAIN_ERROR', async () => {
  const mockDb = createMockDb();
  globalThis.uniCloud = { database: () => mockDb };
  const res = await main({ action: 'payNotify', payload: { headers: {}, body: '' } });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'DOMAIN_ERROR');
  assert.match(res.message, /未配置/);
});
