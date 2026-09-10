// 本地 HTTP API 服务器：镜像云函数 game-service 的 action 路由表。
// 路由对齐三端 apps/*/src/api.js 的 PATH 映射：admin 用 kebab 资源路径（权威），client/workbench 用统一 /api/<action>。
// 鉴权：Authorization: Bearer <session> 头解析会话（云函数侧为 data.token，见 docs/API.md）。

import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createMemoryDb } from '../packages/backend/src/db.js';
import * as services from '../packages/backend/src/services.js';
import { verifyInternalRequest } from '../packages/backend/src/internal-auth.js';
import Privacy from '../uniCloud-tcb/cloudfunctions/game-service/lib/privacy.cjs';

const PORT = Number(process.env.PORT) || 4176;
const HOST = process.env.HOST || '127.0.0.1';

// 全量 action 名（与 services.js 导出对齐），据此构建 action -> 处理函数映射。
const ACTIONS = [
  'miniLogin', 'oauthExchange', 'authLogin', 'workerLogin', 'changePassword', 'getAccessProfile', 'getRuntimeConfig',
  'getSecurityStatus', 'setupMfa', 'enableMfa', 'verifySecurityChallenge', 'revokeSessions', 'listLoginHistory', 'setAccountStatus', 'refreshSession',
  'listUsers', 'createStaff', 'createWorker', 'updateStaff', 'updateWorker', 'listUserBrandRoles', 'saveUserBrandRoles', 'listAuditLogs', 'freezeWallet', 'listWorkers',
  'listProducts', 'getProduct', 'listManagedProducts', 'getManagedProduct', 'saveProduct', 'updateProductStatus',
  'listDicts', 'saveDict', 'getConfigs', 'updateConfigs',
  'addVip', 'removeVip', 'listVips',
  'getBrandConfig', 'listBrands', 'saveBrandConfig',
  'h5Token', 'getH5Product', 'createOrderFromH5', 'revokeH5Token', 'getPaymentParams', 'confirmMockPayment', 'getPaymentStatus', 'listPayments', 'payNotify', 'transferNotify',
  'listMyOrders', 'getMyOrder', 'queryOrderByNo', 'submitDispute', 'requestSubscribe', 'listNotifications', 'markRead',
  'listOrders', 'getOrder', 'enterOrder', 'listOrderLogs', 'listPool', 'assignOrder', 'requestCancellation', 'requestRefund',
  'approveRefund', 'rejectRefund', 'verifyCompletion', 'rejectCompletion', 'closeOrder', 'confirmSettlement', 'reworkOrder',
  'listDisputes', 'getDispute', 'addDisputeEvidence', 'startDisputeReview', 'resolveDispute', 'closeDispute', 'sendOrderMessage', 'listOrderMessages',
  'grabOrder', 'releaseOrder', 'acceptAssignment', 'rejectAssignment', 'submitCompletion', 'listAssignments', 'reassignOrder',
  'getWallet', 'walletTransactions', 'listCommissionRules', 'saveCommissionRule', 'reconcileWalletLedger',
  'applyWithdrawal', 'listWithdrawals', 'startWithdrawalReview', 'approveWithdrawal', 'startWithdrawalPayment', 'failWithdrawalPayment', 'migrateWithdrawalStatuses',
  'updateProfile', 'getProfile', 'uploadFile', 'adjustWallet', 'markWithdrawalPaid', 'rejectWithdrawal',
  'getLegalDocuments', 'recordLegalConsent', 'withdrawLegalConsent', 'listMyDataRequests', 'requestDataRight', 'cancelDataRequest',
  'listDataRequests', 'reviewDataRequest', 'executeDataRequest', 'getMyDataCopy', 'viewSensitiveProfile', 'getPrivateAttachmentUrl',
  'runFinancialReconciliation', 'listReconciliationCases', 'resolveReconciliationCase', 'closeReconciliationCase', 'exportFinancialReconciliation',
  'compensatePayments',
  'listRecordsPage', 'listOperationalEvents', 'getOperationalHealth', 'runOperationalMonitor', 'getLaunchPolicy', 'updateLaunchPolicy',
  'reportOrders', 'reportWorkers', 'reportWithdrawals', 'reportProfit',
  'notify', 'sendCustomerServiceLink', 'timeoutCloseUnpaidOrders', 'timeoutMarkPool', 'timeoutRejectAssignments', 'dashboard',
];

