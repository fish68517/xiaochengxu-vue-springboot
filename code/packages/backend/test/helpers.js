// 测试公共工具：注入本地 secret（fail-closed 环境）+ 种子函数与订单链路构造。
// 各测试文件首行 import './helpers.js' 即完成环境注入（node --test 每文件独立进程）。

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';
process.env.H5_TOKEN_SECRET = process.env.H5_TOKEN_SECRET || 'test-h5-secret';

import { createMemoryDb, insert } from '../src/db.js';
import {
  hashPassword,
  createWorker,
  saveProduct,
  updateWorker,
  h5Token,
  createOrderFromH5,
  payNotify,
  enterOrder,
  grabOrder,
  getWallet,
} from '../src/services.js';

export { createMemoryDb };

// 种子管理员（直接落库，规避"创建管理员需管理员"）。
export function seedAdmin(db, { phone = '13800000000', password = 'admin123', nickname = '管理员' } = {}) {
  const admin = insert(db, 'users', {
    role: 'ADMIN', phone, passwordHash: hashPassword(password), nickname, status: 'ACTIVE', createdAt: Date.now(), updatedAt: Date.now(),
  });
  return { admin, session: { userId: admin._id, role: 'ADMIN' } };
}

// 种子接单人员（含钱包；可选实名通过）。
export function seedWorker(db, { phone = '13800000001', password = 'worker123', nickname = '小王', realnameApproved = false } = {}) {
  const worker = insert(db, 'users', {
    role: 'WORKER', phone, passwordHash: hashPassword(password), nickname, acceptEnabled: true, status: 'ACTIVE', createdAt: Date.now(), updatedAt: Date.now(),
  });
  const session = { userId: worker._id, role: 'WORKER' };
  getWallet(db, {}, session); // 建钱包
  if (realnameApproved) {
    insert(db, 'worker_profiles', { workerId: worker._id, realnameStatus: 'APPROVED', createdAt: Date.now(), updatedAt: Date.now() });
  }
  return { worker, session };
}

// 种子客服。
export function seedCs(db, { phone = '13800000002', password = 'cs123', nickname = '客服' } = {}) {
  const cs = insert(db, 'users', {
    role: 'CUSTOMER_SERVICE', phone, passwordHash: hashPassword(password), nickname, status: 'ACTIVE', createdAt: Date.now(), updatedAt: Date.now(),
  });
  return { cs, session: { userId: cs._id, role: 'CUSTOMER_SERVICE' } };
}

// 种子商品（走 saveProduct action，需 ADMIN 会话）。
export function seedProduct(db, overrides = {}) {
  return saveProduct(db, {
    title: '陪玩一小时',
    game: 'lol',
    serviceType: 'companion',
    tierName: '青铜',
    guaranteedOutput: 10,
    outputUnit: '局',
    priceFen: 10000,
    status: 'ON',
    commission: { type: 'percent', valuePercent: 20 },
    ...overrides,
  }, { userId: 'seed-admin', role: 'ADMIN' });
}

// 客户会话（openid 即订单中心身份）。
export const customerSession = (openid, brandId = 'default') => ({
  userId: openid,
  role: 'CUSTOMER',
  roles: ['CUSTOMER'],
  brandScopes: [brandId],
});

// 生成 H5 下单 token（绑定 openid + productId）。
export function issueOrderToken(db, productId, openid = 'mp-c1') {
  const product = db.products.find((item) => item._id === productId);
  return h5Token(db, { productId }, customerSession(openid, product?.brandId || 'default')).token;
}

// 创建并支付订单，返回订单（status=PENDING_ACCEPT）。
export function createPaidOrder(db, product, { openid = 'mp-c1', contactWechat = 'wx-c1', contactPhone = '' } = {}) {
  const token = issueOrderToken(db, product._id, openid);
  const created = createOrderFromH5(db, { h5Token: token, contactWechat, contactPhone });
  payNotify(db, { orderId: created.orderId, transactionId: `txn-${created.orderId}` });
  return db.orders.find((o) => o._id === created.orderId);
}

// 录入进池（CS），返回订单（PENDING_GRAB）。
export function enterPool(db, order, csSession) {
  enterOrder(db, {
    orderId: order._id,
    game: 'lol',
    region: '艾欧尼亚',
    serviceType: 'companion',
    customerUid: 'uid-1',
    customerNickname: '峡谷先锋',
    expectStartAt: Date.now(),
  }, csSession);
  return db.orders.find((o) => o._id === order._id);
}

// 抢单进入服务中（WORKER），返回订单（IN_SERVICE）。
export function grabToService(db, order, workerSession) {
  grabOrder(db, { orderId: order._id }, workerSession);
  return db.orders.find((o) => o._id === order._id);
}

export { hashPassword };
