'use strict';
const { createUniCloudRepository } = require('./lib/repository.cjs');
const services = require('./lib/services.cjs');
const { createAuth } = require('./lib/auth.cjs');

const auth = createAuth({ env: process.env });

// 业务错误封套:带 code 的错误由路由层统一转 {ok:false, code, message},不上抛到云函数层。
class BizError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'BizError';
    this.code = code;
  }
}

// 提取会话 token:兼容 callFunction 的 data.token 与 HTTP 的 Authorization: Bearer。
function extractToken(event, payload) {
  if (event && event.token) return event.token;
  if (payload && payload.token) return payload.token;
  if (event && event.headers) {
    const h = event.headers;
    const bearer = h.Authorization || h.authorization;
    if (typeof bearer === 'string' && bearer.startsWith('Bearer ')) return bearer.slice(7).trim();
  }
  return undefined;
}

function extractInternalAuth(event = {}) {
  if (event.internalAuth && typeof event.internalAuth === 'object') return event.internalAuth;
  const headers = event.headers || {};
  const timestamp = headers['x-internal-timestamp'] || headers['X-Internal-Timestamp'];
  const nonce = headers['x-internal-nonce'] || headers['X-Internal-Nonce'];
  const signature = headers['x-internal-signature'] || headers['X-Internal-Signature'];
  return timestamp || nonce || signature ? { timestamp, nonce, signature } : null;
}

// 错误封套:带 code 的业务错误用自身 code;其余(domain 抛错/未知异常)映射 DOMAIN_ERROR,message 取原文。
function toEnvelope(err) {
  const message = err && err.message ? err.message : String(err);
  if (err && err.code) return { ok: false, code: err.code, message };
  if (/^CONFLICT:|状态已变化|版本已变化/.test(message)) return { ok: false, code: 'CONFLICT', message };
  return { ok: false, code: 'DOMAIN_ERROR', message };
}

async function enforceResourceBrand(repo, payload = {}, session) {
  if (!session) return '';
  let brandId = payload.brandId || '';
  const orderId = payload.orderId || payload.assignmentId;
  if (orderId) brandId = (await repo.getById('orders', orderId))?.brandId || brandId;
  if (payload.productId) brandId = (await repo.getById('products', payload.productId))?.brandId || brandId;
  if (payload.refundId) {
    const refund = await repo.getById('refunds', payload.refundId);
    brandId = (refund && (await repo.getById('orders', refund.orderId))?.brandId) || brandId;
  }
  if (payload.disputeId) {
    const dispute = await repo.getById('disputes', payload.disputeId);
    brandId = (dispute && (await repo.getById('orders', dispute.orderId))?.brandId) || brandId;
  }
  if (payload.paymentId) brandId = (await repo.getById('payments', payload.paymentId))?.brandId || brandId;
  if (payload.withdrawalId) brandId = (await repo.getById('withdrawals', payload.withdrawalId))?.brandId || brandId;
  if (!brandId || brandId === 'default' && !(session.brandScopes || []).length) return brandId || 'default';
  const roles = new Set([session.role, ...(session.roles || [])]);
  const scopes = session.brandScopes || [];
  if (!roles.has('ADMIN') && !roles.has('SUPER_ADMIN') && !scopes.includes('*') && !scopes.includes(brandId)) {
    throw new BizError('FORBIDDEN', 'BRAND_FORBIDDEN');
  }
  return brandId || scopes.find((scope) => scope !== '*') || 'default';
}

const ROUTE_AUDIT_ACTIONS = new Set([
  'freezeWallet', 'adjustWallet', 'updateWorker', 'updateProductStatus',
  'enterOrder', 'assignOrder', 'grabOrder', 'releaseOrder', 'acceptAssignment', 'rejectAssignment', 'submitCompletion', 'reworkOrder',
  'requestRefund', 'approveRefund', 'rejectRefund', 'confirmSettlement', 'verifyCompletion', 'rejectCompletion', 'closeOrder',
  'resolveDispute', 'startDisputeReview', 'closeDispute', 'markWithdrawalPaid', 'rejectWithdrawal',
  'startWithdrawalReview', 'approveWithdrawal', 'startWithdrawalPayment', 'failWithdrawalPayment', 'reassignOrder', 'saveCommissionRule',
  'revokeH5Token',
]);

