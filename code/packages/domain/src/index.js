// 领域逻辑聚合入口：与 game-service/lib/domain.cjs（构建生成）导出面完全一致。
// 单一源：所有规则只写在 packages/domain/src/*.js，domain.cjs 由 scripts/build-domain.mjs 生成。
export {
  OrderStatus,
  CancellationStatus,
  RefundStatus,
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
  rejectCompletion,
  confirmSettlement,
  reworkOrder,
  requestOutputRefund,
  openDispute,
  resolveDisputeMaintain,
  resolveDisputeRefund,
  approveRefund,
  refundSuccess,
  refundFailed,
} from './order-machine.js';

export {
  calculateEarnings,
  calculateRefundRatio,
  calculateRefundAmount,
  calculateCommissionRecovery,
} from './commission.js';

export { resolveBrand, missingKeys } from './brand.js';

export { REDLINE_WORDS, findRedlineWord, assertNoRedline } from './redline.js';

export {
  SUPER_ADMIN_ROLES,
  resolveBrandContext,
  hasBrandAccess,
  assertBrandAccess,
} from './brand-context.js';

export {
  WithdrawalStatus,
  MIN_WITHDRAW_FEN,
  createWallet,
  creditWallet,
  debitWallet,
  setWalletFreeze,
  clearWalletFreeze,
  createWithdrawal,
  startWithdrawalReview,
  approveWithdrawal,
  startWithdrawalPayment,
  failWithdrawalPayment,
  markWithdrawalPaid,
  rejectWithdrawal,
} from './wallet.js';