// action -> 处理函数（仅用于 resolveAction 命中校验；实际调用走 services.dispatch 统一错误封套）。
const HANDLERS = Object.fromEntries(ACTIONS.map((a) => [a, services[a]]));

// {ok:false} 错误码 -> HTTP 状态码映射。
const HTTP_STATUS = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  CONFLICT: 409,
  INTERNAL: 500,
};

// 公开 action（无会话），与 services.js 的 PUBLIC_ACTIONS 保持一致。
const PUBLIC = new Set([
  'miniLogin', 'oauthExchange', 'authLogin', 'workerLogin',
  'listProducts', 'getProduct', 'getBrandConfig', 'queryOrderByNo',
  'getH5Product', 'createOrderFromH5', 'getPaymentStatus',
  'payNotify',
  'getLegalDocuments',
]);

const SYSTEM = new Set(['transferNotify', 'timeoutCloseUnpaidOrders', 'timeoutMarkPool', 'timeoutRejectAssignments', 'runOperationalMonitor', 'runFinancialReconciliation', 'compensatePayments']);

// admin 端 kebab 资源路径（以 apps/admin/src/api.js 的 PATH 表为准，权威）。
const ADMIN_PATHS = {
  'POST /api/auth/login': 'authLogin',
  'GET /api/dashboard': 'dashboard',
  'GET /api/workers': 'listWorkers',
  'POST /api/workers': 'createWorker',
  'POST /api/workers/update': 'updateWorker',
  'POST /api/wallets/adjust': 'adjustWallet',
  'POST /api/wallets/freeze': 'freezeWallet',
  'GET /api/wallets': 'getWallet',
  'GET /api/wallets/transactions': 'walletTransactions',
  'GET /api/vips': 'listVips',
  'POST /api/vips': 'addVip',
  'POST /api/vips/remove': 'removeVip',
  'GET /api/products': 'listProducts',
  'POST /api/products': 'saveProduct',
  'POST /api/products/status': 'updateProductStatus',
  'GET /api/dicts': 'listDicts',
  'POST /api/dicts': 'saveDict',
  'GET /api/configs': 'getConfigs',
  'POST /api/configs': 'updateConfigs',
  'GET /api/withdrawals': 'listWithdrawals',
  'POST /api/withdrawals/mark-paid': 'markWithdrawalPaid',
  'POST /api/withdrawals/review': 'startWithdrawalReview',
  'POST /api/withdrawals/approve': 'approveWithdrawal',
  'POST /api/withdrawals/start-payment': 'startWithdrawalPayment',
  'POST /api/withdrawals/fail-payment': 'failWithdrawalPayment',
  'POST /api/withdrawals/reject': 'rejectWithdrawal',
  'GET /api/orders': 'listOrders',
  'POST /api/refunds/approve': 'approveRefund',
  'POST /api/refunds/reject': 'rejectRefund',
  'POST /api/h5-links/send': 'sendCustomerServiceLink',
  'POST /api/h5-links/revoke': 'revokeH5Token',
  'GET /api/reports/orders': 'reportOrders',
  'GET /api/reports/workers': 'reportWorkers',
  'GET /api/reports/withdrawals': 'reportWithdrawals',
  'GET /api/reports/profit': 'reportProfit',
  'GET /api/brands': 'listBrands',
  'POST /api/brands': 'saveBrandConfig',
};

