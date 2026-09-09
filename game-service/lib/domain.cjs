'use strict';
// 本文件由 packages/domain 构建生成（node scripts/build-domain.mjs），请勿手改。
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/domain/src/index.js
var index_exports = {};
__export(index_exports, {
  CancellationStatus: () => CancellationStatus,
  DISPUTE_WINDOW_MS: () => DISPUTE_WINDOW_MS,
  DisputeResult: () => DisputeResult,
  MIN_WITHDRAW_FEN: () => MIN_WITHDRAW_FEN,
  OrderStatus: () => OrderStatus,
  PAYMENT_TIMEOUT_MS: () => PAYMENT_TIMEOUT_MS,
  RefundStatus: () => RefundStatus,
  SUPER_ADMIN_ROLES: () => SUPER_ADMIN_ROLES,
  WithdrawalStatus: () => WithdrawalStatus,
  acceptAssignment: () => acceptAssignment,
  approveRefund: () => approveRefund,
  approveUnstartedCancel: () => approveUnstartedCancel,
  approveWithdrawal: () => approveWithdrawal,
  assertBrandAccess: () => assertBrandAccess,
  assignOrder: () => assignOrder,
  calculateCommissionRecovery: () => calculateCommissionRecovery,
  calculateEarnings: () => calculateEarnings,
  calculateRefundAmount: () => calculateRefundAmount,
  calculateRefundRatio: () => calculateRefundRatio,
  clearWalletFreeze: () => clearWalletFreeze,
  confirmSettlement: () => confirmSettlement,
  createOrder: () => createOrder,
  createWallet: () => createWallet,
  createWithdrawal: () => createWithdrawal,
  creditWallet: () => creditWallet,
  debitWallet: () => debitWallet,
  enterOrder: () => enterOrder,
  failWithdrawalPayment: () => failWithdrawalPayment,
  grabOrder: () => grabOrder,
  hasBrandAccess: () => hasBrandAccess,
  isPaymentExpired: () => isPaymentExpired,
  markWithdrawalPaid: () => markWithdrawalPaid,
  missingKeys: () => missingKeys,
  openDispute: () => openDispute,
  payOrder: () => payOrder,
  refundFailed: () => refundFailed,
  refundSuccess: () => refundSuccess,
  rejectAssignment: () => rejectAssignment,
  rejectCancellation: () => rejectCancellation,
  rejectCompletion: () => rejectCompletion,
  rejectWithdrawal: () => rejectWithdrawal,
  releaseOrder: () => releaseOrder,
  requestOutputRefund: () => requestOutputRefund,
  requestServiceRefund: () => requestServiceRefund,
  requestUnstartedCancel: () => requestUnstartedCancel,
  resolveBrand: () => resolveBrand,
  resolveBrandContext: () => resolveBrandContext,
  resolveDisputeMaintain: () => resolveDisputeMaintain,
  resolveDisputeRefund: () => resolveDisputeRefund,
  reworkOrder: () => reworkOrder,
  setWalletFreeze: () => setWalletFreeze,
  startWithdrawalPayment: () => startWithdrawalPayment,
  startWithdrawalReview: () => startWithdrawalReview,
  submitCompletion: () => submitCompletion,
  timeoutClose: () => timeoutClose,
  verifyCompletion: () => verifyCompletion
});
module.exports = __toCommonJS(index_exports);

