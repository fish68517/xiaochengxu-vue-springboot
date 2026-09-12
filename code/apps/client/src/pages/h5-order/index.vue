<template>
  <view class="page-shell" :style="brandState.vars"><view class="h5-order">
    <view class="checkout-steps"><view class="active"><text>1</text><text>填写信息</text></view><view class="step-line"/><view :class="{active:phase!=='form'}"><text>2</text><text>确认支付</text></view><view class="step-line"/><view :class="{active:phase==='success'}"><text>3</text><text>完成</text></view></view>
    <view v-if="loading" class="state-box"><view class="loader"/><text class="state-title">正在准备订单</text><text class="state-desc">请稍候，不要关闭页面。。。</text></view>
    <view v-else-if="errorMsg" class="state-box"><image class="state-illustration" src="/static/empty-state.svg" mode="aspectFit"/><text class="state-title">下单页暂不可用</text><text class="state-desc">{{ errorMsg }}</text><button class="primary-btn" @click="retry">重新加载</button></view>
    <view v-else-if="phase==='success'" class="success-box"><view class="success-mark"><view class="success-check"/></view><text class="success-title">支付成功</text><text class="state-desc">订单已创建，客服将尽快为您安排服务</text><view class="order-number"><text>订单号</text><text>{{ paidOrderNo }}</text></view><button class="primary-btn" @click="copyOrderNo">复制订单号</button><button class="ghost-btn" @click="contactSupport">联系客服（自动携带订单号）</button><button class="ghost-btn" @click="goMiniProgram">返回小程序查看订单</button><text class="hint">咨询时请核对订单号，客服不会索要支付密码或验证码</text></view>
    <view v-else-if="['processing','unknown','failed'].includes(phase)" class="state-box"><view class="loader" :class="{stopped:phase==='failed'}"/><text class="state-title">{{ phase==='processing'?'支付处理中':phase==='unknown'?'支付结果确认中':'支付未完成' }}</text><text class="state-desc">{{ paymentMessage }}</text><button v-if="pendingPaymentId" class="primary-btn" @click="refreshPaymentStatus">查询支付结果</button><button v-if="phase==='failed'" class="ghost-btn" @click="continuePay">重新支付</button></view>
    <view v-else-if="phase==='continue'" class="form-view"><view class="hero"><text class="eyebrow">待支付订单</text><text class="product-title">继续完成支付</text><text class="success-order">订单号 {{ continueOrderNo||'加载中' }}</text></view><view class="footer"><view class="secure-note"><image src="/static/icons/shield.svg" mode="aspectFit"/><text>支付信息已加密保护</text></view><button class="submit-btn" :disabled="submitting" @click="continuePay">{{ submitting?'处理中…':'继续支付' }}</button></view></view>
    <view v-else-if="product" class="form-view">
      <view class="hero"><text class="eyebrow">订单确认</text><text class="product-title">{{ product.title }}</text><view class="product-meta"><text v-if="product.game">{{ gameText(product.game) }}</text><text v-if="product.serviceType">{{ serviceTypeText(product.serviceType) }}</text><text v-if="product.tierName">{{ product.tierName }}</text></view><view v-if="product.guaranteedOutput" class="output"><image src="/static/icons/shield.svg" mode="aspectFit"/><text>服务保障 {{ product.guaranteedOutput }}{{ product.outputUnit||'' }}</text></view><text class="price">¥{{ fenToYuan(product.priceFen) }}</text></view>
      <view class="form-card"><view class="form-heading"><text class="form-title">联系信息</text><text>微信号或手机号至少填写一项</text></view><view class="field"><text class="label">微信号</text><input v-model="form.contactWechat" class="input" placeholder="用于客服与您确认服务"/></view><view class="field"><text class="label">手机号</text><input v-model="form.contactPhone" class="input" type="number" maxlength="11" placeholder="请输入 11 位手机号"/></view><view v-for="field in dynamicFields" :key="field.name" class="field"><text class="label">{{ field.title||field.name }}</text><input v-model="form[field.name]" class="input" :placeholder="`请输入${field.title||field.name}`"/></view></view>
      <view class="service-notice"><image src="/static/icons/shield.svg" mode="aspectFit"/><text>提交即表示您已确认商品信息，客服将根据填写内容安排服务。</text></view>
      <view class="footer"><view class="pay-summary"><text>应付金额</text><text>¥{{ fenToYuan(product.priceFen) }}</text></view><button class="submit-btn" :disabled="submitting" @click="submitOrder">{{ submitting?'提交中…':'提交订单' }}</button></view>
    </view>
  </view></view>