function json(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,x-device-id,x-request-id,x-idempotency-key,idempotency-key,x-internal-timestamp,x-internal-nonce,x-internal-signature',
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const contentType = req.headers['content-type'] || '';
      try {
        if (contentType.includes('multipart/form-data')) {
          resolve(parseMultipart(buffer, contentType));
        } else {
          resolve(buffer.length ? JSON.parse(buffer.toString('utf8')) : {});
        }
      } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// 最小 multipart 解析：附件内容以 Base64 交给统一扫描、私有存储流程，不写入本地磁盘。
function parseMultipart(buffer, contentType) {
  const m = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  const boundary = m ? (m[1] || m[2]).trim() : '';
  const out = {};
  if (!boundary) return out;
  const text = buffer.toString('latin1');
  for (const part of text.split(`--${boundary}`)) {
    const idx = part.indexOf('\r\n\r\n');
    if (idx === -1) continue;
    const header = part.slice(0, idx);
    const body = part.slice(idx + 4).replace(/\r\n$/, '');
    const nameM = header.match(/name="([^"]+)"/);
    if (!nameM) continue;
    const filenameM = header.match(/filename="([^"]+)"/);
    if (filenameM) {
      const bytes = Buffer.from(body, 'latin1');
      const contentTypeMatch = header.match(/Content-Type:\s*([^\r\n]+)/i);
      out[nameM[1]] = { fileName: filenameM[1], size: bytes.length, mimeType: contentTypeMatch?.[1]?.trim() || '', content: bytes.toString('base64') };
    } else {
      out[nameM[1]] = body;
    }
  }
  return {
    bizType: out.bizType || '',
    fileName: (out.file && out.file.fileName) || '',
    size: (out.file && out.file.size) || 0,
    mimeType: (out.file && out.file.mimeType) || '',
    content: (out.file && out.file.content) || '',
    bizId: out.bizId || '',
    brandId: out.brandId || '',
  };
}

// 从 Authorization 头解析会话；无效/缺失返回 null。
function parseSession(req) {
  const m = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try {
    return services.verifySessionToken(m[1], services.getSessionSecret());
  } catch {
    return null;
  }
}

function verifySystemSession(req, action, payload, db) {
  const internal = verifyInternalRequest({
    action,
    payload,
    secret: process.env.INTERNAL_SECRET,
    auth: {
      timestamp: req.headers['x-internal-timestamp'],
      nonce: req.headers['x-internal-nonce'],
      signature: req.headers['x-internal-signature'],
    },
  });
  if (db.system_nonces.some((row) => row._id === internal.nonce)) throw new Error('内部请求已重放');
  db.system_nonces.push({ _id: internal.nonce, action, timestamp: internal.timestamp, expiresAt: internal.expiresAt, createdAt: Date.now() });
  return { userId: 'internal-system', role: 'SYSTEM', roles: ['SYSTEM'], brandScopes: ['*'], internalNonce: internal.nonce };
}

// 解析路由：admin kebab 优先，其次统一 /api/<action>（client/workbench）。
function resolveAction(method, path) {
  const key = `${method} ${path}`;
  if (ADMIN_PATHS[key]) return ADMIN_PATHS[key];
  const m = path.match(/^\/api\/([^/]+)$/);
  if (m && HANDLERS[m[1]]) return m[1];
  return null;
}

// 把 query 字符串值做轻量类型化（数字/布尔）。
function coerce(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value !== '' && !Number.isNaN(Number(value))) return Number(value);
  return value;
}

