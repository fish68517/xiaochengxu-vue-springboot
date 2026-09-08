import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OrderStatus,
  RefundStatus,
  CancellationStatus,
  DisputeResult,
  PAYMENT_TIMEOUT_MS,
  DISPUTE_WINDOW_MS,
  createOrder,
  isPaymentExpired,
  payOrder,
  timeoutClose,
  requestUnstartedCancel,
  approveUnstartedCancel,
  rejectCancellation,
  enterOrder,
  grabOrder,
  assignOrder,
  acceptAssignment,
  rejectAssignment,
  releaseOrder,
  requestServiceRefund,
  submitCompletion,
  verifyCompletion,
  confirmSettlement,
  reworkOrder,
  requestOutputRefund,
  openDispute,
  resolveDisputeMaintain,
  resolveDisputeRefund,
  approveRefund,
  refundSuccess,
  refundFailed,
} from '../src/order-machine.js';

// 构建待支付订单
function newOrder(over = {}) {
  return createOrder({
    id: 'o-1',
    amountFen: 10000,
    productId: 'p-1',
    customerId: 'c-1',
    contactWechat: 'wx-1',
    createdAt: 0,
    ...over,
  });
}

// 待支付 -> 待受理
function toAccept(order) {
  payOrder(order, { paidAt: 1000, transactionId: 'tx-1', payerOpenid: 'openid-1' });
  return order;
}

// 待支付 -> 待受理 -> 待抢单
function toGrab(order) {
  enterOrder(toAccept(order), {
    game: '王者荣耀',
    region: 'QQ一区',
    serviceType: '技能陪伴',
    customerUid: 'uid-1',
    customerNickname: '小明',
    expectStartAt: 2000,
  });
  return order;
}

// 待支付 -> 待受理 -> 待抢单 -> 服务中
function toService(order, workerId = 'worker-1') {
  grabOrder(toGrab(order), workerId);
  return order;
}

// 待支付 -> ... -> 待确认
function toConfirm(order, workerId = 'worker-1') {
  const o = toService(order, workerId);
  submitCompletion(o, { actualOutput: 80, attachmentIds: ['att-1'] });
  verifyCompletion(o, { verifiedBy: 'cs-1' });
  return o;
}

test('OrderStatus 为 12 状态且 RefundStatus/DisputeResult 齐全', () => {
  assert.equal(Object.keys(OrderStatus).length, 12);
  assert.deepEqual(RefundStatus, {
    PENDING_APPROVAL: 'PENDING_APPROVAL',
    PROCESSING: 'PROCESSING',
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
  });
  assert.deepEqual(DisputeResult, { MAINTAIN: 'MAINTAIN', PARTIAL: 'PARTIAL', FULL: 'FULL' });
  assert.equal(PAYMENT_TIMEOUT_MS, 30 * 60 * 1000);
  assert.equal(DISPUTE_WINDOW_MS, 72 * 60 * 60 * 1000);
});

test('P1 主流程：待支付 → 待受理 → 待抢单 → 服务中 → 待确认 → 已结单', () => {
  const order = newOrder();
  assert.equal(order.status, OrderStatus.PENDING_PAYMENT);
  assert.equal(order.payDeadline, PAYMENT_TIMEOUT_MS);

  toAccept(order);
  assert.equal(order.status, OrderStatus.PENDING_ACCEPT);
  assert.equal(order.transactionId, 'tx-1');
  assert.equal(order.payerOpenid, 'openid-1');

  enterOrder(order, {
    game: '王者荣耀',
    region: 'QQ一区',
    serviceType: '技能陪伴',
    customerUid: 'uid-1',
    customerNickname: '小明',
    expectStartAt: 2000,
  });
  assert.equal(order.status, OrderStatus.PENDING_GRAB);
  assert.ok(order.pooledAt);

  grabOrder(order, 'worker-1');
  assert.equal(order.status, OrderStatus.IN_SERVICE);
  assert.equal(order.workerId, 'worker-1');

  submitCompletion(order, { actualOutput: 80, attachmentIds: ['att-1'] });
  assert.equal(order.status, OrderStatus.PENDING_CONFIRM);
  assert.equal(order.actualOutput, 80);
  verifyCompletion(order, { verifiedBy: 'cs-1' });

  confirmSettlement(order, { confirmedBy: 'cs-1', customerConfirmed: true });
  assert.equal(order.status, OrderStatus.SETTLED);
  assert.ok(order.completedAt);
  assert.ok(order.disputeDeadline > order.completedAt);
});

test('E1 支付超时：待支付 → 已关闭', () => {
  const order = newOrder();
  assert.equal(isPaymentExpired(order, PAYMENT_TIMEOUT_MS), true);
  assert.equal(isPaymentExpired(order, PAYMENT_TIMEOUT_MS - 1), false);
  timeoutClose(order, { closedAt: PAYMENT_TIMEOUT_MS });
  assert.equal(order.status, OrderStatus.CLOSED);
  assert.equal(order.cancelReason, 'TIMEOUT');
});

