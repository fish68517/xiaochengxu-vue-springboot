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
  submitCompletion,
  verifyCompletion,
  confirmSettlement,
  applyWithdrawal,
  startWithdrawalReview,
  approveWithdrawal as approveWithdrawalRequest,
  startWithdrawalPayment,
  markWithdrawalPaid,
  requestCancellation,
  approveRefund,
  getWallet,
  dashboard,
} from '../src/services.js';

// 端到端 SOP 六步全链路（下单->支付->受理录入->抢单->服务完成->结单入账）+ 提现 + 取消退款。
test('端到端全流程冒烟：SOP 六步 + 提现 + 未开工取消', () => {
  const db = createMemoryDb();
  const admin = seedAdmin(db);
  const cs = seedCs(db);
  const w = seedWorker(db, { realnameApproved: true });
  const p = seedProduct(db);
  const steps = [];
  const step = (name, fn) => { const r = fn(); steps.push(name); return r; };

  // 1 下单
  const order1 = step('下单', () => createOrderFromH5(db, { h5Token: issueOrderToken(db, p._id, 'mp-c1'), contactWechat: 'wx-c1' }));
  // 2 支付
  step('支付', () => payNotify(db, { orderId: order1.orderId, transactionId: 'txn-j1' }));
  // 3 受理录入
  step('录入', () => enterPool(db, db.orders.find((o) => o._id === order1.orderId), cs.session));
  // 4 抢单
  step('抢单', () => grabToService(db, db.orders.find((o) => o._id === order1.orderId), w.session));
  // 5 服务完成申请
  step('完成申请', () => submitCompletion(db, { orderId: order1.orderId, actualOutput: 10, attachmentIds: ['att'] }, w.session));
  step('完成核对', () => verifyCompletion(db, { orderId: order1.orderId }, cs.session));
  // 6 结单入账
  step('结单', () => confirmSettlement(db, { orderId: order1.orderId, customerConfirmed: true }, cs.session));

  assert.equal(getWallet(db, {}, w.session).availableFen, 2000);

  // 提现（申请 + 打款）
  const withdrawal = step('提现申请', () => applyWithdrawal(db, { amountFen: 1000 }, w.session));
  step('提现审核', () => startWithdrawalReview(db, { withdrawalId: withdrawal._id }, admin.session));
  step('提现批准', () => approveWithdrawalRequest(db, { withdrawalId: withdrawal._id }, admin.session));
  step('开始出款', () => startWithdrawalPayment(db, { withdrawalId: withdrawal._id, batchNo: 'B1' }, admin.session));
  step('提现打款', () => markWithdrawalPaid(db, { withdrawalId: withdrawal._id, batchNo: 'B1' }, admin.session));
  assert.equal(getWallet(db, {}, w.session).withdrawnFen, 1000);

  // 未开工取消退款
  const order2 = step('二单下单', () => createPaidOrder(db, p, { openid: 'mp-c2', contactWechat: 'wx-c2' }));
  const { refundId } = step('取消申请', () => requestCancellation(db, { orderId: order2._id, reason: '不想要' }, cs.session));
  step('审批退款', () => approveRefund(db, { refundId }, admin.session));
  assert.equal(db.orders.find((o) => o._id === order2._id).status, 'CANCELLED');

  const dash = dashboard(db, {}, admin.session);
  for (const key of ['totalOrders', 'pendingAcceptOrders', 'inServiceOrders', 'workers', 'pendingConfirmOrders', 'pendingRefunds', 'pendingWithdrawals', 'pendingDisputes']) {
    assert.equal(typeof dash[key], 'number');
  }
  assert.ok(steps.length >= 10);
});
