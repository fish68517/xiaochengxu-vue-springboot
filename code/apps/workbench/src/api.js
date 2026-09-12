import { sessionStore } from './session.js';
// api.js — 环境化请求层（T0-08）+ §D.2 action 全量映射
// 传输通道在模块加载时确定性选择：VITE_API_MODE=local 走 HTTP，unicloud 走云函数。
// 写请求不跨 transport 重试；仅读请求在网络/瞬时错误时重试一次；POST 附加幂等键并做在途去重。
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) || '';
const APP_ENV = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_ENV) || 'development';
const API_MODE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_MODE) || (API_BASE ? 'local' : 'unicloud');
if (!['local', 'unicloud'].includes(API_MODE)) throw new Error(`不支持的 VITE_API_MODE: ${API_MODE}`);
if (['staging', 'production'].includes(APP_ENV)) {
  if (API_MODE !== 'unicloud') throw new Error(`${APP_ENV} 必须使用 VITE_API_MODE=unicloud`);
  if (API_MODE === 'unicloud' && API_BASE) throw new Error(`${APP_ENV} 使用 uniCloud 时 VITE_API_BASE 必须留空`);
}
const CLOUD_NAME = 'game-service';
const ACTIVE_BRAND_KEY = '__workbench_active_brand__';

export function getActiveBrandId() {
  try { return sessionStore.get(ACTIVE_BRAND_KEY) || ''; } catch (e) { return ''; }
}

export function setActiveBrandId(brandId) {
  try { sessionStore.set(ACTIVE_BRAND_KEY, brandId || ''); } catch (e) { /* 忽略本地存储失败 */ }
}

function withActiveBrand(payload = {}) {
  const brandId = getActiveBrandId();
  return brandId && !payload.brandId ? { ...payload, brandId } : payload;
}

// 会话 token 从存储读取并注入两种传输：HTTP 走 Authorization: Bearer，云函数走 data.token（鉴权中间件约定）
function currentToken() {
  try { return sessionStore.get('token') || ''; } catch (e) { return ''; }
}
function assertSameSession(token) {
  if (token !== currentToken()) {
    const error = new Error('登录账号已切换，请刷新当前页面后重试');
    error.code = 'SESSION_CHANGED'; error.retryable = false;
    throw error;
  }
}

// 判断当前运行时是否具备 uniCloud 调用能力
function cloudAvailable() {
  try {
    return typeof uniCloud !== 'undefined' && !!uniCloud && typeof uniCloud.callFunction === 'function';
  } catch (e) {
    return false;
  }
}
const TRANSPORT = API_MODE === 'unicloud' ? 'cloud' : 'http';

function assertTransportReady() {
  if (TRANSPORT === 'http' && !API_BASE) throw new Error('本地模式未配置 VITE_API_BASE');
  if (TRANSPORT === 'cloud' && !cloudAvailable()) throw new Error('当前环境无法调用 uniCloud，请检查前端项目的云服务空间关联');
}

// 将 HTTP 状态归类：4xx=业务错误(不可重试)，5xx/0=网络或服务端瞬时错误(可重试)
function classifyHttpError(status, body) {
  const message = (body && (body.message || body.error)) || `HTTP ${status}`;
  return {
    code: (body && body.code) || `HTTP_${status}`,
    message,
    retryable: status >= 500 || status === 0,
    status,
  };
}

// 判定云函数返回是否为业务错误（契约：错误统一 { code, message }）
function isCloudError(r) {
  return r && typeof r === 'object' && !Array.isArray(r) && (r.ok === false || (r.code !== undefined && r.code !== 0 && !!r.message));
}

// HTTP 传输：走 uni.request，附 Idempotency-Key
function httpRequest(path, { method = 'GET', data, idemKey } = {}) {
  return new Promise((resolve, reject) => {
    const header = { 'content-type': 'application/json' };
    if (idemKey) header['Idempotency-Key'] = idemKey;
    const token = currentToken();
    if (token) header.Authorization = `Bearer ${token}`;
    uni.request({
      url: API_BASE + path,
      method,
      data,
      header,
      success: (res) => {
        try { assertSameSession(token); } catch (error) { reject(error); return; }
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve(res.data);
        } else {
          const c = classifyHttpError(res.statusCode, res.data);
          const e = new Error(c.message);
          Object.assign(e, c);
          reject(e);
        }
      },
      fail: (err) => {
        const e = new Error((err && err.errMsg) || '网络错误');
        e.code = 'NETWORK_ERROR';
        e.retryable = true;
        reject(e);
      },
    });
  });
}