test('未超时不能关单', () => {
  const order = newOrder();
  assert.throws(() => timeoutClose(order, { closedAt: PAYMENT_TIMEOUT_MS - 1 }), /未超时/);
});

test('E2 未开工取消：待受理 → 已取消', () => {
  const order = toAccept(newOrder());
  requestUnstartedCancel(order, { requestedBy: 'cs-1', reason: '客户要求取消' });
  assert.equal(order.cancellation.status, CancellationStatus.PENDING_REVIEW);
  approveUnstartedCancel(order, { approvedBy: 'admin-1', refundedAt: 3000 });
  assert.equal(order.status, OrderStatus.CANCELLED);
  assert.equal(order.refundedAt, 3000);
  assert.equal(order.cancellation.status, CancellationStatus.APPROVED);
});

test('E2 未开工取消：待抢单 → 已取消', () => {
  const order = toGrab(newOrder());
  requestUnstartedCancel(order, { requestedBy: 'cs-1' });
  approveUnstartedCancel(order, { approvedBy: 'admin-1', refundedAt: 3000 });
  assert.equal(order.status, OrderStatus.CANCELLED);
});

test('未开工取消可被驳回，订单保持原状态', () => {
  const order = toAccept(newOrder());
  requestUnstartedCancel(order, { requestedBy: 'cs-1' });
  rejectCancellation(order, { rejectedBy: 'admin-1' });
  assert.equal(order.status, OrderStatus.PENDING_ACCEPT);
  assert.equal(order.cancellation.status, CancellationStatus.REJECTED);
});

test('重复发起未开工取消申请被拦截', () => {
  const order = toAccept(newOrder());
  requestUnstartedCancel(order, { requestedBy: 'cs-1' });
  assert.throws(() => requestUnstartedCancel(order, { requestedBy: 'cs-2' }), /待审核/);
});

test('E3 指派接受：待抢单 → 指派待确认 → 服务中', () => {
  const order = toGrab(newOrder());
  assignOrder(order, 'worker-1', { assignedBy: 'cs-1' });
  assert.equal(order.status, OrderStatus.ASSIGN_PENDING);
  assert.equal(order.workerId, 'worker-1');
  acceptAssignment(order, 'worker-1');
  assert.equal(order.status, OrderStatus.IN_SERVICE);
});

test('E3 指派拒绝：指派待确认 → 待抢单（回池）', () => {
  const order = toGrab(newOrder());
  assignOrder(order, 'worker-1', { assignedBy: 'cs-1' });
  rejectAssignment(order, 'worker-1', { reason: '时间冲突' });
  assert.equal(order.status, OrderStatus.PENDING_GRAB);
  assert.equal(order.workerId, undefined);
});

test('非指派对象不能接受指派', () => {
  const order = toGrab(newOrder());
  assignOrder(order, 'worker-1', { assignedBy: 'cs-1' });
  assert.throws(() => acceptAssignment(order, 'worker-2'), /不一致/);
});

test('E4 退单：服务中 → 待抢单（回池留痕）', () => {
  const order = toService(newOrder());
  releaseOrder(order, 'worker-1', { reason: '临时有事' });
  assert.equal(order.status, OrderStatus.PENDING_GRAB);
  assert.equal(order.workerId, undefined);
  assert.equal(order.releaseReason, '临时有事');
});

test('非接单人员不能退单', () => {
  const order = toService(newOrder());
  assert.throws(() => releaseOrder(order, 'worker-2', { reason: 'x' }), /不一致/);
});

test('E5 服务中取消：服务中 → 退款中 → 已退款', () => {
  const order = toService(newOrder());
  requestServiceRefund(order, { requestedBy: 'cs-1', ratio: 0.5, reason: '客户要求取消' });
  assert.equal(order.status, OrderStatus.REFUNDING);
  assert.equal(order.refundStatus, RefundStatus.PENDING_APPROVAL);
  approveRefund(order, { approvedBy: 'admin-1' });
  assert.equal(order.refundStatus, RefundStatus.PROCESSING);
  refundSuccess(order, { refundedAt: 4000, refundId: 'rf-1' });
  assert.equal(order.status, OrderStatus.REFUNDED);
  assert.equal(order.refundStatus, RefundStatus.SUCCESS);
});

test('E6 补单：待确认 → 服务中(补单) → 待确认 → 已结单', () => {
  const order = toConfirm(newOrder());
  reworkOrder(order, { reworkedBy: 'cs-1', note: '补足产出' });
  assert.equal(order.status, OrderStatus.IN_SERVICE);
  assert.equal(order.reworkCount, 1);
  submitCompletion(order, { actualOutput: 100, attachmentIds: ['att-2'] });
  assert.equal(order.status, OrderStatus.PENDING_CONFIRM);
  verifyCompletion(order, { verifiedBy: 'cs-1' });
  confirmSettlement(order, { confirmedBy: 'cs-1', customerConfirmed: true });
  assert.equal(order.status, OrderStatus.SETTLED);
});

