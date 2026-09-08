import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';
import {
  createMemoryDb,
  seedAdmin,
  seedWorker,
  seedCs,
  seedProduct,
} from './helpers.js';
import {
  authLogin,
  workerLogin,
  changePassword,
  createWorker,
  freezeWallet,
  getWallet,
  walletTransactions,
  listWithdrawals,
  adjustWallet,
  applyWithdrawal,
  listWorkers,
  updateProfile,
  getProfile,
  listProducts,
  getProduct,
  saveProduct,
  updateProductStatus,
  getH5Product,
} from '../src/services.js';
import { issueH5Token } from '../src/token.js';

test('账号：authLogin/workerLogin 成功返回 token 与角色', () => {
  const db = createMemoryDb();
  seedAdmin(db);
  seedWorker(db);
  const admin = authLogin(db, { phone: '13800000000', password: 'admin123' });
  assert.equal(admin.role, 'ADMIN');
  assert.ok(admin.token);
  assert.equal(admin.user.passwordHash, undefined);
  const worker = workerLogin(db, { phone: '13800000001', password: 'worker123' });
  assert.equal(worker.user.role, 'WORKER');
  assert.ok(worker.token);
});

test('账号：createWorker 强制改密并自动建钱包', () => {
  const db = createMemoryDb();
  const { session } = seedAdmin(db);
  const worker = createWorker(db, { phone: '13800000001', initialPassword: 'worker123', nickname: '小王' }, session);
  assert.equal(worker.mustChangePwd, true);
  assert.equal(db.wallets.some((w) => w.ownerId === worker._id), true);
  const login = workerLogin(db, { phone: '13800000001', password: 'worker123' });
  assert.equal(login.mustChangePwd, true);
});

test('账号：连续 5 次密码错误锁定 30 分钟', () => {
  const db = createMemoryDb();
  seedAdmin(db, { password: 'admin123' });
  for (let i = 0; i < 5; i += 1) {
    assert.throws(() => authLogin(db, { phone: '13800000000', password: 'wrong' }), /手机号或密码错误/);
  }
  assert.throws(() => authLogin(db, { phone: '13800000000', password: 'admin123' }), /锁定/);
});

test('账号：changePassword 后旧密码失效并清除强制改密', () => {
  const db = createMemoryDb();
  const { session } = seedAdmin(db);
  const worker = createWorker(db, { phone: '13800000001', initialPassword: 'worker123' }, session);
  changePassword(db, { oldPassword: 'worker123', newPassword: 'newpass123' }, { userId: worker._id, role: 'WORKER' });
  assert.throws(() => workerLogin(db, { phone: '13800000001', password: 'worker123' }), /手机号或密码错误/);
  const login = workerLogin(db, { phone: '13800000001', password: 'newpass123' });
  assert.equal(login.mustChangePwd, false);
});

test('商品：上架商品在客户端列表，下架后不可见', () => {
  const db = createMemoryDb();
  const p = seedProduct(db);
  assert.equal(listProducts(db).length, 1);
  updateProductStatus(db, { productId: p._id, status: 'OFF' }, { userId: 'a', role: 'ADMIN' });
  assert.equal(listProducts(db).length, 0);
});

test('商品：getProduct 详情 + 按 id upsert', () => {
  const db = createMemoryDb();
  const p = seedProduct(db);
  assert.equal(getProduct(db, { productId: p._id }).title, '陪玩一小时');
  saveProduct(db, { id: p._id, title: '改名后', priceFen: 20000, commission: { type: 'fixed', valueFen: 500 } }, { userId: 'a', role: 'ADMIN' });
  assert.equal(getProduct(db, { productId: p._id }).title, '改名后');
  assert.equal(db.products.length, 1);
});

test('账号：freezeWallet 按 scope 冻结/解除并留痕', () => {
  const db = createMemoryDb();
  const { session } = seedAdmin(db);
  const w = seedWorker(db);
  const walletOf = () => db.wallets.find((x) => x.ownerId === w.worker._id);
  // BOTH：冻提现 + 冻接单
  freezeWallet(db, { workerId: w.worker._id, scope: 'BOTH' }, session);
  assert.equal(walletOf().freezeWithdrawal, true);
  assert.equal(walletOf().freezeAccept, true);
  // WITHDRAW：仅冻提现，接单解除
  freezeWallet(db, { workerId: w.worker._id, scope: 'WITHDRAW' }, session);
  assert.equal(walletOf().freezeWithdrawal, true);
  assert.equal(walletOf().freezeAccept, false);
  // NONE：全部解除
  freezeWallet(db, { workerId: w.worker._id, scope: 'NONE' }, session);
  assert.equal(walletOf().freezeWithdrawal, false);
  assert.equal(walletOf().freezeAccept, false);
  assert.equal(db.wallet_transactions.filter((t) => t.type === 'ADJUST').length, 3);
  assert.throws(() => freezeWallet(db, { workerId: w.worker._id, scope: 'BAD' }, session), /冻结范围/);
});

test('管理端：getWallet/walletTransactions/listWithdrawals 按 workerId 过滤', () => {
  const db = createMemoryDb();
  const admin = seedAdmin(db);
  const w1 = seedWorker(db, { realnameApproved: true });
  const w2 = seedWorker(db, { phone: '13800000009', realnameApproved: true });
  // ADMIN 查他人钱包（必传 workerId）
  const wallet = getWallet(db, { workerId: w1.worker._id }, admin.session);
  assert.equal(wallet.ownerId, w1.worker._id);
  assert.throws(() => getWallet(db, {}, admin.session), /workerId/);
  // 给 w1 调账后申请提现，用于验证提现列表过滤
  adjustWallet(db, { workerId: w1.worker._id, amountFen: 5000, reason: '调账' }, admin.session);
  applyWithdrawal(db, { amountFen: 1000 }, w1.session);
  assert.equal(listWithdrawals(db, {}, admin.session).length, 1);
  assert.equal(listWithdrawals(db, { workerId: w2.worker._id }, admin.session).length, 0);
  // ADMIN 查流水（必传 workerId）
  assert.throws(() => walletTransactions(db, {}, admin.session), /workerId/);
  assert.ok(walletTransactions(db, { workerId: w1.worker._id }, admin.session).length >= 1);
});

test('接单人员：getProfile 返回脱敏资料，listWorkers 客服可查（K-07）', () => {
  const db = createMemoryDb();
  seedAdmin(db);
  const cs = seedCs(db);
  const w = seedWorker(db);
  assert.equal(getProfile(db, {}, w.session), null); // 无资料 -> 空
  updateProfile(db, { withdrawWechat: 'wx-abc', realName: '张三', idCardAttachmentId: 'att-1' }, w.session);
  const p = getProfile(db, {}, w.session);
  assert.equal(p.realName, '张***');
  assert.equal(p.withdrawWechat, 'w***');
  assert.equal(p.hasIdCard, true);
  assert.equal(p.realnameStatus, 'PENDING');
  assert.equal(listWorkers(db, {}, cs.session).length, 1); // 客服可查
});

test('商品：H5 token 可换取商品与 openid', () => {
  const db = createMemoryDb();
  const p = seedProduct(db);
  const token = issueH5Token({ openid: 'mp-1', productId: p._id }, process.env.H5_TOKEN_SECRET);
  const res = getH5Product(db, { token });
  assert.equal(res.product._id, p._id);
  assert.equal(res.openid, 'mp-1');
});
