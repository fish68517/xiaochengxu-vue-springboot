// 订单状态机纯函数（V1.1 §3 十二状态）。变异传入的 order 并返回，前置条件不符抛中文错误。
// 状态流转留痕（order_logs）、钱包入账/追佣、微信退款回调等副作用由服务层在调用前后处理。

export const OrderStatus = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',   // 待支付
  PENDING_ACCEPT: 'PENDING_ACCEPT',     // 待受理（已支付，客服录入中）
  PENDING_GRAB: 'PENDING_GRAB',         // 待抢单（录入完成进池）
  ASSIGN_PENDING: 'ASSIGN_PENDING',     // 指派待确认
  IN_SERVICE: 'IN_SERVICE',             // 服务中（补单=子标记 reworkCount）
  PENDING_CONFIRM: 'PENDING_CONFIRM',   // 待确认（已提交完成申请，待客服核对）
  SETTLED: 'SETTLED',                   // 已结单（结单后 disputeDeadline 内可异议）
  DISPUTING: 'DISPUTING',               // 异议中
  CANCELLED: 'CANCELLED',               // 已取消（未开工取消，终态）
  REFUNDING: 'REFUNDING',               // 退款中（含两阶段，见 RefundStatus）
  REFUNDED: 'REFUNDED',                 // 已退款（终态）
  CLOSED: 'CLOSED',                     // 已关闭（支付超时，终态）
};

// 退款子阶段：承载「退款待审批 / 已发起待回调」两阶段，状态总数维持 12。
export const RefundStatus = {
  PENDING_APPROVAL: 'PENDING_APPROVAL', // 退款待审批（客服已发起、管理员审批中）
  PROCESSING: 'PROCESSING',             // 已发起待回调（审批通过、已调微信退款待回调）
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
};

// 取消申请子状态（未开工取消需管理员审批）。
export const CancellationStatus = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

export const DisputeResult = { MAINTAIN: 'MAINTAIN', PARTIAL: 'PARTIAL', FULL: 'FULL' };
export const PAYMENT_TIMEOUT_MS = 30 * 60 * 1000;      // 支付 30 分钟（V1.1 §3.5）
export const DISPUTE_WINDOW_MS = 72 * 60 * 60 * 1000;  // 异议窗口 72h（V1.1 §3.5）

// 补单次数上限（可配置项，一期默认 1）。
const DEFAULT_MAX_REWORK = 1;

function assertIn(order, allowed, operation) {
  if (!allowed.includes(order.status)) {
    throw new Error(`订单状态 ${order.status} 不允许执行「${operation}」`);
  }
}

// 创建订单：落待支付态并写入支付截止时间。
export function createOrder({
  id,
  amountFen,
  productId,
  customerId,
  contactWechat = '',
  contactPhone = '',
  productSnapshot,
  paymentTimeoutMs = PAYMENT_TIMEOUT_MS,
  createdAt = Date.now(),
}) {
  if (!id) throw new Error('订单 id 不能为空');
  if (!Number.isInteger(amountFen) || amountFen <= 0) {
    throw new Error('订单金额必须为正整数（分）');
  }
  if (!contactWechat && !contactPhone) {
    throw new Error('微信号与手机号至少填写一项');
  }
  if (!Number.isFinite(paymentTimeoutMs) || paymentTimeoutMs <= 0) throw new Error('支付超时时长必须为正数');
  return {
    id,
    amountFen,
    productId,
    customerId,
    contactWechat,
    contactPhone,
    productSnapshot,
    status: OrderStatus.PENDING_PAYMENT,
    payDeadline: createdAt + paymentTimeoutMs,
    createdAt,
    updatedAt: createdAt,
  };
}

// 判断待支付订单是否已超过支付时限。
export function isPaymentExpired(order, now) {
  if (order.status !== OrderStatus.PENDING_PAYMENT) return false;
  const deadline = order.payDeadline != null ? order.payDeadline : order.createdAt + PAYMENT_TIMEOUT_MS;
  return now >= deadline;
}

// 支付成功：待支付 -> 待受理，记录微信支付流水号与付款人 openid。
export function payOrder(order, { paidAt, transactionId, payerOpenid }) {
  assertIn(order, [OrderStatus.PENDING_PAYMENT], '支付');
  order.status = OrderStatus.PENDING_ACCEPT;
  order.paidAt = paidAt;
  order.transactionId = transactionId;
  order.payerOpenid = payerOpenid;
  order.updatedAt = paidAt;
  return order;
}

