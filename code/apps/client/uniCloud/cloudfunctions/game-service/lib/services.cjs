'use strict';
// 云函数契约层(Phase 3 波次 2a):全量 action 重写为蓝图 D.2 目标集 + 恢复一期的 H5 链路 + 品牌三 action。
// 一切状态流转与资金计算调 packages/domain(domain.cjs),服务层只做仓储/事务/鉴权边界。
const { createHmac, randomBytes } = require('node:crypto');
const D = require('./domain.cjs');
const Pay = require('./wechat-pay.cjs');
const { createAuth, normalizeRole } = require('./auth.cjs');
const Security = require('./account-security.cjs');
const { createOAuth } = require('./oauth.cjs');
const { reconcilePaidButClosed } = require('./reconcile.cjs');
const { newId } = require('./repository.cjs');
const Upload = require('./upload.cjs');
const Subscribe = require('./subscribe.cjs');
const { buildH5OrderLink } = require('./h5-link.cjs');
const Finance = require('./commercial-finance.cjs');
const Privacy = require('./privacy.cjs');
const Ops = require('./commercial-ops.cjs');

const auth = createAuth({ env: process.env });
const verifyStepUp = async (_repo, session, token) => {
  Security.verifyStepUpToken(token, session, process.env);
  return true;
};
const privacyServices = Privacy.createPrivacyServices({ env: process.env, verifyStepUp });
const operationsServices = Ops.createOperationsServices({
  env: process.env,
  verifyStepUp: async (_repo, payload, session) => verifyStepUp(_repo, session, payload.stepUpToken),
});
const financeServices = Object.fromEntries([
  'runFinancialReconciliation', 'listReconciliationCases', 'resolveReconciliationCase',
  'closeReconciliationCase', 'exportFinancialReconciliation',
].map((action) => [action, Finance[action]]));
const H5_TOKEN_TTL_MS = Number(process.env.H5_TOKEN_TTL_MS || 24 * 60 * 60 * 1000); // 默认 24h
if (!Number.isSafeInteger(H5_TOKEN_TTL_MS) || H5_TOKEN_TTL_MS < 5 * 60 * 1000 || H5_TOKEN_TTL_MS > 24 * 60 * 60 * 1000) {
  throw new Error('H5_TOKEN_TTL_MS 必须在 5 分钟到 24 小时之间');
}
const H5_ORDER_BASE_URL = process.env.H5_ORDER_BASE_URL || 'https://h5.qmhyjoy.com';

// H5 token 密钥按需读取:无 dev-secret 兜底,缺失即抛错(T0-02 fail-closed)。
function getH5Secret() {
  const s = process.env.H5_TOKEN_SECRET;
  if (!s) throw new Error('缺少 H5_TOKEN_SECRET 环境变量(fail-closed)');
  return s;
}

// 文案红线禁用词(G.5):命中抛错,商品命名/描述不得出现。
const BANNED_WORDS = ['代练', '代打', '代刷', '上分', '带练', '买币', '卖币', '刷币', '保币', '托管', '垫资', '担保', '返利'];

// 全局配置默认值(V1.1 §11.1)。
const DEFAULTS = {
  maxActiveOrders: 3,
  weeklyWithdrawLimit: 3,
  minWithdrawFen: D.MIN_WITHDRAW_FEN, // 1000 分 = 10 元
  poolTimeoutMs: 30 * 60 * 1000,
  assignmentTimeoutMs: 30 * 60 * 1000,
};

// 配置读写契约(前端 camelCase 键 + 默认值):getConfigs/updateConfigs 以该键集为准。
const CONFIG_DEFAULTS = {
  payTimeoutMinutes: 30,
  poolTimeoutMinutes: 30,
  assignTimeoutMinutes: 30,
  maxActiveOrders: 3,
  weeklyWithdrawLimit: 3,
  maxReworkCount: 1,
  disputeWindowHours: 72,
  minWithdrawFen: 1000,
  pollIntervalSeconds: 10,
  sessionTimeoutMinutes: 30,
};

// 退款类型枚举(契约定案):requestRefund 仅接受该集合。
const REFUND_TYPES = ['full', 'partial_unstarted', 'partial_progress', 'partial_output', 'dispute'];

const STATUS_TEXT = {
  PENDING_PAYMENT: '待支付', PENDING_ACCEPT: '待受理', PENDING_GRAB: '待抢单',
  ASSIGN_PENDING: '指派待确认', IN_SERVICE: '服务中', PENDING_CONFIRM: '待确认',
  SETTLED: '已结单', DISPUTING: '异议中', CANCELLED: '已取消',
  REFUNDING: '退款中', REFUNDED: '已退款', CLOSED: '已关闭',
};

function normRole(role) { return normalizeRole(role); }
function sessionHasRole(session, allowed) {
  return [session && session.role, ...((session && session.roles) || [])].map(normalizeRole).some((role) => allowed.includes(role));
}
const publicUser = Security.publicUser;
const newIdNo = newId;

// H5 下单 token 签发:payload 含 exp(默认 24h)、mode('app'|'cs')、productId 绑定;app 模式绑定小程序 openid。
function issueH5Token({ productId, openid, brandId, mode }) {
  const secret = getH5Secret();
  if (!productId) throw new Error('H5 下单 token 必须绑定 productId');
  if (!['app', 'cs'].includes(mode)) throw new Error('H5 下单 token mode 非法');
  const now = Date.now();
  const payload = {
    productId, brandId: brandId || 'default', purpose: 'h5-order', mode,
    jti: randomBytes(18).toString('base64url'), iat: now, exp: now + H5_TOKEN_TTL_MS,
  };
  if (mode === 'app') payload.openid = openid;
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

// H5 token 验签 + 过期校验 + 结构校验(T0-07)。
function verifyH5Token(token) {
  const secret = getH5Secret();
  if (!token || typeof token !== 'string') throw new Error('无效的 H5 下单链接');
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error('无效的 H5 下单链接');
  const [body, sig] = parts;
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if (a.length !== b.length || !a.equals(b)) throw new Error('无效的 H5 下单链接');
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch (_) { throw new Error('无效的 H5 下单链接'); }
  if (!payload.productId || payload.purpose !== 'h5-order' || !['app', 'cs'].includes(payload.mode)) throw new Error('H5 下单链接用途非法');
  if (!payload.jti || !/^[A-Za-z0-9_-]{16,128}$/.test(payload.jti)) throw new Error('H5 下单链接结构非法');
  if (!Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp) || payload.exp <= payload.iat) throw new Error('H5 下单链接结构非法');
  if (payload.iat > Date.now() + 5 * 60 * 1000) throw new Error('H5 下单链接尚未生效');
  if (Date.now() > payload.exp) throw new Error('H5 下单链接已过期');
  return payload;
}

async function verifyActiveH5Token(repo, token) {
  const payload = verifyH5Token(token);
  const revoked = await repo.getById('h5_token_revocations', payload.jti);
  if (revoked) throw new Error('H5 下单链接已失效');
  return payload;
}

// 订单副本克隆:避免退款失败等场景对仓储返回引用的原地修改泄漏。
function cloneOrder(order) {
  return {
    ...order,
    cancellation: order.cancellation ? { ...order.cancellation } : undefined,
    refund: order.refund ? { ...order.refund } : undefined,
    dispute: order.dispute ? { ...order.dispute } : undefined,
  };
}

// 查询/懒建钱包(ownerId 唯一索引)。
async function ensureWallet(repo, ownerId) {
  let wallet = await repo.findOne('wallets', { ownerId });
  if (!wallet) {
    wallet = { _id: newIdNo('wallet'), ownerId, ...D.createWallet(), createdAt: Date.now(), updatedAt: Date.now() };
    await repo.insert('wallets', wallet);
  }
  return wallet;
}

async function addWalletTransaction(repo, wallet, type, amountFen, refId, operatorId, brandId = 'default') {
  await repo.insert('wallet_transactions', {
    _id: newIdNo('wtx'), brandId, walletId: wallet._id, type, amountFen,
    balanceAfterFen: wallet.availableFen, refId, operatorId, createdAt: Date.now(),
  });
}

// 订单状态流水:每次流转同事务写(G.3)。
async function addOrderLog(repo, orderId, { fromStatus, toStatus, action, operatorType, operatorId, operatorRole = '', remark, payloadSnapshot = {}, requestId = '' }) {
  const order = await repo.getById('orders', orderId);
  await repo.insert('order_logs', {
    _id: newIdNo('olog'), orderId, brandId: order && order.brandId || 'default', fromStatus, toStatus, action,
    operatorType, operatorId, operatorRole: operatorRole || operatorType, payloadSnapshot, requestId, remark: remark || '', createdAt: Date.now(),
  });
}

// 读取全局配置(缺省用默认值)。
async function getConfig(repo, key, def) {
  const cfg = await repo.findOne('configs', { cfgKey: key });
  return cfg ? cfg.cfgValue : def;
}

// 订单状态条件更新:仅在 expectedStatus 时应用 mutate 后的订单,影响行数=1 才算成功;订单流转与 order_log 同事务。
async function transition(repo, orderId, expectedStatus, mutate, log) {
  const order = await repo.getById('orders', orderId);
  if (!order) throw new Error('订单不存在');
  if (order.status !== expectedStatus) throw new Error(`订单当前状态不可执行「${log.action}」`);
  const clone = cloneOrder(order);
  mutate(clone);
  return repo.transaction(async (tr) => {
    const res = await tr.updateWhere('orders', { _id: orderId, status: expectedStatus }, clone);
    if (res.updated !== 1) throw new Error(`订单状态已变化,「${log.action}」失败`);
    await tr.insert('order_logs', {
      _id: newIdNo('olog'), orderId, brandId: clone.brandId || order.brandId || 'default',
      fromStatus: expectedStatus, toStatus: clone.status,
      operatorRole: log.operatorRole || log.operatorType || '', payloadSnapshot: log.payloadSnapshot || {}, requestId: log.requestId || '',
      ...log, createdAt: Date.now(),
    });
    return tr.getById('orders', orderId);
  });
}

// 退款比例:实际/保底(domain 公式 = 1 − clamp(实际/保底,0,1)),无保底兜底 0。
function computeRefundRatio(order) {
  const guaranteed = order.guaranteedOutput != null ? order.guaranteedOutput : (order.productSnapshot && order.productSnapshot.guaranteedOutput);
  const actual = order.actualOutput != null ? order.actualOutput : 0;
  return D.calculateRefundRatio({ actualOutput: actual, guaranteedOutput: guaranteed || 0 });
}

// VIP 名单匹配:按手机号/微信号命中即打标。
async function matchVip(repo, { contactPhone, contactWechat }) {
  const vips = await repo.find('vip_list', { status: 'ACTIVE' });
  return vips.some((v) =>
    (contactPhone && v.matchType === 'phone' && v.matchKey === contactPhone) ||
    (contactWechat && v.matchType === 'wechat' && v.matchKey === contactWechat));
}

// 通知管理员(告警/对账等)。
async function notifyAdmin(repo, template, payload) {
  const admins = await repo.find('users', { role: 'ADMIN' });
  for (const a of admins) {
    await repo.insert('notifications', {
      _id: newIdNo('notify'), brandId: payload && payload.brandId || 'default', receiverId: a._id, channel: 'INBOX', template, payload: payload || {}, status: 'SENT', createdAt: Date.now(),
    });
  }
}

// 测试注入口:优先注入的支付/oauth 客户端,否则按环境变量构建。
function getPayClient() {
  if (globalThis.__PAY_CLIENT__) return globalThis.__PAY_CLIENT__;
  return Pay.createClient({ env: process.env });
}
function getOAuthClient() {
  if (globalThis.__OAUTH_CLIENT__) return globalThis.__OAUTH_CLIENT__;
  return createOAuth({ env: process.env });
}

async function resolveRequestBrand(repo, { brandCode = '', appId = '', brandId = '' } = {}, { allowDefault = true } = {}) {
  const brands = (await repo.find('brands', {})).filter((brand) => ['ON', 'ACTIVE'].includes(brand.status));
  if (!brands.length) return { brandId: brandId || 'default', brandCode: brandCode || brandId || 'default', appId, version: 1 };
  return D.resolveBrandContext(brands, { brandCode: brandCode || brandId, appId, allowDefault });
}

function canAccessBrand(session, brandId) {
  if (!session || !brandId) return false;
  const scopes = session.brandScopes || [];
  if (!scopes.length && brandId === 'default') return true;
  if (typeof D.hasBrandAccess === 'function') return D.hasBrandAccess(session, brandId);
  const roles = new Set([session.role, ...(session.roles || [])]);
  return roles.has('ADMIN') || roles.has('SUPER_ADMIN') || scopes.includes('*') || scopes.includes(brandId) || (!scopes.length && brandId === 'default');
}

function assertBrandAccess(session, brandId) {
  if (!canAccessBrand(session, brandId)) throw new Error('BRAND_FORBIDDEN');
}

async function userHasBrandScope(repo, userId, brandId) {
  const user = await repo.getById('users', userId);
  if (user && ['ADMIN', 'SUPER_ADMIN'].includes(normalizeRole(user.role))) return true;
  const rows = await repo.find('user_brand_roles', { userId });
  const active = rows.filter((row) => row.status !== 'DISABLED');
  return active.length === 0 ? brandId === 'default' : active.some((row) => row.brandId === '*' || row.brandId === brandId);
}

async function appendAudit(repo, {
  brandId = 'default', action, resourceType, resourceId = '', before = null, after = null, requestId = '', metadata = {},
}, session) {
  const doc = {
    _id: newIdNo('audit'), brandId, operatorId: session && session.userId || 'system',
    operatorRole: normalizeRole(session && session.role || 'SYSTEM'), action, resourceType, resourceId,
    requestId, ipMeta: metadata, createdAt: Date.now(),
  };
  if (before !== null) doc.before = before;
  if (after !== null) doc.after = after;
  return repo.insert('audit_logs', doc);
}

const ACCESS_MENUS = {
  CUSTOMER: ['home', 'orders', 'mine'], WORKER: ['pool', 'my-orders', 'wallet', 'profile'],
  ORDER_TAKER: ['pool', 'my-orders', 'wallet', 'profile'],
  CS: ['dashboard', 'orders', 'workers'], DISPATCHER: ['dashboard', 'orders', 'workers'],
  BRAND_ADMIN: ['dashboard', 'orders', 'products', 'brands', 'accounts', 'access', 'audit'],
  FINANCE_REVIEWER: ['dashboard', 'orders', 'ledger', 'wallets', 'withdrawals', 'reports'],
  ARBITRATOR: ['dashboard', 'orders', 'disputes'], ADMIN: ['*'], SUPER_ADMIN: ['*'],
};

function accessProfile(session) {
  const roles = [...new Set([session.role, ...(session.roles || [])].map(normalizeRole).filter(Boolean))];
  return {
    userId: session.userId, roles, brandScopes: [...new Set(session.brandScopes || [])],
    permissions: [...new Set(session.permissions || [])],
    visibleMenus: roles.some((role) => ['ADMIN', 'SUPER_ADMIN'].includes(role)) ? ['*'] : [...new Set(roles.flatMap((role) => ACCESS_MENUS[role] || []))],
  };
}
// 对象存储/订阅消息客户端:测试可注入 globalThis 替身,否则按环境变量构建。
function getUploadClient() {
  if (globalThis.__UPLOAD_CLIENT__) return globalThis.__UPLOAD_CLIENT__;
  return Upload.createUploadClient({ env: process.env });
}
function getSubscribeClient() {
  if (globalThis.__SUBSCRIBE_CLIENT__) return globalThis.__SUBSCRIBE_CLIENT__;
  return Subscribe.createSubscribeClient({ env: process.env });
}

// 订单客户 → customers._id(订阅消息接收人):订单 customerId 存的是小程序 openid,需反查 _id。
async function resolveCustomerId(repo, order) {
  if (!order || !order.customerId) return null;
  const c = await repo.findOne('customers', { openid: order.customerId });
  return c ? c._id : null;
}

