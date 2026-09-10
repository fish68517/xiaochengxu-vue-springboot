// 管理端统一请求层（T0-08）：环境化基地址 + 云函数兜底 + 错误分类 + 写请求不跨 transport 重试 + 幂等键。
// 生产（H5 部署）走 uniCloud 云函数 game-service；本地联调经 VITE_API_BASE 注入 api-server 镜像。
const HTTP_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) || '';
const APP_ENV = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_ENV) || 'development';
const API_MODE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_MODE) || (HTTP_BASE ? 'local' : 'unicloud');
if (!['local', 'unicloud'].includes(API_MODE)) throw new Error(`不支持的 VITE_API_MODE: ${API_MODE}`);
if (['staging', 'production'].includes(APP_ENV)) {
  if (API_MODE !== 'unicloud') throw new Error(`${APP_ENV} 必须使用 VITE_API_MODE=unicloud`);
  if (API_MODE === 'unicloud' && HTTP_BASE) throw new Error(`${APP_ENV} 使用 uniCloud 时 VITE_API_BASE 必须留空`);
}

const CLOUD_FN = 'game-service';
const ACTIVE_BRAND_KEY = '__admin_active_brand__';

function cloudAvailable() {
  try {
    return typeof uniCloud !== 'undefined' && !!uniCloud && typeof uniCloud.callFunction === 'function';
  } catch (e) {
    return false;
  }
}

function assertTransportReady() {
  if (API_MODE === 'local' && !HTTP_BASE) throw new Error('本地模式未配置 VITE_API_BASE');
  if (API_MODE === 'unicloud' && !cloudAvailable()) throw new Error('当前环境无法调用 uniCloud，请检查前端项目的云服务空间关联');
}

export function getActiveBrandId() {
  try { return uni.getStorageSync(ACTIVE_BRAND_KEY) || ''; } catch (e) { return ''; }
}

export function setActiveBrandId(brandId) {
  try { uni.setStorageSync(ACTIVE_BRAND_KEY, brandId || ''); } catch (e) { /* 存储不可用时保持后端全授权范围 */ }
}

function withActiveBrand(payload = {}) {
  const brandId = getActiveBrandId();
  return brandId && !payload.brandId ? { ...payload, brandId } : payload;
}

// 业务错误：携带服务端 code，禁止自动重试。
class BizError extends Error {
  constructor(message, code) {
    super(message || '请求失败');
    this.name = 'BizError';
    this.code = code;
  }
}

// 读取本地会话 token（login 页写入 storage）。
function getToken() {
  try {
    return uni.getStorageSync('token') || '';
  } catch (e) {
    return '';
  }
}

// 生成幂等键：写请求防抖/去重，避免重复提交。
function newIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// HTTP 请求：附加 Bearer token 与幂等键头；2xx 成功，其余按业务错误抛出。
function http(path, { method = 'GET', data } = {}, { idempotencyKey } = {}) {
  return new Promise((resolve, reject) => {
    const header = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) header.Authorization = `Bearer ${token}`;
    if (idempotencyKey) header['X-Idempotency-Key'] = idempotencyKey;
    uni.request({
      url: HTTP_BASE + path,
      method,
      data,
      header,
      success: (res) => {
        const body = res.data || {};
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(body);
        else reject(new BizError(body.message || body.error || `HTTP ${res.statusCode}`, body.code || `HTTP_${res.statusCode}`));
      },
      fail: (err) => reject(new Error(err.errMsg || '网络错误')),
    });
  });
}