export async function startApiServer({ port = 0, seed = false, host = '127.0.0.1' } = {}) {
  const db = createMemoryDb();
  if (seed) seedDb(db);
  Privacy.protectLocalDatabase(db, process.env);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const path = url.pathname;
    const method = req.method;
    try {
      if (method === 'OPTIONS') {
        res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,authorization,x-device-id,x-request-id,x-idempotency-key,idempotency-key,x-internal-timestamp,x-internal-nonce,x-internal-signature' });
        res.end();
        return;
      }
      const body = method === 'POST' ? await readBody(req) : {};
      const query = {};
      for (const [k, v] of url.searchParams) query[k] = coerce(v);

      const action = resolveAction(method, path);
      if (!action) return json(res, 404, { ok: false, code: 'NOT_FOUND', message: 'not found', path });

      const headerIdempotencyKey = req.headers['x-idempotency-key'] || req.headers['idempotency-key'];
      const payload = method === 'GET'
        ? query
        : { ...query, ...body, ...(headerIdempotencyKey && !body.idempotencyKey ? { idempotencyKey: headerIdempotencyKey } : {}) };
      const isPublic = PUBLIC.has(action);
      let session = isPublic ? null : parseSession(req);
      if (SYSTEM.has(action)) {
        try { session = verifySystemSession(req, action, payload, db); }
        catch (error) { return json(res, 401, { ok: false, code: 'UNAUTHORIZED', message: error.message || '非法系统任务调用' }); }
      }
      const context = {
        sourceIp: req.socket.remoteAddress || '',
        deviceId: String(req.headers['x-device-id'] || '').slice(0, 128),
        requestId: String(req.headers['x-request-id'] || payload.requestId || '').slice(0, 80),
      };
      const result = await services.dispatch(db, action, payload, session, context);
      if (result && result.ok === false) {
        return json(res, HTTP_STATUS[result.code] || 400, result);
      }
      Privacy.protectLocalDatabase(db, process.env);
      return json(res, 200, Privacy.redactPrivacy(result));
    } catch (error) {
      // 非业务异常（JSON 解析失败等）兜底 500。
      return json(res, 500, { ok: false, code: 'INTERNAL', message: String(error.message || error) });
    }
  });

  await new Promise((resolve) => server.listen(port, host, resolve));
  const actualPort = server.address().port;
  return { port: actualPort, host, db, close: () => new Promise((resolve) => server.close(resolve)) };
}

