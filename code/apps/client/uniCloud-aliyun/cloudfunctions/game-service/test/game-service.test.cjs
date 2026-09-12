'use strict';
// 云函数契约测试(Phase 3 波次 5a):适配 72+3 action 新契约,覆盖公开查单/冻结钱包/本人资料/ADMIN 变体/错误封套/dashboard/配置/报表。
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

process.env.SESSION_SECRET = 'test-secret';
process.env.H5_TOKEN_SECRET = 'test-h5-secret';

const { createAuth, hashPassword } = require('../lib/auth.cjs');
const { createMemoryRepository, createUniCloudRepository } = require('../lib/repository.cjs');
const services = require('../lib/services.cjs');
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

// 建 mock 环境 + 种子用户/客户,返回 { mockDb, call, tokens }。
async function setup({ withCustomer = true } = {}) {
  const mockDb = createMockDb();
  globalThis.uniCloud = { database: () => mockDb };
  const repo = createUniCloudRepository(mockDb);
  const admin = await repo.insert('users', { _id: 'u-admin', role: 'ADMIN', phone: '13800000000', passwordHash: hashPassword('admin123'), nickname: '管理员', status: 'ACTIVE' });
  const worker = await repo.insert('users', { _id: 'u-worker', role: 'WORKER', phone: '13800000001', passwordHash: hashPassword('worker123'), nickname: '小王', status: 'ACTIVE', acceptEnabled: true });
  const cs = await repo.insert('users', { _id: 'u-cs', role: 'CS', phone: '13800000002', passwordHash: hashPassword('cs123'), nickname: '客服', status: 'ACTIVE' });
  if (withCustomer) await repo.insert('customers', { _id: 'c1', openid: 'openid-c1', isVip: false });
  const auth = createAuth({ env: process.env });
  const tokens = {
    admin: auth.issueSession(admin).token,
    worker: auth.issueSession(worker).token,
    cs: auth.issueSession(cs).token,
    customer: withCustomer ? auth.issueSession({ _id: 'c1', role: 'CUSTOMER' }).token : null,
  };
  const call = (action, payload, token) => main({ action, payload, token });
  return { mockDb, repo, call, tokens, users: { admin, worker, cs } };
}

// 走主链路建单:saveProduct + h5Token + createOrderFromH5。
async function seedProductOrder(call, tokens) {
  const product = await call('saveProduct', { title: '陪玩一小时', priceFen: 10000, status: 'ON', commission: { type: 'percent', valuePercent: 20 } }, tokens.admin);
  const h5 = await call('h5Token', { productId: product._id }, tokens.customer);
  const order = await call('createOrderFromH5', { h5Token: h5.token, contactWechat: 'wx1', contactPhone: '13800000000' });
  return { product, h5, order };
}