</template>

<script setup>
// H5 下单/支付/支付成功页(一期核心):URL 取 token → getH5Product → 动态表单(联系方式至少一)→ createOrderFromH5 → 支付分流。
// 微信内 web-view=服务号网页授权→oauthExchange→getPaymentParams(JSAPI)→WeixinJSBridge;微信内非 web-view=引导复制/小程序内打开;微信外=mweb 跳转。
import { ref } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { api, ApiError, OAUTH_APPID } from '../../api.js';
import { brandState } from '../../brand.js';
import { brandContact } from '../../brand-assets.js';
import { fenToYuan, gameText, serviceTypeText } from '../../client-utils.js';

const token = ref('');
const product = ref(null);
const dynamicFields = ref([]);
const form = ref({ contactWechat: '', contactPhone: '' });
const submitting = ref(false);
const loading = ref(true);
const errorMsg = ref('');
const phase = ref('form'); // form | success
const paidOrderNo = ref('');
const continueOrderId = ref('');
const continueOrderNo = ref('');
const pendingPaymentId = ref('');
const paymentMessage = ref('');
const PREPARE_TIMEOUT_MS = 20000;
const ORDER_PAGE_REVISION = '20260912-order-diagnostics-1';
function orderLog(stage, fields = {}) {
  // 仅由本页传入阶段、布尔值、耗时和错误码；禁止传入请求/响应、token、code 或 openid。
  console.info('[H5Order]', JSON.stringify({ revision: ORDER_PAGE_REVISION, stage, ...fields }));
}
orderLog('setup');

function withPrepareTimeout(promise, message, stage) {
  let timer;
  const startedAt = Date.now();
  orderLog(`${stage}:start`);
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new ApiError(message, { code: 'H5_ORDER_PREPARE_TIMEOUT', isNetwork: true })), PREPARE_TIMEOUT_MS);
    }),
  ]).then((result) => {
    orderLog(`${stage}:success`, { elapsedMs: Date.now() - startedAt });
    return result;
  }, (error) => {
    orderLog(`${stage}:error`, { elapsedMs: Date.now() - startedAt, errorCode: error && error.code || 'UNKNOWN' });
    throw error;
  }).finally(() => clearTimeout(timer));
}

onLoad(async (query) => {
  // 1) 恢复 token:URL 优先,其次 sessionStorage(网页授权回调后 URL 已变)。
  const t = (query && query.token) || sessionGet('h5_token') || '';
  orderLog('onLoad', { hasToken: !!t, inWechat: isInWechat(), inMiniProgram: isMiniProgramWebview() });
  // 继续支付:订单已存在,直接进入支付分支(不新建订单)。
  const cid = (query && query.orderId) || '';
  if (cid) {
    continueOrderId.value = cid;
    continueOrderNo.value = (query && query.orderNo) || '';
    token.value = t;
    if (t) sessionSet('h5_token', t);
    loading.value = false;
    phase.value = 'continue';
    return;
  }
  if (!t) {
    loading.value = false;
    errorMsg.value = '下单链接无效或已过期';
    return;
  }
  token.value = t;
  sessionSet('h5_token', t);

  // 2) 网页授权回调:微信内 code 换 openid(JSAPI 对商户支付)。
  const code = (query && query.code) || getQueryCode();
  if (code && isInWechat()) {
    try {
      const res = await withPrepareTimeout(api.oauthExchange(code), '网页授权请求超时，请稍后重试', 'oauthExchange');
      if (!res || !res.openid) throw new ApiError('网页授权未返回 openid');
      sessionSet('h5_openid', res.openid);
      cleanUrlQuery();
    } catch (e) {
      // 授权失败不能继续自动跳转，否则缺配置时会形成 OAuth 重定向循环。
      console.error('[OAuth DEBUG] oauthExchange failed:', (e && e.code) || 'UNKNOWN');
      loading.value = false;
      errorMsg.value = e && e.code === 'H5_ORDER_PREPARE_TIMEOUT'
        ? e.message
        : '网页授权失败，请联系管理员检查服务号配置';
      return;
    }
  }

  await loadProduct();
});

