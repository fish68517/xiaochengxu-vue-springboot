// 内存数据层：镜像 uniCloud 集合，供本地测试替身与 api-server 使用。
// 约定（对齐 docs/PHASE3-实施计划.md §A）：金额单位「分」；时间字段毫秒时间戳；
// 主键统一 _id（T0-03 方案 A，newId 直接作 _id，无冗余 id 字段）。
// 事务为内存模拟：提交前不落任何状态，失败整体回滚（见 transaction）。

// 集合清单，与 uniCloud-tcb/database/*.schema.json 一一对应。
export const COLLECTIONS = [
  'users',
  'customers',
  'vip_list',
  'products',
  'commission_rules',
  'dicts',
  'configs',
  'orders',
  'payments',
  'assignments',
  'order_logs',
  'order_messages',
  'worker_profiles',
  'wallets',
  'wallet_transactions',
  'withdrawals',
  'transfer_records',
  'refunds',
  'disputes',
  'attachments',
  'subscribe_quota',
  'notifications',
  'brands',
  'brand_config_versions',
  'user_brand_roles',
  'audit_logs',
  'h5_token_revocations',
  'system_nonces',
];

// 集合 -> 主键前缀（newId 生成 _id 用）。
const ID_PREFIX = {
  users: 'user',
  customers: 'customer',
  vip_list: 'vip',
  products: 'product',
  commission_rules: 'commissionRule',
  dicts: 'dict',
  configs: 'config',
  orders: 'order',
  payments: 'payment',
  assignments: 'assignment',
  order_logs: 'orderLog',
  order_messages: 'orderMsg',
  worker_profiles: 'workerProfile',
  wallets: 'wallet',
  wallet_transactions: 'walletTx',
  withdrawals: 'withdrawal',
  transfer_records: 'transfer',
  refunds: 'refund',
  disputes: 'dispute',
  attachments: 'attachment',
  subscribe_quota: 'subscribeQuota',
  notifications: 'notification',
  brands: 'brand',
  brand_config_versions: 'brandConfigVersion',
  user_brand_roles: 'userBrandRole',
  audit_logs: 'auditLog',
  h5_token_revocations: 'h5TokenRevocation',
  system_nonces: 'systemNonce',
};

// 深拷贝：内存事务回滚与快照用（数据均为 JSON 可序列化对象）。
function clone(value) {
  if (value === undefined) return undefined;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

// 创建空内存库：集合数组 + 主键序号计数器。
export function createMemoryDb() {
  const db = { seq: {} };
  for (const name of COLLECTIONS) db[name] = [];
  return db;
}

// 生成主键 _id（按前缀自增，全局唯一）。
export function newId(db, prefix) {
  db.seq[prefix] = (db.seq[prefix] || 0) + 1;
  return `${prefix}-${db.seq[prefix]}`;
}

// 按 _id 查单条（未命中返回 undefined）。
export function getById(db, collection, id) {
  return db[collection].find((item) => item._id === id);
}

// 按谓词查单条。
export function findOne(db, collection, predicate) {
  return db[collection].find(predicate);
}

// 判断谓词是否命中任意一条（幂等键等场景）。
export function existsBy(db, collection, predicate) {
  return db[collection].some(predicate);
}

// 插入文档；未显式给 _id 时按集合前缀自动生成。
export function insert(db, collection, doc) {
  if (!doc._id) doc._id = newId(db, ID_PREFIX[collection] || collection);
  db[collection].push(doc);
  return doc;
}

// 按 _id 更新，返回更新后的文档（未命中返回 null）。
export function updateById(db, collection, id, patch) {
  const item = db[collection].find((x) => x._id === id);
  if (!item) return null;
  Object.assign(item, patch);
  return item;
}

// 条件更新：对所有命中谓词的文档合并 patch，返回影响行数。
export function updateWhere(db, collection, predicate, patch) {
  let affected = 0;
  for (const item of db[collection]) {
    if (predicate(item)) {
      Object.assign(item, patch);
      affected += 1;
    }
  }
  return affected;
}

// 条件删除：删除所有命中谓词的文档，返回删除行数。
export function removeWhere(db, collection, predicate) {
  const before = db[collection].length;
  db[collection] = db[collection].filter((item) => !predicate(item));
  return before - db[collection].length;
}

// 钱包乐观锁条件更新：版本不匹配返回 0（冲突），匹配则执行 mutator 并自增版本。
export function updateWalletVersioned(db, walletId, expectedVersion, mutator) {
  const wallet = db.wallets.find((w) => w._id === walletId);
  if (!wallet) throw new Error('钱包不存在');
  if (wallet.version !== expectedVersion) return 0;
  mutator(wallet);
  wallet.version += 1;
  wallet.updatedAt = Date.now();
  return 1;
}

// 快照全部集合 + 序号，供事务回滚。
function snapshotAll(db) {
  const snap = { seq: { ...db.seq } };
  for (const name of COLLECTIONS) snap[name] = db[name].map(clone);
  return snap;
}

// 从快照恢复全部集合 + 序号。
function restoreAll(db, snap) {
  db.seq = { ...snap.seq };
  for (const name of COLLECTIONS) db[name] = snap[name].map(clone);
}

// 内存事务：fn({ db }) 同步执行；抛错则整体回滚到调用前状态（模拟原子性）。
export function transaction(db, fn) {
  const snapshot = snapshotAll(db);
  try {
    return fn({ db });
  } catch (err) {
    restoreAll(db, snapshot);
    throw err;
  }
}
