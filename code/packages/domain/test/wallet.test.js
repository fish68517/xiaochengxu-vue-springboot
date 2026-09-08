import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWallet,
  creditWallet,
  debitWallet,
  setWalletFreeze,
  createWithdrawal,
  startWithdrawalReview,
  approveWithdrawal,
  startWithdrawalPayment,
  failWithdrawalPayment,
  markWithdrawalPaid,
  rejectWithdrawal,
  WithdrawalStatus,
} from '../src/wallet.js';

test('新钱包余额为 0、未冻结、version 为 0', () => {
  const w = createWallet();
  assert.equal(w.availableFen, 0);
  assert.equal(w.pendingWithdrawFen, 0);
  assert.equal(w.withdrawnFen, 0);
  assert.equal(w.freezeWithdrawal, false);
  assert.equal(w.freezeAccept, false);
  assert.equal(w.version, 0);
});

test('入账增加可用余额', () => {
  const w = createWallet();
  creditWallet(w, 5000);
  assert.equal(w.availableFen, 5000);
});

test('提现申请冻结余额并生成待审批申请（实名已审核）', () => {
  const w = createWallet();
  creditWallet(w, 5000);
  const app = createWithdrawal(w, { id: 'wd-1', amountFen: 1000, realnameApproved: true });
  assert.equal(w.availableFen, 4000);
  assert.equal(w.pendingWithdrawFen, 1000);
  assert.equal(app.status, WithdrawalStatus.SUBMITTED);
  assert.equal(app.applyCountWeek, 1);
});

test('实名未审核不能提现', () => {
  const w = createWallet();
  creditWallet(w, 5000);
  assert.throws(() => createWithdrawal(w, { id: 'wd-1', amountFen: 1000 }), /实名/);
});

test('本周提现次数达上限不能提现', () => {
  const w = createWallet();
  creditWallet(w, 5000);
  assert.throws(
    () => createWithdrawal(w, { id: 'wd-1', amountFen: 1000, realnameApproved: true, applyCountWeek: 3 }),
    /次数/,
  );
});

test('低于 10 元（1000 分）不能提现', () => {
  const w = createWallet();
  creditWallet(w, 999);
  assert.throws(() => createWithdrawal(w, { id: 'wd-1', amountFen: 999, realnameApproved: true }), /不能低于/);
});

test('余额不足不能提现', () => {
  const w = createWallet();
  creditWallet(w, 500);
  assert.throws(() => createWithdrawal(w, { id: 'wd-1', amountFen: 1000, realnameApproved: true }), /不足/);
});

test('冻结提现后不能提现', () => {
  const w = createWallet();
  creditWallet(w, 5000);
  setWalletFreeze(w, { withdrawal: true });
  assert.throws(() => createWithdrawal(w, { id: 'wd-2', amountFen: 1000, realnameApproved: true }), /冻结/);
});

test('提交 -> 审核 -> 批准 -> 出款 -> 已打款', () => {
  const w = createWallet();
  creditWallet(w, 5000);
  const app = createWithdrawal(w, { id: 'wd-1', amountFen: 1000, realnameApproved: true });
  startWithdrawalReview(app, { reviewedBy: 'finance-1' });
  approveWithdrawal(app, { approvedBy: 'finance-1' });
  startWithdrawalPayment(app, { paidBy: 'finance-1', batchNo: 'batch-1' });
  markWithdrawalPaid(w, app);
  assert.equal(app.status, WithdrawalStatus.PAID);
  assert.equal(w.pendingWithdrawFen, 0);
  assert.equal(w.withdrawnFen, 1000);
});

test('驳回提现：冻结余额退回可用余额', () => {
  const w = createWallet();
  creditWallet(w, 5000);
  const app = createWithdrawal(w, { id: 'wd-1', amountFen: 1000, realnameApproved: true });
  rejectWithdrawal(w, app);
  assert.equal(app.status, WithdrawalStatus.REJECTED);
  assert.equal(w.pendingWithdrawFen, 0);
  assert.equal(w.availableFen, 5000);
});

test('状态机非法流转抛错：已打款/已驳回不能重复操作', () => {
  const w = createWallet();
  creditWallet(w, 5000);
  const app = createWithdrawal(w, { id: 'wd-1', amountFen: 1000, realnameApproved: true });
  startWithdrawalReview(app, { reviewedBy: 'finance-1' });
  approveWithdrawal(app, { approvedBy: 'finance-1' });
  startWithdrawalPayment(app, { paidBy: 'finance-1', batchNo: 'batch-1' });
  markWithdrawalPaid(w, app);
  assert.throws(() => markWithdrawalPaid(w, app), /状态/);
  assert.throws(() => rejectWithdrawal(w, app), /状态/);
});

test('WithdrawalStatus 为七态并保留旧状态迁移标识', () => {
  assert.deepEqual(WithdrawalStatus, {
    SUBMITTED: 'SUBMITTED', REVIEWING: 'REVIEWING', APPROVED: 'APPROVED', PAYING: 'PAYING', PAY_FAILED: 'PAY_FAILED',
    PAID: 'PAID',
    REJECTED: 'REJECTED',
    PENDING_REVIEW: 'PENDING_REVIEW',
  });
});

test('出款失败保持冻结且可重试', () => {
  const w = createWallet();
  creditWallet(w, 5000);
  const app = createWithdrawal(w, { id: 'wd-retry', amountFen: 1000, realnameApproved: true });
  startWithdrawalReview(app, { reviewedBy: 'finance-1' });
  approveWithdrawal(app, { approvedBy: 'finance-1' });
  startWithdrawalPayment(app, { paidBy: 'finance-1', batchNo: 'batch-1' });
  failWithdrawalPayment(app, { reason: '通道超时' });
  assert.equal(app.status, WithdrawalStatus.PAY_FAILED);
  assert.equal(w.pendingWithdrawFen, 1000);
  startWithdrawalPayment(app, { paidBy: 'finance-1', batchNo: 'batch-2' });
  markWithdrawalPaid(w, app);
  assert.equal(app.status, WithdrawalStatus.PAID);
});

test('扣款允许余额为负', () => {
  const w = createWallet();
  debitWallet(w, 500);
  assert.equal(w.availableFen, -500);
});
