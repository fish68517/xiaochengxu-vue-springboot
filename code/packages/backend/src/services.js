// 本地测试替身服务层：镜像云函数 game-service 的全量 action（同名同语义）。
// 规则只在 packages/domain（单一源），此处仅做仓储（内存）+ 鉴权 + 事务编排。
// 差异：仓储为内存（db.js），生产为 uniCloud；微信支付/回调在本替身中为模拟实现。

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  newId,
  getById,
  findOne,
  existsBy,
  insert,
  removeWhere,
  updateWhere,
  transaction,
} from './db.js';
import { H5_TOKEN_TTL_MS, issueH5Token, verifyH5Token } from './token.js';
import { buildH5OrderLink } from './h5-link.js';
import { createPaymentAdapter } from './payment-adapter.js';
import Finance from '../../../uniCloud-tcb/cloudfunctions/game-service/lib/commercial-finance.cjs';
import {
  OrderStatus,
  CancellationStatus,
  DisputeResult,
  createOrder,
  isPaymentExpired,
  payOrder,
  timeoutClose,
  requestUnstartedCancel,
  approveUnstartedCancel,
  rejectCancellation,
  enterOrder as enterOrderDomain,
  grabOrder as grabOrderDomain,
  assignOrder as assignOrderDomain,
  acceptAssignment as acceptAssignmentDomain,
  rejectAssignment as rejectAssignmentDomain,
  releaseOrder as releaseOrderDomain,
  requestServiceRefund,
  submitCompletion as submitCompletionDomain,
  verifyCompletion as verifyCompletionDomain,
  rejectCompletion as rejectCompletionDomain,
  confirmSettlement as confirmSettlementDomain,
  reworkOrder as reworkOrderDomain,
  requestOutputRefund,
  openDispute,
  resolveDisputeMaintain,
  resolveDisputeRefund,
  approveRefund as approveRefundDomain,
  refundSuccess,
  calculateEarnings,
  calculateRefundRatio,
  calculateRefundAmount,
  calculateCommissionRecovery,
  resolveBrand,
  resolveBrandContext,
  hasBrandAccess,
  assertBrandAccess,
  WithdrawalStatus,
  MIN_WITHDRAW_FEN,
  createWallet,
  creditWallet,
  debitWallet,
  setWalletFreeze,
  clearWalletFreeze,
  createWithdrawal,
  startWithdrawalReview as startWithdrawalReviewDomain,
  approveWithdrawal as approveWithdrawalDomain,
  startWithdrawalPayment as startWithdrawalPaymentDomain,
  failWithdrawalPayment as failWithdrawalPaymentDomain,
  markWithdrawalPaid as markWithdrawalPaidDomain,
  rejectWithdrawal as rejectWithdrawalDomain,
} from '../../domain/src/index.js';

export { issueH5Token, verifyH5Token, H5_TOKEN_TTL_MS } from './token.js';

const H5_ORDER_BASE_URL = process.env.H5_ORDER_BASE_URL || 'https://h5.qmhyjoy.com';

// 会话有效期 30 分钟（T0-01）。
export const SESSION_TTL_MS = 30 * 60 * 1000;
// 登录失败锁定阈值与时长（T0-01）。
const LOGIN_FAIL_LIMIT = 5;
const LOGIN_LOCK_MS = 30 * 60 * 1000;

// 12 状态中文文案（客户端 DTO 用）。
const STATUS_TEXT = {
  PENDING_PAYMENT: '待支付',
  PENDING_ACCEPT: '待受理',
  PENDING_GRAB: '待抢单',
  ASSIGN_PENDING: '指派待确认',
  IN_SERVICE: '服务中',
  PENDING_CONFIRM: '待确认',
  SETTLED: '已结单',
  DISPUTING: '异议中',
  CANCELLED: '已取消',
  REFUNDING: '退款中',
  REFUNDED: '已退款',
  CLOSED: '已关闭',
};

// 本地替身默认配置（camelCase 键，与管理端 3c 定案契约一致）。
const DEFAULT_CONFIGS = {
  payTimeoutMinutes: 30,       // 支付超时（分钟）
  poolTimeoutMinutes: 30,      // 入池超时打标（分钟）
  assignTimeoutMinutes: 30,    // 指派超时自动拒（分钟）
  maxActiveOrders: 5,          // 同时进行订单上限
  weeklyWithdrawLimit: 3,      // 每周提现次数上限
  maxReworkCount: 1,           // 补单次数上限
  disputeWindowHours: 72,      // 异议窗口（小时）
  minWithdrawFen: 1000,        // 起提金额（分）
  pollIntervalSeconds: 10,     // 接单端轮询间隔（秒）
  sessionTimeoutMinutes: 30,   // 会话超时（分钟）
};

// 公开 action 白名单（无需会话，T0-01）。
const PUBLIC_ACTIONS = new Set([
  'miniLogin',
  'oauthExchange',
  'authLogin',
  'workerLogin',
  'listProducts',
  'getProduct',
  'getBrandConfig',
  'queryOrderByNo',
  'getH5Product',
  'createOrderFromH5',
  'getPaymentStatus',
  'payNotify',
]);