onShow(() => {
  setNavTitle();
  const pending = sessionJson('h5_pending_payment');
  if (pending && pending.paymentId && token.value) {
    pendingPaymentId.value = pending.paymentId;
    refreshPaymentStatus();
  }
});

// 加载商品与动态表单 schema。
async function loadProduct() {
  loading.value = true;
  errorMsg.value = '';
  try {
    const res = await withPrepareTimeout(api.getH5Product(token.value), '商品加载超时，请检查网络或联系管理员', 'getH5Product');
    const p = (res && res.product) || res;
    if (!p || !p.id) throw new ApiError('商品信息不存在');
    product.value = p;
    buildDynamicFields(p);
    // 微信内 web-view 且无 openid:先网页授权(snsapi_base 静默,回来后页面重载)。
    if (isMiniProgramWebview() && !sessionGet('h5_openid')) {
      if (!redirectToOauth()) {
        loading.value = false;
        errorMsg.value = '未配置服务号网页授权，请联系管理员';
      }
      return;
    }
    loading.value = false;
    orderLog('form:ready');
  } catch (e) {
    orderLog('prepare:error', { errorCode: e && e.code || 'UNKNOWN' });
    loading.value = false;
    errorMsg.value = (e && e.message) || '商品信息加载失败';
  }
}

// 由 formSchema 构建动态字段(跳过联系方式保留字段)。
function buildDynamicFields(p) {
  const props = p.formSchema && p.formSchema.properties;
  dynamicFields.value = props
    ? Object.entries(props).map(([name, meta]) => ({ name, title: (meta && meta.title) || name })).filter((f) => !['contactWechat', 'contactPhone'].includes(f.name))
    : [];
  const init = { contactWechat: '', contactPhone: '' };
  dynamicFields.value.forEach((f) => { init[f.name] = ''; });
  form.value = init;
}

// 提交订单:校验联系方式至少一项,再按环境分流支付。
async function submitOrder() {
  const contactWechat = (form.value.contactWechat || '').trim();
  const contactPhone = (form.value.contactPhone || '').trim();
  if (!contactWechat && !contactPhone) {
    uni.showToast({ title: '请至少填写微信号或手机号', icon: 'none' });
    return;
  }
  if (contactPhone && !/^1\d{10}$/.test(contactPhone)) {
    uni.showToast({ title: '手机号格式不正确', icon: 'none' });
    return;
  }
  submitting.value = true;
  try {
    // 动态字段拍平进 payload;契约核心为 h5Token+productId+联系方式。
    const payload = { h5Token: token.value, productId: product.value.id, contactWechat, contactPhone, idempotencyKey: getOrCreateOrderKey(product.value.id) };
    dynamicFields.value.forEach((f) => { if (form.value[f.name]) payload[f.name] = form.value[f.name]; });
    const order = await api.createOrderFromH5(payload);
    const orderId = order.orderId || order.id;
    const orderNo = order.orderNo;
    if (!orderId) throw new ApiError('订单创建失败');
    continueOrderId.value = orderId;
    continueOrderNo.value = orderNo || '';

    if (isInWechat()) {
      if (isMiniProgramWebview()) {
        await payInWechatWebview(orderId, orderNo);
      } else {
        // 微信内非 web-view:引导复制链接到浏览器或在小程序中打开
        showGuide();
      }
    } else {
      await payOutsideWechat(orderId, orderNo);
    }
  } catch (e) {
    if (e && e.isCancelled) {
      uni.showToast({ title: '已取消支付', icon: 'none' });
    } else {
      uni.showToast({ title: (e && e.message) || '下单失败', icon: 'none' });
    }
  } finally {
    submitting.value = false;
  }
}

// 继续支付:对已存在订单直接走支付分流(不新建订单)。
async function continuePay() {
  if (!continueOrderId.value) return;
  submitting.value = true;
  try {
    if (isInWechat()) {
      if (isMiniProgramWebview()) {
        await payInWechatWebview(continueOrderId.value, continueOrderNo.value);
      } else {
        showGuide();
      }
    } else {
      await payOutsideWechat(continueOrderId.value, continueOrderNo.value);
    }
  } catch (e) {
    if (e && e.isCancelled) {
      uni.showToast({ title: '已取消支付', icon: 'none' });
    } else {
      uni.showToast({ title: (e && e.message) || '支付失败', icon: 'none' });
    }
  } finally {
    submitting.value = false;
  }
}