async function auditResource(repo, payload = {}) {
  const candidates = [
    ['order', 'orders', payload.orderId || payload.assignmentId],
    ['refund', 'refunds', payload.refundId],
    ['dispute', 'disputes', payload.disputeId],
    ['withdrawal', 'withdrawals', payload.withdrawalId],
    ['worker', 'users', payload.workerId],
    ['product', 'products', payload.productId],
    ['payment', 'payments', payload.paymentId],
  ];
  for (const [resourceType, collection, resourceId] of candidates) {
    if (resourceId) return { resourceType, resourceId, before: await repo.getById(collection, resourceId) };
  }
  return { resourceType: 'operation', resourceId: '', before: null };
}

function snapshot(value) {
  if (value == null) return null;
  return JSON.parse(JSON.stringify(value));
}

exports.main = async (event = {}) => {
  // URL 化 HTTP 请求:微信支付回调(在 uniCloud 控制台为 game-service 配置 URL 化路径 /pay-notify)。
  if (event && event.httpMethod) {
    const path = (event.path || '').split('?')[0];
    if (path === '/pay-notify' || path.endsWith('/pay-notify')) {
      const repo = createUniCloudRepository(uniCloud.database());
      let result;
      try {
        result = await services.payNotify(repo, { headers: event.headers || {}, body: event.body || '' });
      } catch (err) {
        result = toEnvelope(err);
      }
      return {
        mpserverlessComposedResponse: true,
        statusCode: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify(result),
      };
    }
    return {
      mpserverlessComposedResponse: true,
      statusCode: 404,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(toEnvelope(new BizError('UNKNOWN_PATH', `未知路径: ${path}`))),
    };
  }

  try {
    const action = event.action;
    const payload = { ...(event.payload || {}) };
    const eventIdempotencyKey = event.idempotencyKey
      || (event.headers && (event.headers['x-idempotency-key'] || event.headers['X-Idempotency-Key'] || event.headers['idempotency-key']));
    if (eventIdempotencyKey && !payload.idempotencyKey) payload.idempotencyKey = eventIdempotencyKey;
    if (!action) throw new BizError('MISSING_ACTION', '缺少 action');
    if (!services[action]) throw new BizError('UNKNOWN_ACTION', `未知 action: ${action}`);
    const db = uniCloud.database();
    const repo = createUniCloudRepository(db);
    // action 路由前统一鉴权:公开/白名单/H5 token/系统入口放行,受保护 action 校验会话 token + 角色矩阵。
    const ctx = { token: extractToken(event, payload), internalAuth: extractInternalAuth(event), payload };
    let session; let authMode; let internal;
    try {
      ({ session, mode: authMode, internal } = await auth.require(repo, action, ctx));
    } catch (err) {
      // 鉴权失败统一封套,不上抛到云函数层。
      return { ok: false, code: 'UNAUTHORIZED', message: err && err.message ? err.message : String(err) };
    }
    const brandId = await enforceResourceBrand(repo, payload, session);
    const resource = ROUTE_AUDIT_ACTIONS.has(action) ? await auditResource(repo, payload) : null;
    const result = await services[action](repo, payload, session);
    if (resource) {
      await repo.insert('audit_logs', {
        _id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        brandId: brandId || (session.brandScopes || []).find((scope) => scope !== '*') || 'default',
        operatorId: session.userId || 'system', operatorRole: session.role || 'SYSTEM', action,
        resourceType: resource.resourceType, resourceId: resource.resourceId,
        before: snapshot(resource.before), after: snapshot(result),
        requestId: payload.requestId || payload.idempotencyKey || '',
        ipMeta: { sourceIp: event.sourceIp || event.clientIP || '' }, createdAt: Date.now(),
      });
    }
    if (authMode === 'system') {
      await repo.insert('audit_logs', {
        _id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        brandId: payload.brandId || 'default', operatorId: 'internal-system', operatorRole: 'SYSTEM', action,
        resourceType: 'system_action', resourceId: '', before: {}, after: snapshot(result) || {},
        requestId: (internal && internal.nonce) || '', ipMeta: { sourceIp: event.sourceIp || event.clientIP || '' }, createdAt: Date.now(),
      });
    }
    return result;
  } catch (err) {
    return toEnvelope(err);
  }
};