// 订阅消息尽力下发:未配置/无额度/失败静默(4b subscribe.cjs 内部已留痕),不阻塞主流程。
async function sendSubscribe(repo, { receiverId, templateKey, templateId, page, data, brandId = 'default' }) {
  if (!receiverId) return { sent: false, reason: 'NO_RECEIVER' };
  try {
    return await getSubscribeClient().sendWithQuota(repo, { receiverId, templateKey, templateId, page, data, brandId });
  } catch (_) {
    return { sent: false, reason: 'SILENT_ERROR' };
  }
}

// 对账指标:对账补偿金额(延迟支付已关单的退款)、钱包可用余额合计、钱包总余额(含在途冻结)。
async function computeReconcileMetrics(repo) {
  const [refunds, wallets] = await Promise.all([repo.find('refunds', {}), repo.find('wallets', {})]);
  const reconciliationFen = refunds.filter((r) => r.reconcileTransactionId).reduce((s, r) => s + (r.amountFen || 0), 0);
  const totalWalletBalanceFen = wallets.reduce((s, w) => s + (w.availableFen || 0), 0);
  const walletBalanceSumFen = wallets.reduce((s, w) => s + (w.availableFen || 0) + (w.pendingWithdrawFen || 0), 0);
  return { reconciliationFen, totalWalletBalanceFen, walletBalanceSumFen };
}

// 身份证水印上传人姓名:优先实名,其次昵称。
async function resolveUploaderName(repo, session) {
  if (session.role !== 'WORKER') return '';
  const [user, profile] = await Promise.all([
    repo.getById('users', session.userId),
    repo.findOne('worker_profiles', { workerId: session.userId }),
  ]);
  return (profile && profile.realName) || (user && user.nickname) || '';
}

// 周起点(周一 0 点),用于周提现次数统计。
function startOfWeek() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// 客户订单 DTO(T0-11):商品/金额/状态文案/允许动作/格式化时间。
function orderDTO(order) {
  const snap = order.productSnapshot || {};
  const product = {
    id: order.productId,
    title: snap.title || snap.tierName || '',
    coverImage: snap.coverImage || (Array.isArray(snap.images) ? snap.images[0] : '') || '',
  };
  const allowed = [];
  if (order.status === D.OrderStatus.PENDING_PAYMENT) allowed.push('continuePay');
  if (order.status === D.OrderStatus.SETTLED) allowed.push('submitDispute');
  return {
    id: order._id,
    orderId: order._id,
    orderNo: order.orderNo,
    amountFen: order.amountFen,
    status: order.status,
    statusText: STATUS_TEXT[order.status] || order.status,
    product,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    completedAt: order.completedAt,
    disputeDeadline: order.disputeDeadline,
    allowedActions: allowed,
  };
}

