'use strict';
const { createHash, randomUUID } = require('node:crypto');
const Pay = require('./wechat-pay.cjs');
const { resolvePaymentConfig } = require('./payment-config.cjs');
const F = require('./commercial-finance.cjs');
const D = require('./domain.cjs');
const { reconcilePaidButClosed } = require('./reconcile.cjs');
function clientFor(order, secretRef = '') {
  if (globalThis.__PAY_CLIENT__ && !['staging', 'production'].includes(process.env.APP_ENV)) return { client: globalThis.__PAY_CLIENT__, snapshot: {} };
  if (!process.env.WECHAT_PAY_CONFIG_MAP && !['staging', 'production'].includes(process.env.APP_ENV)) return { client: Pay.createClient(), snapshot: {} };
  const config = resolvePaymentConfig({ brandCode: order.brandSnapshot?.brandCode || order.brandId || 'default', secretRef });
  return { client: Pay.createClient({ env: config.env }), snapshot: config.snapshot };
}
async function decodeNotification(payload) {
  if (globalThis.__PAY_CLIENT__ && !['staging', 'production'].includes(process.env.APP_ENV)) {
    if (!globalThis.__PAY_CLIENT__.isConfigured?.()) throw new Error('微信支付未配置');
    return { event: await globalThis.__PAY_CLIENT__.handleNotify(payload), client: globalThis.__PAY_CLIENT__, snapshot: {} };
  }
  if (!process.env.WECHAT_PAY_CONFIG_MAP && !['staging', 'production'].includes(process.env.APP_ENV)) { const client = Pay.createClient(); if (!client.isConfigured()) throw new Error('微信支付未配置'); return { event: await client.handleNotify(payload), client, snapshot: {} }; }
  const brands = JSON.parse(process.env.WECHAT_PAY_CONFIG_MAP || '{}')[process.env.APP_ENV] || {};
  // 不信任URL传入品牌，依次使用获准品牌配置验签/解密；匹配成功后还要校验订单快照。
  for (const brandCode of Object.keys(brands).slice(0, 50)) {
    try { const config = resolvePaymentConfig({ brandCode }); const client = Pay.createClient({ env: config.env }); const event = await client.handleNotify(payload); return { event, client, snapshot: config.snapshot }; } catch (_) { /* 换下一个受控商户，禁止输出密文或Secret */ }
  }
  throw new Error('支付通知验签或品牌校验失败');
}
async function applyRefundResult(repo, refund, event) {
  if (event.amount && (Number(event.amount.refund) !== refund.amountFen || (event.amount.currency && event.amount.currency !== 'CNY'))) throw new Error('退款通知金额或币种不一致');
  return repo.transaction(async (tr) => {
    const current = await tr.getById('refunds', refund._id);
    if (current.status === 'SUCCESS') return { duplicate: true };
    const order = await tr.getById('orders', current.orderId);
    const status = event.refundStatus || 'SUCCESS';
    if (status !== 'SUCCESS') { await tr.updateById('refunds', current._id, { status: status === 'CLOSED' ? 'CLOSED' : 'ABNORMAL', updatedAt: Date.now() }); return { status }; }
    const clone = JSON.parse(JSON.stringify(order));
    if (clone.status === D.OrderStatus.REFUNDING) D.refundSuccess(clone, { refundedAt: Date.now(), refundId: event.refundId });
    else if (current.type === 'full' && clone.cancellation?.status === D.CancellationStatus.PENDING_REVIEW) D.approveUnstartedCancel(clone, { approvedBy: current.approvedBy, refundedAt: Date.now() });
    const recovery = current.type !== 'full' && order.earningsFen > 0 ? D.calculateCommissionRecovery({ earningsFen: order.earningsFen }) : 0;
    if (recovery && !current.commissionRecoveredFen) {
      const wallet = await tr.findOne('wallets', { ownerId: order.workerId });
      if (!wallet) throw new Error('退款佣金追回钱包不存在');
      D.debitWallet(wallet, recovery);
      await tr.updateById('wallets', wallet._id, { availableFen: wallet.availableFen, version: (wallet.version || 0) + 1, updatedAt: Date.now() });
      await tr.insert('wallet_transactions', { _id: `refund-clawback-${current._id}`, brandId: order.brandId, walletId: wallet._id, accountId: order.workerId, type: 'REFUND_CLAWBACK', amountFen: -recovery, balanceAfterFen: wallet.availableFen, refId: current._id, refundId: current._id, orderId: order._id, status: 'POSTED', createdAt: Date.now() });
    }
    await tr.updateById('orders', order._id, clone);
    await tr.updateById('refunds', current._id, { status: 'SUCCESS', wechatRefundId: event.refundId, commissionRecoveredFen: recovery || current.commissionRecoveredFen || 0, updatedAt: Date.now() });
    return { status: 'SUCCESS' };
  });
}
async function applyEvent(repo, { event, client, snapshot }, completePayment) {
  const order = await repo.findOne('orders', { orderNo: event.outTradeNo });
  if (!order) throw new Error('支付通知关联订单不存在');
  if (snapshot.brandCode && snapshot.brandCode !== (order.brandSnapshot?.brandCode || order.brandId)) throw new Error('支付通知品牌不一致');
  let payment = order.paymentId ? await repo.getById('payments', order.paymentId) : null;
  if (!payment && !['staging', 'production'].includes(process.env.APP_ENV)) {
    payment = await repo.insert('payments', {
      _id: `payment-${createHash('sha256').update(order._id).digest('hex').slice(0, 24)}`,
      brandId: order.brandId || 'default', orderId: order._id, paymentNo: `P${order.orderNo}`,
      amountFen: order.amountFen, currency: 'CNY', status: 'PENDING', createdAt: Date.now(), updatedAt: Date.now(),
    });
    await repo.updateById('orders', order._id, { paymentId: payment._id, paymentStatus: payment.status, updatedAt: Date.now() });
  }
  if (!payment) throw new Error('支付通知关联支付单不存在');
  if (event.mchid && payment.configSnapshot?.mchid && event.mchid !== payment.configSnapshot.mchid) throw new Error('支付通知商户不一致');
  if (event.appid && payment.configSnapshot?.appId && event.appid !== payment.configSnapshot.appId) throw new Error('支付通知AppID不一致');
  if (event.eventType === 'TRANSACTION.SUCCESS') {
    if (event.amount?.currency && event.amount.currency !== 'CNY') throw new Error('支付币种不一致');
    if (Number(event.amount?.total) !== payment.amountFen || payment.amountFen !== order.amountFen || payment.brandId !== order.brandId) throw new Error('支付金额不一致或品牌与订单不一致');
    if (order.status === 'CLOSED') {
      await repo.updateById('payments', payment._id, { status: 'SUCCESS', providerTransactionId: event.transactionId, paidAt: Date.now(), updatedAt: Date.now() });
      return reconcilePaidButClosed(repo, { order, transactionId: event.transactionId, pay: client });
    }
    return completePayment(repo, payment, { transactionId: event.transactionId, amountFen: event.amount.total, brandId: payment.brandId });
  }
  if (event.eventType.startsWith('REFUND.')) {
    const refund = (event.outRefundNo && await repo.findOne('refunds', { outRefundNo: event.outRefundNo })) || await repo.findOne('refunds', { wechatRefundId: event.refundId });
    if (!refund || refund.orderId !== order._id || refund.brandId !== order.brandId || refund.paymentId !== payment._id) throw new Error('退款通知关联支付单不一致');
    return applyRefundResult(repo, refund, event);
  }
  return { ignored: true };
}
async function payNotify(repo, payload, completePayment) {
  const decoded = await decodeNotification(payload);
  if (decoded.event.eventType === 'IGNORED') return { code: 'SUCCESS', message: '已忽略' };
  const id = createHash('sha256').update(`${decoded.snapshot.mchid || 'dev'}:${decoded.event.eventId || JSON.stringify(decoded.event)}`).digest('hex');
  let record = await repo.getById('payment_events', id);
  if (record?.status === 'DONE') return { code: 'SUCCESS', duplicate: true };
  if (!record) record = await repo.insert('payment_events', { _id: id, eventType: decoded.event.eventType, orderNo: decoded.event.outTradeNo, status: 'PENDING', attempts: 0, nextRetryAt: Date.now(), createdAt: Date.now() });
  try {
    await applyEvent(repo, decoded, completePayment);
    await repo.updateById('payment_events', id, { status: 'DONE', attempts: record.attempts + 1, updatedAt: Date.now() });
    return { code: 'SUCCESS', message: '成功' };
  } catch (error) {
    await repo.updateById('payment_events', id, { status: 'RETRY', attempts: record.attempts + 1, nextRetryAt: Date.now() + 60000, errorCode: 'PAYMENT_APPLY_FAILED', updatedAt: Date.now() });
    throw error;
  }
}
async function approveRefund(repo, { refundId }, session) {
  const refund = await repo.getById('refunds', refundId); if (!refund) throw new Error('退款单不存在');
  if (refund.status === 'SUCCESS' || refund.status === 'PROCESSING') return refund;
  if (refund.status !== 'PENDING_APPROVAL') throw new Error('退款单已处理');
  const order = await repo.getById('orders', refund.orderId);
  const payment = await repo.getById('payments', refund.paymentId);
  if (!order || !payment || payment.orderId !== order._id || payment.status !== 'SUCCESS' || payment.amountFen !== order.amountFen || payment.brandId !== order.brandId) throw new Error('退款关联支付单校验失败');
  F.assertRefundApproval(refund, session);
  const outRefundNo = refund.outRefundNo || `R${createHash('sha256').update(refundId).digest('hex').slice(0, 40)}`;
  await repo.transaction(async (tr) => {
    F.assertRefundBudget(payment, await tr.find('refunds', { paymentId: payment._id }), refund);
    const claimed = await tr.updateWhere('refunds', { _id: refundId, status: 'PENDING_APPROVAL' }, { status: 'PROCESSING', outRefundNo, approvedBy: session.userId, updatedAt: Date.now() });
    if (claimed.updated !== 1) throw new Error('退款审批已被处理');
  });
  try {
    const { client } = clientFor(order, payment.secretRef);
    const response = await client.refund({ outTradeNo: order.orderNo, outRefundNo, totalFen: payment.amountFen, refundFen: refund.amountFen, reason: refund.reason });
    await repo.updateById('refunds', refundId, { wechatRefundId: response.refundId, providerStatus: response.status, updatedAt: Date.now() });
    if (response.status === 'SUCCESS') await applyRefundResult(repo, refund, { refundId: response.refundId, refundStatus: 'SUCCESS', amount: { refund: refund.amountFen, currency: 'CNY' } });
    else if (refund.type !== 'full') { const clone = JSON.parse(JSON.stringify(order)); D.approveRefund(clone, { approvedBy: session.userId }); await repo.updateById('orders', order._id, clone); }
  } catch (error) {
    const remote = ['staging', 'production'].includes(process.env.APP_ENV);
    await repo.updateById('refunds', refundId, {
      status: remote ? 'PROCESSING' : 'PENDING_APPROVAL',
      queryRequired: remote,
      lastErrorCode: remote ? 'REFUND_PROVIDER_UNCERTAIN' : 'REFUND_PROVIDER_FAILED',
      updatedAt: Date.now(),
    });
    throw error;
  }
  return repo.getById('refunds', refundId);
}
async function compensatePayments(repo, { limit = 50 } = {}, session, completePayment) {
  if (session?.role !== 'SYSTEM') throw new Error('仅系统可执行支付补偿');
  const count = Math.min(100, Math.max(1, Number(limit) || 50)); const results = [];
  const pending = (await repo.find('payments', {})).filter((p) => ['PENDING', 'PROCESSING'].includes(p.status)).slice(0, count);
  for (const payment of pending) {
    try {
      const order = await repo.getById('orders', payment.orderId); const { client, snapshot } = clientFor(order, payment.secretRef);
      const state = await client.queryTransaction({ outTradeNo: order.orderNo });
      if (state.trade_state === 'SUCCESS') await applyEvent(repo, { client, snapshot, event: { eventType: 'TRANSACTION.SUCCESS', outTradeNo: state.out_trade_no, transactionId: state.transaction_id, mchid: state.mchid, appid: state.appid, amount: state.amount } }, completePayment);
      else if (['CLOSED', 'REVOKED', 'PAYERROR'].includes(state.trade_state)) await repo.updateById('payments', payment._id, { status: state.trade_state === 'PAYERROR' ? 'FAILED' : 'CLOSED', updatedAt: Date.now() });
      results.push({ paymentId: payment._id, ok: true });
    } catch (_) { results.push({ paymentId: payment._id, ok: false }); }
  }
  for (const refund of (await repo.find('refunds', { status: 'PROCESSING' })).slice(0, count)) {
    try { const order = await repo.getById('orders', refund.orderId); const { client } = clientFor(order); const state = await client.queryRefund({ outRefundNo: refund.outRefundNo }); if (state.out_trade_no !== order.orderNo || Number(state.amount?.refund) !== refund.amountFen) throw new Error('退款查单不一致'); await applyRefundResult(repo, refund, { refundStatus: state.status, refundId: state.refund_id, amount: state.amount }); results.push({ refundId: refund._id, ok: true }); } catch (_) { results.push({ refundId: refund._id, ok: false }); }
  }
  await repo.insert('audit_logs', { _id: randomUUID(), action: 'compensatePayments', operatorRole: 'SYSTEM', operatorId: session.userId, after: { checked: results.length, failed: results.filter((r) => !r.ok).length }, createdAt: Date.now() });
  return { checked: results.length, results };
}
module.exports = { clientFor, payNotify, approveRefund, compensatePayments, applyRefundResult };