// packages/domain/src/order-machine.js
var OrderStatus = {
  PENDING_PAYMENT: "PENDING_PAYMENT",
  // 待支付
  PENDING_ACCEPT: "PENDING_ACCEPT",
  // 待受理（已支付，客服录入中）
  PENDING_GRAB: "PENDING_GRAB",
  // 待抢单（录入完成进池）
  ASSIGN_PENDING: "ASSIGN_PENDING",
  // 指派待确认
  IN_SERVICE: "IN_SERVICE",
  // 服务中（补单=子标记 reworkCount）
  PENDING_CONFIRM: "PENDING_CONFIRM",
  // 待确认（已提交完成申请，待客服核对）
  SETTLED: "SETTLED",
  // 已结单（结单后 disputeDeadline 内可异议）
  DISPUTING: "DISPUTING",
  // 异议中
  CANCELLED: "CANCELLED",
  // 已取消（未开工取消，终态）
  REFUNDING: "REFUNDING",
  // 退款中（含两阶段，见 RefundStatus）
  REFUNDED: "REFUNDED",
  // 已退款（终态）
  CLOSED: "CLOSED"
  // 已关闭（支付超时，终态）
};
var RefundStatus = {
  PENDING_APPROVAL: "PENDING_APPROVAL",
  // 退款待审批（客服已发起、管理员审批中）
  PROCESSING: "PROCESSING",
  // 已发起待回调（审批通过、已调微信退款待回调）
  SUCCESS: "SUCCESS",
  FAILED: "FAILED"
};
var CancellationStatus = {
  PENDING_REVIEW: "PENDING_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED"
};
var DisputeResult = { MAINTAIN: "MAINTAIN", PARTIAL: "PARTIAL", FULL: "FULL" };
var PAYMENT_TIMEOUT_MS = 30 * 60 * 1e3;
var DISPUTE_WINDOW_MS = 72 * 60 * 60 * 1e3;
var DEFAULT_MAX_REWORK = 1;
function assertIn(order, allowed, operation) {
  if (!allowed.includes(order.status)) {
    throw new Error(`\u8BA2\u5355\u72B6\u6001 ${order.status} \u4E0D\u5141\u8BB8\u6267\u884C\u300C${operation}\u300D`);
  }
}
function createOrder({
  id,
  amountFen,
  productId,
  customerId,
  contactWechat = "",
  contactPhone = "",
  productSnapshot,
  createdAt = Date.now()
}) {
  if (!id) throw new Error("\u8BA2\u5355 id \u4E0D\u80FD\u4E3A\u7A7A");
  if (!Number.isInteger(amountFen) || amountFen <= 0) {
    throw new Error("\u8BA2\u5355\u91D1\u989D\u5FC5\u987B\u4E3A\u6B63\u6574\u6570\uFF08\u5206\uFF09");
  }
  if (!contactWechat && !contactPhone) {
    throw new Error("\u5FAE\u4FE1\u53F7\u4E0E\u624B\u673A\u53F7\u81F3\u5C11\u586B\u5199\u4E00\u9879");
  }
  return {
    id,
    amountFen,
    productId,
    customerId,
    contactWechat,
    contactPhone,
    productSnapshot,
    status: OrderStatus.PENDING_PAYMENT,
    payDeadline: createdAt + PAYMENT_TIMEOUT_MS,
    createdAt,
    updatedAt: createdAt
  };
}
function isPaymentExpired(order, now) {
  if (order.status !== OrderStatus.PENDING_PAYMENT) return false;
  const deadline = order.payDeadline != null ? order.payDeadline : order.createdAt + PAYMENT_TIMEOUT_MS;
  return now >= deadline;
}
function payOrder(order, { paidAt, transactionId, payerOpenid }) {
  assertIn(order, [OrderStatus.PENDING_PAYMENT], "\u652F\u4ED8");
  order.status = OrderStatus.PENDING_ACCEPT;
  order.paidAt = paidAt;
  order.transactionId = transactionId;
  order.payerOpenid = payerOpenid;
  order.updatedAt = paidAt;
  return order;
}
function timeoutClose(order, { closedAt }) {
  assertIn(order, [OrderStatus.PENDING_PAYMENT], "\u8D85\u65F6\u5173\u95ED");
  if (!isPaymentExpired(order, closedAt)) {
    throw new Error("\u8BA2\u5355\u672A\u8D85\u65F6\uFF0C\u4E0D\u80FD\u81EA\u52A8\u5173\u95ED");
  }
  order.status = OrderStatus.CLOSED;
  order.cancelReason = "TIMEOUT";
  order.closedAt = closedAt;
  order.updatedAt = closedAt;
  return order;
}
function requestUnstartedCancel(order, { requestedBy, reason = "" }) {
  assertIn(order, [OrderStatus.PENDING_ACCEPT, OrderStatus.PENDING_GRAB], "\u53D1\u8D77\u53D6\u6D88\u7533\u8BF7");
  if (order.cancellation && order.cancellation.status === CancellationStatus.PENDING_REVIEW) {
    throw new Error("\u5DF2\u5B58\u5728\u5F85\u5BA1\u6838\u7684\u53D6\u6D88\u7533\u8BF7");
  }
  order.cancellation = {
    status: CancellationStatus.PENDING_REVIEW,
    requestedBy,
    reason,
    createdAt: Date.now()
  };
  order.updatedAt = Date.now();
  return order;
}
function approveUnstartedCancel(order, { approvedBy, refundedAt }) {
  assertIn(order, [OrderStatus.PENDING_ACCEPT, OrderStatus.PENDING_GRAB], "\u5BA1\u6838\u901A\u8FC7\u53D6\u6D88\u7533\u8BF7");
  if (!order.cancellation || order.cancellation.status !== CancellationStatus.PENDING_REVIEW) {
    throw new Error("\u6CA1\u6709\u5F85\u5BA1\u6838\u7684\u53D6\u6D88\u7533\u8BF7");
  }
  order.status = OrderStatus.CANCELLED;
  order.cancelledAt = refundedAt;
  order.refundedAt = refundedAt;
  order.cancellation.status = CancellationStatus.APPROVED;
  order.cancellation.approvedBy = approvedBy;
  order.cancellation.approvedAt = refundedAt;
  order.updatedAt = refundedAt;
  return order;
}
function rejectCancellation(order, { rejectedBy }) {
  if (!order.cancellation || order.cancellation.status !== CancellationStatus.PENDING_REVIEW) {
    throw new Error("\u6CA1\u6709\u5F85\u5BA1\u6838\u7684\u53D6\u6D88\u7533\u8BF7");
  }
  order.cancellation.status = CancellationStatus.REJECTED;
  order.cancellation.rejectedBy = rejectedBy;
  order.cancellation.rejectedAt = Date.now();
  order.updatedAt = Date.now();
  return order;
}
function enterOrder(order, {
  game,
  region,
  serviceType,
  customerUid,
  customerNickname,
  expectStartAt,
  requirementNote = "",
  sessionNote = "",
  internalNote = ""
}) {
  assertIn(order, [OrderStatus.PENDING_ACCEPT], "\u5F55\u5165");
  const missing = [];
  if (!game) missing.push("\u6E38\u620F");
  if (!region) missing.push("\u533A\u670D");
  if (!serviceType) missing.push("\u670D\u52A1\u7C7B\u578B");
  if (!customerUid) missing.push("\u5BA2\u6237 UID");
  if (!customerNickname) missing.push("\u5BA2\u6237\u6635\u79F0");
  if (expectStartAt === void 0 || expectStartAt === null || expectStartAt === "") missing.push("\u671F\u671B\u5F00\u59CB\u65F6\u95F4");
  if (missing.length) {
    throw new Error(`\u5F55\u5165\u7F3A\u5C11\u5FC5\u586B\u5B57\u6BB5\uFF1A${missing.join("\u3001")}`);
  }
  order.game = game;
  order.region = region;
  order.serviceType = serviceType;
  order.customerUid = customerUid;
  order.customerNickname = customerNickname;
  order.expectStartAt = expectStartAt;
  order.requirementNote = requirementNote;
  order.sessionNote = sessionNote;
  order.internalNote = internalNote;
  order.status = OrderStatus.PENDING_GRAB;
  order.pooledAt = Date.now();
  order.updatedAt = Date.now();
  return order;
}
function grabOrder(order, workerId, { maxActiveOrders } = {}) {
  assertIn(order, [OrderStatus.PENDING_GRAB], "\u62A2\u5355");
  if (!workerId) throw new Error("\u63A5\u5355\u4EBA\u5458 id \u4E0D\u80FD\u4E3A\u7A7A");
  if (maxActiveOrders != null && (!Number.isInteger(maxActiveOrders) || maxActiveOrders < 1)) {
    throw new Error("\u540C\u65F6\u8FDB\u884C\u8BA2\u5355\u4E0A\u9650\u5FC5\u987B\u4E3A\u6B63\u6574\u6570");
  }
  order.status = OrderStatus.IN_SERVICE;
  order.workerId = workerId;
  order.grabbedAt = Date.now();
  order.updatedAt = Date.now();
  return order;
}
function assignOrder(order, workerId, { assignedBy }) {
  assertIn(order, [OrderStatus.PENDING_GRAB], "\u6307\u6D3E");
  if (!workerId) throw new Error("\u63A5\u5355\u4EBA\u5458 id \u4E0D\u80FD\u4E3A\u7A7A");
  order.status = OrderStatus.ASSIGN_PENDING;
  order.workerId = workerId;
  order.assignedBy = assignedBy;
  order.assignedAt = Date.now();
  order.updatedAt = Date.now();
  return order;
}
function acceptAssignment(order, workerId) {
  assertIn(order, [OrderStatus.ASSIGN_PENDING], "\u63A5\u53D7\u6307\u6D3E");
  if (order.workerId !== workerId) {
    throw new Error("\u6307\u6D3E\u5BF9\u8C61\u4E0D\u4E00\u81F4\uFF0C\u4E0D\u80FD\u63A5\u53D7");
  }
  order.status = OrderStatus.IN_SERVICE;
  order.grabbedAt = Date.now();
  order.updatedAt = Date.now();
  return order;
}
function rejectAssignment(order, workerId, { reason }) {
  assertIn(order, [OrderStatus.ASSIGN_PENDING], "\u62D2\u7EDD\u6307\u6D3E");
  order.status = OrderStatus.PENDING_GRAB;
  order.workerId = void 0;
  order.assignmentRejectedBy = workerId;
  order.assignmentRejectReason = reason;
  order.updatedAt = Date.now();
  return order;
}
function releaseOrder(order, workerId, { reason }) {
  assertIn(order, [OrderStatus.IN_SERVICE], "\u9000\u5355");
  if (order.workerId !== workerId) {
    throw new Error("\u9000\u5355\u4EBA\u5458\u4E0E\u63A5\u5355\u4EBA\u5458\u4E0D\u4E00\u81F4");
  }
  order.status = OrderStatus.PENDING_GRAB;
  order.workerId = void 0;
  order.releaseReason = reason;
  order.releasedAt = Date.now();
  order.updatedAt = Date.now();
  return order;
}
function requestServiceRefund(order, { requestedBy, ratio, reason }) {
  assertIn(order, [OrderStatus.IN_SERVICE], "\u53D1\u8D77\u670D\u52A1\u4E2D\u9000\u6B3E");
  order.status = OrderStatus.REFUNDING;
  order.refundStatus = RefundStatus.PENDING_APPROVAL;
  order.refund = { ratio, reason, requestedBy, requestedAt: Date.now() };
  order.updatedAt = Date.now();
  return order;
}
function submitCompletion(order, { actualOutput, attachmentIds }) {
  assertIn(order, [OrderStatus.IN_SERVICE], "\u63D0\u4EA4\u5B8C\u6210\u7533\u8BF7");
  if (typeof actualOutput !== "number" || !Number.isFinite(actualOutput) || actualOutput < 0) {
    throw new Error("\u5B9E\u9645\u4EA7\u51FA\u91CF\u5FC5\u987B\u4E3A\u975E\u8D1F\u6570");
  }
  if (!Array.isArray(attachmentIds) || attachmentIds.length < 1) {
    throw new Error("\u5B8C\u6210\u7533\u8BF7\u5FC5\u987B\u81F3\u5C11\u4E0A\u4F20\u4E00\u5F20\u51ED\u8BC1");
  }
  order.status = OrderStatus.PENDING_CONFIRM;
  order.verificationStatus = "PENDING";
  order.actualOutput = actualOutput;
  order.attachmentIds = attachmentIds;
  order.updatedAt = Date.now();
  return order;
}
function verifyCompletion(order, { verifiedBy, note = "" }) {
  assertIn(order, [OrderStatus.PENDING_CONFIRM], "\u6838\u5BF9\u5B8C\u6210\u7ED3\u679C");
  if (order.verificationStatus === "VERIFIED") return order;
  order.verificationStatus = "VERIFIED";
  order.verifiedBy = verifiedBy;
  order.verifiedAt = Date.now();
  order.verificationNote = note;
  order.updatedAt = Date.now();
  return order;
}
function rejectCompletion(order, { rejectedBy, reason }) {
  assertIn(order, [OrderStatus.PENDING_CONFIRM], "\u9000\u56DE\u5B8C\u6210\u7ED3\u679C");
  if (!reason || !String(reason).trim()) throw new Error("\u9000\u56DE\u539F\u56E0\u4E0D\u80FD\u4E3A\u7A7A");
  order.status = OrderStatus.IN_SERVICE;
  order.verificationStatus = "REJECTED";
  order.verificationRejectedBy = rejectedBy;
  order.verificationRejectedAt = Date.now();
  order.verificationRejectReason = String(reason).trim();
  order.updatedAt = Date.now();
  return order;
}
function confirmSettlement(order, { confirmedBy, customerConfirmed }) {
  assertIn(order, [OrderStatus.PENDING_CONFIRM], "\u7ED3\u5355");
  if (order.verificationStatus !== "VERIFIED") {
    throw new Error("\u7ED3\u5355\u524D\u5FC5\u987B\u5148\u6838\u5BF9\u5B8C\u6210\u7ED3\u679C");
  }
  if (customerConfirmed !== true) {
    throw new Error("\u7ED3\u5355\u524D\u5FC5\u987B\u4E0E\u5BA2\u6237\u786E\u8BA4");
  }
  const now = Date.now();
  order.status = OrderStatus.SETTLED;
  order.confirmedBy = confirmedBy;
  order.completedAt = now;
  order.disputeDeadline = now + DISPUTE_WINDOW_MS;
  order.updatedAt = now;
  return order;
}
function reworkOrder(order, { reworkedBy, note }) {
  assertIn(order, [OrderStatus.PENDING_CONFIRM], "\u8865\u5355");
  const reworkCount = order.reworkCount || 0;
  if (reworkCount >= DEFAULT_MAX_REWORK) {
    throw new Error("\u8865\u5355\u6B21\u6570\u5DF2\u8FBE\u4E0A\u9650");
  }
  order.status = OrderStatus.IN_SERVICE;
  order.reworkCount = reworkCount + 1;
  order.reworkedBy = reworkedBy;
  order.reworkNote = note;
  order.updatedAt = Date.now();
  return order;
}
function requestOutputRefund(order, { requestedBy, ratio, reason }) {
  assertIn(order, [OrderStatus.PENDING_CONFIRM], "\u53D1\u8D77\u672A\u8FBE\u6807\u9000\u6B3E");
  order.status = OrderStatus.REFUNDING;
  order.refundStatus = RefundStatus.PENDING_APPROVAL;
  order.refund = { ratio, reason, requestedBy, requestedAt: Date.now() };
  order.updatedAt = Date.now();
  return order;
}
function openDispute(order, { customerId, content }) {
  assertIn(order, [OrderStatus.SETTLED], "\u53D1\u8D77\u5F02\u8BAE");
  const now = Date.now();
  if (order.disputeDeadline != null && now > order.disputeDeadline) {
    throw new Error("\u5DF2\u8D85\u8FC7\u5F02\u8BAE\u7A97\u53E3\uFF0C\u4E0D\u80FD\u53D1\u8D77\u5F02\u8BAE");
  }
  if (!content) throw new Error("\u5F02\u8BAE\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A");
  order.status = OrderStatus.DISPUTING;
  order.dispute = { customerId, content, openedAt: now };
  order.updatedAt = now;
  return order;
}
function resolveDisputeMaintain(order, { resolvedBy, note }) {
  assertIn(order, [OrderStatus.DISPUTING], "\u4EF2\u88C1\u7EF4\u6301\u7ED3\u5355");
  if (!note) throw new Error("\u4EF2\u88C1\u5907\u6CE8\u4E0D\u80FD\u4E3A\u7A7A");
  order.status = OrderStatus.SETTLED;
  order.dispute = order.dispute || {};
  order.dispute.result = DisputeResult.MAINTAIN;
  order.dispute.resultNote = note;
  order.dispute.handledBy = resolvedBy;
  order.dispute.handledAt = Date.now();
  order.updatedAt = Date.now();
  return order;
}
function resolveDisputeRefund(order, { resolvedBy, result, note }) {
  assertIn(order, [OrderStatus.DISPUTING], "\u4EF2\u88C1\u9000\u6B3E");
  if (![DisputeResult.PARTIAL, DisputeResult.FULL].includes(result)) {
    throw new Error("\u4EF2\u88C1\u9000\u6B3E\u7ED3\u679C\u5FC5\u987B\u4E3A\u90E8\u5206\u6216\u5168\u989D\u9000\u6B3E");
  }
  if (!note) throw new Error("\u4EF2\u88C1\u5907\u6CE8\u4E0D\u80FD\u4E3A\u7A7A");
  order.status = OrderStatus.REFUNDING;
  order.refundStatus = RefundStatus.PENDING_APPROVAL;
  order.dispute = order.dispute || {};
  order.dispute.result = result;
  order.dispute.resultNote = note;
  order.dispute.handledBy = resolvedBy;
  order.dispute.handledAt = Date.now();
  order.updatedAt = Date.now();
  return order;
}
function approveRefund(order, { approvedBy }) {
  assertIn(order, [OrderStatus.REFUNDING], "\u5BA1\u6279\u9000\u6B3E");
  if (order.refundStatus !== RefundStatus.PENDING_APPROVAL) {
    throw new Error("\u9000\u6B3E\u4E0D\u5904\u4E8E\u5F85\u5BA1\u6279\u72B6\u6001");
  }
  order.refundStatus = RefundStatus.PROCESSING;
  order.refund = order.refund || {};
  order.refund.approvedBy = approvedBy;
  order.refund.approvedAt = Date.now();
  order.updatedAt = Date.now();
  return order;
}
function refundSuccess(order, { refundedAt, refundId }) {
  assertIn(order, [OrderStatus.REFUNDING], "\u9000\u6B3E\u6210\u529F");
  order.status = OrderStatus.REFUNDED;
  order.refundStatus = RefundStatus.SUCCESS;
  order.refundedAt = refundedAt;
  order.refundId = refundId;
  order.updatedAt = refundedAt;
  return order;
}
function refundFailed(order, { reason }) {
  assertIn(order, [OrderStatus.REFUNDING], "\u9000\u6B3E\u5931\u8D25");
  order.refundStatus = RefundStatus.FAILED;
  order.refund = order.refund || {};
  order.refund.failReason = reason;
  order.refund.failedAt = Date.now();
  order.updatedAt = Date.now();
  return order;
}

