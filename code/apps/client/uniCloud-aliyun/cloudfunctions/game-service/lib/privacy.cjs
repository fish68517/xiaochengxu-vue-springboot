'use strict';
// Commercial Batch 4: shared by the cloud runtime and local mirror.
const crypto = require('node:crypto');
const PII_FIELDS = Object.freeze({
  users: ['phone', 'wechat'], customers: ['phone', 'wechat'],
  worker_profiles: ['realName', 'withdrawWechat', 'phone', 'wechat', 'idCard', 'idCardNumber', 'address'],
  orders: ['contactPhone', 'contactWechat'], vip_list: ['matchKey'],
  data_rights_requests: ['reason', 'correctionJson', 'resultJson'],
});
const MASK_FIELDS = new Set(['realName', 'withdrawWechat', 'phone', 'wechat', 'idCard', 'idCardNumber', 'contactPhone', 'contactWechat', 'address', 'matchKey', 'payerOpenid']);
const PRIVATE_FIELDS = new Set(['idCardAttachmentId', 'fileID', 'fileId', 'storageKey', 'correctionJson', 'resultJson']);
const localKey = crypto.randomBytes(32); const localBlindKey = crypto.randomBytes(32);
const localDecorated = Symbol('pii-protected');
const TYPES = ['COPY', 'CORRECT', 'DELETE', 'APPEAL', 'CLOSE_ACCOUNT'];
const DAY = 86400000;
const isRemote = (env) => ['staging', 'production'].includes(env.APP_ENV || env.NODE_ENV);
const uuid = (prefix) => `${prefix}-${crypto.randomUUID()}`;
function fail(message, code = 'PRIVACY_ERROR') { const error = new Error(message); error.code = code; throw error; }
function json(value, fallback) { if (!value) return fallback; try { return JSON.parse(value); } catch (_) { fail('隐私配置 JSON 格式错误', 'PRIVACY_CONFIG_INVALID'); } }
function keyConfig(env = process.env) {
  const version = env.PII_KEY_VERSION || (!isRemote(env) ? 'local' : '');
  const keys = json(env.PII_KEYS_JSON, {});
  if (!env.PII_KEYS_JSON && !isRemote(env)) keys.local = localKey.toString('base64');
  if (!version || !/^[a-zA-Z0-9_-]{1,32}$/.test(version) || !keys[version]) fail('PII 加密密钥未配置', 'PII_KEY_MISSING');
  for (const value of Object.values(keys)) if (typeof value !== 'string' || Buffer.from(value, 'base64').length !== 32) fail('PII 密钥必须为 base64 编码的 32 字节', 'PII_KEY_INVALID');
  const blind = env.PII_BLIND_INDEX_KEY ? Buffer.from(env.PII_BLIND_INDEX_KEY, 'base64') : (!isRemote(env) ? localBlindKey : null);
  if (!blind || blind.length !== 32) fail('PII 盲索引密钥未配置或长度错误', 'PII_KEY_MISSING');
  if (Object.values(keys).some((value) => Buffer.from(value, 'base64').equals(blind))) fail('加密和盲索引必须使用不同密钥', 'PII_KEY_INVALID');
  return { version, keys, blind };
}
function encryptPii(value, context, env = process.env) {
  if (value === '' || value == null) return value;
  if (typeof value === 'string' && value.startsWith('pii:')) return value;
  const { version, keys } = keyConfig(env); const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(keys[version], 'base64'), iv);
  cipher.setAAD(Buffer.from(String(context))); const data = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `pii:${version}:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${data.toString('base64url')}`;
}
function decryptPii(value, context, env = process.env) {
  if (typeof value !== 'string' || !value.startsWith('pii:')) return value;
  const parts = value.split(':'); if (parts.length !== 5) fail('PII 密文格式错误', 'PII_DECRYPT_FAILED');
  const { keys } = keyConfig(env); const key = keys[parts[1]]; if (!key) fail('PII 历史密钥版本不可用', 'PII_KEY_MISSING');
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'base64'), Buffer.from(parts[2], 'base64url'));
    decipher.setAAD(Buffer.from(String(context))); decipher.setAuthTag(Buffer.from(parts[3], 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(parts[4], 'base64url')), decipher.final()]).toString('utf8');
  } catch (_) { fail('PII 密文校验失败', 'PII_DECRYPT_FAILED'); }
}
function blindIndex(value, context, env = process.env) { return crypto.createHmac('sha256', keyConfig(env).blind).update(`${context}\0${String(value).trim().toLowerCase()}`).digest('hex'); }
function contextFor(collection, field, doc) { return `${collection}.${field}:${doc.brandId || 'default'}`; }
function encryptRecord(collection, doc, env = process.env) {
  if (!doc) return doc; const output = { ...doc };
  for (const field of PII_FIELDS[collection] || []) if (Object.hasOwn(doc, field)) {
    const plain = decryptPii(doc[field], contextFor(collection, field, doc), env);
    output[field] = encryptPii(plain, contextFor(collection, field, doc), env);
    output[`${field}BlindIndex`] = plain ? blindIndex(plain, `${collection}.${field}`, env) : '';
  }
  return output;
}
function decryptRecord(collection, doc, env = process.env) {
  if (!doc) return doc; const output = { ...doc };
  for (const field of PII_FIELDS[collection] || []) if (Object.hasOwn(doc, field)) output[field] = decryptPii(doc[field], contextFor(collection, field, doc), env);
  return output;
}
function mask(value, field = '') {
  const text = String(value ?? ''); if (!text) return '';
  if (text.startsWith('pii:')) return '***'; if (text.includes('*')) return text;
  if (/phone/i.test(field) && /^\d{11}$/.test(text)) return `${text.slice(0, 3)}****${text.slice(-4)}`;
  if (/idCard/i.test(field)) return `${text.slice(0, 2)}************${text.slice(-2)}`;
  return `${text[0]}***`;
}
function redactPrivacy(value) {
  if (Array.isArray(value)) return value.map(redactPrivacy);
  if (!value || typeof value !== 'object') return value;
  const output = {}; const attachment = value.bizType && value.uploaderId;
  for (const [key, item] of Object.entries(value)) {
    if (key.endsWith('BlindIndex') || PRIVATE_FIELDS.has(key) || (attachment && key === 'url')) continue;
    output[key] = MASK_FIELDS.has(key) ? mask(item, key) : redactPrivacy(item);
  }
  return output;
}
function protectRepository(repo, env = process.env) {
  if (repo.__privacyProtected) return repo;
  const wrapped = {
    ...repo, __privacyProtected: true,
    ...(typeof repo.queryPage === 'function' ? { async queryPage(name, options = {}) {
      // 工作流仅按品牌/状态/归属分页；仍需解密记录，不能绕过隐私仓储。
      const page = await repo.queryPage(name, options);
      return { ...page, items: page.items.map(row => decryptRecord(name, row, env)) };
    } } : {}),
    async getById(name, id) { return decryptRecord(name, await repo.getById(name, id), env); },
    async find(name, where = {}) {
      const rewritten = {}; let changed = false;
      for (const [key, value] of Object.entries(where)) {
        if ((PII_FIELDS[name] || []).includes(key) && typeof value === 'string' && value !== '') { rewritten[`${key}BlindIndex`] = blindIndex(value, `${name}.${key}`, env); changed = true; }
        else rewritten[key] = value;
      }
      const encrypted = await repo.find(name, rewritten);
      const legacy = changed ? await repo.find(name, where) : [];
      return [...new Map([...encrypted, ...legacy].map((row) => [row._id, decryptRecord(name, row, env)])).values()];
    },
    async findOne(name, where = {}) { return (await this.find(name, where))[0] || null; },
    async insert(name, doc) { return decryptRecord(name, await repo.insert(name, encryptRecord(name, doc, env)), env); },
    async updateById(name, id, patch) {
      if (name === 'privacy_audit_logs') fail('隐私审计记录禁止修改');
      const old = await this.getById(name, id); if (!old) return null;
      const merged = encryptRecord(name, { ...old, ...patch }, env);
      const encryptedPatch = { ...patch };
      for (const field of PII_FIELDS[name] || []) if (Object.hasOwn(patch, field) || (patch.brandId && patch.brandId !== old.brandId)) {
        if (Object.hasOwn(merged, field)) { encryptedPatch[field] = merged[field]; encryptedPatch[`${field}BlindIndex`] = merged[`${field}BlindIndex`]; }
      }
      return decryptRecord(name, await repo.updateById(name, id, encryptedPatch), env);
    },
    async updateWhere(name, where, patch) {
      if (name === 'privacy_audit_logs') fail('隐私审计记录禁止修改');
      // Preserve atomic conditional updates for financial and order state changes.
      const fields = PII_FIELDS[name] || [];
      const secureWhere = Object.fromEntries(Object.entries(where).map(([field, value]) => fields.includes(field) && value ? [`${field}BlindIndex`, blindIndex(value, `${name}.${field}`, env)] : [field, value]));
      if (!fields.some((field) => Object.hasOwn(patch, field))) return repo.updateWhere(name, secureWhere, patch);
      const rows = await this.find(name, where); let updated = 0;
      for (const row of rows) { const encrypted = encryptRecord(name, { ...row, ...patch }, env); const safe = { ...patch };
        for (const field of fields) if (Object.hasOwn(patch, field)) { safe[field] = encrypted[field]; safe[`${field}BlindIndex`] = encrypted[`${field}BlindIndex`]; }
        const result = await repo.updateWhere(name, { ...secureWhere, _id: row._id }, safe); updated += result.updated || 0;
      }
      return { updated };
    },
    async insertIfAbsent(name, where, doc) { const existing = await this.findOne(name, where); return existing ? { created: false, doc: existing } : { created: true, doc: await this.insert(name, doc) }; },
    async transaction(fn) { return repo.transaction((transaction) => fn(protectRepository(transaction, env))); },
  };
  return wrapped;
}
// Local mirror keeps synchronous service compatibility. Serialized snapshots contain ciphertext.
function protectLocalDatabase(db, env = process.env) {
  for (const [name, fields] of Object.entries(PII_FIELDS)) for (const doc of db[name] || []) {
    if (!doc[localDecorated]) Object.defineProperty(doc, localDecorated, { value: new Set(), enumerable: false });
    for (const field of fields) {
      if (!Object.hasOwn(doc, field) || doc[localDecorated].has(field)) continue;
      const context = contextFor(name, field, doc); let cipher = encryptPii(doc[field], context, env);
      const plain = decryptPii(cipher, context, env); doc[`${field}BlindIndex`] = plain ? blindIndex(plain, `${name}.${field}`, env) : '';
      Object.defineProperty(doc, field, { configurable: true, enumerable: true, get() { return decryptPii(cipher, context, env); }, set(value) { cipher = encryptPii(value, context, env); this[`${field}BlindIndex`] = value ? blindIndex(decryptPii(cipher, context, env), `${name}.${field}`, env) : ''; } });
      doc[localDecorated].add(field);
    }
    Object.defineProperty(doc, 'toJSON', { configurable: true, enumerable: false, value() { return encryptRecord(name, this, env); } });
  }
  return db;
}
function asPrivacyRepository(db) {
  const coll = (name) => db[name] || (db[name] = []);
  const match = (row, where) => Object.entries(where).every(([k, v]) => row[k] === v);
  return {
    async find(name, where = {}) { return coll(name).filter((row) => match(row, where)); },
    async findOne(name, where = {}) { return coll(name).find((row) => match(row, where)) || null; },
    async getById(name, id) { return coll(name).find((row) => row._id === id) || null; },
    async insert(name, doc) { if (!doc._id) doc._id = uuid(name); if (coll(name).some((row) => row._id === doc._id)) fail('记录重复'); coll(name).push(doc); return doc; },
    async updateById(name, id, patch) { if (name === 'privacy_audit_logs') fail('隐私审计记录禁止修改'); const row = await this.getById(name, id); if (row) Object.assign(row, patch); return row; },
    async updateWhere(name, where, patch) { if (name === 'privacy_audit_logs') fail('隐私审计记录禁止修改'); let updated = 0; for (const row of coll(name)) if (match(row, where)) { Object.assign(row, patch); updated++; } return { updated }; },
    async transaction(fn) {
      const backup = Object.fromEntries(Object.keys(db).filter((key) => Array.isArray(db[key])).map((key) => [key, db[key].map((row) => structuredClone(row))]));
      try { return await fn(this); } catch (error) { for (const [key, rows] of Object.entries(backup)) db[key] = rows; throw error; }
    },
  };
}
function requireUser(session) { if (!session || !session.userId) fail('请先登录', 'UNAUTHORIZED'); }
function roles(session) { return [session.role, ...(session.roles || [])].map((value) => String(value || '').toUpperCase()); }
function requireAdmin(session) { requireUser(session); if (!roles(session).some((role) => ['ADMIN', 'SUPER_ADMIN'].includes(role))) fail('无权限处理个人信息', 'FORBIDDEN'); }
function requireBrand(session, brandId) {
  requireUser(session); const scopes = session.brandScopes || (session.brandId ? [session.brandId] : []);
  if (!scopes.includes('*') && !scopes.includes(brandId)) fail('无权访问该品牌', 'FORBIDDEN');
}
function activeBrand(payload, session) { const brandId = payload.brandId || (session.brandScopes || []).find((value) => value !== '*') || 'default'; requireBrand(session, brandId); return brandId; }
function ownRequest(request, session) { requireUser(session); if (!request || request.userId !== session.userId) fail('只能处理本人申请', 'FORBIDDEN'); requireBrand(session, request.brandId); }
function legalDocuments(env, brandId) {
  const rows = json(env.PRIVACY_LEGAL_DOCUMENTS_JSON, []); if (!Array.isArray(rows)) fail('协议配置必须为数组');
  return rows.filter((doc) => doc.brandId === brandId).map((doc) => {
    let url; try { url = new URL(doc.url); } catch (_) { fail('正式协议 URL 无效'); }
    if (url.protocol !== 'https:' || /^(localhost|127\.|0\.)/i.test(url.hostname) || url.username || url.password) fail('正式协议必须使用公网 HTTPS');
    if (!['privacy', 'terms', 'minors', 'service', 'refund'].includes(doc.type) || !doc.version || !doc.title) fail('协议类型、标题或版本未配置');
    return { type: doc.type, title: doc.title, version: doc.version, url: url.href, brandId, required: doc.required !== false };
  });
}
function validateAttachment(payload) {
  if (payload.fileID || payload.fileId || payload.storageKey) fail('禁止登记未经服务端验证的文件引用');
  const fileName = String(payload.fileName || ''); const ext = fileName.split('.').pop().toLowerCase();
  const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', pdf: 'application/pdf' };
  if (!types[ext] || !/^[^/\\\0]{1,160}$/.test(fileName) || types[ext] !== payload.mimeType) fail('附件类型、扩展名或 MIME 不匹配');
  if (typeof payload.content !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload.content)) fail('缺少合法文件内容');
  const bytes = Buffer.from(payload.content, 'base64'); const max = payload.bizType === 'id_card' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
  if (!bytes.length || bytes.length > max || Number(payload.size) !== bytes.length) fail('附件大小不匹配或超过限制');
  const valid = ext === 'png' ? bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) : ['jpg', 'jpeg'].includes(ext) ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.subarray(0, 5).toString() === '%PDF-';
  if (!valid) fail('附件实际内容与文件类型不匹配');
  return { bytes, mimeType: types[ext], ext, fileName, hash: crypto.createHash('sha256').update(bytes).digest('hex') };
}
function createPrivacyServices({ env = process.env, now = Date.now, verifyStepUp, scanner, storage } = {}) {
  const api = {};
  async function stepUp(repo, session, payload) {
    requireAdmin(session);
    if (!verifyStepUp || !payload.stepUpToken || !(await verifyStepUp(repo, session, payload.stepUpToken, { purpose: 'privacy' }))) fail('请先完成敏感操作二次验证', 'STEP_UP_REQUIRED');
  }
  async function audit(repo, action, record, session, purpose = '') {
    const doc = { _id: uuid('pia'), brandId: record.brandId || 'default', action, resourceId: record._id || '', operatorId: session.userId, operatorRole: session.role, purpose: String(purpose).slice(0, 200), requestId: session.requestId || '', createdAt: now() };
    doc.integrity = crypto.createHmac('sha256', keyConfig(env).blind).update(JSON.stringify(doc)).digest('hex');
    await repo.insert('privacy_audit_logs', doc); return doc;
  }
  api.getLegalDocuments = async (_repo, payload = {}) => {
    const documents = legalDocuments(env, payload.brandId || 'default');
    return { configured: documents.length > 0, complete: ['privacy', 'terms', 'minors', 'service', 'refund'].every((type) => documents.some((doc) => doc.type === type)), documents, coolingDays: coolingDays() };
  };
  function coolingDays() { const days = Number(env.ACCOUNT_CLOSURE_COOLING_DAYS || 7); if (!Number.isInteger(days) || days < 1 || days > 90) fail('账号注销冷静期配置无效'); return days; }
  api.recordLegalConsent = async (repo, payload, session) => {
    const brandId = activeBrand(payload, session); const document = legalDocuments(env, brandId).find((doc) => doc.type === payload.type && doc.version === payload.version);
    if (!document) fail('协议版本无效，请刷新后阅读');
    return repo.transaction(async (tr) => {
      const previous = await tr.findOne('privacy_consents', { userId: session.userId, brandId, type: document.type, version: document.version, status: 'GRANTED' });
      if (previous) return previous;
      const consent = await tr.insert('privacy_consents', { _id: uuid('consent'), userId: session.userId, brandId, type: document.type, version: document.version, documentUrl: document.url, status: 'GRANTED', source: ['h5', 'miniapp', 'workbench'].includes(payload.source) ? payload.source : 'h5', consentedAt: now(), createdAt: now() });
      await audit(tr, 'CONSENT_GRANTED', consent, session); return consent;
    });
  };
  api.withdrawLegalConsent = async (repo, payload, session) => {
    return repo.transaction(async (tr) => {
      const consent = await tr.getById('privacy_consents', payload.consentId); ownRequest(consent, session);
      if (consent.status === 'WITHDRAWN') return consent;
      await audit(tr, 'CONSENT_WITHDRAWN', consent, session);
      return tr.updateById('privacy_consents', consent._id, { status: 'WITHDRAWN', withdrawnAt: now() });
    });
  };
  api.listMyDataRequests = async (repo, payload, session) => {
    const brandId = activeBrand(payload || {}, session);
    const requests = await repo.find('data_rights_requests', { userId: session.userId, brandId });
    const consents = await repo.find('privacy_consents', { userId: session.userId, brandId });
    return { requests: requests.sort((a, b) => b.createdAt - a.createdAt).map(publicRequest), consents };
  };
  function publicRequest(row) { const { correctionJson, resultJson, ...rest } = row; return { ...rest, hasCopy: !!resultJson }; }
  api.requestDataRight = async (repo, payload, session) => {
    const brandId = activeBrand(payload, session); if (!TYPES.includes(payload.type)) fail('不支持的个人信息申请类型');
    if (typeof payload.reason !== 'string' || !payload.reason.trim() || payload.reason.length > 1000) fail('请填写 1～1000 字的申请说明');
    const correction = payload.correction || {};
    if (payload.type === 'CORRECT' && (!Object.keys(correction).length || Object.entries(correction).some(([key, value]) => !['phone', 'wechat', 'realName', 'address'].includes(key) || typeof value !== 'string' || value.length > 200))) fail('更正字段无效');
    if (payload.type === 'APPEAL') { const previous = await repo.getById('data_rights_requests', payload.appealRequestId); ownRequest(previous, session); if (!['REJECTED', 'COMPLETED'].includes(previous.status)) fail('原申请尚未处理，暂不能申诉'); }
    const duplicate = await repo.findOne('data_rights_requests', { userId: session.userId, brandId, type: payload.type, status: 'SUBMITTED' }); if (duplicate) return publicRequest(duplicate);
    return repo.transaction(async (tr) => {
      const request = await tr.insert('data_rights_requests', { _id: uuid('rights'), userId: session.userId, subjectOpenid: session.openid || '', brandId, type: payload.type, reason: payload.reason.trim(), correctionJson: JSON.stringify(correction), appealRequestId: payload.appealRequestId || '', status: 'SUBMITTED', executeAfter: payload.type === 'CLOSE_ACCOUNT' ? now() + coolingDays() * DAY : now(), timeline: [{ status: 'SUBMITTED', at: now(), by: session.userId }], createdAt: now(), updatedAt: now() });
      await audit(tr, 'DATA_RIGHT_REQUESTED', request, session, payload.type); return publicRequest(request);
    });
  };
  api.cancelDataRequest = async (repo, payload, session) => repo.transaction(async (tr) => {
    const request = await tr.getById('data_rights_requests', payload.requestId); ownRequest(request, session);
    if (request.status === 'CANCELLED') return publicRequest(request);
    if (!['SUBMITTED', 'APPROVED'].includes(request.status)) fail('申请已处理，不能撤销');
    await audit(tr, 'DATA_RIGHT_CANCELLED', request, session); return publicRequest(await tr.updateById('data_rights_requests', request._id, { status: 'CANCELLED', updatedAt: now(), timeline: [...request.timeline, { status: 'CANCELLED', at: now(), by: session.userId }] }));
  });
  api.listDataRequests = async (repo, payload = {}, session) => {
    requireAdmin(session); const brandId = activeBrand(payload, session); const status = payload.status;
    const where = { brandId }; if (status) where.status = status;
    const rows = (await repo.find('data_rights_requests', where)).sort((a, b) => b.createdAt - a.createdAt);
    const page = Math.max(1, Number(payload.page) || 1); const pageSize = Math.min(100, Math.max(1, Number(payload.pageSize) || 20));
    return { items: rows.slice((page - 1) * pageSize, page * pageSize).map(publicRequest), total: rows.length, page, pageSize };
  };
  api.reviewDataRequest = async (repo, payload, session) => {
    await stepUp(repo, session, payload);
    if (!['APPROVE', 'REJECT'].includes(payload.decision) || !String(payload.note || '').trim()) fail('请填写明确处理决定和原因');
    return repo.transaction(async (tr) => {
      const request = await tr.getById('data_rights_requests', payload.requestId); if (!request) fail('申请不存在'); requireBrand(session, request.brandId);
      if (request.status !== 'SUBMITTED') fail('申请状态已变化，请刷新');
      const status = payload.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      await audit(tr, 'DATA_RIGHT_REVIEWED', request, session, payload.note);
      return publicRequest(await tr.updateById('data_rights_requests', request._id, { status, reviewNote: String(payload.note).slice(0, 1000), reviewedBy: session.userId, updatedAt: now(), timeline: [...request.timeline, { status, at: now(), by: session.userId }] }));
    });
  };
  async function identities(repo, request) {
    const user = await repo.getById('users', request.userId); const customer = await repo.getById('customers', request.userId);
    return { user, customer, ids: [...new Set([request.userId, request.subjectOpenid, customer && customer.openid].filter(Boolean))] };
  }
  async function blockers(repo, request, ids) {
    const terminal = ['SETTLED', 'CANCELLED', 'REFUNDED', 'CLOSED'];
    for (const field of ['customerId', 'workerId']) for (const id of ids) if ((await repo.find('orders', { [field]: id })).some((row) => !terminal.includes(row.status))) return '存在未完成订单或售后，请处理完成后重试';
    for (const id of ids) {
      if ((await repo.find('wallets', { workerId: id })).some((row) => Number(row.balanceFen || row.balance || 0) !== 0 || Number(row.frozenFen || row.frozenAmountFen || 0) !== 0)) return '钱包余额或冻结金额未结清';
      if ((await repo.find('withdrawals', { workerId: id })).some((row) => !['PAID', 'REJECTED', 'CANCELLED', 'SUCCESS', 'FAILED'].includes(row.status))) return '存在未完成提现';
      if ((await repo.find('disputes', { customerId: id })).some((row) => !['RESOLVED', 'CLOSED'].includes(row.status))) return '存在未完成争议';
    }
    return '';
  }
  api.executeDataRequest = async (repo, payload, session) => {
    await stepUp(repo, session, payload);
    return repo.transaction(async (tr) => {
      const request = await tr.getById('data_rights_requests', payload.requestId); if (!request) fail('申请不存在'); requireBrand(session, request.brandId);
      if (request.status === 'COMPLETED') return publicRequest(request);
      if (request.status !== 'APPROVED') fail('申请须先审批通过');
      if (request.type === 'CLOSE_ACCOUNT' && now() < request.executeAfter) fail('注销冷静期尚未结束');
      const { user, customer, ids } = await identities(tr, request); const profiles = await tr.find('worker_profiles', { workerId: request.userId });
      let resultJson = '';
      if (['CLOSE_ACCOUNT', 'DELETE'].includes(request.type)) {
        const blocked = await blockers(tr, request, ids); if (blocked) fail(blocked, 'DATA_RIGHT_BLOCKED');
        const policy = json(env.PRIVACY_RETENTION_POLICY_JSON, {});
        if (isRemote(env) && policy.approved !== true) fail('数据保留政策尚未书面批准，不能执行删除', 'RETENTION_POLICY_REQUIRED');
        for (const [collection, rows] of [['users', user ? [user] : []], ['customers', customer ? [customer] : []], ['worker_profiles', profiles]]) for (const row of rows) {
          const patch = Object.fromEntries((PII_FIELDS[collection] || []).map((field) => [field, '']));
          if (request.type === 'CLOSE_ACCOUNT') Object.assign(patch, { status: 'CLOSED', closedAt: now(), sessionVersion: Number(row.sessionVersion || 0) + 1, nickname: '已注销用户', passwordHash: '', password: '' });
          await tr.updateById(collection, row._id, patch);
        }
        const attachments = await tr.find('attachments', { uploaderId: request.userId });
        for (const attachment of attachments) await tr.updateById('attachments', attachment._id, { accessRevoked: true, cleanupPending: true, cleanupRequestedAt: now() });
        for (const consent of await tr.find('privacy_consents', { userId: request.userId, brandId: request.brandId, status: 'GRANTED' })) await tr.updateById('privacy_consents', consent._id, { status: 'WITHDRAWN', withdrawnAt: now() });
        // Financial/audit records are retained under the approved policy, not silently destroyed.
      } else if (request.type === 'CORRECT') {
        const correction = json(request.correctionJson, {}); const target = user ? ['users', user] : customer ? ['customers', customer] : null;
        if (!target && !profiles.length) fail('找不到可更正的用户资料');
        if (target) await tr.updateById(target[0], target[1]._id, Object.fromEntries(Object.entries(correction).filter(([key]) => ['phone', 'wechat'].includes(key))));
        for (const profile of profiles) await tr.updateById('worker_profiles', profile._id, correction);
      } else if (request.type === 'COPY') {
        const pick = (row) => { if (!row) return null; const keys = ['_id', 'nickname', 'phone', 'wechat', 'realName', 'address', 'createdAt', 'status']; return Object.fromEntries(keys.filter((key) => Object.hasOwn(row, key)).map((key) => [key, row[key]])); };
        resultJson = JSON.stringify({ generatedAt: now(), user: pick(user), customer: pick(customer), profiles: profiles.map(pick), note: '本副本包含账户资料，资金及历史订单副本可通过申诉申请补充。' });
      } else if (request.type === 'APPEAL' && !String(payload.resolution || '').trim()) fail('申诉结案须填写处理结果');
      await audit(tr, 'DATA_RIGHT_EXECUTED', request, session, request.type);
      const completed = await tr.updateById('data_rights_requests', request._id, { status: 'COMPLETED', resultJson, resultNote: String(payload.resolution || '申请已执行；法定留存的订单和审计记录按批准规则保留').slice(0, 1000), completedAt: now(), updatedAt: now(), timeline: [...request.timeline, { status: 'COMPLETED', at: now(), by: session.userId }] });
      await tr.insert('notifications', { _id: `privacy-result-${request._id}`, brandId: request.brandId, receiverId: request.userId, channel: 'INBOX', template: 'DATA_RIGHT_COMPLETED', payload: { requestId: request._id, type: request.type, status: 'COMPLETED' }, status: 'SENT', createdAt: now() });
      return publicRequest(completed);
    });
  };
  api.getMyDataCopy = async (repo, payload, session) => {
    const request = await repo.getById('data_rights_requests', payload.requestId); ownRequest(request, session);
    if (request.type !== 'COPY' || request.status !== 'COMPLETED' || !request.resultJson) fail('资料副本尚未生成');
    await audit(repo, 'DATA_COPY_VIEWED', request, session, '本人查看信息副本'); return json(request.resultJson, {});
  };
  api.viewSensitiveProfile = async (repo, payload, session) => {
    await stepUp(repo, session, payload); if (String(payload.purpose || '').trim().length < 4) fail('请填写不少于四字的查看用途');
    const profile = await repo.getById('worker_profiles', payload.profileId); if (!profile) fail('资料不存在'); requireBrand(session, profile.brandId || 'default');
    await audit(repo, 'PII_PROFILE_VIEWED', profile, session, payload.purpose);
    return { profileId: profile._id, realName: profile.realName || '', withdrawWechat: profile.withdrawWechat || '', phone: profile.phone || '', wechat: profile.wechat || '', idCard: profile.idCard || profile.idCardNumber || '', expiresAt: now() + 60000 };
  };
  api.getProfile = async (repo, _payload, session) => {
    requireUser(session); if (!roles(session).includes('WORKER')) fail('无权读取接单资料', 'FORBIDDEN');
    const row = await repo.findOne('worker_profiles', { workerId: session.userId }); if (!row) return null;
    return { workerId: session.userId, realName: mask(row.realName), withdrawWechat: mask(row.withdrawWechat), phone: mask(row.phone, 'phone'), wechat: mask(row.wechat), hasIdCard: !!row.idCardAttachmentId, realnameStatus: row.realnameStatus || 'UNSUBMITTED', updatedAt: row.updatedAt };
  };
  api.updateProfile = async (repo, payload, session) => {
    requireUser(session); if (!roles(session).includes('WORKER')) fail('无权修改接单资料', 'FORBIDDEN'); const brandId = activeBrand(payload, session);
    const patch = { updatedAt: now() };
    for (const field of ['realName', 'withdrawWechat', 'phone', 'wechat']) if (Object.hasOwn(payload, field)) { if (typeof payload[field] !== 'string' || payload[field].length > 120 || payload[field].includes('*')) fail('资料内容无效，请重新填写原始值'); patch[field] = payload[field].trim(); }
    if (payload.idCardAttachmentId) {
      const attachment = await repo.getById('attachments', payload.idCardAttachmentId);
      if (!attachment || attachment.uploaderId !== session.userId || attachment.brandId !== brandId || attachment.bizType !== 'id_card' || attachment.scanStatus !== 'CLEAN') fail('实名附件不存在、尚未扫描或不属于本人');
      patch.idCardAttachmentId = attachment._id; patch.realnameStatus = 'PENDING';
    }
    const old = await repo.findOne('worker_profiles', { workerId: session.userId });
    if (old) { requireBrand(session, old.brandId || brandId); await repo.updateById('worker_profiles', old._id, patch); }
    else await repo.insert('worker_profiles', { _id: uuid('profile'), brandId, workerId: session.userId, ...patch, createdAt: now() });
    return api.getProfile(repo, {}, session);
  };
  api.uploadFile = async (repo, payload, session) => {
    const brandId = activeBrand(payload, session); const allowed = { id_card: ['WORKER'], complete_proof: ['WORKER'], dispute: ['CUSTOMER'], payout_receipt: ['ADMIN', 'FINANCE_REVIEWER', 'SUPER_ADMIN'] };
    if (!allowed[payload.bizType] || !roles(session).some((role) => allowed[payload.bizType].includes(role))) fail('无权限上传此类附件', 'FORBIDDEN');
    if (payload.bizId && payload.bizType !== 'id_card') {
      const order = await repo.getById('orders', payload.bizId); const owner = order && (payload.bizType === 'dispute' ? [session.userId, session.openid].includes(order.customerId) : order.workerId === session.userId);
      if (!owner || (order.brandId || 'default') !== brandId) fail('附件业务对象不存在或无权限', 'FORBIDDEN');
    }
    const file = validateAttachment(payload);
    if (!scanner) fail('恶意文件扫描服务尚未配置，上传暂不可用', 'ATTACHMENT_SCAN_UNAVAILABLE');
    let result; try { result = await scanner({ bytes: file.bytes, mimeType: file.mimeType, hash: file.hash }); } catch (_) { fail('文件扫描失败，请稍后重试', 'ATTACHMENT_SCAN_UNAVAILABLE'); }
    if (!result || result.clean !== true) fail('文件未通过安全扫描', 'ATTACHMENT_REJECTED');
    if (!storage || typeof storage.upload !== 'function') fail('私有附件存储尚未配置');
    const storageKey = `private/${brandId}/${payload.bizType}/${crypto.randomUUID()}.${file.ext}`;
    const uploaded = await storage.upload({ storageKey, bytes: file.bytes, mimeType: file.mimeType, private: true });
    if (!uploaded || !uploaded.fileID) fail('私有附件上传失败');
    const doc = await repo.insert('attachments', { _id: uuid('att'), brandId, bizType: payload.bizType, purpose: payload.bizType === 'payout_receipt' ? 'PAYOUT_RECEIPT' : payload.bizType.toUpperCase(), bizId: payload.bizId || '', uploaderId: session.userId, storageKey, fileID: uploaded.fileID, fileName: file.fileName, size: file.bytes.length, mimeType: file.mimeType, contentHash: file.hash, visibility: 'PRIVATE', storageVisibility: 'private', scanStatus: 'CLEAN', scannedAt: now(), uploadedAt: now() });
    return { _id: doc._id, attachmentId: doc._id, bizType: doc.bizType, fileName: doc.fileName, size: doc.size, scanStatus: doc.scanStatus };
  };
  api.getPrivateAttachmentUrl = async (repo, payload, session) => {
    requireUser(session); const attachment = await repo.getById('attachments', payload.attachmentId); if (!attachment) fail('附件不存在'); requireBrand(session, attachment.brandId);
    if (attachment.accessRevoked || attachment.scanStatus !== 'CLEAN' || attachment.visibility !== 'PRIVATE') fail('附件不可访问');
    if (attachment.uploaderId !== session.userId) {
      if (attachment.bizType === 'id_card') { await stepUp(repo, session, payload); if (String(payload.purpose || '').trim().length < 4) fail('请说明敏感附件查看用途'); }
      else { const order = await repo.getById('orders', attachment.bizId); if (!order || (![session.userId, session.openid].includes(order.customerId) && order.workerId !== session.userId && !roles(session).some((role) => ['CS', 'ADMIN', 'SUPER_ADMIN'].includes(role)))) fail('无权限查看附件', 'FORBIDDEN'); }
    }
    if (!storage || typeof storage.sign !== 'function') fail('私有附件签名服务尚未配置');
    const expiresAt = now() + 120000; const signed = await storage.sign({ fileID: attachment.fileID, expiresIn: 120, expiresAt });
    if (!signed || !/^https:\/\//.test(signed.url || '') || !signed.expiresAt || signed.expiresAt > expiresAt || signed.expiresAt <= now()) fail('附件短时签名无效');
    await audit(repo, 'PRIVATE_ATTACHMENT_VIEWED', attachment, session, payload.purpose || '查看本人业务附件');
    return { attachmentId: attachment._id, url: signed.url, expiresAt: signed.expiresAt };
  };
  return api;
}
module.exports = { PII_FIELDS, TYPES, keyConfig, encryptPii, decryptPii, blindIndex, encryptRecord, decryptRecord, redactPrivacy, protectRepository, protectLocalDatabase, asPrivacyRepository, validateAttachment, createPrivacyServices };
