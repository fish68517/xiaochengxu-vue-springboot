'use strict';
// Shared account-security engine: generators keep local synchronous and cloud asynchronous contracts identical.
// Password hashing, persistent CAS limits, MFA and session checks have one implementation.
const { scryptSync, createHash, createHmac, timingSafeEqual, randomBytes, createCipheriv, createDecipheriv } = require('node:crypto');
// OWASP's 16 MiB scrypt option: N=2^14, r=8, p=5 (higher CPU, bounded cloud memory).
const PASSWORD_PARAMS = { N: 16384, r: 8, p: 5, maxmem: 64 * 1024 * 1024 };
const SESSION_TTL_MS = 30 * 60e3;
const SETUP_ACTIONS = new Set(['getSecurityStatus', 'setupMfa', 'enableMfa', 'changePassword', 'revokeSessions', 'getAccessProfile', 'listLoginHistory']);
const SECURITY_ROLES = ['WORKER', 'CUSTOMER_SERVICE', 'CS', 'ADMIN', 'DISPATCHER', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'ARBITRATOR', 'SUPER_ADMIN'];
const HIGH_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'CS', 'CUSTOMER_SERVICE', 'DISPATCHER']);
const SENSITIVE_ACTIONS = new Set(['approveRefund', 'rejectRefund', 'adjustWallet', 'freezeWallet', 'approveWithdrawal', 'markWithdrawalPaid', 'startWithdrawalPayment', 'failWithdrawalPayment', 'rejectWithdrawal', 'createStaff', 'updateStaff', 'saveUserBrandRoles', 'updateConfigs', 'saveBrandConfig', 'setAccountStatus', 'viewSensitiveInformation', 'processDataRightsRequest', 'updateLaunchPolicy', 'exportReconciliation', 'closeReconciliationIssue']);
const hash = (value) => createHash('sha256').update(String(value)).digest('hex');
const id = () => randomBytes(20).toString('hex');
const fail = (message, code = 'UNAUTHORIZED') => Object.assign(new Error(message), { code });
const equal = (a, b) => {
  const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  return aa.length === bb.length && timingSafeEqual(aa, bb);
};
function strictSecurity(env = process.env) {
  return ['staging', 'production'].includes(env.APP_ENV) || env.ACCOUNT_SECURITY_ENFORCE === 'true';
}
function assertPasswordStrength(password) {
  const text = String(password || '');
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(text)).length;
  if (text.length < 12 || text.length > 128 || kinds < 3 || /^(password|admin|qwerty|123456|abcdef)/i.test(text)) {
    throw fail('密码需为 12～128 位，包含大小写字母、数字、符号中的至少三类', 'WEAK_PASSWORD');
  }
}
function hashPassword(password) {
  if (typeof password !== 'string' || password.length > 128) throw fail('密码格式不正确');
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 32, PASSWORD_PARAMS);
  return `scrypt$${PASSWORD_PARAMS.N}$8$5$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}
function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 128 || typeof stored !== 'string') return { valid: false };
  if (/^[a-f0-9]{64}$/i.test(stored)) return { valid: equal(hash(password), stored.toLowerCase()), legacy: true };
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt' || +parts[1] !== PASSWORD_PARAMS.N || +parts[2] !== 8 || +parts[3] !== 5) return { valid: false };
  try {
    const salt = Buffer.from(parts[4], 'base64url'); const expected = Buffer.from(parts[5], 'base64url');
    if (salt.length !== 16 || expected.length !== 32) return { valid: false };
    return { valid: timingSafeEqual(scryptSync(password, salt, 32, PASSWORD_PARAMS), expected), legacy: false };
  } catch { return { valid: false }; }
}
function publicUser(user = {}) {
  // An allowlist avoids leaking future recovery/credential/security fields in list or audit DTOs.
  return Object.fromEntries(['_id', 'role', 'phone', 'nickname', 'avatar', 'status', 'acceptEnabled', 'mustChangePwd', 'createdAt', 'updatedAt'].filter((key) => user[key] !== undefined).map((key) => [key, user[key]]));
}
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(bytes) {
  let bits = 0; let value = 0; let result = '';
  for (const byte of bytes) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { result += BASE32[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits) result += BASE32[(value << (5 - bits)) & 31];
  return result;
}
function unbase32(value) {
  let bits = 0; let buffer = 0; const result = [];
  for (const char of value.replace(/=+$/, '').toUpperCase()) {
    const index = BASE32.indexOf(char); if (index < 0) throw fail('验证器密钥格式不正确');
    buffer = (buffer << 5) | index; bits += 5;
    if (bits >= 8) { result.push((buffer >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(result);
}
function totp(secret, now = Date.now(), digits = 6) {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(now / 30000)));
  const digest = createHmac('sha1', unbase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % (10 ** digits)).toString().padStart(digits, '0');
}
function mfaKey(env) {
  const key = Buffer.from(env.MFA_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32) throw fail('MFA_ENCRYPTION_KEY 尚未配置为 32 字节 Base64 密钥', 'CONFIG_ERROR');
  return key;
}
function seal(secret, userId, env) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', mfaKey(env), iv);
  const version = env.MFA_ENCRYPTION_KEY_VERSION || 'v1';
  cipher.setAAD(Buffer.from(`mfa:${userId}:${version}`));
  const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return { version, iv: iv.toString('base64'), ciphertext: data.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}
function unseal(value, userId, env) {
  if (!value || value.version !== (env.MFA_ENCRYPTION_KEY_VERSION || 'v1')) throw fail('MFA 密钥版本尚未配置', 'CONFIG_ERROR');
  const decipher = createDecipheriv('aes-256-gcm', mfaKey(env), Buffer.from(value.iv, 'base64'));
  decipher.setAAD(Buffer.from(`mfa:${userId}:${value.version}`)); decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}
function signed(payload, secret) {
  if (!secret) throw fail('缺少 SESSION_SECRET', 'CONFIG_ERROR');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}
function verifyStepUpToken(token, session, env = process.env, now = Date.now()) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 2 || !env.SESSION_SECRET) throw new Error();
    if (!equal(createHmac('sha256', env.SESSION_SECRET).update(parts[0]).digest('base64url'), parts[1])) throw new Error();
    const p = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    if (p.purpose !== 'sensitive-operation' || p.userId !== session.userId || p.sid !== session.sid || p.securityVersion !== (session.securityVersion || 0) || p.exp <= now || p.iat > now || p.exp - p.iat > 5 * 60e3) throw new Error();
    return p;
  } catch { throw fail('请先在安全中心完成二次验证', 'STEP_UP_REQUIRED'); }
}
function assertSensitiveAction(action, session, token, env = process.env, now = Date.now()) {
  if (strictSecurity(env) && SENSITIVE_ACTIONS.has(action)) verifyStepUpToken(token, session, env, now);
}
const op = (method, ...args) => ({ method, args });
function runSync(iterator, repo) {
  let step = iterator.next();
  while (!step.done) {
    try { step = iterator.next(repo[step.value.method](...step.value.args)); }
    catch (error) { step = iterator.throw(error); }
  }
  return step.value;
}
async function runAsync(iterator, repo) {
  let step = iterator.next();
  while (!step.done) {
    try { step = iterator.next(await repo[step.value.method](...step.value.args)); }
    catch (error) { step = iterator.throw(error); }
  }
  return step.value;
}
function createAccountSecurity({ repo, env = process.env, now = Date.now, async: useAsync = false }) {
  const run = (iterator) => (useAsync ? runAsync : runSync)(iterator, repo);
  function* getOrCreate(collection, key, defaults) {
    let item = yield op('getById', collection, key);
    if (!item) {
      try { item = yield op('insert', collection, { _id: key, ...defaults }); }
      catch (error) { item = yield op('getById', collection, key); if (!item) throw error; }
    }
    return item;
  }
  function* counter(key, max) {
    for (let retry = 0; retry < 12; retry++) {
      const row = yield* getOrCreate('security_rate_limits', key, { count: 0, createdAt: now(), expiresAt: now() + 48 * 60 * 60e3 });
      if (row.count >= max) throw fail('登录尝试过于频繁，请稍后再试', 'RATE_LIMITED');
      const result = yield op('updateWhere', 'security_rate_limits', { _id: key, count: row.count }, { count: row.count + 1 });
      if (result.updated === 1) return;
    }
    throw fail('登录尝试过于频繁，请稍后再试', 'RATE_LIMITED');
  }
  function* rateLimit(phone, context = {}) {
    const bucket = Math.floor(now() / 60000);
    const dimensions = [['account', phone, 20], ['ip', context.sourceIp || 'unknown', 100], ['device', context.deviceId || 'unknown', 100], ['global', 'all', 600]];
    for (const [type, value, max] of dimensions) yield* counter(`${type}-${bucket}-${hash(String(value).slice(0, 256))}`, max);
    const key = `failure-${hash(phone)}`;
    const state = yield* getOrCreate('security_rate_limits', key, { count: 0, failures: 0, lockLevel: 0, lockedUntil: 0, expiresAt: now() + 7 * 86400e3 });
    if (state.lockedUntil > now()) throw fail('登录失败次数过多，已锁定，请稍后再试', 'RATE_LIMITED');
    return state;
  }
  function* loginEvent(userId, success, context = {}, reason = '') {
    yield op('insert', 'login_events', { _id: id(), userId: userId || '', success, reason, sourceIpHash: hash(context.sourceIp || 'unknown'), deviceHash: hash(context.deviceId || 'unknown'), requestId: String(context.requestId || '').slice(0, 80), createdAt: now() });
  }
  function* failedLogin(state, user, context) {
    for (let retry = 0; retry < 12; retry++) {
      const current = yield op('getById', 'security_rate_limits', state._id);
      const failures = current.lockedUntil && current.lockedUntil <= now() ? 1 : current.failures + 1;
      const lockLevel = failures >= 5 ? (current.lockLevel || 0) + 1 : current.lockLevel || 0;
      const lockedUntil = failures >= 5 ? now() + Math.min(24 * 60 * 60e3, 30 * 60e3 * (2 ** Math.min(lockLevel - 1, 6))) : 0;
      const result = yield op('updateWhere', 'security_rate_limits', { _id: state._id, failures: current.failures }, { failures, lockLevel, lockedUntil });
      if (result.updated === 1) {
        if (user) yield op('updateById', 'users', user._id, { loginFailCount: failures, lockedUntil });
        yield* loginEvent(user?._id, false, context, 'CREDENTIALS_REJECTED');
        throw fail('手机号或密码错误，或验证码无效');
      }
    }
    throw fail('登录尝试过于频繁，请稍后再试', 'RATE_LIMITED');
  }
  function* consumeMfa(userId, payload) {
    const record = yield op('getById', 'account_security', userId);
    if (!record?.mfaEnabled) return false;
    if (payload.recoveryCode) {
      const codeId = `${userId}-${hash(String(payload.recoveryCode).trim().toUpperCase())}`;
      const result = yield op('updateWhere', 'mfa_recovery_codes', { _id: codeId, usedAt: 0 }, { usedAt: now() });
      return result.updated === 1;
    }
    const code = String(payload.mfaCode || payload.code || '');
    if (!/^\d{6}$/.test(code)) return false;
    const secret = unseal(record.mfaSecret, userId, env);
    for (const offset of [0, -1, 1]) {
      const at = now() + offset * 30000; const step = Math.floor(at / 30000);
      if (step <= (record.lastTotpStep ?? -1) || !equal(totp(secret, at), code)) continue;
      const result = yield op('updateWhere', 'account_security', { _id: userId, lastTotpStep: record.lastTotpStep ?? -1 }, { lastTotpStep: step });
      return result.updated === 1;
    }
    return false;
  }
  function* login(payload, context = {}) {
    const phone = String(payload.phone || '').trim().slice(0, 128);
    const state = yield* rateLimit(phone, context);
    const user = yield op('findOne', 'users', { phone });
    const verified = verifyPassword(payload.password, user?.passwordHash);
    const role = user?.role === 'CUSTOMER_SERVICE' ? 'CS' : user?.role;
    const roles = (payload.roles || []).map((r) => r === 'CUSTOMER_SERVICE' ? 'CS' : r);
    if (!user || !verified.valid || (user.status && user.status !== 'ACTIVE') || (roles.length && !roles.includes(role))) return yield* failedLogin(state, user, context);
    if (user.lockedUntil > now()) throw fail('登录失败次数过多，已锁定，请稍后再试', 'RATE_LIMITED');
    const security = yield op('getById', 'account_security', user._id);
    const mfaVerified = security?.mfaEnabled ? yield* consumeMfa(user._id, payload) : false;
    if (security?.mfaEnabled && !mfaVerified) return yield* failedLogin(state, user, context);
    const patch = { loginFailCount: 0, lockedUntil: 0, updatedAt: now() };
    if (verified.legacy) patch.passwordHash = hashPassword(payload.password);
    try { assertPasswordStrength(payload.password); } catch { if (strictSecurity(env)) patch.mustChangePwd = true; }
    const updated = yield op('updateById', 'users', user._id, patch);
    yield op('updateById', 'security_rate_limits', state._id, { failures: 0, lockedUntil: 0, lockLevel: 0 });
    yield* loginEvent(user._id, true, context, verified.legacy ? 'PASSWORD_MIGRATED' : 'LOGIN_SUCCESS');
    return { ...updated, _authentication: { mfaAt: mfaVerified ? now() : 0 } };
  }
  function* createSession(user, access = {}) {
    const security = yield op('getById', 'account_security', user._id);
    const roles = access.roles || [user.role];
    const mfaRequired = roles.some((role) => HIGH_ROLES.has(role));
    const claims = { userId: user._id, role: user.role, ...access, securityVersion: user.securityVersion || 0, sid: id(), iat: now(), exp: now() + SESSION_TTL_MS, mfaAt: user._authentication?.mfaAt || 0, scope: strictSecurity(env) && ((mfaRequired && !security?.mfaEnabled) || user.mustChangePwd) ? 'security-setup' : 'full' };
    yield op('insert', 'auth_sessions', { _id: claims.sid, userId: user._id, securityVersion: claims.securityVersion, createdAt: now(), expiresAt: claims.exp, revokedAt: 0 });
    return claims;
  }
  function* validateSession(session, action) {
    if (!session?.userId) throw fail('会话已失效，请重新登录');
    const user = yield op('getById', 'users', session.userId);
    if (!user || (user.status && user.status !== 'ACTIVE') || (session.securityVersion || 0) !== (user.securityVersion || 0)) throw fail('会话已失效，请重新登录');
    if (session.sid) {
      const active = yield op('getById', 'auth_sessions', session.sid);
      if (!active || active.userId !== session.userId || active.revokedAt || active.expiresAt <= now()) throw fail('会话已失效，请重新登录');
    } else if (strictSecurity(env)) throw fail('会话已升级，请重新登录');
    if (strictSecurity(env) && !SETUP_ACTIONS.has(action)) {
      if (user.mustChangePwd) throw fail('请先在安全中心修改初始或弱密码', 'PASSWORD_CHANGE_REQUIRED');
      const roles = [user.role, ...(session.roles || [])];
      if (roles.some((role) => HIGH_ROLES.has(role))) {
        const security = yield op('getById', 'account_security', user._id);
        if (!security?.mfaEnabled || !session.mfaAt || session.scope === 'security-setup') throw fail('请先在安全中心绑定 MFA 并重新登录', 'MFA_REQUIRED');
      }
    }
    return user;
  }
  function* bumpVersion(userId) {
    for (let retry = 0; retry < 12; retry++) {
      const user = yield op('getById', 'users', userId);
      // Old rows acquire an explicit version once; future mutations are CAS protected.
      if (user.securityVersion === undefined) { yield op('updateById', 'users', userId, { securityVersion: 0 }); continue; }
      const result = yield op('updateWhere', 'users', { _id: userId, securityVersion: user.securityVersion }, { securityVersion: user.securityVersion + 1, updatedAt: now() });
      if (result.updated === 1) return user.securityVersion + 1;
    }
    throw fail('账户状态已变化，请重试', 'CONFLICT');
  }
  function* audit(action, userId, session, metadata = {}) {
    yield op('insert', 'audit_logs', { _id: id(), brandId: (session.brandScopes || []).find((x) => x !== '*') || 'default', action, resourceType: 'account_security', resourceId: userId, operatorId: session.userId, operatorRole: session.role, metadata, createdAt: now() });
  }
  function* getSecurityStatus(payload, session) {
    const user = yield* validateSession(session, 'getSecurityStatus');
    const security = yield op('getById', 'account_security', user._id);
    const all = yield op('find', 'auth_sessions', { userId: user._id });
    return { mfaEnabled: !!security?.mfaEnabled, mfaRequired: strictSecurity(env) && [user.role, ...(session.roles || [])].some((r) => HIGH_ROLES.has(r)), mustChangePwd: !!user.mustChangePwd, activeSessions: all.filter((x) => !x.revokedAt && x.expiresAt > now() && x.securityVersion === (user.securityVersion || 0)).length, passwordAlgorithm: 'scrypt', strict: strictSecurity(env) };
  }
  function* setupMfa(payload, session) {
    const user = yield* validateSession(session, 'setupMfa');
    yield* rateLimit(`mfa:${user._id}`, { deviceId: session.sid });
    if (!verifyPassword(payload.password, user.passwordHash).valid) throw fail('身份验证失败');
    const existing = yield op('getById', 'account_security', user._id);
    if (existing?.mfaEnabled) throw fail('MFA 已启用；更换验证器需走管理员人工核验流程', 'CONFLICT');
    const secret = base32(randomBytes(20));
    yield* getOrCreate('account_security', user._id, { mfaEnabled: false, lastTotpStep: -1 });
    yield op('updateById', 'account_security', user._id, { pendingSecret: seal(secret, user._id, env), pendingExpiresAt: now() + 10 * 60e3 });
    yield* audit('setupMfa', user._id, session);
    return { secret, otpauthUrl: `otpauth://totp/${encodeURIComponent(`星河服务:${user.phone || user._id}`)}?secret=${secret}&issuer=${encodeURIComponent('星河服务')}&algorithm=SHA1&digits=6&period=30`, expiresInSeconds: 600 };
  }
  function* enableMfa(payload, session) {
    const user = yield* validateSession(session, 'enableMfa');
    yield* rateLimit(`mfa:${user._id}`, { deviceId: session.sid });
    const security = yield op('getById', 'account_security', user._id);
    if (!security?.pendingSecret || security.mfaEnabled || security.pendingExpiresAt <= now()) throw fail('请重新开始绑定 MFA');
    const secret = unseal(security.pendingSecret, user._id, env);
    let step = -1;
    for (const offset of [0, -1, 1]) if (equal(totp(secret, now() + offset * 30000), String(payload.code))) step = Math.floor((now() + offset * 30000) / 30000);
    if (step < 0) throw fail('验证码错误或已过期');
    const result = yield op('updateWhere', 'account_security', { _id: user._id, mfaEnabled: false, pendingExpiresAt: security.pendingExpiresAt }, { mfaEnabled: true, mfaSecret: security.pendingSecret, pendingSecret: null, lastTotpStep: step, enabledAt: now() });
    if (result.updated !== 1) throw fail('绑定状态已变化，请重新登录', 'CONFLICT');
    const recoveryCodes = [];
    for (let i = 0; i < 8; i++) {
      const code = randomBytes(10).toString('hex').toUpperCase(); recoveryCodes.push(code);
      yield op('insert', 'mfa_recovery_codes', { _id: `${user._id}-${hash(code)}`, userId: user._id, usedAt: 0, createdAt: now() });
    }
    yield* bumpVersion(user._id);
    yield* audit('enableMfa', user._id, session);
    return { ok: true, recoveryCodes, requiresLogin: true };
  }
  function* verifySecurityChallenge(payload, session) {
    const user = yield* validateSession(session, 'verifySecurityChallenge');
    yield* rateLimit(`stepup:${user._id}`, { deviceId: session.sid });
    if (!verifyPassword(payload.password, user.passwordHash).valid || !(yield* consumeMfa(user._id, payload))) throw fail('二次验证失败，请检查密码和验证码');
    yield* audit('verifySecurityChallenge', user._id, session);
    return { token: signed({ purpose: 'sensitive-operation', userId: user._id, sid: session.sid, securityVersion: session.securityVersion || 0, iat: now(), exp: now() + 5 * 60e3 }, env.SESSION_SECRET), expiresInSeconds: 300 };
  }
  function* revokeSessions(payload, session) {
    const user = yield* validateSession(session, 'revokeSessions');
    yield* bumpVersion(user._id); yield* audit('revokeSessions', user._id, session);
    return { ok: true, requiresLogin: true };
  }
  function* changePassword(payload, session) {
    const user = yield* validateSession(session, 'changePassword');
    yield* rateLimit(`password:${user._id}`, { deviceId: session.sid });
    if (!verifyPassword(payload.oldPassword, user.passwordHash).valid) throw fail('旧密码错误');
    assertPasswordStrength(payload.newPassword);
    if (verifyPassword(payload.newPassword, user.passwordHash).valid) throw fail('新密码不能与旧密码相同', 'WEAK_PASSWORD');
    const security = yield op('getById', 'account_security', user._id);
    if (security?.mfaEnabled) verifyStepUpToken(payload.stepUpToken, session, env, now());
    yield op('updateById', 'users', user._id, { passwordHash: hashPassword(payload.newPassword), mustChangePwd: false, passwordChangedAt: now() });
    yield* bumpVersion(user._id); yield* audit('changePassword', user._id, session);
    return { ok: true, requiresLogin: true };
  }
  function* listLoginHistory(payload, session) {
    yield* validateSession(session, 'listLoginHistory');
    const rows = yield op('find', 'login_events', { userId: session.userId });
    return { items: rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, 50).map(({ _id, success, reason, createdAt, requestId, sourceIpHash, deviceHash }) => ({ _id, success, reason, createdAt, requestId, source: sourceIpHash.slice(0, 12), device: deviceHash.slice(0, 12) })) };
  }
  function* setAccountStatus(payload, session) {
    yield* validateSession(session, 'setAccountStatus');
    if (![session.role, ...(session.roles || [])].some((r) => ['ADMIN', 'SUPER_ADMIN'].includes(r))) throw fail('无权操作账号', 'FORBIDDEN');
    assertSensitiveAction('setAccountStatus', session, payload.stepUpToken, env, now());
    if (!['ACTIVE', 'DISABLED'].includes(payload.status) || !String(payload.reason || '').trim()) throw fail('请选择账号状态并填写原因', 'BAD_REQUEST');
    if (payload.userId === session.userId) throw fail('不能停用当前登录账号', 'BAD_REQUEST');
    const user = yield op('getById', 'users', payload.userId); if (!user) throw fail('账号不存在', 'NOT_FOUND');
    yield* bumpVersion(user._id); yield op('updateById', 'users', user._id, { status: payload.status });
    yield* audit('setAccountStatus', user._id, session, { status: payload.status, reason: String(payload.reason).slice(0, 200) });
    return { ok: true };
  }
  function* refreshSession(payload, session) {
    const user = yield* validateSession(session, 'refreshSession');
    const claims = yield* createSession({ ...user, _authentication: { mfaAt: session.mfaAt } }, { roles: session.roles, brandScopes: session.brandScopes, permissions: session.permissions });
    if (session.sid) yield op('updateById', 'auth_sessions', session.sid, { revokedAt: now() });
    return claims;
  }
  return Object.fromEntries(Object.entries({ login, createSession, validateSession, getSecurityStatus, setupMfa, enableMfa, verifySecurityChallenge, revokeSessions, changePassword, listLoginHistory, setAccountStatus, refreshSession }).map(([name, fn]) => [name, (...args) => run(fn(...args))]));
}
module.exports = { createAccountSecurity, hashPassword, verifyPassword, assertPasswordStrength, publicUser, totp, strictSecurity, assertSensitiveAction, verifyStepUpToken, signed, SECURITY_ROLES, SENSITIVE_ACTIONS, SESSION_TTL_MS };