// packages/domain/src/commission.js
function calculateEarnings({ amountFen, commission }) {
  if (!Number.isInteger(amountFen) || amountFen <= 0) {
    throw new Error("\u8BA2\u5355\u91D1\u989D\u5FC5\u987B\u4E3A\u6B63\u6574\u6570\uFF08\u5206\uFF09");
  }
  if (!commission) {
    throw new Error("\u7F3A\u5C11\u62BD\u6210\u914D\u7F6E");
  }
  if (commission.type === "fixed") {
    if (!Number.isInteger(commission.valueFen) || commission.valueFen < 0) {
      throw new Error("\u56FA\u5B9A\u62BD\u6210\u5FC5\u987B\u4E3A\u975E\u8D1F\u6574\u6570\uFF08\u5206\uFF09");
    }
    return commission.valueFen;
  }
  if (commission.type === "percent") {
    if (typeof commission.valuePercent !== "number" || commission.valuePercent < 0 || commission.valuePercent > 100) {
      throw new Error("\u767E\u5206\u6BD4\u62BD\u6210\u5FC5\u987B\u5728 0-100 \u4E4B\u95F4");
    }
    return Math.round(amountFen * commission.valuePercent / 100);
  }
  throw new Error("\u672A\u77E5\u62BD\u6210\u7C7B\u578B");
}
function calculateRefundRatio({ actualOutput, guaranteedOutput }) {
  if (!(guaranteedOutput > 0)) return 0;
  const delivered = Math.min(1, Math.max(0, actualOutput / guaranteedOutput));
  return Math.round((1 - delivered) * 1e6) / 1e6;
}
function calculateRefundAmount({ amountFen, ratio }) {
  return Math.round(amountFen * ratio);
}
function calculateCommissionRecovery({ earningsFen }) {
  return earningsFen;
}

