import './helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { createMemoryDb, seedAdmin, seedCs, seedProduct, seedWorker, createPaidOrder } from './helpers.js';
import { insert } from '../src/db.js';
import {
  addVip,
  applyWithdrawal,
  assignOrder,
  createStaff,
  enterOrder,
  getWallet,
  listUsers,
  removeVip,
  reworkOrder,
  saveDict,
  saveProduct,
  updateConfigs,
  updateWorker,
} from '../src/services.js';

test('P1 配置进入执行链路：支付、入池、指派、补单与起提金额均使用后台配置', () => {
  const db = createMemoryDb();
  const admin = seedAdmin(db); const cs = seedCs(db); const worker = seedWorker(db, { realnameApproved: true });
  updateConfigs(db, { configs: { payTimeoutMinutes: 5, poolTimeoutMinutes: 6, assignTimeoutMinutes: 7, maxReworkCount: 2, minWithdrawFen: 5000 } }, admin.session);

  const product = seedProduct(db);
  const before = Date.now();
  const order = createPaidOrder(db, product);
  assert.ok(order.payDeadline - before <= 5 * 60 * 1000 + 1000);
  enterOrder(db, { orderId: order._id, game: 'lol', region: '一区', serviceType: '陪玩', customerUid: 'u1', customerNickname: '客户', expectStartAt: Date.now() }, cs.session);
  assert.equal(order.poolTimeoutMs, 6 * 60 * 1000);
  assignOrder(db, { orderId: order._id, workerId: worker.worker._id }, cs.session);
  assert.equal(order.assignmentTimeoutMs, 7 * 60 * 1000);

  order.status = 'PENDING_CONFIRM';
  reworkOrder(db, { orderId: order._id, note: '第一次' }, cs.session);
  order.status = 'PENDING_CONFIRM';
  reworkOrder(db, { orderId: order._id, note: '第二次' }, cs.session);
  order.status = 'PENDING_CONFIRM';
  assert.throws(() => reworkOrder(db, { orderId: order._id, note: '第三次' }, cs.session), /补单次数已达上限/);

  const wallet = getWallet(db, {}, worker.session);
  wallet.availableFen = 10000;
  assert.throws(() => applyWithdrawal(db, { amountFen: 3000 }, worker.session), /不能低于 50 元/);
  assert.equal(applyWithdrawal(db, { amountFen: 5000 }, worker.session).amountFen, 5000);
});

test('P1 员工管理支持 Worker/CS、停用和实名驳回原因', () => {
  const db = createMemoryDb();
  const admin = seedAdmin(db);
  const worker = createStaff(db, { role: 'WORKER', phone: '13900000001', password: 'WorkerStrong#123', nickname: '接单甲' }, admin.session);
  const cs = createStaff(db, { role: 'CS', phone: '13900000002', password: 'CsStrong#12345', nickname: '客服乙' }, admin.session);
  assert.equal(worker.role, 'WORKER');
  assert.equal(cs.role, 'CUSTOMER_SERVICE');
  assert.ok(db.wallets.some((wallet) => wallet.ownerId === worker._id));
  assert.throws(() => updateWorker(db, { workerId: worker._id, realnameStatus: 'REJECTED' }, admin.session), /驳回原因不能为空/);
  updateWorker(db, { workerId: worker._id, realnameStatus: 'REJECTED', realnameRejectReason: '证件照片模糊' }, admin.session);
  const listed = listUsers(db, {}, admin.session).find((item) => item._id === worker._id);
  assert.equal(listed.realnameRejectReason, '证件照片模糊');
});

test('P1 字典软停用、VIP 统一 vipId、后端红线最终校验', () => {
  const db = createMemoryDb();
  const admin = seedAdmin(db);
  const dict = saveDict(db, { type: 'game', code: 'lol', name: '英雄联盟', status: 'ACTIVE' }, admin.session);
  const disabled = saveDict(db, { type: 'game', code: 'lol', name: '英雄联盟', status: 'DISABLED' }, admin.session);
  assert.equal(disabled._id, dict._id);
  assert.equal(disabled.status, 'DISABLED');
  assert.equal(db.dicts.length, 1);

  const vip = addVip(db, { matchType: 'phone', matchKey: '13900000003' }, admin.session);
  removeVip(db, { vipId: vip._id }, admin.session);
  assert.equal(vip.status, 'INACTIVE');

  assert.throws(() => saveProduct(db, { title: '抽奖返现服务', priceFen: 1000, commission: { type: 'percent', valuePercent: 10 } }, admin.session), /禁用词/);
  assert.throws(() => saveDict(db, { type: 'service_type', code: 'bad', name: '赌博陪玩' }, admin.session), /禁用词/);
});
