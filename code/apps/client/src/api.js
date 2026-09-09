// 环境化请求层(T0-08):统一 action 协议；development 走本地 HTTP，production 走 uniCloud.callFunction。
// 错误分类:后端业务错(HTTP 4xx/5xx 或 {ok:false})不重试;仅网络失败重试一次;写请求不重试、不跨 transport;POST 带幂等键。

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? 'http://127.0.0.1:4176' : '');
const APP_ENV = import.meta.env.VITE_APP_ENV || 'development';
const API_MODE = import.meta.env.VITE_API_MODE || (API_BASE ? 'local' : 'unicloud');
if (!['local', 'unicloud'].includes(API_MODE)) throw new Error(`不支持的 VITE_API_MODE: ${API_MODE}`);
if (['staging', 'production'].includes(APP_ENV)) {
  if (API_MODE !== 'unicloud') throw new Error(`${APP_ENV} 必须使用 VITE_API_MODE=unicloud`);
  if (API_MODE === 'unicloud' && API_BASE) throw new Error(`${APP_ENV} 使用 uniCloud 时 VITE_API_BASE 必须留空`);
}
// H5 下单页域名:小程序"立即下单"经 web-view 打开 `${H5_ORDER_BASE_URL}/#/pages/h5-order/index?token=...`
export const H5_ORDER_BASE_URL = import.meta.env.VITE_H5_ORDER_BASE_URL || 'https://h5.qmhyjoy.com';
// 服务号网页授权 appid(snsapi_base),H5 微信内 JSAPI 对商户支付前置;构建期注入。
export const OAUTH_APPID = import.meta.env.VITE_OAUTH_APPID || '';
export const BRAND_CODE = import.meta.env.VITE_BRAND_CODE || '';

const CLOUD_FN = 'game-service';
const SESSION_KEY = '__client_session_v1__';

