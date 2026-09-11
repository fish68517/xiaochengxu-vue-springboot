'use strict';
// 统一鉴权：HMAC 会话 + 持久撤销/MFA/二次验证 + action 白名单 + 角色矩阵。
// 会话密钥 env SESSION_SECRET 缺失即抛错(fail-closed);身份一律来自会话,拒绝 payload 指定 customerId/workerId/openid。
const { createHmac, timingSafeEqual } = require('node:crypto');
const { verifyInternalRequest } = require('./internal-auth.cjs');
const Security = require('./account-security.cjs');
const { hashPassword } = Security;

const SESSION_TTL_MS = 30 * 60 * 1000;    // 会话超时 30 分钟(V1.1 §11.1)
const MAX_LOGIN_FAILS = 5;                // 连续失败锁定阈值
const LOGIN_LOCK_MS = 30 * 60 * 1000;     // 锁定时长 30 分钟

// 核心公开入口(任务指定白名单):无需会话,各 action 在服务层自证身份(登录校验密码 / H5 token / 微信回调验签)。
const PUBLIC_ACTIONS = new Set([
  'miniLogin', 'authLogin', 'workerLogin', 'listProducts',
  'getProduct', 'getBrandConfig', 'payNotify', 'oauthExchange',
  'getPaymentStatus',
  'queryOrderByNo', // 公开读:按订单号+联系方式脱敏查询(客户自助查单)
  'getLegalDocuments',
]);

// H5 页面无会话:靠 H5 下单 token 自证(服务层验签 + exp + productId 绑定)。
const H5_TOKEN_ACTIONS = new Set(['getH5Product', 'createOrderFromH5', 'getPaymentParams']);

// 定时/系统回调入口:必须使用带时间窗、nonce、payload 摘要的 HMAC 内部签名。
const SYSTEM_ACTIONS = new Set([
  'transferNotify', 'timeoutCloseUnpaidOrders', 'timeoutMarkPool', 'timeoutRejectAssignments',
  'runOperationalMonitor', 'compensatePayments', 'runFinancialReconciliation',
]);

// 系统间调用白名单:内部云函数使用 INTERNAL_SECRET 生成短时 HMAC 签名；不再传输裸 secret。
const SYSTEM_CALLABLE = new Set(['h5Token']);
const INTERNAL_ACTIONS = new Set([...SYSTEM_ACTIONS, ...SYSTEM_CALLABLE]);