// 支付超时关单：待支付 -> 已关闭（终态）。
export function timeoutClose(order, { closedAt }) {
  assertIn(order, [OrderStatus.PENDING_PAYMENT], '超时关闭');
  if (!isPaymentExpired(order, closedAt)) {
    throw new Error('订单未超时，不能自动关闭');
  }
  order.status = OrderStatus.CLOSED;
  order.cancelReason = 'TIMEOUT';
  order.closedAt = closedAt;
  order.updatedAt = closedAt;
  return order;
}

// 发起未开工取消申请（待受理/待抢单）：挂取消审批子状态，等待管理员审批。
export function requestUnstartedCancel(order, { requestedBy, reason = '' }) {
  assertIn(order, [OrderStatus.PENDING_ACCEPT, OrderStatus.PENDING_GRAB], '发起取消申请');
  if (order.cancellation && order.cancellation.status === CancellationStatus.PENDING_REVIEW) {
    throw new Error('已存在待审核的取消申请');
  }
  order.cancellation = {
    status: CancellationStatus.PENDING_REVIEW,
    requestedBy,
    reason,
    createdAt: Date.now(),
  };
  order.updatedAt = Date.now();
  return order;
}

// 审批通过未开工取消：已取消（原路退款已随审批完成）。
export function approveUnstartedCancel(order, { approvedBy, refundedAt }) {
  assertIn(order, [OrderStatus.PENDING_ACCEPT, OrderStatus.PENDING_GRAB], '审核通过取消申请');
  if (!order.cancellation || order.cancellation.status !== CancellationStatus.PENDING_REVIEW) {
    throw new Error('没有待审核的取消申请');
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

// 驳回取消申请：订单保持原状态，取消申请标记为已驳回。
export function rejectCancellation(order, { rejectedBy }) {
  if (!order.cancellation || order.cancellation.status !== CancellationStatus.PENDING_REVIEW) {
    throw new Error('没有待审核的取消申请');
  }
  order.cancellation.status = CancellationStatus.REJECTED;
  order.cancellation.rejectedBy = rejectedBy;
  order.cancellation.rejectedAt = Date.now();
  order.updatedAt = Date.now();
  return order;
}

// 客服录入完成：待受理 -> 待抢单，写入服务信息与入池时间。
export function enterOrder(order, {
  game,
  region,
  serviceType,
  customerUid,
  customerNickname,
  expectStartAt,
  requirementNote = '',
  sessionNote = '',
  internalNote = '',
}) {
  assertIn(order, [OrderStatus.PENDING_ACCEPT], '录入');
  const missing = [];
  if (!game) missing.push('游戏');
  if (!region) missing.push('区服');
  if (!serviceType) missing.push('服务类型');
  if (!customerUid) missing.push('客户 UID');
  if (!customerNickname) missing.push('客户昵称');
  if (expectStartAt === undefined || expectStartAt === null || expectStartAt === '') missing.push('期望开始时间');
  if (missing.length) {
    throw new Error(`录入缺少必填字段：${missing.join('、')}`);
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

// 抢单：待抢单 -> 服务中；「同时进行中订单数未达上限」需查库统计，由服务层在调用前校验。
export function grabOrder(order, workerId, { maxActiveOrders } = {}) {
  assertIn(order, [OrderStatus.PENDING_GRAB], '抢单');
  if (!workerId) throw new Error('接单人员 id 不能为空');
  if (maxActiveOrders != null && (!Number.isInteger(maxActiveOrders) || maxActiveOrders < 1)) {
    throw new Error('同时进行订单上限必须为正整数');
  }
  order.status = OrderStatus.IN_SERVICE;
  order.workerId = workerId;
  order.grabbedAt = Date.now();
  order.updatedAt = Date.now();
  return order;
}

// 指派：待抢单 -> 指派待确认，锁定给指定接单人员。
export function assignOrder(order, workerId, { assignedBy }) {
  assertIn(order, [OrderStatus.PENDING_GRAB], '指派');
  if (!workerId) throw new Error('接单人员 id 不能为空');
  order.status = OrderStatus.ASSIGN_PENDING;
  order.workerId = workerId;
  order.assignedBy = assignedBy;
  order.assignedAt = Date.now();
  order.updatedAt = Date.now();
  return order;
}

// 接受指派：指派待确认 -> 服务中。
export function acceptAssignment(order, workerId) {
  assertIn(order, [OrderStatus.ASSIGN_PENDING], '接受指派');
  if (order.workerId !== workerId) {
    throw new Error('指派对象不一致，不能接受');
  }
  order.status = OrderStatus.IN_SERVICE;
  order.grabbedAt = Date.now();
  order.updatedAt = Date.now();
  return order;
}

// 拒绝指派：指派待确认 -> 待抢单（回池），清空接单人员并留痕。
export function rejectAssignment(order, workerId, { reason }) {
  assertIn(order, [OrderStatus.ASSIGN_PENDING], '拒绝指派');
  order.status = OrderStatus.PENDING_GRAB;
  order.workerId = undefined;
  order.assignmentRejectedBy = workerId;
  order.assignmentRejectReason = reason;
  order.updatedAt = Date.now();
  return order;
}

// 退单：服务中 -> 待抢单（回池），接单人员主动退单并留痕。
export function releaseOrder(order, workerId, { reason }) {
  assertIn(order, [OrderStatus.IN_SERVICE], '退单');
  if (order.workerId !== workerId) {
    throw new Error('退单人员与接单人员不一致');
  }
  order.status = OrderStatus.PENDING_GRAB;
  order.workerId = undefined;
  order.releaseReason = reason;
  order.releasedAt = Date.now();
  order.updatedAt = Date.now();
  return order;
}

// 发起服务中取消退款（比例退）：服务中 -> 退款中，进入退款待审批阶段。
export function requestServiceRefund(order, { requestedBy, ratio, reason }) {
  assertIn(order, [OrderStatus.IN_SERVICE], '发起服务中退款');
  order.status = OrderStatus.REFUNDING;
  order.refundStatus = RefundStatus.PENDING_APPROVAL;
  order.refund = { ratio, reason, requestedBy, requestedAt: Date.now() };
  order.updatedAt = Date.now();
  return order;
}

// 提交完成申请：服务中 -> 待确认，需实际产出量 + 至少一张凭证。
export function submitCompletion(order, { actualOutput, attachmentIds }) {
  assertIn(order, [OrderStatus.IN_SERVICE], '提交完成申请');
  if (typeof actualOutput !== 'number' || !Number.isFinite(actualOutput) || actualOutput < 0) {
    throw new Error('实际产出量必须为非负数');
  }
  if (!Array.isArray(attachmentIds) || attachmentIds.length < 1) {
    throw new Error('完成申请必须至少上传一张凭证');
  }
  order.status = OrderStatus.PENDING_CONFIRM;
  order.verificationStatus = 'PENDING';
  order.actualOutput = actualOutput;
  order.attachmentIds = attachmentIds;
  order.updatedAt = Date.now();
  return order;
}

// 客服/调度核对完成结果：只做核对，不结单、不入账。
export function verifyCompletion(order, { verifiedBy, note = '' }) {
  assertIn(order, [OrderStatus.PENDING_CONFIRM], '核对完成结果');
  if (order.verificationStatus === 'VERIFIED') return order;
  order.verificationStatus = 'VERIFIED';
  order.verifiedBy = verifiedBy;
  order.verifiedAt = Date.now();
  order.verificationNote = note;
  order.updatedAt = Date.now();
  return order;
}

// 核对退回：回到服务中，保留已提交凭证与完整日志。
export function rejectCompletion(order, { rejectedBy, reason }) {
  assertIn(order, [OrderStatus.PENDING_CONFIRM], '退回完成结果');
  if (!reason || !String(reason).trim()) throw new Error('退回原因不能为空');
  order.status = OrderStatus.IN_SERVICE;
  order.verificationStatus = 'REJECTED';
  order.verificationRejectedBy = rejectedBy;
  order.verificationRejectedAt = Date.now();
  order.verificationRejectReason = String(reason).trim();
  order.updatedAt = Date.now();
  return order;
}

// 结单：待确认 -> 已结单，写入结单时间与异议截止（结单 + 72h）。
export function confirmSettlement(order, { confirmedBy, customerConfirmed, disputeWindowMs = DISPUTE_WINDOW_MS }) {
  assertIn(order, [OrderStatus.PENDING_CONFIRM], '结单');
  if (order.verificationStatus !== 'VERIFIED') {
    throw new Error('结单前必须先核对完成结果');
  }
  if (customerConfirmed !== true) {
    throw new Error('结单前必须与客户确认');
  }
  if (!Number.isFinite(disputeWindowMs) || disputeWindowMs <= 0) throw new Error('异议窗口必须为正数');
  const now = Date.now();
  order.status = OrderStatus.SETTLED;
  order.confirmedBy = confirmedBy;
  order.completedAt = now;
  order.disputeDeadline = now + disputeWindowMs;
  order.updatedAt = now;
  return order;
}

// 补单：待确认 -> 服务中（补单子标记），补单次数 +1，未达上限方可补单。
export function reworkOrder(order, { reworkedBy, note, maxReworkCount = DEFAULT_MAX_REWORK }) {
  assertIn(order, [OrderStatus.PENDING_CONFIRM], '补单');
  if (!Number.isInteger(maxReworkCount) || maxReworkCount < 0) throw new Error('补单次数上限必须为非负整数');
  const reworkCount = order.reworkCount || 0;
  if (reworkCount >= maxReworkCount) {
    throw new Error('补单次数已达上限');
  }
  order.status = OrderStatus.IN_SERVICE;
  order.reworkCount = reworkCount + 1;
  order.reworkedBy = reworkedBy;
  order.reworkNote = note;
  order.updatedAt = Date.now();
  return order;
}

// 发起未达标退款（比例退）：待确认 -> 退款中，退款比例由服务层按实际/保底计算后传入。
export function requestOutputRefund(order, { requestedBy, ratio, reason }) {
  assertIn(order, [OrderStatus.PENDING_CONFIRM], '发起未达标退款');
  order.status = OrderStatus.REFUNDING;
  order.refundStatus = RefundStatus.PENDING_APPROVAL;
  order.refund = { ratio, reason, requestedBy, requestedAt: Date.now() };
  order.updatedAt = Date.now();
  return order;
}

// 发起异议：已结单 -> 异议中，须在结单后 72h 异议窗口内。
export function openDispute(order, { customerId, content }) {
  assertIn(order, [OrderStatus.SETTLED], '发起异议');
  const now = Date.now();
  if (order.disputeDeadline != null && now > order.disputeDeadline) {
    throw new Error('已超过异议窗口，不能发起异议');
  }
  if (!content) throw new Error('异议内容不能为空');
  order.status = OrderStatus.DISPUTING;
  order.dispute = { customerId, content, openedAt: now };
  order.updatedAt = now;
  return order;
}

// 异议仲裁-维持结单：异议中 -> 已结单，解除佣金冻结。
export function resolveDisputeMaintain(order, { resolvedBy, note }) {
  assertIn(order, [OrderStatus.DISPUTING], '仲裁维持结单');
  if (!note) throw new Error('仲裁备注不能为空');
  order.status = OrderStatus.SETTLED;
  order.dispute = order.dispute || {};
  order.dispute.result = DisputeResult.MAINTAIN;
  order.dispute.resultNote = note;
  order.dispute.handledBy = resolvedBy;
  order.dispute.handledAt = Date.now();
  order.updatedAt = Date.now();
  return order;
}

// 异议仲裁-部分/全额退款：异议中 -> 退款中，进入退款待审批阶段。
export function resolveDisputeRefund(order, { resolvedBy, result, note }) {
  assertIn(order, [OrderStatus.DISPUTING], '仲裁退款');
  if (![DisputeResult.PARTIAL, DisputeResult.FULL].includes(result)) {
    throw new Error('仲裁退款结果必须为部分或全额退款');
  }
  if (!note) throw new Error('仲裁备注不能为空');
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

// 审批退款：退款待审批 -> 已发起待回调（管理员通过后由服务层调用微信退款）。
export function approveRefund(order, { approvedBy }) {
  assertIn(order, [OrderStatus.REFUNDING], '审批退款');
  if (order.refundStatus !== RefundStatus.PENDING_APPROVAL) {
    throw new Error('退款不处于待审批状态');
  }
  order.refundStatus = RefundStatus.PROCESSING;
  order.refund = order.refund || {};
  order.refund.approvedBy = approvedBy;
  order.refund.approvedAt = Date.now();
  order.updatedAt = Date.now();
  return order;
}

// 退款成功：退款中 -> 已退款（终态），由微信退款回调触发。
export function refundSuccess(order, { refundedAt, refundId }) {
  assertIn(order, [OrderStatus.REFUNDING], '退款成功');
  order.status = OrderStatus.REFUNDED;
  order.refundStatus = RefundStatus.SUCCESS;
  order.refundedAt = refundedAt;
  order.refundId = refundId;
  order.updatedAt = refundedAt;
  return order;
}

// 退款失败：保持退款中，标记失败供服务层重试 + 告警。
export function refundFailed(order, { reason }) {
  assertIn(order, [OrderStatus.REFUNDING], '退款失败');
  order.refundStatus = RefundStatus.FAILED;
  order.refund = order.refund || {};
  order.refund.failReason = reason;
  order.refund.failedAt = Date.now();
  order.updatedAt = Date.now();
  return order;
}
