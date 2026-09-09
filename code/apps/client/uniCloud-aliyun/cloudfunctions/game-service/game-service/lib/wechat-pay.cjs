'use strict';
const crypto = require('node:crypto');
const https = require('node:https');

const PAY_HOST = 'https://api.mch.weixin.qq.com';
const DEFAULT_NOTIFY_URL = 'https://api.qmhyplayer.com/pay-notify';
const CONFIG_KEYS = ['WECHAT_PAY_MCHID', 'WECHAT_PAY_SERIAL_NO', 'WECHAT_PAY_PRIVATE_KEY', 'WECHAT_PAY_APIV3_KEY', 'WECHAT_PAY_APPID'];
const NOTIFY_EXPIRE_MS = 5 * 60 * 1000;

function isConfigured(env) {
  return CONFIG_KEYS.every((k) => !!env[k]);
}

function buildAuthorization({ method, url, body, mchid, serialNo, privateKey, timestamp, nonce }) {
  const u = new URL(url);
  const message = `${method}\n${u.pathname}${u.search}\n${timestamp}\n${nonce}\n${body}\n`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(message), privateKey).toString('base64');
  return `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${serialNo}"`;
}

function buildJsapiPayParams({ appid, prepayId, privateKey, timestamp, nonce }) {
  const packageStr = `prepay_id=${prepayId}`;
  const message = `${appid}\n${timestamp}\n${nonce}\n${packageStr}\n`;
  const paySign = crypto.sign('RSA-SHA256', Buffer.from(message), privateKey).toString('base64');
  return { appId: appid, timeStamp: timestamp, nonceStr: nonce, package: packageStr, signType: 'RSA', paySign };
}

function decryptResource({ resource, apiV3Key, raw = false }) {
  if (!resource || !resource.ciphertext) throw new Error('回调缺少加密资源');
  const data = Buffer.from(resource.ciphertext, 'base64');
  if (data.length < 17) throw new Error('回调密文长度非法');
  const authTag = data.subarray(data.length - 16);
  const encrypted = data.subarray(0, data.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(apiV3Key), Buffer.from(resource.nonce || ''));
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(resource.associated_data || ''));
  const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return raw ? plaintext.toString('utf8') : JSON.parse(plaintext.toString('utf8'));
}

function verifyNotifySignature({ timestamp, nonce, body, signature, publicKey }) {
  if (!publicKey || !signature) return false;
  const message = `${timestamp}\n${nonce}\n${body}\n`;
  return crypto.verify('RSA-SHA256', Buffer.from(message), publicKey, Buffer.from(signature, 'base64'));
}

function defaultRequest({ method, url, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method,
      headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = data;
        try { parsed = data ? JSON.parse(data) : {}; } catch (_) { /* 非 JSON 响应保留原文 */ }
        resolve({ status: res.statusCode, data: parsed, rawBody: data, headers: res.headers });
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('微信支付接口超时')));
    if (body) req.write(body);
    req.end();
  });
}

// 平台证书缓存：同一容器实例内复用（按序列号），过期后重拉
const platformCertCache = new Map();

