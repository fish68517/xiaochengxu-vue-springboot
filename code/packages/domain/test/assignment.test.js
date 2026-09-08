import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OrderStatus,
  createOrder,
  payOrder,
  enterOrder,
  assignOrder,
  acceptAssignment,
  rejectAssignment,
  releaseOrder,
  grabOrder,
  submitCompletion,
  verifyCompletion,
  confirmSettlement,
  reworkOrder,
} from '../src/order-machine.js';

// 待支付 -> 待受理 -> 待抢单
function toGrab(id = 'o-1') {
  const order = createOrder({
    id,
    amountFen: 10000,
    productId: 'p-1',
    customerId: 'c-1',
    contactWechat: 'wx-1',
    createdAt: 0,
  });
  payOrder(order, { paidAt: 1000 });
  enterOrder(order, {
    game: '王者荣耀',
    region: 'QQ一区',
    serviceType: '技能陪伴',
    customerUid: 'uid-1',
    customerNickname: '小明',
    expectStartAt: 2000,
  });
  return order;
}

test('指派：待抢单 → 指派待确认，记录指派人与时间', () => {
  const order = toGrab();
  assignOrder(order, 'worker-1', { assignedBy: 'cs-1' });
  assert.equal(order.status, OrderStatus.ASSIGN_PENDING);
  assert.equal(order.workerId, 'worker-1');
  assert.equal(order.assignedBy, 'cs-1');
  assert.ok(order.assignedAt);
});

test('接受指派：指派待确认 → 服务中', () => {
  const order = toGrab();
  assignOrder(order, 'worker-1', { assignedBy: 'cs-1' });
  acceptAssignment(order, 'worker-1');
  assert.equal(order.status, OrderStatus.IN_SERVICE);
  assert.ok(order.grabbedAt);
});

test('拒绝指派：指派待确认 → 待抢单，清空接单人员', () => {
  const order = toGrab();
  assignOrder(order, 'worker-1', { assignedBy: 'cs-1' });
  rejectAssignment(order, 'worker-1', { reason: '时间冲突' });
  assert.equal(order.status, OrderStatus.PENDING_GRAB);
  assert.equal(order.workerId, undefined);
  assert.equal(order.assignmentRejectReason, '时间冲突');
});

test('抢单：待抢单 → 服务中（上限为服务层校验）', () => {
  const order = toGrab();
  grabOrder(order, 'worker-2', { maxActiveOrders: 3 });
  assert.equal(order.status, OrderStatus.IN_SERVICE);
  assert.equal(order.workerId, 'worker-2');
});

test('非法上限配置抛错', () => {
  const order = toGrab();
  assert.throws(() => grabOrder(order, 'worker-2', { maxActiveOrders: 0 }), /上限/);
});

test('退单：服务中 → 待抢单，留痕', () => {
  const order = toGrab();
  grabOrder(order, 'worker-1');
  releaseOrder(order, 'worker-1', { reason: '临时有事' });
  assert.equal(order.status, OrderStatus.PENDING_GRAB);
  assert.equal(order.workerId, undefined);
  assert.equal(order.releaseReason, '临时有事');
  assert.ok(order.releasedAt);
});

test('完成申请：服务中 → 待确认，记录产出与凭证', () => {
  const order = toGrab();
  grabOrder(order, 'worker-1');
  submitCompletion(order, { actualOutput: 90, attachmentIds: ['a1', 'a2'] });
  assert.equal(order.status, OrderStatus.PENDING_CONFIRM);
  assert.equal(order.actualOutput, 90);
  assert.deepEqual(order.attachmentIds, ['a1', 'a2']);
});

test('结单：待确认 → 已结单，写入异议截止', () => {
  const order = toGrab();
  grabOrder(order, 'worker-1');
  submitCompletion(order, { actualOutput: 90, attachmentIds: ['a1'] });
  verifyCompletion(order, { verifiedBy: 'cs-1' });
  confirmSettlement(order, { confirmedBy: 'cs-1', customerConfirmed: true });
  assert.equal(order.status, OrderStatus.SETTLED);
  assert.ok(order.disputeDeadline > order.completedAt);
});

test('补单：待确认 → 服务中，补单次数 +1', () => {
  const order = toGrab();
  grabOrder(order, 'worker-1');
  submitCompletion(order, { actualOutput: 90, attachmentIds: ['a1'] });
  reworkOrder(order, { reworkedBy: 'cs-1', note: '补足' });
  assert.equal(order.status, OrderStatus.IN_SERVICE);
  assert.equal(order.reworkCount, 1);
  assert.equal(order.reworkNote, '补足');
});
