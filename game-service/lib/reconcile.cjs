'use strict';
// 支付/超时对账补偿(T0-04):微信已支付但本地订单已超时关单 → 记退款单并发起原路退款 + 告警(console.error + 通知管理员)。
const { newId } = require('./repository.cjs');

// 处理「已关单却收到延迟支付回调」:幂等(按 orderId+transactionId 去重),记 refunds 并尽力发起原路退款。
async function reconcilePaidButClosed(repo, { order, transactionId, pay, notify }) {
  const existed = await repo.findOne('refunds', { orderId: order._id, reconcileTransactionId: transactionId });
  if (existed) return existed;

  const refundDoc = {
    _id: newId('refund'),
    brandId: order.brandId || 'default',
    orderId: order._id,
    type: 'full',
    ratio: 1,
    amountFen: order.amountFen,
    reason: '支付超时关单后的延迟支付补偿退款',
    status: 'PENDING_APPROVAL',
    reconcileTransactionId: transactionId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const refund = await repo.insert('refunds', refundDoc);
  console.error(`[reconcile] 订单 ${order._id} 已关单但微信已支付 ${transactionId},已记退款单 ${refund._id}`);

  // 尽力发起原路退款:失败仅告警,不阻塞回调成功应答(退款单留待人工/重试)。
  // 注:超时关单的订单无 transactionId,退款按 out_trade_no(orderNo) 原路退回即可。
  if (pay && typeof pay.isConfigured === 'function' && pay.isConfigured()) {
    try {
      const res = await pay.refund({
        outTradeNo: order.orderNo,
        outRefundNo: `R${order.orderNo}-RC`,
        totalFen: order.amountFen,
        refundFen: order.amountFen,
        reason: '支付超时关单补偿退款',
      });
      refund.wechatRefundId = res.refundId;
      refund.status = res.status;
      await repo.updateById('refunds', refund._id, { wechatRefundId: res.refundId, status: res.status, updatedAt: Date.now() });
    } catch (e) {
      console.error(`[reconcile] 补偿退款发起失败 order=${order._id}: ${e.message}`);
    }
  }

  if (notify) await notify(repo, 'PAY_RECONCILE', { orderId: order._id, transactionId });
  return refund;
}

module.exports = { reconcilePaidButClosed };