// action -> 允许角色矩阵（T0-01）。
const ACTION_ROLES = {
  h5Token: ['CUSTOMER'],
  revokeH5Token: ['CUSTOMER_SERVICE', 'ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  changePassword: ['WORKER', 'CUSTOMER_SERVICE', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'ARBITRATOR', 'SUPER_ADMIN'],
  getAccessProfile: ['CUSTOMER', 'WORKER', 'CUSTOMER_SERVICE', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'ARBITRATOR', 'SUPER_ADMIN'],
  listMyOrders: ['CUSTOMER', 'WORKER'],
  getMyOrder: ['CUSTOMER', 'WORKER'],
  submitDispute: ['CUSTOMER'],
  requestSubscribe: ['CUSTOMER'],
  listNotifications: ['CUSTOMER', 'WORKER', 'CUSTOMER_SERVICE', 'ADMIN'],
  markRead: ['CUSTOMER', 'WORKER', 'CUSTOMER_SERVICE', 'ADMIN'],
  getPaymentParams: ['CUSTOMER'],
  confirmMockPayment: ['CUSTOMER'],
  listPayments: ['CUSTOMER_SERVICE', 'ADMIN', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  listOrders: ['CUSTOMER_SERVICE', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  getOrder: ['CUSTOMER_SERVICE', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'ARBITRATOR', 'SUPER_ADMIN'],
  enterOrder: ['CUSTOMER_SERVICE', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  listOrderLogs: ['CUSTOMER_SERVICE', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'ARBITRATOR', 'SUPER_ADMIN'],
  listPool: ['CUSTOMER_SERVICE', 'ADMIN', 'WORKER', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  assignOrder: ['CUSTOMER_SERVICE', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  requestCancellation: ['CUSTOMER_SERVICE', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  requestRefund: ['CUSTOMER_SERVICE', 'DISPATCHER', 'BRAND_ADMIN'],
  approveRefund: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  rejectRefund: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  confirmSettlement: ['CUSTOMER_SERVICE', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  verifyCompletion: ['CUSTOMER_SERVICE', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  rejectCompletion: ['CUSTOMER_SERVICE', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  closeOrder: ['CUSTOMER_SERVICE', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  listAssignments: ['CUSTOMER_SERVICE', 'ADMIN', 'WORKER', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  reassignOrder: ['CUSTOMER_SERVICE', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  reworkOrder: ['CUSTOMER_SERVICE', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  resolveDispute: ['CUSTOMER_SERVICE', 'ADMIN', 'ARBITRATOR', 'SUPER_ADMIN'],
  listDisputes: ['CUSTOMER_SERVICE', 'ADMIN', 'ARBITRATOR', 'SUPER_ADMIN'],
  getDispute: ['CUSTOMER_SERVICE', 'ADMIN', 'ARBITRATOR', 'CUSTOMER', 'WORKER', 'SUPER_ADMIN'],
  addDisputeEvidence: ['CUSTOMER_SERVICE', 'ADMIN', 'ARBITRATOR', 'CUSTOMER', 'WORKER', 'SUPER_ADMIN'],
  startDisputeReview: ['CUSTOMER_SERVICE', 'ADMIN', 'ARBITRATOR', 'SUPER_ADMIN'],
  closeDispute: ['ADMIN', 'ARBITRATOR', 'SUPER_ADMIN'],
  sendOrderMessage: ['CUSTOMER_SERVICE', 'ADMIN', 'WORKER', 'DISPATCHER', 'BRAND_ADMIN', 'ARBITRATOR', 'SUPER_ADMIN'],
  listOrderMessages: ['CUSTOMER_SERVICE', 'ADMIN', 'WORKER', 'DISPATCHER', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'ARBITRATOR', 'SUPER_ADMIN'],
  dashboard: ['CUSTOMER_SERVICE', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'ARBITRATOR', 'SUPER_ADMIN'],
  listWorkers: ['CUSTOMER_SERVICE', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  createWorker: ['ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  updateWorker: ['ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  createStaff: ['ADMIN', 'SUPER_ADMIN'],
  listUsers: ['ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  updateStaff: ['ADMIN', 'SUPER_ADMIN'],
  listUserBrandRoles: ['ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  saveUserBrandRoles: ['ADMIN', 'SUPER_ADMIN'],
  listAuditLogs: ['ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  freezeWallet: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  adjustWallet: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  addVip: ['ADMIN'],
  removeVip: ['ADMIN'],
  listVips: ['ADMIN'],
  saveProduct: ['ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  updateProductStatus: ['ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  listDicts: ['ADMIN'],
  saveDict: ['ADMIN'],
  getConfigs: ['ADMIN'],
  updateConfigs: ['ADMIN'],
  markWithdrawalPaid: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  rejectWithdrawal: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  reportOrders: ['ADMIN', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  reportWorkers: ['ADMIN', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  reportWithdrawals: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  reportProfit: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  listBrands: ['ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  saveBrandConfig: ['ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  grabOrder: ['WORKER'],
  releaseOrder: ['WORKER'],
  acceptAssignment: ['WORKER'],
  rejectAssignment: ['WORKER'],
  submitCompletion: ['WORKER'],
  getWallet: ['WORKER', 'ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  walletTransactions: ['WORKER', 'ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  applyWithdrawal: ['WORKER'],
  listWithdrawals: ['WORKER', 'ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  startWithdrawalReview: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  approveWithdrawal: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  startWithdrawalPayment: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  failWithdrawalPayment: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  migrateWithdrawalStatuses: ['ADMIN', 'SUPER_ADMIN'],
  listCommissionRules: ['ADMIN', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  saveCommissionRule: ['ADMIN', 'BRAND_ADMIN', 'SUPER_ADMIN'],
  reconcileWalletLedger: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'],
  updateProfile: ['WORKER'],
  getProfile: ['WORKER'],
  uploadFile: ['CUSTOMER', 'WORKER', 'CUSTOMER_SERVICE', 'ADMIN'],
  sendCustomerServiceLink: ['CUSTOMER_SERVICE', 'ADMIN'],
  transferNotify: ['SYSTEM'],
  timeoutCloseUnpaidOrders: ['SYSTEM'],
  timeoutMarkPool: ['SYSTEM'],
  timeoutRejectAssignments: ['SYSTEM'],
  notify: [],
};

/* ---------------- 基础工具 ---------------- */

// 密码散列（sha256，本地替身用；生产应使用更强 KDF）。
export function hashPassword(password) {
  return createHash('sha256').update(String(password)).digest('hex');
}

// 脱敏用户（去除 passwordHash）。
const publicUser = ({ passwordHash, ...user }) => user;

// 读环境密钥，缺失即抛错（fail-closed，T0-02）。
export function getSessionSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('缺少 SESSION_SECRET 环境变量（fail-closed）');
  return s;
}

export function getH5Secret() {
  const s = process.env.H5_TOKEN_SECRET;
  if (!s) throw new Error('缺少 H5_TOKEN_SECRET 环境变量（fail-closed）');
  return s;
}

// 签发会话 token（HMAC + exp）。
export function issueSessionToken({ userId, role, roles = [], brandScopes = [], permissions = [] }, secret, { now = Date.now() } = {}) {
  if (!secret) throw new Error('缺少 SESSION_SECRET，无法签发会话');
  const body = Buffer.from(JSON.stringify({ userId, role, roles, brandScopes, permissions, exp: now + SESSION_TTL_MS })).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

// 校验会话 token，返回 { userId, role, exp }，失败抛错。
export function verifySessionToken(token, secret, { now = Date.now() } = {}) {
  if (!secret) throw new Error('缺少 SESSION_SECRET，无法校验会话');
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) throw new Error('无效的登录会话');
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('无效的登录会话');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (payload.exp != null && now > payload.exp) throw new Error('登录会话已过期');
  return { ...payload, role: normalizeRole(payload.role) };
}

// 角色归一化：兼容 CS 与 CUSTOMER_SERVICE（前端/历史简称）。
export function normalizeRole(role) {
  if (role === 'CS') return 'CUSTOMER_SERVICE';
  return role;
}

// 鉴权中间件：公开 action 放行；其余校验会话与角色矩阵（T0-01，角色先归一化）。
export function authorize(action, session) {
  if (PUBLIC_ACTIONS.has(action)) return;
  if (!session) throw new Error('未登录或会话失效');
  if (!session.userId || !session.role) throw new Error('会话信息不完整');
  const roles = [...new Set([session.role, ...(Array.isArray(session.roles) ? session.roles : [])].map(normalizeRole).filter(Boolean))];
  const allowed = ACTION_ROLES[action];
  if (!allowed) throw new Error(`action「${action}」未配置角色矩阵`);
  if (!roles.some((role) => allowed.includes(role))) throw new Error('无权限执行该操作');
}

function sessionHasRole(session, allowed) {
  const roles = [session?.role, ...(session?.roles || [])].map(normalizeRole);
  return roles.some((role) => allowed.includes(role));
}

function sessionAccess(db, user) {
  const rows = db.user_brand_roles.filter((row) => row.userId === user._id && row.status !== 'DISABLED');
  const legacyAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role);
  return {
    roles: [...new Set([user.role, ...rows.flatMap((row) => row.roles || []), ...(legacyAdmin ? ['SUPER_ADMIN'] : [])])],
    brandScopes: legacyAdmin ? ['*'] : [...new Set(rows.map((row) => row.brandId).filter(Boolean))],
    permissions: [...new Set(rows.flatMap((row) => row.permissions || []))],
  };
}

function resolveRequestBrand(db, { brandCode = '', appId = '', brandId = '' } = {}, { allowDefault = true } = {}) {
  const brands = db.brands.filter((brand) => ['ON', 'ACTIVE'].includes(brand.status));
  if (!brands.length) return { brandId: brandId || 'default', brandCode: brandCode || brandId || 'default', appId, version: 1 };
  return resolveBrandContext(brands, { brandCode: brandCode || brandId, appId, allowDefault });
}

function assertSessionBrand(session, brandId) {
  if (!session || !brandId || brandId === 'default' && (!session.brandScopes || !session.brandScopes.length)) return true;
  return assertBrandAccess(session, brandId);
}

function canSessionAccessBrand(session, brandId) {
  if (!brandId || !session || ((!session.brandScopes || !session.brandScopes.length) && !session.roles)) return true;
  return hasBrandAccess(session, brandId);
}

function userHasBrandScope(db, userId, brandId) {
  const user = getById(db, 'users', userId);
  if (user && ['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return true;
  const rows = db.user_brand_roles.filter((row) => row.userId === userId && row.status !== 'DISABLED');
  return rows.length === 0 ? brandId === 'default' : rows.some((row) => row.brandId === '*' || row.brandId === brandId);
}

const ACCESS_MENUS = {
  CUSTOMER: ['home', 'orders', 'mine'],
  WORKER: ['pool', 'my-orders', 'wallet', 'profile'],
  ORDER_TAKER: ['pool', 'my-orders', 'wallet', 'profile'],
  CUSTOMER_SERVICE: ['dashboard', 'orders', 'workers'],
  DISPATCHER: ['dashboard', 'orders', 'workers'],
  BRAND_ADMIN: ['dashboard', 'orders', 'products', 'brands', 'accounts', 'access', 'audit'],
  FINANCE_REVIEWER: ['dashboard', 'orders', 'ledger', 'wallets', 'withdrawals', 'reports'],
  ARBITRATOR: ['dashboard', 'orders', 'disputes'],
  ADMIN: ['*'],
  SUPER_ADMIN: ['*'],
};

function accessProfile(session) {
  const roles = [...new Set([session.role, ...(session.roles || [])].map(normalizeRole).filter(Boolean))];
  const visibleMenus = roles.some((role) => ['ADMIN', 'SUPER_ADMIN'].includes(role))
    ? ['*']
    : [...new Set(roles.flatMap((role) => ACCESS_MENUS[role] || []))];
  return {
    userId: session.userId,
    roles,
    brandScopes: [...new Set(session.brandScopes || [])],
    permissions: [...new Set(session.permissions || [])],
    visibleMenus,
  };
}

function appendAudit(db, {
  brandId = 'default', action, resourceType, resourceId = '', before = null, after = null,
  requestId = '', metadata = {},
}, session) {
  const doc = {
    brandId,
    operatorId: session?.userId || 'system',
    operatorRole: normalizeRole(session?.role || 'SYSTEM'),
    action,
    resourceType,
    resourceId,
    requestId,
    ipMeta: metadata,
    createdAt: Date.now(),
  };
  if (before !== null) doc.before = before;
  if (after !== null) doc.after = after;
  return insert(db, 'audit_logs', doc);
}

// 登录失败锁定判定。
function assertNotLocked(user) {
  if (user.lockedUntil && Date.now() < user.lockedUntil) {
    throw new Error('登录失败次数过多，账号已锁定，请稍后再试');
  }
}

// 记录一次登录失败；连续失败达阈值锁定 30 分钟。
function recordLoginFailure(user) {
  user.loginFailCount = (user.loginFailCount || 0) + 1;
  if (user.loginFailCount >= LOGIN_FAIL_LIMIT) {
    user.lockedUntil = Date.now() + LOGIN_LOCK_MS;
    user.loginFailCount = 0;
  }
}

// 登录成功后清除失败计数与锁定。
function clearLoginFailure(user) {
  user.loginFailCount = 0;
  user.lockedUntil = undefined;
}

/* ---------------- 仓储辅助 ---------------- */

// 确保钱包存在（ownerId 唯一），不存在则创建。
function ensureWallet(db, ownerId) {
  let wallet = db.wallets.find((w) => w.ownerId === ownerId);
  if (!wallet) {
    wallet = createWallet();
    wallet._id = newId(db, 'wallet');
    wallet.ownerId = ownerId;
    wallet.createdAt = Date.now();
    wallet.updatedAt = Date.now();
    db.wallets.push(wallet);
  }
  return wallet;
}

// 写钱包流水（余额快照 balanceAfterFen）。
function addWalletTx(db, wallet, type, amountFen, refId, {
  operatorId = '', remark = '', brandId = 'default', orderId = '', refundId = '', withdrawalId = '', ruleVersion = 0,
} = {}) {
  insert(db, 'wallet_transactions', {
    brandId,
    walletId: wallet._id,
    accountId: wallet.ownerId,
    type,
    amountFen,
    balanceAfterFen: wallet.availableFen,
    refId,
    referenceId: refId,
    orderId,
    refundId,
    withdrawalId,
    direction: amountFen > 0 ? 'CREDIT' : amountFen < 0 ? 'DEBIT' : 'NEUTRAL',
    ruleVersion,
    status: 'POSTED',
    remark,
    operatorId,
    createdAt: Date.now(),
  });
}

// 写订单状态流水（每次流转同事务落库，§C.5）。
function writeOrderLog(db, order, { action, fromStatus, toStatus, operatorType, operatorId, operatorRole = '', remark = '', payloadSnapshot = {}, requestId = '' }) {
  insert(db, 'order_logs', {
    orderId: order._id,
    brandId: order.brandId || 'default',
    fromStatus,
    toStatus,
    action,
    operatorType,
    operatorId,
    operatorRole: operatorRole || operatorType,
    remark,
    payloadSnapshot,
    requestId,
    createdAt: Date.now(),
  });
}

function recordAssignment(db, order, { type, workerId, previousWorkerId = '', operatorId, reason = '', requestId = '' }) {
  return insert(db, 'assignments', {
    brandId: order.brandId || 'default', orderId: order._id, type, workerId, previousWorkerId,
    operatorId, reason, requestId, createdAt: Date.now(),
  });
}

// 读配置项（configs 集合优先，缺省用本地默认）。
function getConfig(db, key) {
  const cfg = db.configs.find((c) => c.cfgKey === key);
  return cfg ? cfg.cfgValue : DEFAULT_CONFIGS[key];
}

// 创建退款单记录（统一 refunds 表，§C.3）。
function createRefund(db, order, { type, ratio, amountFen, reason = '', requestedBy = '' }) {
  return insert(db, 'refunds', {
    brandId: order.brandId || 'default',
    orderId: order._id,
    paymentId: order.paymentId || '',
    type,
    ratio,
    amountFen,
    reason,
    status: 'PENDING_APPROVAL',
    requestedBy,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

// 退款成功时全额追回该订单已入账佣金（允许钱包为负）。
function recoverCommission(db, order, refundId = '') {
  if (!order.workerId || !order.earningsFen) return 0;
  const wallet = ensureWallet(db, order.workerId);
  const amount = calculateCommissionRecovery({ earningsFen: order.earningsFen });
  debitWallet(wallet, amount);
  wallet.version += 1;
  wallet.updatedAt = Date.now();
  addWalletTx(db, wallet, 'REFUND_CLAWBACK', -amount, refundId || order._id, {
    remark: '退款追回佣金', brandId: order.brandId || 'default', orderId: order._id, refundId,
    ruleVersion: order.commissionRuleSnapshot?.version || 0,
  });
  return amount;
}

// 订单可执行动作（按状态推导）。
function computeAllowedActions(order) {
  const actions = [];
  if (order.status === OrderStatus.PENDING_PAYMENT) actions.push('continuePay');
  if (order.status === OrderStatus.SETTLED && (order.disputeDeadline == null || Date.now() <= order.disputeDeadline)) actions.push('submitDispute');
  return actions;
}

function computeServiceAllowedActions(order, session) {
  const roles = new Set([session?.role, ...(session?.roles || [])].map(normalizeRole));
  const actions = [];
  if (order.status === OrderStatus.PENDING_ACCEPT && [...roles].some((r) => ['CUSTOMER_SERVICE', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'].includes(r))) actions.push('enterOrder');
  if (order.status === OrderStatus.PENDING_GRAB) {
    if (roles.has('WORKER')) actions.push('grabOrder');
    if ([...roles].some((r) => ['CUSTOMER_SERVICE', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'].includes(r))) actions.push('assignOrder');
  }
  if (order.status === OrderStatus.ASSIGN_PENDING && roles.has('WORKER')) actions.push('acceptAssignment', 'rejectAssignment');
  if ([OrderStatus.ASSIGN_PENDING, OrderStatus.IN_SERVICE].includes(order.status) && [...roles].some((r) => ['CUSTOMER_SERVICE', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'].includes(r))) actions.push('reassignOrder');
  if (order.status === OrderStatus.IN_SERVICE && roles.has('WORKER') && order.workerId === session?.userId) actions.push('submitCompletion', 'releaseOrder');
  if (order.status === OrderStatus.PENDING_CONFIRM && [...roles].some((r) => ['CUSTOMER_SERVICE', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'].includes(r))) {
    if (order.verificationStatus !== 'VERIFIED') actions.push('verifyCompletion', 'rejectCompletion');
    else actions.push('closeOrder');
  }
  return actions;
}

// 客户端订单 DTO（T0-11：product/amountFen/状态文案/allowedActions）。
function toClientOrderDto(order) {
  return {
    id: order._id,
    orderId: order._id,
    orderNo: order.orderNo,
    product: {
      id: order.productId,
      title: order.productSnapshot ? order.productSnapshot.title : '',
      coverImage: order.productSnapshot ? order.productSnapshot.coverImage || '' : '',
    },
    amountFen: order.amountFen,
    status: order.status,
    statusText: STATUS_TEXT[order.status] || order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    workerId: order.workerId,
    allowedActions: computeAllowedActions(order),
  };
}

// 脱敏订单 DTO（兜底查询用：不含联系方式/内部备注/接单者；allowedActions 收紧为仅继续支付）。
function toQueryOrderDto(order) {
  return {
    id: order._id,
    orderId: order._id,
    orderNo: order.orderNo,
    status: order.status,
    statusText: STATUS_TEXT[order.status] || order.status,
    amountFen: order.amountFen,
    product: {
      title: order.productSnapshot ? order.productSnapshot.title : '',
      coverImage: order.productSnapshot ? order.productSnapshot.coverImage || '' : '',
    },
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    paidAt: order.paidAt,
    completedAt: order.completedAt,
    allowedActions: order.status === OrderStatus.PENDING_PAYMENT ? ['continuePay'] : [],
  };
}

/* ---------------- 账号/会话 ---------------- */

// 小程序登录：code 换 openid（替身按确定性映射），upsert 客户，返回 CUSTOMER 会话。
export function miniLogin(db, { code, brandCode, appId }) {
  if (!code) throw new Error('code 不能为空');
  const openid = `mp-${code}`;
  let customer = findOne(db, 'customers', (c) => c.openid === openid);
  if (!customer) {
    customer = insert(db, 'customers', { openid, isVip: false, createdAt: Date.now(), updatedAt: Date.now() });
  }
  const brand = resolveRequestBrand(db, { brandCode, appId }, { allowDefault: true });
  customer.brandId = brand.brandId;
  const token = issueSessionToken({ userId: openid, role: 'CUSTOMER', roles: ['CUSTOMER'], brandScopes: [brand.brandId] }, getSessionSecret());
  return { token, customerId: openid, isVip: customer.isVip === true, brandId: brand.brandId };
}

// 服务号网页授权 code 换 openid（snsapi_base，供 H5 JSAPI 对商户支付）。
export function oauthExchange(db, { code }) {
  if (!code) throw new Error('code 不能为空');
  return { openid: `oa-${code}` };
}

// 员工登录（ADMIN/CS）：随机短期 session token + 失败锁定。
export function authLogin(db, { phone, password }) {
  const user = findOne(db, 'users', (u) => u.phone === phone);
  if (!user || user.passwordHash !== hashPassword(password)) {
    if (user) recordLoginFailure(user);
    throw new Error('手机号或密码错误');
  }
  assertNotLocked(user);
  if (!['ADMIN', 'CUSTOMER_SERVICE', 'DISPATCHER', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'ARBITRATOR', 'SUPER_ADMIN'].includes(user.role)) {
    throw new Error('该账号非管理/客服账号，请使用接单端登录');
  }
  if (user.status !== 'ACTIVE') throw new Error('账号已停用');
  clearLoginFailure(user);
  const access = sessionAccess(db, user);
  return { token: issueSessionToken({ userId: user._id, role: user.role, ...access }, getSessionSecret()), user: publicUser(user), role: user.role, ...access };
}

// 接单人员登录（WORKER）：返回 mustChangePwd 标志。
export function workerLogin(db, { phone, password }) {
  const user = findOne(db, 'users', (u) => u.phone === phone);
  if (!user || user.passwordHash !== hashPassword(password)) {
    if (user) recordLoginFailure(user);
    throw new Error('手机号或密码错误');
  }
  assertNotLocked(user);
  if (user.role !== 'WORKER') throw new Error('该账号非接单账号');
  if (user.status !== 'ACTIVE') throw new Error('账号已停用');
  clearLoginFailure(user);
  return {
    token: issueSessionToken({ userId: user._id, role: 'WORKER', ...sessionAccess(db, user) }, getSessionSecret()),
    user: publicUser(user),
    mustChangePwd: user.mustChangePwd === true,
  };
}

// 修改密码：校验旧密码，更新为新密码，清除强制改密标记。
export function changePassword(db, { oldPassword, newPassword }, session) {
  authorize('changePassword', session);
  if (!newPassword || newPassword.length < 6) throw new Error('新密码长度不能少于 6 位');
  const user = getById(db, 'users', session.userId);
  if (!user) throw new Error('用户不存在');
  if (user.passwordHash !== hashPassword(oldPassword)) throw new Error('旧密码错误');
  user.passwordHash = hashPassword(newPassword);
  user.mustChangePwd = false;
  user.updatedAt = Date.now();
  return { ok: true };
}

// 登录后的权限真相来源：前端菜单只消费该结果，服务端仍逐 action 强制鉴权。
export function getAccessProfile(db, payload, session) {
  authorize('getAccessProfile', session);
  return accessProfile(session);
}

/* ---------------- 账号管理（ADMIN） ---------------- */

// 创建后台员工（ADMIN/CS）；WORKER 请走 createWorker。
export function createStaff(db, { role, phone, password, nickname, brandId = 'default', requestId = '' }, session) {
  authorize('createStaff', session);
  const normalizedRole = normalizeRole(role);
  if (!['ADMIN', 'CUSTOMER_SERVICE', 'DISPATCHER', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'ARBITRATOR', 'SUPER_ADMIN'].includes(normalizedRole)) {
    throw new Error('后台员工角色不在允许范围');
  }
  if (!phone || !password) throw new Error('手机号和密码不能为空');
  if (existsBy(db, 'users', (u) => u.phone === phone)) throw new Error('手机号已存在');
  const created = insert(db, 'users', {
    role: normalizedRole,
    phone,
    passwordHash: hashPassword(password),
    nickname: nickname || phone,
    status: 'ACTIVE',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  if (!['ADMIN', 'SUPER_ADMIN'].includes(normalizedRole)) {
    insert(db, 'user_brand_roles', {
      userId: created._id, brandId, roles: [normalizedRole], permissions: [], status: 'ACTIVE', createdAt: Date.now(), updatedAt: Date.now(),
    });
  }
  appendAudit(db, { brandId, action: 'createStaff', resourceType: 'user', resourceId: created._id, after: publicUser(created), requestId }, session);
  return publicUser(created);
}

// 账号列表（管理端）。
export function listUsers(db, { brandId } = {}, session) {
  authorize('listUsers', session);
  return db.users
    .filter((user) => !brandId || userHasBrandScope(db, user._id, brandId))
    .map(publicUser);
}

// 启用/停用账号、开启/关闭接单权限。
export function updateStaff(db, { userId, status, acceptEnabled, requestId = '' }, session) {
  authorize('updateStaff', session);
  const user = getById(db, 'users', userId);
  if (!user) throw new Error('用户不存在');
  const before = publicUser({ ...user });
  if (status !== undefined) user.status = status;
  if (acceptEnabled !== undefined && user.role === 'WORKER') user.acceptEnabled = acceptEnabled;
  user.updatedAt = Date.now();
  const roleRow = db.user_brand_roles.find((row) => row.userId === userId);
  appendAudit(db, { brandId: roleRow?.brandId || 'default', action: 'updateStaff', resourceType: 'user', resourceId: userId, before, after: publicUser(user), requestId }, session);
  return publicUser(user);
}

export function listUserBrandRoles(db, { userId, brandId } = {}, session) {
  authorize('listUserBrandRoles', session);
  return db.user_brand_roles.filter((row) => {
    if (userId && row.userId !== userId) return false;
    if (brandId && row.brandId !== brandId) return false;
    return canSessionAccessBrand(session, row.brandId);
  });
}

export function saveUserBrandRoles(db, { userId, brandId, roles = [], permissions = [], status = 'ACTIVE', requestId = '' }, session) {
  authorize('saveUserBrandRoles', session);
  if (!getById(db, 'users', userId)) throw new Error('用户不存在');
  if (!brandId) throw new Error('brandId 不能为空');
  assertSessionBrand(session, brandId);
  const existed = db.user_brand_roles.find((row) => row.userId === userId && row.brandId === brandId);
  const before = existed ? { ...existed } : null;
  const doc = { userId, brandId, roles: [...new Set(roles.map(normalizeRole))], permissions: [...new Set(permissions)], status, updatedAt: Date.now() };
  const saved = existed ? Object.assign(existed, doc) : insert(db, 'user_brand_roles', { ...doc, createdAt: Date.now() });
  appendAudit(db, { brandId, action: 'saveUserBrandRoles', resourceType: 'user_brand_role', resourceId: saved._id, before, after: { ...saved }, requestId }, session);
  return saved;
}

export function listAuditLogs(db, { brandId, action, resourceType } = {}, session) {
  authorize('listAuditLogs', session);
  return db.audit_logs
    .filter((row) => !brandId || row.brandId === brandId)
    .filter((row) => canSessionAccessBrand(session, row.brandId))
    .filter((row) => !action || row.action === action)
    .filter((row) => !resourceType || row.resourceType === resourceType)
    .sort((a, b) => b.createdAt - a.createdAt);
}

// 冻结/解冻钱包与接单（scope 三元：WITHDRAW 仅冻提现 / BOTH 冻提现+冻接单 / NONE 解除）。
export function freezeWallet(db, { workerId, scope }, session) {
  authorize('freezeWallet', session);
  if (!['WITHDRAW', 'BOTH', 'NONE'].includes(scope)) throw new Error('冻结范围必须为 WITHDRAW/BOTH/NONE');
  return transaction(db, () => {
    const wallet = ensureWallet(db, workerId);
    if (scope === 'BOTH') {
      setWalletFreeze(wallet, { withdrawal: true, accept: true });
    } else if (scope === 'WITHDRAW') {
      setWalletFreeze(wallet, { withdrawal: true });
      clearWalletFreeze(wallet, { accept: true });
    } else {
      clearWalletFreeze(wallet, { withdrawal: true, accept: true });
    }
    wallet.version += 1;
    wallet.updatedAt = Date.now();
    addWalletTx(db, wallet, 'ADJUST', 0, '', { operatorId: session.userId, remark: `钱包冻结调整 scope=${scope}` });
    return wallet;
  });
}

// 创建接单人员：强制首次改密，自动建钱包。
export function createWorker(db, { phone, initialPassword, nickname, brandId = 'default' }, session) {
  authorize('createWorker', session);
  if (!phone || !initialPassword) throw new Error('手机号和初始密码不能为空');
  if (existsBy(db, 'users', (u) => u.phone === phone)) throw new Error('手机号已存在');
  const user = insert(db, 'users', {
    role: 'WORKER',
    phone,
    passwordHash: hashPassword(initialPassword),
    nickname: nickname || phone,
    acceptEnabled: true,
    mustChangePwd: true,
    status: 'ACTIVE',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  insert(db, 'user_brand_roles', { userId: user._id, brandId, roles: ['WORKER'], permissions: [], status: 'ACTIVE', createdAt: Date.now(), updatedAt: Date.now() });
  ensureWallet(db, user._id);
  return publicUser(user);
}

// 更新接单人员（实名状态/启用停用；枚举与管理端 3c 定案一致）。
export function updateWorker(db, { workerId, realnameStatus, status }, session) {
  authorize('updateWorker', session);
  if (status !== undefined && !['ACTIVE', 'DISABLED'].includes(status)) {
    throw new Error('账号状态必须为 ACTIVE/DISABLED');
  }
  if (realnameStatus !== undefined && !['APPROVED', 'PENDING', 'REJECTED'].includes(realnameStatus)) {
    throw new Error('实名状态必须为 APPROVED/PENDING/REJECTED');
  }
  const user = getById(db, 'users', workerId);
  if (!user || user.role !== 'WORKER') throw new Error('接单人员不存在');
  if (status !== undefined) user.status = status;
  user.updatedAt = Date.now();
  let profile = findOne(db, 'worker_profiles', (p) => p.workerId === workerId);
  if (realnameStatus !== undefined) {
    if (!profile) {
      profile = insert(db, 'worker_profiles', { workerId, createdAt: Date.now(), updatedAt: Date.now() });
    }
    profile.realnameStatus = realnameStatus;
    profile.updatedAt = Date.now();
  }
  return publicUser(user);
}

// 接单人员列表（ADMIN）。
export function listWorkers(db, payload, session) {
  authorize('listWorkers', session);
  const requestedBrand = payload && payload.brandId;
  return db.users
    .filter((u) => u.role === 'WORKER')
    .filter((u) => {
      if (requestedBrand) return canSessionAccessBrand(session, requestedBrand) && userHasBrandScope(db, u._id, requestedBrand);
      if (canSessionAccessBrand(session, '*')) return true;
      return (session.brandScopes || []).some((scope) => userHasBrandScope(db, u._id, scope));
    })
    .map(publicUser);
}

/* ---------------- 商品（PUBLIC + ADMIN） ---------------- */

// 商品列表（客户端）：上架商品，可选按 game/brandId 过滤。
export function listProducts(db, { game, brandId, brandCode, appId } = {}) {
  const context = resolveRequestBrand(db, { brandId, brandCode, appId }, { allowDefault: true });
  return db.products
    .filter((p) => p.status === 'ON')
    .filter((p) => (game ? p.game === game : true))
    .filter((p) => !p.brandId || p.brandId === context.brandId)
    .sort((a, b) => (a.sort || 0) - (b.sort || 0))
    .map((product) => ({ ...product, id: product._id }));
}

// 商品详情。
export function getProduct(db, { productId, brandId, brandCode, appId }) {
  const product = getById(db, 'products', productId);
  if (product && product.brandId) {
    const context = resolveRequestBrand(db, { brandId, brandCode, appId }, { allowDefault: true });
    if (product.brandId !== context.brandId) throw new Error('BRAND_FORBIDDEN');
  }
  return product ? { ...product, id: product._id } : null;
}

// 保存商品（新增/编辑，id 幂等 upsert）。
export function saveProduct(db, { id, game, serviceType, tierName, guaranteedOutput, outputUnit, priceFen, commission, commissionRuleId = '', images = [], assetIds = [], status = 'ON', sort = 0, title, formSchema = {}, brandId = 'default', requestId = '', idempotencyKey = '' }, session) {
  authorize('saveProduct', session);
  assertSessionBrand(session, brandId);
  if (!title) throw new Error('商品名不能为空');
  if (!Number.isInteger(priceFen) || priceFen <= 0) throw new Error('商品价格必须为正整数（分）');
  if (!commission) throw new Error('缺少抽成配置');
  if (!['ON', 'OFF'].includes(status)) throw new Error('商品状态必须为 ON/OFF');
  if (!Number.isInteger(sort)) throw new Error('商品排序必须为整数');
  for (const assetId of assetIds) {
    const asset = getById(db, 'attachments', assetId);
    if (!asset || (asset.brandId || 'default') !== brandId) throw new Error('商品资产不存在或不属于当前品牌');
  }
  if (commissionRuleId) {
    const rule = getById(db, 'commission_rules', commissionRuleId);
    if (!rule || rule.brandId !== brandId) throw new Error('佣金规则不存在或不属于当前品牌');
  }
  const now = Date.now();
  if (id) {
    const product = getById(db, 'products', id);
    if (!product) throw new Error('商品不存在');
    if (product.brandId && product.brandId !== brandId) assertSessionBrand(session, product.brandId);
    const before = { ...product };
    Object.assign(product, { title, priceFen, images, assetIds, status, sort, formSchema, commission, commissionRuleId, game, serviceType, tierName, guaranteedOutput, outputUnit, brandId, version: (product.version || 1) + 1, updatedAt: now });
    appendAudit(db, { brandId, action: 'saveProduct', resourceType: 'product', resourceId: id, before, after: { ...product }, requestId: requestId || idempotencyKey }, session);
    return product;
  }
  const created = insert(db, 'products', {
    title,
    game,
    serviceType,
    tierName,
    guaranteedOutput,
    outputUnit,
    priceFen,
    images,
    assetIds,
    status,
    sort,
    formSchema,
    commission,
    commissionRuleId,
    version: 1,
    brandId,
    createdAt: now,
    updatedAt: now,
  });
  appendAudit(db, { brandId, action: 'saveProduct', resourceType: 'product', resourceId: created._id, after: { ...created }, requestId: requestId || idempotencyKey }, session);
  return created;
}

// 上架/下架。
export function updateProductStatus(db, { productId, status, requestId = '', idempotencyKey = '' }, session) {
  authorize('updateProductStatus', session);
  const product = getById(db, 'products', productId);
  if (!product) throw new Error('商品不存在');
  assertSessionBrand(session, product.brandId || 'default');
  const before = { ...product };
  product.status = status;
  product.updatedAt = Date.now();
  appendAudit(db, { brandId: product.brandId || 'default', action: 'updateProductStatus', resourceType: 'product', resourceId: productId, before, after: { ...product }, requestId: requestId || idempotencyKey }, session);
  return product;
}

/* ---------------- 字典 / 配置 / VIP（ADMIN） ---------------- */

// 字典列表。
export function listDicts(db, { type }, session) {
  authorize('listDicts', session);
  return db.dicts
    .filter((d) => (type ? d.type === type : true))
    .sort((a, b) => (a.sort || 0) - (b.sort || 0));
}

// 保存字典（type+code 唯一）。
export function saveDict(db, { type, code, name, sort = 0 }, session) {
  authorize('saveDict', session);
  if (!type || !code || !name) throw new Error('字典类型/编码/名称不能为空');
  const existed = findOne(db, 'dicts', (d) => d.type === type && d.code === code);
  if (existed) {
    Object.assign(existed, { name, sort, updatedAt: Date.now() });
    return existed;
  }
  return insert(db, 'dicts', { type, code, name, sort, status: 'ON', createdAt: Date.now(), updatedAt: Date.now() });
}

// 读取配置（cfgKey 唯一，camelCase 键；未覆盖项回落默认值）。
export function getConfigs(db, payload, session) {
  authorize('getConfigs', session);
  const out = { ...DEFAULT_CONFIGS };
  for (const c of db.configs) out[c.cfgKey] = c.cfgValue;
  return out;
}

// 批量更新配置。
export function updateConfigs(db, { configs }, session) {
  authorize('updateConfigs', session);
  if (!configs || typeof configs !== 'object') throw new Error('缺少配置对象');
  for (const [key, value] of Object.entries(configs)) {
    const existed = findOne(db, 'configs', (c) => c.cfgKey === key);
    if (existed) {
      existed.cfgValue = value;
      existed.updatedAt = Date.now();
    } else {
      insert(db, 'configs', { cfgKey: key, cfgValue: value, createdAt: Date.now(), updatedAt: Date.now() });
    }
  }
  return getConfigs(db, {}, session);
}

// 新增 VIP（matchKey 唯一）。
export function addVip(db, { matchKey, matchType, note = '' }, session) {
  authorize('addVip', session);
  if (!matchKey || !['phone', 'wechat'].includes(matchType)) throw new Error('VIP 匹配值或类型非法');
  if (existsBy(db, 'vip_list', (v) => v.matchKey === matchKey && v.matchType === matchType)) throw new Error('VIP 已存在');
  return insert(db, 'vip_list', { matchKey, matchType, note, status: 'ON', createdAt: Date.now(), updatedAt: Date.now() });
}

// 移除 VIP。
export function removeVip(db, { matchKey, matchType }, session) {
  authorize('removeVip', session);
  const removed = removeWhere(db, 'vip_list', (v) => v.matchKey === matchKey && v.matchType === matchType);
  return { ok: removed > 0 };
}

// VIP 列表。
export function listVips(db, payload, session) {
  authorize('listVips', session);
  return db.vip_list;
}

/* ---------------- H5 下单链路 ---------------- */

function verifyActiveH5Token(db, token) {
  const payload = verifyH5Token(token, getH5Secret());
  if ((db.h5_token_revocations || []).some((item) => item._id === payload.jti)) throw new Error('H5 下单链接已失效');
  return payload;
}

// 签发 H5 下单 token（绑定 openid + productId，短 TTL）。
export function h5Token(db, { productId }, session) {
  authorize('h5Token', session);
  const secret = getH5Secret();
  if (!productId) throw new Error('productId 不能为空');
  const product = getById(db, 'products', productId);
  if (!product || product.status !== 'ON') throw new Error('商品已下架或不存在');
  const brandId = product.brandId || (session.brandScopes && session.brandScopes[0]) || 'default';
  assertSessionBrand(session, brandId);
  return { token: issueH5Token({ openid: session.userId, productId, brandId, mode: 'app' }, secret) };
}

// H5 通过 token 换取商品与 schema。
export function getH5Product(db, { token }) {
  const payload = verifyActiveH5Token(db, token);
  const product = getById(db, 'products', payload.productId);
  if (!product || product.status !== 'ON') throw new Error('商品已下架或不存在');
  if (payload.brandId && product.brandId && payload.brandId !== product.brandId) throw new Error('BRAND_CHANNEL_MISMATCH');
  return { product: { ...product, id: product._id }, openid: payload.openid, productId: product._id };
}

// H5 创建待支付订单：h5Token 绑定 openid 作为客户身份，快照商品抽成与保底产出；formSchema 动态字段拍平落 formData。
function validateDynamicForm(formSchema, formData) {
  const schema = formSchema && typeof formSchema === 'object' ? formSchema : {};
  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const key of required) {
    if (formData[key] === undefined || formData[key] === null || String(formData[key]).trim() === '') throw new Error(`缺少必填下单字段：${key}`);
  }
  const properties = schema.properties || {};
  for (const [key, value] of Object.entries(formData)) {
    const type = properties[key]?.type;
    if (type === 'number' && value !== '' && !Number.isFinite(Number(value))) throw new Error(`下单字段 ${key} 必须为数字`);
  }
}

export function createOrderFromH5(db, payload = {}) {
  const { h5Token, contactWechat = '', contactPhone = '', clientOrderNo, idempotencyKey, ...dynamicFields } = payload;
  const requestKey = idempotencyKey || clientOrderNo || '';
  const { openid, productId } = getH5Product(db, { token: h5Token });
  const product = getById(db, 'products', productId);
  const brandId = product.brandId || 'default';
  const idempotencyScope = `${brandId}:${openid || contactWechat || contactPhone}`;
  validateDynamicForm(product.formSchema, dynamicFields);
  // 幂等：重复提交（相同 clientOrderNo）返回已建订单。
  if (requestKey) {
    const existed = findOne(db, 'orders', (o) => (o.idempotencyScope || `${o.brandId || 'default'}:${o.customerId || o.contactWechat || o.contactPhone}`) === idempotencyScope && (o.idempotencyKey === requestKey || o.clientOrderNo === requestKey));
    if (existed) return { orderId: existed._id, orderNo: existed.orderNo, amountFen: existed.amountFen, payDeadline: existed.payDeadline, duplicate: true, paymentId: existed.paymentId || '' };
  }
  const _id = newId(db, 'order');
  const order = createOrder({
    id: _id,
    amountFen: product.priceFen,
    productId,
    customerId: openid,
    contactWechat,
    contactPhone,
    productSnapshot: {
      title: product.title,
      coverImage: (product.images && product.images[0]) || '',
      priceFen: product.priceFen,
      guaranteedOutput: product.guaranteedOutput,
      outputUnit: product.outputUnit,
    },
  });
  order._id = _id;
  delete order.id;
  order.orderNo = `P${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${_id.replace(/\D/g, '')}`;
  order.brandId = brandId;
  const brand = db.brands.find((item) => item.brandId === order.brandId);
  order.brandSnapshot = {
    brandId: order.brandId, brandCode: brand?.code || order.brandId, name: brand?.name || order.brandId,
    version: brand?.publishedVersion || brand?.version || 1,
    publicConfig: structuredClone(brand?.publicConfig || {}),
  };
  order.commission = product.commission;   // 下单时快照抽成配置（§C.1）
  const activeRule = (product.commissionRuleId && getById(db, 'commission_rules', product.commissionRuleId))
    || db.commission_rules.filter((rule) => rule.brandId === order.brandId && ['ACTIVE', 'DEMO_ONLY'].includes(rule.status) && rule.effectiveAt <= Date.now()).sort((a, b) => b.version - a.version)[0];
  order.commissionRuleSnapshot = activeRule
    ? { ruleId: activeRule._id, version: activeRule.version, status: activeRule.status, rule: structuredClone(activeRule.rule) }
    : { ruleId: '', version: product.version || 1, status: 'DEMO_ONLY', rule: structuredClone(product.commission) };
  order.guaranteedOutput = product.guaranteedOutput;
  order.clientOrderNo = requestKey;
  order.idempotencyKey = requestKey;
  order.idempotencyScope = idempotencyScope;
  order.formData = dynamicFields;   // formSchema 动态字段拍平后的附加键
  // 下单时按 VIP 名单匹配打标。
  order.isVip = existsBy(db, 'vip_list', (v) => v.status === 'ON' && v.matchType === 'wechat' && v.matchKey === contactWechat)
    || existsBy(db, 'vip_list', (v) => v.status === 'ON' && v.matchType === 'phone' && v.matchKey === contactPhone);
  db.orders.push(order);
  writeOrderLog(db, order, { action: 'create', fromStatus: '', toStatus: order.status, operatorType: 'customer', operatorId: openid });
  return { orderId: order._id, orderNo: order.orderNo, amountFen: order.amountFen, payDeadline: order.payDeadline, duplicate: false };
}

// 客服/管理员撤销已泄露或误发的 H5 下单 token；jti 使用主键保证幂等。
export function revokeH5Token(db, { token, jti, reason = 'manual-revoke' } = {}, session) {
  authorize('revokeH5Token', session);
  const claims = token ? verifyH5Token(token, getH5Secret()) : null;
  const tokenId = jti || (claims && claims.jti);
  if (!tokenId || !/^[A-Za-z0-9_-]{16,128}$/.test(tokenId)) throw new Error('H5 token jti 非法');
  const existed = (db.h5_token_revocations || []).find((item) => item._id === tokenId);
  if (existed) return { revoked: true, duplicate: true, jti: tokenId };
  const row = insert(db, 'h5_token_revocations', {
    _id: tokenId, brandId: (claims && claims.brandId) || 'default', reason,
    revokedBy: session.userId, revokedAt: Date.now(), expiresAt: (claims && claims.exp) || Date.now() + H5_TOKEN_TTL_MS,
  });
  return { revoked: true, duplicate: false, jti: row._id };
}

function getPaymentMode() {
  const mode = String(process.env.PAYMENT_MODE || (process.env.NODE_ENV === 'production' ? 'wechat' : 'mock')).toLowerCase();
  return createPaymentAdapter(mode).mode;
}

function paymentChannel(mode, payType) {
  return createPaymentAdapter(mode).channel(payType);
}

function ensurePayment(db, order, { payType, idempotencyKey = '' }) {
  const mode = getPaymentMode();
  const channel = paymentChannel(mode, payType);
  const key = idempotencyKey || `${order._id}:${channel}`;
  let payment = findOne(db, 'payments', (row) => row.brandId === order.brandId && row.idempotencyKey === key);
  if (payment) return payment;
  const brand = db.brands.find((row) => row.brandId === order.brandId);
  const secretRef = mode === 'wechat' ? brand?.channelRefs?.paymentSecretRef : '';
  if (mode === 'wechat' && !secretRef) throw new Error('当前品牌未配置支付 secretRef');
  payment = insert(db, 'payments', {
    paymentNo: `PAY${Date.now()}${String(db.payments.length + 1).padStart(4, '0')}`,
    brandId: order.brandId,
    orderId: order._id,
    channel,
    amountFen: order.amountFen,
    status: 'PENDING',
    idempotencyKey: key,
    secretRef: secretRef || '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  order.paymentId = payment._id;
  order.paymentStatus = payment.status;
  order.updatedAt = Date.now();
  return payment;
}

function applyPaymentSuccess(db, payment, { transactionId, amountFen, brandId }) {
  if (payment.status === 'SUCCESS') return { code: 'SUCCESS', paymentId: payment._id, duplicate: true };
  const order = getById(db, 'orders', payment.orderId);
  if (!order) throw new Error('订单不存在');
  const failureReason = payment.brandId !== order.brandId || (brandId && brandId !== order.brandId)
    ? '支付品牌不匹配'
    : payment.amountFen !== order.amountFen || (amountFen !== undefined && amountFen !== payment.amountFen) ? '支付金额不符' : '';
  if (failureReason) {
    payment.status = 'FAILED'; payment.failureReason = failureReason; payment.updatedAt = Date.now();
    for (const admin of db.users.filter((user) => ['ADMIN', 'SUPER_ADMIN'].includes(normalizeRole(user.role)))) {
      insert(db, 'notifications', { brandId: order.brandId || 'default', receiverId: admin._id, channel: 'INBOX', template: 'PAYMENT_MISMATCH', payload: { paymentId: payment._id, orderId: order._id, reason: failureReason }, status: 'SENT', createdAt: Date.now() });
    }
    appendAudit(db, { brandId: order.brandId || 'default', action: 'paymentMismatch', resourceType: 'payment', resourceId: payment._id, after: { ...payment } }, { userId: 'payment-system', role: 'SYSTEM' });
    throw new Error(failureReason);
  }
  if (order.status !== OrderStatus.PENDING_PAYMENT) throw new Error('订单当前状态不可支付');
  return transaction(db, () => {
    const duplicateTx = db.payments.find((row) => row._id !== payment._id && row.providerTransactionId === transactionId);
    if (duplicateTx) throw new Error('支付流水已被其他支付单使用');
    payOrder(order, { paidAt: Date.now(), transactionId, payerOpenid: order.customerId });
    payment.status = 'SUCCESS';
    payment.providerTransactionId = transactionId;
    payment.paidAt = order.paidAt;
    payment.updatedAt = Date.now();
    order.paymentId = payment._id;
    order.paymentStatus = 'SUCCESS';
    // 旧字段仅在迁移期继续写入，权威记录为 payments。
    order.transactionId = transactionId;
    writeOrderLog(db, order, { action: 'pay', fromStatus: OrderStatus.PENDING_PAYMENT, toStatus: order.status, operatorType: 'system', payloadSnapshot: { paymentId: payment._id } });
    return { code: 'SUCCESS', paymentId: payment._id, duplicate: false };
  });
}

// 获取支付参数：先创建独立支付单，Mock/微信共用同一成功入口。
export function getPaymentParams(db, { orderId, payType = 'MWEB', h5Token, idempotencyKey = '' }, session) {
  authorize('getPaymentParams', session);
  if (!['JSAPI', 'MWEB'].includes(payType)) throw new Error('payType 必须为 JSAPI/MWEB');
  const order = getById(db, 'orders', orderId);
  if (!order) throw new Error('订单不存在');
  if (order.status !== OrderStatus.PENDING_PAYMENT) throw new Error('订单当前状态不可支付');
  // 绑定/归属校验：继续支付优先用 H5 token，无 token 时按会话主体。
  if (h5Token) {
    const payload = verifyActiveH5Token(db, h5Token);
    if (payload.productId !== order.productId) throw new Error('下单 token 与订单商品不一致');
  } else if (order.customerId !== session.userId) {
    throw new Error('无权操作该订单');
  }
  const mode = getPaymentMode();
  const adapter = createPaymentAdapter(mode);
  const payment = ensurePayment(db, order, { payType, idempotencyKey });
  if (mode === 'mock') {
    return adapter.clientParams({ payment, payType });
  }
  if (payType === 'JSAPI') {
    // 微信规范 jsapi 调起支付参数（本地替身为模拟值，生产由服务端统一下单生成）。
    const appId = process.env.WECHAT_PAY_APPID || 'wx-mock-appid';
    const timeStamp = String(Math.floor(Date.now() / 1000));
    const nonceStr = Math.random().toString(36).slice(2, 12);
    const pkg = `prepay_id=mock_${order.orderNo}`;
    const signType = 'RSA';
    const paySign = createHash('sha256').update(`${appId}${timeStamp}${nonceStr}${pkg}`).digest('hex');
    payment.providerPrepayId = `prepay_${order.orderNo}`;
    payment.updatedAt = Date.now();
    return adapter.clientParams({ payment, payType, jsapi: { appId, timeStamp, nonceStr, package: pkg, signType, paySign } });
  }
  const mwebUrl = `${H5_ORDER_BASE_URL}/h5-order/pay/${order.orderNo}`;
  return adapter.clientParams({ payment, payType, mwebUrl });
}

export function confirmMockPayment(db, { paymentId }, session) {
  authorize('confirmMockPayment', session);
  if (getPaymentMode() !== 'mock') throw new Error('非 development/mock 环境禁止模拟支付');
  const payment = getById(db, 'payments', paymentId);
  if (!payment) throw new Error('支付单不存在');
  const order = getById(db, 'orders', payment.orderId);
  if (!order || order.customerId !== session.userId) throw new Error('无权操作该支付单');
  return applyPaymentSuccess(db, payment, { transactionId: `mock-tx-${payment.paymentNo}`, amountFen: payment.amountFen, brandId: payment.brandId });
}

export function getPaymentStatus(db, { paymentId, orderId, h5Token } = {}) {
  const payment = paymentId ? getById(db, 'payments', paymentId) : db.payments.filter((row) => row.orderId === orderId).sort((a, b) => b.createdAt - a.createdAt)[0];
  if (!payment) throw new Error('支付单不存在');
  const order = getById(db, 'orders', payment.orderId);
  const tokenPayload = verifyActiveH5Token(db, h5Token);
  if (!order || tokenPayload.productId !== order.productId || tokenPayload.brandId !== order.brandId) throw new Error('无权查询该支付单');
  return { paymentId: payment._id, paymentNo: payment.paymentNo, orderId: payment.orderId, status: payment.status, paidAt: payment.paidAt || 0, failureReason: payment.failureReason || '' };
}

export function listPayments(db, { orderId, brandId, status } = {}, session) {
  authorize('listPayments', session);
  return db.payments.filter((payment) => canSessionAccessBrand(session, payment.brandId))
    .filter((payment) => !orderId || payment.orderId === orderId)
    .filter((payment) => !brandId || payment.brandId === brandId)
    .filter((payment) => !status || payment.status === status);
}

// 支付回调：按独立支付单/providerTransactionId 唯一去重。
export function payNotify(db, { paymentId, orderId, orderNo, transactionId, amountFen, brandId }) {
  if (!transactionId) throw new Error('缺少微信支付流水号');
  const duplicate = findOne(db, 'payments', (row) => row.providerTransactionId === transactionId && row.status === 'SUCCESS');
  if (duplicate) return { code: 'SUCCESS', paymentId: duplicate._id, duplicate: true };
  let payment = paymentId ? getById(db, 'payments', paymentId) : null;
  const resolvedOrderId = orderId || payment?.orderId;
  const order = resolvedOrderId ? getById(db, 'orders', resolvedOrderId) : findOne(db, 'orders', (o) => o.orderNo === orderNo);
  if (!order) throw new Error('订单不存在');
  if (!payment) payment = db.payments.filter((row) => row.orderId === order._id).sort((a, b) => b.createdAt - a.createdAt)[0];
  // 旧订单迁移期：回调到达时补建支付单。
  if (!payment) payment = ensurePayment(db, order, { payType: 'MWEB', idempotencyKey: `legacy:${order._id}` });
  return applyPaymentSuccess(db, payment, { transactionId, amountFen, brandId });
}

// 转账回调（二期预留）：按 batchNo 唯一更新 transfer_records。
export function transferNotify(db, { batchNo, status }, session) {
  authorize('transferNotify', session);
  if (!batchNo) throw new Error('缺少转账凭证号');
  const rec = findOne(db, 'transfer_records', (t) => t.batchNo === batchNo);
  if (rec) {
    rec.status = status || 'PAID';
  }
  return { code: 'SUCCESS' };
}

/* ---------------- 客户订单 ---------------- */

// 我的订单：仅返回会话本人订单（CUSTOMER 按 customerId，WORKER 按 workerId）。
export function listMyOrders(db, payload, session) {
  authorize('listMyOrders', session);
  if (session.role === 'WORKER') {
    return db.orders.filter((o) => o.workerId === session.userId && canSessionAccessBrand(session, o.brandId || 'default')).map((o) => ({ ...toClientOrderDto(o), allowedActions: computeServiceAllowedActions(o, session) }));
  }
  return db.orders.filter((o) => o.customerId === session.userId && canSessionAccessBrand(session, o.brandId || 'default')).map(toClientOrderDto);
}

// 我的订单详情（归属校验）。
export function getMyOrder(db, { orderId }, session) {
  authorize('getMyOrder', session);
  const order = getById(db, 'orders', orderId);
  if (!order) throw new Error('订单不存在');
  assertSessionBrand(session, order.brandId || 'default');
  const own = session.role === 'WORKER' ? order.workerId === session.userId : order.customerId === session.userId;
  if (!own) throw new Error('无权查看该订单');
  const dto = toClientOrderDto(order);
  return session.role === 'WORKER' ? { ...dto, allowedActions: computeServiceAllowedActions(order, session) } : dto;
}

// 订单公开查询（无会话）：orderNo 相等且 contactWechat/contactPhone 任一匹配，返回单条脱敏 DTO。
export function queryOrderByNo(db, { orderNo, contactPhone, contactWechat } = {}) {
  if (!orderNo) throw new Error('订单号不能为空');
  if (!contactPhone && !contactWechat) throw new Error('请提供手机号或微信号进行校验');
  const order = findOne(db, 'orders', (o) => o.orderNo === orderNo);
  if (!order) throw new Error('订单不存在或联系方式不匹配');
  const phoneMatch = contactPhone ? order.contactPhone === contactPhone : false;
  const wechatMatch = contactWechat ? order.contactWechat === contactWechat : false;
  if (!(phoneMatch || wechatMatch)) throw new Error('订单不存在或联系方式不匹配');
  return toQueryOrderDto(order);
}

// 提交异议（一单一异议，72h 窗口内）。
export function submitDispute(db, { orderId, content, attachmentIds = [] }, session) {
  authorize('submitDispute', session);
  const order = getById(db, 'orders', orderId);
  if (!order) throw new Error('订单不存在');
  if (order.customerId !== session.userId) throw new Error('无权操作该订单');
  if (existsBy(db, 'disputes', (d) => d.orderId === orderId)) throw new Error('该订单已有异议');
  if (!content) throw new Error('异议内容不能为空');
  const dispute = transaction(db, () => {
    openDispute(order, { customerId: session.userId, content });
    const d = insert(db, 'disputes', {
      brandId: order.brandId || 'default',
      orderId: order._id,
      customerId: session.userId,
      content,
      attachmentIds,
      status: 'OPEN',
      evidence: [{ side: 'CUSTOMER', submitterId: session.userId, content, attachmentIds, createdAt: Date.now() }],
      timeline: [{ action: 'OPEN', operatorId: session.userId, createdAt: Date.now() }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    writeOrderLog(db, order, { action: 'dispute', fromStatus: OrderStatus.SETTLED, toStatus: order.status, operatorType: 'customer', operatorId: session.userId });
    return d;
  });
  return { disputeId: dispute._id };
}

// 订阅消息授权（一单一授权）。
export function requestSubscribe(db, { templateKey, orderId }, session) {
  authorize('requestSubscribe', session);
  const order = getById(db, 'orders', orderId);
  if (!order) throw new Error('订单不存在');
  if (order.customerId !== session.userId) throw new Error('无权操作该订单');
  if (existsBy(db, 'subscribe_quota', (q) => q.orderId === orderId && q.templateKey === templateKey)) {
    return { granted: true };
  }
  insert(db, 'subscribe_quota', { brandId: order.brandId || 'default', customerId: session.userId, templateKey, grantedAt: Date.now(), orderId });
  return { granted: true };
}

// 我的通知。
export function listNotifications(db, payload, session) {
  authorize('listNotifications', session);
  return db.notifications.filter((n) => n.receiverId === session.userId);
}

// 标记已读。
export function markRead(db, { notificationId }, session) {
  authorize('markRead', session);
  const n = getById(db, 'notifications', notificationId);
  if (!n) throw new Error('通知不存在');
  if (n.receiverId !== session.userId) throw new Error('无权操作该通知');
  n.status = 'READ';
  return n;
}

/* ---------------- 客服/管理端订单 ---------------- */

// 订单列表（筛选/搜索）。
export function listOrders(db, { status, game, serviceType, from, to, keyword, brandId } = {}, session) {
  authorize('listOrders', session);
  return db.orders.filter((o) => {
    if (!canSessionAccessBrand(session, o.brandId || 'default')) return false;
    if (brandId && o.brandId !== brandId) return false;
    if (status && o.status !== status) return false;
    if (game && o.game !== game) return false;
    if (serviceType && o.serviceType !== serviceType) return false;
    if (from != null && o.createdAt < from) return false;
    if (to != null && o.createdAt > to) return false;
    if (keyword) {
      const hay = `${o.orderNo || ''}${o.customerNickname || ''}${o.customerUid || ''}`;
      if (!hay.includes(keyword)) return false;
    }
    return true;
  }).map((order) => ({ ...order, allowedActions: computeServiceAllowedActions(order, session) }));
}

// 订单详情（含流水/退款/提现关联）。
export function getOrder(db, { orderId }, session) {
  authorize('getOrder', session);
  const order = getById(db, 'orders', orderId);
  if (!order) throw new Error('订单不存在');
  assertSessionBrand(session, order.brandId || 'default');
  const refunds = db.refunds.filter((r) => r.orderId === orderId);
  return {
    order: { ...order, allowedActions: computeServiceAllowedActions(order, session) },
    logs: db.order_logs.filter((l) => l.orderId === orderId),
    attachments: db.attachments.filter((a) => a.bizId === orderId),
    refund: refunds[refunds.length - 1] || null,
    dispute: findOne(db, 'disputes', (d) => d.orderId === orderId) || null,
    payments: db.payments.filter((payment) => payment.orderId === orderId),
    assignments: db.assignments.filter((assignment) => assignment.orderId === orderId),
  };
}

// 客服录入完成：待受理 -> 待抢单（进池）；可选修正联系方式（变更留 order_logs）。
export function enterOrder(db, { orderId, game, region, serviceType, customerUid, customerNickname, expectStartAt, requirementNote, sessionNote, internalNote, contactWechat, contactPhone }, session) {
  authorize('enterOrder', session);
  const order = getById(db, 'orders', orderId);
  if (!order) throw new Error('订单不存在');
  const from = order.status;
  transaction(db, () => {
    enterOrderDomain(order, { game, region, serviceType, customerUid, customerNickname, expectStartAt, requirementNote, sessionNote, internalNote });
    // K-05：客服可修正联系方式，变更留痕。
    const changed = [];
    if (contactWechat !== undefined && contactWechat !== order.contactWechat) {
      order.contactWechat = contactWechat;
      changed.push('contactWechat');
    }
    if (contactPhone !== undefined && contactPhone !== order.contactPhone) {
      order.contactPhone = contactPhone;
      changed.push('contactPhone');
    }
    writeOrderLog(db, order, {
      action: 'enter',
      fromStatus: from,
      toStatus: order.status,
      operatorType: session.role === 'ADMIN' ? 'admin' : 'cs',
      operatorId: session.userId,
      remark: changed.length ? `修正联系方式:${changed.join(',')}` : '',
    });
  });
  return order;
}

// 订单流水。
export function listOrderLogs(db, { orderId }, session) {
  authorize('listOrderLogs', session);
  return db.order_logs.filter((l) => l.orderId === orderId);
}

// 抢单池（含入池时长与超时标）。
export function listPool(db, payload = {}, session) {
  authorize('listPool', session);
  const requestedBrand = payload.brandId || '';
  if (requestedBrand) assertSessionBrand(session, requestedBrand);
  const now = Date.now();
  const poolTimeout = getConfig(db, 'poolTimeoutMinutes') * 60 * 1000;
  return db.orders
    .filter((o) => o.status === OrderStatus.PENDING_GRAB && canSessionAccessBrand(session, o.brandId || 'default'))
    .filter((o) => !requestedBrand || (o.brandId || 'default') === requestedBrand)
    .map((o) => ({ ...o, allowedActions: computeServiceAllowedActions(o, session), pooledDurationMs: now - (o.pooledAt || now), pooledTimeout: (o.pooledAt || now) + poolTimeout < now }));
}

// 指派：待抢单 -> 指派待确认。
export function assignOrder(db, { orderId, workerId, requestId = '', idempotencyKey = '' }, session) {
  authorize('assignOrder', session);
  const order = getById(db, 'orders', orderId);
  if (!order) throw new Error('订单不存在');
  assertSessionBrand(session, order.brandId || 'default');
  if (!userHasBrandScope(db, workerId, order.brandId || 'default')) throw new Error('BRAND_FORBIDDEN');
  const from = order.status;
  const before = { ...order };
  transaction(db, () => {
    assignOrderDomain(order, workerId, { assignedBy: session.userId });
    recordAssignment(db, order, { type: 'ASSIGN', workerId, operatorId: session.userId, requestId: requestId || idempotencyKey });
    writeOrderLog(db, order, {
      action: 'assign', fromStatus: from, toStatus: order.status, operatorType: session.role === 'ADMIN' ? 'admin' : 'cs',
      operatorId: session.userId, operatorRole: session.role, payloadSnapshot: { workerId }, requestId: requestId || idempotencyKey,
    });
    appendAudit(db, {
      brandId: order.brandId || 'default', action: 'assignOrder', resourceType: 'order', resourceId: orderId,
      before, after: { ...order }, requestId: requestId || idempotencyKey,
    }, session);
  });
  return order;
}

export function reassignOrder(db, { orderId, workerId, reason = '', requestId = '', idempotencyKey = '' }, session) {
  authorize('reassignOrder', session);
  const order = getById(db, 'orders', orderId);
  if (!order) throw new Error('订单不存在');
  assertSessionBrand(session, order.brandId || 'default');
  if (![OrderStatus.ASSIGN_PENDING, OrderStatus.IN_SERVICE].includes(order.status)) throw new Error('订单当前状态不允许改派');
  if (!userHasBrandScope(db, workerId, order.brandId || 'default')) throw new Error('BRAND_FORBIDDEN');
  const previousWorkerId = order.workerId || '';
  const before = { ...order };
  transaction(db, () => {
    order.status = OrderStatus.ASSIGN_PENDING;
    order.workerId = workerId;
    order.assignedBy = session.userId;
    order.assignedAt = Date.now();
    order.updatedAt = Date.now();
    recordAssignment(db, order, { type: 'REASSIGN', workerId, previousWorkerId, operatorId: session.userId, reason, requestId: requestId || idempotencyKey });
    writeOrderLog(db, order, { action: 'reassign', fromStatus: before.status, toStatus: order.status, operatorType: 'dispatcher', operatorId: session.userId, operatorRole: session.role, remark: reason, payloadSnapshot: { workerId, previousWorkerId }, requestId: requestId || idempotencyKey });
    appendAudit(db, { brandId: order.brandId || 'default', action: 'reassignOrder', resourceType: 'order', resourceId: orderId, before, after: { ...order }, requestId: requestId || idempotencyKey }, session);
  });
  return order;
}

export function listAssignments(db, { orderId }, session) {
  authorize('listAssignments', session);
  const order = getById(db, 'orders', orderId);
  if (!order) throw new Error('订单不存在');
  assertSessionBrand(session, order.brandId || 'default');
  if (session.role === 'WORKER' && !db.assignments.some((row) => row.orderId === orderId && row.workerId === session.userId)) throw new Error('无权查看该指派历史');
  return db.assignments.filter((row) => row.orderId === orderId).sort((a, b) => a.createdAt - b.createdAt);
}

// 未开工取消申请（待受理/待抢单）：写退款单 + 取消审批子状态。
export function requestCancellation(db, { orderId, reason = '' }, session) {
  authorize('requestCancellation', session);
  const order = getById(db, 'orders', orderId);
  if (!order) throw new Error('订单不存在');
  if (![OrderStatus.PENDING_ACCEPT, OrderStatus.PENDING_GRAB].includes(order.status)) {
    throw new Error('仅未开工订单可发起取消申请');
  }
  const payment = order.paymentId ? getById(db, 'payments', order.paymentId) : null;
  if (!payment || payment.status !== 'SUCCESS' || payment.brandId !== order.brandId || payment.amountFen !== order.amountFen) throw new Error('原支付单不存在或与订单不匹配');
  const result = transaction(db, () => {
    requestUnstartedCancel(order, { requestedBy: session.userId, reason });
    const refund = createRefund(db, order, { type: 'full', ratio: 1, amountFen: order.amountFen, reason, requestedBy: session.userId });
    writeOrderLog(db, order, { action: 'cancel-request', fromStatus: order.status, toStatus: order.status, operatorType: session.role === 'ADMIN' ? 'admin' : 'cs', operatorId: session.userId, remark: reason });
    return { refundId: refund._id };
  });
  return result;
}

// 发起退款：type 枚举冻结为 full/partial_unstarted/partial_progress/partial_output/dispute。
export function requestRefund(db, { orderId, type = 'partial_output', ratio, reason = '' }, session) {
  authorize('requestRefund', session);
  const REFUND_TYPES = ['full', 'partial_unstarted', 'partial_progress', 'partial_output', 'dispute'];
  if (!REFUND_TYPES.includes(type)) {
    throw new Error(`退款类型必须为 ${REFUND_TYPES.join('/')}`);
  }
  const order = getById(db, 'orders', orderId);
  if (!order) throw new Error('订单不存在');
  const payment = order.paymentId ? getById(db, 'payments', order.paymentId) : null;
  if (!payment || payment.status !== 'SUCCESS' || payment.amountFen !== order.amountFen || payment.brandId !== order.brandId) throw new Error('原支付单不存在或与订单不匹配');
  let r = ratio;
  if (r == null) {
    r = type === 'partial_output'
      ? calculateRefundRatio({ actualOutput: order.actualOutput, guaranteedOutput: order.guaranteedOutput })
      : 1;
  }
  const amountFen = calculateRefundAmount({ amountFen: order.amountFen, ratio: r });
  const from = order.status;
  return transaction(db, () => {
    if (type === 'partial_progress') {
      requestServiceRefund(order, { requestedBy: session.userId, ratio: r, reason });
    } else if (type === 'partial_output') {
      requestOutputRefund(order, { requestedBy: session.userId, ratio: r, reason });
    } else if (type === 'full' || type === 'partial_unstarted') {
      // 未开工退款：走取消审批流（requestUnstartedCancel）。
      requestUnstartedCancel(order, { requestedBy: session.userId, reason });
    } else if (type === 'dispute') {
      // 异议退款：由 resolveDispute 触发，此处仅按比例仲裁退款。
      resolveDisputeRefund(order, { resolvedBy: session.userId, result: r >= 1 ? DisputeResult.FULL : DisputeResult.PARTIAL, note: reason });
    }
    const refund = createRefund(db, order, { type, ratio: r, amountFen, reason, requestedBy: session.userId });
    writeOrderLog(db, order, { action: 'refund-request', fromStatus: from, toStatus: order.status, operatorType: 'cs', operatorId: session.userId, remark: reason });
    return { refundId: refund._id };
  });
}

// 审批退款（ADMIN）：批准后（替身）立即完成退款并追回佣金；生产为调微信退款 + 回调收尾。
export function approveRefund(db, { refundId }, session) {
  authorize('approveRefund', session);
  const refund = getById(db, 'refunds', refundId);
  if (!refund) throw new Error('退款单不存在');
  if (refund.status !== 'PENDING_APPROVAL') throw new Error('退款单不在待审批状态');
  const order = getById(db, 'orders', refund.orderId);
  if (!order) throw new Error('订单不存在');
  const payment = refund.paymentId ? getById(db, 'payments', refund.paymentId) : null;
  if (!payment || payment.orderId !== order._id || payment.brandId !== order.brandId || payment.amountFen !== order.amountFen || payment.status !== 'SUCCESS') throw new Error('退款关联支付单校验失败');
  return transaction(db, () => {
    if (refund.type === 'full' && order.cancellation && order.cancellation.status === CancellationStatus.PENDING_REVIEW) {
      // 未开工取消：审批通过 -> 已取消 + 原路退款随审批完成。
      const from = order.status;
      approveUnstartedCancel(order, { approvedBy: session.userId, refundedAt: Date.now() });
      refund.status = 'SUCCESS';
      refund.approvedBy = session.userId;
      refund.wechatRefundId = `wx-refund-${refund._id}`;
      refund.updatedAt = Date.now();
      writeOrderLog(db, order, { action: 'cancel-approve', fromStatus: from, toStatus: order.status, operatorType: 'admin', operatorId: session.userId });
    } else {
      const from = order.status;
      approveRefundDomain(order, { approvedBy: session.userId });
      refund.status = 'PROCESSING';
      refund.approvedBy = session.userId;
      refund.updatedAt = Date.now();
      // 替身模拟微信退款回调立即成功。
      refundSuccess(order, { refundedAt: Date.now(), refundId: `wx-refund-${refund._id}` });
      refund.status = 'SUCCESS';
      refund.wechatRefundId = `wx-refund-${refund._id}`;
      refund.commissionRecoveredFen = recoverCommission(db, order, refund._id);
      refund.updatedAt = Date.now();
      writeOrderLog(db, order, { action: 'refund-approve', fromStatus: from, toStatus: order.status, operatorType: 'admin', operatorId: session.userId });
    }
    return refund;
  });
}

// 驳回退款（ADMIN）。
export function rejectRefund(db, { refundId, reason = '' }, session) {
  authorize('rejectRefund', session);
  const refund = getById(db, 'refunds', refundId);
  if (!refund) throw new Error('退款单不存在');
  if (refund.status !== 'PENDING_APPROVAL') throw new Error('退款单不在待审批状态');
  const order = getById(db, 'orders', refund.orderId);
  transaction(db, () => {
    refund.status = 'REJECTED';
    refund.updatedAt = Date.now();
    if (order && order.cancellation && order.cancellation.status === CancellationStatus.PENDING_REVIEW) {
      rejectCancellation(order, { rejectedBy: session.userId });
    }
  });
  return refund;
}

export function verifyCompletion(db, { orderId, note = '', requestId = '' }, session) {
  authorize('verifyCompletion', session);
  const order = getById(db, 'orders', orderId);
  if (!order) throw new Error('订单不存在');
  assertSessionBrand(session, order.brandId || 'default');
  const before = { ...order };
  transaction(db, () => {
    verifyCompletionDomain(order, { verifiedBy: session.userId, note });
    writeOrderLog(db, order, { action: 'verify-completion', fromStatus: order.status, toStatus: order.status, operatorType: 'cs', operatorId: session.userId, operatorRole: session.role, remark: note, requestId });
    appendAudit(db, { brandId: order.brandId || 'default', action: 'verifyCompletion', resourceType: 'order', resourceId: orderId, before, after: { ...order }, requestId }, session);
  });
  return order;
}

export function rejectCompletion(db, { orderId, reason, requestId = '' }, session) {
  authorize('rejectCompletion', session);
  const order = getById(db, 'orders', orderId);
  if (!order) throw new Error('订单不存在');
  assertSessionBrand(session, order.brandId || 'default');
  const before = { ...order };
  transaction(db, () => {
    const from = order.status;
    rejectCompletionDomain(order, { rejectedBy: session.userId, reason });
    writeOrderLog(db, order, { action: 'reject-completion', fromStatus: from, toStatus: order.status, operatorType: 'cs', operatorId: session.userId, operatorRole: session.role, remark: reason, requestId });
    appendAudit(db, { brandId: order.brandId || 'default', action: 'rejectCompletion', resourceType: 'order', resourceId: orderId, before, after: { ...order }, requestId }, session);
  });
  return order;
}

function settleVerifiedOrder(db, order, { customerConfirmed, requestId = '' }, session) {
  if (order.completedAt) return order;
  if (order.status !== OrderStatus.PENDING_CONFIRM) throw new Error('CONFLICT:订单状态已变化，请刷新');
  const workerId = order.workerId;
  return transaction(db, () => {
    const wallet = ensureWallet(db, workerId);
    const rule = order.commissionRuleSnapshot?.rule || order.commission;
    const earnings = calculateEarnings({ amountFen: order.amountFen, commission: rule });
    confirmSettlementDomain(order, { confirmedBy: session.userId, customerConfirmed });
    creditWallet(wallet, earnings);
    wallet.version += 1;
    wallet.updatedAt = Date.now();
    order.earningsFen = earnings;
    addWalletTx(db, wallet, 'ORDER_EARNINGS', earnings, order._id, { brandId: order.brandId || 'default', orderId: order._id, ruleVersion: order.commissionRuleSnapshot?.version || 0 });
    writeOrderLog(db, order, { action: 'close-order', fromStatus: OrderStatus.PENDING_CONFIRM, toStatus: order.status, operatorType: session.role === 'ADMIN' ? 'admin' : 'cs', operatorId: session.userId, operatorRole: session.role, payloadSnapshot: { ruleVersion: order.commissionRuleSnapshot?.version || 0 }, requestId });
    return order;
  });
}

export function closeOrder(db, { orderId, customerConfirmed = true, requestId = '' }, session) {
  authorize('closeOrder', session);
  const order = getById(db, 'orders', orderId);
  if (!order) throw new Error('订单不存在');
  assertSessionBrand(session, order.brandId || 'default');
  return settleVerifiedOrder(db, order, { customerConfirmed, requestId }, session);
}

// 旧 action 兼容入口：仍严格要求 verificationStatus=VERIFIED。
export function confirmSettlement(db, { orderId, customerConfirmed, requestId = '' }, session) {
  authorize('confirmSettlement', session);
  const order = getById(db, 'orders', orderId);
  if (!order) throw new Error('订单不存在');
  assertSessionBrand(session, order.brandId || 'default');
  return settleVerifiedOrder(db, order, { customerConfirmed, requestId }, session);
}

// 补单（未达上限方可，默认 1 次）。
export function reworkOrder(db, { orderId, note = '' }, session) {
  authorize('reworkOrder', session);
  const order = getById(db, 'orders', orderId);
  if (!order) throw new Error('订单不存在');
  const from = order.status;
  transaction(db, () => {
    reworkOrderDomain(order, { reworkedBy: session.userId, note });
    writeOrderLog(db, order, { action: 'rework', fromStatus: from, toStatus: order.status, operatorType: session.role === 'ADMIN' ? 'admin' : 'cs', operatorId: session.userId, remark: note });
  });
  return order;
}

// 异议仲裁三选一（维持/部分/全额）。
export function resolveDispute(db, { disputeId, result, note }, session) {
  authorize('resolveDispute', session);
  const dispute = getById(db, 'disputes', disputeId);
  if (!dispute) throw new Error('异议不存在');
  if (dispute.status === 'PENDING') dispute.status = 'UNDER_REVIEW';
  if (dispute.status !== 'UNDER_REVIEW') throw new Error('异议必须先进入审理状态');
  const order = getById(db, 'orders', dispute.orderId);
  if (!order) throw new Error('订单不存在');
  return transaction(db, () => {
    const from = order.status;
    if (result === 'maintain') {
      resolveDisputeMaintain(order, { resolvedBy: session.userId, note });
      dispute.status = 'DECIDED';
      dispute.result = 'maintain';
      dispute.resultNote = note;
      writeOrderLog(db, order, { action: 'resolve-maintain', fromStatus: from, toStatus: order.status, operatorType: session.role === 'ADMIN' ? 'admin' : 'cs', operatorId: session.userId, remark: note });
    } else if (result === 'partial' || result === 'full') {
      const domainResult = result === 'full' ? DisputeResult.FULL : DisputeResult.PARTIAL;
      resolveDisputeRefund(order, { resolvedBy: session.userId, result: domainResult, note });
      const r = result === 'full' ? 1 : calculateRefundRatio({ actualOutput: order.actualOutput, guaranteedOutput: order.guaranteedOutput });
      const amountFen = calculateRefundAmount({ amountFen: order.amountFen, ratio: r });
      createRefund(db, order, { type: 'dispute', ratio: r, amountFen, reason: note, requestedBy: session.userId });
      dispute.status = 'DECIDED';
      dispute.result = result;
      dispute.resultNote = note;
      writeOrderLog(db, order, { action: 'resolve-refund', fromStatus: from, toStatus: order.status, operatorType: session.role === 'ADMIN' ? 'admin' : 'cs', operatorId: session.userId, remark: note });
    } else {
      throw new Error('仲裁结果必须为 maintain/partial/full');
    }
    dispute.handledBy = session.userId;
    dispute.handledAt = Date.now();
    dispute.arbitratorId = session.userId;
    dispute.decidedAt = Date.now();
    dispute.timeline = [...(dispute.timeline || []), { action: 'DECIDED', operatorId: session.userId, result, note, createdAt: Date.now() }];
    dispute.updatedAt = Date.now();
    return dispute;
  });
}

function canViewDispute(db, dispute, session) {
  if (sessionHasRole(session, ['ADMIN', 'SUPER_ADMIN', 'ARBITRATOR', 'CUSTOMER_SERVICE'])) return canSessionAccessBrand(session, dispute.brandId);
  const order = getById(db, 'orders', dispute.orderId);
  return session?.userId === dispute.customerId || session?.userId === order?.workerId || db.assignments.some((row) => row.orderId === dispute.orderId && row.workerId === session?.userId);
}

export function listDisputes(db, { brandId, status } = {}, session) {
  authorize('listDisputes', session);
  return db.disputes.filter((row) => canSessionAccessBrand(session, row.brandId)).filter((row) => !brandId || row.brandId === brandId).filter((row) => !status || row.status === status).sort((a, b) => b.createdAt - a.createdAt);
}

export function getDispute(db, { disputeId }, session) {
  authorize('getDispute', session);
  const dispute = getById(db, 'disputes', disputeId);
  if (!dispute) throw new Error('异议不存在');
  if (!canViewDispute(db, dispute, session)) throw new Error('无权查看该异议');
  return dispute;
}

export function addDisputeEvidence(db, { disputeId, content = '', attachmentIds = [], side = '' }, session) {
  authorize('addDisputeEvidence', session);
  const dispute = getById(db, 'disputes', disputeId);
  if (!dispute) throw new Error('异议不存在');
  if (!canViewDispute(db, dispute, session)) throw new Error('无权提交该异议证据');
  if (!['OPEN', 'EVIDENCE_COLLECTION'].includes(dispute.status)) throw new Error('当前阶段不允许追加证据');
  if (!content && attachmentIds.length === 0) throw new Error('证据内容和附件至少填一项');
  const order = getById(db, 'orders', dispute.orderId);
  const resolvedSide = side || (session.userId === dispute.customerId ? 'CUSTOMER' : session.userId === order?.workerId ? 'WORKER' : 'STAFF');
  dispute.status = 'EVIDENCE_COLLECTION';
  dispute.evidence = [...(dispute.evidence || []), { side: resolvedSide, submitterId: session.userId, content, attachmentIds, createdAt: Date.now() }];
  dispute.timeline = [...(dispute.timeline || []), { action: 'ADD_EVIDENCE', operatorId: session.userId, side: resolvedSide, createdAt: Date.now() }];
  dispute.updatedAt = Date.now();
  return dispute;
}

export function startDisputeReview(db, { disputeId, requestId = '' }, session) {
  authorize('startDisputeReview', session);
  const dispute = getById(db, 'disputes', disputeId);
  if (!dispute) throw new Error('异议不存在');
  if (dispute.status === 'PENDING') dispute.status = 'OPEN';
  if (!['OPEN', 'EVIDENCE_COLLECTION'].includes(dispute.status)) throw new Error('异议当前状态不允许开始审理');
  dispute.status = 'UNDER_REVIEW';
  dispute.arbitratorId = session.userId;
  dispute.timeline = [...(dispute.timeline || []), { action: 'UNDER_REVIEW', operatorId: session.userId, createdAt: Date.now() }];
  dispute.updatedAt = Date.now();
  appendAudit(db, { brandId: dispute.brandId, action: 'startDisputeReview', resourceType: 'dispute', resourceId: disputeId, after: { ...dispute }, requestId }, session);
  return dispute;
}

export function closeDispute(db, { disputeId, requestId = '' }, session) {
  authorize('closeDispute', session);
  const dispute = getById(db, 'disputes', disputeId);
  if (!dispute) throw new Error('异议不存在');
  if (!['DECIDED', 'RESOLVED'].includes(dispute.status)) throw new Error('异议尚未裁决，不能结案');
  dispute.status = 'CLOSED';
  dispute.closedAt = Date.now();
  dispute.timeline = [...(dispute.timeline || []), { action: 'CLOSED', operatorId: session.userId, createdAt: Date.now() }];
  dispute.updatedAt = Date.now();
  appendAudit(db, { brandId: dispute.brandId, action: 'closeDispute', resourceType: 'dispute', resourceId: disputeId, after: { ...dispute }, requestId }, session);
  return dispute;
}

// 订单留言（全留痕，不可删改）。
export function sendOrderMessage(db, { orderId, content }, session) {
  authorize('sendOrderMessage', session);
  if (!content) throw new Error('留言内容不能为空');
  const order = getById(db, 'orders', orderId);
  if (!order) throw new Error('订单不存在');
  return insert(db, 'order_messages', {
    brandId: order.brandId || 'default',
    orderId,
    senderType: session.role === 'ADMIN' ? 'admin' : session.role === 'CUSTOMER_SERVICE' ? 'cs' : 'worker',
    senderId: session.userId,
    content,
    createdAt: Date.now(),
  });
}

// 订单留言列表。
export function listOrderMessages(db, { orderId }, session) {
  authorize('listOrderMessages', session);
  return db.order_messages.filter((m) => m.orderId === orderId);
}

/* ---------------- 接单端 ---------------- */

// 抢单：待抢单 -> 服务中，条件更新 + 同时进行上限。
export function grabOrder(db, { orderId, expectedVersion }, session) {
  authorize('grabOrder', session);
  const order = getById(db, 'orders', orderId);
  if (!order) throw new Error('订单不存在');
  if (order.status !== OrderStatus.PENDING_GRAB) throw new Error('CONFLICT:订单状态已变化，请刷新');
  if (expectedVersion !== undefined && expectedVersion !== (order.version || 0)) throw new Error('CONFLICT:订单版本已变化，请刷新');
  const worker = getById(db, 'users', session.userId);
  if (!worker || worker.role !== 'WORKER' || worker.status !== 'ACTIVE' || worker.acceptEnabled === false) {
    throw new Error('接单权限未开启');
  }
  const wallet = ensureWallet(db, session.userId);
  if (wallet.freezeAccept) throw new Error('接单权限已被冻结');
  const maxActive = getConfig(db, 'maxActiveOrders');
  const activeCount = db.orders.filter((o) => o.workerId === session.userId && o.status === OrderStatus.IN_SERVICE).length;
  const from = order.status;
  transaction(db, () => {
    grabOrderDomain(order, session.userId, { maxActiveOrders: maxActive });
    // 上限拦截（领域函数校验了参数，这里校验实际进行中数量）。
    if (activeCount >= maxActive) throw new Error('同时进行订单数已达上限');
    order.version = (order.version || 0) + 1;
    recordAssignment(db, order, { type: 'CLAIM', workerId: session.userId, operatorId: session.userId });
    writeOrderLog(db, order, { action: 'grab', fromStatus: from, toStatus: order.status, operatorType: 'worker', operatorId: session.userId });
  });
  return order;
}

// 退单：服务中 -> 待抢单（回池）。
export function releaseOrder(db, { orderId, reason = '' }, session) {
  authorize('releaseOrder', session);
  const order = getById(db, 'orders', orderId);
  if (!order) throw new Error('订单不存在');
  if (order.workerId !== session.userId) throw new Error('只能退自己的订单');
  const from = order.status;
  transaction(db, () => {
    const previousWorkerId = order.workerId;
    releaseOrderDomain(order, session.userId, { reason });
    recordAssignment(db, order, { type: 'RELEASE', workerId: previousWorkerId, previousWorkerId, operatorId: session.userId, reason });
    writeOrderLog(db, order, { action: 'release', fromStatus: from, toStatus: order.status, operatorType: 'worker', operatorId: session.userId, remark: reason });
  });
  return order;
}

// 接受指派：指派待确认 -> 服务中。
export function acceptAssignment(db, { assignmentId }, session) {
  authorize('acceptAssignment', session);
  const order = getById(db, 'orders', assignmentId);
  if (!order) throw new Error('订单不存在');
  const from = order.status;
  transaction(db, () => {
    acceptAssignmentDomain(order, session.userId);
    recordAssignment(db, order, { type: 'ACCEPT', workerId: session.userId, operatorId: session.userId });
    writeOrderLog(db, order, { action: 'accept', fromStatus: from, toStatus: order.status, operatorType: 'worker', operatorId: session.userId });
  });
  return order;
}

// 拒绝指派：指派待确认 -> 待抢单（回池）。
export function rejectAssignment(db, { assignmentId, reason = '' }, session) {
  authorize('rejectAssignment', session);
  const order = getById(db, 'orders', assignmentId);
  if (!order) throw new Error('订单不存在');
  const from = order.status;
  transaction(db, () => {
    const previousWorkerId = order.workerId;
    rejectAssignmentDomain(order, session.userId, { reason });
    recordAssignment(db, order, { type: 'REJECT', workerId: previousWorkerId, previousWorkerId, operatorId: session.userId, reason });
    writeOrderLog(db, order, { action: 'reject-assign', fromStatus: from, toStatus: order.status, operatorType: 'worker', operatorId: session.userId, remark: reason });
  });
  return order;
}

// 提交完成申请：服务中 -> 待确认（实际产出 + 凭证必传）。
export function submitCompletion(db, { orderId, actualOutput, attachmentIds }, session) {
  authorize('submitCompletion', session);
  const order = getById(db, 'orders', orderId);
  if (!order) throw new Error('订单不存在');
  if (order.workerId !== session.userId) throw new Error('只能提交自己的订单');
  const from = order.status;
  transaction(db, () => {
    submitCompletionDomain(order, { actualOutput, attachmentIds });
    writeOrderLog(db, order, { action: 'complete-apply', fromStatus: from, toStatus: order.status, operatorType: 'worker', operatorId: session.userId });
  });
  return order;
}

// 钱包查询：WORKER 取会话主体；ADMIN 必传 workerId 查他人。
export function getWallet(db, { workerId } = {}, session) {
  authorize('getWallet', session);
  const reviewer = sessionHasRole(session, ['ADMIN', 'SUPER_ADMIN', 'FINANCE_REVIEWER']);
  if (reviewer && !workerId) throw new Error('管理角色查询钱包必须传 workerId');
  const ownerId = reviewer ? workerId : session.userId;
  return ensureWallet(db, ownerId);
}

// 钱包流水查询：WORKER 取会话主体；ADMIN 必传 workerId。
export function walletTransactions(db, { workerId } = {}, session) {
  authorize('walletTransactions', session);
  const reviewer = sessionHasRole(session, ['ADMIN', 'SUPER_ADMIN', 'FINANCE_REVIEWER']);
  if (reviewer && !workerId) throw new Error('管理角色查询流水必须传 workerId');
  const ownerId = reviewer ? workerId : session.userId;
  const wallet = ensureWallet(db, ownerId);
  return db.wallet_transactions.filter((t) => t.walletId === wallet._id);
}

export function listCommissionRules(db, { brandId } = {}, session) {
  authorize('listCommissionRules', session);
  if (brandId) assertSessionBrand(session, brandId);
  return db.commission_rules.filter((rule) => canSessionAccessBrand(session, rule.brandId)).filter((rule) => !brandId || rule.brandId === brandId).sort((a, b) => b.version - a.version);
}

export function saveCommissionRule(db, { brandId, rule, status = 'DEMO_ONLY', effectiveAt = Date.now(), requestId = '' }, session) {
  authorize('saveCommissionRule', session);
  assertSessionBrand(session, brandId);
  if (!rule || !['fixed', 'percent'].includes(rule.type)) throw new Error('佣金规则必须为 fixed/percent');
  if (!['DRAFT', 'ACTIVE', 'INACTIVE', 'DEMO_ONLY'].includes(status)) throw new Error('佣金规则状态不合法');
  const version = Math.max(0, ...db.commission_rules.filter((row) => row.brandId === brandId).map((row) => row.version || 0)) + 1;
  const saved = insert(db, 'commission_rules', { brandId, version, status, rule: structuredClone(rule), effectiveAt, createdBy: session.userId, createdAt: Date.now(), updatedAt: Date.now() });
  appendAudit(db, { brandId, action: 'saveCommissionRule', resourceType: 'commission_rule', resourceId: saved._id, after: { ...saved }, requestId }, session);
  return saved;
}

export function reconcileWalletLedger(db, { workerId, brandId } = {}, session) {
  authorize('reconcileWalletLedger', session);
  if (brandId) assertSessionBrand(session, brandId);
  const wallets = db.wallets.filter((wallet) => !workerId || wallet.ownerId === workerId);
  return wallets.map((wallet) => {
    const rows = db.wallet_transactions.filter((row) => row.walletId === wallet._id && row.status !== 'REVERSED' && (!brandId || row.brandId === brandId));
    const ledgerAvailableFen = rows.reduce((sum, row) => sum + (row.amountFen || 0), 0);
    const walletAvailableFen = wallet.availableFen || 0;
    return { walletId: wallet._id, workerId: wallet.ownerId, brandId: brandId || '', ledgerAvailableFen, walletAvailableFen, differenceFen: walletAvailableFen - ledgerAvailableFen, ok: walletAvailableFen === ledgerAvailableFen };
  });
}

// 申请提现：实名 + 周次数 + 起提金额前置校验，冻结余额。
export function applyWithdrawal(db, { amountFen }, session) {
  authorize('applyWithdrawal', session);
  const wallet = ensureWallet(db, session.userId);
  const profile = findOne(db, 'worker_profiles', (p) => p.workerId === session.userId);
  const realnameApproved = profile && profile.realnameStatus === 'APPROVED';
  const weekStart = startOfWeek(Date.now());
  const applyCountWeek = db.withdrawals.filter((w) => w.workerId === session.userId && w.createdAt >= weekStart).length;
  const weeklyLimit = getConfig(db, 'weeklyWithdrawLimit');
  return transaction(db, () => {
    const withdrawal = createWithdrawal(wallet, {
      id: newId(db, 'withdrawal'),
      amountFen,
      minWithdrawFen: getConfig(db, 'minWithdrawFen') || MIN_WITHDRAW_FEN,
      weeklyLimit,
      realnameApproved,
      applyCountWeek,
    });
    withdrawal._id = withdrawal.id;
    delete withdrawal.id;
    withdrawal.workerId = session.userId;
    withdrawal.walletId = wallet._id;
    withdrawal.brandId = (session.brandScopes || []).find((scope) => scope !== '*') || 'default';
    db.withdrawals.push(withdrawal);
    wallet.version += 1;
    wallet.updatedAt = Date.now();
    addWalletTx(db, wallet, 'WITHDRAWAL_FREEZE', -amountFen, withdrawal._id, { brandId: withdrawal.brandId, withdrawalId: withdrawal._id });
    return withdrawal;
  });
}

// 提现单列表：WORKER 取会话主体；ADMIN 可传 workerId 过滤（省略则全量）。
export function listWithdrawals(db, { workerId, brandId } = {}, session) {
  authorize('listWithdrawals', session);
  if (brandId) assertSessionBrand(session, brandId);
  const roles = [session.role, ...(session.roles || [])].map(normalizeRole);
  const canReview = roles.some((role) => ['ADMIN', 'SUPER_ADMIN', 'FINANCE_REVIEWER'].includes(role));
  return db.withdrawals.filter((w) => {
    if (!canReview && w.workerId !== session.userId) return false;
    if (workerId && w.workerId !== workerId) return false;
    if (!canSessionAccessBrand(session, w.brandId || 'default')) return false;
    return !brandId || (w.brandId || 'default') === brandId;
  });
}

// 更新接单人员资料（收款微信/实名/身份证）。
export function updateProfile(db, { withdrawWechat, realName, idCardAttachmentId }, session) {
  authorize('updateProfile', session);
  let profile = findOne(db, 'worker_profiles', (p) => p.workerId === session.userId);
  if (!profile) {
    profile = insert(db, 'worker_profiles', { workerId: session.userId, createdAt: Date.now(), updatedAt: Date.now() });
  }
  if (withdrawWechat !== undefined) profile.withdrawWechat = withdrawWechat;
  if (realName !== undefined) profile.realName = realName;
  if (idCardAttachmentId !== undefined) {
    profile.idCardAttachmentId = idCardAttachmentId;
    profile.realnameStatus = 'PENDING';
  }
  profile.updatedAt = Date.now();
  return profile;
}

// 脱敏：文本仅保留首字符，其余打码。
function maskSensitive(value) {
  const s = String(value || '');
  if (!s) return '';
  if (s.length <= 1) return '*';
  return `${s[0]}***`;
}

// 接单人员资料 DTO（脱敏：姓名/收款微信/联系方式打码，身份证仅标记有无）。
function publicProfile(profile) {
  return {
    workerId: profile.workerId,
    realName: maskSensitive(profile.realName),
    withdrawWechat: maskSensitive(profile.withdrawWechat),
    hasIdCard: Boolean(profile.idCardAttachmentId),
    realnameStatus: profile.realnameStatus || 'UNSUBMITTED',
    phone: maskSensitive(profile.phone),
    wechat: maskSensitive(profile.wechat),
  };
}

// 我的资料（WORKER）：返回本人 worker_profiles 脱敏资料，无则空。
export function getProfile(db, payload, session) {
  authorize('getProfile', session);
  const profile = findOne(db, 'worker_profiles', (p) => p.workerId === session.userId);
  return profile ? publicProfile(profile) : null;
}

// 上传附件（按 biz_type 分流，content-hash 幂等）。
export function uploadFile(db, { bizType, bizId, fileName = '', size = 0, watermarkText = '' }, session) {
  authorize('uploadFile', session);
  if (!['complete_proof', 'id_card', 'dispute'].includes(bizType)) throw new Error('未知附件类型');
  const storageKey = `mock/${bizType}/${bizId || 'gen'}/${Date.now()}-${fileName}`;
  const relatedOrder = bizId ? getById(db, 'orders', bizId) : null;
  return insert(db, 'attachments', {
    brandId: (relatedOrder && relatedOrder.brandId) || (session.brandScopes || []).find((scope) => scope !== '*') || 'default',
    bizType,
    bizId: bizId || '',
    url: `https://cdn.example.com/${storageKey}`,
    storageKey,
    fileName,
    size,
    uploaderId: session.userId,
    watermarkText,
    uploadedAt: Date.now(),
  });
}

/* ---------------- 管理端资金 ---------------- */

// 调账（可增减，可为负，需原因）。
export function adjustWallet(db, { workerId, amountFen, reason }, session) {
  authorize('adjustWallet', session);
  if (!Number.isInteger(amountFen) || amountFen === 0) throw new Error('调账金额必须为非零整数（分）');
  if (!reason) throw new Error('调账原因不能为空');
  return transaction(db, () => {
    const wallet = ensureWallet(db, workerId);
    if (amountFen > 0) creditWallet(wallet, amountFen);
    else debitWallet(wallet, -amountFen);
    wallet.version += 1;
    wallet.updatedAt = Date.now();
    addWalletTx(db, wallet, 'ADJUST', amountFen, newId(db, 'adjust'), { operatorId: session.userId, remark: reason });
    return wallet;
  });
}

function normalizeLegacyWithdrawal(withdrawal) {
  if (withdrawal.status === WithdrawalStatus.PENDING_REVIEW) withdrawal.status = WithdrawalStatus.SUBMITTED;
  return withdrawal;
}

export function migrateWithdrawalStatuses(db, payload, session) {
  authorize('migrateWithdrawalStatuses', session);
  let migrated = 0;
  for (const withdrawal of db.withdrawals) {
    if (withdrawal.status === WithdrawalStatus.PENDING_REVIEW) {
      withdrawal.status = WithdrawalStatus.SUBMITTED;
      withdrawal.migratedFromStatus = WithdrawalStatus.PENDING_REVIEW;
      withdrawal.updatedAt = Date.now();
      migrated += 1;
    }
  }
  return { migrated };
}

export function startWithdrawalReview(db, { withdrawalId, requestId = '' }, session) {
  authorize('startWithdrawalReview', session);
  const withdrawal = getById(db, 'withdrawals', withdrawalId);
  if (!withdrawal) throw new Error('提现单不存在');
  Finance.assertWithdrawalReviewer(withdrawal, session);
  normalizeLegacyWithdrawal(withdrawal);
  startWithdrawalReviewDomain(withdrawal, { reviewedBy: session.userId });
  withdrawal.updatedAt = Date.now();
  appendAudit(db, { brandId: withdrawal.brandId, action: 'startWithdrawalReview', resourceType: 'withdrawal', resourceId: withdrawalId, after: { ...withdrawal }, requestId }, session);
  return withdrawal;
}

export function approveWithdrawal(db, { withdrawalId, requestId = '' }, session) {
  authorize('approveWithdrawal', session);
  const withdrawal = getById(db, 'withdrawals', withdrawalId);
  if (!withdrawal) throw new Error('提现单不存在');
  Finance.assertWithdrawalReviewer(withdrawal, session, true);
  approveWithdrawalDomain(withdrawal, { approvedBy: session.userId });
  withdrawal.updatedAt = Date.now();
  appendAudit(db, { brandId: withdrawal.brandId, action: 'approveWithdrawal', resourceType: 'withdrawal', resourceId: withdrawalId, after: { ...withdrawal }, requestId }, session);
  return withdrawal;
}

export function startWithdrawalPayment(db, { withdrawalId, batchNo, evidenceIds = [], requestId = '' }, session) {
  authorize('startWithdrawalPayment', session);
  const withdrawal = getById(db, 'withdrawals', withdrawalId);
  if (!withdrawal) throw new Error('提现单不存在');
  if (!batchNo) throw new Error('出款批次号不能为空');
  startWithdrawalPaymentDomain(withdrawal, { paidBy: session.userId, batchNo });
  withdrawal.paymentEvidence = evidenceIds;
  withdrawal.updatedAt = Date.now();
  insert(db, 'transfer_records', { brandId: withdrawal.brandId || 'default', withdrawalId, batchNo, status: 'PAYING', createdAt: Date.now() });
  appendAudit(db, { brandId: withdrawal.brandId, action: 'startWithdrawalPayment', resourceType: 'withdrawal', resourceId: withdrawalId, after: { ...withdrawal }, requestId }, session);
  return withdrawal;
}

export function failWithdrawalPayment(db, { withdrawalId, reason, requestId = '' }, session) {
  authorize('failWithdrawalPayment', session);
  const withdrawal = getById(db, 'withdrawals', withdrawalId);
  if (!withdrawal) throw new Error('提现单不存在');
  failWithdrawalPaymentDomain(withdrawal, { reason });
  withdrawal.updatedAt = Date.now();
  const transfer = db.transfer_records.find((row) => row.withdrawalId === withdrawalId && row.batchNo === withdrawal.batchNo);
  if (transfer) Object.assign(transfer, { status: 'FAILED', failReason: reason, updatedAt: Date.now() });
  appendAudit(db, { brandId: withdrawal.brandId, action: 'failWithdrawalPayment', resourceType: 'withdrawal', resourceId: withdrawalId, after: { ...withdrawal }, requestId }, session);
  return withdrawal;
}

// 确认出款：仅 PAYING -> PAID，冻结资金在此时才转已提现。
export function markWithdrawalPaid(db, { withdrawalId, batchNo, receiptAttachmentId, externalReference, requestId = '' }, session) {
  authorize('markWithdrawalPaid', session);
  const withdrawal = getById(db, 'withdrawals', withdrawalId);
  if (!withdrawal) throw new Error('提现单不存在');
  Finance.assertPayoutReceipt(withdrawal, getById(db, 'attachments', receiptAttachmentId), externalReference);
  if (withdrawal.workerId === session.userId) throw new Error('申请人不能自行确认出款');
  if (db.withdrawals.some((row) => row._id !== withdrawalId && row.externalReference === externalReference)) throw new Error('出款回单流水已关联其他提现');
  return transaction(db, () => {
    const wallet = ensureWallet(db, withdrawal.workerId);
    markWithdrawalPaidDomain(wallet, withdrawal);
    withdrawal.paidBy = session.userId;
    withdrawal.receiptAttachmentId = receiptAttachmentId;
    withdrawal.externalReference = externalReference;
    withdrawal.updatedAt = Date.now();
    addWalletTx(db, wallet, 'WITHDRAWAL_PAID', 0, withdrawal._id, { brandId: withdrawal.brandId || 'default', withdrawalId: withdrawal._id });
    const transfer = db.transfer_records.find((row) => row.withdrawalId === withdrawalId && row.batchNo === (batchNo || withdrawal.batchNo));
    if (transfer) Object.assign(transfer, { status: 'PAID', updatedAt: Date.now() });
    else insert(db, 'transfer_records', { brandId: withdrawal.brandId || 'default', withdrawalId: withdrawal._id, batchNo: batchNo || withdrawal.batchNo, status: 'PAID', createdAt: Date.now() });
    appendAudit(db, { brandId: withdrawal.brandId, action: 'markWithdrawalPaid', resourceType: 'withdrawal', resourceId: withdrawalId, after: { ...withdrawal }, requestId }, session);
    return withdrawal;
  });
}

// 驳回提现：待审批 -> 已驳回，解冻。
export function rejectWithdrawal(db, { withdrawalId, reason = '' }, session) {
  authorize('rejectWithdrawal', session);
  const withdrawal = getById(db, 'withdrawals', withdrawalId);
  if (!withdrawal) throw new Error('提现单不存在');
  normalizeLegacyWithdrawal(withdrawal);
  return transaction(db, () => {
    const wallet = ensureWallet(db, withdrawal.workerId);
    rejectWithdrawalDomain(wallet, withdrawal);
    withdrawal.rejectReason = reason;
    withdrawal.updatedAt = Date.now();
    addWalletTx(db, wallet, 'WITHDRAWAL_UNFREEZE', withdrawal.amountFen, withdrawal._id, { brandId: withdrawal.brandId || 'default', withdrawalId: withdrawal._id });
    return withdrawal;
  });
}

/* ---------------- 报表（ADMIN） ---------------- */

// 订单流水报表（按状态聚合）。
export function reportOrders(db, { from, to } = {}, session) {
  authorize('reportOrders', session);
  const rows = db.orders.filter((o) => (from == null || o.createdAt >= from) && (to == null || o.createdAt <= to));
  const byStatus = {};
  for (const o of rows) byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  return { total: rows.length, byStatus };
}

// 接单人员业绩报表（按完成订单数与佣金）。
export function reportWorkers(db, { from, to } = {}, session) {
  authorize('reportWorkers', session);
  const rows = db.orders.filter((o) => o.status === OrderStatus.SETTLED && (from == null || o.completedAt >= from) && (to == null || o.completedAt <= to));
  const map = {};
  for (const o of rows) {
    map[o.workerId] = map[o.workerId] || { workerId: o.workerId, orders: 0, earningsFen: 0 };
    map[o.workerId].orders += 1;
    map[o.workerId].earningsFen += o.earningsFen || 0;
  }
  return Object.values(map);
}

// 提现报表（按接单人员聚合）。
export function reportWithdrawals(db, { from, to } = {}, session) {
  authorize('reportWithdrawals', session);
  const rows = db.withdrawals.filter((w) => (from == null || w.createdAt >= from) && (to == null || w.createdAt <= to));
  const map = {};
  for (const w of rows) {
    map[w.workerId] = map[w.workerId] || { workerId: w.workerId, count: 0, amountFen: 0, paidFen: 0 };
    map[w.workerId].count += 1;
    map[w.workerId].amountFen += w.amountFen;
    if (w.status === 'PAID') map[w.workerId].paidFen += w.amountFen;
  }
  return Object.values(map);
}

// 对账汇总：钱包可用余额合计 / 钱包总额（可用+冻结+已提现）合计。
function reconciliationSummary(db) {
  const totalWalletBalanceFen = db.wallets.reduce((s, w) => s + (w.availableFen || 0), 0);
  const walletBalanceSumFen = db.wallets.reduce(
    (s, w) => s + (w.availableFen || 0) + (w.pendingWithdrawFen || 0) + (w.withdrawnFen || 0),
    0,
  );
  return { totalWalletBalanceFen, walletBalanceSumFen };
}

// 利润报表（佣金入账 - 追回佣金）+ 对账卡片（reconciliationFen = profit - 钱包可用余额合计）。
export function reportProfit(db, { from, to } = {}, session) {
  authorize('reportProfit', session);
  const rows = db.wallet_transactions.filter((t) => (t.type === 'ORDER_EARNINGS' || t.type === 'COMMISSION_REVERSAL' || t.type === 'REFUND_CLAWBACK') && (from == null || t.createdAt >= from) && (to == null || t.createdAt <= to));
  let earningsFen = 0;
  let reversalFen = 0;
  for (const t of rows) {
    if (t.type === 'ORDER_EARNINGS') earningsFen += t.amountFen;
    else reversalFen += -t.amountFen;
  }
  const profitFen = earningsFen - reversalFen;
  const { totalWalletBalanceFen, walletBalanceSumFen } = reconciliationSummary(db);
  return { earningsFen, reversalFen, profitFen, totalWalletBalanceFen, walletBalanceSumFen, reconciliationFen: profitFen - totalWalletBalanceFen };
}

/* ---------------- 品牌 ---------------- */

const DEFAULT_THEME = {
  primary: '#ff2442',
  secondary: '#5b83f7',
  bg: '#f2f2f2',
  text: '#252525',
  border: '#ededed',
  radius: '14rpx',
};

function defaultBrandConfig(appId = '') {
  return {
    brandId: 'default', code: 'default', appId, name: '默认品牌', logo: '',
    themeTokens: { ...DEFAULT_THEME }, copy: {}, banners: [], version: 1, publishedVersion: 1,
    publicConfig: {}, assetConfig: {}, contactConfig: {}, legalConfig: {},
  };
}

function publicBrand(brand) {
  if (!brand) return null;
  return {
    brandId: brand.brandId,
    code: brand.code || brand.brandId,
    appId: brand.appId,
    name: brand.name,
    logo: brand.logo || '',
    themeTokens: brand.themeTokens && Object.keys(brand.themeTokens).length ? brand.themeTokens : { ...DEFAULT_THEME },
    copy: brand.copy || {},
    banners: Array.isArray(brand.banners) ? brand.banners : [],
    publicConfig: brand.publicConfig || {},
    assetConfig: brand.assetConfig || {},
    contactConfig: brand.contactConfig || {},
    legalConfig: brand.legalConfig || {},
    version: brand.version || 1,
    publishedVersion: brand.publishedVersion || brand.version || 1,
  };
}

// 品牌配置（公开读）：显式 code/AppID 必须精确匹配；仅开发空库允许默认品牌。
export function getBrandConfig(db, { appId = '', brandCode = '', brandId = '' } = {}) {
  if (!db.brands.length) return defaultBrandConfig(appId);
  const context = resolveRequestBrand(db, { appId, brandCode, brandId }, { allowDefault: !appId && !brandCode && !brandId });
  const brand = db.brands.find((item) => item.brandId === context.brandId);
  if (!brand || !['ON', 'ACTIVE'].includes(brand.status)) throw new Error('BRAND_DISABLED');
  return publicBrand(brand);
}

// 品牌列表（ADMIN）。
export function listBrands(db, payload, session) {
  authorize('listBrands', session);
  return db.brands.filter((brand) => canSessionAccessBrand(session, brand.brandId));
}

// 保存品牌配置（brandId upsert + 版本快照 + 审计）；兼容历史直接传 brand 的调用。
export function saveBrandConfig(db, payload = {}, session) {
  authorize('saveBrandConfig', session);
  const brand = payload.brand && typeof payload.brand === 'object' ? payload.brand : payload;
  if (!brand || typeof brand !== 'object') throw new Error('缺少品牌配置');
  const { brandId, appId, name, requestId = payload.requestId || payload.idempotencyKey || '' } = brand;
  if (!brandId) throw new Error('brandId 不能为空');
  if (!appId) throw new Error('appId 不能为空');
  if (!name) throw new Error('品牌名称不能为空');
  const code = String(brand.code || brandId).trim();
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(code)) throw new Error('品牌 code 只能使用 1-32 位小写字母、数字和连字符');
  const codeConflict = db.brands.find((item) => item.brandId !== brandId && item.code === code);
  if (codeConflict) throw new Error('品牌 code 已存在');
  const appConflict = db.brands.find((item) => item.brandId !== brandId && item.appId === appId);
  if (appConflict) throw new Error('AppID 已绑定其他品牌');
  assertSessionBrand(session, brandId);
  if (brand.themeTokens !== undefined && (typeof brand.themeTokens !== 'object' || brand.themeTokens === null || Array.isArray(brand.themeTokens))) {
    throw new Error('themeTokens 必须为对象');
  }
  if (brand.copy !== undefined && (typeof brand.copy !== 'object' || brand.copy === null || Array.isArray(brand.copy))) {
    throw new Error('copy 必须为对象');
  }
  const now = Date.now();
  const existed = findOne(db, 'brands', (b) => b.brandId === brandId);
  const before = existed ? { ...existed } : null;
  const version = (existed?.version || 0) + 1;
  const doc = {
    brandId,
    code,
    appId,
    name,
    logo: brand.logo || '',
    themeTokens: brand.themeTokens || {},
    copy: brand.copy || {},
    banners: Array.isArray(brand.banners) ? brand.banners : [],
    publicConfig: brand.publicConfig && typeof brand.publicConfig === 'object' ? brand.publicConfig : {},
    assetConfig: brand.assetConfig && typeof brand.assetConfig === 'object' ? brand.assetConfig : {},
    contactConfig: brand.contactConfig && typeof brand.contactConfig === 'object' ? brand.contactConfig : {},
    legalConfig: brand.legalConfig && typeof brand.legalConfig === 'object' ? brand.legalConfig : {},
    channelRefs: brand.channelRefs && typeof brand.channelRefs === 'object' ? brand.channelRefs : {},
    // binding 仅兼容旧数据，敏感值必须改存 channelRefs 中的 secret 引用。
    binding: brand.binding && typeof brand.binding === 'object' && !Array.isArray(brand.binding) ? brand.binding : {},
    isDefault: brand.isDefault === true,
    status: brand.status === 'OFF' ? 'OFF' : 'ON',
    version,
    publishedVersion: version,
    updatedAt: now,
  };
  let saved;
  if (existed) {
    Object.assign(existed, doc);
    saved = existed;
  } else {
    saved = insert(db, 'brands', { ...doc, createdAt: now });
  }
  insert(db, 'brand_config_versions', {
    brandId, version, status: 'PUBLISHED', configSnapshot: publicBrand(saved), createdBy: session.userId, createdAt: now, publishedAt: now,
  });
  appendAudit(db, { brandId, action: 'saveBrandConfig', resourceType: 'brand', resourceId: saved._id, before, after: { ...saved }, requestId }, session);
  return saved;
}

/* ---------------- 通知 / 客服 ---------------- */

// 写入通知（系统/内部）。
export function notify(db, { receiverId, channel = 'INBOX', template, payload, brandId = 'default' }) {
  return insert(db, 'notifications', {
    brandId,
    receiverId,
    channel,
    template,
    payload: payload || {},
    status: 'SENT',
    createdAt: Date.now(),
  });
}

// 客服发送 H5 下单链接（兜底渠道）。
export function sendCustomerServiceLink(db, { openid, productId }, session) {
  authorize('sendCustomerServiceLink', session);
  const product = getById(db, 'products', productId);
  if (!product || product.status !== 'ON') throw new Error('商品已下架或不存在');
  assertSessionBrand(session, product.brandId || 'default');
  const token = issueH5Token({ openid, productId, brandId: product.brandId || 'default', mode: 'cs' }, getH5Secret());
  const link = buildH5OrderLink(H5_ORDER_BASE_URL, token);
  notify(db, { receiverId: openid, channel: 'WECHAT_CUSTOMER_SERVICE', template: 'H5_ORDER_LINK', payload: { productId, link }, brandId: product.brandId || 'default' });
  return { link };
}

/* ---------------- 定时任务 ---------------- */

// 支付超时关单（条件更新，目标 CLOSED）。
export function timeoutCloseUnpaidOrders(db, { now = Date.now() } = {}, session) {
  authorize('timeoutCloseUnpaidOrders', session);
  let closed = 0;
  for (const order of db.orders) {
    if (order.status === OrderStatus.PENDING_PAYMENT && isPaymentExpired(order, now)) {
      const from = order.status;
      timeoutClose(order, { closedAt: now });
      writeOrderLog(db, order, { action: 'timeout-close', fromStatus: from, toStatus: order.status, operatorType: 'system' });
      closed += 1;
    }
  }
  return { closed };
}

// 入池超时打标。
export function timeoutMarkPool(db, { now = Date.now() } = {}, session) {
  authorize('timeoutMarkPool', session);
  const poolTimeout = getConfig(db, 'poolTimeoutMinutes') * 60 * 1000;
  const marked = updateWhere(db, 'orders', (o) => o.status === OrderStatus.PENDING_GRAB && (o.pooledAt || 0) + poolTimeout < now, { poolTimedOut: true });
  return { marked };
}

// 指派超时自动拒绝（回池）。
export function timeoutRejectAssignments(db, { now = Date.now() } = {}, session) {
  authorize('timeoutRejectAssignments', session);
  const assignTimeout = getConfig(db, 'assignTimeoutMinutes') * 60 * 1000;
  let rejected = 0;
  for (const order of db.orders) {
    if (order.status === OrderStatus.ASSIGN_PENDING && (order.assignedAt || 0) + assignTimeout < now) {
      const from = order.status;
      rejectAssignmentDomain(order, order.workerId, { reason: '指派超时自动拒绝' });
      writeOrderLog(db, order, { action: 'timeout-reject-assign', fromStatus: from, toStatus: order.status, operatorType: 'system' });
      rejected += 1;
    }
  }
  return { rejected };
}

/* ---------------- 工作台 ---------------- */

// 待办分区计数（出参键与管理端 3c 定案契约一致）。
export function dashboard(db, payload, session) {
  authorize('dashboard', session);
  const requestedBrand = payload && payload.brandId;
  if (requestedBrand) assertSessionBrand(session, requestedBrand);
  const orders = db.orders
    .filter((order) => canSessionAccessBrand(session, order.brandId || 'default'))
    .filter((order) => !requestedBrand || (order.brandId || 'default') === requestedBrand);
  const refunds = db.refunds.filter((refund) => {
    const order = getById(db, 'orders', refund.orderId);
    return order && canSessionAccessBrand(session, order.brandId || 'default') && (!requestedBrand || (order.brandId || 'default') === requestedBrand);
  });
  const visibleWorkerIds = new Set(db.user_brand_roles
    .filter((row) => row.status !== 'DISABLED' && (!requestedBrand || row.brandId === requestedBrand) && canSessionAccessBrand(session, row.brandId))
    .map((row) => row.userId));
  return {
    totalOrders: orders.length,
    pendingAcceptOrders: orders.filter((o) => o.status === OrderStatus.PENDING_ACCEPT).length,
    inServiceOrders: orders.filter((o) => o.status === OrderStatus.IN_SERVICE).length,
    workers: db.users.filter((u) => u.role === 'WORKER' && (!requestedBrand || visibleWorkerIds.has(u._id))).length,
    pendingConfirmOrders: orders.filter((o) => o.status === OrderStatus.PENDING_CONFIRM).length,
    pendingRefunds: refunds.filter((r) => r.status === 'PENDING_APPROVAL').length,
    pendingWithdrawals: db.withdrawals.filter((w) => ['PENDING_REVIEW', 'SUBMITTED', 'REVIEWING', 'APPROVED', 'PAYING', 'PAY_FAILED'].includes(w.status) && canSessionAccessBrand(session, w.brandId || 'default') && (!requestedBrand || (w.brandId || 'default') === requestedBrand)).length,
    pendingDisputes: db.disputes.filter((d) => ['PENDING', 'OPEN', 'EVIDENCE_COLLECTION', 'UNDER_REVIEW', 'DECIDED'].includes(d.status) && canSessionAccessBrand(session, d.brandId || 'default') && (!requestedBrand || (d.brandId || 'default') === requestedBrand)).length,
  };
}

// 周起始时间（周一 00:00）——提现周次数统计。
function startOfWeek(now) {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // 周一为 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

/* ---------------- 分发（镜像层错误封套） ---------------- */

// action 名 -> 处理函数（供 dispatch 与 api-server 统一入口使用）。
const ACTION_MAP = {
  miniLogin, oauthExchange, authLogin, workerLogin, changePassword, getAccessProfile,
  createStaff, listUsers, updateStaff, listUserBrandRoles, saveUserBrandRoles, listAuditLogs,
  freezeWallet, createWorker, updateWorker, listWorkers,
  listProducts, getProduct, saveProduct, updateProductStatus,
  listDicts, saveDict, getConfigs, updateConfigs,
  addVip, removeVip, listVips,
  getBrandConfig, listBrands, saveBrandConfig,
  h5Token, getH5Product, createOrderFromH5, revokeH5Token, getPaymentParams, confirmMockPayment, getPaymentStatus, listPayments, payNotify, transferNotify,
  listMyOrders, getMyOrder, queryOrderByNo, submitDispute, requestSubscribe, listNotifications, markRead,
  listOrders, getOrder, enterOrder, listOrderLogs, listPool, assignOrder, requestCancellation, requestRefund,
  approveRefund, rejectRefund, verifyCompletion, rejectCompletion, closeOrder, confirmSettlement, reworkOrder,
  listDisputes, getDispute, addDisputeEvidence, startDisputeReview, resolveDispute, closeDispute, sendOrderMessage, listOrderMessages,
  grabOrder, releaseOrder, acceptAssignment, rejectAssignment, submitCompletion, listAssignments, reassignOrder,
  getWallet, walletTransactions, listCommissionRules, saveCommissionRule, reconcileWalletLedger,
  applyWithdrawal, listWithdrawals, startWithdrawalReview, approveWithdrawal, startWithdrawalPayment, failWithdrawalPayment, migrateWithdrawalStatuses,
  updateProfile, getProfile, uploadFile, adjustWallet, markWithdrawalPaid, rejectWithdrawal,
  reportOrders, reportWorkers, reportWithdrawals, reportProfit,
  notify, sendCustomerServiceLink, timeoutCloseUnpaidOrders, timeoutMarkPool, timeoutRejectAssignments, dashboard,
};

// 本地 HTTP 镜像的统一资源品牌门禁，避免新增 action 漏掉资源归属校验。
function enforceResourceBrand(db, payload = {}, session) {
  if (!session) return '';
  let brandId = payload.brandId || '';
  const orderId = payload.orderId || payload.assignmentId;
  if (orderId) brandId = getById(db, 'orders', orderId)?.brandId || brandId;
  if (payload.productId) brandId = getById(db, 'products', payload.productId)?.brandId || brandId;
  if (payload.refundId) {
    const refund = getById(db, 'refunds', payload.refundId);
    brandId = (refund && getById(db, 'orders', refund.orderId)?.brandId) || brandId;
  }
  if (payload.disputeId) {
    const dispute = getById(db, 'disputes', payload.disputeId);
    brandId = (dispute && getById(db, 'orders', dispute.orderId)?.brandId) || brandId;
  }
  if (payload.paymentId) brandId = getById(db, 'payments', payload.paymentId)?.brandId || brandId;
  if (payload.withdrawalId) brandId = getById(db, 'withdrawals', payload.withdrawalId)?.brandId || brandId;
  if (brandId) assertSessionBrand(session, brandId);
  return brandId || (session.brandScopes || []).find((scope) => scope !== '*') || 'default';
}

const ROUTE_AUDIT_ACTIONS = new Set([
  'freezeWallet', 'adjustWallet', 'updateWorker', 'updateProductStatus',
  'enterOrder', 'assignOrder', 'grabOrder', 'releaseOrder', 'acceptAssignment', 'rejectAssignment', 'submitCompletion', 'reworkOrder',
  'requestRefund', 'approveRefund', 'rejectRefund', 'confirmSettlement',
  'verifyCompletion', 'rejectCompletion', 'closeOrder', 'reassignOrder',
  'startDisputeReview', 'resolveDispute', 'closeDispute',
  'startWithdrawalReview', 'approveWithdrawal', 'startWithdrawalPayment', 'failWithdrawalPayment', 'markWithdrawalPaid', 'rejectWithdrawal',
  'revokeH5Token', 'transferNotify', 'timeoutCloseUnpaidOrders', 'timeoutMarkPool', 'timeoutRejectAssignments',
]);

function auditResource(db, payload = {}) {
  const candidates = [
    ['order', 'orders', payload.orderId || payload.assignmentId],
    ['refund', 'refunds', payload.refundId],
    ['dispute', 'disputes', payload.disputeId],
    ['withdrawal', 'withdrawals', payload.withdrawalId],
    ['payment', 'payments', payload.paymentId],
    ['worker', 'users', payload.workerId],
    ['product', 'products', payload.productId],
  ];
  for (const [resourceType, collection, resourceId] of candidates) {
    if (resourceId) return { resourceType, resourceId, before: structuredClone(getById(db, collection, resourceId) || null) };
  }
  return { resourceType: 'operation', resourceId: '', before: null };
}

// 由错误消息推导错误码（与 api-server HTTP 状态映射对应）。
function errorCode(err) {
  const msg = String((err && err.message) || err);
  if (/^CONFLICT:|状态已变化|版本已变化/.test(msg)) return 'CONFLICT';
  if (/未登录|会话|无效/.test(msg)) return 'UNAUTHORIZED';
  if (/无权限|BRAND_FORBIDDEN|BRAND_CHANNEL_MISMATCH/.test(msg)) return 'FORBIDDEN';
  if (/UNKNOWN_BRAND|BRAND_DISABLED|BRAND_CONTEXT_REQUIRED/.test(msg)) return 'NOT_FOUND';
  if (/不存在|没有|未找到/.test(msg)) return 'NOT_FOUND';
  return 'BAD_REQUEST';
}

// 镜像层统一分发入口：业务错误一律返回 {ok:false, code, message}，不 throw（与云函数 index.js 一致）。
export function dispatch(db, action, payload, session) {
  const handler = ACTION_MAP[action];
  if (!handler) return { ok: false, code: 'NOT_FOUND', message: `未知 action: ${action}` };
  try {
    const brandId = enforceResourceBrand(db, payload, session);
    const resource = ROUTE_AUDIT_ACTIONS.has(action) ? auditResource(db, payload) : null;
    const result = handler(db, payload, session);
    if (resource) {
      appendAudit(db, {
        brandId, action, resourceType: resource.resourceType, resourceId: resource.resourceId,
        before: resource.before, after: structuredClone(result || null),
        requestId: payload.requestId || payload.idempotencyKey || '',
      }, session);
    }
    return result;
  } catch (err) {
    return { ok: false, code: errorCode(err), message: (err && err.message) || String(err) };
  }
}