// 微信内 web-view:JSAPI 对商户支付。
async function payInWechatWebview(orderId, orderNo) {
  let openid = sessionGet('h5_openid');
  if (!openid) {
    // 未授权则先网页授权,回来后可重新提交。
    redirectToOauth();
    throw new ApiError('正在前往授权,请稍后重新提交');
  }
  const params = await api.getPaymentParams(orderId, { payType: 'JSAPI', openid, h5Token: token.value });
  if (params && params.paymentMode === 'mock') return completeMockPayment(params, orderNo);
  if (!params || params.payType !== 'JSAPI') throw new ApiError('支付参数异常,请重试');
  try {
    await invokeJsapi(params.jsapi);
    showSuccess(orderNo);
  } catch (e) {
    // 用户取消/失败:区分后交由上层 toast。
    const err = e && e.message ? e : new Error('支付未完成');
    err.isCancelled = /cancel/i.test((e && e.errMsg) || (e && e.message) || '');
    throw err;
  }
}

// 微信外:H5 支付(mweb)跳转。
async function payOutsideWechat(orderId, orderNo) {
  const params = await api.getPaymentParams(orderId, { payType: 'MWEB', h5Token: token.value });
  if (params && params.paymentMode === 'mock') return completeMockPayment(params, orderNo);
  const mwebUrl = params && (params.mwebUrl || params.h5Url);
  if (!mwebUrl) throw new ApiError('支付参数异常,请重试');
  pendingPaymentId.value = params.paymentId || '';
  sessionSet('h5_pending_payment', JSON.stringify({ paymentId: params.paymentId, orderNo, ts: Date.now() }));
  phase.value = 'processing';
  location.href = mwebUrl;
}

async function completeMockPayment(params, orderNo) {
  // 线上 H5 没有模拟确认所需的小程序 CUSTOMER 会话；正式页面不能自动确认模拟付款。
  if (import.meta.env.PROD) {
    orderLog('payment:configuration-error', { errorCode: 'PAYMENT_MOCK_NOT_ALLOWED' });
    throw new ApiError('支付服务尚未正确配置，请联系客服', { code: 'PAYMENT_MOCK_NOT_ALLOWED' });
  }
  pendingPaymentId.value = params.paymentId;
  phase.value = 'processing';
  paymentMessage.value = '正在确认模拟支付结果…';
  sessionSet('h5_pending_payment', JSON.stringify({ paymentId: params.paymentId, orderNo, ts: Date.now() }));
  try {
    await api.confirmMockPayment(params.paymentId);
    await refreshPaymentStatus(orderNo);
  } catch (e) {
    phase.value = e && e.isNetwork ? 'unknown' : 'failed';
    paymentMessage.value = (e && e.message) || '支付确认失败';
  }
}

async function refreshPaymentStatus(fallbackOrderNo = '') {
  if (!pendingPaymentId.value || !token.value) return;
  phase.value = 'unknown';
  paymentMessage.value = '正在向服务端查询支付结果…';
  try {
    const result = await api.getPaymentStatus({ paymentId: pendingPaymentId.value, h5Token: token.value });
    if (result.status === 'SUCCESS') {
      const pending = sessionJson('h5_pending_payment');
      sessionRemove('h5_pending_payment');
      sessionRemove('h5_order_key');
      showSuccess(fallbackOrderNo || (pending && pending.orderNo) || paidOrderNo.value);
    } else if (result.status === 'FAILED' || result.status === 'CLOSED') {
      phase.value = 'failed';
      paymentMessage.value = result.failureReason || '支付未成功，可重新发起';
    } else {
      phase.value = 'processing';
      paymentMessage.value = '支付结果尚未确认，请稍后再查';
    }
  } catch (e) {
    phase.value = 'unknown';
    paymentMessage.value = (e && e.message) || '暂时无法查询，请稍后重试';
  }
}