// packages/domain/src/brand.js
function resolveBrand(brands, appId) {
  const list = Array.isArray(brands) ? brands : [];
  if (list.length === 0) return null;
  if (appId) {
    const exact = list.find((b) => b && b.appId === appId);
    if (exact) return exact;
  }
  const preferred = list.find((b) => b && b.status === "ON" && b.isDefault);
  if (preferred) return preferred;
  return list[0];
}
function missingKeys(copy, defaults) {
  const c = copy && typeof copy === "object" ? copy : {};
  const d = defaults && typeof defaults === "object" ? defaults : {};
  return Object.keys(d).filter((key) => {
    const value = c[key];
    if (value === void 0 || value === null) return true;
    if (typeof value === "string" && value.trim() === "") return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  });
}

// packages/domain/src/brand-context.js
var SUPER_ADMIN_ROLES = /* @__PURE__ */ new Set(["SUPER_ADMIN", "ADMIN"]);
function resolveBrandContext(brands, {
  brandCode = "",
  appId = "",
  allowDefault = false
} = {}) {
  const enabled = (Array.isArray(brands) ? brands : []).filter((brand2) => brand2 && ["ON", "ACTIVE"].includes(brand2.status));
  const byCode = brandCode ? enabled.find((brand2) => brand2.code === brandCode || brand2.brandId === brandCode) : null;
  const byAppId = appId ? enabled.find((brand2) => brand2.appId === appId || Array.isArray(brand2.appIds) && brand2.appIds.includes(appId)) : null;
  if (brandCode && !byCode) throw new Error("UNKNOWN_BRAND");
  if (appId && !byAppId) throw new Error("UNKNOWN_BRAND_CHANNEL");
  if (byCode && byAppId && byCode.brandId !== byAppId.brandId) throw new Error("BRAND_CHANNEL_MISMATCH");
  const brand = byCode || byAppId || (allowDefault ? enabled.find((item) => item.isDefault) : null);
  if (!brand) throw new Error("BRAND_CONTEXT_REQUIRED");
  return {
    brandId: brand.brandId,
    brandCode: brand.code || brand.brandId,
    appId: appId || brand.appId || "",
    version: brand.publishedVersion || brand.version || 1
  };
}
function hasBrandAccess(session, brandId) {
  if (!session || !brandId) return false;
  const roles = new Set([session.role, ...Array.isArray(session.roles) ? session.roles : []].filter(Boolean));
  if ([...roles].some((role) => SUPER_ADMIN_ROLES.has(role))) return true;
  const scopes = Array.isArray(session.brandScopes) ? session.brandScopes : [];
  return scopes.includes("*") || scopes.includes(brandId);
}
function assertBrandAccess(session, brandId) {
  if (!hasBrandAccess(session, brandId)) throw new Error("BRAND_FORBIDDEN");
  return true;
}