// 云函数调用：token 与幂等键随 data 传递；统一 { code, message } 错误约定。
async function cloud(action, payload, { idempotencyKey } = {}) {
  if (typeof uniCloud === 'undefined' || !uniCloud.callFunction) throw new Error('uniCloud 不可用');
  const data = { action, payload };
  const token = getToken();
  if (token) data.token = token;
  if (idempotencyKey) data.idempotencyKey = idempotencyKey;
  try {
    // 保持 uniCloud 原生 Promise 调用，禁止本地 HTTP 包装逻辑介入 SDK 的 /client 请求。
    const res = await uniCloud.callFunction({ name: CLOUD_FN, data });
    const r = res.result || {};
    if (res.errCode && res.errCode !== 0) throw new BizError(res.errMsg || '服务端错误', res.errCode);
    if (typeof r.code !== 'undefined' && r.code !== 0 && r.code !== 'SUCCESS') throw new BizError(r.message, r.code);
    return r;
  } catch (err) {
    if (err instanceof BizError) throw err;
    throw new Error((err && (err.errMsg || err.message)) || '云函数调用失败');
  }
}

// 写请求在途表：同一 action+payload 复用同一 Promise，防抖去重。
const inFlight = new Map();

function keyOf(action, payload) {
  try {
    return `${action}:${JSON.stringify(payload || {})}`;
  } catch (e) {
    return `${action}:${Math.random()}`;
  }
}

// 写请求走单一 transport（HTTP 或云函数），失败即报错，绝不跨 transport 重试。
function primary(action, payload, { path, idempotencyKey }) {
  assertTransportReady();
  if (API_MODE === 'local') return http(path, { method: 'POST', data: payload }, { idempotencyKey });
  return cloud(action, payload, { idempotencyKey });
}

