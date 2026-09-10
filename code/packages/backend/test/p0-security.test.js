import './helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { createMemoryDb } from './helpers.js';
import { insert } from '../src/db.js';
import {
  listOrderMessages,
  reportOrders,
  reportProfit,
  reportWithdrawals,
  reportWorkers,
  sendOrderMessage,
} from '../src/services.js';

const scopedSession = (userId, role, brandScopes) => ({
  userId,
  role,
  roles: [role],
  brandScopes,
});

test('P0-01：接单人员只能读写自己的订单留言，平台管理员可访问全部品牌', () => {
  const db = createMemoryDb();
  const own = insert(db, 'orders', { brandId: 'brand-a', workerId: 'worker-a', status: 'IN_SERVICE', createdAt: 1 });
  const other = insert(db, 'orders', { brandId: 'brand-a', workerId: 'worker-b', status: 'IN_SERVICE', createdAt: 2 });
  const worker = scopedSession('worker-a', 'WORKER', ['brand-a']);

  sendOrderMessage(db, { orderId: own._id, content: '进度正常' }, worker);
  assert.equal(listOrderMessages(db, { orderId: own._id }, worker).length, 1);
  assert.throws(() => sendOrderMessage(db, { orderId: other._id, content: '越权留言' }, worker), /无权|FORBIDDEN/);
  assert.throws(() => listOrderMessages(db, { orderId: other._id }, worker), /无权|FORBIDDEN/);

  const superAdmin = scopedSession('root', 'SUPER_ADMIN', ['*']);
  sendOrderMessage(db, { orderId: other._id, content: '平台巡检' }, superAdmin);
  assert.equal(listOrderMessages(db, { orderId: other._id }, superAdmin).length, 1);
});

test('P0-01：品牌客服不能跨品牌读写订单留言', () => {
  const db = createMemoryDb();
  const brandBOrder = insert(db, 'orders', { brandId: 'brand-b', status: 'PENDING_ACCEPT', createdAt: 1 });
  const csA = scopedSession('cs-a', 'CUSTOMER_SERVICE', ['brand-a']);

  assert.throws(() => sendOrderMessage(db, { orderId: brandBOrder._id, content: '越权留言' }, csA), /BRAND_FORBIDDEN/);
  assert.throws(() => listOrderMessages(db, { orderId: brandBOrder._id }, csA), /BRAND_FORBIDDEN/);
});

test('P0-02：品牌报表仅汇总授权品牌，多品牌和平台范围按权限合并', () => {
  const db = createMemoryDb();
  insert(db, 'users', { _id: 'worker-a', role: 'WORKER', phone: '13000000001' });
  insert(db, 'users', { _id: 'worker-b', role: 'WORKER', phone: '13000000002' });
  insert(db, 'user_brand_roles', { userId: 'worker-a', brandId: 'brand-a', roles: ['WORKER'], status: 'ACTIVE' });
  insert(db, 'user_brand_roles', { userId: 'worker-b', brandId: 'brand-b', roles: ['WORKER'], status: 'ACTIVE' });
  const orderA = insert(db, 'orders', { brandId: 'brand-a', workerId: 'worker-a', status: 'SETTLED', earningsFen: 100, createdAt: 10, completedAt: 10 });
  const orderB = insert(db, 'orders', { brandId: 'brand-b', workerId: 'worker-b', status: 'SETTLED', earningsFen: 200, createdAt: 20, completedAt: 20 });
  insert(db, 'wallets', { _id: 'wallet-a', ownerId: 'worker-a', availableFen: 100, pendingWithdrawFen: 0, withdrawnFen: 0 });
  insert(db, 'wallets', { _id: 'wallet-b', ownerId: 'worker-b', availableFen: 200, pendingWithdrawFen: 0, withdrawnFen: 0 });
  insert(db, 'wallet_transactions', { walletId: 'wallet-a', accountId: 'worker-a', orderId: orderA._id, brandId: 'brand-a', type: 'ORDER_EARNINGS', amountFen: 100, createdAt: 10 });
  insert(db, 'wallet_transactions', { walletId: 'wallet-b', accountId: 'worker-b', orderId: orderB._id, brandId: 'brand-b', type: 'ORDER_EARNINGS', amountFen: 200, createdAt: 20 });
  insert(db, 'withdrawals', { workerId: 'worker-a', brandId: 'brand-a', amountFen: 50, status: 'PAID', createdAt: 10 });
  insert(db, 'withdrawals', { workerId: 'worker-b', brandId: 'brand-b', amountFen: 80, status: 'PAID', createdAt: 20 });

  const brandA = scopedSession('admin-a', 'BRAND_ADMIN', ['brand-a']);
  const brandAB = scopedSession('admin-ab', 'BRAND_ADMIN', ['brand-a', 'brand-b']);
  const platform = scopedSession('root', 'SUPER_ADMIN', ['*']);

  assert.equal(reportOrders(db, {}, brandA).total, 1);
  assert.deepEqual(reportWorkers(db, {}, brandA).map((row) => row.workerId), ['worker-a']);
  assert.deepEqual(reportWithdrawals(db, {}, brandA).map((row) => row.workerId), ['worker-a']);
  assert.equal(reportProfit(db, {}, brandA).earningsFen, 100);

  assert.equal(reportOrders(db, {}, brandAB).total, 2);
  assert.equal(reportWorkers(db, {}, brandAB).length, 2);
  assert.equal(reportProfit(db, {}, brandAB).earningsFen, 300);
  assert.equal(reportOrders(db, {}, platform).total, 2);
  assert.equal(reportWithdrawals(db, {}, platform).length, 2);

  assert.throws(() => reportOrders(db, { brandId: 'brand-b' }, brandA), /BRAND_FORBIDDEN/);
  assert.equal(reportOrders(db, { brandId: 'brand-a' }, brandAB).total, 1);
});