// packages/domain/src/wallet.js
var WithdrawalStatus = {
  SUBMITTED: "SUBMITTED",
  REVIEWING: "REVIEWING",
  APPROVED: "APPROVED",
  PAYING: "PAYING",
  PAY_FAILED: "PAY_FAILED",
  PAID: "PAID",
  REJECTED: "REJECTED",
  // 仅供迁移旧数据识别，新单不再写入。
  PENDING_REVIEW: "PENDING_REVIEW"
};
var MIN_WITHDRAW_FEN = 1e3;
var WEEKLY_WITHDRAW_LIMIT = 3;
function assertStatus(withdrawal, allowed, operation) {
  if (!allowed.includes(withdrawal.status)) {
    throw new Error(`\u63D0\u73B0\u5355\u72B6\u6001 ${withdrawal.status} \u4E0D\u5141\u8BB8\u6267\u884C\u300C${operation}\u300D`);
  }
}
function createWallet() {
  return {
    availableFen: 0,
    pendingWithdrawFen: 0,
    withdrawnFen: 0,
    freezeWithdrawal: false,
    freezeAccept: false,
    version: 0
  };
}
function creditWallet(wallet, amountFen) {
  if (!Number.isInteger(amountFen) || amountFen <= 0) {
    throw new Error("\u5165\u8D26\u91D1\u989D\u5FC5\u987B\u4E3A\u6B63\u6574\u6570\uFF08\u5206\uFF09");
  }
  wallet.availableFen += amountFen;
  return wallet;
}
function debitWallet(wallet, amountFen) {
  if (!Number.isInteger(amountFen) || amountFen <= 0) {
    throw new Error("\u6263\u6B3E\u91D1\u989D\u5FC5\u987B\u4E3A\u6B63\u6574\u6570\uFF08\u5206\uFF09");
  }
  wallet.availableFen -= amountFen;
  return wallet;
}
function setWalletFreeze(wallet, { withdrawal = false, accept = false } = {}) {
  if (withdrawal) wallet.freezeWithdrawal = true;
  if (accept) wallet.freezeAccept = true;
  return wallet;
}
function clearWalletFreeze(wallet, { withdrawal = false, accept = false } = {}) {
  if (withdrawal) wallet.freezeWithdrawal = false;
  if (accept) wallet.freezeAccept = false;
  return wallet;
}
function createWithdrawal(wallet, {
  id,
  amountFen,
  minWithdrawFen = MIN_WITHDRAW_FEN,
  weeklyLimit = WEEKLY_WITHDRAW_LIMIT,
  realnameApproved = false,
  applyCountWeek = 0,
  createdAt = Date.now()
}) {
  if (!id) throw new Error("\u63D0\u73B0\u5355 id \u4E0D\u80FD\u4E3A\u7A7A");
  if (!Number.isInteger(amountFen) || amountFen <= 0) {
    throw new Error("\u63D0\u73B0\u91D1\u989D\u5FC5\u987B\u4E3A\u6B63\u6574\u6570\uFF08\u5206\uFF09");
  }
  if (wallet.freezeWithdrawal) {
    throw new Error("\u94B1\u5305\u5DF2\u51BB\u7ED3\u63D0\u73B0");
  }
  if (realnameApproved !== true) {
    throw new Error("\u5B9E\u540D\u672A\u901A\u8FC7\u5BA1\u6838\uFF0C\u4E0D\u80FD\u63D0\u73B0");
  }
  if (amountFen < minWithdrawFen) {
    throw new Error(`\u63D0\u73B0\u91D1\u989D\u4E0D\u80FD\u4F4E\u4E8E ${minWithdrawFen / 100} \u5143`);
  }
  if (applyCountWeek >= weeklyLimit) {
    throw new Error("\u672C\u5468\u63D0\u73B0\u6B21\u6570\u5DF2\u8FBE\u4E0A\u9650");
  }
  if (amountFen > wallet.availableFen) {
    throw new Error("\u53EF\u7528\u4F59\u989D\u4E0D\u8DB3");
  }
  wallet.availableFen -= amountFen;
  wallet.pendingWithdrawFen += amountFen;
  return {
    id,
    amountFen,
    status: WithdrawalStatus.SUBMITTED,
    applyCountWeek: applyCountWeek + 1,
    createdAt
  };
}
function startWithdrawalReview(withdrawal, { reviewedBy }) {
  assertStatus(withdrawal, [WithdrawalStatus.SUBMITTED], "\u5F00\u59CB\u5BA1\u6838");
  withdrawal.status = WithdrawalStatus.REVIEWING;
  withdrawal.reviewedBy = reviewedBy;
  withdrawal.reviewStartedAt = Date.now();
  return withdrawal;
}
function approveWithdrawal(withdrawal, { approvedBy }) {
  assertStatus(withdrawal, [WithdrawalStatus.REVIEWING], "\u5BA1\u6279\u901A\u8FC7");
  withdrawal.status = WithdrawalStatus.APPROVED;
  withdrawal.approvedBy = approvedBy;
  withdrawal.approvedAt = Date.now();
  return withdrawal;
}
function startWithdrawalPayment(withdrawal, { paidBy, batchNo }) {
  assertStatus(withdrawal, [WithdrawalStatus.APPROVED, WithdrawalStatus.PAY_FAILED], "\u5F00\u59CB\u51FA\u6B3E");
  withdrawal.status = WithdrawalStatus.PAYING;
  withdrawal.paidBy = paidBy;
  withdrawal.batchNo = batchNo;
  withdrawal.payStartedAt = Date.now();
  withdrawal.payFailReason = "";
  return withdrawal;
}
function failWithdrawalPayment(withdrawal, { reason }) {
  assertStatus(withdrawal, [WithdrawalStatus.PAYING], "\u8BB0\u5F55\u51FA\u6B3E\u5931\u8D25");
  if (!reason || !String(reason).trim()) throw new Error("\u51FA\u6B3E\u5931\u8D25\u539F\u56E0\u4E0D\u80FD\u4E3A\u7A7A");
  withdrawal.status = WithdrawalStatus.PAY_FAILED;
  withdrawal.payFailReason = String(reason).trim();
  withdrawal.payFailedAt = Date.now();
  return withdrawal;
}
function markWithdrawalPaid(wallet, withdrawal) {
  assertStatus(withdrawal, [WithdrawalStatus.PAYING], "\u786E\u8BA4\u6253\u6B3E");
  if (wallet.pendingWithdrawFen < withdrawal.amountFen) {
    throw new Error("\u51BB\u7ED3\u63D0\u73B0\u4F59\u989D\u4E0D\u8DB3");
  }
  wallet.pendingWithdrawFen -= withdrawal.amountFen;
  wallet.withdrawnFen += withdrawal.amountFen;
  withdrawal.status = WithdrawalStatus.PAID;
  withdrawal.paidAt = Date.now();
  return withdrawal;
}
function rejectWithdrawal(wallet, withdrawal) {
  assertStatus(withdrawal, [WithdrawalStatus.SUBMITTED, WithdrawalStatus.REVIEWING], "\u9A73\u56DE");
  if (wallet.pendingWithdrawFen < withdrawal.amountFen) {
    throw new Error("\u51BB\u7ED3\u63D0\u73B0\u4F59\u989D\u4E0D\u8DB3");
  }
  wallet.pendingWithdrawFen -= withdrawal.amountFen;
  wallet.availableFen += withdrawal.amountFen;
  withdrawal.status = WithdrawalStatus.REJECTED;
  withdrawal.rejectedAt = Date.now();
  return withdrawal;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CancellationStatus,
  DISPUTE_WINDOW_MS,
  DisputeResult,
  MIN_WITHDRAW_FEN,
  OrderStatus,
  PAYMENT_TIMEOUT_MS,
  RefundStatus,
  SUPER_ADMIN_ROLES,
  WithdrawalStatus,
  acceptAssignment,
  approveRefund,
  approveUnstartedCancel,
  approveWithdrawal,
  assertBrandAccess,
  assignOrder,
  calculateCommissionRecovery,
  calculateEarnings,
  calculateRefundAmount,
  calculateRefundRatio,
  clearWalletFreeze,
  confirmSettlement,
  createOrder,
  createWallet,
  createWithdrawal,
  creditWallet,
  debitWallet,
  enterOrder,
  failWithdrawalPayment,
  grabOrder,
  hasBrandAccess,
  isPaymentExpired,
  markWithdrawalPaid,
  missingKeys,
  openDispute,
  payOrder,
  refundFailed,
  refundSuccess,
  rejectAssignment,
  rejectCancellation,
  rejectCompletion,
  rejectWithdrawal,
  releaseOrder,
  requestOutputRefund,
  requestServiceRefund,
  requestUnstartedCancel,
  resolveBrand,
  resolveBrandContext,
  resolveDisputeMaintain,
  resolveDisputeRefund,
  reworkOrder,
  setWalletFreeze,
  startWithdrawalPayment,
  startWithdrawalReview,
  submitCompletion,
  timeoutClose,
  verifyCompletion
});