// 种子数据：admin/cs/worker + 上架商品 + 一条 H5 下单链路。
function seedDb(db) {
  const admin = services.createStaff(db, { role: 'ADMIN', phone: '13800000000', password: 'admin123', nickname: '管理员' }, { userId: 'seed', role: 'ADMIN' });
  const cs = services.createStaff(db, { role: 'CUSTOMER_SERVICE', phone: '13800000002', password: 'cs123', nickname: '客服小美' }, { userId: 'seed', role: 'ADMIN' });
  const worker = services.createWorker(db, { phone: '13800000001', initialPassword: 'worker123', nickname: '接单员小王' }, { userId: 'seed', role: 'ADMIN' });
  // 接单人员实名通过，便于提现冒烟。
  services.updateProfile(db, { realName: '王小明', idCardAttachmentId: 'att-1' }, { userId: worker._id, role: 'WORKER' });
  services.updateWorker(db, { workerId: worker._id, realnameStatus: 'APPROVED' }, { userId: admin._id, role: 'ADMIN' });
  services.saveBrandConfig(db, {
    brandId: 'demo-a', code: 'demo-a', appId: 'wx-demo-a', name: '星河服务', isDefault: true, status: 'ON',
    themeTokens: { primary: '#5b6cff', secondary: '#34c6ad', bg: '#f4f6ff', text: '#1d2440' },
    copy: { headerTitle: '星河精选服务', searchPlaceholder: '搜索星河服务' },
    contactConfig: { serviceWechat: 'xinghe-service', serviceHours: '09:00-22:00' },
    assetConfig: { banners: ['/static/default-banner.svg'], defaultProductImage: '/static/default-product.svg' },
  }, { userId: admin._id, role: 'ADMIN' });
  services.saveUserBrandRoles(db, { userId: cs._id, brandId: 'demo-a', roles: ['CUSTOMER_SERVICE'] }, { userId: admin._id, role: 'ADMIN' });
  services.saveUserBrandRoles(db, { userId: cs._id, brandId: 'demo-b', roles: ['CUSTOMER_SERVICE'] }, { userId: admin._id, role: 'ADMIN' });
  services.saveUserBrandRoles(db, { userId: worker._id, brandId: 'demo-a', roles: ['WORKER'] }, { userId: admin._id, role: 'ADMIN' });
  services.saveUserBrandRoles(db, { userId: worker._id, brandId: 'demo-b', roles: ['WORKER'] }, { userId: admin._id, role: 'ADMIN' });
  services.saveBrandConfig(db, {
    brandId: 'demo-b', code: 'demo-b', appId: 'wx-demo-b', name: '青岚服务', status: 'ON',
    themeTokens: { primary: '#158f70', secondary: '#4cb7a5', bg: '#f1faf7', text: '#17352d' },
    copy: { headerTitle: '青岚品质服务', searchPlaceholder: '搜索青岚服务' },
    contactConfig: { serviceWechat: 'qinglan-service', serviceHours: '10:00-23:00' },
  }, { userId: admin._id, role: 'ADMIN' });
  const product = services.saveProduct(db, { title: '峡谷陪玩一小时', game: 'lol', serviceType: 'companion', tierName: '轻松局', guaranteedOutput: 10, outputUnit: '局', priceFen: 10000, images: ['/static/reference-assets/product-card-1.png'], description: '一对一沟通需求，按约定时间提供陪玩服务，全程可查看订单进度。', status: 'ON', sort: 0, brandId: 'demo-a', commission: { type: 'percent', valuePercent: 20 } }, { userId: admin._id, role: 'ADMIN' });
  const demoProducts = [
    { title: '双排默契进阶套餐', game: 'lol', serviceType: 'companion', tierName: '热门', guaranteedOutput: 5, outputUnit: '局', priceFen: 12800, images: ['/static/reference-assets/product-card-2.png'], sort: 9 },
    { title: '王者排位协作服务', game: 'wangzhe', serviceType: 'team', tierName: '推荐', guaranteedOutput: 6, outputUnit: '局', priceFen: 15800, images: ['/static/reference-assets/category-product-1.png'], sort: 8 },
    { title: '新手一对一教学指导', game: 'wangzhe', serviceType: 'training', tierName: '新客', guaranteedOutput: 1, outputUnit: '小时', priceFen: 8800, images: ['/static/reference-assets/category-product-2.png'], sort: 7 },
    { title: '三角洲组队协作套餐', game: 'delta', serviceType: 'team', tierName: '精选', guaranteedOutput: 4, outputUnit: '局', priceFen: 16800, images: ['/static/reference-assets/category-product-3.png'], sort: 6 },
    { title: '无畏契约战术教学', game: 'valorant', serviceType: 'training', tierName: '进阶', guaranteedOutput: 1, outputUnit: '小时', priceFen: 19800, images: ['/static/reference-assets/category-product-4.png'], sort: 5 },
  ];
  for (const item of demoProducts) services.saveProduct(db, { ...item, description: '专业服务人员在线沟通，按订单约定完成服务并提供售后支持。', status: 'ON', brandId: 'demo-a', commission: { type: 'percent', valuePercent: 20 } }, { userId: admin._id, role: 'ADMIN' });
  services.saveProduct(db, { title: '青岚双人协作', game: 'lol', serviceType: 'companion', tierName: '进阶', guaranteedOutput: 5, outputUnit: '局', priceFen: 12800, status: 'ON', brandId: 'demo-b', commission: { type: 'percent', valuePercent: 20 } }, { userId: admin._id, role: 'ADMIN' });
  const customer = services.miniLogin(db, { code: 'seed-c1' });
  const customerSession = services.verifySessionToken(customer.token, services.getSessionSecret());
  const token = services.h5Token(db, { productId: product._id }, customerSession);
  const order = services.createOrderFromH5(db, { h5Token: token.token, contactWechat: 'wx-c1' });
  services.payNotify(db, { orderId: order.orderId, transactionId: 'seed-txn-1' });
  return { admin, worker, product };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const smoke = process.argv.includes('--smoke');
  const server = await startApiServer({ port: PORT, seed: !smoke, host: HOST });
  console.log(`[api-server] listening on http://${server.host}:${server.port}${smoke ? ' (smoke)' : ''}`);
  if (smoke) {
    setTimeout(() => { server.close().then(() => process.exit(0)); }, 200);
  }
}
