import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';
import { transaction, updateWalletVersioned } from '../src/db.js';
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
  approveRefund,
  getWallet,
  applyWithdrawal,
  startWithdrawalReview,
  approveWithdrawal as approveWithdrawalRequest,
  startWithdrawalPayment,
  markWithdrawalPaid,
  rejectWithdrawal,
  adjustWallet,
  reportProfit,
} from '../src/services.js';

test('资金：事务失败整体回滚', () => {
  const db = createMemoryDb();
  db.orders.push({ _id: 'o1', status: 'PENDING_PAYMENT' });
  assert.throws(() => transaction(db, () => {
    db.orders.push({ _id: 'o2' });
    db.wallets.push({ _id: 'w1' });
    throw new Error('boom');
  }), /boom/);
  assert.equal(db.orders.length, 1);
  assert.equal(db.wallets.length, 0);
});

test('资金：钱包 version 乐观锁冲突返回 0', () => {
  const db = createMemoryDb();
  const w = seedWorker(db);
  const wallet = db.wallets[0];
  const v0 = wallet.version;
  assert.equal(updateWalletVersioned(db, wallet._id, v0, (x) => { x.availableFen += 100; }), 1);
  assert.equal(wallet.version, v0 + 1);
  assert.equal(updateWalletVersioned(db, wallet._id, v0, (x) => { x.availableFen += 100; }), 0);
  assert.equal(wallet.availableFen, 100);
});

test('资金：结算入账订单/钱包/流水/日志同事务一致', () => {
  const db = createMemoryDb();
  seedAdmin(db); const cs = seedCs(db); const w = seedWorker(db);
  const p = seedProduct(db);
  const order = grabToService(db, enterPool(db, createPaidOrder(db, p), cs.session), w.session);
  submitCompletion(db, { orderId: order._id, actualOutput: 10, attachmentIds: ['att'] }, w.session);
  verifyCompletion(db, { orderId: order._id }, cs.session);
  confirmSettlement(db, { orderId: order._id, customerConfirmed: true }, cs.session);
  assert.equal(db.orders[0].status, 'SETTLED');
  assert.equal(db.orders[0].earningsFen, 2000);
  assert.equal(getWallet(db, {}, w.session).availableFen, 2000);
  assert.equal(db.wallet_transactions.some((t) => t.type === 'ORDER_EARNINGS' && t.amountFen === 2000), true);
  assert.equal(db.order_logs.some((l) => l.action === 'close-order'), true);
});

test('资金：异议退款追回佣金，余额可为负', () => {
  const db = createMemoryDb();
  const admin = seedAdmin(db); const cs = seedCs(db); const w = seedWorker(db);
  const p = seedProduct(db);
  const order = grabToService(db, enterPool(db, createPaidOrder(db, p), cs.session), w.session);
  submitCompletion(db, { orderId: order._id, actualOutput: 10, attachmentIds: ['att'] }, w.session);
  verifyCompletion(db, { orderId: order._id }, cs.session);
  confirmSettlement(db, { orderId: order._id, customerConfirmed: true }, cs.session);
  const { disputeId } = submitDispute(db, { orderId: order._id, content: '差评' }, customerSession('mp-c1'));
  startDisputeReview(db, { disputeId }, cs.session);
  resolveDispute(db, { disputeId, result: 'full', note: '全额退款' }, cs.session);
  const refund = db.refunds.find((r) => r.type === 'dispute');
  approveRefund(db, { refundId: refund._id }, admin.session);
  assert.equal(db.orders[0].status, 'REFUNDED');
  assert.equal(refund.commissionRecoveredFen, 2000);
  assert.equal(getWallet(db, {}, w.session).availableFen, 0);
  // 再调账扣款 -> 允许为负。
  adjustWallet(db, { workerId: w.worker._id, amountFen: -500, reason: '追扣' }, admin.session);
  assert.equal(getWallet(db, {}, w.session).availableFen, -500);
});

test('资金：提现冻结-打款（扣冻结转已提现+凭证）原子一致', () => {
  const db = createMemoryDb();
  const admin = seedAdmin(db); const cs = seedCs(db); const w = seedWorker(db, { realnameApproved: true });
  const p = seedProduct(db);
  const order = grabToService(db, enterPool(db, createPaidOrder(db, p), cs.session), w.session);
  submitCompletion(db, { orderId: order._id, actualOutput: 10, attachmentIds: ['att'] }, w.session);
  verifyCompletion(db, { orderId: order._id }, cs.session);
  confirmSettlement(db, { orderId: order._id, customerConfirmed: true }, cs.session);
  const withdrawal = applyWithdrawal(db, { amountFen: 1000 }, w.session);
  startWithdrawalReview(db, { withdrawalId: withdrawal._id }, admin.session);
  approveWithdrawalRequest(db, { withdrawalId: withdrawal._id }, admin.session);
  startWithdrawalPayment(db, { withdrawalId: withdrawal._id, batchNo: 'B-1' }, admin.session);
  assert.equal(getWallet(db, {}, w.session).pendingWithdrawFen, 1000);
  assert.equal(getWallet(db, {}, w.session).availableFen, 1000);
  markWithdrawalPaid(db, { withdrawalId: withdrawal._id, batchNo: 'B-1' }, admin.session);
  assert.equal(getWallet(db, {}, w.session).withdrawnFen, 1000);
  assert.equal(getWallet(db, {}, w.session).pendingWithdrawFen, 0);
  assert.equal(db.transfer_records[0].batchNo, 'B-1');
});

test('报表：reportProfit 含对账项（totalWalletBalanceFen/walletBalanceSumFen/reconciliationFen）', () => {
  const db = createMemoryDb();
  const admin = seedAdmin(db); const cs = seedCs(db); const w = seedWorker(db);
  const p = seedProduct(db);
  const order = grabToService(db, enterPool(db, createPaidOrder(db, p), cs.session), w.session);
  submitCompletion(db, { orderId: order._id, actualOutput: 10, attachmentIds: ['att'] }, w.session);
  verifyCompletion(db, { orderId: order._id }, cs.session);
  confirmSettlement(db, { orderId: order._id, customerConfirmed: true }, cs.session);
  const r = reportProfit(db, {}, admin.session);
  assert.equal(r.earningsFen, 2000);
  assert.equal(r.profitFen, 2000);
  assert.equal(r.totalWalletBalanceFen, 2000);
  assert.equal(r.walletBalanceSumFen, 2000);
  assert.equal(r.reconciliationFen, 0);
});

test('资金：提现驳回解冻回可用余额', () => {
  const db = createMemoryDb();
  const admin = seedAdmin(db); const cs = seedCs(db); const w = seedWorker(db, { realnameApproved: true });
  const p = seedProduct(db);
  const order = grabToService(db, enterPool(db, createPaidOrder(db, p), cs.session), w.session);
  submitCompletion(db, { orderId: order._id, actualOutput: 10, attachmentIds: ['att'] }, w.session);
  verifyCompletion(db, { orderId: order._id }, cs.session);
  confirmSettlement(db, { orderId: order._id, customerConfirmed: true }, cs.session);
  const withdrawal = applyWithdrawal(db, { amountFen: 1000 }, w.session);
  rejectWithdrawal(db, { withdrawalId: withdrawal._id, reason: '资料不全' }, admin.session);
  assert.equal(withdrawal.status, 'REJECTED');
  assert.equal(getWallet(db, {}, w.session).availableFen, 2000);
  assert.equal(getWallet(db, {}, w.session).pendingWithdrawFen, 0);
});