// 云函数传输：单一 action 入口，业务错误转异常
async function cloudRequest(action, payload) {
  try {
    const token = currentToken();
    // 仅传 name/data；uniCloud SDK 自行构造并签名 /client 请求体。
    const res = await uniCloud.callFunction({
      name: CLOUD_NAME,
      data: { action, payload, token },
    });
    assertSameSession(token);
    const r = res.result || {};
    if (isCloudError(r)) {
      const e = new Error(r.message || `业务错误 ${r.code}`);
      e.code = r.code;
      e.retryable = false;
      throw e;
    }
    return r;
  } catch (err) {
    if (err && err.retryable === false) throw err;
    const e = new Error((err && (err.errMsg || err.message)) || '云函数调用失败');
    e.code = 'NETWORK_ERROR';
    e.retryable = true;
    throw e;
  }
}

// 写请求在途去重：相同 action+payload 的并发调用复用同一 Promise，防双击重复提交
const inFlight = new Map();
let idemSeq = 0;
function nextIdemKey() {
  idemSeq += 1;
  return `wb-${Date.now().toString(36)}-${idemSeq}-${Math.random().toString(36).slice(2, 8)}`;
}

function handleSecurityRedirect(error) {
  if (!error || error.code !== 'PASSWORD_CHANGE_REQUIRED') return;
  try { sessionStore.set('mustChangePwd', true); } catch (_e) { /* 存储失败时仍执行跳转 */ }
  const path = globalThis.location?.hash?.replace(/^#\//, '').split('?')[0] || '';
  if (path !== 'pages/security/index' && path !== 'pages/worker/profile') {
    const user = sessionStore.get('user') || {};
    const target = user.role === 'WORKER' ? '/pages/worker/profile' : '/pages/security/index?required=1';
    uni.reLaunch({ url: target });
  }
}

// 统一调用：读请求网络错误重试 1 次，写请求不重试且绝不切换传输通道
async function call(action, payload = {}, { method = 'GET' } = {}) {
  const write = method !== 'GET';
  const sessionToken = currentToken();
  const dedupKey = write ? `${sessionToken}:${action}:${JSON.stringify(payload || {})}` : null;
  if (dedupKey && inFlight.has(dedupKey)) return inFlight.get(dedupKey);

  const run = async () => {
    assertTransportReady();
    const attempts = write ? 1 : 2;
    let lastErr;
    for (let i = 0; i < attempts; i += 1) {
      try {
        assertSameSession(sessionToken);
        if (TRANSPORT === 'cloud') return await cloudRequest(action, payload);
        return await httpRequest(`/api/${action}`, { method, data: payload, idemKey: write ? nextIdemKey() : undefined });
      } catch (e) {
        lastErr = e;
        if (!e || !e.retryable) break;
      }
    }
    throw lastErr;
  };

  const p = run().catch((error) => {
    handleSecurityRedirect(error);
    throw error;
  });
  if (dedupKey) {
    inFlight.set(dedupKey, p);
    p.then(() => inFlight.delete(dedupKey), () => inFlight.delete(dedupKey));
  }
  return p;
}

// 凭证/身份证上传：HTTP 走 multipart，云函数先传对象存储再登记 attachments
export function uploadFile(bizType, filePath, fileName, bizId = '') {
  return new Promise((resolve, reject) => {
    try { assertTransportReady(); } catch (e) { reject(e); return; }
    if (TRANSPORT === 'cloud' && typeof uniCloud !== 'undefined' && uniCloud.uploadFile) {
      const cloudPath = `workbench/${bizType}/${Date.now()}-${fileName || 'file'}`;
      uniCloud.uploadFile({
        cloudPath,
        filePath,
        success: async (up) => {
          try {
            resolve(await call('uploadFile', { bizType, bizId, fileID: up.fileID, fileName: fileName || 'file' }, { method: 'POST' }));
          } catch (e) { reject(e); }
        },
        fail: reject,
      });
      return;
    }
    uni.uploadFile({
      url: API_BASE + '/api/uploadFile',
      filePath,
      name: 'file',
      formData: { bizType, bizId },
      header: currentToken() ? { Authorization: `Bearer ${currentToken()}` } : {},
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          try { resolve(JSON.parse(res.data)); } catch (e) { resolve(res.data); }
        } else {
          const e = new Error('上传失败');
          e.retryable = false;
          reject(e);
        }
      },
      fail: (err) => {
        const e = new Error((err && err.errMsg) || '上传失败');
        e.code = 'NETWORK_ERROR';
        e.retryable = true;
        reject(e);
      },
    });
  });
}