test('补单次数达上限（默认 1）不能再次补单', () => {
  const order = toConfirm(newOrder());
  reworkOrder(order, { reworkedBy: 'cs-1', note: '第一次补单' });
  submitCompletion(order, { actualOutput: 100, attachmentIds: ['att-2'] });
  assert.throws(() => reworkOrder(order, { reworkedBy: 'cs-1', note: '再补' }), /上限/);
});

test('E7 未达标比例退：待确认 → 退款中 → 已退款', () => {
  const order = toConfirm(newOrder());
  requestOutputRefund(order, { requestedBy: 'cs-1', ratio: 0.8, reason: '未达标退款' });
  assert.equal(order.status, OrderStatus.REFUNDING);
  assert.equal(order.refundStatus, RefundStatus.PENDING_APPROVAL);
  approveRefund(order, { approvedBy: 'admin-1' });
  refundSuccess(order, { refundedAt: 5000, refundId: 'rf-2' });
  assert.equal(order.status, OrderStatus.REFUNDED);
});

test('E8 异议维持：已结单 → 异议中 → 已结单', () => {
  const order = toConfirm(newOrder());
  confirmSettlement(order, { confirmedBy: 'cs-1', customerConfirmed: true });
  openDispute(order, { customerId: 'c-1', content: '对产出有异议' });
  assert.equal(order.status, OrderStatus.DISPUTING);
  resolveDisputeMaintain(order, { resolvedBy: 'cs-1', note: '维持结单' });
  assert.equal(order.status, OrderStatus.SETTLED);
  assert.equal(order.dispute.result, DisputeResult.MAINTAIN);
});

test('E8 异议退款：已结单 → 异议中 → 退款中 → 已退款', () => {
  const order = toConfirm(newOrder());
  confirmSettlement(order, { confirmedBy: 'cs-1', customerConfirmed: true });
  openDispute(order, { customerId: 'c-1', content: '要求退款' });
  resolveDisputeRefund(order, { resolvedBy: 'cs-1', result: DisputeResult.PARTIAL, note: '部分退款' });
  assert.equal(order.status, OrderStatus.REFUNDING);
  approveRefund(order, { approvedBy: 'admin-1' });
  refundSuccess(order, { refundedAt: 6000, refundId: 'rf-3' });
  assert.equal(order.status, OrderStatus.REFUNDED);
});

test('异议窗口超时后不能发起异议', () => {
  const order = toConfirm(newOrder());
  confirmSettlement(order, { confirmedBy: 'cs-1', customerConfirmed: true });
  const deadline = order.disputeDeadline;
  // 直接改写截止时间模拟超时
  order.disputeDeadline = deadline - DISPUTE_WINDOW_MS - 1;
  assert.throws(() => openDispute(order, { customerId: 'c-1', content: '异议' }), /窗口/);
});

test('E9 退款失败重试：退款中(失败) → 已退款', () => {
  const order = toService(newOrder());
  requestServiceRefund(order, { requestedBy: 'cs-1', ratio: 0.5, reason: '取消' });
  approveRefund(order, { approvedBy: 'admin-1' });
  refundFailed(order, { reason: '微信退款失败' });
  assert.equal(order.status, OrderStatus.REFUNDING);
  assert.equal(order.refundStatus, RefundStatus.FAILED);
  refundSuccess(order, { refundedAt: 7000, refundId: 'rf-4' });
  assert.equal(order.status, OrderStatus.REFUNDED);
  assert.equal(order.refundStatus, RefundStatus.SUCCESS);
});

test('非法流转抛错：待支付不能直接完成申请/结单/抢单', () => {
  const order = newOrder();
  assert.throws(() => submitCompletion(order, { actualOutput: 1, attachmentIds: ['a'] }), /状态/);
  assert.throws(() => confirmSettlement(order, { confirmedBy: 'cs', customerConfirmed: true }), /状态/);
  assert.throws(() => grabOrder(order, 'worker-1'), /状态/);
});

test('待受理缺必填字段不能录入', () => {
  const order = toAccept(newOrder());
  assert.throws(
    () => enterOrder(order, { game: '', region: 'r', serviceType: 's', customerUid: 'u', customerNickname: 'n', expectStartAt: 1 }),
    /必填/,
  );
});

test('结单前必须与客户确认', () => {
  const order = toConfirm(newOrder());
  assert.throws(() => confirmSettlement(order, { confirmedBy: 'cs-1', customerConfirmed: false }), /确认/);
});

test('提交完成申请必须至少一张凭证', () => {
  const order = toService(newOrder());
  assert.throws(() => submitCompletion(order, { actualOutput: 10, attachmentIds: [] }), /凭证/);
});