// WeixinJSBridge 拉起收银台。
function invokeJsapi(jsapi) {
  return new Promise((resolve, reject) => {
    if (typeof WeixinJSBridge === 'undefined' || !WeixinJSBridge.invoke) {
      reject(new Error('当前环境不支持微信支付,请复制链接到浏览器打开'));
      return;
    }
    WeixinJSBridge.invoke('getBrandWCPayRequest', {
      appId: jsapi.appId,
      timeStamp: jsapi.timeStamp,
      nonceStr: jsapi.nonceStr,
      package: jsapi.package,
      signType: jsapi.signType || 'RSA',
      paySign: jsapi.paySign,
    }, (res) => {
      if (res && res.err_msg === 'get_brand_wcpay_request:ok') resolve(res);
      else if (res && res.err_msg === 'get_brand_wcpay_request:cancel') reject(Object.assign(new Error('已取消支付'), { errMsg: 'cancel' }));
      else reject(new Error((res && res.err_msg) || '支付失败'));
    });
  });
}

// 支付成功视图:展示订单号 + 复制 + 回小程序 + 联系客服引导。
function showSuccess(orderNo) {
  paidOrderNo.value = orderNo || '';
  phase.value = 'success';
}

function copyOrderNo() {
  uni.setClipboardData({ data: paidOrderNo.value, success: () => uni.showToast({ title: '已复制', icon: 'success' }) });
}

function contactSupport() {
  const contact = brandContact();
  const lines = [`订单号：${paidOrderNo.value || '—'}`, contact.serviceWechat && `客服微信：${contact.serviceWechat}`, contact.servicePhone && `客服电话：${contact.servicePhone}`, contact.serviceHours && `服务时间：${contact.serviceHours}`].filter(Boolean);
  uni.showModal({ title: '联系客服', content: lines.join('\n'), showCancel: false, confirmText: '我知道了' });
}

// 回小程序:web-view 内返回小程序;普通浏览器则提示打开小程序。
function goMiniProgram() {
  if (isMiniProgramWebview() && typeof wx !== 'undefined' && wx.miniProgram) {
    wx.miniProgram.switchTab({ url: '/pages/mine/index' });
    return;
  }
  uni.showToast({ title: '请在微信小程序内查看订单', icon: 'none' });
}

// 微信内非 web-view:引导复制链接到浏览器或在小程序中打开。
function showGuide() {
  uni.showModal({
    title: '提示',
    content: '请复制链接到浏览器打开完成支付,或在微信小程序内下单。',
    showCancel: true,
    confirmText: '复制链接',
    success: (r) => {
      if (r.confirm && typeof location !== 'undefined') {
        uni.setClipboardData({ data: location.href });
      }
    },
  });
}

