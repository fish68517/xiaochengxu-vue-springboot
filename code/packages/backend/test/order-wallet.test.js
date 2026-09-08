import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';
import {
  createMemoryDb,
  seedAdmin,
  seedWorker,
  seedCs,
  seedProduct,
  issueOrderToken,
  createPaidOrder,
  enterPool,
  grabToService,
} from './helpers.js';
import {
  createOrderFromH5,
  listMyOrders,
  queryOrderByNo,
  payNotify,
  enterOrder,
  getOrder,
  grabOrder,
  submitCompletion,
  verifyCompletion,
  confirmSettlement,
  requestCancellation,
  approveRefund,
  timeoutCloseUnpaidOrders,
  getWallet,
  applyWithdrawal,
  startWithdrawalReview,
  approveWithdrawal as approveWithdrawalRequest,
  startWithdrawalPayment,
  markWithdrawalPaid,
} from '../src/services.js';

test('订单：H5 下单支付后进入待受理，快照抽成', () => {
  const db = createMemoryDb();
  seedAdmin(db); seedCs(db); seedWorker(db);
  const p = seedProduct(db);
  const token = issueOrderToken(db, p._id);
  const created = createOrderFromH5(db, { h5Token: token, contactWechat: 'wx-c1' });
  assert.equal(created.amountFen, 10000);
  payNotify(db, { orderId: created.orderId, transactionId: 'txn-1' });
  const order = db.orders.find((o) => o._id === created.orderId);
  assert.equal(order.status, 'PENDING_ACCEPT');
  assert.deepEqual(order.commission, { type: 'percent', valuePercent: 20 });
});

test('订单：createOrderFromH5 将 formSchema 动态字段拍平落 formData', () => {
  const db = createMemoryDb();
  seedAdmin(db); seedCs(db); seedWorker(db);
  const p = seedProduct(db);
  const token = issueOrderToken(db, p._id, 'mp-c1');
  const created = createOrderFromH5(db, { h5Token: token, contactWechat: 'wx-c1', zone: '艾欧尼亚', roleName: '峡谷先锋', server: '一区' });
  const order = db.orders.find((o) => o._id === created.orderId);
  assert.deepEqual(order.formData, { zone: '艾欧尼亚', roleName: '峡谷先锋', server: '一区' });
});

test('订单：录入进池后抢单先到先得', () => {
  const db = createMemoryDb();
  seedAdmin(db); const cs = seedCs(db);
  const w1 = seedWorker(db);
  const w2 = seedWorker(db, { phone: '13800000009', nickname: '小李' });
  const p = seedProduct(db);
  const order = enterPool(db, createPaidOrder(db, p), cs.session);
  assert.equal(order.status, 'PENDING_GRAB');
  grabOrder(db, { orderId: order._id }, w1.session);
  assert.equal(db.orders[0].workerId, w1.worker._id);
  assert.equal(db.orders[0].status, 'IN_SERVICE');
  assert.throws(() => grabOrder(db, { orderId: order._id }, w2.session), /CONFLICT|待抢单/);
});

test('订单：完成申请 + 结单入账佣金', () => {
  const db = createMemoryDb();
  seedAdmin(db); const cs = seedCs(db); const w = seedWorker(db);
  const p = seedProduct(db);
  const order = grabToService(db, enterPool(db, createPaidOrder(db, p), cs.session), w.session);
  submitCompletion(db, { orderId: order._id, actualOutput: 10, attachmentIds: ['att-1'] }, w.session);
  assert.equal(db.orders[0].status, 'PENDING_CONFIRM');
  verifyCompletion(db, { orderId: order._id }, cs.session);
  confirmSettlement(db, { orderId: order._id, customerConfirmed: true }, cs.session);
  assert.equal(db.orders[0].status, 'SETTLED');
  assert.equal(db.orders[0].earningsFen, 2000);
  assert.equal(getWallet(db, {}, w.session).availableFen, 2000);
});

test('订单：接单权限关闭不能抢单', () => {
  const db = createMemoryDb();
  seedAdmin(db); const cs = seedCs(db); const w = seedWorker(db);
  const p = seedProduct(db);
  const order = enterPool(db, createPaidOrder(db, p), cs.session);
  db.users.find((u) => u._id === w.worker._id).acceptEnabled = false;
  assert.throws(() => grabOrder(db, { orderId: order._id }, w.session), /接单权限/);
});

test('订单：待支付超时关闭为 CLOSED', () => {
  const db = createMemoryDb();
  seedAdmin(db); seedCs(db); seedWorker(db);
  const p = seedProduct(db);
  const token = issueOrderToken(db, p._id);
  const created = createOrderFromH5(db, { h5Token: token, contactWechat: 'wx' });
  const order = db.orders.find((o) => o._id === created.orderId);
  order.createdAt = Date.now() - 31 * 60 * 1000;
  order.payDeadline = order.createdAt + 30 * 60 * 1000;
  const res = timeoutCloseUnpaidOrders(db, { now: Date.now() }, { userId: 'timer', role: 'SYSTEM' });
  assert.equal(res.closed, 1);
  assert.equal(db.orders[0].status, 'CLOSED');
});

