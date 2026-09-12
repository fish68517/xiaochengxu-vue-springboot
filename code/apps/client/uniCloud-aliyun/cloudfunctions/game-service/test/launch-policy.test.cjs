'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { enforceLaunchPolicy } = require('../lib/commercial-ops.cjs');
const input = { brandId: 'demo-a', userId: 'customer-test', amountFen: 10000 };
const repo = (policy, orders = []) => ({
  findOne: async () => policy ? { cfgValue: policy } : null,
  find: async () => orders,
});
const env = (mode) => ({ APP_ENV: 'production', COMMERCIAL_LAUNCH_MODE: mode });

test('公开运营不要求灰度白名单，但仍执行已配置的暂停开关', async () => {
  await enforceLaunchPolicy(repo(null), input, env('public'));
  await assert.rejects(() => enforceLaunchPolicy(repo({ paused: true }), input, env('public')), { code: 'LAUNCH_PAUSED' });
});

test('关闭和无效运营模式拒绝提交，未配置时保留灰度门禁', async () => {
  await assert.rejects(() => enforceLaunchPolicy(repo(null), input, env('closed')), { code: 'LAUNCH_CLOSED' });
  await assert.rejects(() => enforceLaunchPolicy(repo(null), input, env('typo')), { code: 'LAUNCH_MODE_INVALID' });
  await assert.rejects(() => enforceLaunchPolicy(repo(null), input, env(undefined)), { code: 'LAUNCH_NOT_APPROVED' });
});

test('灰度模式区分品牌与用户拒绝，并保留金额限额', async () => {
  const policy = { approved: true, paused: false, brands: ['demo-a'], userIds: ['customer-test'], maxPaymentFen: 10000, maxDailyPaymentFen: 20000 };
  await enforceLaunchPolicy(repo(policy), input, env('gray'));
  await assert.rejects(() => enforceLaunchPolicy(repo(policy), { ...input, brandId: 'other' }, env('gray')), { code: 'LAUNCH_BRAND_NOT_ALLOWED' });
  await assert.rejects(() => enforceLaunchPolicy(repo(policy), { ...input, userId: 'other' }, env('gray')), { code: 'LAUNCH_USER_NOT_ALLOWED' });
  await assert.rejects(() => enforceLaunchPolicy(repo(policy), { ...input, amountFen: 10001 }, env('gray')), /单笔限额/);
  await assert.rejects(() => enforceLaunchPolicy(repo(policy, [{ _id: 'old', grayUserId: input.userId, createdAt: Date.now(), status: 'PAID', amountFen: 15000 }]), input, env('gray')), /当日支付限额/);
});
