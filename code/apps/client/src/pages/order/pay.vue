<template>
  <view class="page" :style="brandState.vars">
    <view class="card">
      <text class="title">{{ status === 'SUCCESS' ? '支付成功' : '订单支付' }}</text>
      <text v-if="orderNo" class="muted">订单号：{{ orderNo }}</text>
      <text v-if="amountFen !== null" class="amount">¥{{ fenToYuan(amountFen) }}</text>
      <text class="message">{{ message }}</text>
      <button v-if="status !== 'SUCCESS' && !closed" class="primary" :disabled="busy" @click="pay">{{ busy ? '处理中…' : '微信支付' }}</button>
      <button v-if="status !== 'SUCCESS'" :disabled="busy" @click="refresh">查询支付结果</button>
      <button :disabled="busy" @click="viewOrder">查看订单</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad, onUnload } from '@dcloudio/uni-app';
import { api, ensureSession } from '../../api.js';
import { brandState } from '../../brand.js';
import { fenToYuan } from '../../client-utils.js';
const orderId = ref('');
const orderNo = ref('');
const amountFen = ref(null);
const status = ref('PENDING');
const closed = ref(false);
const busy = ref(false);
const message = ref('正在确认订单…');
let disposed = false;
onUnload(() => { disposed = true; });
async function authenticated(run) {
  await ensureSession();
  try { return await run(); }
  catch (error) {
    if (error?.code !== 'UNAUTHORIZED') throw error;
    await ensureSession(true);
    return run();
  }
}
async function queryStatus() {
  console.info('[PaymentConfirmUI]', JSON.stringify({ stage: 'query:start', orderId: orderId.value }));
  const result = await authenticated(() => api.getMiniPaymentStatus(orderId.value));
  console.info('[PaymentConfirmUI]', JSON.stringify({ stage: 'query:result', orderNo: result.orderNo, paymentStatus: result.status, orderStatus: result.orderStatus }));
  if (disposed) return false;
  orderNo.value = result.orderNo;
  amountFen.value = result.amountFen;
  status.value = result.status;
  closed.value = result.orderStatus === 'CLOSED' || result.expired || ['CLOSED', 'FAILED'].includes(result.status);
  message.value = result.status === 'SUCCESS' ? '付款已确认，服务人员将尽快处理订单' : closed.value ? '订单已关闭或支付单已结束，请查看订单' : '订单尚未确认付款，可支付或再次查询';
  return result.status === 'SUCCESS';
}
async function refresh() {
  if (busy.value || !orderId.value) return;
  busy.value = true;
  try { await queryStatus(); }
  catch (error) { message.value = `查询未完成：${error?.message || '请稍后重试'}。如已扣款，请勿重复付款`; console.warn('[PaymentConfirmUI]', JSON.stringify({ stage: 'query:failed', orderId: orderId.value, code: error?.code || 'UNKNOWN' })); }
  finally { busy.value = false; }
}
async function pay() {
  if (busy.value || !orderId.value || disposed) return;
  busy.value = true;
  try {
    if (await queryStatus() || closed.value || disposed) return;
    const result = await authenticated(() => api.getMiniPaymentParams(orderId.value));
    if (disposed) return;
    if (result.paymentMode !== 'wechat' || result.payType !== 'MINIPROGRAM' || !result.params) throw new Error('原生支付参数异常');
    const p = result.params;
    const actualAppId = wx.getAccountInfoSync().miniProgram.appId;
    if (p.appId !== actualAppId) throw new Error('支付AppID与当前小程序不一致，请联系管理员');
    message.value = '请在微信收银台完成支付';
    let payError;
    try {
      await new Promise((resolve, reject) => uni.requestPayment({
        provider: 'wxpay', timeStamp: p.timeStamp, nonceStr: p.nonceStr,
        package: p.package, signType: p.signType, paySign: p.paySign,
        success: resolve, fail: reject,
      }));
    } catch (error) { payError = error; }
    console.info('[PaymentConfirmUI]', JSON.stringify({ stage: payError ? 'cashier:not-confirmed' : 'cashier:success', orderId: orderId.value }));
    if (disposed) return;
    // 无论收银台回调结果如何，都由后端确认；不将客户端success当作到账。
    for (let attempt = 0; attempt < 3 && !disposed; attempt++) {
      if (await queryStatus()) return;
      if (payError || closed.value) break;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    if (payError) message.value = /cancel/i.test(payError.errMsg || '') ? '已取消支付，订单仍保留，可继续支付' : (payError.errMsg || '支付未完成，请查询结果后重试');
    else if (!closed.value) message.value = '支付结果尚未确认，请稍后点击查询支付结果，不要重复下单';
  } catch (error) {
    message.value = `${error?.message || '支付结果暂时无法确认'}。如已扣款，请勿重复付款，请点击查询支付结果`;
    console.warn('[PaymentConfirmUI]', JSON.stringify({ stage: 'payment:failed', orderId: orderId.value, code: error?.code || 'PAYMENT_FAILED' }));
  } finally { busy.value = false; }
}
function viewOrder() {
  if (orderId.value) uni.redirectTo({ url: `/pages/order/detail?id=${encodeURIComponent(orderId.value)}` });
}
onLoad((query) => {
  orderId.value = query?.orderId || '';
  if (!orderId.value) { closed.value = true; message.value = '缺少订单标识，请返回我的订单'; return; }
  pay();
});
</script>

<style scoped>
.page{min-height:100vh;padding:36rpx 24rpx;background:var(--brand-bg,#f4f6ff);box-sizing:border-box}.card{padding:40rpx 30rpx;background:#fff;border-radius:24rpx;text-align:center}.title,.muted,.amount,.message{display:block}.title{font-size:38rpx;font-weight:700}.muted{margin-top:24rpx;font-size:24rpx;color:#667085;word-break:break-all}.amount{margin:32rpx 0;font-size:52rpx;font-weight:700;color:var(--brand-primary,#5b6cff)}.message{margin:28rpx 0;font-size:28rpx;color:#475467;line-height:1.6}button{margin-top:20rpx;border-radius:44rpx;font-size:28rpx}.primary{color:#fff;background:var(--brand-primary,#5b6cff)}
</style>
