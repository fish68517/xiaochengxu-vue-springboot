// H5 下单 token：HMAC 签名 + 过期时间（TTL）+ 用途绑定（openid/productId）。
// 签发与验签均为 fail-closed：缺少 secret 直接抛错，不降级（对齐 T0-02）。

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// H5 下单 token 有效期：24 小时（T0-07）。
export const H5_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// 签发 token：写入 iat/exp，payload 需携带 openid/productId 用途绑定。
export function issueH5Token(payload, secret, { ttlMs = H5_TOKEN_TTL_MS } = {}) {
  if (!secret) throw new Error('缺少 H5_TOKEN_SECRET，无法签发下单 token');
  if (!payload || !payload.productId) throw new Error('H5 下单 token 必须绑定 productId');
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > H5_TOKEN_TTL_MS) throw new Error('H5 下单 token TTL 不合法');
  const now = Date.now();
  const claims = {
    ...payload,
    purpose: 'h5-order',
    mode: payload.mode || (payload.openid ? 'app' : 'cs'),
    jti: payload.jti || randomBytes(18).toString('base64url'),
    iat: now,
    exp: now + ttlMs,
  };
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

// 验签 token：校验签名与过期时间，返回原始 payload（含 openid/productId/exp）。
export function verifyH5Token(token, secret, { now = Date.now() } = {}) {
  if (!secret) throw new Error('缺少 H5_TOKEN_SECRET，无法校验下单 token');
  const parts = String(token || '').split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error('无效的 H5 下单链接');
  const [body, sig] = parts;
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('无效的 H5 下单链接');
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { throw new Error('无效的 H5 下单链接'); }
  if (!payload.productId || payload.purpose !== 'h5-order' || !['app', 'cs'].includes(payload.mode)) throw new Error('H5 下单链接用途非法');
  if (!payload.jti || !/^[A-Za-z0-9_-]{16,128}$/.test(payload.jti)) throw new Error('H5 下单链接结构非法');
  if (!Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp) || payload.exp <= payload.iat) throw new Error('H5 下单链接结构非法');
  if (payload.iat > now + 5 * 60 * 1000) throw new Error('H5 下单链接尚未生效');
  if (now > payload.exp) throw new Error('H5 下单链接已过期');
  return payload;
}
