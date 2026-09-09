'use strict';
// 订阅消息下发(Phase 3 波次 4b):微信 access_token → subscribeMessage.send;subscribe_quota 1 授权 1 下发。
// 不承诺必达:未配置/无额度/下发失败一律静默跳过并写 notifications(SUBSCRIBE_MSG 渠道)留痕,客服会话兜底。
const https = require('node:https');
const { newId } = require('./repository.cjs');

const TOKEN_API = 'https://api.weixin.qq.com/cgi-bin/token';
const SEND_API = 'https://api.weixin.qq.com/cgi-bin/message/subscribe/send';

// 默认 HTTP GET/POST JSON 请求(测试可注入)。
function defaultRequest({ url, body }) {
  return new Promise((resolve, reject) => {
    const isGet = body === undefined;
    const req = https.request(url, {
      method: isGet ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let parsed;
        try { parsed = data ? JSON.parse(data) : {}; } catch (_) { return reject(new Error('微信接口返回非 JSON')); }
        resolve(parsed);
      });
    });
    req.on('error', reject);
    if (!isGet) req.write(JSON.stringify(body || {}));
    req.end();
  });
}

// 额度纯函数:consume 仅未用(usedAt 为空)时置 usedAt=ts;refund 清除 usedAt 回补。
function consumeQuota(q, ts = Date.now()) {
  if (!q || q.usedAt) return { ok: false, quota: q };
  return { ok: true, quota: { ...q, usedAt: ts } };
}
function refundQuota(q) {
  if (!q) return { ok: false, quota: q };
  return { ok: true, quota: { ...q, usedAt: null } };
}

function createSubscribeClient({ env = process.env, request = defaultRequest, now = () => Date.now() } = {}) {
  let tokenCache = { token: '', expiresAt: 0 };

  function isConfigured() {
    return !!(env.WECHAT_MP_APPID && env.WECHAT_MP_SECRET);
  }

  // 模板 key → 微信模板 id:优先显式入参,其次 env 映射,兜底用 key 本身。
  function resolveTemplateId(templateKey, templateId) {
    if (templateId) return templateId;
    let map = env.WECHAT_MP_TEMPLATE_IDS;
    if (typeof map === 'string') { try { map = JSON.parse(map); } catch (_) { map = {}; } }
    return (map && map[templateKey]) || templateKey;
  }

  // 获取 access_token:未配置/失败返回 null(fail-closed 跳过下发)。
  async function getAccessToken() {
    if (!isConfigured()) return null;
    if (tokenCache.token && tokenCache.expiresAt > now() + 60 * 1000) return tokenCache.token;
    const url = `${TOKEN_API}?grant_type=client_credential&appid=${env.WECHAT_MP_APPID}&secret=${env.WECHAT_MP_SECRET}`;
    const res = await request({ url });
    if (!res || !res.access_token) return null;
    tokenCache = { token: res.access_token, expiresAt: now() + (res.expires_in || 7200) * 1000 };
    return tokenCache.token;
  }

  // 微信订阅消息下发:errcode=0 视为成功,其余返回失败原因由上层回补留痕。
  async function send({ openid, templateId, page, data }) {
    const token = await getAccessToken();
    if (!token) return { sent: false, reason: 'NO_TOKEN' };
    const res = await request({
      url: `${SEND_API}?access_token=${token}`,
      body: { touser: openid, template_id: templateId, page: page || '', data },
    });
    if (!res || res.errcode !== 0) return { sent: false, reason: `SEND_FAIL:${res && res.errcode}` };
    return { sent: true };
  }

  // 下发主流程:取未用额度→条件扣减→下发→失败回补;全程写 notifications 留痕(不承诺必达)。
  async function sendWithQuota(repo, { receiverId, templateKey, templateId, page, data, brandId = 'default' }) {
    const ts = now();
    const record = async (status, extra) => {
      await repo.insert('notifications', {
        _id: newId('notify'), brandId, receiverId, channel: 'SUBSCRIBE_MSG', template: templateKey,
        payload: { templateId: resolveTemplateId(templateKey, templateId), page, data, ...(extra || {}) },
        status, createdAt: ts,
      });
    };
    if (!isConfigured()) { await record('SKIPPED', { reason: 'NOT_CONFIGURED' }); return { sent: false, reason: 'NOT_CONFIGURED' }; }
    // 找一条未用授权(1 授权 1 下发)。
    const list = await repo.find('subscribe_quota', { customerId: receiverId, templateKey });
    const quota = (list || []).find((q) => !q.usedAt);
    const consumed = consumeQuota(quota, ts);
    if (!consumed.ok) { await record('SKIPPED', { reason: 'NO_QUOTA' }); return { sent: false, reason: 'NO_QUOTA' }; }
    // 下发前条件扣减:仅当仍为未用时置 usedAt,影响行数=1 才继续。
    const deducted = await repo.updateWhere('subscribe_quota', { _id: consumed.quota._id, usedAt: null }, { usedAt: ts });
    if (deducted.updated !== 1) { await record('SKIPPED', { reason: 'QUOTA_RACE' }); return { sent: false, reason: 'QUOTA_RACE' }; }
    // 解析客户小程序 openid(订阅消息接收人)。
    const customer = await repo.getById('customers', receiverId);
    const openid = customer && customer.openid;
    if (!openid) {
      await repo.updateWhere('subscribe_quota', { _id: consumed.quota._id, usedAt: ts }, { usedAt: null });
      await record('FAILED', { reason: 'NO_OPENID' });
      return { sent: false, reason: 'NO_OPENID' };
    }
    const res = await send({ openid, templateId: resolveTemplateId(templateKey, templateId), page, data });
    if (res.sent) { await record('SENT'); return { sent: true }; }
    // 下发失败回补额度 + 留痕。
    await repo.updateWhere('subscribe_quota', { _id: consumed.quota._id, usedAt: ts }, { usedAt: null });
    await record('FAILED', { reason: res.reason });
    return { sent: false, reason: res.reason };
  }

  return { isConfigured, getAccessToken, send, sendWithQuota, resolveTemplateId };
}

module.exports = { createSubscribeClient, consumeQuota, refundQuota, defaultRequest };
