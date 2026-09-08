import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';
import {
  createMemoryDb, seedAdmin, seedWorker, seedCs, seedProduct, issueOrderToken,
  customerSession, createPaidOrder, enterPool, grabToService,
} from './helpers.js';
import { insert } from '../src/db.js';
import {
  saveCommissionRule, createOrderFromH5, getPaymentParams, confirmMockPayment, getPaymentStatus, listPayments, payNotify,
  assignOrder, reassignOrder, listAssignments, getOrder, grabOrder, submitCompletion, verifyCompletion, rejectCompletion, closeOrder,
  reconcileWalletLedger, getWallet, applyWithdrawal, startWithdrawalReview, approveWithdrawal, startWithdrawalPayment,
  failWithdrawalPayment, markWithdrawalPaid, submitDispute, addDisputeEvidence, startDisputeReview, resolveDispute, closeDispute,
  listWithdrawals, listDisputes, getDispute,
} from '../src/services.js';
import { migratePhase2Models } from '../../../scripts/migrate-phase2-models.mjs';

test('二阶段：商品版本、品牌/佣金/表单快照与买家域幂等', () => {
  const db = createMemoryDb();
  const admin = seedAdmin(db);
  insert(db, 'brands', { brandId: 'default', code: 'default', name: '默认品牌', status: 'ON', version: 3, publishedVersion: 3, publicConfig: { hotline: '400-1' } });
  const rule = saveCommissionRule(db, { brandId: 'default', rule: { type: 'percent', valuePercent: 25 }, status: 'DEMO_ONLY' }, admin.session);
  const product = seedProduct(db, { formSchema: { required: ['server'], properties: { server: { type: 'string' } } }, commissionRuleId: rule._id });
  const token = issueOrderToken(db, product._id);
  assert.throws(() => createOrderFromH5(db, { h5Token: token, contactWechat: 'wx', idempotencyKey: 'req-1' }), /server|必填/);
  const first = createOrderFromH5(db, { h5Token: token, contactWechat: 'wx', server: '一区', idempotencyKey: 'req-1' });
  const duplicate = createOrderFromH5(db, { h5Token: token, contactWechat: 'wx', server: '二区', idempotencyKey: 'req-1' });
  assert.equal(duplicate.orderId, first.orderId);
  assert.equal(duplicate.duplicate, true);
  const order = db.orders[0];
  assert.equal(order.formData.server, '一区');
  assert.equal(order.brandSnapshot.version, 3);
  assert.equal(order.commissionRuleSnapshot.version, rule.version);
  product.title = '已修改标题';
  rule.rule.valuePercent = 99;
  assert.equal(order.productSnapshot.title, '陪玩一小时');
  assert.equal(order.commissionRuleSnapshot.rule.valuePercent, 25);
});

test('二阶段：Mock 支付单创建、确认、状态恢复与管理查询', () => {
  const previousMode = process.env.PAYMENT_MODE;
  process.env.PAYMENT_MODE = 'mock';
  try {
    const db = createMemoryDb();
    const admin = seedAdmin(db); const product = seedProduct(db);
    const token = issueOrderToken(db, product._id);
    const created = createOrderFromH5(db, { h5Token: token, contactWechat: 'wx' });
    const params = getPaymentParams(db, { orderId: created.orderId, h5Token: token, payType: 'MWEB' }, customerSession('mp-c1'));
    assert.equal(params.paymentMode, 'mock');
    confirmMockPayment(db, { paymentId: params.paymentId }, customerSession('mp-c1'));
    assert.equal(getPaymentStatus(db, { paymentId: params.paymentId, h5Token: token }).status, 'SUCCESS');
    assert.equal(listPayments(db, { orderId: created.orderId }, admin.session).length, 1);
    assert.equal(db.orders[0].paymentId, params.paymentId);

    const mismatchOrder = createOrderFromH5(db, { h5Token: token, contactWechat: 'wx-2' });
    const mismatchPayment = getPaymentParams(db, { orderId: mismatchOrder.orderId, h5Token: token, payType: 'MWEB' }, customerSession('mp-c1'));
    assert.throws(() => payNotify(db, {
      paymentId: mismatchPayment.paymentId,
      transactionId: 'tx-amount-mismatch',
      amountFen: product.priceFen + 1,
      brandId: 'default',
    }), /支付金额不符/);
    assert.equal(db.payments.find((row) => row._id === mismatchPayment.paymentId).status, 'FAILED');
    assert.equal(db.orders.find((row) => row._id === mismatchOrder.orderId).status, 'PENDING_PAYMENT');
    assert.equal(db.notifications.some((row) => row.template === 'PAYMENT_MISMATCH'), true);
    assert.equal(db.audit_logs.some((row) => row.action === 'paymentMismatch'), true);
  } finally {
    if (previousMode === undefined) delete process.env.PAYMENT_MODE;
    else process.env.PAYMENT_MODE = previousMode;
  }
});