// 业务错误:后端返回 {ok:false, code, message} 或 HTTP 4xx/5xx;网络错误:连接失败/超时(可重试)。
export class ApiError extends Error {
  constructor(message, { code = '', status = 0, isNetwork = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.isNetwork = isNetwork;
  }
}

// 会话缓存:miniLogin 返回的 {token, customerId, isVip} 落本地,受保护 action 自动注入 token。
export function getSession() {
  try { return uni.getStorageSync(SESSION_KEY) || null; } catch (e) { return null; }
}
export function setSession(session) {
  try { uni.setStorageSync(SESSION_KEY, session); } catch (e) { /* 写入失败忽略 */ }
}

function cloudAvailable() {
  return typeof uniCloud !== 'undefined' && !!uniCloud && typeof uniCloud.callFunction === 'function';
}

function cloudTransportError(err) {
  const raw = (err && (err.errMsg || err.message)) || '';
  const isH5Production = import.meta.env.PROD && typeof window !== 'undefined' && !!window.location;
  // 浏览器会把 uniCloud 网关的 CORS 拒绝折叠成 request:fail，前端无法读取响应正文。
  // 给客户展示可理解的提示，同时保留错误码和控制台诊断信息供部署人员定位。
  if (isH5Production && /request:fail|failed to fetch|network\s*error/i.test(raw)) {
    const origin = window.location.origin;
    console.error(`[uniCloud] ${origin} 无法访问云服务，请检查 pwfinal 的 Web 安全域名/跨域配置。`, err);
    return new ApiError('云服务连接失败，请联系管理员检查域名授权后重试', {
      code: 'UNICLOUD_WEB_DOMAIN_OR_NETWORK_ERROR',
      isNetwork: true,
    });
  }
  return new ApiError(raw || '云函数调用失败', { code: 'UNICLOUD_TRANSPORT_ERROR', isNetwork: true });
}

// 云函数 transport:data={action,payload,token};业务错按 result 的 ok===false 识别。
async function callCloud(action, payload, token) {
  const data = { action, payload };
  if (token) data.token = token;
  try {
    // 生产 H5 只把 name/data 交给 uniCloud SDK，避免 callback 或本地 request 包装器污染其内部 POST body。
    const res = await uniCloud.callFunction({ name: CLOUD_FN, data });
    const r = res && res.result;
    if (r && typeof r === 'object' && r.ok === false) {
      throw new ApiError(r.message || '业务处理失败', { code: r.code, status: r.statusCode });
    }
    return r;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw cloudTransportError(err);
  }
}

// HTTP transport:H5 走 VITE_API_BASE,统一 POST /api/<action>,token 走 authorization 头。
function callHttp(action, payload, token) {
  return new Promise((resolve, reject) => {
    const header = { 'content-type': 'application/json' };
    if (token) header.authorization = `Bearer ${token}`;
    uni.request({
      url: `${API_BASE}/api/${action}`,
      method: 'POST',
      data: payload,
      header,
      success: (res) => {
        const status = res.statusCode || 0;
        const r = res.data;
        if (status >= 200 && status < 300) {
          if (r && typeof r === 'object' && r.ok === false) {
            reject(new ApiError(r.message || '业务处理失败', { code: r.code, status }));
          } else {
            resolve(r);
          }
        } else {
          // 4xx/5xx 业务错误:不重试
          reject(new ApiError((r && (r.message || r.error)) || `请求失败(${status})`, { code: r && r.code, status }));
        }
      },
      fail: () => reject(new ApiError('网络错误,请检查网络', { isNetwork: true })),
    });
  });
}

// 写请求在途去重:同一 action+payload 并发重复调用复用同一 promise(防抖),并附 requestId(幂等键)。
const inFlightWrites = new Map();

function newIdempotencyKey() {
  return `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// 统一调用入口:按环境选 transport;读请求网络失败同 transport 重试一次;写请求不重试、不跨 transport。
function call(action, payload = {}, { write = false } = {}) {
  if (write) {
    const writePayload = payload.idempotencyKey ? payload : { ...payload, idempotencyKey: newIdempotencyKey() };
    const key = `${action}:${JSON.stringify(payload)}`;
    if (inFlightWrites.has(key)) return inFlightWrites.get(key);
    const p = doCall(action, writePayload, { write: true }).finally(() => inFlightWrites.delete(key));
    inFlightWrites.set(key, p);
    return p;
  }
  return doCall(action, payload, { write: false });
}

async function doCall(action, payload = {}, { write = false } = {}) {
  const session = getSession();
  const token = session && session.token;
  const useCloud = API_MODE === 'unicloud';
  if (!useCloud && !API_BASE) throw new ApiError('本地模式未配置 VITE_API_BASE', { isNetwork: true });
  if (useCloud && !cloudAvailable()) throw new ApiError('当前环境无法调用 uniCloud，请检查前端项目的云服务空间关联', { isNetwork: true });
  const run = () => (useCloud ? callCloud(action, payload, token) : callHttp(action, payload, token));
  try {
    return await run();
  } catch (e) {
    // 写请求或业务错:直接抛出,不重试
    if (write || !(e && e.isNetwork)) throw e;
    // 读请求网络失败:同 transport 重试一次
    return await run();
  }
}

// 建立小程序会话:wx.login 取 code → miniLogin;非微信环境抛业务错。
export async function ensureSession(force = false) {
  const existing = getSession();
  if (!force && existing && existing.token) return existing;
  const code = await getWxLoginCode();
  const res = await api.miniLogin(code, { brandCode: BRAND_CODE });
  const session = { token: res.token, customerId: res.customerId, brandId: res.brandId, isVip: !!res.isVip, ts: Date.now() };
  setSession(session);
  return session;
}

// 取微信登录 code(仅小程序端有效)。
function getWxLoginCode() {
  return new Promise((resolve, reject) => {
    if (typeof wx === 'undefined' || typeof wx.login !== 'function') {
      reject(new ApiError('当前环境不支持微信登录'));
      return;
    }
    wx.login({
      success: (r) => (r && r.code ? resolve(r.code) : reject(new ApiError('微信登录未返回 code'))),
      fail: () => reject(new ApiError('微信登录失败', { isNetwork: true })),
    });
  });
}

// action 映射(§D.2 新契约):方法名即 action,payload 对齐后端入参。
export const api = {
  // 小程序静默登录:code 换 openid → {token, customerId, isVip}
  miniLogin: (code, context = {}) => call('miniLogin', { code, brandCode: BRAND_CODE, ...context }),
  listProducts: (params = {}) => call('listProducts', { brandCode: BRAND_CODE, ...params }),
  getProduct: (productId) => call('getProduct', { productId, brandCode: BRAND_CODE }),
  // 小程序端申请 H5 下单 token(绑定小程序 openid),需 session
  h5Token: (productId) => call('h5Token', { productId }),
  getH5Product: (token) => call('getH5Product', { token }),
  // 下单:h5Token + productId + 联系方式(微信/手机至少一)
  createOrderFromH5: (data) => call('createOrderFromH5', data, { write: true }),
  // 支付参数:微信内 extra={payType:'JSAPI',openid};微信外 extra={payType:'MWEB'}
  getPaymentParams: (orderId, extra = {}) => call('getPaymentParams', { orderId, ...extra }, { write: true }),
  confirmMockPayment: (paymentId) => call('confirmMockPayment', { paymentId }, { write: true }),
  getPaymentStatus: (data) => call('getPaymentStatus', data),
  // 服务号网页授权 code 换 openid(H5 微信内 JSAPI 支付)
  oauthExchange: (code) => call('oauthExchange', { code }),
  listMyOrders: (query = {}) => call('listMyOrders', query),
  getMyOrder: (orderId) => call('getMyOrder', { orderId }),
  // 客服链接下单兜底查询:公开 action(无会话),订单号+任一联系方式匹配返回脱敏 DTO。
  queryOrderByNo: (data) => call('queryOrderByNo', data),
  submitDispute: (data) => call('submitDispute', data, { write: true }),
  requestSubscribe: (data) => call('requestSubscribe', data, { write: true }),
  getBrandConfig: (context = {}) => call('getBrandConfig', typeof context === 'string' ? { appId: context, brandCode: BRAND_CODE } : { brandCode: BRAND_CODE, ...context }),
};
