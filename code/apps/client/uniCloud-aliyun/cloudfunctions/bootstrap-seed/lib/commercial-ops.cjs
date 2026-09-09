'use strict';
const crypto = require('node:crypto');
const http = require('node:http');
const https = require('node:https');

const PRIVATE_KEY = /password|secret|authorization|token|openid|payer|phone|idcard|realname|cipher|privatekey|email|contactwechat/i;
function sanitize(value, depth = 0) {
  if (depth > 8) return '[truncated]';
  if (typeof value === 'string') return value.replace(/([?&](?:token|h5Token|code)=)[^&#\s]+/gi, '$1[redacted]').replace(/\b1[3-9]\d{9}\b/g, '[phone]').replace(/\b\d{17}[\dXx]\b/g, '[identity]').slice(0, 2048);
  if (Array.isArray(value)) return value.slice(0, 200).map(item => sanitize(item, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, PRIVATE_KEY.test(key) ? '[redacted]' : sanitize(item, depth + 1)]));
  return value;
}
function requestId(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(value) ? value : crypto.randomUUID(); }

function deliverWebhook(url, payload, { allowLocal = false, timeoutMs = 5000 } = {}) {
  const target = new URL(url);
  if (target.protocol !== 'https:' && !(allowLocal && target.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname))) throw new Error('告警地址必须为 HTTPS');
  if (target.username || target.password) throw new Error('告警地址不能包含用户凭据');
  const body = JSON.stringify(sanitize(payload));
  return new Promise((resolve, reject) => {
    const req = (target.protocol === 'https:' ? https : http).request(target, { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }, timeout: timeoutMs }, res => {
      let response = ''; res.on('data', chunk => { if (response.length < 16384) response += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`告警通道返回 HTTP ${res.statusCode}`));
        try { const data = response ? JSON.parse(response) : {}; if (data.ok === false || (data.errcode !== undefined && data.errcode !== 0)) return reject(new Error('告警通道拒绝消息')); } catch (_) { /* Generic webhook may return text. */ }
        resolve({ delivered: true, statusCode: res.statusCode });
      });
    });
    req.on('timeout', () => req.destroy(new Error('告警通道超时'))); req.on('error', () => reject(new Error('告警通道网络错误'))); req.end(body);
  });
}
async function recordOperation(repo, { action, requestId: id, durationMs, ok, code = '', sourceIp = '', brandId = 'default' }) {
  const event = { _id: `op-${Date.now()}-${crypto.randomUUID()}`, action, requestId: requestId(id), durationMs, ok, code, brandId, sourceIpHash: crypto.createHash('sha256').update(sourceIp).digest('hex'), createdAt: Date.now() };
  await repo.insert('operational_events', event); return event;
}
function requireAdmin(session, brandId) {
  const roles = [session?.role, ...(session?.roles || [])];
  if (!roles.some(role => ['ADMIN', 'SUPER_ADMIN', 'BRAND_ADMIN'].includes(role))) throw new Error('FORBIDDEN: 运维权限不足');
  if (!brandId) throw new Error('请选择品牌');
  if (!roles.some(role => ['ADMIN', 'SUPER_ADMIN'].includes(role)) && !(session.brandScopes || []).includes(brandId)) throw new Error('FORBIDDEN: 无权访问此品牌');
}
const RESOURCES = new Set(['orders', 'audit_logs', 'payments', 'wallet_transactions', 'withdrawals', 'operational_events', 'reconciliation_cases']);
async function page(repo, collection, where, payload) {
  let afterId = '';
  if (payload.cursor) {
    let cursor; try { cursor = JSON.parse(Buffer.from(payload.cursor, 'base64url').toString()); } catch { throw new Error('分页游标无效'); }
    if (cursor.collection !== collection || cursor.scope !== JSON.stringify(where) || typeof cursor.afterId !== 'string') throw new Error('分页游标范围不匹配');
    afterId = cursor.afterId;
  }
  const limit = Math.max(1, Math.min(100, Number(payload.limit) || 20));
  const result = await repo.queryPage(collection, { where, afterId, limit });
  return { items: sanitize(result.items), hasMore: result.hasMore, nextCursor: result.hasMore ? Buffer.from(JSON.stringify({ collection, scope: JSON.stringify(where), afterId: result.items[result.items.length - 1]._id })).toString('base64url') : '', limit };
}
function createOperationsServices({ env = process.env, verifyStepUp } = {}) {
  return {
    async listRecordsPage(repo, payload, session) {
      requireAdmin(session, payload.brandId);
      if (!RESOURCES.has(payload.resource)) throw new Error('分页资源不允许');
      const where = { brandId: payload.brandId }; if (payload.status) where.status = String(payload.status);
      return page(repo, payload.resource, where, payload);
    },
    async listOperationalEvents(repo, payload, session) { requireAdmin(session, payload.brandId); return page(repo, 'operational_events', { brandId: payload.brandId }, payload); },
    async getOperationalHealth(repo, payload, session) {
      requireAdmin(session, payload.brandId);
      return { environment: env.APP_ENV || 'development', webhookConfigured: Boolean(env.ALERT_WEBHOOK_URL), lastMonitor: sanitize(await repo.getById('operational_alerts', `health-${payload.brandId}`)), evidence: 'runtime-only' };
    },
    async runOperationalMonitor(repo, { brandId } = {}, session) {
      if (session?.role !== 'SYSTEM') throw new Error('FORBIDDEN: 仅系统任务可执行');
      if (!brandId) throw new Error('监控需要明确品牌');
      const stateId = `health-${brandId}`; const previous = await repo.getById('operational_alerts', stateId);
      const rows = []; let afterId = previous?.cursor || ''; let hasMore;
      do { const batch = await repo.queryPage('operational_events', { where: { brandId }, afterId, limit: 200 }); rows.push(...batch.items); hasMore = batch.hasMore; if (batch.items.length) afterId = batch.items[batch.items.length - 1]._id; } while (hasMore && rows.length < 2000);
      const recent = rows.filter(row => row.createdAt > Date.now() - 15 * 60 * 1000);
      const failed = recent.filter(row => !row.ok).length;
      const latencies = recent.map(row => row.durationMs).sort((a, b) => a - b); const p95 = latencies[Math.max(0, Math.ceil(latencies.length * .95) - 1)] || 0;
      const active = failed > 0 || p95 > Number(env.ALERT_P95_MS || 2000); const changed = active !== Boolean(previous?.active);
      const shouldSend = active && (changed || Date.now() - (previous?.deliveredAt || 0) > 15 * 60 * 1000) || !active && previous?.active;
      let delivered = false; let deliveryError = '';
      if (shouldSend && env.ALERT_WEBHOOK_URL) { try { await deliverWebhook(env.ALERT_WEBHOOK_URL, { level: active ? 'P1' : 'P2', title: active ? '服务运行异常' : '服务恢复', brandId, failed, p95, count: recent.length }); delivered = true; } catch (error) { deliveryError = error.message; } }
      const state = { _id: stateId, brandId, active, failed, p95, count: recent.length, cursor: afterId, backlog: hasMore, delivered, deliveryError, deliveredAt: delivered ? Date.now() : previous?.deliveredAt || 0, updatedAt: Date.now() };
      if (previous) await repo.updateById('operational_alerts', stateId, state); else await repo.insert('operational_alerts', state);
      return state;
    },
    async getLaunchPolicy(repo, payload, session) { requireAdmin(session, payload.brandId); return (await repo.findOne('configs', { cfgKey: 'COMMERCIAL_LAUNCH_POLICY' }))?.cfgValue || { approved: false, paused: true }; },
    async updateLaunchPolicy(repo, payload, session) {
      if (![session?.role, ...(session?.roles || [])].some(role => ['ADMIN', 'SUPER_ADMIN'].includes(role))) throw new Error('FORBIDDEN: 仅平台管理员可设置灰度');
      if (!verifyStepUp) throw new Error('必须完成二次验证'); await verifyStepUp(repo, payload, session);
      const policy = payload.policy;
      if (!policy || !Array.isArray(policy.brands) || !Array.isArray(policy.userIds) || !policy.brands.length || !policy.userIds.length || !Number.isSafeInteger(policy.maxPaymentFen) || policy.maxPaymentFen < 1 || !Number.isSafeInteger(policy.maxDailyPaymentFen) || policy.maxDailyPaymentFen < policy.maxPaymentFen || typeof policy.paused !== 'boolean' || typeof policy.approved !== 'boolean') throw new Error('灰度策略参数不完整');
      const existing = await repo.findOne('configs', { cfgKey: 'COMMERCIAL_LAUNCH_POLICY' });
      const next = { brands: policy.brands, userIds: policy.userIds, maxPaymentFen: policy.maxPaymentFen, maxDailyPaymentFen: policy.maxDailyPaymentFen, paused: policy.paused, approved: policy.approved };
      await repo.insert('audit_logs', { _id: crypto.randomUUID(), brandId: 'platform', action: 'updateLaunchPolicy', operatorId: session.userId, before: existing?.cfgValue || {}, after: next, createdAt: Date.now(), requestId: payload.requestId || '' });
      if (existing) await repo.updateById('configs', existing._id, { cfgValue: next }); else await repo.insert('configs', { _id: 'commercial-launch-policy', cfgKey: 'COMMERCIAL_LAUNCH_POLICY', cfgValue: next }); return next;
    },
  };
}
async function enforceLaunchPolicy(repo, { brandId, userId, amountFen, orderId = '' }, env = process.env) {
  if (env.APP_ENV !== 'production') return;
  const policy = (await repo.findOne('configs', { cfgKey: 'COMMERCIAL_LAUNCH_POLICY' }))?.cfgValue;
  if (!policy?.approved || policy.paused || !policy.brands?.includes(brandId) || !policy.userIds?.includes(userId)) throw new Error('当前暂未开放灰度服务');
  if (!Number.isSafeInteger(amountFen) || amountFen <= 0 || amountFen > policy.maxPaymentFen) throw new Error('超过灰度单笔限额');
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const todayFen = (await repo.find('orders', { brandId })).filter((row) => row._id !== orderId && row.grayUserId === userId && row.createdAt >= start.getTime() && !['CANCELLED', 'CLOSED', 'REFUNDED'].includes(row.status)).reduce((sum, row) => sum + (Number.isSafeInteger(row.amountFen) ? row.amountFen : 0), 0);
  if (todayFen + amountFen > policy.maxDailyPaymentFen) throw new Error('超过灰度用户当日支付限额');
}
module.exports = { sanitize, requestId, deliverWebhook, recordOperation, createOperationsServices, enforceLaunchPolicy };
