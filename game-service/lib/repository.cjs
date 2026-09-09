'use strict';
// 仓储抽象(T0-03):统一 _id 为业务主键,服务层显式传 _id=newId();getById/updateById 只认 _id,删除 _id||id 双匹配。
// 提供内存与 uniCloud 两种实现,事务(transaction)支持多集合与条件更新(updateWhere)。

// 生成业务主键:服务层 insert 时显式写入 _id。
function newId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createMemoryRepository() {
  const store = new Map();
  const coll = (name) => {
    if (!store.has(name)) store.set(name, []);
    return store.get(name);
  };
  return {
    async queryPage(name, { where = {}, afterId = '', limit = 50 } = {}) {
      const size = Math.max(1, Math.min(200, Number(limit) || 50));
      const rows = coll(name).filter(doc => Object.entries(where).every(([k, v]) => doc[k] === v) && (!afterId || doc._id > afterId)).sort((a, b) => a._id < b._id ? -1 : 1);
      return { items: rows.slice(0, size), hasMore: rows.length > size };
    },
    async find(name, where = {}) {
      return coll(name).filter((doc) => Object.entries(where).every(([k, v]) => doc[k] === v));
    },
    async findOne(name, where = {}) {
      return coll(name).find((doc) => Object.entries(where).every(([k, v]) => doc[k] === v)) || null;
    },
    // 只按 _id 匹配(T0-03 删双匹配)
    async getById(name, id) {
      return coll(name).find((doc) => doc._id === id) || null;
    },
    // insert 显式 _id:业务主键即 _id
    async insert(name, doc) {
      const item = { _id: doc._id || newId(name), ...doc };
      if (coll(name).some(row => row._id === item._id)) throw new Error('CONFLICT: duplicate _id');
      coll(name).push(item);
      return item;
    },
    async updateById(name, id, patch) {
      const item = coll(name).find((doc) => doc._id === id);
      if (!item) return null;
      Object.assign(item, patch);
      return item;
    },
    // 条件更新:返回影响行数(抢单/关单/审批用「影响行数=1」判成功)
    async updateWhere(name, where, patch) {
      let updated = 0;
      for (const doc of coll(name)) {
        if (Object.entries(where).every(([k, v]) => doc[k] === v)) {
          Object.assign(doc, patch);
          updated += 1;
        }
      }
      return { updated };
    },
    // 幂等键辅助:where 命中返回已有文档,否则插入(T0-04 支付/退款流水号去重)
    async insertIfAbsent(name, where, doc) {
      const existed = await this.findOne(name, where);
      if (existed) return { created: false, doc: existed };
      const created = await this.insert(name, doc);
      return { created: true, doc: created };
    },
    // 事务:内存版快照回滚
    async transaction(fn) {
      const backup = new Map();
      for (const key of store.keys()) backup.set(key, store.get(key).map((doc) => ({ ...doc })));
      try {
        return await fn(this);
      } catch (e) {
        store.clear();
        for (const [key, docs] of backup) store.set(key, docs);
        throw e;
      }
    },
  };
}

function createUniCloudRepository(db) {
  const collection = (name) => db.collection(name);
  const normGet = (res) => {
    if (Array.isArray(res.data)) return res.data;
    if (res.data && typeof res.data === 'object') return [res.data];
    return [];
  };
  return {
    async queryPage(name, { where = {}, afterId = '', limit = 50 } = {}) {
      const size = Math.max(1, Math.min(200, Number(limit) || 50));
      const filter = { ...where };
      if (afterId) filter._id = db.command.gt(afterId);
      const rows = normGet(await collection(name).where(filter).orderBy('_id', 'asc').limit(size + 1).get());
      return { items: rows.slice(0, size), hasMore: rows.length > size };
    },
    async find(name, where = {}) {
      const res = await collection(name).where(where).get();
      return normGet(res);
    },
    async findOne(name, where = {}) {
      const res = await collection(name).where(where).limit(1).get();
      return normGet(res)[0] || null;
    },
    async getById(name, id) {
      const res = await collection(name).doc(id).get();
      return normGet(res)[0] || null;
    },
    // add 显式传 _id(T0-03 方案 A)
    async insert(name, doc) {
      const res = await collection(name).add({ _id: doc._id || newId(name), ...doc });
      return { _id: res.id || doc._id, ...doc };
    },
    async updateById(name, id, patch) {
      const { _id, ...rest } = patch || {}; // 剥离 _id:主键不可更新
      await collection(name).doc(id).update(rest);
      return this.getById(name, id);
    },
    async updateWhere(name, where, patch) {
      const { _id, ...rest } = patch || {};
      const res = await collection(name).where(where).update(rest);
      return { updated: res.updated || 0 };
    },
    async insertIfAbsent(name, where, doc) {
      const existed = await this.findOne(name, where);
      if (existed) return { created: false, doc: existed };
      const created = await this.insert(name, doc);
      return { created: true, doc: created };
    },
    // 事务:优先 startTransaction,否则 runTransaction;事务内仓储支持跨集合条件更新
    async transaction(fn) {
      if (typeof db.startTransaction === 'function') {
        const transaction = await db.startTransaction();
        try {
          const tr = createUniCloudRepository({ collection: (n) => transaction.collection(n), command: db.command });
          const result = await fn(tr);
          await transaction.commit();
          return result;
        } catch (e) {
          try { await transaction.rollback(); } catch (_) { /* 回滚失败忽略,原异常上抛 */ }
          throw e;
        }
      }
      return db.runTransaction(async (transaction) => {
        const tr = createUniCloudRepository({ collection: (n) => transaction.collection(n), command: db.command });
        return fn(tr);
      });
    },
  };
}

module.exports = { createMemoryRepository, createUniCloudRepository, newId };
