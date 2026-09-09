'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../lib/commercial-finance.cjs');
const { resolvePaymentConfig } = require('../lib/payment-config.cjs');
const { createMemoryRepository } = require('../lib/repository.cjs');
test('提现禁止申请人自审、同人双审和公开凭证', () => {
  const wd = { workerId: 'w', reviewedBy: 'a', brandId: 'b' };
  assert.throws(() => F.assertWithdrawalReviewer(wd, { userId: 'w' }), /自审/);
  assert.throws(() => F.assertWithdrawalReviewer(wd, { userId: 'a' }, true), /不同/);
  assert.throws(() => F.assertPayoutReceipt(wd, { storageVisibility: 'public' }, 'bank-1'), /私有/);
  F.assertWithdrawalReviewer(wd, { userId: 'b' }, true);
  F.assertPayoutReceipt(wd, { brandId: 'b', storageVisibility: 'private', scanStatus: 'CLEAN', purpose: 'PAYOUT_RECEIPT' }, 'bank-1');
});
test('退款保留在途余额并阻止非整数和超额', () => {
  assert.throws(() => F.assertRefundBudget({ amountFen: 100 }, [{ _id: 'old', amountFen: 60, status: 'PROCESSING' }], { _id: 'new', amountFen: 50 }), /余额/);
  assert.throws(() => F.assertRefundBudget({ amountFen: 100 }, [], { amountFen: 0.1 }), /整数/);
});
test('品牌配置不能跨主体复用Secret且不存在时fail closed', () => {
  const map = { staging: { a: { envPrefix: 'PAY_A', secretRef: 'vault/a', entityId: 'entity-a', appId: 'wxA', mchid: '1', boundAppIds: ['wxA'] }, b: { envPrefix: 'PAY_A', secretRef: 'vault/a', entityId: 'entity-b', appId: 'wxB', mchid: '1', boundAppIds: ['wxB'] } } };
  const env = { APP_ENV: 'staging', WECHAT_PAY_CONFIG_MAP: JSON.stringify(map) };
  assert.throws(() => resolvePaymentConfig({ brandCode: 'unknown', env }), /品牌/);
  assert.throws(() => resolvePaymentConfig({ brandCode: 'a', env }), /主体/);
});
test('对账异常持久化、幂等建单、处理人不能关闭自己工单且导出有水印', async () => {
  const repo = createMemoryRepository();
  await repo.insert('orders', { _id: 'o', brandId: 'b', amountFen: 100, paidAt: 1, paymentId: 'p' });
  await repo.insert('payments', { _id: 'p', brandId: 'b', orderId: 'o', amountFen: 90, status: 'SUCCESS' });
  const a = { userId: 'a', role: 'FINANCE_REVIEWER', brandScopes: ['b'] };
  const b = { ...a, userId: 'b' };
  const first = await F.runFinancialReconciliation(repo, { brandId: 'b', date: '2026-09-08' }, a);
  await F.runFinancialReconciliation(repo, { brandId: 'b', date: '2026-09-08' }, a);
  assert.equal(first.caseCount, 1);
  const cases = await F.listReconciliationCases(repo, { brandId: 'b' }, a);
  assert.equal(cases.items.length, 1);
  await F.resolveReconciliationCase(repo, { caseId: cases.items[0]._id, reason: '查明差异', resolution: '待渠道调整' }, a);
  await assert.rejects(() => F.closeReconciliationCase(repo, { caseId: cases.items[0]._id, reviewNote: '复核' }, a), /不同/);
  await F.closeReconciliationCase(repo, { caseId: cases.items[0]._id, reviewNote: '已确认' }, b);
  const exported = await F.exportFinancialReconciliation(repo, { brandId: 'b', purpose: '日结' }, a);
  assert.match(exported.csv, /内部财务/);
  await assert.rejects(() => F.listReconciliationCases(repo, { brandId: 'other' }, a), /品牌/);
});