// 角色矩阵(蓝图 D.2 角色列):action -> 允许角色。未列入的受保护 action 一律拒绝。
const ROLE_MATRIX = {
  ...Object.fromEntries(['getSecurityStatus', 'setupMfa', 'enableMfa', 'verifySecurityChallenge', 'revokeSessions', 'listLoginHistory', 'refreshSession'].map((action) => [action, Security.SECURITY_ROLES])),
  setAccountStatus: ['ADMIN', 'SUPER_ADMIN'],
  listOperationalEvents: ['ADMIN', 'SUPER_ADMIN', 'BRAND_ADMIN'],
  getOperationalHealth: ['ADMIN', 'SUPER_ADMIN', 'BRAND_ADMIN'],
  listRecordsPage: ['ADMIN', 'SUPER_ADMIN', 'BRAND_ADMIN'],
  getLaunchPolicy: ['ADMIN', 'SUPER_ADMIN'],
  updateLaunchPolicy: ['ADMIN', 'SUPER_ADMIN'],
  recordLegalConsent: ['CUSTOMER', 'WORKER', 'CS', 'CUSTOMER_SERVICE', 'ADMIN'],
  withdrawLegalConsent: ['CUSTOMER', 'WORKER', 'CS', 'CUSTOMER_SERVICE', 'ADMIN'],
  listMyDataRequests: ['CUSTOMER', 'WORKER', 'CS', 'CUSTOMER_SERVICE', 'ADMIN'],
  requestDataRight: ['CUSTOMER', 'WORKER', 'CS', 'CUSTOMER_SERVICE', 'ADMIN'],
  cancelDataRequest: ['CUSTOMER', 'WORKER', 'CS', 'CUSTOMER_SERVICE', 'ADMIN'],
  getMyDataCopy: ['CUSTOMER', 'WORKER', 'CS', 'CUSTOMER_SERVICE', 'ADMIN'],
  listDataRequests: ['ADMIN', 'SUPER_ADMIN', 'BRAND_ADMIN'],
  reviewDataRequest: ['ADMIN', 'SUPER_ADMIN', 'BRAND_ADMIN'],
  executeDataRequest: ['ADMIN', 'SUPER_ADMIN', 'BRAND_ADMIN'],
  viewSensitiveProfile: ['ADMIN', 'SUPER_ADMIN', 'BRAND_ADMIN'],
  getPrivateAttachmentUrl: ['CUSTOMER', 'WORKER', 'CS', 'CUSTOMER_SERVICE', 'ADMIN', 'SUPER_ADMIN', 'BRAND_ADMIN'],
  runFinancialReconciliation: ['SYSTEM', 'ADMIN', 'SUPER_ADMIN', 'FINANCE_REVIEWER'],
  listReconciliationCases: ['ADMIN', 'SUPER_ADMIN', 'FINANCE_REVIEWER'],
  resolveReconciliationCase: ['ADMIN', 'SUPER_ADMIN', 'FINANCE_REVIEWER'],
  closeReconciliationCase: ['ADMIN', 'SUPER_ADMIN', 'FINANCE_REVIEWER'],
  exportFinancialReconciliation: ['ADMIN', 'SUPER_ADMIN', 'FINANCE_REVIEWER'],
  h5Token: ['CUSTOMER'],                          // 主链路:小程序端申请,绑定小程序 openid
  revokeH5Token: ['CS', 'ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  sendCustomerServiceLink: ['CS', 'ADMIN'],       // 兜底渠道:客服发链接(token 无 openid)
  changePassword: ['WORKER', 'CS', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'ARBITRATOR', 'SUPER_ADMIN'],
  getAccessProfile: ['CUSTOMER', 'WORKER', 'CS', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'ARBITRATOR', 'SUPER_ADMIN'],
  getRuntimeConfig: ['WORKER', 'CS', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  listUsers: ['ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  createStaff: ['ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  updateStaff: ['ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  listUserBrandRoles: ['ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  saveUserBrandRoles: ['ADMIN', 'SUPER_ADMIN'],
  listAuditLogs: ['ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  listMyOrders: ['CUSTOMER', 'WORKER'],
  getMyOrder: ['CUSTOMER', 'WORKER'],
  submitDispute: ['CUSTOMER'],
  requestSubscribe: ['CUSTOMER'],
  listNotifications: ['ADMIN', 'CS', 'WORKER', 'CUSTOMER'],
  markRead: ['ADMIN', 'CS', 'WORKER', 'CUSTOMER'],
  listOrders: ['CS', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  getOrder: ['CS', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'ARBITRATOR', 'SUPER_ADMIN'],
  listPayments: ['CS', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  enterOrder: ['CS', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  listOrderLogs: ['CS', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'ARBITRATOR', 'SUPER_ADMIN'],
  listPool: ['CS', 'ADMIN', 'WORKER', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  assignOrder: ['CS', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  reassignOrder: ['CS', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  listAssignments: ['CS', 'ADMIN', 'WORKER', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  requestCancellation: ['CS', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  requestRefund: ['CS', 'DISPATCHER', 'BRAND_ADMIN'],
  approveRefund: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  rejectRefund: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  confirmSettlement: ['CS', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  verifyCompletion: ['CS', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  rejectCompletion: ['CS', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  closeOrder: ['CS', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  reworkOrder: ['CS', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  resolveDispute: ['CS', 'ADMIN', 'ARBITRATOR', 'SUPER_ADMIN'],
  listDisputes: ['CS', 'ADMIN', 'ARBITRATOR', 'SUPER_ADMIN'],
  getDispute: ['CUSTOMER', 'WORKER', 'CS', 'ADMIN', 'ARBITRATOR', 'SUPER_ADMIN'],
  addDisputeEvidence: ['CUSTOMER', 'WORKER', 'CS', 'ADMIN', 'ARBITRATOR', 'SUPER_ADMIN'],
  startDisputeReview: ['CS', 'ADMIN', 'ARBITRATOR', 'SUPER_ADMIN'],
  closeDispute: ['ADMIN', 'ARBITRATOR', 'SUPER_ADMIN'],
  listWorkers: ['CS', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  createWorker: ['ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  updateWorker: ['ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  adjustWallet: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  addVip: ['ADMIN'],
  removeVip: ['ADMIN'],
  listVips: ['ADMIN'],
  saveProduct: ['ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  updateProductStatus: ['ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  listManagedProducts: ['ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  getManagedProduct: ['ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  listDicts: ['ADMIN'],
  saveDict: ['ADMIN'],
  getConfigs: ['ADMIN'],
  updateConfigs: ['ADMIN'],
  markWithdrawalPaid: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  startWithdrawalReview: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  approveWithdrawal: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  startWithdrawalPayment: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  failWithdrawalPayment: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  migrateWithdrawalStatuses: ['ADMIN', 'SUPER_ADMIN'],
  rejectWithdrawal: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  reportOrders: ['ADMIN', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  reportWorkers: ['ADMIN', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  reportWithdrawals: ['ADMIN', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  reportProfit: ['ADMIN', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  listCommissionRules: ['ADMIN', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  saveCommissionRule: ['ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  reconcileWalletLedger: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  sendOrderMessage: ['CS', 'ADMIN', 'WORKER', 'DISPATCHER', 'BRAND_ADMIN', 'ARBITRATOR', 'SUPER_ADMIN'],
  listOrderMessages: ['CS', 'ADMIN', 'WORKER', 'DISPATCHER', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'ARBITRATOR', 'SUPER_ADMIN'],
  grabOrder: ['WORKER'],
  releaseOrder: ['WORKER'],
  acceptAssignment: ['WORKER'],
  rejectAssignment: ['WORKER'],
  submitCompletion: ['WORKER'],
  confirmMockPayment: ['CUSTOMER'],
  getWallet: ['WORKER', 'ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  walletTransactions: ['WORKER', 'ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  applyWithdrawal: ['WORKER'],
  listWithdrawals: ['WORKER', 'ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  updateProfile: ['WORKER'],
  getProfile: ['WORKER'],
  freezeWallet: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  uploadFile: ['ADMIN', 'CS', 'WORKER', 'CUSTOMER'],
  dashboard: ['ADMIN', 'CS', 'DISPATCHER', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'ARBITRATOR', 'SUPER_ADMIN'],
  listBrands: ['ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  saveBrandConfig: ['ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  notify: ['CS', 'ADMIN'],
};

// 兼容旧数据里 CS 角色名 CUSTOMER_SERVICE。
function normalizeRole(role) {
  return role === 'CUSTOMER_SERVICE' ? 'CS' : role;
}

function createAuth({ env = process.env, now = () => Date.now() } = {}) {
  // 密钥按需读取(fail-closed + 支持轮换):签名/验签时才读 env,缺失即抛错。
  const getSecret = () => env.SESSION_SECRET;
  const security = (repo) => Security.createAccountSecurity({ repo, env, now, async: true });

  function sign(payload) {
    const secret = getSecret();
    if (!secret) throw new Error('缺少 SESSION_SECRET 环境变量(fail-closed)');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', secret).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  // 验签 + 过期校验:失败/过期一律抛错。
  function verify(token) {
    const secret = getSecret();
    if (!secret) throw new Error('缺少 SESSION_SECRET 环境变量(fail-closed)');
    if (!token || typeof token !== 'string') throw new Error('缺少会话 token');
    const dot = token.indexOf('.');
    if (dot <= 0) throw new Error('无效的会话 token');
    const body = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = createHmac('sha256', secret).update(body).digest('base64url');
    const a = Buffer.from(sig); const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('无效的会话 token');
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || now() > payload.exp) throw new Error('会话已过期,请重新登录');
    return payload;
  }

  // 签发会话:payload { userId, role, iat, exp }。
  function issueSession(user, access = {}) {
    const role = normalizeRole(user.role);
    if (!role) throw new Error('会话主角色不能为空');
    const payload = {
      userId: user._id,
      role,
      roles: access.roles || [role],
      brandScopes: access.brandScopes || [],
      permissions: access.permissions || [],
      securityVersion: user.securityVersion || 0,
      iat: now(),
      exp: now() + SESSION_TTL_MS,
    };
    return { token: sign(payload), user };
  }

  // 登录:校验密码/状态/锁定;失败累计 5 次锁 30 分钟;成功清零失败计数。
  async function login(repo, payload, context = {}) {
    const user = await security(repo).login(payload, context);
    const role = normalizeRole(user.role);
    const roleRows = await repo.find('user_brand_roles', { userId: user._id, status: 'ACTIVE' });
    const legacyAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(role);
    const access = {
      roles: [...new Set([role, ...roleRows.flatMap((row) => row.roles || []), ...(legacyAdmin ? ['SUPER_ADMIN'] : [])])],
      brandScopes: legacyAdmin ? ['*'] : [...new Set(roleRows.map((row) => row.brandId).filter(Boolean))],
      permissions: [...new Set(roleRows.flatMap((row) => row.permissions || []))],
    };
    const claims = await security(repo).createSession({ ...user, role }, access);
    return { token: sign(claims), user, ...access, securitySetupRequired: claims.scope === 'security-setup', mustChangePwd: !!user.mustChangePwd };
  }

  // 鉴权主入口:返回 { mode, session }。受保护 action 校验 token + 角色矩阵 + 账号状态。
  async function require(repo, action, ctx = {}) {
    if (PUBLIC_ACTIONS.has(action)) return { mode: 'public', session: null };
    if (H5_TOKEN_ACTIONS.has(action)) return { mode: 'h5', session: null };
    // 系统/内部 action：验 HMAC + 时间窗 + payload 摘要，并持久记录 nonce 防重放。
    if (INTERNAL_ACTIONS.has(action) && ctx.internalAuth) {
      const verified = verifyInternalRequest({
        action, payload: ctx.payload || {}, auth: ctx.internalAuth,
        secret: env.INTERNAL_SECRET, now: now(),
      });
      const existed = await repo.getById('system_nonces', verified.nonce);
      if (existed) throw new Error('内部请求已重放');
      await repo.insert('system_nonces', {
        _id: verified.nonce, action, timestamp: verified.timestamp,
        expiresAt: verified.expiresAt, createdAt: now(),
      });
      return { mode: 'system', session: { userId: 'internal-system', role: 'SYSTEM', roles: ['SYSTEM'], brandScopes: ['*'], internalNonce: verified.nonce }, internal: verified };
    }
    const payload = verify(ctx.token);
    const role = normalizeRole(payload.role);
    const roles = [...new Set([role, ...(Array.isArray(payload.roles) ? payload.roles.map(normalizeRole) : [])])];
    const allowed = ROLE_MATRIX[action];
    if (!allowed) throw new Error(`action 未注册角色矩阵: ${action}`);
    if (!roles.some((item) => allowed.includes(item))) throw new Error('无权执行该操作');
    if (role === 'CUSTOMER') {
      // 客户会话主体在 customers 集合,附带回 openid 供订单归属过滤。
      const customer = await repo.getById('customers', payload.userId);
      if (!customer) throw new Error('客户身份不存在');
      return { mode: 'session', session: { userId: payload.userId, role, roles, brandScopes: payload.brandScopes || (customer.brandId ? [customer.brandId] : []), permissions: payload.permissions || [], openid: customer.openid } };
    }
    await security(repo).validateSession(payload, action);
    Security.assertSensitiveAction(action, payload, ctx.payload?.stepUpToken, env, now());
    return { mode: 'session', session: { ...payload, role, roles, brandScopes: payload.brandScopes || [], permissions: payload.permissions || [] } };
  }

  // 拒绝把身份字段当作主体传入:CUSTOMER 拒绝 openid/customerId,WORKER 拒绝 workerId。
  function rejectIdentityOverride(payload, role) {
    if (role === 'CUSTOMER' && (payload.openid !== undefined || payload.customerId !== undefined)) {
      throw new Error('身份字段不可由客户端指定');
    }
    if (role === 'WORKER' && payload.workerId !== undefined) {
      throw new Error('身份字段不可由客户端指定');
    }
  }

  return {
    PUBLIC_ACTIONS, H5_TOKEN_ACTIONS, SYSTEM_ACTIONS, SYSTEM_CALLABLE, INTERNAL_ACTIONS, ROLE_MATRIX,
    hashPassword, issueSession, verify, login, require, rejectIdentityOverride, security, sign,
  };
}

module.exports = {
  createAuth, hashPassword, normalizeRole,
  PUBLIC_ACTIONS, SYSTEM_ACTIONS, SYSTEM_CALLABLE, INTERNAL_ACTIONS, ROLE_MATRIX, SESSION_TTL_MS, MAX_LOGIN_FAILS, LOGIN_LOCK_MS,
};
