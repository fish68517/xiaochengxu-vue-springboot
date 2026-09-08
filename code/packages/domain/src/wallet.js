// 钱包与提现纯函数。金额单位一律为「分」（整数），余额允许为负（退款追回佣金所致）。

export const WithdrawalStatus = {
  SUBMITTED: 'SUBMITTED',
  REVIEWING: 'REVIEWING',
  APPROVED: 'APPROVED',
  PAYING: 'PAYING',
  PAY_FAILED: 'PAY_FAILED',
  PAID: 'PAID',
  REJECTED: 'REJECTED',
  // 仅供迁移旧数据识别，新单不再写入。
  PENDING_REVIEW: 'PENDING_REVIEW',
};

export const MIN_WITHDRAW_FEN = 1000;

// 周提现次数上限（可配置项，一期默认 3 次/周）。
const WEEKLY_WITHDRAW_LIMIT = 3;

function assertStatus(withdrawal, allowed, operation) {
  if (!allowed.includes(withdrawal.status)) {
    throw new Error(`提现单状态 ${withdrawal.status} 不允许执行「${operation}」`);
  }
}

// 新建钱包：version 乐观锁初始为 0。
export function createWallet() {
  return {
    availableFen: 0,
    pendingWithdrawFen: 0,
    withdrawnFen: 0,
    freezeWithdrawal: false,
    freezeAccept: false,
    version: 0,
  };
}

// 入账：仅接受正整数，增加可用余额。
export function creditWallet(wallet, amountFen) {
  if (!Number.isInteger(amountFen) || amountFen <= 0) {
    throw new Error('入账金额必须为正整数（分）');
  }
  wallet.availableFen += amountFen;
  return wallet;
}

// 扣款：减少可用余额，允许扣成负数（退款追回佣金时钱包可为负）。
export function debitWallet(wallet, amountFen) {
  if (!Number.isInteger(amountFen) || amountFen <= 0) {
    throw new Error('扣款金额必须为正整数（分）');
  }
  wallet.availableFen -= amountFen;
  return wallet;
}

export function setWalletFreeze(wallet, { withdrawal = false, accept = false } = {}) {
  if (withdrawal) wallet.freezeWithdrawal = true;
  if (accept) wallet.freezeAccept = true;
  return wallet;
}

export function clearWalletFreeze(wallet, { withdrawal = false, accept = false } = {}) {
  if (withdrawal) wallet.freezeWithdrawal = false;
  if (accept) wallet.freezeAccept = false;
  return wallet;
}

// 创建提现申请：冻结余额并生成待审批单；需实名已审核且本周次数未达上限。
export function createWithdrawal(wallet, {
  id,
  amountFen,
  minWithdrawFen = MIN_WITHDRAW_FEN,
  weeklyLimit = WEEKLY_WITHDRAW_LIMIT,
  realnameApproved = false,
  applyCountWeek = 0,
  createdAt = Date.now(),
}) {
  if (!id) throw new Error('提现单 id 不能为空');
  if (!Number.isInteger(amountFen) || amountFen <= 0) {
    throw new Error('提现金额必须为正整数（分）');
  }
  if (wallet.freezeWithdrawal) {
    throw new Error('钱包已冻结提现');
  }
  if (realnameApproved !== true) {
    throw new Error('实名未通过审核，不能提现');
  }
  if (amountFen < minWithdrawFen) {
    throw new Error(`提现金额不能低于 ${minWithdrawFen / 100} 元`);
  }
  if (applyCountWeek >= weeklyLimit) {
    throw new Error('本周提现次数已达上限');
  }
  if (amountFen > wallet.availableFen) {
    throw new Error('可用余额不足');
  }
  wallet.availableFen -= amountFen;
  wallet.pendingWithdrawFen += amountFen;
  return {
    id,
    amountFen,
    status: WithdrawalStatus.SUBMITTED,
    applyCountWeek: applyCountWeek + 1,
    createdAt,
  };
}

// 打款确认：待审批 -> 已打款（3 态模型下审核通过与打款合并），冻结余额转为已提现。
export function startWithdrawalReview(withdrawal, { reviewedBy }) {
  assertStatus(withdrawal, [WithdrawalStatus.SUBMITTED], '开始审核');
  withdrawal.status = WithdrawalStatus.REVIEWING;
  withdrawal.reviewedBy = reviewedBy;
  withdrawal.reviewStartedAt = Date.now();
  return withdrawal;
}

export function approveWithdrawal(withdrawal, { approvedBy }) {
  assertStatus(withdrawal, [WithdrawalStatus.REVIEWING], '审批通过');
  withdrawal.status = WithdrawalStatus.APPROVED;
  withdrawal.approvedBy = approvedBy;
  withdrawal.approvedAt = Date.now();
  return withdrawal;
}

export function startWithdrawalPayment(withdrawal, { paidBy, batchNo }) {
  assertStatus(withdrawal, [WithdrawalStatus.APPROVED, WithdrawalStatus.PAY_FAILED], '开始出款');
  withdrawal.status = WithdrawalStatus.PAYING;
  withdrawal.paidBy = paidBy;
  withdrawal.batchNo = batchNo;
  withdrawal.payStartedAt = Date.now();
  withdrawal.payFailReason = '';
  return withdrawal;
}

export function failWithdrawalPayment(withdrawal, { reason }) {
  assertStatus(withdrawal, [WithdrawalStatus.PAYING], '记录出款失败');
  if (!reason || !String(reason).trim()) throw new Error('出款失败原因不能为空');
  withdrawal.status = WithdrawalStatus.PAY_FAILED;
  withdrawal.payFailReason = String(reason).trim();
  withdrawal.payFailedAt = Date.now();
  return withdrawal;
}

export function markWithdrawalPaid(wallet, withdrawal) {
  assertStatus(withdrawal, [WithdrawalStatus.PAYING], '确认打款');
  if (wallet.pendingWithdrawFen < withdrawal.amountFen) {
    throw new Error('冻结提现余额不足');
  }
  wallet.pendingWithdrawFen -= withdrawal.amountFen;
  wallet.withdrawnFen += withdrawal.amountFen;
  withdrawal.status = WithdrawalStatus.PAID;
  withdrawal.paidAt = Date.now();
  return withdrawal;
}

// 驳回提现：待审批 -> 已驳回，冻结余额退回可用余额。
export function rejectWithdrawal(wallet, withdrawal) {
  assertStatus(withdrawal, [WithdrawalStatus.SUBMITTED, WithdrawalStatus.REVIEWING], '驳回');
  if (wallet.pendingWithdrawFen < withdrawal.amountFen) {
    throw new Error('冻结提现余额不足');
  }
  wallet.pendingWithdrawFen -= withdrawal.amountFen;
  wallet.availableFen += withdrawal.amountFen;
  withdrawal.status = WithdrawalStatus.REJECTED;
  withdrawal.rejectedAt = Date.now();
  return withdrawal;
}