function handleSecurityRedirect(error) {
  if (!error || error.code !== 'PASSWORD_CHANGE_REQUIRED') return;
  try { uni.setStorageSync('mustChangePwd', true); } catch (_e) { /* 存储失败时仍执行跳转 */ }
  const path = globalThis.location?.hash?.replace(/^#\//, '').split('?')[0] || '';
  if (path !== 'pages/security/index') uni.reLaunch({ url: '/pages/security/index?required=1' });
}

// 统一分发：本地与云端 transport 严格隔离；写请求防抖 + 幂等键。
async function dispatch(action, payload = {}, { read = false, path } = {}) {
  if (!read) {
    const key = keyOf(action, payload);
    if (inFlight.has(key)) return inFlight.get(key);
    const p = (async () => {
      try {
        return await primary(action, payload, { path, idempotencyKey: newIdempotencyKey() });
      } catch (error) {
        handleSecurityRedirect(error);
        throw error;
      } finally {
        inFlight.delete(key);
      }
    })();
    inFlight.set(key, p);
    return p;
  }
  assertTransportReady();
  try {
    if (API_MODE === 'local') return await http(path, { method: 'GET', data: payload });
    return await cloud(action, payload);
  } catch (error) {
    handleSecurityRedirect(error);
    throw error;
  }
}

const read = (action, payload, path) => dispatch(action, payload || {}, { read: true, path });
const write = (action, payload, path) => dispatch(action, payload || {}, { read: false, path });

// HTTP 路由映射（与 api-server 镜像一致，波次 5 联调时校准）。
const PATH = {
  authLogin: '/api/auth/login',
  changePassword: '/api/changePassword',
  getAccessProfile: '/api/getAccessProfile',
  dashboard: '/api/dashboard',
  listUsers: '/api/listUsers',
  createStaff: '/api/createStaff',
  updateStaff: '/api/updateStaff',
  listWorkers: '/api/workers',
  createWorker: '/api/workers',
  updateWorker: '/api/workers/update',
  adjustWallet: '/api/wallets/adjust',
  freezeWallet: '/api/wallets/freeze',
  getWallet: '/api/wallets',
  listVips: '/api/vips',
  addVip: '/api/vips',
  removeVip: '/api/vips/remove',
  listProducts: '/api/products',
  listManagedProducts: '/api/listManagedProducts',
  getManagedProduct: '/api/getManagedProduct',
  saveProduct: '/api/products',
  updateProductStatus: '/api/products/status',
  listDicts: '/api/dicts',
  saveDict: '/api/dicts',
  getConfigs: '/api/configs',
  updateConfigs: '/api/configs',
  listWithdrawals: '/api/withdrawals',
  startWithdrawalReview: '/api/withdrawals/review',
  approveWithdrawal: '/api/withdrawals/approve',
  startWithdrawalPayment: '/api/withdrawals/start-payment',
  failWithdrawalPayment: '/api/withdrawals/fail-payment',
  markWithdrawalPaid: '/api/withdrawals/mark-paid',
  rejectWithdrawal: '/api/withdrawals/reject',
  listOrders: '/api/orders',
  getOrder: '/api/getOrder',
  listAssignments: '/api/listAssignments',
  assignOrder: '/api/assignOrder',
  reassignOrder: '/api/reassignOrder',
  listPayments: '/api/listPayments',
  listCommissionRules: '/api/listCommissionRules',
  saveCommissionRule: '/api/saveCommissionRule',
  walletTransactions: '/api/wallets/transactions',
  listDisputes: '/api/listDisputes',
  getDispute: '/api/getDispute',
  addDisputeEvidence: '/api/addDisputeEvidence',
  startDisputeReview: '/api/startDisputeReview',
  resolveDispute: '/api/resolveDispute',
  closeDispute: '/api/closeDispute',
  approveRefund: '/api/refunds/approve',
  rejectRefund: '/api/refunds/reject',
  sendCustomerServiceLink: '/api/h5-links/send',
  revokeH5Token: '/api/h5-links/revoke',
  reportOrders: '/api/reports/orders',
  reportWorkers: '/api/reports/workers',
  reportWithdrawals: '/api/reports/withdrawals',
  reportProfit: '/api/reports/profit',
  reconcileWalletLedger: '/api/reconcileWalletLedger',
  listBrands: '/api/brands',
  saveBrandConfig: '/api/brands',
  listAuditLogs: '/api/listAuditLogs',
  listUserBrandRoles: '/api/listUserBrandRoles',
  saveUserBrandRoles: '/api/saveUserBrandRoles',
};

export const api = {
  // 登录
  authLogin: (data) => write('authLogin', data, PATH.authLogin),
  changePassword: (data) => write('changePassword', data, PATH.changePassword),
  getAccessProfile: () => read('getAccessProfile', {}, PATH.getAccessProfile),
  // 管理概览待办
  dashboard: () => read('dashboard', withActiveBrand({}), PATH.dashboard),
  listUsers: (params = {}) => read('listUsers', withActiveBrand(params), PATH.listUsers),
  createStaff: (data) => write('createStaff', withActiveBrand(data), PATH.createStaff),
  updateStaff: (data) => write('updateStaff', data, PATH.updateStaff),
  // K-13 接单人员管理
  listWorkers: () => read('listWorkers', withActiveBrand({}), PATH.listWorkers),
  createWorker: (data) => write('createWorker', data, PATH.createWorker),
  updateWorker: (data) => write('updateWorker', data, PATH.updateWorker),
  // K-14 钱包调账
  adjustWallet: (data) => write('adjustWallet', data, PATH.adjustWallet),
  // K-14 钱包冻结（scope ∈ WITHDRAW/BOTH/NONE）
  freezeWallet: (data) => write('freezeWallet', data, PATH.freezeWallet),
  // K-14 ADMIN 变体：按 workerId 查余额/流水
  getWallet: (params) => read('getWallet', params, PATH.getWallet),
  walletTransactions: (params) => read('walletTransactions', params, PATH.walletTransactions),
  // K-15 VIP 名单
  listVips: () => read('listVips', {}, PATH.listVips),
  addVip: (data) => write('addVip', data, PATH.addVip),
  removeVip: (data) => write('removeVip', data, PATH.removeVip),
  // K-16 商品
  listProducts: (params = {}) => read('listProducts', withActiveBrand(params), PATH.listProducts),
  listManagedProducts: (params = {}) => read('listManagedProducts', withActiveBrand(params), PATH.listManagedProducts),
  getManagedProduct: (productId) => read('getManagedProduct', { productId }, PATH.getManagedProduct),
  saveProduct: (data) => write('saveProduct', withActiveBrand(data), PATH.saveProduct),
  updateProductStatus: (data) => write('updateProductStatus', data, PATH.updateProductStatus),
  // K-17 字典 / 配置
  listDicts: (params) => read('listDicts', params, PATH.listDicts),
  saveDict: (data) => write('saveDict', data, PATH.saveDict),
  getConfigs: () => read('getConfigs', {}, PATH.getConfigs),
  updateConfigs: (data) => write('updateConfigs', data, PATH.updateConfigs),
  // K-18 提现审批
  listWithdrawals: (params = {}) => read('listWithdrawals', withActiveBrand(params), PATH.listWithdrawals),
  startWithdrawalReview: (data) => write('startWithdrawalReview', data, PATH.startWithdrawalReview),
  approveWithdrawal: (data) => write('approveWithdrawal', data, PATH.approveWithdrawal),
  startWithdrawalPayment: (data) => write('startWithdrawalPayment', data, PATH.startWithdrawalPayment),
  failWithdrawalPayment: (data) => write('failWithdrawalPayment', data, PATH.failWithdrawalPayment),
  markWithdrawalPaid: (data) => write('markWithdrawalPaid', data, PATH.markWithdrawalPaid),
  rejectWithdrawal: (data) => write('rejectWithdrawal', data, PATH.rejectWithdrawal),
  // 退款审批
  listOrders: (params = {}) => read('listOrders', withActiveBrand(params), PATH.listOrders),
  getOrder: (orderId) => read('getOrder', { orderId }, PATH.getOrder),
  listAssignments: (orderId) => read('listAssignments', { orderId }, PATH.listAssignments),
  assignOrder: (data) => write('assignOrder', data, PATH.assignOrder),
  reassignOrder: (data) => write('reassignOrder', data, PATH.reassignOrder),
  listPayments: (params = {}) => read('listPayments', withActiveBrand(params), PATH.listPayments),
  listCommissionRules: (params = {}) => read('listCommissionRules', withActiveBrand(params), PATH.listCommissionRules),
  saveCommissionRule: (data) => write('saveCommissionRule', withActiveBrand(data), PATH.saveCommissionRule),
  listDisputes: (params = {}) => read('listDisputes', withActiveBrand(params), PATH.listDisputes),
  getDispute: (disputeId) => read('getDispute', { disputeId }, PATH.getDispute),
  addDisputeEvidence: (data) => write('addDisputeEvidence', data, PATH.addDisputeEvidence),
  startDisputeReview: (data) => write('startDisputeReview', data, PATH.startDisputeReview),
  resolveDispute: (data) => write('resolveDispute', data, PATH.resolveDispute),
  closeDispute: (data) => write('closeDispute', data, PATH.closeDispute),
  approveRefund: (data) => write('approveRefund', data, PATH.approveRefund),
  rejectRefund: (data) => write('rejectRefund', data, PATH.rejectRefund),
  sendCustomerServiceLink: (data) => write('sendCustomerServiceLink', data, PATH.sendCustomerServiceLink),
  revokeH5Token: (data) => write('revokeH5Token', data, PATH.revokeH5Token),
  // K-19 报表四件套
  reportOrders: (params) => read('reportOrders', params, PATH.reportOrders),
  reportWorkers: (params) => read('reportWorkers', params, PATH.reportWorkers),
  reportWithdrawals: (params) => read('reportWithdrawals', params, PATH.reportWithdrawals),
  reportProfit: (params) => read('reportProfit', params, PATH.reportProfit),
  reconcileWalletLedger: (params = {}) => read('reconcileWalletLedger', withActiveBrand(params), PATH.reconcileWalletLedger),
  // 品牌配置中心（Phase 2 已落地，保留）
  listBrands: () => read('listBrands', {}, PATH.listBrands),
  saveBrandConfig: (brand) => write('saveBrandConfig', brand, PATH.saveBrandConfig),
  listAuditLogs: (params = {}) => read('listAuditLogs', params, PATH.listAuditLogs),
  listUserBrandRoles: (params = {}) => read('listUserBrandRoles', params, PATH.listUserBrandRoles),
  saveUserBrandRoles: (data) => write('saveUserBrandRoles', data, PATH.saveUserBrandRoles),
};