test('二阶段：指派改派留痕、抢单版本冲突、验收退回与验收后结单', () => {
  const db = createMemoryDb();
  const admin = seedAdmin(db); const cs = seedCs(db); const w1 = seedWorker(db); const w2 = seedWorker(db, { phone: '13800000009', nickname: '小李' });
  const product = seedProduct(db);
  const order = enterPool(db, createPaidOrder(db, product), cs.session);
  assignOrder(db, { orderId: order._id, workerId: w1.worker._id }, cs.session);
  reassignOrder(db, { orderId: order._id, workerId: w2.worker._id, reason: '排班调整' }, cs.session);
  assert.deepEqual(listAssignments(db, { orderId: order._id }, cs.session).map((row) => row.type), ['ASSIGN', 'REASSIGN']);
  assert.ok(getOrder(db, { orderId: order._id }, cs.session).order.allowedActions.includes('reassignOrder'));
  // 退回池后用错误版本抢单，服务端返回可映射 409 的 CONFLICT。
  db.orders[0].status = 'PENDING_GRAB'; db.orders[0].workerId = '';
  assert.throws(() => grabOrder(db, { orderId: order._id, expectedVersion: 999 }, w1.session), /CONFLICT/);
  grabOrder(db, { orderId: order._id, expectedVersion: db.orders[0].version || 0 }, w1.session);
  submitCompletion(db, { orderId: order._id, actualOutput: 10, attachmentIds: ['proof'] }, w1.session);
  rejectCompletion(db, { orderId: order._id, reason: '凭证不清晰' }, cs.session);
  assert.equal(db.orders[0].status, 'IN_SERVICE');
  submitCompletion(db, { orderId: order._id, actualOutput: 10, attachmentIds: ['proof-2'] }, w1.session);
  assert.throws(() => closeOrder(db, { orderId: order._id }, cs.session), /验收|核对/);
  verifyCompletion(db, { orderId: order._id, note: '通过' }, cs.session);
  closeOrder(db, { orderId: order._id }, cs.session);
  assert.equal(db.orders[0].status, 'SETTLED');
  assert.equal(reconcileWalletLedger(db, { workerId: w1.worker._id }, admin.session)[0].ok, true);
});

test('二阶段：提现七态失败重试与异议五态证据闭环', () => {
  const db = createMemoryDb();
  const admin = seedAdmin(db); const cs = seedCs(db); const worker = seedWorker(db, { realnameApproved: true }); const product = seedProduct(db);
  const order = grabToService(db, enterPool(db, createPaidOrder(db, product), cs.session), worker.session);
  submitCompletion(db, { orderId: order._id, actualOutput: 10, attachmentIds: ['proof'] }, worker.session);
  verifyCompletion(db, { orderId: order._id }, cs.session); closeOrder(db, { orderId: order._id }, cs.session);
  const withdrawal = applyWithdrawal(db, { amountFen: 1000 }, worker.session);
  assert.equal(withdrawal.status, 'SUBMITTED');
  startWithdrawalReview(db, { withdrawalId: withdrawal._id }, admin.session);
  approveWithdrawal(db, { withdrawalId: withdrawal._id }, admin.session);
  startWithdrawalPayment(db, { withdrawalId: withdrawal._id, batchNo: 'B-FAIL' }, admin.session);
  failWithdrawalPayment(db, { withdrawalId: withdrawal._id, reason: '渠道超时' }, admin.session);
  assert.equal(withdrawal.status, 'PAY_FAILED');
  assert.equal(getWallet(db, {}, worker.session).pendingWithdrawFen, 1000);
  startWithdrawalPayment(db, { withdrawalId: withdrawal._id, batchNo: 'B-RETRY' }, admin.session);
  markWithdrawalPaid(db, { withdrawalId: withdrawal._id, batchNo: 'B-RETRY' }, admin.session);
  assert.equal(withdrawal.status, 'PAID');

  const { disputeId } = submitDispute(db, { orderId: order._id, content: '服务争议' }, customerSession('mp-c1'));
  addDisputeEvidence(db, { disputeId, content: '补充截图', attachmentIds: ['e1'] }, customerSession('mp-c1'));
  assert.equal(db.disputes[0].status, 'EVIDENCE_COLLECTION');
  startDisputeReview(db, { disputeId }, cs.session);
  resolveDispute(db, { disputeId, result: 'maintain', note: '证据不足' }, cs.session);
  assert.equal(db.disputes[0].status, 'DECIDED');
  closeDispute(db, { disputeId }, admin.session);
  assert.equal(db.disputes[0].status, 'CLOSED');
});