test('新增商用 action 后，云函数与本地镜像 action 清单一致', () => {
  assert.ok(Object.keys(services).length >= 105);
  const apiServerSource = readFileSync(resolve(__dirname, '../../../../../../scripts/api-server.mjs'), 'utf8');
  const actionBlock = apiServerSource.match(/const ACTIONS = \[([\s\S]*?)\];/);
  assert.ok(actionBlock, '本地 API action 清单不存在');
  const localActions = [...actionBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
  assert.deepEqual(localActions, Object.keys(services).sort());
  for (const name of ['queryOrderByNo', 'freezeWallet', 'getProfile', 'getAccessProfile', 'listUserBrandRoles', 'saveUserBrandRoles', 'listAuditLogs', 'updateProfile', 'listUsers', 'createStaff', 'updateStaff', 'markRead']) assert.ok(services[name], `${name} 缺失`);
});

test('生产环境拒绝模拟支付确认', async () => {
  const previousMode = process.env.PAYMENT_MODE;
  const previousEnv = process.env.APP_ENV;
  try {
    process.env.PAYMENT_MODE = 'mock';
    process.env.APP_ENV = 'production';
    await assert.rejects(() => services.confirmMockPayment(null, { paymentId: 'test' }, {}), { code: 'PAYMENT_MOCK_NOT_ALLOWED' });
  } finally {
    if (previousMode === undefined) delete process.env.PAYMENT_MODE; else process.env.PAYMENT_MODE = previousMode;
    if (previousEnv === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = previousEnv;
  }
});

test('H5 token 撤销：管理员撤销后公开 H5 查询立即失效', async () => {
  const { call, tokens } = await setup();
  const product = await call('saveProduct', { title: '测试服务', priceFen: 100, status: 'ON', commission: { type: 'percent', valuePercent: 20 } }, tokens.admin);
  const h5 = await call('h5Token', { productId: product._id }, tokens.customer);
  assert.equal((await call('getH5Product', { token: h5.token })).product._id, product._id);
  const revoked = await call('revokeH5Token', { token: h5.token, reason: '误发' }, tokens.admin);
  assert.equal(revoked.revoked, true);
  const denied = await call('getH5Product', { token: h5.token });
  assert.equal(denied.ok, false);
  assert.match(denied.message, /已失效/);
});

test('第二阶段云函数：Mock 支付、验收结单、七态提现与五态异议闭环', async () => {
  const previousMode = process.env.PAYMENT_MODE;
  process.env.PAYMENT_MODE = 'mock';
  try {
    const { call, repo, tokens } = await setup();
    await repo.insert('worker_profiles', { _id: 'profile-worker', workerId: 'u-worker', realnameStatus: 'APPROVED' });
    const { h5, order } = await seedProductOrder(call, tokens);
    const params = await call('getPaymentParams', { orderId: order.orderId, h5Token: h5.token, payType: 'MWEB' });
    assert.equal(params.paymentMode, 'mock');
    const paid = await call('confirmMockPayment', { paymentId: params.paymentId }, tokens.customer);
    assert.equal(paid.code, 'SUCCESS');
    const payStatus = await call('getPaymentStatus', { paymentId: params.paymentId, h5Token: h5.token });
    assert.equal(payStatus.status, 'SUCCESS');

    await call('enterOrder', { orderId: order.orderId, game: 'lol', region: '一区', serviceType: 'companion', customerUid: 'u1', customerNickname: '客户', expectStartAt: Date.now() }, tokens.cs);
    const grabbed = await call('grabOrder', { orderId: order.orderId, expectedVersion: 0 }, tokens.worker);
    assert.equal(grabbed.status, 'IN_SERVICE');
    await call('submitCompletion', { orderId: order.orderId, actualOutput: 10, attachmentIds: ['proof'] }, tokens.worker);
    const rejectedClose = await call('closeOrder', { orderId: order.orderId, customerConfirmed: true }, tokens.cs);
    assert.equal(rejectedClose.code, 'DOMAIN_ERROR');
    await call('verifyCompletion', { orderId: order.orderId, note: '通过' }, tokens.cs);
    const settled = await call('closeOrder', { orderId: order.orderId, customerConfirmed: true }, tokens.cs);
    assert.equal(settled.status, 'SETTLED');

    const wd = await call('applyWithdrawal', { amountFen: 1000 }, tokens.worker);
    assert.equal(wd.status, 'SUBMITTED');
    assert.equal((await call('startWithdrawalReview', { withdrawalId: wd._id }, tokens.admin)).status, 'REVIEWING');
    assert.equal((await call('approveWithdrawal', { withdrawalId: wd._id }, tokens.admin)).status, 'APPROVED');
    assert.equal((await call('startWithdrawalPayment', { withdrawalId: wd._id, batchNo: 'B-CLOUD' }, tokens.admin)).status, 'PAYING');
    assert.equal((await call('markWithdrawalPaid', { withdrawalId: wd._id, batchNo: 'B-CLOUD' }, tokens.admin)).status, 'PAID');

    const opened = await call('submitDispute', { orderId: order.orderId, content: '有争议' }, tokens.customer);
    const evidence = await call('addDisputeEvidence', { disputeId: opened.disputeId, content: '补充证据', attachmentIds: ['e1'] }, tokens.customer);
    assert.equal(evidence.status, 'EVIDENCE_COLLECTION');
    assert.equal((await call('startDisputeReview', { disputeId: opened.disputeId }, tokens.cs)).status, 'UNDER_REVIEW');
    assert.equal((await call('resolveDispute', { disputeId: opened.disputeId, result: 'MAINTAIN', note: '维持' }, tokens.cs)).status, 'DECIDED');
    assert.equal((await call('closeDispute', { disputeId: opened.disputeId }, tokens.admin)).status, 'CLOSED');
  } finally {
    if (previousMode === undefined) delete process.env.PAYMENT_MODE;
    else process.env.PAYMENT_MODE = previousMode;
  }
});

test('多品牌权限矩阵：品牌管理员只能访问授权品牌，停用账号失效，SUPER_ADMIN 可显式跨品牌', async () => {
  const { call, repo } = await setup();
  await repo.insert('brands', { _id: 'brand-a', brandId: 'demo-a', code: 'demo-a', appId: 'wx-a', name: 'A', status: 'ON' });
  await repo.insert('brands', { _id: 'brand-b', brandId: 'demo-b', code: 'demo-b', appId: 'wx-b', name: 'B', status: 'ON' });
  const manager = await repo.insert('users', { _id: 'u-brand-a', role: 'BRAND_ADMIN', phone: '13800000011', passwordHash: hashPassword('brand123'), status: 'ACTIVE' });
  const auth = createAuth({ env: process.env });
  const brandToken = auth.issueSession(manager, { roles: ['BRAND_ADMIN'], brandScopes: ['demo-a'] }).token;
  await repo.insert('orders', { _id: 'order-a', orderNo: 'A001', brandId: 'demo-a', status: 'PENDING_ACCEPT', createdAt: Date.now() });
  await repo.insert('orders', { _id: 'order-b', orderNo: 'B001', brandId: 'demo-b', status: 'PENDING_ACCEPT', createdAt: Date.now() });

  const visible = await call('listOrders', {}, brandToken);
  assert.deepEqual(visible.map((item) => item._id), ['order-a']);
  const denied = await call('getOrder', { orderId: 'order-b' }, brandToken);
  assert.equal(denied.code, 'FORBIDDEN');
  const profile = await call('getAccessProfile', {}, brandToken);
  assert.deepEqual(profile.brandScopes, ['demo-a']);

  await repo.updateById('users', manager._id, { status: 'DISABLED' });
  const disabled = await call('listOrders', {}, brandToken);
  assert.equal(disabled.code, 'UNAUTHORIZED');

  const superUser = await repo.insert('users', { _id: 'u-super', role: 'SUPER_ADMIN', phone: '13800000012', passwordHash: hashPassword('super123'), status: 'ACTIVE' });
  const superToken = auth.issueSession(superUser, { roles: ['SUPER_ADMIN'], brandScopes: ['*'] }).token;
  const all = await call('listOrders', {}, superToken);
  assert.deepEqual(new Set(all.map((item) => item.brandId)), new Set(['demo-a', 'demo-b']));
});

test('登录与角色矩阵:worker/admin 登录,CS 可 listWorkers', async () => {
  const { call, tokens, users } = await setup();
  const wl = await call('workerLogin', { phone: '13800000001', password: 'worker123' });
  assert.equal(wl.user.role, 'WORKER');
  assert.ok(wl.token);
  const al = await call('authLogin', { phone: '13800000000', password: 'admin123' });
  assert.equal(al.role, 'ADMIN');
  const workers = await call('listWorkers', {}, tokens.cs);
  assert.equal(workers.length, 1);
  assert.equal(workers[0]._id, users.worker._id);
});

test('queryOrderByNo:orderNo+联系方式匹配返回脱敏 DTO,不匹配 ORDER_NOT_FOUND', async () => {
  const { call, tokens } = await setup();
  const { order } = await seedProductOrder(call, tokens);
  const hit = await call('queryOrderByNo', { orderNo: order.orderNo, contactPhone: '13800000000' });
  assert.equal(hit.ok, true);
  assert.equal(hit.order.orderId, order.orderId);
  assert.equal(hit.order.contactPhone, '****0000'); // 仅尾号
  assert.equal(hit.order.contactWechat, '****'); // 短号整体打码
  assert.equal(hit.order.openid, undefined); // 不泄漏敏感字段
  const miss = await call('queryOrderByNo', { orderNo: order.orderNo, contactPhone: '13999999999' });
  assert.deepEqual(miss, { ok: false, code: 'ORDER_NOT_FOUND', message: '订单不存在' });
  const noContact = await call('queryOrderByNo', { orderNo: order.orderNo });
  assert.equal(noContact.code, 'ORDER_NOT_FOUND');
});

test('freezeWallet(ADMIN):WITHDRAW/BOTH/NONE 冻结与留痕', async () => {
  const { call, tokens, repo } = await setup();
  const frozen = await call('freezeWallet', { workerId: 'u-worker', scope: 'BOTH' }, tokens.admin);
  assert.equal(frozen.freezeWithdrawal, true);
  assert.equal(frozen.freezeAccept, true);
  const txs = await repo.find('wallet_transactions', { walletId: frozen._id });
  assert.equal(txs.length, 1);
  assert.equal(txs[0].type, 'WALLET_FREEZE');
  assert.equal(txs[0].operatorId, 'u-admin');
  const audits = await repo.find('audit_logs', { action: 'freezeWallet' });
  assert.equal(audits.length, 1);
  assert.equal(audits[0].operatorId, 'u-admin');
  assert.equal(audits[0].resourceType, 'worker');
  assert.ok('before' in audits[0] && 'after' in audits[0]);
  const cleared = await call('freezeWallet', { workerId: 'u-worker', scope: 'NONE' }, tokens.admin);
  assert.equal(cleared.freezeWithdrawal, false);
  assert.equal(cleared.freezeAccept, false);
  const bad = await call('freezeWallet', { workerId: 'u-worker', scope: 'X' }, tokens.admin);
  assert.equal(bad.ok, false);
  assert.equal(bad.code, 'DOMAIN_ERROR');
});

test('getProfile(WORKER):本人资料脱敏,无资料返回空对象', async () => {
  const { call, tokens } = await setup();
  const empty = await call('getProfile', {}, tokens.worker);
  assert.deepEqual(empty, {});
  await call('updateProfile', { withdrawWechat: 'wx_withdraw_123456', realName: '张三' }, tokens.worker);
  const profile = await call('getProfile', {}, tokens.worker);
  assert.equal(profile.realName, '张***');
  assert.equal(profile.withdrawWechat, '****3456'); // 仅尾号
  assert.equal(profile.idCardAttachmentId, undefined); // 不泄漏附件引用
});

test('ADMIN 变体:getWallet/walletTransactions 必传 workerId,listWithdrawals 可过滤', async () => {
  const { call, tokens, repo } = await setup();
  await repo.insert('withdrawals', { _id: 'wd1', workerId: 'u-worker', amountFen: 1000, status: 'PENDING_REVIEW', createdAt: Date.now() });
  await repo.insert('withdrawals', { _id: 'wd2', workerId: 'other', amountFen: 2000, status: 'PENDING_REVIEW', createdAt: Date.now() });
  const wWallet = await call('getWallet', {}, tokens.worker);
  assert.equal(wWallet.ownerId, 'u-worker');
  const aWallet = await call('getWallet', { workerId: 'u-worker' }, tokens.admin);
  assert.equal(aWallet.ownerId, 'u-worker');
  const missing = await call('getWallet', {}, tokens.admin);
  assert.equal(missing.ok, false);
  assert.equal(missing.code, 'DOMAIN_ERROR');
  assert.match(missing.message, /workerId/);
  // listWithdrawals:admin 全部,admin 过滤,worker 仅本人
  assert.equal((await call('listWithdrawals', {}, tokens.admin)).length, 2);
  assert.equal((await call('listWithdrawals', { workerId: 'u-worker' }, tokens.admin)).length, 1);
  assert.equal((await call('listWithdrawals', {}, tokens.worker)).length, 1);
});

test('getOrder 出参嵌套 {order, logs, attachments, refund, dispute}', async () => {
  const { call, tokens } = await setup();
  const { order } = await seedProductOrder(call, tokens);
  const g = await call('getOrder', { orderId: order.orderId }, tokens.admin);
  assert.ok(g.order);
  assert.equal(g.order._id, order.orderId);
  assert.ok(Array.isArray(g.logs));
  assert.ok(Array.isArray(g.attachments));
  assert.ok('refund' in g);
  assert.ok('dispute' in g);
});

test('enterOrder:可选联系方式修正写 order_logs 留痕', async () => {
  const { call, tokens, repo } = await setup();
  const order = await repo.insert('orders', {
    _id: 'o-1', orderNo: 'GS-enter', amountFen: 10000, status: 'PENDING_ACCEPT', productId: 'p-1',
    customerId: 'openid-c1', contactWechat: 'wx1', contactPhone: '13800000000',
    productSnapshot: { title: '陪玩一小时' }, createdAt: Date.now(), updatedAt: Date.now(),
  });
  await call('enterOrder', {
    orderId: order._id, game: '王者', region: '微信区', serviceType: '陪玩', customerUid: 'uid1', customerNickname: '客', expectStartAt: Date.now(),
    contactWechat: 'wx-new', contactPhone: '13900001111',
  }, tokens.cs);
  const g = await call('getOrder', { orderId: order._id }, tokens.admin);
  assert.equal(g.order.status, 'PENDING_GRAB');
  assert.equal(g.order.contactWechat, 'w***');
  assert.ok(g.logs.some((l) => /联系方式/.test(l.remark)), '应写联系方式修正日志');
});

test('错误封套:未知/缺 action、鉴权失败、domain 抛错统一 {ok:false, code, message}', async () => {
  const { call, tokens } = await setup();
  const unknown = await call('nope', {});
  assert.deepEqual(unknown, { ok: false, code: 'UNKNOWN_ACTION', message: '未知 action: nope' });
  const noAction = await main({ payload: {} });
  assert.deepEqual(noAction, { ok: false, code: 'MISSING_ACTION', message: '缺少 action' });
  const noauth = await call('listOrders', {});
  assert.equal(noauth.ok, false);
  assert.equal(noauth.code, 'UNAUTHORIZED');
  const err = await call('getOrder', { orderId: 'no-such' }, tokens.admin);
  assert.equal(err.ok, false);
  assert.equal(err.code, 'DOMAIN_ERROR');
  assert.equal(err.message, '订单不存在');
  // HTTP Authorization: Bearer 读 token
  const viaBearer = await main({ action: 'listOrders', payload: {}, headers: { Authorization: `Bearer ${tokens.admin}` } });
  assert.ok(Array.isArray(viaBearer));
});

test('dashboard:8 个定案键存在', async () => {
  const { call, tokens } = await setup();
  const d = await call('dashboard', {}, tokens.admin);
  for (const k of ['totalOrders', 'pendingAcceptOrders', 'inServiceOrders', 'workers', 'pendingConfirmOrders', 'pendingRefunds', 'pendingWithdrawals', 'pendingDisputes']) {
    assert.ok(k in d, `${k} 应在 dashboard 出参`);
  }
  assert.equal(d.workers, 1);
  assert.equal(d.totalOrders, 0);
});

test('getConfigs/updateConfigs:camelCase 键与默认值', async () => {
  const { call, tokens } = await setup();
  const defs = await call('getConfigs', {}, tokens.admin);
  assert.equal(defs.payTimeoutMinutes, 30);
  assert.equal(defs.maxActiveOrders, 3);
  assert.equal(defs.minWithdrawFen, 1000);
  assert.equal(defs.disputeWindowHours, 72);
  await call('updateConfigs', { configs: { maxActiveOrders: 5, poolTimeoutMinutes: 45, notAKey: 999 } }, tokens.admin);
  const after = await call('getConfigs', {}, tokens.admin);
  assert.equal(after.maxActiveOrders, 5);
  assert.equal(after.poolTimeoutMinutes, 45);
  assert.equal(after.payTimeoutMinutes, 30); // 未改仍默认
});

test('报表四 action 出参含对账项 reconciliationFen/totalWalletBalanceFen/walletBalanceSumFen', async () => {
  const { call, tokens } = await setup();
  const ro = await call('reportOrders', {}, tokens.admin);
  const rw = await call('reportWorkers', {}, tokens.admin);
  const rwd = await call('reportWithdrawals', {}, tokens.admin);
  const rp = await call('reportProfit', {}, tokens.admin);
  for (const r of [ro, rw, rwd, rp]) {
    assert.ok(typeof r.reconciliationFen === 'number');
    assert.ok(typeof r.totalWalletBalanceFen === 'number');
    assert.ok(typeof r.walletBalanceSumFen === 'number');
  }
});

test('memory 仓储事务:回调抛错时回滚', async () => {
  const repo = createMemoryRepository();
  await repo.insert('orders', { _id: 'o-before', status: 'PENDING_PAYMENT' });
  await assert.rejects(() => repo.transaction(async (tr) => {
    await tr.insert('orders', { _id: 'o-in-tx', status: 'PENDING_PAYMENT' });
    throw new Error('boom');
  }), /boom/);
  const list = await repo.find('orders', {});
  assert.equal(list.length, 1);
  assert.equal(list[0]._id, 'o-before');
});