test('订单：未开工取消审批通过后已取消并退款成功', () => {
  const db = createMemoryDb();
  const admin = seedAdmin(db); const cs = seedCs(db); seedWorker(db);
  const p = seedProduct(db);
  const order = createPaidOrder(db, p); // PENDING_ACCEPT
  const { refundId } = requestCancellation(db, { orderId: order._id, reason: '客户不要了' }, cs.session);
  assert.equal(db.orders[0].cancellation.status, 'PENDING_REVIEW');
  approveRefund(db, { refundId }, admin.session);
  assert.equal(db.orders[0].status, 'CANCELLED');
  assert.equal(db.refunds[0].status, 'SUCCESS');
});

test('订单：listMyOrders 仅本人订单；queryOrderByNo 公开兜底查询返回脱敏 DTO', () => {
  const db = createMemoryDb();
  seedAdmin(db); seedCs(db); seedWorker(db);
  const p = seedProduct(db);
  const created = createOrderFromH5(db, { h5Token: issueOrderToken(db, p._id, 'mp-c1'), contactWechat: 'wx-c1', contactPhone: '13811112222' });
  // listMyOrders 仅返回会话本人订单
  assert.equal(listMyOrders(db, {}, { userId: 'mp-c1', role: 'CUSTOMER' }).length, 1);
  assert.equal(listMyOrders(db, {}, { userId: 'mp-other', role: 'CUSTOMER' }).length, 0);
  // queryOrderByNo 公开：orderNo + 微信号匹配 -> 脱敏 DTO + allowedActions 收紧
  const dto = queryOrderByNo(db, { orderNo: created.orderNo, contactWechat: 'wx-c1' });
  assert.equal(dto.orderNo, created.orderNo);
  assert.equal(dto.amountFen, 10000);
  assert.equal(dto.contactWechat, undefined); // 脱敏
  assert.deepEqual(dto.allowedActions, ['continuePay']); // 待支付 -> 仅继续支付
  // 手机号匹配
  assert.equal(queryOrderByNo(db, { orderNo: created.orderNo, contactPhone: '13811112222' }).orderNo, created.orderNo);
  // 联系方式不匹配 -> 抛错
  assert.throws(() => queryOrderByNo(db, { orderNo: created.orderNo, contactWechat: 'wrong' }), /不匹配/);
  // 缺少联系方式 -> 抛错
  assert.throws(() => queryOrderByNo(db, { orderNo: created.orderNo }), /手机号或微信号/);
});

test('订单：enterOrder 可修正联系方式并留痕；getOrder 出参结构', () => {
  const db = createMemoryDb();
  seedAdmin(db); const cs = seedCs(db); seedWorker(db);
  const p = seedProduct(db);
  const order = createPaidOrder(db, p); // PENDING_ACCEPT, contactWechat=wx-c1
  enterOrder(db, {
    orderId: order._id,
    game: 'lol',
    region: '一区',
    serviceType: 'companion',
    customerUid: 'uid-1',
    customerNickname: '昵称',
    expectStartAt: Date.now(),
    contactWechat: 'wx-fixed',
  }, cs.session);
  const o = db.orders.find((x) => x._id === order._id);
  assert.equal(o.contactWechat, 'wx-fixed');
  assert.equal(o.status, 'PENDING_GRAB');
  assert.ok(db.order_logs.some((l) => l.orderId === order._id && /修正联系方式/.test(l.remark || '')));
  const detail = getOrder(db, { orderId: order._id }, cs.session);
  assert.equal(detail.order._id, order._id);
  assert.ok(Array.isArray(detail.logs));
  assert.ok(Array.isArray(detail.attachments));
  assert.equal(detail.refund, null);
  assert.equal(detail.dispute, null);
});

test('钱包：申请提现冻结，打款确认后转已提现并落打款凭证', () => {
  const db = createMemoryDb();
  const admin = seedAdmin(db); const cs = seedCs(db); const w = seedWorker(db, { realnameApproved: true });
  const p = seedProduct(db);
  const order = grabToService(db, enterPool(db, createPaidOrder(db, p), cs.session), w.session);
  submitCompletion(db, { orderId: order._id, actualOutput: 10, attachmentIds: ['att'] }, w.session);
  verifyCompletion(db, { orderId: order._id }, cs.session);
  confirmSettlement(db, { orderId: order._id, customerConfirmed: true }, cs.session);
  const withdrawal = applyWithdrawal(db, { amountFen: 1000 }, w.session);
  assert.equal(withdrawal.status, 'SUBMITTED');
  startWithdrawalReview(db, { withdrawalId: withdrawal._id }, admin.session);
  approveWithdrawalRequest(db, { withdrawalId: withdrawal._id }, admin.session);
  startWithdrawalPayment(db, { withdrawalId: withdrawal._id, batchNo: 'BATCH-1' }, admin.session);
  assert.equal(getWallet(db, {}, w.session).pendingWithdrawFen, 1000);
  markWithdrawalPaid(db, { withdrawalId: withdrawal._id, batchNo: 'BATCH-1' }, admin.session);
  assert.equal(getWallet(db, {}, w.session).withdrawnFen, 1000);
  assert.equal(getWallet(db, {}, w.session).pendingWithdrawFen, 0);
  assert.equal(db.transfer_records.length, 1);
});