test('二阶段迁移：旧支付/提现/异议/账本数据幂等升级', () => {
  const source = {
    products: [{ _id: 'p1', brandId: 'default', commission: { type: 'percent', valuePercent: 20 } }],
    orders: [{ _id: 'o1', orderNo: 'O1', productId: 'p1', brandId: 'default', customerId: 'c1', amountFen: 1000, transactionId: 'tx1', status: 'PENDING_ACCEPT' }],
    refunds: [{ _id: 'r1', orderId: 'o1' }], withdrawals: [{ _id: 'wd1', status: 'PENDING_REVIEW' }],
    disputes: [{ _id: 'd1', status: 'RESOLVED', createdAt: 1 }], wallets: [{ _id: 'w1', ownerId: 'u1' }],
    wallet_transactions: [{ _id: 't1', walletId: 'w1', type: 'COMMISSION_REVERSAL', amountFen: -100 }],
  };
  const once = migratePhase2Models(source);
  assert.equal(once.data.payments.length, 1);
  assert.equal(once.data.withdrawals[0].status, 'SUBMITTED');
  assert.equal(once.data.disputes[0].status, 'DECIDED');
  assert.equal(once.data.wallet_transactions[0].type, 'REFUND_CLAWBACK');
  const twice = migratePhase2Models(once.data);
  assert.equal(twice.data.payments.length, 1);
  assert.deepEqual(twice.report.created, {});
});

test('二阶段权限：FINANCE_REVIEWER 与 ARBITRATOR 只能访问品牌 scope', () => {
  const db = createMemoryDb();
  db.withdrawals.push(
    { _id: 'wd-a', brandId: 'brand-a', workerId: 'w1', status: 'SUBMITTED', createdAt: 2 },
    { _id: 'wd-b', brandId: 'brand-b', workerId: 'w2', status: 'SUBMITTED', createdAt: 1 },
  );
  db.disputes.push(
    { _id: 'd-a', brandId: 'brand-a', orderId: 'o-a', status: 'OPEN', createdAt: 2 },
    { _id: 'd-b', brandId: 'brand-b', orderId: 'o-b', status: 'OPEN', createdAt: 1 },
  );
  db.orders.push({ _id: 'o-a', brandId: 'brand-a' }, { _id: 'o-b', brandId: 'brand-b' });
  const finance = { userId: 'finance-a', role: 'FINANCE_REVIEWER', roles: ['FINANCE_REVIEWER'], brandScopes: ['brand-a'] };
  const arbitrator = { userId: 'arb-a', role: 'ARBITRATOR', roles: ['ARBITRATOR'], brandScopes: ['brand-a'] };
  assert.deepEqual(listWithdrawals(db, {}, finance).map((row) => row._id), ['wd-a']);
  assert.deepEqual(listDisputes(db, {}, arbitrator).map((row) => row._id), ['d-a']);
  assert.throws(() => getDispute(db, { disputeId: 'd-b' }, arbitrator), /无权查看该异议|BRAND_FORBIDDEN/);
});