function createClient({ env = process.env, request = defaultRequest, now = () => Date.now() } = {}) {
  const mchid = env.WECHAT_PAY_MCHID;
  const serialNo = env.WECHAT_PAY_SERIAL_NO;
  // 环境变量可能不支持多行：支持把 PEM 换行转义为字面 \n 单行存储，此处还原
  const privateKey = String(env.WECHAT_PAY_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const apiV3Key = env.WECHAT_PAY_APIV3_KEY;
  const appid = env.WECHAT_PAY_APPID;
  const notifyUrl = env.WECHAT_PAY_NOTIFY_URL || DEFAULT_NOTIFY_URL;
  const strict = ['staging', 'production'].includes(env.APP_ENV);

  // fail-closed:部分缺配置即抛错,不静默 mock(T0-02)。
  function assertConfigured() {
    if (!isConfigured(env)) throw new Error('微信支付未配置(fail-closed)');
  }

  function authHeaders(method, url, body) {
    const timestamp = Math.floor(now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const authorization = buildAuthorization({ method, url, body, mchid, serialNo, privateKey, timestamp, nonce });
    return { Authorization: authorization };
  }

  async function api(method, path, body) {
    const url = `${PAY_HOST}${path}`;
    const bodyStr = body === undefined ? '' : JSON.stringify(body);
    const res = await request({ method, url, headers: authHeaders(method, url, bodyStr), body: bodyStr });
    if (res.status < 200 || res.status >= 300) {
      const code = res.data && res.data.code ? res.data.code : res.status;
      const message = res.data && res.data.message ? `: ${res.data.message}` : '';
      throw new Error(`微信支付接口错误 ${code}${message}`);
    }
    if (strict) await verifySignedBody(res.headers, res.rawBody);
    return res.data;
  }

  // JSAPI 下单:appid/openid 参数化,默认 appid=服务号 appid(WECHAT_PAY_APPID)。
  // 部署要求:商户号需与认证服务号关联,openid 为服务号网页授权(oauthExchange)得到的 openid,而非小程序 openid。
  async function jsapiPrepay({ outTradeNo, amountFen, description, openid, appid: appId }) {
    assertConfigured();
    if (!openid) throw new Error('JSAPI 支付缺少 openid');
    const data = await api('POST', '/v3/pay/transactions/jsapi', {
      appid: appId || appid, mchid, description, out_trade_no: outTradeNo, notify_url: notifyUrl,
      amount: { total: amountFen, currency: 'CNY' }, payer: { openid },
    });
    return data.prepay_id;
  }

  async function jsapiPayParams({ prepayId, appid: appId }) {
    assertConfigured();
    return buildJsapiPayParams({
      appid: appId || appid, prepayId, privateKey,
      timestamp: Math.floor(now() / 1000).toString(),
      nonce: crypto.randomBytes(16).toString('hex'),
    });
  }

  async function h5Prepay({ outTradeNo, amountFen, description, clientIp }) {
    assertConfigured();
    if (strict && env.WECHAT_PAY_H5_ENABLED !== 'true') throw new Error('当前品牌未启用H5支付产品权限');
    const data = await api('POST', '/v3/pay/transactions/h5', {
      appid, mchid, description, out_trade_no: outTradeNo, notify_url: notifyUrl,
      amount: { total: amountFen, currency: 'CNY' },
      scene_info: { payer_client_ip: clientIp || '0.0.0.0', h5_info: { type: 'Wap' } },
    });
    return data.h5_url;
  }

  async function refund({ outTradeNo, outRefundNo, totalFen, refundFen, reason }) {
    assertConfigured();
    const data = await api('POST', '/v3/refund/domestic/refunds', {
      out_trade_no: outTradeNo, out_refund_no: outRefundNo, reason: reason || '订单退款', notify_url: notifyUrl,
      amount: { refund: refundFen, total: totalFen, currency: 'CNY' },
    });
    return { status: data.status, refundId: data.refund_id };
  }

  function pickHeader(headers, name) {
    if (!headers) return undefined;
    if (headers[name] !== undefined) return headers[name];
    const lower = name.toLowerCase();
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === lower) return headers[key];
    }
    return undefined;
  }

  async function ensurePlatformCert(serial) {
    if (serial === env.WECHAT_PAY_PUBLIC_KEY_ID && env.WECHAT_PAY_PUBLIC_KEY) return env.WECHAT_PAY_PUBLIC_KEY.replace(/\\n/g, '\n');
    if (serial === env.WECHAT_PAY_PLATFORM_SERIAL && env.WECHAT_PAY_PLATFORM_CERT) return env.WECHAT_PAY_PLATFORM_CERT.replace(/\\n/g, '\n');
    if (strict) throw new Error('微信支付验签序列号不受信任，请更新平台公钥');
    const cacheKey = `${mchid}:${serial}`;
    const cached = platformCertCache.get(cacheKey);
    if (cached && cached.expiresAt > now()) return cached.publicKey;
    const data = await api('GET', '/v3/certificates');
    for (const item of (data && data.data) || []) {
      const plaintext = decryptResource({ resource: item.encrypt_certificate, apiV3Key, raw: true });
      // 真实接口解密结果是PEM证书字符串，旧本地测试的JSON夹具仅在development兼容。
      const certJson = plaintext.startsWith('{') ? JSON.parse(plaintext) : {};
      const publicKey = certJson.certificate || certJson.public_key || plaintext;
      const expiresAt = Date.parse(item.expire_time || certJson.expire_time) || now() + 12 * 60 * 60 * 1000;
      platformCertCache.set(`${mchid}:${certJson.serial_no || item.serial_no}`, { publicKey, expiresAt });
    }
    const hit = platformCertCache.get(cacheKey);
    if (!hit) throw new Error(`平台证书不存在: ${serial}`);
    return hit.publicKey;
  }

  async function verifySignedBody(headers, body) {
    const timestamp = pickHeader(headers, 'wechatpay-timestamp');
    const nonce = pickHeader(headers, 'wechatpay-nonce');
    const signature = pickHeader(headers, 'wechatpay-signature');
    const serial = pickHeader(headers, 'wechatpay-serial');
    if (!/^\d{10,12}$/.test(String(timestamp)) || !nonce || !signature || !serial || typeof body !== 'string') throw new Error('微信支付报文缺少有效验签头');
    if (Math.abs(now() - Number(timestamp) * 1000) > NOTIFY_EXPIRE_MS) throw new Error('微信支付报文已过期');
    const publicKey = await ensurePlatformCert(serial);
    if (!verifyNotifySignature({ timestamp, nonce, body, signature, publicKey })) throw new Error('微信支付报文验签失败');
  }

  async function queryTransaction({ outTradeNo }) {
    assertConfigured();
    return api('GET', `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(mchid)}`);
  }
  async function queryRefund({ outRefundNo }) {
    assertConfigured();
    return api('GET', `/v3/refund/domestic/refunds/${encodeURIComponent(outRefundNo)}`);
  }

  async function handleNotify({ headers = {}, body = '' }) {
    const timestamp = pickHeader(headers, 'wechatpay-timestamp');
    const nonce = pickHeader(headers, 'wechatpay-nonce');
    const signature = pickHeader(headers, 'wechatpay-signature');
    const serial = pickHeader(headers, 'wechatpay-serial');
    if (!/^\d{10,12}$/.test(String(timestamp)) || !nonce || !signature || !serial) throw new Error('回调缺少验签头');
    if (Math.abs(now() - Number(timestamp) * 1000) > NOTIFY_EXPIRE_MS) throw new Error('回调已过期');
    const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
    const publicKey = await ensurePlatformCert(serial);
    if (!verifyNotifySignature({ timestamp, nonce, body: rawBody, signature, publicKey })) throw new Error('回调验签失败');
    const notify = JSON.parse(rawBody);
    const resource = decryptResource({ resource: notify.resource, apiV3Key });
    if (strict && resource.mchid !== mchid) throw new Error('回调商户号不一致');
    if (strict && notify.event_type === 'TRANSACTION.SUCCESS' && (resource.appid !== appid || resource.amount?.currency !== 'CNY' || resource.trade_state !== 'SUCCESS')) throw new Error('回调AppID、币种或交易状态不一致');
    if (notify.event_type === 'TRANSACTION.SUCCESS') {
      return {
        eventType: 'TRANSACTION.SUCCESS',
        eventId: notify.id, mchid: resource.mchid, appid: resource.appid,
        outTradeNo: resource.out_trade_no,
        transactionId: resource.transaction_id,
        amount: resource.amount || {},
        payerOpenid: resource.payer ? resource.payer.openid : undefined,
        successTime: resource.success_time,
      };
    }
    if (['REFUND.SUCCESS', 'REFUND.CLOSED', 'REFUND.ABNORMAL'].includes(notify.event_type)) {
      return {
        eventType: notify.event_type,
        eventId: notify.id, mchid: resource.mchid,
        outTradeNo: resource.out_trade_no,
        outRefundNo: resource.out_refund_no,
        refundId: resource.refund_id,
        refundStatus: resource.refund_status,
        amount: resource.amount || {},
      };
    }
    return { eventType: 'IGNORED', eventTypeRaw: notify.event_type };
  }

  return {
    isConfigured: () => isConfigured(env),
    jsapiPrepay, jsapiPayParams, h5Prepay, refund, handleNotify, queryTransaction, queryRefund,
  };
}

module.exports = {
  isConfigured, buildAuthorization, buildJsapiPayParams,
  decryptResource, verifyNotifySignature, createClient, defaultRequest,
};