export const api = {
  // —— 登录与会话 ——
  authLogin: (data) => call('authLogin', data, { method: 'POST' }),
  workerLogin: (data) => call('workerLogin', data, { method: 'POST' }),
  changePassword: (data) => call('changePassword', data, { method: 'POST' }),
  getAccessProfile: () => call('getAccessProfile'),
  getRuntimeConfig: () => call('getRuntimeConfig'),
  // —— 客服/管理 ——
  dashboard: () => call('dashboard', withActiveBrand({})),
  listOrders: (filters = {}) => call('listOrders', withActiveBrand(filters)),
  getOrder: (orderId) => call('getOrder', { orderId }),
  enterOrder: (data) => call('enterOrder', data, { method: 'POST' }),
  listOrderLogs: (orderId) => call('listOrderLogs', { orderId }),
  listPool: () => call('listPool', withActiveBrand({})),
  assignOrder: (orderId, workerId) => call('assignOrder', { orderId, workerId }, { method: 'POST' }),
  reassignOrder: (orderId, workerId, reason) => call('reassignOrder', { orderId, workerId, reason }, { method: 'POST' }),
  listAssignments: (orderId) => call('listAssignments', { orderId }),
  requestCancellation: (orderId, reason) => call('requestCancellation', { orderId, reason }, { method: 'POST' }),
  requestRefund: (orderId, type, ratio, reason) => call('requestRefund', { orderId, type, ratio, reason }, { method: 'POST' }),
  approveRefund: (refundId) => call('approveRefund', { refundId }, { method: 'POST' }),
  rejectRefund: (refundId, reason) => call('rejectRefund', { refundId, reason }, { method: 'POST' }),
  confirmSettlement: (orderId) => call('confirmSettlement', { orderId, customerConfirmed: true }, { method: 'POST' }),
  verifyCompletion: (orderId, note) => call('verifyCompletion', { orderId, note }, { method: 'POST' }),
  rejectCompletion: (orderId, reason) => call('rejectCompletion', { orderId, reason }, { method: 'POST' }),
  closeOrder: (orderId) => call('closeOrder', { orderId, customerConfirmed: true }, { method: 'POST' }),
  reworkOrder: (orderId, note) => call('reworkOrder', { orderId, note }, { method: 'POST' }),
  resolveDispute: (disputeId, result, note) => call('resolveDispute', { disputeId, result, note }, { method: 'POST' }),
  startDisputeReview: (disputeId) => call('startDisputeReview', { disputeId }, { method: 'POST' }),
  listWorkers: (params = {}) => call('listWorkers', withActiveBrand(params)),
  markWithdrawalPaid: (withdrawalId, paidBy, batchNo) => call('markWithdrawalPaid', { withdrawalId, paidBy, batchNo }, { method: 'POST' }),
  rejectWithdrawal: (withdrawalId, reason) => call('rejectWithdrawal', { withdrawalId, reason }, { method: 'POST' }),
  sendOrderMessage: (orderId, content) => call('sendOrderMessage', { orderId, content }, { method: 'POST' }),
  listOrderMessages: (orderId) => call('listOrderMessages', { orderId }),
  sendCustomerServiceLink: (productId) => call('sendCustomerServiceLink', { productId }, { method: 'POST' }),
  revokeH5Token: (data) => call('revokeH5Token', data, { method: 'POST' }),
  // —— 接单服务人员 ——
  grabOrder: (orderId, expectedVersion) => call('grabOrder', { orderId, expectedVersion }, { method: 'POST' }),
  acceptAssignment: (assignmentId) => call('acceptAssignment', { assignmentId }, { method: 'POST' }),
  rejectAssignment: (assignmentId, reason) => call('rejectAssignment', { assignmentId, reason }, { method: 'POST' }),
  listMyOrders: () => call('listMyOrders'),
  getMyOrder: (orderId) => call('getMyOrder', { orderId }),
  submitCompletion: (orderId, actualOutput, attachmentIds) => call('submitCompletion', { orderId, actualOutput, attachmentIds }, { method: 'POST' }),
  releaseOrder: (orderId, reason) => call('releaseOrder', { orderId, reason }, { method: 'POST' }),
  getWallet: () => call('getWallet'),
  walletTransactions: () => call('walletTransactions'),
  applyWithdrawal: (amountFen) => call('applyWithdrawal', { amountFen }, { method: 'POST' }),
  listWithdrawals: () => call('listWithdrawals', withActiveBrand({})),
  getProfile: () => call('getProfile'),
  updateProfile: (data) => call('updateProfile', data, { method: 'POST' }),
};
