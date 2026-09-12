'use strict';
const D = require('./domain.cjs');
const Ops = require('./commercial-ops.cjs');
const Payment = require('./payment-operations.cjs');
const { paymentLog, failureCode } = require('./payment-log.cjs');

function fail(code, message) { throw Object.assign(new Error(message), { code }); }

async function ownedOrder(repo, orderId, session) {
  if (session?.role !== 'CUSTOMER' || !session.openid) fail('UNAUTHORIZED', '请重新登录小程序');
  const order = await repo.getById('orders', orderId);
  if (!order || !order.customerId || order.customerId !== session.openid || !(session.brandScopes || []).includes(order.brandId || 'default')) {
    fail('FORBIDDEN', '无权操作该订单');
  }
  return order;
}

function createMiniPaymentServices({ ensurePayment, completePayment, paymentMode }) {
  async function getMiniPaymentStatus(repo, { orderId }, session) {
    let order = await ownedOrder(repo, orderId, session);
    paymentLog('query:start', { orderNo: order.orderNo, orderId, orderStatus: order.status });
    let payment = order.paymentId ? await repo.getById('payments', order.paymentId) : null;
    if (payment && (payment.orderId !== order._id || payment.brandId !== order.brandId || payment.amountFen !== order.amountFen)) fail('PAYMENT_MISMATCH', '订单支付记录不匹配');
    if (payment && (['PENDING', 'PROCESSING', 'UNKNOWN'].includes(payment.status) || payment.status === 'SUCCESS' && order.status === D.OrderStatus.PENDING_PAYMENT) && paymentMode() === 'wechat') {
      const { client, snapshot } = Payment.clientFor(order, payment.secretRef, payment.configSnapshot?.appId || '');
      try {
        const state = await client.queryTransaction({ outTradeNo: order.orderNo });
        paymentLog('query:wechat-result', { orderNo: order.orderNo, paymentId: payment._id, tradeState: state.trade_state });
        if (state.out_trade_no !== order.orderNo || !state.mchid || !state.appid ||
            state.mchid !== (payment.configSnapshot?.mchid || snapshot.mchid) ||
            state.appid !== (payment.configSnapshot?.appId || snapshot.appId)) fail('PAYMENT_MISMATCH', '微信查单身份不匹配');
        if (state.trade_state === 'SUCCESS') {
          if (!state.transaction_id || Number(state.amount?.total) !== order.amountFen || state.amount?.currency !== 'CNY') fail('PAYMENT_MISMATCH', '微信查单金额不匹配');
          await Payment.applyEvent(repo, { client, snapshot, event: {
            eventType: 'TRANSACTION.SUCCESS', outTradeNo: state.out_trade_no,
            transactionId: state.transaction_id, mchid: state.mchid, appid: state.appid, amount: state.amount, payerOpenid: state.payer?.openid,
          } }, completePayment);
        } else if (['CLOSED', 'REVOKED', 'PAYERROR'].includes(state.trade_state)) {
          await repo.updateById('payments', payment._id, { status: state.trade_state === 'PAYERROR' ? 'FAILED' : 'CLOSED', updatedAt: Date.now() });
        }
      } catch (error) {
        paymentLog('query:failed', { orderNo: order.orderNo, paymentId: payment._id, errorCode: failureCode(error) });
        // 新订单可能尚未成功预下单；其他网络/验签错误不伪装成“未付款”。
        if (!['ORDER_NOT_EXIST', 'WECHAT_PAY_ORDER_NOT_EXIST'].includes(error.code)) throw error;
      }
      payment = await repo.getById('payments', payment._id);
      order = await repo.getById('orders', orderId);
    }
    paymentLog('query:local-result', { orderNo: order.orderNo, orderId, orderStatus: order.status, paymentStatus: payment?.status || 'MISSING' });
    return { orderId: order._id, orderNo: order.orderNo, amountFen: order.amountFen,
      status: payment?.status || (order.paidAt ? 'SUCCESS' : 'PENDING'),
      orderStatus: order.status, expired: D.isPaymentExpired(order, Date.now()),
      paidAt: payment?.paidAt || order.paidAt || 0 };
  }

  async function getMiniPaymentParams(repo, { orderId }, session) {
    const order = await ownedOrder(repo, orderId, session);
    if (order.status !== D.OrderStatus.PENDING_PAYMENT || D.isPaymentExpired(order, Date.now())) fail('ORDER_NOT_PAYABLE', '订单已支付、关闭或超时，请查看订单状态');
    if (paymentMode() !== 'wechat') fail('PAYMENT_MOCK_NOT_ALLOWED', '原生支付需要配置真实微信支付，不能模拟扣款');
    const brand = await repo.findOne('brands', { brandId: order.brandId });
    // 与 code2session 使用同一服务端AppID，绝不接收页面传入的AppID/OpenID/金额。
    const appId = process.env.WECHAT_MP_APPID;
    if (!appId || brand?.appId !== appId) fail('PAYMENT_APPID_MISMATCH', '品牌小程序AppID与云端 WECHAT_MP_APPID 不一致');
    const previous = order.paymentId ? await repo.getById('payments', order.paymentId) : null;
    if (previous && previous.channel !== 'WECHAT_MINIPROGRAM') {
      fail('PAYMENT_CHANNEL_CHANGED', '该订单曾使用网页支付，请先查询原订单支付结果；未支付的旧订单请等待关闭后重新下单');
    }
    if (previous && ['SUCCESS', 'CLOSED', 'FAILED'].includes(previous.status)) fail('ORDER_NOT_PAYABLE', '支付单已结束，请查询订单结果');
    await Ops.enforceLaunchPolicy(repo, { brandId: order.brandId, userId: session.openid, amountFen: order.amountFen, orderId }, process.env);
    const payment = await ensurePayment(repo, order, { payType: 'MINIPROGRAM', appId });
    const { client, snapshot } = Payment.clientFor(order, payment.secretRef, appId);
    if (!client.isConfigured()) fail('PAYMENT_NOT_CONFIGURED', '微信支付未配置');
    if (payment.configSnapshot?.appId && payment.configSnapshot.appId !== appId) fail('PAYMENT_APPID_MISMATCH', '历史支付单AppID不一致，请勿切换支付身份');
    if (payment.configSnapshot?.mchid && payment.configSnapshot.mchid !== snapshot.mchid) fail('PAYMENT_MISMATCH', '历史支付单商户号已变更，不能切换商户继续付款');
    // 必须先持久化身份快照，避免回调先于预下单返回时缺少校验依据。
    await repo.updateById('payments', payment._id, { configSnapshot: snapshot, updatedAt: Date.now() });
    await repo.updateById('orders', order._id, { paymentId: payment._id, payType: 'MINIPROGRAM', updatedAt: Date.now() });
    const prepayId = await client.jsapiPrepay({ outTradeNo: order.orderNo, amountFen: order.amountFen,
      description: order.productSnapshot?.title || `订单${order.orderNo}`, openid: session.openid, appid: appId });
    const params = await client.jsapiPayParams({ prepayId, appid: appId });
    await repo.updateById('payments', payment._id, { providerPrepayId: prepayId, updatedAt: Date.now() });
    await repo.updateById('orders', order._id, { payType: 'MINIPROGRAM', prepayId, paymentId: payment._id, updatedAt: Date.now() });
    return { paymentMode: 'wechat', payType: 'MINIPROGRAM', paymentId: payment._id, orderId,
      orderNo: order.orderNo, amountFen: order.amountFen, params };
  }
  return { getMiniPaymentParams, getMiniPaymentStatus };
}
module.exports = { createMiniPaymentServices };
