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
} from './helpers.js';
import {
  createOrderFromH5,
  payNotify,
  grabOrder,
  submitCompletion,
  verifyCompletion,
  confirmSettlement,
  getWallet,
  applyWithdrawal,
  startWithdrawalReview,
  approveWithdrawal,
  startWithdrawalPayment,
  markWithdrawalPaid,
} from '../src/services.js';

test('并发：同一订单并发抢单仅一人成功', async () => {
  const db = createMemoryDb();
  seedAdmin(db); const cs = seedCs(db);
  const w1 = seedWorker(db);
  const w2 = seedWorker(db, { phone: '13800000009', nickname: '小李' });
  const p = seedProduct(db);
  const order = enterPool(db, createPaidOrder(db, p), cs.session);
  const results = await Promise.all([
    Promise.resolve().then(() => grabOrder(db, { orderId: order._id }, w1.session)).then(() => 'ok', () => 'fail'),
    Promise.resolve().then(() => grabOrder(db, { orderId: order._id }, w2.session)).then(() => 'ok', () => 'fail'),
  ]);
  assert.equal(results.filter((r) => r === 'ok').length, 1);
  assert.equal(db.orders[0].status, 'IN_SERVICE');
  assert.ok([w1.worker._id, w2.worker._id].includes(db.orders[0].workerId));
});

test('幂等：重复支付回调只落账一次', () => {
  const db = createMemoryDb();
  seedAdmin(db); seedCs(db); seedWorker(db);
  const p = seedProduct(db);
  const token = issueOrderToken(db, p._id);
  const created = createOrderFromH5(db, { h5Token: token, contactWechat: 'wx' });
  payNotify(db, { orderId: created.orderId, transactionId: 'txn-repeat' });
  payNotify(db, { orderId: created.orderId, transactionId: 'txn-repeat' });
  assert.equal(db.orders.filter((o) => o.transactionId === 'txn-repeat').length, 1);
  assert.equal(db.orders[0].paidAt !== undefined, true);
});

test('幂等：重复结单不重复入账', () => {
  const db = createMemoryDb();
  seedAdmin(db); const cs = seedCs(db); const w = seedWorker(db);
  const p = seedProduct(db);
  const order = grabToService(db, enterPool(db, createPaidOrder(db, p), cs.session), w.session);
  submitCompletion(db, { orderId: order._id, actualOutput: 10, attachmentIds: ['att'] }, w.session);
  verifyCompletion(db, { orderId: order._id }, cs.session);
  confirmSettlement(db, { orderId: order._id, customerConfirmed: true }, cs.session);
  const first = getWallet(db, {}, w.session).availableFen;
  confirmSettlement(db, { orderId: order._id, customerConfirmed: true }, cs.session);
  assert.equal(getWallet(db, {}, w.session).availableFen, first);
  assert.equal(db.wallet_transactions.filter((t) => t.type === 'ORDER_EARNINGS').length, 1);
});

test('幂等：重复打款提现被拦截', () => {
  const db = createMemoryDb();
  const admin = seedAdmin(db); const cs = seedCs(db); const w = seedWorker(db, { realnameApproved: true });
  const p = seedProduct(db);
  const order = grabToService(db, enterPool(db, createPaidOrder(db, p), cs.session), w.session);
  submitCompletion(db, { orderId: order._id, actualOutput: 10, attachmentIds: ['att'] }, w.session);
  verifyCompletion(db, { orderId: order._id }, cs.session);
  confirmSettlement(db, { orderId: order._id, customerConfirmed: true }, cs.session);
  const withdrawal = applyWithdrawal(db, { amountFen: 1000 }, w.session);
  startWithdrawalReview(db, { withdrawalId: withdrawal._id }, admin.session);
  approveWithdrawal(db, { withdrawalId: withdrawal._id }, admin.session);
  startWithdrawalPayment(db, { withdrawalId: withdrawal._id, batchNo: 'B1' }, admin.session);
  markWithdrawalPaid(db, { withdrawalId: withdrawal._id, batchNo: 'B1' }, admin.session);
  assert.throws(() => markWithdrawalPaid(db, { withdrawalId: withdrawal._id, batchNo: 'B1' }, admin.session), /状态/);
});