function staffAllowedActions(order, session) {
  const roles = [session && session.role, ...((session && session.roles) || [])].map(normalizeRole);
  const actions = [];
  if (order.status === D.OrderStatus.PENDING_ACCEPT && roles.some((role) => ['CS', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'].includes(role))) actions.push('enterOrder');
  if (order.status === D.OrderStatus.PENDING_GRAB) {
    if (roles.includes('WORKER')) actions.push('grabOrder');
    if (roles.some((role) => ['CS', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'].includes(role))) actions.push('assignOrder');
  }
  if (order.status === D.OrderStatus.ASSIGN_PENDING && roles.includes('WORKER')) actions.push('acceptAssignment', 'rejectAssignment');
  if ([D.OrderStatus.ASSIGN_PENDING, D.OrderStatus.IN_SERVICE].includes(order.status) && roles.some((role) => ['CS', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'].includes(role))) actions.push('reassignOrder');
  if (order.status === D.OrderStatus.IN_SERVICE && roles.includes('WORKER')) actions.push('submitCompletion', 'releaseOrder');
  if (order.status === D.OrderStatus.PENDING_CONFIRM && roles.some((role) => ['CS', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'SUPER_ADMIN'].includes(role))) {
    if (order.verificationStatus !== 'VERIFIED') actions.push('verifyCompletion', 'rejectCompletion');
    else actions.push('closeOrder');
  }
  return actions;
}

function paymentMode() {
  const mode = String(process.env.PAYMENT_MODE || 'wechat').toLowerCase();
  if (!['mock', 'wechat'].includes(mode)) throw new Error('PAYMENT_MODE 必须为 mock/wechat');
  return mode;
}

async function ensurePayment(repo, order, { payType = 'MWEB', idempotencyKey = '' } = {}) {
  const mode = paymentMode();
  const channel = mode === 'mock' ? 'MOCK' : `WECHAT_${payType}`;
  const key = idempotencyKey || `${order._id}:${channel}`;
  let payment = await repo.findOne('payments', { brandId: order.brandId || 'default', idempotencyKey: key });
  if (payment) return payment;
  const brand = await repo.findOne('brands', { brandId: order.brandId || 'default' });
  const secretRef = mode === 'wechat' ? ((brand && brand.channelRefs && brand.channelRefs.paymentSecretRef) || (globalThis.__PAY_CLIENT__ ? 'injected:pay-client' : '') || (process.env.WECHAT_PAY_MCHID ? 'env:wechat-pay' : '')) : '';
  if (mode === 'wechat' && !secretRef) throw new Error('当前品牌未配置支付 secretRef');
  payment = await repo.insert('payments', {
    _id: newIdNo('payment'), paymentNo: `PAY${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    brandId: order.brandId || 'default', orderId: order._id, channel, amountFen: order.amountFen,
    status: 'PENDING', idempotencyKey: key, secretRef, createdAt: Date.now(), updatedAt: Date.now(),
  });
  await repo.updateById('orders', order._id, { paymentId: payment._id, paymentStatus: payment.status, updatedAt: Date.now() });
  return payment;
}

async function completePayment(repo, payment, { transactionId, amountFen, brandId, paidAt = Date.now() }) {
  if (payment.status === 'SUCCESS') return { code: 'SUCCESS', paymentId: payment._id, duplicate: true };
  const order = await repo.getById('orders', payment.orderId);
  if (!order) throw new Error('订单不存在');
  if (payment.brandId !== (order.brandId || 'default') || (brandId && brandId !== payment.brandId)) throw new Error('支付品牌不匹配');
  if (payment.amountFen !== order.amountFen || (amountFen !== undefined && Number(amountFen) !== payment.amountFen)) throw new Error('支付金额与订单金额不一致');
  if (order.status !== D.OrderStatus.PENDING_PAYMENT) throw new Error('订单当前状态不可支付');
  const duplicate = await repo.findOne('payments', { providerTransactionId: transactionId });
  if (duplicate && duplicate._id !== payment._id) throw new Error('支付流水已被其他支付单使用');
  const clone = cloneOrder(order);
  D.payOrder(clone, { paidAt, transactionId, payerOpenid: order.payerOpenid || order.customerId });
  return repo.transaction(async (tr) => {
    const res = await tr.updateWhere('orders', { _id: order._id, status: D.OrderStatus.PENDING_PAYMENT }, {
      status: clone.status, paidAt: clone.paidAt, transactionId, paymentId: payment._id, paymentStatus: 'SUCCESS', updatedAt: Date.now(),
    });
    if (res.updated !== 1) throw new Error('CONFLICT:订单状态已变化，请刷新');
    await tr.updateById('payments', payment._id, { status: 'SUCCESS', providerTransactionId: transactionId, paidAt, updatedAt: Date.now() });
    await tr.insert('order_logs', { _id: newIdNo('olog'), brandId: order.brandId || 'default', orderId: order._id, fromStatus: D.OrderStatus.PENDING_PAYMENT, toStatus: D.OrderStatus.PENDING_ACCEPT, action: 'payNotify', operatorType: 'system', operatorRole: 'SYSTEM', operatorId: 'payment', payloadSnapshot: { paymentId: payment._id }, requestId: '', remark: '支付成功', createdAt: Date.now() });
    return { code: 'SUCCESS', paymentId: payment._id, duplicate: false };
  });
}

async function addAssignment(repo, order, { type, workerId = '', previousWorkerId = '', operatorId = '', reason = '' }) {
  return repo.insert('assignments', {
    _id: newIdNo('assignment'), brandId: order.brandId || 'default', orderId: order._id, type,
    workerId, previousWorkerId, operatorId, reason, orderVersion: order.version || 0, createdAt: Date.now(),
  });
}

async function requireSuccessfulPayment(repo, order) {
  let payment = order.paymentId ? await repo.getById('payments', order.paymentId) : null;
  if (!payment && order.transactionId) payment = await repo.findOne('payments', { providerTransactionId: order.transactionId });
  if (!payment || payment.status !== 'SUCCESS' || payment.orderId !== order._id || payment.amountFen !== order.amountFen || payment.brandId !== (order.brandId || 'default')) throw new Error('订单缺少同品牌同金额的成功支付单');
  return payment;
}

// 联系方式脱敏:仅保留尾 4 位,其余打码(公开查单用)。
function maskContact(value) {
  if (!value) return '';
  const s = String(value);
  return s.length <= 4 ? '****' : `****${s.slice(-4)}`;
}

// 公开查单脱敏 DTO:不含 openid/交易流水/完整联系方式,仅状态与尾号。
function publicOrderDTO(order) {
  const snap = order.productSnapshot || {};
  return {
    id: order._id,
    orderId: order._id,
    orderNo: order.orderNo,
    amountFen: order.amountFen,
    status: order.status,
    statusText: STATUS_TEXT[order.status] || order.status,
    product: {
      title: snap.title || snap.tierName || '',
      coverImage: snap.coverImage || (Array.isArray(snap.images) ? snap.images[0] : '') || '',
    },
    contactPhone: maskContact(order.contactPhone),
    contactWechat: maskContact(order.contactWechat),
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    completedAt: order.completedAt,
  };
}

const services = {
  ...privacyServices,
  ...operationsServices,
  ...financeServices,
  // ---- 身份与登录 ----

  // 小程序静默登录:code2session 换小程序 openid → 建/取 customers → 签发 CUSTOMER 会话。
  async miniLogin(repo, { code, brandCode, appId }) {
    const oauth = getOAuthClient();
    const { openid } = await oauth.miniLogin(code);
    const brand = await resolveRequestBrand(repo, { brandCode, appId }, { allowDefault: true });
    let customer = await repo.findOne('customers', { openid });
    if (!customer) {
      customer = { _id: newIdNo('customer'), openid, brandId: brand.brandId, isVip: false, createdAt: Date.now(), updatedAt: Date.now() };
      await repo.insert('customers', customer);
    } else if (customer.brandId !== brand.brandId) {
      customer = await repo.updateById('customers', customer._id, { brandId: brand.brandId, updatedAt: Date.now() });
    }
    const { token } = auth.issueSession({ ...customer, role: 'CUSTOMER' }, { roles: ['CUSTOMER'], brandScopes: [brand.brandId], permissions: [] });
    return { token, customerId: customer._id, isVip: !!customer.isVip, brandId: brand.brandId };
  },

  // 服务号网页授权:code 换服务号 openid,供 H5 页 JSAPI 对商户支付(G.0)。
  async oauthExchange(repo, { code }) {
    return getOAuthClient().oauthExchange(code);
  },

  // 客服/管理员登录。
  async authLogin(repo, payload, session, context = {}) {
    const result = await auth.login(repo, { ...payload, roles: ['ADMIN', 'CS', 'DISPATCHER', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'ARBITRATOR', 'SUPER_ADMIN'] }, context);
    return { ...result, user: publicUser(result.user), role: normalizeRole(result.user.role) };
  },

  // 接单人员登录:返回 mustChangePwd 标志(首次强制改密)。
  async workerLogin(repo, payload, session, context = {}) {
    const result = await auth.login(repo, { ...payload, roles: ['WORKER'] }, context);
    return { ...result, user: publicUser(result.user), mustChangePwd: !!result.user.mustChangePwd };
  },

  // 修改密码:校验旧密码,成功清除强制改密标志。
  async changePassword(repo, payload, session) {
    return auth.security(repo).changePassword(payload, session);
  },

  ...Object.fromEntries(['getSecurityStatus', 'setupMfa', 'enableMfa', 'verifySecurityChallenge', 'revokeSessions', 'listLoginHistory', 'setAccountStatus'].map((action) => [action, (repo, payload, session) => auth.security(repo)[action](payload, session)])),
  async refreshSession(repo, payload, session) {
    const claims = await auth.security(repo).refreshSession(payload, session);
    return { token: auth.sign(claims), expiresInSeconds: 1800 };
  },

  async getAccessProfile(repo, {}, session) {
    return accessProfile(session);
  },

  // 后台员工管理：与本地镜像保持同名同语义，WORKER 仍由 createWorker 管理。
  async createStaff(repo, { role, phone, password, nickname, brandId = 'default', requestId = '', idempotencyKey = '' }, session) {
    const normalized = normalizeRole(role);
    if (!['ADMIN', 'CS', 'DISPATCHER', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'ARBITRATOR', 'SUPER_ADMIN'].includes(normalized)) throw new Error('后台员工角色不在允许范围');
    if (!phone || !password) throw new Error('手机号和密码不能为空');
    Security.assertPasswordStrength(password);
    if (await repo.findOne('users', { phone })) throw new Error('手机号已存在');
    const storedRole = normalized === 'CS' ? 'CUSTOMER_SERVICE' : normalized;
    const user = await repo.insert('users', {
      _id: newIdNo('user'), role: storedRole, phone, passwordHash: auth.hashPassword(password),
      nickname: nickname || phone, status: 'ACTIVE', mustChangePwd: true, securityVersion: 0, createdAt: Date.now(), updatedAt: Date.now(),
    });
    if (!['ADMIN', 'SUPER_ADMIN'].includes(normalized)) {
      await repo.insert('user_brand_roles', { _id: newIdNo('ubr'), userId: user._id, brandId, roles: [normalized], permissions: [], status: 'ACTIVE', createdAt: Date.now(), updatedAt: Date.now() });
    }
    await appendAudit(repo, { brandId, action: 'createStaff', resourceType: 'user', resourceId: user._id, after: publicUser(user), requestId: requestId || idempotencyKey }, session);
    return publicUser(user);
  },

  async listUsers(repo, { brandId } = {}, session) {
    const users = await repo.find('users', {});
    if (!brandId) return users.map(publicUser);
    const visible = [];
    for (const user of users) if (await userHasBrandScope(repo, user._id, brandId)) visible.push(publicUser(user));
    return visible;
  },

  async updateStaff(repo, { userId, status, acceptEnabled, requestId = '', idempotencyKey = '' }, session) {
    const user = await repo.getById('users', userId);
    if (!user) throw new Error('用户不存在');
    const before = publicUser({ ...user });
    const patch = { updatedAt: Date.now() };
    if (status !== undefined) {
      if (!['ACTIVE', 'DISABLED'].includes(status)) throw new Error('账号状态不合法');
      patch.status = status;
      patch.securityVersion = (user.securityVersion || 0) + 1;
    }
    if (acceptEnabled !== undefined && normalizeRole(user.role) === 'WORKER') patch.acceptEnabled = !!acceptEnabled;
    const updated = await repo.updateById('users', userId, patch);
    const rows = await repo.find('user_brand_roles', { userId });
    await appendAudit(repo, { brandId: rows[0] && rows[0].brandId || 'default', action: 'updateStaff', resourceType: 'user', resourceId: userId, before, after: publicUser(updated), requestId: requestId || idempotencyKey }, session);
    return publicUser(updated);
  },

  async listUserBrandRoles(repo, { userId, brandId } = {}, session) {
    let rows = await repo.find('user_brand_roles', userId ? { userId } : {});
    if (brandId) rows = rows.filter((row) => row.brandId === brandId);
    return rows.filter((row) => canAccessBrand(session, row.brandId));
  },

  async saveUserBrandRoles(repo, { userId, brandId, roles = [], permissions = [], status = 'ACTIVE', requestId = '', idempotencyKey = '' }, session) {
    if (!await repo.getById('users', userId)) throw new Error('用户不存在');
    if (!brandId) throw new Error('brandId 不能为空');
    assertBrandAccess(session, brandId);
    const existed = await repo.findOne('user_brand_roles', { userId, brandId });
    const before = existed ? { ...existed } : null;
    const doc = { userId, brandId, roles: [...new Set(roles.map(normalizeRole))], permissions: [...new Set(permissions)], status, updatedAt: Date.now() };
    const saved = existed ? await repo.updateById('user_brand_roles', existed._id, doc) : await repo.insert('user_brand_roles', { _id: newIdNo('ubr'), ...doc, createdAt: Date.now() });
    await appendAudit(repo, { brandId, action: 'saveUserBrandRoles', resourceType: 'user_brand_role', resourceId: saved._id, before, after: saved, requestId: requestId || idempotencyKey }, session);
    return saved;
  },

  async listAuditLogs(repo, { brandId, action, resourceType } = {}, session) {
    let rows = await repo.find('audit_logs', brandId ? { brandId } : {});
    return rows.filter((row) => canAccessBrand(session, row.brandId))
      .filter((row) => !action || row.action === action)
      .filter((row) => !resourceType || row.resourceType === resourceType)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  // ---- 商品 / 品牌(公开读) ----

  async listProducts(repo, { game, brandId, brandCode, appId } = {}) {
    const context = await resolveRequestBrand(repo, { brandId, brandCode, appId }, { allowDefault: true });
    let list = await repo.find('products', { status: 'ON' });
    if (game) list = list.filter((p) => p.game === game);
    list = list.filter((p) => (p.brandId || 'default') === context.brandId);
    return list.sort((a, b) => (a.sort || 0) - (b.sort || 0)).map((product) => ({ ...product, id: product._id }));
  },

  async getProduct(repo, { productId, brandId, brandCode, appId }) {
    const product = await repo.getById('products', productId);
    if (!product) throw new Error('商品不存在');
    const context = await resolveRequestBrand(repo, { brandId, brandCode, appId }, { allowDefault: true });
    if ((product.brandId || 'default') !== context.brandId) throw new Error('BRAND_FORBIDDEN');
    return { ...product, id: product._id };
  },

  // 公开查单:orderNo 相等且联系方式任一匹配 → 返回脱敏订单 DTO;不匹配返回 ORDER_NOT_FOUND。
  async queryOrderByNo(repo, { orderNo, contactPhone, contactWechat }) {
    if (!orderNo) return { ok: false, code: 'ORDER_NOT_FOUND', message: '订单不存在' };
    const order = await repo.findOne('orders', { orderNo });
    if (!order) return { ok: false, code: 'ORDER_NOT_FOUND', message: '订单不存在' };
    const phoneMatch = !!contactPhone && order.contactPhone === contactPhone;
    const wechatMatch = !!contactWechat && order.contactWechat === contactWechat;
    if (!phoneMatch && !wechatMatch) return { ok: false, code: 'ORDER_NOT_FOUND', message: '订单不存在' };
    return { ok: true, order: publicOrderDTO(order) };
  },

  // ---- H5 下单链路(一期恢复 + 加固) ----

  // 主链路:小程序端(CUSTOMER 会话)申请下单 token,绑定小程序 openid。
  // 兜底渠道:wechat-callback 凭 INTERNAL_SECRET 以 system 模式调用(session 为空),token 绑 productId,openid 为客服通道 openid(仅记录,不作身份鉴权)。
  async h5Token(repo, { productId, openid }, session) {
    if (!session) {
      const product = await repo.getById('products', productId);
      if (!product || product.status !== 'ON') throw new Error('商品已下架或不存在');
      return { token: issueH5Token({ productId, brandId: product.brandId || 'default', openid: openid || '', mode: 'cs' }) };
    }
    auth.rejectIdentityOverride({ productId }, session.role);
    const product = await repo.getById('products', productId);
    if (!product || product.status !== 'ON') throw new Error('商品已下架或不存在');
    const brandId = product.brandId || 'default';
    assertBrandAccess(session, brandId);
    return { token: issueH5Token({ productId, brandId, openid: session.openid, mode: 'app' }) };
  },

  // 客服/管理员可撤销误发或疑似泄露的 H5 token；_id=jti 保证幂等。
  async revokeH5Token(repo, { token, jti, reason = 'manual-revoke' } = {}, session) {
    const claims = token ? verifyH5Token(token) : null;
    const tokenId = jti || (claims && claims.jti);
    if (!tokenId || !/^[A-Za-z0-9_-]{16,128}$/.test(tokenId)) throw new Error('H5 token jti 非法');
    const existed = await repo.getById('h5_token_revocations', tokenId);
    if (existed) return { revoked: true, duplicate: true, jti: tokenId };
    await repo.insert('h5_token_revocations', {
      _id: tokenId, brandId: (claims && claims.brandId) || 'default', reason,
      revokedBy: session.userId, revokedAt: Date.now(), expiresAt: (claims && claims.exp) || Date.now() + H5_TOKEN_TTL_MS,
    });
    return { revoked: true, duplicate: false, jti: tokenId };
  },

  // H5 页取商品信息:验 token 签名/过期。
  async getH5Product(repo, { token }) {
    const { openid, productId, brandId } = await verifyActiveH5Token(repo, token);
    const product = await repo.getById('products', productId);
    if (!product || product.status !== 'ON') throw new Error('商品已下架或不存在');
    if ((product.brandId || 'default') !== (brandId || 'default')) throw new Error('BRAND_CHANNEL_MISMATCH');
    return { product: { ...product, id: product._id }, openid, productId };
  },

  // H5 下单:token 自证;app 模式绑小程序 openid,cs 模式无 openid(按订单号+联系方式关联);payerOpenid 绑服务号 openid(JSAPI)。
  async createOrderFromH5(repo, { h5Token, token, productId, contactWechat, contactPhone, payerOpenid, idempotencyKey, ...dynamicFields }) {
    const t = await verifyActiveH5Token(repo, h5Token || token);
    const pid = productId || t.productId;
    if (t.productId !== pid) throw new Error('H5 下单链接与商品不匹配');
    if (!contactWechat && !contactPhone) throw new Error('微信号与手机号至少填写一项');
    const product = await repo.getById('products', pid);
    if (!product || product.status !== 'ON') throw new Error('商品已下架或不存在');
    const customerId = t.mode === 'app' ? t.openid : '';
    const requestKey = idempotencyKey || '';
    const idempotencyScope = `${product.brandId || 'default'}:${customerId || contactWechat || contactPhone}`;
    if (requestKey) {
      const existed = await repo.findOne('orders', { idempotencyScope, idempotencyKey: requestKey });
      if (existed) return { orderId: existed._id, orderNo: existed.orderNo, amountFen: existed.amountFen, payDeadline: existed.payDeadline, duplicate: true };
    }
    await Ops.enforceLaunchPolicy(repo, { brandId: product.brandId || 'default', userId: t.openid || contactWechat || contactPhone, amountFen: product.priceFen }, process.env);
    const formSchema = product.formSchema || {};
    if (Array.isArray(formSchema)) {
      for (const field of formSchema) {
        const value = dynamicFields[field.key];
        if (field.required && (value === undefined || value === null || value === '')) throw new Error(`缺少必填字段: ${field.label || field.key}`);
        if (field.type === 'number' && value !== undefined && value !== '' && !Number.isFinite(Number(value))) throw new Error(`${field.label || field.key} 必须为数字`);
      }
    } else {
      for (const key of Array.isArray(formSchema.required) ? formSchema.required : []) {
        const value = dynamicFields[key];
        if (value === undefined || value === null || String(value).trim() === '') throw new Error(`缺少必填字段: ${key}`);
      }
      for (const [key, value] of Object.entries(dynamicFields)) {
        if (formSchema.properties && formSchema.properties[key] && formSchema.properties[key].type === 'number' && value !== '' && !Number.isFinite(Number(value))) throw new Error(`${key} 必须为数字`);
      }
    }
    const brand = await repo.findOne('brands', { brandId: product.brandId || 'default' });
    const rules = await repo.find('commission_rules', { brandId: product.brandId || 'default' });
    const activeRule = (product.commissionRuleId && await repo.getById('commission_rules', product.commissionRuleId))
      || rules.filter((rule) => ['ACTIVE', 'DEMO_ONLY'].includes(rule.status) && (rule.effectiveAt || 0) <= Date.now()).sort((a, b) => (b.version || 0) - (a.version || 0))[0];
    const now = Date.now();
    const orderId = newIdNo('order');
    const order = D.createOrder({
      id: orderId,
      amountFen: product.priceFen,
      productId: pid,
      customerId,
      contactWechat: contactWechat || '',
      contactPhone: contactPhone || '',
      productSnapshot: {
        title: product.title, game: product.game, serviceType: product.serviceType, tierName: product.tierName,
        guaranteedOutput: product.guaranteedOutput, outputUnit: product.outputUnit, priceFen: product.priceFen,
        coverImage: (Array.isArray(product.images) && product.images[0]) || '',
        images: product.images || [], assetIds: product.assetIds || [], formSchema: product.formSchema || [], productVersion: product.version || 1,
      },
      createdAt: now,
    });
    order._id = orderId;
    delete order.id; // 统一主键:业务主键即 _id,删除冗余 id 字段(T0-03)
    order.orderNo = `GS${now}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    order.commission = product.commission; // 抽成快照(下单时点)
    order.guaranteedOutput = product.guaranteedOutput;
    order.brandId = product.brandId || 'default';
    order.grayUserId = t.openid || contactWechat || contactPhone || customerId;
    order.brandSnapshot = {
      brandId: product.brandId || 'default', brandCode: (brand && brand.code) || t.brandId || product.brandId || 'default',
      name: (brand && brand.name) || product.brandId || 'default', version: (brand && (brand.publishedVersion || brand.version)) || 1,
      publicConfig: JSON.parse(JSON.stringify((brand && brand.publicConfig) || {})),
    };
    order.commissionRuleSnapshot = activeRule
      ? { ruleId: activeRule._id, version: activeRule.version, status: activeRule.status, rule: JSON.parse(JSON.stringify(activeRule.rule)) }
      : { ruleId: '', version: product.version || 1, status: 'DEMO_ONLY', rule: JSON.parse(JSON.stringify(product.commission)) };
    order.idempotencyKey = requestKey;
    order.idempotencyScope = idempotencyScope;
    order.formData = dynamicFields;
    order.payerOpenid = payerOpenid || ''; // 微信内 H5 先 oauthExchange 拿服务号 openid 传入
    order.isVip = await matchVip(repo, { contactPhone, contactWechat });
    order.updatedAt = now;
    await repo.insert('orders', order);
    return { orderId: order._id, orderNo: order.orderNo, amountFen: order.amountFen, payDeadline: order.payDeadline, duplicate: false };
  },

  // 支付参数双通道(最终契约):payType 显式指定 JSAPI/MWEB,openid=服务号网页授权 openid。
  // 校验:H5 token 有效 + token.productId===order.productId + 订单待支付,任一不满足返回 ORDER_NOT_PAYABLE。
  async getPaymentParams(repo, { orderId, payType, openid, h5Token, token, clientIp, idempotencyKey = '' }) {
    let t;
    try {
      t = await verifyActiveH5Token(repo, h5Token || token);
    } catch (_) {
      return { ok: false, code: 'ORDER_NOT_PAYABLE', message: '订单不可支付' };
    }
    const order = await repo.getById('orders', orderId);
    if (!order) return { ok: false, code: 'ORDER_NOT_PAYABLE', message: '订单不可支付' };
    if (order.productId !== t.productId) return { ok: false, code: 'ORDER_NOT_PAYABLE', message: '订单不可支付' };
    if (order.status !== D.OrderStatus.PENDING_PAYMENT) return { ok: false, code: 'ORDER_NOT_PAYABLE', message: '订单不可支付' };
    if (D.isPaymentExpired(order, Date.now())) return { ok: false, code: 'ORDER_NOT_PAYABLE', message: '订单已超时关闭' };
    await Ops.enforceLaunchPolicy(repo, { brandId: order.brandId || 'default', userId: t.openid || order.customerId || order.contactWechat || order.contactPhone, amountFen: order.amountFen, orderId: order._id }, process.env);
    const payment = await ensurePayment(repo, order, { payType, idempotencyKey });
    if (paymentMode() === 'mock') {
      return { paymentMode: 'mock', paymentId: payment._id, paymentNo: payment.paymentNo, status: payment.status, payType: 'MOCK', mockToken: `mock_${payment.paymentNo}` };
    }
    const pay = require('./payment-operations.cjs').clientFor(order, payment.secretRef).client;
    if (!pay.isConfigured()) return { ok: false, code: 'ORDER_NOT_PAYABLE', message: '微信支付未配置' };
    const product = await repo.getById('products', order.productId);
    const description = (product && product.title) || `订单${order.orderNo}`;
    if (payType !== 'JSAPI' && payType !== 'MWEB') throw new Error('非法支付类型 payType');
    if (payType === 'JSAPI') {
      // 微信内 JSAPI:openid 为服务号网页授权 openid,商户号需关联认证服务号。
      if (!openid) return { ok: false, code: 'ORDER_NOT_PAYABLE', message: 'JSAPI 支付缺少 openid' };
      const prepayId = await pay.jsapiPrepay({ outTradeNo: order.orderNo, amountFen: order.amountFen, description, openid });
      const jsapi = await pay.jsapiPayParams({ prepayId });
      await repo.updateById('payments', payment._id, { providerPrepayId: prepayId, updatedAt: Date.now() });
      await repo.updateById('orders', orderId, { payType: 'JSAPI', prepayId, paymentId: payment._id, updatedAt: Date.now() });
      return { paymentMode: 'wechat', paymentId: payment._id, paymentNo: payment.paymentNo, status: payment.status, payType: 'JSAPI', jsapi };
    }
    // 微信外 H5 支付(mweb):返回 mwebUrl,兼容 h5Url 别名。
    const h5Url = await pay.h5Prepay({ outTradeNo: order.orderNo, amountFen: order.amountFen, description, clientIp });
    await repo.updateById('payments', payment._id, { providerPrepayId: order.orderNo, updatedAt: Date.now() });
    await repo.updateById('orders', orderId, { payType: 'MWEB', h5Url, paymentId: payment._id, updatedAt: Date.now() });
    return { paymentMode: 'wechat', paymentId: payment._id, paymentNo: payment.paymentNo, status: payment.status, payType: 'MWEB', mwebUrl: h5Url, h5Url };
  },

  async confirmMockPayment(repo, { paymentId }, session) {
    if (paymentMode() !== 'mock') throw new Error('非 development/mock 环境禁止模拟支付');
    const payment = await repo.getById('payments', paymentId);
    if (!payment) throw new Error('支付单不存在');
    const order = await repo.getById('orders', payment.orderId);
    if (!order || (order.customerId && order.customerId !== session.openid)) throw new Error('无权操作该支付单');
    return completePayment(repo, payment, { transactionId: `mock-tx-${payment.paymentNo}`, amountFen: payment.amountFen, brandId: payment.brandId });
  },

  async getPaymentStatus(repo, { paymentId, orderId, h5Token, token }) {
    let payment = paymentId ? await repo.getById('payments', paymentId) : null;
    if (!payment && orderId) {
      const rows = await repo.find('payments', { orderId });
      payment = rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
    }
    if (!payment) throw new Error('支付单不存在');
    const order = await repo.getById('orders', payment.orderId);
    const t = await verifyActiveH5Token(repo, h5Token || token);
    if (!order || t.productId !== order.productId || (t.brandId || 'default') !== (order.brandId || 'default')) throw new Error('无权查询该支付单');
    return { paymentId: payment._id, paymentNo: payment.paymentNo, orderId: payment.orderId, status: payment.status, paidAt: payment.paidAt || 0, failureReason: payment.failureReason || '' };
  },

  async listPayments(repo, { orderId, brandId = '', status = '' } = {}, session) {
    if (brandId) assertBrandAccess(session, brandId);
    let rows = await repo.find('payments', orderId ? { orderId } : {});
    return rows.filter((row) => canAccessBrand(session, row.brandId || 'default'))
      .filter((row) => !brandId || row.brandId === brandId).filter((row) => !status || row.status === status);
  },

  // 客服发链接兜底:token 无 openid、仅绑 productId。
  async sendCustomerServiceLink(repo, { productId }, session) {
    const product = await repo.getById('products', productId);
    if (!product || product.status !== 'ON') throw new Error('商品已下架或不存在');
    const token = issueH5Token({ productId, mode: 'cs' });
    const link = buildH5OrderLink(H5_ORDER_BASE_URL, token);
    return { link, token };
  },

  // ---- 支付回调(幂等 + 条件更新 + 金额核对 + 对账补偿) ----

  async payNotify(repo, payload) {
    return require('./payment-operations.cjs').payNotify(repo, payload, completePayment);
  },

  async compensatePayments(repo, payload, session) {
    return require('./payment-operations.cjs').compensatePayments(repo, payload, session, completePayment);
  },

  // ---- 订单中心(客户/接单) ----

  async listMyOrders(repo, {}, session) {
    let list;
    if (session.role === 'WORKER') {
      list = await repo.find('orders', { workerId: session.userId });
    } else {
      list = await repo.find('orders', { customerId: session.openid });
    }
    return list.filter((order) => canAccessBrand(session, order.brandId || 'default')).map((order) => ({ ...orderDTO(order), allowedActions: session.role === 'WORKER' ? staffAllowedActions(order, session) : orderDTO(order).allowedActions })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  async getMyOrder(repo, { orderId }, session) {
    const order = await repo.getById('orders', orderId);
    if (!order) throw new Error('订单不存在');
    assertBrandAccess(session, order.brandId || 'default');
    if (session.role === 'WORKER') {
      if (order.workerId !== session.userId) throw new Error('无权查看他人订单');
    } else if (order.customerId && order.customerId !== session.openid) {
      throw new Error('无权查看他人订单');
    }
    const messages = await repo.find('order_messages', { orderId });
    return { ...orderDTO(order), allowedActions: session.role === 'WORKER' ? staffAllowedActions(order, session) : orderDTO(order).allowedActions, messages };
  },

  async submitDispute(repo, { orderId, content, attachmentIds = [] }, session) {
    const order = await repo.getById('orders', orderId);
    if (!order) throw new Error('订单不存在');
    if (order.customerId && order.customerId !== session.openid) throw new Error('无权操作他人订单');
    const existed = await repo.findOne('disputes', { orderId });
    if (existed) throw new Error('该订单已存在异议');
    const clone = cloneOrder(order);
    D.openDispute(clone, { customerId: session.openid || session.userId, content });
    const disputeId = newIdNo('dispute');
    return repo.transaction(async (tr) => {
      const res = await tr.updateWhere('orders', { _id: orderId, status: D.OrderStatus.SETTLED }, { status: clone.status, dispute: clone.dispute, updatedAt: clone.updatedAt });
      if (res.updated !== 1) throw new Error('订单状态已变化,无法发起异议');
      const nowTs = Date.now();
      await tr.insert('disputes', { _id: disputeId, brandId: order.brandId || 'default', orderId, customerId: session.openid || session.userId, content, attachmentIds, status: 'OPEN', evidence: attachmentIds.length ? [{ side: 'CUSTOMER', submitterId: session.userId, content, attachmentIds, createdAt: nowTs }] : [], timeline: [{ action: 'OPEN', operatorId: session.userId, createdAt: nowTs }], createdAt: nowTs, updatedAt: nowTs });
      await tr.insert('order_logs', { _id: newIdNo('olog'), brandId: order.brandId || 'default', orderId, fromStatus: D.OrderStatus.SETTLED, toStatus: D.OrderStatus.DISPUTING, action: 'submitDispute', operatorType: 'customer', operatorRole: 'CUSTOMER', operatorId: session.userId, payloadSnapshot: { attachmentIds }, requestId: '', remark: '发起异议', createdAt: Date.now() });
      return { disputeId };
    });
  },

  async listDisputes(repo, { brandId = '', status = '' } = {}, session) {
    if (brandId) assertBrandAccess(session, brandId);
    const rows = await repo.find('disputes', brandId ? { brandId } : {});
    return rows.filter((row) => canAccessBrand(session, row.brandId || 'default')).filter((row) => !status || row.status === status).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  async getDispute(repo, { disputeId }, session) {
    const dispute = await repo.getById('disputes', disputeId);
    if (!dispute) throw new Error('异议不存在');
    const order = await repo.getById('orders', dispute.orderId);
    assertBrandAccess(session, dispute.brandId || 'default');
    if (normRole(session.role) === 'CUSTOMER' && dispute.customerId !== (session.openid || session.userId)) throw new Error('无权查看该异议');
    if (normRole(session.role) === 'WORKER' && (!order || order.workerId !== session.userId)) throw new Error('无权查看该异议');
    return { dispute, order };
  },

  async addDisputeEvidence(repo, { disputeId, content = '', attachmentIds = [], side = '' }, session) {
    const dispute = await repo.getById('disputes', disputeId);
    if (!dispute) throw new Error('异议不存在');
    if (!['OPEN', 'EVIDENCE_COLLECTION'].includes(dispute.status)) throw new Error('异议当前状态不允许补充证据');
    const role = normRole(session.role);
    const resolvedSide = role === 'CUSTOMER' ? 'CUSTOMER' : role === 'WORKER' ? 'WORKER' : (side || 'PLATFORM');
    const evidence = [...(dispute.evidence || []), { side: resolvedSide, submitterId: session.userId, content, attachmentIds, createdAt: Date.now() }];
    const timeline = [...(dispute.timeline || []), { action: 'ADD_EVIDENCE', operatorId: session.userId, side: resolvedSide, createdAt: Date.now() }];
    return repo.updateById('disputes', disputeId, { status: 'EVIDENCE_COLLECTION', evidence, timeline, updatedAt: Date.now() });
  },

  async startDisputeReview(repo, { disputeId, requestId = '' }, session) {
    const dispute = await repo.getById('disputes', disputeId);
    if (!dispute) throw new Error('异议不存在');
    const status = dispute.status === 'PENDING' ? 'OPEN' : dispute.status;
    if (!['OPEN', 'EVIDENCE_COLLECTION'].includes(status)) throw new Error('异议当前状态不允许开始审理');
    const timeline = [...(dispute.timeline || []), { action: 'UNDER_REVIEW', operatorId: session.userId, createdAt: Date.now() }];
    const updated = await repo.updateById('disputes', disputeId, { status: 'UNDER_REVIEW', arbitratorId: session.userId, timeline, updatedAt: Date.now() });
    await appendAudit(repo, { brandId: dispute.brandId || 'default', action: 'startDisputeReview', resourceType: 'dispute', resourceId: disputeId, before: dispute, after: updated, requestId }, session);
    return updated;
  },

  async closeDispute(repo, { disputeId, requestId = '' }, session) {
    const dispute = await repo.getById('disputes', disputeId);
    if (!dispute) throw new Error('异议不存在');
    if (!['DECIDED', 'RESOLVED'].includes(dispute.status)) throw new Error('异议尚未裁决，不能结案');
    const timeline = [...(dispute.timeline || []), { action: 'CLOSED', operatorId: session.userId, createdAt: Date.now() }];
    const updated = await repo.updateById('disputes', disputeId, { status: 'CLOSED', closedAt: Date.now(), timeline, updatedAt: Date.now() });
    await appendAudit(repo, { brandId: dispute.brandId || 'default', action: 'closeDispute', resourceType: 'dispute', resourceId: disputeId, before: dispute, after: updated, requestId }, session);
    return updated;
  },

  async requestSubscribe(repo, { templateKey, orderId }, session) {
    if (!templateKey) throw new Error('缺少订阅模板');
    const order = await repo.getById('orders', orderId);
    if (!order) throw new Error('订单不存在');
    const existed = await repo.findOne('subscribe_quota', { orderId, templateKey });
    if (existed) return { granted: true }; // 一单一授权,重复幂等
    await repo.insert('subscribe_quota', {
      _id: newIdNo('subq'), brandId: order.brandId || 'default', customerId: session.userId, templateKey, orderId,
      grantedAt: Date.now(), usedAt: null, createdAt: Date.now(), // usedAt=null 供下发前条件扣减
    });
    return { granted: true };
  },

  // ---- 客服/管理员订单管理 ----

  async listOrders(repo, { status, game, serviceType, from, to, keyword, brandId } = {}, session) {
    let list = await repo.find('orders', {});
    if (brandId) assertBrandAccess(session, brandId);
    list = list.filter((order) => canAccessBrand(session, order.brandId || 'default'));
    if (brandId) list = list.filter((order) => (order.brandId || 'default') === brandId);
    if (status) list = list.filter((o) => o.status === status);
    if (game) list = list.filter((o) => o.game === game);
    if (serviceType) list = list.filter((o) => o.serviceType === serviceType);
    if (from) list = list.filter((o) => o.createdAt >= from);
    if (to) list = list.filter((o) => o.createdAt <= to);
    if (keyword) list = list.filter((o) => o.orderNo === keyword || o.contactPhone === keyword || o.contactWechat === keyword);
    return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map((order) => ({ ...order, allowedActions: staffAllowedActions(order, session) }));
  },

  async getOrder(repo, { orderId }, session) {
    const order = await repo.getById('orders', orderId);
    if (!order) throw new Error('订单不存在');
    assertBrandAccess(session, order.brandId || 'default');
    const [logs, refunds, attachments, dispute, payments, assignments] = await Promise.all([
      repo.find('order_logs', { orderId }).then((x) => x.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))),
      repo.find('refunds', { orderId }),
      repo.find('attachments', { bizId: orderId }),
      repo.findOne('disputes', { orderId }),
      repo.find('payments', { orderId }),
      repo.find('assignments', { orderId }),
    ]);
    // 出参契约定案:{order, logs[], attachments[], refund, dispute}(refund 取最近一条)。
    const refund = refunds.length ? refunds.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0] : null;
    return { order: { ...order, allowedActions: staffAllowedActions(order, session) }, logs, attachments, refund, dispute, payments, assignments };
  },

  async listOrderLogs(repo, { orderId }, session) {
    const logs = await repo.find('order_logs', { orderId });
    return logs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  },

  // 抢单池:含入池时长与超时标(入池 30 分钟)。
  async listPool(repo, { brandId = '' } = {}, session) {
    if (brandId) assertBrandAccess(session, brandId);
    const pool = await repo.find('orders', { status: D.OrderStatus.PENDING_GRAB });
    const now = Date.now();
    return pool
      .filter((o) => canAccessBrand(session, o.brandId || 'default'))
      .filter((o) => !brandId || (o.brandId || 'default') === brandId)
      .map((o) => ({
      ...o,
      allowedActions: staffAllowedActions(o, session),
      pooledDurationMs: o.pooledAt ? now - o.pooledAt : 0,
      pooledTimeout: !!(o.pooledAt && now - o.pooledAt > (o.poolTimeoutMs || DEFAULTS.poolTimeoutMs)),
    }));
  },

  async enterOrder(repo, { orderId, game, region, serviceType, customerUid, customerNickname, expectStartAt, requirementNote, sessionNote, internalNote, contactWechat, contactPhone }, session) {
    const before = await repo.getById('orders', orderId);
    if (!before) throw new Error('订单不存在');
    // 客服修正联系方式:与现值不同才记为变更,进池后补写 order_logs 留痕。
    const contactChanged = (contactWechat !== undefined && contactWechat !== before.contactWechat) ||
      (contactPhone !== undefined && contactPhone !== before.contactPhone);
    const result = await transition(repo, orderId, D.OrderStatus.PENDING_ACCEPT, (clone) => {
      if (contactWechat !== undefined) clone.contactWechat = contactWechat;
      if (contactPhone !== undefined) clone.contactPhone = contactPhone;
      D.enterOrder(clone, { game, region, serviceType, customerUid, customerNickname, expectStartAt, requirementNote, sessionNote, internalNote });
    }, { action: 'enterOrder', operatorType: normRole(session.role), operatorId: session.userId, remark: '录入完成进池' });
    if (contactChanged) {
      await addOrderLog(repo, orderId, { fromStatus: D.OrderStatus.PENDING_ACCEPT, toStatus: D.OrderStatus.PENDING_GRAB, action: 'enterOrder', operatorType: normRole(session.role), operatorId: session.userId, remark: `客服修正联系方式: 微信 ${before.contactWechat || ''}→${contactWechat || ''}、手机 ${before.contactPhone || ''}→${contactPhone || ''}` });
    }
    return result;
  },

  async assignOrder(repo, { orderId, workerId }, session) {
    const worker = await repo.getById('users', workerId);
    if (!worker || worker.status !== 'ACTIVE' || normalizeRole(worker.role) !== 'WORKER') throw new Error('接单人员不存在或已停用');
    const order = await repo.getById('orders', orderId);
    if (!order) throw new Error('订单不存在');
    const brandId = order.brandId || 'default';
    assertBrandAccess(session, brandId);
    if (!await userHasBrandScope(repo, workerId, brandId)) throw new Error('BRAND_FORBIDDEN');
    const result = await transition(repo, orderId, D.OrderStatus.PENDING_GRAB, (clone) => {
      D.assignOrder(clone, workerId, { assignedBy: session.userId });
    }, { action: 'assignOrder', operatorType: normRole(session.role), operatorId: session.userId, remark: `指派给 ${workerId}` });
    await addAssignment(repo, result, { type: 'ASSIGN', workerId, operatorId: session.userId });
    return result;
  },

  async reassignOrder(repo, { orderId, workerId, reason = '', requestId = '', idempotencyKey = '' }, session) {
    const order = await repo.getById('orders', orderId);
    if (!order) throw new Error('订单不存在');
    assertBrandAccess(session, order.brandId || 'default');
    if (![D.OrderStatus.ASSIGN_PENDING, D.OrderStatus.IN_SERVICE].includes(order.status)) throw new Error('订单当前状态不允许改派');
    const worker = await repo.getById('users', workerId);
    if (!worker || worker.status !== 'ACTIVE' || normalizeRole(worker.role) !== 'WORKER' || !await userHasBrandScope(repo, workerId, order.brandId || 'default')) throw new Error('接单人员不存在、已停用或品牌不匹配');
    const previousWorkerId = order.workerId || '';
    const patch = { status: D.OrderStatus.ASSIGN_PENDING, workerId, assignedBy: session.userId, assignedAt: Date.now(), updatedAt: Date.now() };
    const updated = await repo.transaction(async (tr) => {
      await tr.updateById('orders', orderId, patch);
      await tr.insert('order_logs', { _id: newIdNo('olog'), brandId: order.brandId || 'default', orderId, fromStatus: order.status, toStatus: D.OrderStatus.ASSIGN_PENDING, action: 'reassignOrder', operatorType: normRole(session.role), operatorRole: normRole(session.role), operatorId: session.userId, payloadSnapshot: { workerId, previousWorkerId }, requestId: requestId || idempotencyKey, remark: reason, createdAt: Date.now() });
      await tr.insert('assignments', { _id: newIdNo('assignment'), brandId: order.brandId || 'default', orderId, type: 'REASSIGN', workerId, previousWorkerId, operatorId: session.userId, reason, requestId: requestId || idempotencyKey, createdAt: Date.now() });
      return tr.getById('orders', orderId);
    });
    await appendAudit(repo, { brandId: order.brandId || 'default', action: 'reassignOrder', resourceType: 'order', resourceId: orderId, before: order, after: updated, requestId: requestId || idempotencyKey }, session);
    return updated;
  },

  async listAssignments(repo, { orderId }, session) {
    const order = await repo.getById('orders', orderId);
    if (!order) throw new Error('订单不存在');
    assertBrandAccess(session, order.brandId || 'default');
    const rows = await repo.find('assignments', { orderId });
    if (normRole(session.role) === 'WORKER' && !rows.some((row) => row.workerId === session.userId || row.previousWorkerId === session.userId)) throw new Error('无权查看该指派历史');
    return rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  },

  async grabOrder(repo, { orderId, expectedVersion }, session) {
    const worker = await repo.getById('users', session.userId);
    if (!worker || worker.status !== 'ACTIVE' || worker.acceptEnabled === false) throw new Error('接单权限未开启');
    const wallet = await ensureWallet(repo, session.userId);
    if (wallet.freezeAccept) throw new Error('接单权限已被冻结');
    const maxActive = await getConfig(repo, 'maxActiveOrders', DEFAULTS.maxActiveOrders);
    const mine = await repo.find('orders', { workerId: session.userId });
    const inProgress = mine.filter((o) => [D.OrderStatus.IN_SERVICE, D.OrderStatus.PENDING_CONFIRM].includes(o.status)).length;
    if (inProgress >= maxActive) throw new Error(`同时进行订单已达上限(${maxActive})`);
    const order = await repo.getById('orders', orderId);
    if (!order || order.status !== D.OrderStatus.PENDING_GRAB) throw new Error('CONFLICT:订单状态已变化，请刷新');
    if (expectedVersion !== undefined && expectedVersion !== (order.version || 0)) throw new Error('CONFLICT:订单版本已变化，请刷新');
    const result = await transition(repo, orderId, D.OrderStatus.PENDING_GRAB, (clone) => {
      D.grabOrder(clone, session.userId, { maxActiveOrders: maxActive });
      clone.version = (clone.version || 0) + 1;
    }, { action: 'grabOrder', operatorType: 'worker', operatorId: session.userId, remark: '抢单' });
    await addAssignment(repo, result, { type: 'CLAIM', workerId: session.userId, operatorId: session.userId });
    return result;
  },

  async acceptAssignment(repo, { assignmentId }, session) {
    const order = await repo.getById('orders', assignmentId);
    if (!order) throw new Error('订单不存在');
    if (order.workerId !== session.userId) throw new Error('指派对象不一致');
    const result = await transition(repo, assignmentId, D.OrderStatus.ASSIGN_PENDING, (clone) => {
      D.acceptAssignment(clone, session.userId);
    }, { action: 'acceptAssignment', operatorType: 'worker', operatorId: session.userId, remark: '接受指派' });
    await addAssignment(repo, result, { type: 'ACCEPT', workerId: session.userId, operatorId: session.userId });
    return result;
  },

  async rejectAssignment(repo, { assignmentId, reason }, session) {
    const before = await repo.getById('orders', assignmentId);
    const result = await transition(repo, assignmentId, D.OrderStatus.ASSIGN_PENDING, (clone) => {
      D.rejectAssignment(clone, session.userId, { reason });
    }, { action: 'rejectAssignment', operatorType: 'worker', operatorId: session.userId, remark: `拒绝指派: ${reason || ''}` });
    await addAssignment(repo, result, { type: 'REJECT', workerId: session.userId, previousWorkerId: before && before.workerId || '', operatorId: session.userId, reason });
    return result;
  },

  async releaseOrder(repo, { orderId, reason }, session) {
    const order = await repo.getById('orders', orderId);
    if (!order) throw new Error('订单不存在');
    if (order.workerId !== session.userId) throw new Error('退单人员与接单人员不一致');
    const result = await transition(repo, orderId, D.OrderStatus.IN_SERVICE, (clone) => {
      D.releaseOrder(clone, session.userId, { reason });
    }, { action: 'releaseOrder', operatorType: 'worker', operatorId: session.userId, remark: `退单: ${reason || ''}` });
    await addAssignment(repo, result, { type: 'RELEASE', workerId: session.userId, previousWorkerId: session.userId, operatorId: session.userId, reason });
    return result;
  },

  async submitCompletion(repo, { orderId, actualOutput, attachmentIds }, session) {
    const order = await repo.getById('orders', orderId);
    if (!order) throw new Error('订单不存在');
    if (order.workerId !== session.userId) throw new Error('只能提交自己的订单');
    return transition(repo, orderId, D.OrderStatus.IN_SERVICE, (clone) => {
      D.submitCompletion(clone, { actualOutput, attachmentIds });
    }, { action: 'submitCompletion', operatorType: 'worker', operatorId: session.userId, remark: '提交完成申请' });
  },

  async verifyCompletion(repo, { orderId, note = '', requestId = '' }, session) {
    const order = await repo.getById('orders', orderId);
    if (!order) throw new Error('订单不存在');
    assertBrandAccess(session, order.brandId || 'default');
    const result = await transition(repo, orderId, D.OrderStatus.PENDING_CONFIRM, (clone) => {
      D.verifyCompletion(clone, { verifiedBy: session.userId, note });
    }, { action: 'verifyCompletion', operatorType: normRole(session.role), operatorRole: normRole(session.role), operatorId: session.userId, requestId, remark: note });
    await appendAudit(repo, { brandId: order.brandId || 'default', action: 'verifyCompletion', resourceType: 'order', resourceId: orderId, before: order, after: result, requestId }, session);
    return result;
  },

  async rejectCompletion(repo, { orderId, reason = '', requestId = '' }, session) {
    const order = await repo.getById('orders', orderId);
    if (!order) throw new Error('订单不存在');
    assertBrandAccess(session, order.brandId || 'default');
    const result = await transition(repo, orderId, D.OrderStatus.PENDING_CONFIRM, (clone) => {
      D.rejectCompletion(clone, { rejectedBy: session.userId, reason });
    }, { action: 'rejectCompletion', operatorType: normRole(session.role), operatorRole: normRole(session.role), operatorId: session.userId, requestId, remark: reason });
    await appendAudit(repo, { brandId: order.brandId || 'default', action: 'rejectCompletion', resourceType: 'order', resourceId: orderId, before: order, after: result, requestId }, session);
    return result;
  },

  async reworkOrder(repo, { orderId, note }, session) {
    return transition(repo, orderId, D.OrderStatus.PENDING_CONFIRM, (clone) => {
      D.reworkOrder(clone, { reworkedBy: session.userId, note });
    }, { action: 'reworkOrder', operatorType: normRole(session.role), operatorId: session.userId, remark: `补单: ${note || ''}` });
  },

  // 结单:勾选确认 + 佣金入账 + 72h 异议窗口,事务 + 幂等键(completedAt)。
  async confirmSettlement(repo, { orderId, customerConfirmed }, session) {
    if (customerConfirmed !== true) throw new Error('结单前必须与客户确认');
    const pre = await repo.getById('orders', orderId);
    if (!pre) throw new Error('订单不存在');
    if (pre.completedAt) return pre; // 幂等:重复结单不重复入账
    const workerId = pre.workerId;
    if (!workerId) throw new Error('订单未分配接单人员,无法结单');
    const settled = await repo.transaction(async (tr) => {
      const cur = await tr.getById('orders', orderId);
      if (!cur) throw new Error('订单不存在');
      if (cur.completedAt) return cur;
      if (cur.status !== D.OrderStatus.PENDING_CONFIRM) throw new Error('订单当前状态不可结单');
      if (cur.verificationStatus !== 'VERIFIED') throw new Error('结单前必须先完成服务验收');
      const commissionRule = cur.commissionRuleSnapshot && cur.commissionRuleSnapshot.rule || cur.commission;
      const earnings = D.calculateEarnings({ amountFen: cur.amountFen, commission: commissionRule });
      const nowTs = Date.now();
      const res = await tr.updateWhere('orders', { _id: orderId, status: D.OrderStatus.PENDING_CONFIRM }, {
        status: D.OrderStatus.SETTLED, confirmedBy: session.userId, completedAt: nowTs,
        disputeDeadline: nowTs + D.DISPUTE_WINDOW_MS, earningsFen: earnings, updatedAt: nowTs,
      });
      if (res.updated !== 1) {
        const retry = await tr.getById('orders', orderId);
        if (retry && retry.completedAt) return retry;
        throw new Error('订单状态已变化,无法结单');
      }
      if (earnings > 0) {
        let wallet = await tr.findOne('wallets', { ownerId: workerId });
        if (!wallet) {
          wallet = { _id: newIdNo('wallet'), ownerId: workerId, ...D.createWallet(), createdAt: nowTs, updatedAt: nowTs };
          await tr.insert('wallets', wallet);
        }
        D.creditWallet(wallet, earnings);
        await tr.updateById('wallets', wallet._id, { availableFen: wallet.availableFen, version: (wallet.version || 0) + 1, updatedAt: nowTs });
        await tr.insert('wallet_transactions', { _id: newIdNo('wtx'), brandId: cur.brandId || 'default', walletId: wallet._id, accountType: 'WORKER_AVAILABLE', accountId: workerId, direction: 'CREDIT', type: 'ORDER_EARNINGS', amountFen: earnings, balanceAfterFen: wallet.availableFen, refId: orderId, orderId, ruleVersion: cur.commissionRuleSnapshot && cur.commissionRuleSnapshot.version || 0, status: 'POSTED', operatorId: session.userId, createdAt: nowTs });
      }
      await tr.insert('order_logs', { _id: newIdNo('olog'), orderId, fromStatus: D.OrderStatus.PENDING_CONFIRM, toStatus: D.OrderStatus.SETTLED, action: 'confirmSettlement', operatorType: normRole(session.role), operatorId: session.userId, remark: '结单,佣金入账', createdAt: nowTs });
      return tr.getById('orders', orderId);
    });
    // 订阅消息:结单完成通知客户(失败静默)。
    await sendSubscribe(repo, { receiverId: await resolveCustomerId(repo, settled), templateKey: 'ORDER_SETTLED', data: { orderNo: settled.orderNo, statusText: STATUS_TEXT[D.OrderStatus.SETTLED] } });
    return settled;
  },

  async closeOrder(repo, payload, session) {
    return services.confirmSettlement(repo, { ...payload, customerConfirmed: payload.customerConfirmed !== false }, session);
  },

  // 未开工取消申请(一律管理员审批):写 refunds(full)。
  async requestCancellation(repo, { orderId, reason }, session) {
    const order = await repo.getById('orders', orderId);
    if (!order) throw new Error('订单不存在');
    if (![D.OrderStatus.PENDING_ACCEPT, D.OrderStatus.PENDING_GRAB].includes(order.status)) throw new Error('仅未开工订单可发起取消申请');
    const payment = await requireSuccessfulPayment(repo, order);
    const dup = await repo.findOne('refunds', { orderId, type: 'full', status: D.RefundStatus.PENDING_APPROVAL });
    if (dup) throw new Error('已存在待审核的取消申请');
    const clone = cloneOrder(order);
    D.requestUnstartedCancel(clone, { requestedBy: session.userId, reason });
    const refundId = newIdNo('refund');
    return repo.transaction(async (tr) => {
      const again = await tr.findOne('refunds', { orderId, type: 'full', status: D.RefundStatus.PENDING_APPROVAL });
      if (again) throw new Error('已存在待审核的取消申请');
      await tr.updateById('orders', orderId, { cancellation: clone.cancellation, updatedAt: clone.updatedAt });
      await tr.insert('refunds', { _id: refundId, brandId: order.brandId || 'default', orderId, paymentId: payment._id, type: 'full', ratio: 1, amountFen: order.amountFen, reason, status: D.RefundStatus.PENDING_APPROVAL, fromStatus: order.status, requestedBy: session.userId, createdAt: Date.now(), updatedAt: Date.now() });
      await tr.insert('order_logs', { _id: newIdNo('olog'), orderId, fromStatus: order.status, toStatus: order.status, action: 'requestCancellation', operatorType: normRole(session.role), operatorId: session.userId, remark: `发起取消申请: ${reason}`, createdAt: Date.now() });
      return { refundId };
    });
  },

  // 服务中/未达标退款申请:写 refunds(ratio=calculateRefundRatio)。
  async requestRefund(repo, { orderId, type, ratio, reason }, session) {
    // 契约定案:type 仅允许该枚举,非法即拒绝。
    if (type !== undefined && !REFUND_TYPES.includes(type)) throw new Error('非法退款类型');
    const order = await repo.getById('orders', orderId);
    if (!order) throw new Error('订单不存在');
    const payment = await requireSuccessfulPayment(repo, order);
    const dup = await repo.findOne('refunds', { orderId, status: D.RefundStatus.PENDING_APPROVAL });
    if (dup) throw new Error('已存在待审核的退款申请');
    const fromStatus = order.status;
    let refundType;
    let refundRatio;
    if (fromStatus === D.OrderStatus.IN_SERVICE) {
      refundType = type || 'partial_progress';
      refundRatio = ratio !== undefined ? ratio : computeRefundRatio(order);
    } else if (fromStatus === D.OrderStatus.PENDING_CONFIRM) {
      refundType = type || 'partial_output';
      refundRatio = ratio !== undefined ? ratio : computeRefundRatio(order);
    } else {
      throw new Error('当前状态不可发起退款');
    }
    const amountFen = D.calculateRefundAmount({ amountFen: order.amountFen, ratio: refundRatio });
    const clone = cloneOrder(order);
    if (fromStatus === D.OrderStatus.IN_SERVICE) D.requestServiceRefund(clone, { requestedBy: session.userId, ratio: refundRatio, reason });
    else D.requestOutputRefund(clone, { requestedBy: session.userId, ratio: refundRatio, reason });
    const refundId = newIdNo('refund');
    return repo.transaction(async (tr) => {
      const again = await tr.findOne('refunds', { orderId, status: D.RefundStatus.PENDING_APPROVAL });
      if (again) throw new Error('已存在待审核的退款申请');
      await tr.updateById('orders', orderId, clone);
      await tr.insert('refunds', { _id: refundId, brandId: order.brandId || 'default', orderId, paymentId: payment._id, type: refundType, ratio: refundRatio, amountFen, reason, status: D.RefundStatus.PENDING_APPROVAL, fromStatus, requestedBy: session.userId, createdAt: Date.now(), updatedAt: Date.now() });
      await tr.insert('order_logs', { _id: newIdNo('olog'), orderId, fromStatus, toStatus: clone.status, action: 'requestRefund', operatorType: normRole(session.role), operatorId: session.userId, remark: `发起退款: ${reason}`, createdAt: Date.now() });
      return { refundId };
    });
  },

  // 审批退款(管理员):调微信退款 + 追佣 + 写 refunds + order_logs,事务。
  async approveRefund(repo, payload, session) {
    return require('./payment-operations.cjs').approveRefund(repo, payload, session);
  },

  async rejectRefund(repo, { refundId, reason }, session) {
    const refund = await repo.getById('refunds', refundId);
    if (!refund) throw new Error('退款单不存在');
    if (refund.status !== D.RefundStatus.PENDING_APPROVAL) throw new Error('退款单已处理');
    const order = await repo.getById('orders', refund.orderId);
    if (!order) throw new Error('订单不存在');
    const clone = cloneOrder(order);
    if (refund.type === 'full') {
      D.rejectCancellation(clone, { rejectedBy: session.userId });
    } else {
      // 驳回退款:订单回退到发起退款前状态(domain 未提供驳回回退纯函数,服务层回滚并留痕)。
      clone.status = refund.fromStatus || D.OrderStatus.IN_SERVICE;
      clone.refundStatus = undefined;
      clone.refund = { ...(clone.refund || {}), rejectedBy: session.userId, rejectedAt: Date.now(), rejectReason: reason };
      clone.updatedAt = Date.now();
    }
    return repo.transaction(async (tr) => {
      const cur = await tr.getById('refunds', refundId);
      if (!cur || cur.status !== D.RefundStatus.PENDING_APPROVAL) throw new Error('退款单已处理');
      await tr.updateById('refunds', refundId, { status: 'REJECTED', reason, rejectedBy: session.userId, updatedAt: Date.now() });
      await tr.updateById('orders', order._id, clone);
      await tr.insert('order_logs', { _id: newIdNo('olog'), orderId: order._id, fromStatus: order.status, toStatus: clone.status, action: 'rejectRefund', operatorType: normRole(session.role), operatorId: session.userId, remark: `驳回退款: ${reason}`, createdAt: Date.now() });
      return tr.getById('refunds', refundId);
    });
  },

  // 异议仲裁:维持=CS;部分/全额退款=ADMIN(生成退款单待审批 + 追佣)。
  async resolveDispute(repo, { disputeId, result, note, ratio }, session) {
    const dispute = await repo.getById('disputes', disputeId);
    if (!dispute) throw new Error('异议不存在');
    if (dispute.status !== 'UNDER_REVIEW') throw new Error('异议必须先进入审理状态');
    const order = await repo.getById('orders', dispute.orderId);
    if (!order) throw new Error('订单不存在');
    const clone = cloneOrder(order);
    if (result === D.DisputeResult.MAINTAIN) {
      if (!sessionHasRole(session, ['CS', 'ADMIN', 'ARBITRATOR', 'SUPER_ADMIN'])) throw new Error('无权执行该操作');
      D.resolveDisputeMaintain(clone, { resolvedBy: session.userId, note });
      const resolved = await repo.transaction(async (tr) => {
        await tr.updateById('orders', order._id, clone);
        await tr.updateById('disputes', disputeId, { status: 'DECIDED', result, resultNote: note, handledBy: session.userId, handledAt: Date.now(), decidedAt: Date.now(), timeline: [...(dispute.timeline || []), { action: 'DECIDED', operatorId: session.userId, result, createdAt: Date.now() }], updatedAt: Date.now() });
        await tr.insert('order_logs', { _id: newIdNo('olog'), orderId: order._id, fromStatus: D.OrderStatus.DISPUTING, toStatus: D.OrderStatus.SETTLED, action: 'resolveDispute', operatorType: normRole(session.role), operatorId: session.userId, remark: `仲裁维持结单: ${note}`, createdAt: Date.now() });
        return tr.getById('disputes', disputeId);
      });
      // 订阅消息:仲裁结果通知客户(失败静默)。
      await sendSubscribe(repo, { receiverId: await resolveCustomerId(repo, order), templateKey: 'DISPUTE_RESOLVED', data: { orderNo: order.orderNo, result } });
      return resolved;
    }
    if ([D.DisputeResult.PARTIAL, D.DisputeResult.FULL].includes(result)) {
      if (!sessionHasRole(session, ['ADMIN', 'ARBITRATOR', 'SUPER_ADMIN'])) throw new Error('退款仲裁需仲裁或平台管理权限');
      const refundRatio = result === D.DisputeResult.FULL ? 1 : (ratio !== undefined ? ratio : (() => { throw new Error('部分退款需指定比例'); })());
      const payment = await requireSuccessfulPayment(repo, order);
      const amountFen = D.calculateRefundAmount({ amountFen: order.amountFen, ratio: refundRatio });
      D.resolveDisputeRefund(clone, { resolvedBy: session.userId, result, note });
      const refundId = newIdNo('refund');
      const resolved = await repo.transaction(async (tr) => {
        await tr.updateById('orders', order._id, clone);
        await tr.updateById('disputes', disputeId, { status: 'DECIDED', result, resultNote: note, handledBy: session.userId, handledAt: Date.now(), decidedAt: Date.now(), timeline: [...(dispute.timeline || []), { action: 'DECIDED', operatorId: session.userId, result, createdAt: Date.now() }], updatedAt: Date.now() });
        await tr.insert('refunds', { _id: refundId, brandId: order.brandId || 'default', orderId: order._id, paymentId: payment._id, type: 'dispute', ratio: refundRatio, amountFen, reason: `异议仲裁${result === 'FULL' ? '全额' : '部分'}退款: ${note}`, status: D.RefundStatus.PENDING_APPROVAL, fromStatus: order.status, requestedBy: session.userId, createdAt: Date.now(), updatedAt: Date.now() });
        await tr.insert('order_logs', { _id: newIdNo('olog'), orderId: order._id, fromStatus: D.OrderStatus.DISPUTING, toStatus: D.OrderStatus.REFUNDING, action: 'resolveDispute', operatorType: normRole(session.role), operatorId: session.userId, remark: `仲裁退款(${result}): ${note}`, createdAt: Date.now() });
        return tr.getById('disputes', disputeId);
      });
      // 订阅消息:仲裁退款结果通知客户(失败静默)。
      await sendSubscribe(repo, { receiverId: await resolveCustomerId(repo, order), templateKey: 'DISPUTE_RESOLVED', data: { orderNo: order.orderNo, result } });
      return resolved;
    }
    throw new Error('非法仲裁结果');
  },

  // ---- 接单人员管理 ----

  async listWorkers(repo, { brandId } = {}, session) {
    const workers = await repo.find('users', { role: 'WORKER' });
    const requested = brandId || '';
    if (requested) assertBrandAccess(session, requested);
    const visible = [];
    for (const worker of workers) {
      if (requested && await userHasBrandScope(repo, worker._id, requested)) visible.push(publicUser(worker));
      else if (!requested && (canAccessBrand(session, '*') || (session.brandScopes || []).some((scope) => scope !== '*' && scope))) {
        const rows = await repo.find('user_brand_roles', { userId: worker._id });
        if (canAccessBrand(session, '*') || rows.some((row) => canAccessBrand(session, row.brandId))) visible.push(publicUser(worker));
      } else if (!requested && canAccessBrand(session, 'default') && await userHasBrandScope(repo, worker._id, 'default')) visible.push(publicUser(worker));
    }
    return visible;
  },

  async createWorker(repo, { phone, initialPassword, nickname, brandId = 'default' }, session) {
    if (!phone || !initialPassword) throw new Error('手机号和初始密码不能为空');
    const existed = await repo.findOne('users', { phone });
    if (existed) throw new Error('手机号已存在');
    const user = await repo.insert('users', {
      _id: newIdNo('user'), role: 'WORKER', phone, passwordHash: auth.hashPassword(initialPassword),
      nickname: nickname || phone, acceptEnabled: true, mustChangePwd: true, status: 'ACTIVE', createdAt: Date.now(),
    });
    await repo.insert('user_brand_roles', { _id: newIdNo('ubr'), userId: user._id, brandId, roles: ['WORKER'], permissions: [], status: 'ACTIVE', createdAt: Date.now(), updatedAt: Date.now() });
    await ensureWallet(repo, user._id);
    return publicUser(user);
  },

  async updateWorker(repo, { workerId, realnameStatus, status }, session) {
    const user = await repo.getById('users', workerId);
    if (!user) throw new Error('接单人员不存在');
    const patch = { updatedAt: Date.now() };
    if (status !== undefined) patch.status = status;
    if (status !== undefined) await repo.updateById('users', workerId, patch);
    if (realnameStatus !== undefined) {
      const existed = await repo.findOne('worker_profiles', { workerId });
      const profile = { workerId, realnameStatus, updatedAt: Date.now() };
      if (existed) await repo.updateById('worker_profiles', existed._id, profile);
      else await repo.insert('worker_profiles', { _id: newIdNo('profile'), ...profile, createdAt: Date.now() });
    }
    return publicUser({ ...user, ...patch });
  },

  // ---- 钱包 ----

  async getWallet(repo, { workerId }, session) {
    // WORKER 取会话主体;ADMIN 必传 workerId(角色矩阵已放行)。
    const reviewer = sessionHasRole(session, ['ADMIN', 'SUPER_ADMIN', 'FINANCE_REVIEWER']);
    const ownerId = reviewer ? workerId : session.userId;
    if (!ownerId) throw new Error('缺少 workerId');
    return ensureWallet(repo, ownerId);
  },

  async walletTransactions(repo, { workerId }, session) {
    const reviewer = sessionHasRole(session, ['ADMIN', 'SUPER_ADMIN', 'FINANCE_REVIEWER']);
    const ownerId = reviewer ? workerId : session.userId;
    if (!ownerId) throw new Error('缺少 workerId');
    const wallet = await ensureWallet(repo, ownerId);
    const list = await repo.find('wallet_transactions', { walletId: wallet._id });
    return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  async listCommissionRules(repo, { brandId = '' } = {}, session) {
    if (brandId) assertBrandAccess(session, brandId);
    const rows = await repo.find('commission_rules', brandId ? { brandId } : {});
    return rows.filter((row) => canAccessBrand(session, row.brandId || 'default')).sort((a, b) => (b.version || 0) - (a.version || 0));
  },

  async saveCommissionRule(repo, { brandId = 'default', rule, status = 'DEMO_ONLY', effectiveAt = Date.now(), requestId = '', idempotencyKey = '' }, session) {
    assertBrandAccess(session, brandId);
    if (!rule || !['fixed', 'percent'].includes(rule.type)) throw new Error('佣金规则必须为 fixed/percent');
    if (!['DRAFT', 'ACTIVE', 'INACTIVE', 'DEMO_ONLY'].includes(status)) throw new Error('佣金规则状态不合法');
    const rows = await repo.find('commission_rules', { brandId });
    const version = Math.max(0, ...rows.map((row) => row.version || 0)) + 1;
    const saved = await repo.insert('commission_rules', { _id: newIdNo('commissionRule'), brandId, version, status, rule: JSON.parse(JSON.stringify(rule)), effectiveAt, createdBy: session.userId, createdAt: Date.now(), updatedAt: Date.now() });
    await appendAudit(repo, { brandId, action: 'saveCommissionRule', resourceType: 'commission_rule', resourceId: saved._id, after: saved, requestId: requestId || idempotencyKey }, session);
    return saved;
  },

  async reconcileWalletLedger(repo, { workerId, brandId = '' } = {}, session) {
    if (brandId) assertBrandAccess(session, brandId);
    let wallets = await repo.find('wallets', workerId ? { ownerId: workerId } : {});
    const results = [];
    for (const wallet of wallets) {
      let rows = await repo.find('wallet_transactions', { walletId: wallet._id });
      rows = rows.filter((row) => row.status !== 'REVERSED').filter((row) => !brandId || (row.brandId || 'default') === brandId);
      const ledgerAvailableFen = rows.reduce((sum, row) => sum + (row.amountFen || 0), 0);
      const walletAvailableFen = wallet.availableFen || 0;
      results.push({ walletId: wallet._id, workerId: wallet.ownerId, brandId, ledgerAvailableFen, walletAvailableFen, differenceFen: walletAvailableFen - ledgerAvailableFen, ok: walletAvailableFen === ledgerAvailableFen });
    }
    return results;
  },

  // 提现申请:实名 + 周次数(全局配置默认 3)+ 起提 10 元,事务冻结余额。
  async applyWithdrawal(repo, { amountFen }, session) {
    if (!Number.isInteger(amountFen) || amountFen <= 0) throw new Error('提现金额必须为正整数(分)');
    const workerId = session.userId;
    const profile = await repo.findOne('worker_profiles', { workerId });
    const realnameApproved = !!(profile && profile.realnameStatus === 'APPROVED');
    const weeklyLimit = await getConfig(repo, 'weeklyWithdrawLimit', DEFAULTS.weeklyWithdrawLimit);
    const weekStart = startOfWeek();
    const weekList = await repo.find('withdrawals', { workerId });
    const applyCountWeek = weekList.filter((w) => w.createdAt >= weekStart).length;
    const withdrawalId = newIdNo('withdrawal');
    return repo.transaction(async (tr) => {
      let wal = await tr.findOne('wallets', { ownerId: workerId });
      if (!wal) {
        wal = { _id: newIdNo('wallet'), ownerId: workerId, ...D.createWallet(), createdAt: Date.now(), updatedAt: Date.now() };
        await tr.insert('wallets', wal);
      }
      const w = D.createWithdrawal(wal, { id: withdrawalId, amountFen, realnameApproved, weeklyLimit, applyCountWeek });
      w._id = withdrawalId;
      delete w.id; // 统一主键:删除冗余 id 字段(T0-03)
      w.workerId = workerId;
      w.walletId = wal._id;
      w.brandId = (session.brandScopes || []).find((scope) => scope !== '*') || 'default';
      await tr.updateById('wallets', wal._id, { availableFen: wal.availableFen, pendingWithdrawFen: wal.pendingWithdrawFen, version: (wal.version || 0) + 1, updatedAt: Date.now() });
      await tr.insert('withdrawals', w);
      await tr.insert('wallet_transactions', { _id: newIdNo('wtx'), brandId: w.brandId, walletId: wal._id, type: 'WITHDRAWAL_FREEZE', amountFen: -amountFen, balanceAfterFen: wal.availableFen, refId: withdrawalId, operatorId: workerId, createdAt: Date.now() });
      return w;
    });
  },

  async listWithdrawals(repo, { workerId, brandId = '' } = {}, session) {
    if (brandId) assertBrandAccess(session, brandId);
    const roles = [session.role, ...(session.roles || [])].map(normalizeRole);
    const canReview = roles.some((role) => ['ADMIN', 'SUPER_ADMIN', 'FINANCE_REVIEWER'].includes(role));
    const filter = !canReview ? { workerId: session.userId } : (workerId ? { workerId } : {});
    const list = await repo.find('withdrawals', filter);
    return list
      .filter((item) => canAccessBrand(session, item.brandId || 'default'))
      .filter((item) => !brandId || (item.brandId || 'default') === brandId)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  async migrateWithdrawalStatuses(repo, { dryRun = true } = {}, session) {
    const rows = await repo.find('withdrawals', {});
    const changes = [];
    for (const row of rows) {
      let status = row.status;
      if (status === 'PENDING_REVIEW') status = 'SUBMITTED';
      if (status === 'PROCESSING') status = 'PAYING';
      if (status !== row.status) {
        changes.push({ withdrawalId: row._id, from: row.status, to: status });
        if (!dryRun) await repo.updateById('withdrawals', row._id, { status, migratedAt: Date.now(), updatedAt: Date.now() });
      }
    }
    return { dryRun: !!dryRun, scanned: rows.length, changed: changes.length, changes };
  },

  async startWithdrawalReview(repo, { withdrawalId }, session) {
    const wd = await repo.getById('withdrawals', withdrawalId);
    if (!wd) throw new Error('提现单不存在');
    Finance.assertWithdrawalReviewer(wd, session);
    if (wd.status === 'PENDING_REVIEW') await repo.updateById('withdrawals', withdrawalId, { status: 'SUBMITTED', updatedAt: Date.now() });
    const current = await repo.getById('withdrawals', withdrawalId);
    D.startWithdrawalReview(current, { reviewedBy: session.userId });
    return repo.updateById('withdrawals', withdrawalId, { status: current.status, reviewedBy: current.reviewedBy, reviewStartedAt: current.reviewStartedAt, updatedAt: Date.now() });
  },

  async approveWithdrawal(repo, { withdrawalId, note = '' }, session) {
    const wd = await repo.getById('withdrawals', withdrawalId);
    if (!wd) throw new Error('提现单不存在');
    if (Security.strictSecurity(process.env)) Finance.assertWithdrawalReviewer(wd, session, true);
    D.approveWithdrawal(wd, { approvedBy: session.userId, note });
    return repo.updateById('withdrawals', withdrawalId, { status: wd.status, approvedBy: wd.approvedBy, approvedAt: wd.approvedAt, reviewNote: note, updatedAt: Date.now() });
  },

  async startWithdrawalPayment(repo, { withdrawalId, batchNo = '' }, session) {
    const wd = await repo.getById('withdrawals', withdrawalId);
    if (!wd) throw new Error('提现单不存在');
    D.startWithdrawalPayment(wd, { paidBy: session.userId, batchNo });
    const actualBatchNo = batchNo || `MANUAL-${withdrawalId}`;
    await repo.insert('transfer_records', { _id: newIdNo('transfer'), brandId: wd.brandId || 'default', withdrawalId, batchNo: actualBatchNo, status: 'PAYING', createdAt: Date.now(), updatedAt: Date.now() });
    return repo.updateById('withdrawals', withdrawalId, { status: wd.status, paymentStartedBy: session.userId, paymentStartedAt: wd.paymentStartedAt, batchNo: actualBatchNo, updatedAt: Date.now() });
  },

  async failWithdrawalPayment(repo, { withdrawalId, reason = '' }, session) {
    const wd = await repo.getById('withdrawals', withdrawalId);
    if (!wd) throw new Error('提现单不存在');
    D.failWithdrawalPayment(wd, { reason });
    const transfer = wd.batchNo ? await repo.findOne('transfer_records', { batchNo: wd.batchNo }) : null;
    if (transfer) await repo.updateById('transfer_records', transfer._id, { status: 'FAILED', reason, updatedAt: Date.now() });
    return repo.updateById('withdrawals', withdrawalId, { status: wd.status, failureReason: reason, failedAt: wd.failedAt, updatedAt: Date.now() });
  },

  // 打款确认:仅 PAYING 可转 PAID,扣除冻结并写打款凭证。
  async markWithdrawalPaid(repo, { withdrawalId, batchNo, receiptAttachmentId, externalReference }, session) {
    const withdrawal = await repo.getById('withdrawals', withdrawalId);
    if (!withdrawal) throw new Error('提现单不存在');
    if (Security.strictSecurity(process.env)) Finance.assertPayoutReceipt(withdrawal, await repo.getById('attachments', receiptAttachmentId), externalReference);
    if (withdrawal.workerId === session.userId) throw new Error('申请人不能自行确认出款');
    const reused = await repo.findOne('withdrawals', { externalReference });
    if (reused && reused._id !== withdrawalId) throw new Error('出款回单流水已关联其他提现');
    return repo.transaction(async (tr) => {
      const wd = await tr.getById('withdrawals', withdrawalId);
      if (!wd || wd.status !== D.WithdrawalStatus.PAYING) throw new Error('提现单不在出款中状态');
      const wal = await tr.findOne('wallets', { ownerId: wd.workerId });
      if (!wal) throw new Error('钱包不存在');
      D.markWithdrawalPaid(wal, wd);
      wd.paidBy = session.userId;
      const nowTs = Date.now();
      await tr.updateById('withdrawals', withdrawalId, { status: wd.status, paidAt: wd.paidAt, paidBy: wd.paidBy, receiptAttachmentId, externalReference, updatedAt: nowTs });
      await tr.updateById('wallets', wal._id, { availableFen: wal.availableFen, pendingWithdrawFen: wal.pendingWithdrawFen, withdrawnFen: wal.withdrawnFen, version: (wal.version || 0) + 1, updatedAt: nowTs });
      await tr.insert('wallet_transactions', { _id: newIdNo('wtx'), brandId: wd.brandId || 'default', walletId: wal._id, accountType: 'WORKER_PENDING_WITHDRAW', accountId: wd.workerId, direction: 'DEBIT', type: 'WITHDRAWAL_PAID', amountFen: 0, balanceAfterFen: wal.availableFen, refId: withdrawalId, withdrawalId, status: 'POSTED', operatorId: session.userId, createdAt: nowTs });
      const transfer = await tr.findOne('transfer_records', { withdrawalId });
      if (transfer) await tr.updateById('transfer_records', transfer._id, { batchNo: batchNo || transfer.batchNo, status: 'PAID', updatedAt: nowTs });
      else await tr.insert('transfer_records', { _id: newIdNo('transfer'), brandId: wd.brandId || 'default', withdrawalId, batchNo: batchNo || `MANUAL-${withdrawalId}`, status: 'PAID', createdAt: nowTs });
      return tr.getById('withdrawals', withdrawalId);
    });
  },

  async rejectWithdrawal(repo, { withdrawalId, reason }, session) {
    const withdrawal = await repo.getById('withdrawals', withdrawalId);
    if (!withdrawal) throw new Error('提现单不存在');
    return repo.transaction(async (tr) => {
      const wd = await tr.getById('withdrawals', withdrawalId);
      if (!wd) throw new Error('提现单已处理');
      if (wd.status === 'PENDING_REVIEW') wd.status = D.WithdrawalStatus.SUBMITTED;
      const wal = await tr.findOne('wallets', { ownerId: wd.workerId });
      if (!wal) throw new Error('钱包不存在');
      D.rejectWithdrawal(wal, wd);
      const nowTs = Date.now();
      await tr.updateById('withdrawals', withdrawalId, { status: wd.status, rejectedAt: wd.rejectedAt, reason, updatedAt: nowTs });
      await tr.updateById('wallets', wal._id, { availableFen: wal.availableFen, pendingWithdrawFen: wal.pendingWithdrawFen, version: (wal.version || 0) + 1, updatedAt: nowTs });
      await tr.insert('wallet_transactions', { _id: newIdNo('wtx'), brandId: wd.brandId || 'default', walletId: wal._id, type: 'WITHDRAWAL_UNFREEZE', amountFen: wd.amountFen, balanceAfterFen: wal.availableFen, refId: withdrawalId, operatorId: session.userId, createdAt: nowTs });
      await tr.insert('notifications', { _id: newIdNo('notify'), brandId: wd.brandId || 'default', receiverId: wd.workerId, channel: 'INBOX', template: 'WITHDRAWAL_REJECTED', payload: { withdrawalId, reason }, status: 'SENT', createdAt: nowTs });
      return tr.getById('withdrawals', withdrawalId);
    });
  },

  // 调账:原因必填,可增可减(余额允许为负),留痕。
  async adjustWallet(repo, { workerId, amountFen, reason }, session) {
    if (!Number.isInteger(amountFen) || amountFen === 0) throw new Error('调账金额必须为非零整数(分)');
    if (!reason) throw new Error('调账原因必填');
    return repo.transaction(async (tr) => {
      let wal = await tr.findOne('wallets', { ownerId: workerId });
      if (!wal) {
        wal = { _id: newIdNo('wallet'), ownerId: workerId, ...D.createWallet(), createdAt: Date.now(), updatedAt: Date.now() };
        await tr.insert('wallets', wal);
      }
      if (amountFen > 0) D.creditWallet(wal, amountFen);
      else D.debitWallet(wal, -amountFen);
      const nowTs = Date.now();
      await tr.updateById('wallets', wal._id, { availableFen: wal.availableFen, version: (wal.version || 0) + 1, updatedAt: nowTs });
      await tr.insert('wallet_transactions', { _id: newIdNo('wtx'), brandId: (session.brandScopes || []).find((scope) => scope !== '*') || 'default', walletId: wal._id, type: 'ADJUSTMENT', amountFen, balanceAfterFen: wal.availableFen, refId: newIdNo('adj'), operatorId: session.userId, remark: reason, createdAt: nowTs });
      return wal;
    });
  },

  // 冻结钱包(ADMIN):scope ∈ {WITHDRAW,BOTH,NONE};调 domain set/clearWalletFreeze 并写 wallet_transactions 留痕。
  async freezeWallet(repo, { workerId, scope }, session) {
    if (!['WITHDRAW', 'BOTH', 'NONE'].includes(scope)) throw new Error('非法冻结范围');
    const wallet = await ensureWallet(repo, workerId);
    if (scope === 'NONE') D.clearWalletFreeze(wallet, { withdrawal: true, accept: true });
    else D.setWalletFreeze(wallet, { withdrawal: scope === 'WITHDRAW' || scope === 'BOTH', accept: scope === 'BOTH' });
    await repo.updateById('wallets', wallet._id, { freezeWithdrawal: wallet.freezeWithdrawal, freezeAccept: wallet.freezeAccept, version: (wallet.version || 0) + 1, updatedAt: Date.now() });
    await addWalletTransaction(repo, wallet, scope === 'NONE' ? 'WALLET_UNFREEZE' : 'WALLET_FREEZE', 0, workerId, session.userId);
    return wallet;
  },

  // ---- 接单人员资料 ----

  async updateProfile(repo, { withdrawWechat, realName, idCardAttachmentId }, session) {
    const existed = await repo.findOne('worker_profiles', { workerId: session.userId });
    const doc = {
      workerId: session.userId,
      withdrawWechat: withdrawWechat || (existed && existed.withdrawWechat) || '',
      realName: realName || (existed && existed.realName) || '',
      idCardAttachmentId: idCardAttachmentId || (existed && existed.idCardAttachmentId) || '',
      realnameStatus: 'PENDING_REVIEW',
      updatedAt: Date.now(),
    };
    if (existed) { await repo.updateById('worker_profiles', existed._id, doc); return { ...existed, ...doc }; }
    await repo.insert('worker_profiles', { _id: newIdNo('profile'), ...doc, createdAt: Date.now() });
    return doc;
  },

  // 本人资料(WORKER):脱敏返回(不含身份证附件引用,提现微信号仅尾号),无资料返回空对象。
  async getProfile(repo, {}, session) {
    const profile = await repo.findOne('worker_profiles', { workerId: session.userId });
    if (!profile) return {};
    return {
      realnameStatus: profile.realnameStatus || '',
      withdrawWechat: maskContact(profile.withdrawWechat),
      realName: profile.realName || '',
      updatedAt: profile.updatedAt,
    };
  },

  // ---- VIP 名单 ----

  async addVip(repo, { matchKey, matchType, note }, session) {
    if (!['phone', 'wechat'].includes(matchType)) throw new Error('匹配类型必须为 phone 或 wechat');
    if (!matchKey) throw new Error('匹配值不能为空');
    const existed = await repo.findOne('vip_list', { matchType, matchKey });
    if (existed) throw new Error('VIP 名单已存在');
    return repo.insert('vip_list', { _id: newIdNo('vip'), matchKey, matchType, note: note || '', status: 'ACTIVE', createdAt: Date.now(), updatedAt: Date.now() });
  },

  async removeVip(repo, { vipId }, session) {
    const vip = await repo.getById('vip_list', vipId);
    if (!vip) throw new Error('VIP 记录不存在');
    return repo.updateById('vip_list', vipId, { status: 'INACTIVE', updatedAt: Date.now() });
  },

  async listVips(repo, {}, session) {
    return repo.find('vip_list', { status: 'ACTIVE' });
  },

  // ---- 商品管理(含文案红线校验) ----

  async saveProduct(repo, { id, title, game, serviceType, tierName, guaranteedOutput, outputUnit, priceFen, commission, images = [], assetIds = [], formSchema = [], commissionRuleId = '', status = 'ON', sort = 0, brandId = 'default', description = '', requestId = '', idempotencyKey = '' }, session) {
    assertBrandAccess(session, brandId);
    const configuredBrands = await repo.find('brands', {});
    if (configuredBrands.length) {
      const targetBrand = configuredBrands.find((item) => item.brandId === brandId);
      if (!targetBrand) throw new Error('商品所属品牌不存在，请在“所属品牌”中选择有效品牌');
      if (!['ON', 'ACTIVE'].includes(targetBrand.status)) throw new Error('商品所属品牌已停用，不能保存商品');
    }
    const textForCheck = [title, game, serviceType, tierName, description].filter(Boolean).join(' ');
    const hit = BANNED_WORDS.find((w) => textForCheck.includes(w));
    if (hit) throw new Error(`商品文案含禁用词: ${hit}`);
    if (!title && !tierName) throw new Error('商品名/档位名不能为空');
    if (!Number.isInteger(priceFen) || priceFen <= 0) throw new Error('商品价格必须为正整数(分)');
    if (!commission) throw new Error('缺少抽成配置');
    if (!['ON', 'OFF'].includes(status)) throw new Error('商品状态必须为 ON/OFF');
    if (!Number.isFinite(Number(sort))) throw new Error('商品排序必须为数字');
    for (const assetId of assetIds) {
      const attachment = await repo.getById('attachments', assetId);
      if (!attachment) throw new Error(`商品素材附件不存在：${assetId}；没有素材请将素材附件 ID 留空`);
      if ((attachment.brandId || 'default') !== brandId) throw new Error(`商品素材附件与所属品牌不匹配：${assetId}`);
    }
    if (commissionRuleId) {
      const rule = await repo.getById('commission_rules', commissionRuleId);
      if (!rule || rule.brandId !== brandId) throw new Error('佣金规则不存在或品牌不匹配');
    }
    const existedForVersion = id ? await repo.getById('products', id) : null;
    const doc = {
      title: title || `${game || ''}${serviceType || ''}${tierName || ''}`,
      game, serviceType, tierName, guaranteedOutput, outputUnit, priceFen, commission,
      images, assetIds, formSchema, commissionRuleId, status, sort: Number(sort) || 0, brandId, description,
      version: (existedForVersion && existedForVersion.version || 0) + 1, updatedAt: Date.now(),
    };
    if (id) {
      const existed = existedForVersion;
      if (!existed) throw new Error('商品不存在');
      assertBrandAccess(session, existed.brandId || 'default');
      const merged = { ...doc, title: doc.title || existed.title };
      await repo.updateById('products', id, merged);
      const saved = { ...existed, ...merged };
      await appendAudit(repo, { brandId, action: 'saveProduct', resourceType: 'product', resourceId: id, before: existed, after: saved, requestId: requestId || idempotencyKey }, session);
      return saved;
    }
    const saved = await repo.insert('products', { _id: newIdNo('product'), ...doc, createdAt: Date.now() });
    await appendAudit(repo, { brandId, action: 'saveProduct', resourceType: 'product', resourceId: saved._id, after: saved, requestId: requestId || idempotencyKey }, session);
    return saved;
  },

  async updateProductStatus(repo, { productId, status, requestId = '', idempotencyKey = '' }, session) {
    const product = await repo.getById('products', productId);
    if (!product) throw new Error('商品不存在');
    const brandId = product.brandId || 'default';
    assertBrandAccess(session, brandId);
    const saved = await repo.updateById('products', productId, { status, updatedAt: Date.now() });
    await appendAudit(repo, { brandId, action: 'updateProductStatus', resourceType: 'product', resourceId: productId, before: product, after: saved, requestId: requestId || idempotencyKey }, session);
    return saved;
  },

  // ---- 字典与配置 ----

  async listDicts(repo, { type }, session) {
    const list = await repo.find('dicts', type ? { type } : {});
    return list.sort((a, b) => (a.sort || 0) - (b.sort || 0));
  },

  async saveDict(repo, { type, code, name, sort = 0 }, session) {
    if (!type || !code || !name) throw new Error('字典类型/编码/名称不能为空');
    const existed = await repo.findOne('dicts', { type, code });
    const doc = { type, code, name, sort: sort || 0, updatedAt: Date.now() };
    if (existed) { await repo.updateById('dicts', existed._id, doc); return { ...existed, ...doc }; }
    return repo.insert('dicts', { _id: newIdNo('dict'), ...doc, status: 'ACTIVE', createdAt: Date.now() });
  },

  async getConfigs(repo, {}, session) {
    // 契约:返回 camelCase 键集,缺省用 CONFIG_DEFAULTS,已存值覆盖。
    const list = await repo.find('configs', {});
    const result = { ...CONFIG_DEFAULTS };
    for (const cfg of list) {
      if (Object.prototype.hasOwnProperty.call(CONFIG_DEFAULTS, cfg.cfgKey)) result[cfg.cfgKey] = cfg.cfgValue;
    }
    return result;
  },

  async updateConfigs(repo, { configs = {} }, session) {
    const results = [];
    for (const [key, value] of Object.entries(configs)) {
      if (!Object.prototype.hasOwnProperty.call(CONFIG_DEFAULTS, key)) continue; // 仅接受契约定案键
      const existed = await repo.findOne('configs', { cfgKey: key });
      const doc = { cfgKey: key, cfgValue: value, updatedAt: Date.now() };
      if (existed) { await repo.updateById('configs', existed._id, doc); results.push({ ...existed, ...doc }); }
      else results.push(await repo.insert('configs', { _id: newIdNo('cfg'), ...doc, createdAt: Date.now() }));
    }
    return results;
  },

  // ---- 报表四件套 ----

  async reportOrders(repo, { from, to } = {}, session) {
    let list = await repo.find('orders', {});
    if (from) list = list.filter((o) => o.createdAt >= from);
    if (to) list = list.filter((o) => o.createdAt <= to);
    const byStatus = {};
    for (const o of list) byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    return { total: list.length, byStatus, list, ...(await computeReconcileMetrics(repo)) };
  },

  async reportWorkers(repo, {}, session) {
    const workers = await repo.find('users', { role: 'WORKER' });
    const rows = [];
    for (const w of workers) {
      const wallet = await repo.findOne('wallets', { ownerId: w._id });
      const orders = await repo.find('orders', { workerId: w._id });
      const completed = orders.filter((o) => o.status === D.OrderStatus.SETTLED).length;
      const earnings = orders.reduce((s, o) => s + (o.earningsFen || 0), 0);
      rows.push({ workerId: w._id, phone: w.phone, nickname: w.nickname, completed, earningsFen: earnings, balanceFen: wallet ? wallet.availableFen : 0 });
    }
    return { rows, ...(await computeReconcileMetrics(repo)) };
  },

  async reportWithdrawals(repo, { from, to } = {}, session) {
    let list = await repo.find('withdrawals', {});
    if (from) list = list.filter((w) => w.createdAt >= from);
    if (to) list = list.filter((w) => w.createdAt <= to);
    const totalFen = list.filter((w) => w.status === D.WithdrawalStatus.PAID).reduce((s, w) => s + w.amountFen, 0);
    return { total: list.length, totalPaidFen: totalFen, list, ...(await computeReconcileMetrics(repo)) };
  },

  async reportProfit(repo, { from, to } = {}, session) {
    let orders = await repo.find('orders', {});
    if (from) orders = orders.filter((o) => o.createdAt >= from);
    if (to) orders = orders.filter((o) => o.createdAt <= to);
    const paidFen = orders.filter((o) => [D.OrderStatus.PENDING_ACCEPT, D.OrderStatus.PENDING_GRAB, D.OrderStatus.IN_SERVICE, D.OrderStatus.PENDING_CONFIRM, D.OrderStatus.SETTLED, D.OrderStatus.DISPUTING, D.OrderStatus.REFUNDING, D.OrderStatus.REFUNDED, D.OrderStatus.CANCELLED].includes(o.status)).reduce((s, o) => s + (o.transactionId ? o.amountFen : 0), 0);
    const refundedFen = orders.filter((o) => o.status === D.OrderStatus.REFUNDED).reduce((s, o) => s + o.amountFen, 0);
    const commissionFen = orders.reduce((s, o) => s + (o.earningsFen || 0), 0);
    let ledger = await repo.find('wallet_transactions', {});
    if (from) ledger = ledger.filter((row) => row.createdAt >= from);
    if (to) ledger = ledger.filter((row) => row.createdAt <= to);
    const clawbackFen = ledger.filter((row) => ['REFUND_CLAWBACK', 'COMMISSION_REVERSAL'].includes(row.type)).reduce((sum, row) => sum + Math.abs(row.amountFen || 0), 0);
    return { paidFen, refundedFen, commissionFen, clawbackFen, commissionNetFen: commissionFen - clawbackFen, netIncomeFen: paidFen - refundedFen - commissionFen + clawbackFen, ...(await computeReconcileMetrics(repo)) };
  },

  // ---- 站内消息 ----

  async sendOrderMessage(repo, { orderId, content }, session) {
    if (!content) throw new Error('留言内容不能为空');
    const order = await repo.getById('orders', orderId);
    if (!order) throw new Error('订单不存在');
    assertBrandAccess(session, order.brandId || 'default');
    return repo.insert('order_messages', {
      _id: newIdNo('omsg'), brandId: order.brandId || 'default', orderId, senderType: normRole(session.role), senderId: session.userId, content, createdAt: Date.now(),
    });
  },

  async listOrderMessages(repo, { orderId }, session) {
    const list = await repo.find('order_messages', { orderId });
    return list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  },

  async notify(repo, { receiverId, channel = 'INBOX', template, payload, templateId, page, brandId = 'default' }, session) {
    // 订阅消息通道:经 subscribe.cjs 扣额度下发,失败静默回补留痕(不承诺必达)。
    if (channel === 'SUBSCRIBE_MSG') {
      return getSubscribeClient().sendWithQuota(repo, { receiverId, templateKey: template, templateId, page, data: payload });
    }
    return repo.insert('notifications', {
      _id: newIdNo('notify'), brandId, receiverId, channel, template, payload: payload || {}, status: 'SENT', createdAt: Date.now(),
    });
  },

  async listNotifications(repo, {}, session) {
    const list = await repo.find('notifications', { receiverId: session.userId });
    return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  async markRead(repo, { notificationId }, session) {
    const notification = await repo.getById('notifications', notificationId);
    if (!notification) throw new Error('通知不存在');
    if (notification.receiverId !== session.userId) throw new Error('无权操作该通知');
    return repo.updateById('notifications', notificationId, { status: 'READ', readAt: Date.now() });
  },

  // ---- 文件上传(对象存储,波次 4b) ----

  async uploadFile(repo, { bizType, bizId, fileName, size, content, fileID, storageKey, contentHash }, session) {
    // 类型与角色权限:complete_proof/id_card=接单人员,dispute=客户。
    if (!Upload.ALLOWED_BIZ_TYPES.includes(bizType)) throw new Error('非法上传类型');
    if (!Upload.isBizTypeAllowedForRole(bizType, session.role)) throw new Error('无权上传该类型附件');
    const uploaderName = await resolveUploaderName(repo, session);
    const relatedOrder = bizId ? await repo.getById('orders', bizId) : null;
    const relatedDispute = !relatedOrder && bizId ? await repo.getById('disputes', bizId) : null;
    const brandId = (relatedOrder && relatedOrder.brandId) || (relatedDispute && relatedDispute.brandId)
      || (session.brandScopes || []).find((scope) => scope !== '*') || 'default';
    // 对象存储上传 + attachments 落库(水印/加密标记/私有签名 URL)。
    return getUploadClient().uploadAttachment(repo, {
      bizType, bizId, fileName, size, content, fileID, storageKey, contentHash,
      uploaderId: session.userId, uploaderName, brandId,
    });
  },

  // ---- 定时任务(无会话,幂等条件更新) ----

  async timeoutCloseUnpaidOrders(repo, { now = Date.now() } = {}) {
    const orders = await repo.find('orders', { status: D.OrderStatus.PENDING_PAYMENT });
    let closed = 0;
    for (const order of orders) {
      if (D.isPaymentExpired(order, now)) {
        // 状态流转经 domain.timeoutClose,条件更新保证与支付回调互斥(T0-04)。
        const clone = cloneOrder(order);
        D.timeoutClose(clone, { closedAt: now });
        const res = await repo.updateWhere('orders', { _id: order._id, status: D.OrderStatus.PENDING_PAYMENT }, {
          status: clone.status, cancelReason: clone.cancelReason, closedAt: clone.closedAt, updatedAt: clone.updatedAt,
        });
        if (res.updated === 1) {
          closed += 1;
          await addOrderLog(repo, order._id, { fromStatus: D.OrderStatus.PENDING_PAYMENT, toStatus: D.OrderStatus.CLOSED, action: 'timeoutCloseUnpaidOrders', operatorType: 'system', operatorId: 'timer', remark: '支付超时关单' });
        }
      }
    }
    return { closed };
  },

  // 入池 30 分钟打超时标(不自动关单)。
  async timeoutMarkPool(repo, { now = Date.now() } = {}) {
    const pool = await repo.find('orders', { status: D.OrderStatus.PENDING_GRAB });
    let marked = 0;
    for (const order of pool) {
      if (order.pooledAt && now - order.pooledAt > (order.poolTimeoutMs || DEFAULTS.poolTimeoutMs) && !order.poolTimeout) {
        await repo.updateById('orders', order._id, { poolTimeout: true, updatedAt: now });
        marked += 1;
      }
    }
    return { marked };
  },

  // 指派 30 分钟未处理自动拒绝(回池)。
  async timeoutRejectAssignments(repo, { now = Date.now() } = {}) {
    const list = await repo.find('orders', { status: D.OrderStatus.ASSIGN_PENDING });
    let rejected = 0;
    for (const order of list) {
      if (order.assignedAt && now - order.assignedAt > (order.assignmentTimeoutMs || DEFAULTS.assignmentTimeoutMs)) {
        const clone = cloneOrder(order);
        D.rejectAssignment(clone, order.workerId, { reason: '指派超时自动拒绝' });
        const res = await repo.updateWhere('orders', { _id: order._id, status: D.OrderStatus.ASSIGN_PENDING }, clone);
        if (res.updated === 1) {
          rejected += 1;
          await addOrderLog(repo, order._id, { fromStatus: D.OrderStatus.ASSIGN_PENDING, toStatus: D.OrderStatus.PENDING_GRAB, action: 'timeoutRejectAssignments', operatorType: 'system', operatorId: 'timer', remark: '指派超时自动拒绝' });
        }
      }
    }
    return { rejected };
  },

  // ---- 二期预留:商家转账回调 ----

  async transferNotify(repo, payload = {}) {
    // 一期人工打款,商家转账回调二期启用;batchNo 唯一幂等预留。
    return { code: 'SUCCESS', message: '二期预留' };
  },

  // ---- 工作台 ----

  async dashboard(repo, { brandId = '' } = {}, session) {
    if (brandId) assertBrandAccess(session, brandId);
    const [orders, refunds, withdrawals, users, disputes, roleRows] = await Promise.all([
      repo.find('orders', {}), repo.find('refunds', {}), repo.find('withdrawals', {}), repo.find('users', {}), repo.find('disputes', {}), repo.find('user_brand_roles', {}),
    ]);
    // 出参键契约定案:8 个固定键(inServiceOrders 替代旧 pendingCancellations)。
    const visibleOrders = orders
      .filter((order) => canAccessBrand(session, order.brandId || 'default'))
      .filter((order) => !brandId || (order.brandId || 'default') === brandId);
    const visibleRefunds = refunds.filter((refund) => {
      const order = orders.find((item) => item._id === refund.orderId);
      return order && canAccessBrand(session, order.brandId || 'default') && (!brandId || (order.brandId || 'default') === brandId);
    });
    return {
      totalOrders: visibleOrders.length,
      pendingAcceptOrders: visibleOrders.filter((o) => o.status === D.OrderStatus.PENDING_ACCEPT).length,
      inServiceOrders: visibleOrders.filter((o) => o.status === D.OrderStatus.IN_SERVICE).length,
      workers: users.filter((u) => normalizeRole(u.role) === 'WORKER' && (!brandId || roleRows.some((row) => row.userId === u._id && row.brandId === brandId && row.status !== 'DISABLED'))).length,
      pendingConfirmOrders: visibleOrders.filter((o) => o.status === D.OrderStatus.PENDING_CONFIRM).length,
      pendingRefunds: visibleRefunds.filter((r) => r.status === D.RefundStatus.PENDING_APPROVAL).length,
      pendingWithdrawals: withdrawals.filter((w) => ['PENDING_REVIEW', 'SUBMITTED', 'REVIEWING', 'APPROVED', 'PAYING', 'PAY_FAILED'].includes(w.status) && canAccessBrand(session, w.brandId || 'default') && (!brandId || (w.brandId || 'default') === brandId)).length,
      pendingDisputes: disputes.filter((d) => ['PENDING', 'OPEN', 'EVIDENCE_COLLECTION', 'UNDER_REVIEW', 'DECIDED'].includes(d.status) && canAccessBrand(session, d.brandId || 'default') && (!brandId || (d.brandId || 'default') === brandId)).length,
    };
  },

  // ---- 品牌配置 ----

  async getBrandConfig(repo, { appId = '', brandCode = '', brandId = '' } = {}) {
    const all = await repo.find('brands', {});
    if (!all.length) return defaultBrandConfig(appId);
    const context = await resolveRequestBrand(repo, { appId, brandCode, brandId }, { allowDefault: !appId && !brandCode && !brandId });
    const brand = all.find((item) => item.brandId === context.brandId);
    if (!brand || !['ON', 'ACTIVE'].includes(brand.status)) throw new Error('BRAND_DISABLED');
    return publicBrand(brand);
  },

  async listBrands(repo, {}, session) {
    return (await repo.find('brands', {})).filter((brand) => canAccessBrand(session, brand.brandId));
  },

  async saveBrandConfig(repo, payload = {}, session) {
    const brand = payload.brand && typeof payload.brand === 'object' ? payload.brand : payload;
    if (!brand || typeof brand !== 'object') throw new Error('缺少品牌配置');
    const { brandId, appId, name } = brand;
    if (!brandId) throw new Error('brandId 不能为空');
    if (!appId) throw new Error('appId 不能为空');
    if (!name) throw new Error('品牌名称不能为空');
    const code = String(brand.code || brandId).trim();
    if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(code)) throw new Error('品牌 code 只能使用 1-32 位小写字母、数字和连字符');
    assertBrandAccess(session, brandId);
    const codeConflict = (await repo.find('brands', { code })).find((item) => item.brandId !== brandId);
    if (codeConflict) throw new Error('品牌 code 已存在');
    const appConflict = (await repo.find('brands', { appId })).find((item) => item.brandId !== brandId);
    if (appConflict) throw new Error('AppID 已绑定其他品牌');
    if (brand.themeTokens !== undefined && (typeof brand.themeTokens !== 'object' || brand.themeTokens === null || Array.isArray(brand.themeTokens))) throw new Error('themeTokens 必须为对象');
    if (brand.copy !== undefined && (typeof brand.copy !== 'object' || brand.copy === null || Array.isArray(brand.copy))) throw new Error('copy 必须为对象');
    const now = Date.now();
    const existed = await repo.findOne('brands', { brandId });
    const version = ((existed && existed.version) || 0) + 1;
    const doc = {
      brandId, code, appId, name,
      logo: brand.logo || '',
      themeTokens: brand.themeTokens || {},
      copy: brand.copy || {},
      banners: Array.isArray(brand.banners) ? brand.banners : [],
      publicConfig: brand.publicConfig && typeof brand.publicConfig === 'object' ? brand.publicConfig : {},
      assetConfig: brand.assetConfig && typeof brand.assetConfig === 'object' ? brand.assetConfig : {},
      contactConfig: brand.contactConfig && typeof brand.contactConfig === 'object' ? brand.contactConfig : {},
      legalConfig: brand.legalConfig && typeof brand.legalConfig === 'object' ? brand.legalConfig : {},
      channelRefs: brand.channelRefs && typeof brand.channelRefs === 'object' ? brand.channelRefs : {},
      binding: brand.binding && typeof brand.binding === 'object' && !Array.isArray(brand.binding) ? brand.binding : {},
      isDefault: brand.isDefault === true,
      status: brand.status === 'OFF' ? 'OFF' : 'ON',
      version,
      publishedVersion: version,
      updatedAt: now,
    };
    let saved;
    if (existed) {
      await repo.updateById('brands', existed._id, doc);
      saved = { ...existed, ...doc };
    } else {
      saved = await repo.insert('brands', { _id: newIdNo('brand'), ...doc, createdAt: now });
    }
    await repo.insert('brand_config_versions', { _id: newIdNo('bcv'), brandId, version, status: 'PUBLISHED', configSnapshot: publicBrand(saved), createdBy: session.userId, createdAt: now, publishedAt: now });
    await appendAudit(repo, { brandId, action: 'saveBrandConfig', resourceType: 'brand', resourceId: saved._id, before: existed, after: saved, requestId: brand.requestId || payload.requestId || payload.idempotencyKey || '' }, session);
    return saved;
  },
};

// ---- 品牌默认值(与客户端视觉一致) ----
const DEFAULT_THEME = {
  primary: '#ff2442', secondary: '#5b83f7', bg: '#f2f2f2', text: '#252525', border: '#ededed', radius: '14rpx',
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
    brandId: brand.brandId, code: brand.code || brand.brandId, appId: brand.appId, name: brand.name, logo: brand.logo || '',
    themeTokens: brand.themeTokens && Object.keys(brand.themeTokens).length ? brand.themeTokens : { ...DEFAULT_THEME },
    copy: brand.copy || {}, banners: Array.isArray(brand.banners) ? brand.banners : [],
    publicConfig: brand.publicConfig || {}, assetConfig: brand.assetConfig || {}, contactConfig: brand.contactConfig || {}, legalConfig: brand.legalConfig || {},
    version: brand.version || 1, publishedVersion: brand.publishedVersion || brand.version || 1,
  };
}

module.exports = services;
