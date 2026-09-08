import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';
import {
  createMemoryDb,
  seedAdmin,
  seedWorker,
  seedCs,
  seedProduct,
  issueOrderToken,
  createPaidOrder,
  enterPool,
  grabToService,
  customerSession,
} from './helpers.js';
import { issueH5Token } from '../src/token.js';
import {
  createOrderFromH5,
  getPaymentParams,
  payNotify,
  submitCompletion,
  verifyCompletion,
  confirmSettlement,
  submitDispute,
  startDisputeReview,
  resolveDispute,
  approveRefund,
  getWallet,
  notify,
  listNotifications,
  markRead,
  sendCustomerServiceLink,
} from '../src/services.js';

test('支付：payNotify 同流水号幂等，只落账一次', () => {
  const db = createMemoryDb();
  seedAdmin(db); seedCs(db); seedWorker(db);
  const p = seedProduct(db);
  const token = issueOrderToken(db, p._id);
  const created = createOrderFromH5(db, { h5Token: token, contactWechat: 'wx' });
  payNotify(db, { orderId: created.orderId, transactionId: 'txn-dup' });
  const again = payNotify(db, { orderId: created.orderId, transactionId: 'txn-dup' });
  assert.equal(again.code, 'SUCCESS');
  assert.equal(db.orders[0].status, 'PENDING_ACCEPT');
  assert.equal(db.orders[0].transactionId, 'txn-dup');
});

test('支付：getPaymentParams 双通道（JSAPI 微信规范/MWEB）+ 待支付门槛', () => {
  const previousMode = process.env.PAYMENT_MODE;
  process.env.PAYMENT_MODE = 'wechat';
  const db = createMemoryDb();
  seedAdmin(db); seedCs(db); seedWorker(db);
  const p = seedProduct(db);
  db.brands.push({ _id: 'brand-default', brandId: 'default', channelRefs: { paymentSecretRef: 'test-secret-ref' } });
  const token = issueOrderToken(db, p._id, 'mp-c1');
  const created = createOrderFromH5(db, { h5Token: token, contactWechat: 'wx' });
  const session = customerSession('mp-c1');
  // MWEB 响应含 mwebUrl + 兼容 h5Url
  const mweb = getPaymentParams(db, { orderId: created.orderId, payType: 'MWEB' }, session);
  assert.equal(mweb.payType, 'MWEB');
  assert.ok(mweb.mwebUrl);
  assert.equal(mweb.h5Url, mweb.mwebUrl);
  // JSAPI 响应为微信规范 jsapi 对象
  const jsapi = getPaymentParams(db, { orderId: created.orderId, payType: 'JSAPI' }, session);
  assert.equal(jsapi.payType, 'JSAPI');
  for (const k of ['appId', 'timeStamp', 'nonceStr', 'package', 'signType', 'paySign']) assert.ok(jsapi.jsapi[k]);
  // 继续支付：H5 token 的 productId 与订单一致才放行
  assert.doesNotThrow(() => getPaymentParams(db, { orderId: created.orderId, payType: 'MWEB', h5Token: token }, session));
  const badToken = issueH5Token({ openid: 'mp-c1', productId: 'other-product' }, process.env.H5_TOKEN_SECRET);
  assert.throws(() => getPaymentParams(db, { orderId: created.orderId, payType: 'MWEB', h5Token: badToken }, session), /商品不一致/);
  // 非法 payType
  assert.throws(() => getPaymentParams(db, { orderId: created.orderId, payType: 'X' }, session), /payType/);
  // 已支付后不放行
  payNotify(db, { orderId: created.orderId, transactionId: 'txn-p' });
  assert.throws(() => getPaymentParams(db, { orderId: created.orderId, payType: 'MWEB' }, session), /不可支付/);
  if (previousMode === undefined) delete process.env.PAYMENT_MODE;
  else process.env.PAYMENT_MODE = previousMode;
});

test('退款：异议部分退款走 refunds 表并全额追回佣金', () => {
  const db = createMemoryDb();
  const admin = seedAdmin(db); const cs = seedCs(db); const w = seedWorker(db);
  const p = seedProduct(db);
  const order = grabToService(db, enterPool(db, createPaidOrder(db, p), cs.session), w.session);
  submitCompletion(db, { orderId: order._id, actualOutput: 10, attachmentIds: ['att'] }, w.session);
  verifyCompletion(db, { orderId: order._id }, cs.session);
  confirmSettlement(db, { orderId: order._id, customerConfirmed: true }, cs.session);
  const before = getWallet(db, {}, w.session).availableFen;
  assert.equal(before, 2000);
  const { disputeId } = submitDispute(db, { orderId: order._id, content: '不满意' }, customerSession('mp-c1'));
  startDisputeReview(db, { disputeId }, cs.session);
  resolveDispute(db, { disputeId, result: 'partial', note: '部分退款' }, cs.session);
  assert.equal(db.orders[0].status, 'REFUNDING');
  const refund = db.refunds.find((r) => r.type === 'dispute');
  approveRefund(db, { refundId: refund._id }, admin.session);
  assert.equal(db.orders[0].status, 'REFUNDED');
  assert.equal(refund.commissionRecoveredFen, 2000);
  assert.equal(getWallet(db, {}, w.session).availableFen, before - 2000);
});

test('通知：notify 后可按接收人查询并标记已读', () => {
  const db = createMemoryDb();
  notify(db, { receiverId: 'mp-c1', channel: 'INBOX', template: 'ORDER_PAID', payload: {} });
  const list = listNotifications(db, {}, customerSession('mp-c1'));
  assert.equal(list.length, 1);
  assert.equal(list[0].status, 'SENT');
  markRead(db, { notificationId: list[0]._id }, customerSession('mp-c1'));
  assert.equal(db.notifications[0].status, 'READ');
});

test('微信客服：sendCustomerServiceLink 生成 H5 下单链接', () => {
  const db = createMemoryDb();
  const cs = seedCs(db);
  const product = seedProduct(db);
  const { link } = sendCustomerServiceLink(db, { openid: 'mp-c1', productId: product._id }, cs.session);
  assert.ok(link.includes('/#/pages/h5-order/index?token='));
});
