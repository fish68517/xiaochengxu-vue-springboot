import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OrderStatus,
  createOrder,
  payOrder,
  enterOrder,
  grabOrder,
  submitCompletion,
  verifyCompletion,
  confirmSettlement,
  timeoutClose,
  requestUnstartedCancel,
  approveUnstartedCancel,
  rejectCancellation,
  isPaymentExpired,
} from '../src/order-machine.js';

const PAYMENT_TIMEOUT_MS = 30 * 60 * 1000;

test('创建订单后状态为待支付，含联系方式校验', () => {
  const order = createOrder({
    id: 'o-1',
    amountFen: 10000,
    contactWechat: 'wx-1',
    createdAt: 0,
  });
  assert.equal(order.status, OrderStatus.PENDING_PAYMENT);
  assert.equal(order.amountFen, 10000);
  assert.equal(order.payDeadline, PAYMENT_TIMEOUT_MS);
});

test('联系方式至少填一项，否则抛错', () => {
  assert.throws(() => createOrder({ id: 'o-1', amountFen: 10000, createdAt: 0 }), /至少/);
});

test('支付成功：待支付 -> 待受理', () => {
  const order = createOrder({ id: 'o-1', amountFen: 10000, contactPhone: '138', createdAt: 0 });
  payOrder(order, { paidAt: 1000, transactionId: 'tx-1', payerOpenid: 'openid-1' });
  assert.equal(order.status, OrderStatus.PENDING_ACCEPT);
  assert.equal(order.paidAt, 1000);
  assert.equal(order.transactionId, 'tx-1');
});

test('录入完成：待受理 -> 待抢单', () => {
  const order = createOrder({ id: 'o-1', amountFen: 10000, contactWechat: 'wx', createdAt: 0 });
  payOrder(order, { paidAt: 1000 });
  enterOrder(order, {
    game: 'g',
    region: 'r',
    serviceType: 's',
    customerUid: 'u',
    customerNickname: 'n',
    expectStartAt: 2000,
  });
  assert.equal(order.status, OrderStatus.PENDING_GRAB);
});

test('抢单：待抢单 -> 服务中', () => {
  const order = createOrder({ id: 'o-1', amountFen: 10000, contactWechat: 'wx', createdAt: 0 });
  payOrder(order, { paidAt: 1000 });
  enterOrder(order, {
    game: 'g', region: 'r', serviceType: 's', customerUid: 'u', customerNickname: 'n', expectStartAt: 2000,
  });
  grabOrder(order, 'worker-1');
  assert.equal(order.status, OrderStatus.IN_SERVICE);
  assert.equal(order.workerId, 'worker-1');
});

test('完成申请 + 结单：服务中 -> 待确认 -> 已结算', () => {
  const order = createOrder({ id: 'o-1', amountFen: 10000, contactWechat: 'wx', createdAt: 0 });
  payOrder(order, { paidAt: 1000 });
  enterOrder(order, {
    game: 'g', region: 'r', serviceType: 's', customerUid: 'u', customerNickname: 'n', expectStartAt: 2000,
  });
  grabOrder(order, 'worker-1');
  submitCompletion(order, { actualOutput: 100, attachmentIds: ['a1'] });
  assert.equal(order.status, OrderStatus.PENDING_CONFIRM);
  verifyCompletion(order, { verifiedBy: 'cs-1' });
  confirmSettlement(order, { confirmedBy: 'cs-1', customerConfirmed: true });
  assert.equal(order.status, OrderStatus.SETTLED);
  assert.ok(order.completedAt);
});

test('待支付 30 分钟未支付自动关闭为已关闭', () => {
  const order = createOrder({ id: 'o-1', amountFen: 10000, contactWechat: 'wx', createdAt: 0 });
  assert.equal(isPaymentExpired(order, PAYMENT_TIMEOUT_MS), true);
  timeoutClose(order, { closedAt: PAYMENT_TIMEOUT_MS });
  assert.equal(order.status, OrderStatus.CLOSED);
  assert.equal(order.cancelReason, 'TIMEOUT');
});

test('未到 30 分钟不能超时关闭', () => {
  const order = createOrder({ id: 'o-1', amountFen: 10000, contactWechat: 'wx', createdAt: 0 });
  assert.equal(isPaymentExpired(order, PAYMENT_TIMEOUT_MS - 1), false);
  assert.throws(() => timeoutClose(order, { closedAt: PAYMENT_TIMEOUT_MS - 1 }), /未超时/);
});

test('已支付订单不能超时关闭', () => {
  const order = createOrder({ id: 'o-1', amountFen: 10000, contactWechat: 'wx', createdAt: 0 });
  payOrder(order, { paidAt: 1000 });
  assert.throws(() => timeoutClose(order, { closedAt: PAYMENT_TIMEOUT_MS }), /状态/);
});

test('客服可对待受理订单发起未开工取消申请', () => {
  const order = createOrder({ id: 'o-1', amountFen: 10000, contactWechat: 'wx', createdAt: 0 });
  payOrder(order, { paidAt: 1000 });
  requestUnstartedCancel(order, { requestedBy: 'cs-1', reason: '客户要求取消' });
  assert.equal(order.cancellation.status, 'PENDING_REVIEW');
});

test('待支付订单不能发起取消申请', () => {
  const order = createOrder({ id: 'o-1', amountFen: 10000, contactWechat: 'wx', createdAt: 0 });
  assert.throws(() => requestUnstartedCancel(order, { requestedBy: 'cs-1' }), /状态/);
});

test('管理员审批通过未开工取消：已支付订单 -> 已取消', () => {
  const order = createOrder({ id: 'o-1', amountFen: 10000, contactWechat: 'wx', createdAt: 0 });
  payOrder(order, { paidAt: 1000 });
  requestUnstartedCancel(order, { requestedBy: 'cs-1', reason: '客户要求取消' });
  approveUnstartedCancel(order, { approvedBy: 'admin-1', refundedAt: 2000 });
  assert.equal(order.status, OrderStatus.CANCELLED);
  assert.equal(order.refundedAt, 2000);
  assert.equal(order.cancellation.status, 'APPROVED');
});

test('管理员驳回取消申请：订单回到原状态', () => {
  const order = createOrder({ id: 'o-1', amountFen: 10000, contactWechat: 'wx', createdAt: 0 });
  payOrder(order, { paidAt: 1000 });
  requestUnstartedCancel(order, { requestedBy: 'cs-1' });
  rejectCancellation(order, { rejectedBy: 'admin-1' });
  assert.equal(order.status, OrderStatus.PENDING_ACCEPT);
  assert.equal(order.cancellation.status, 'REJECTED');
});

test('非法流转抛错：待支付不能直接完成申请', () => {
  const order = createOrder({ id: 'o-1', amountFen: 10000, contactWechat: 'wx', createdAt: 0 });
  assert.throws(() => submitCompletion(order, { actualOutput: 1, attachmentIds: ['a'] }), /状态/);
});

test('非法流转抛错：待受理不能直接结单（必须先录入+抢单+完成申请）', () => {
  const order = createOrder({ id: 'o-1', amountFen: 10000, contactWechat: 'wx', createdAt: 0 });
  payOrder(order, { paidAt: 1000 });
  assert.throws(() => confirmSettlement(order, { confirmedBy: 'cs-1', customerConfirmed: true }), /状态/);
});
