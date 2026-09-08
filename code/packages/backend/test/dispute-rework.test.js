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
  submitCompletion,
  verifyCompletion,
  confirmSettlement,
  submitDispute,
  startDisputeReview,
  resolveDispute,
  reworkOrder,
  requestRefund,
  approveRefund,
} from '../src/services.js';

// 构造一条已结单订单供异议测试（actualOutput 可指定）。
function buildSettledOrder(db, actualOutput = 10) {
  const cs = seedCs(db);
  const w = seedWorker(db);
  const p = seedProduct(db);
  const order = grabToService(db, enterPool(db, createPaidOrder(db, p), cs.session), w.session);
  submitCompletion(db, { orderId: order._id, actualOutput, attachmentIds: ['att'] }, w.session);
  verifyCompletion(db, { orderId: order._id }, cs.session);
  confirmSettlement(db, { orderId: order._id, customerConfirmed: true }, cs.session);
  return { cs, w, order };
}

test('异议：仲裁维持 -> 已结单', () => {
  const db = createMemoryDb();
  const { cs, order } = buildSettledOrder(db);
  const { disputeId } = submitDispute(db, { orderId: order._id, content: '不满意' }, customerSession('mp-c1'));
  assert.equal(db.orders[0].status, 'DISPUTING');
  startDisputeReview(db, { disputeId }, cs.session);
  const dispute = resolveDispute(db, { disputeId, result: 'maintain', note: '维持结单' }, cs.session);
  assert.equal(dispute.result, 'maintain');
  assert.equal(db.orders[0].status, 'SETTLED');
});

test('异议：仲裁部分退款 -> 退款中（按差额比例）', () => {
  const db = createMemoryDb();
  const { cs, order } = buildSettledOrder(db, 5); // 实际 5 < 保底 10
  const { disputeId } = submitDispute(db, { orderId: order._id, content: '少打了' }, customerSession('mp-c1'));
  startDisputeReview(db, { disputeId }, cs.session);
  resolveDispute(db, { disputeId, result: 'partial', note: '部分退款' }, cs.session);
  assert.equal(db.orders[0].status, 'REFUNDING');
  const refund = db.refunds.find((r) => r.type === 'dispute');
  assert.equal(refund.ratio, 0.5);
  assert.equal(refund.amountFen, 5000);
});

test('异议：仲裁全额退款 -> 退款中（比例 1）', () => {
  const db = createMemoryDb();
  const { cs, order } = buildSettledOrder(db);
  const { disputeId } = submitDispute(db, { orderId: order._id, content: '未履约' }, customerSession('mp-c1'));
  startDisputeReview(db, { disputeId }, cs.session);
  resolveDispute(db, { disputeId, result: 'full', note: '全额退款' }, cs.session);
  const refund = db.refunds.find((r) => r.type === 'dispute');
  assert.equal(refund.ratio, 1);
  assert.equal(refund.amountFen, order.amountFen);
});

test('补单：达上限（默认 1 次）后拒绝再次补单', () => {
  const db = createMemoryDb();
  const cs = seedCs(db);
  const w = seedWorker(db);
  const p = seedProduct(db);
  const order = grabToService(db, enterPool(db, createPaidOrder(db, p), cs.session), w.session);
  submitCompletion(db, { orderId: order._id, actualOutput: 5, attachmentIds: ['att'] }, w.session);
  assert.equal(db.orders[0].status, 'PENDING_CONFIRM');
  reworkOrder(db, { orderId: order._id, note: '补打' }, cs.session);
  assert.equal(db.orders[0].status, 'IN_SERVICE');
  assert.equal(db.orders[0].reworkCount, 1);
  submitCompletion(db, { orderId: order._id, actualOutput: 10, attachmentIds: ['att'] }, w.session);
  assert.throws(() => reworkOrder(db, { orderId: order._id, note: '再补' }, cs.session), /上限/);
});

test('退款：requestRefund type 枚举冻结（非法类型拒绝）', () => {
  const db = createMemoryDb();
  seedAdmin(db);
  const cs = seedCs(db);
  const w = seedWorker(db);
  const p = seedProduct(db);
  const order = grabToService(db, enterPool(db, createPaidOrder(db, p), cs.session), w.session);
  submitCompletion(db, { orderId: order._id, actualOutput: 5, attachmentIds: ['att'] }, w.session);
  assert.throws(() => requestRefund(db, { orderId: order._id, type: 'bogus' }, cs.session), /退款类型必须为/);
  assert.doesNotThrow(() => requestRefund(db, { orderId: order._id, type: 'partial_output' }, cs.session));
});

test('差额退款：未达标按实际/保底比例退款', () => {
  const db = createMemoryDb();
  const admin = seedAdmin(db);
  const cs = seedCs(db);
  const w = seedWorker(db);
  const p = seedProduct(db); // guaranteedOutput 10
  const order = grabToService(db, enterPool(db, createPaidOrder(db, p), cs.session), w.session);
  submitCompletion(db, { orderId: order._id, actualOutput: 5, attachmentIds: ['att'] }, w.session);
  const { refundId } = requestRefund(db, { orderId: order._id, type: 'partial_output', reason: '未达标' }, cs.session);
  const refund = db.refunds.find((r) => r._id === refundId);
  assert.equal(refund.ratio, 0.5); // 1 - 5/10
  assert.equal(refund.amountFen, 5000); // 10000 * 0.5
  assert.equal(db.orders[0].status, 'REFUNDING');
  approveRefund(db, { refundId }, admin.session);
  assert.equal(db.orders[0].status, 'REFUNDED');
});