// 服务号网页授权(snsapi_base):跳转 open.weixin.qq.com,回调回本页带 code。
function redirectToOauth() {
  orderLog('oauthRedirect:start', { hasAppId: !!OAUTH_APPID });
  console.log('[OAuth DEBUG] OAUTH_APPID =', OAUTH_APPID);
  // URL 中包含 H5 下单 token；调试日志保留路径，但必须遮蔽敏感查询参数。
  console.log('[OAuth DEBUG] current href =', location.href.replace(/([?&](?:token|h5Token|code|state)=)[^&#]*/gi, '$1<REDACTED>'));
  if (!OAUTH_APPID) {
    uni.showToast({ title: '未配置服务号网页授权11', icon: 'none' });
    return false;
  }
  const redirectUri = `${location.origin}${location.pathname}?webview_rev=${Date.now()}#/pages/h5-order/index`;
  location.href = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${OAUTH_APPID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=snsapi_base&state=order#wechat_redirect`;
  // 若微信容器未完成跳转，原页面仍可见时给出明确反馈，不让“正在准备订单”无限旋转。
  setTimeout(() => {
    if (loading.value && !errorMsg.value && typeof document !== 'undefined' && !document.hidden) {
      loading.value = false;
      orderLog('oauthRedirect:timeout');
      errorMsg.value = '微信网页授权跳转超时，请返回小程序后重试';
    }
  }, PREPARE_TIMEOUT_MS);
  return true;
}

function retry() {
  loadProduct();
}

function setNavTitle() {
  const name = (brandState.brand && brandState.brand.name) || '游戏服务';
  try { uni.setNavigationBarTitle({ title: name }); } catch (e) { /* H5 无此 API */ }
  if (typeof document !== 'undefined') document.title = name;
}

// 环境探测。
function isInWechat() {
  return typeof navigator !== 'undefined' && /MicroMessenger/i.test(navigator.userAgent || '');
}
function isMiniProgramWebview() {
  return typeof window !== 'undefined' && window.__wxjs_environment === 'miniprogram';
}
function getQueryCode() {
  if (typeof location === 'undefined') return '';
  const m = /[?&]code=([^&]+)/.exec(location.search || '');
  return m ? decodeURIComponent(m[1]) : '';
}
function cleanUrlQuery() {
  if (typeof history === 'undefined' || !history.replaceState || typeof location === 'undefined') return;
  const url = new URL(location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  // 微信可能将回调参数追加在 Hash 路由后；两种位置都需清理，避免刷新时重复兑换一次性 code。
  const hash = url.hash.slice(1);
  const questionAt = hash.indexOf('?');
  if (questionAt >= 0) {
    const route = hash.slice(0, questionAt);
    const params = new URLSearchParams(hash.slice(questionAt + 1));
    params.delete('code');
    params.delete('state');
    const remaining = params.toString();
    url.hash = `#${route}${remaining ? `?${remaining}` : ''}`;
  }
  history.replaceState(null, '', url.pathname + url.search + url.hash);
}

// sessionStorage 兜底封装(H5 可用,小程序构建下不引用)。
function sessionGet(k) {
  try { return window.sessionStorage.getItem(k); } catch (e) { return null; }
}
function sessionSet(k, v) {
  try { window.sessionStorage.setItem(k, v); } catch (e) { /* 忽略 */ }
}
function sessionRemove(k) {
  try { window.sessionStorage.removeItem(k); } catch (e) { /* 忽略 */ }
}
function sessionJson(k) {
  try { return JSON.parse(sessionGet(k) || 'null'); } catch (e) { return null; }
}
function getOrCreateOrderKey(productId) {
  let key = sessionGet('h5_order_key');
  if (!key) {
    key = `${productId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionSet('h5_order_key', key);
  }
  return key;
}
</script>

<style lang="scss" scoped>
.page-shell{min-height:100vh;background:#e9edf5}.h5-order{min-height:100vh;padding:24rpx 24rpx 180rpx;background:var(--brand-bg);color:var(--brand-text)}
.checkout-steps{padding:12rpx 10rpx 34rpx;display:flex;align-items:flex-start;justify-content:center}.checkout-steps>view{width:120rpx;display:flex;flex-direction:column;align-items:center;gap:8rpx;color:var(--color-text-tertiary);font-size:21rpx}.checkout-steps>view text:first-child{width:42rpx;height:42rpx;display:flex;align-items:center;justify-content:center;background:#e4e7ec;border-radius:50%}.checkout-steps>view.active{color:var(--brand-primary);font-weight:700}.checkout-steps>view.active text:first-child{color:#fff;background:var(--brand-primary)}.checkout-steps>i{width:90rpx;height:3rpx;margin-top:20rpx;background:#e4e7ec}
.state-box,.success-box{min-height:650rpx;padding:90rpx 42rpx;display:flex;flex-direction:column;align-items:center;gap:22rpx;text-align:center;background:#fff;border-radius:28rpx}.state-illustration{width:260rpx;height:180rpx}.state-title,.success-title{font-size:36rpx;font-weight:800}.state-desc{color:var(--color-text-secondary);font-size:25rpx;line-height:1.6}.loader{width:76rpx;height:76rpx;border:6rpx solid #e4e7ec;border-top-color:var(--brand-primary);border-radius:50%;animation:spin .9s linear infinite}.loader.stopped{animation:none;border-color:var(--color-danger)}@keyframes spin{to{transform:rotate(360deg)}}
.hero,.form-card,.service-notice{padding:30rpx;margin-bottom:22rpx;background:#fff;border-radius:24rpx;box-shadow:var(--shadow-card)}.eyebrow{display:block;margin-bottom:8rpx;color:var(--brand-primary);font-size:22rpx;font-weight:700}.product-title{display:block;color:var(--color-text);font-size:36rpx;font-weight:800;line-height:1.45}.product-meta{margin-top:14rpx;display:flex;flex-wrap:wrap;gap:10rpx}.product-meta text{padding:5rpx 14rpx;color:var(--brand-primary);font-size:22rpx;background:var(--color-primary-soft);border-radius:8rpx}.output{margin-top:18rpx;display:flex;align-items:center;gap:10rpx;color:var(--color-text-secondary);font-size:24rpx}.output image{width:34rpx;height:34rpx}.price{display:block;margin-top:18rpx;color:var(--brand-primary);font-size:48rpx;font-weight:800}.success-order{color:var(--color-text-secondary);font-size:25rpx}
.form-heading{margin-bottom:24rpx}.form-title{display:block;font-size:30rpx;font-weight:800}.form-heading>text:last-child{display:block;margin-top:7rpx;color:var(--color-text-tertiary);font-size:22rpx}.field{margin-bottom:22rpx}.label{display:block;margin-bottom:9rpx;color:var(--color-text-secondary);font-size:24rpx;font-weight:600}.input{width:100%;height:84rpx;padding:0 22rpx;color:var(--color-text);font-size:27rpx;background:#f8f9fc;border:1rpx solid var(--color-border);border-radius:16rpx}.input:focus{border-color:var(--brand-primary)}.service-notice{display:flex;align-items:flex-start;gap:12rpx;color:var(--color-text-secondary);font-size:22rpx;line-height:1.55}.service-notice image{width:34rpx;height:34rpx;flex:none}
.footer{position:fixed;z-index:30;right:0;bottom:0;left:0;padding:14rpx 24rpx calc(14rpx + env(safe-area-inset-bottom));display:flex;align-items:center;gap:20rpx;background:rgba(255,255,255,.98);border-top:1rpx solid var(--color-border);box-shadow:0 -8rpx 28rpx rgba(16,24,40,.08)}.pay-summary{min-width:150rpx;flex:1}.pay-summary text:first-child{display:block;color:var(--color-text-tertiary);font-size:21rpx}.pay-summary text:last-child{display:block;color:var(--brand-primary);font-size:32rpx;font-weight:800}.secure-note{flex:1;display:flex;align-items:center;gap:8rpx;color:var(--color-text-secondary);font-size:22rpx}.secure-note image{width:32rpx;height:32rpx}.submit-btn,.primary-btn,.ghost-btn{height:88rpx;font-size:28rpx;line-height:88rpx;border-radius:44rpx}.submit-btn{width:280rpx;margin:0;color:#fff;font-weight:800;background:var(--brand-primary)}.submit-btn[disabled]{opacity:.58}.primary-btn{width:100%;color:#fff;background:var(--brand-primary)}.ghost-btn{width:100%;color:var(--brand-primary);background:#fff;border:1rpx solid var(--brand-primary)}
.success-mark{width:112rpx;height:112rpx;position:relative;background:var(--color-success);border-radius:50%;box-shadow:0 14rpx 30rpx rgba(18,183,106,.24)}.success-mark i{position:absolute;left:28rpx;top:52rpx;width:24rpx;height:6rpx;background:#fff;transform:rotate(42deg)}.success-mark i::after{content:'';position:absolute;left:18rpx;bottom:0;width:42rpx;height:6rpx;background:#fff;transform:rotate(-87deg);transform-origin:left}.order-number{width:100%;padding:22rpx;display:flex;justify-content:space-between;background:#f8f9fc;border-radius:16rpx}.order-number text:first-child{color:var(--color-text-tertiary);font-size:23rpx}.order-number text:last-child{font-size:24rpx;font-weight:700}.hint{color:var(--color-text-tertiary);font-size:22rpx}
@media(min-width:480px){.h5-order,.footer{width:480px;margin:0 auto}.h5-order{box-shadow:0 0 36px rgba(16,24,40,.08)}.footer{left:50%;right:auto;transform:translateX(-50%)}}@media(prefers-reduced-motion:reduce){.loader{animation:none}}
.step-line{width:90rpx;height:3rpx;margin-top:20rpx;background:#e4e7ec}.success-check{position:absolute;left:28rpx;top:52rpx;width:24rpx;height:6rpx;background:#fff;transform:rotate(42deg)}.success-check::after{content:'';position:absolute;left:18rpx;bottom:0;width:42rpx;height:6rpx;background:#fff;transform:rotate(-87deg);transform-origin:left}
</style>
