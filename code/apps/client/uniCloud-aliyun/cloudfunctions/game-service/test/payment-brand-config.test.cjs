'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.SESSION_SECRET = 'test-brand-session-secret';
process.env.H5_TOKEN_SECRET = 'test-brand-h5-secret';
const { normalizeChannelRefs } = require('../lib/payment-config.cjs');
const { createMemoryRepository } = require('../lib/repository.cjs');
const services = require('../lib/services.cjs');

test('支付引用兼容历史字段，冲突拒绝，其他渠道字段保留', () => {
  assert.deepEqual(normalizeChannelRefs({ paymentCredentialRef: ' secret://pay/a ', miniProgramSecretRef: 'secret://mp/a' }), { paymentSecretRef: 'secret://pay/a', miniProgramSecretRef: 'secret://mp/a' });
  assert.throws(() => normalizeChannelRefs({ paymentCredentialRef: 'a', paymentSecretRef: 'b' }), /不一致/);
});

test('保存旧品牌引用自动规范化，省略渠道字段不清空原配置', async () => {
  const repo = createMemoryRepository();
  const admin = { userId: 'admin-test', role: 'ADMIN', roles: ['ADMIN'], brandScopes: ['*'] };
  const brand = { brandId: 'brand-test', code: 'brand-test', appId: 'wx-test', name: '测试品牌' };
  const saved = await services.saveBrandConfig(repo, { ...brand, channelRefs: { paymentCredentialRef: 'secret://pay/test' } }, admin);
  assert.equal(saved.channelRefs.paymentSecretRef, 'secret://pay/test');
  assert.equal(saved.channelRefs.paymentCredentialRef, undefined);
  const edited = await services.saveBrandConfig(repo, { ...brand, name: '新名称' }, admin);
  assert.equal(edited.channelRefs.paymentSecretRef, 'secret://pay/test');
});

test('历史支付引用可进入生产配置检查，映射缺失时不新增支付流水', async () => {
  const keys = ['APP_ENV', 'PAYMENT_MODE', 'COMMERCIAL_LAUNCH_MODE', 'WECHAT_PAY_CONFIG_MAP', 'TESTPAY_SERIAL_NO', 'TESTPAY_PRIVATE_KEY', 'TESTPAY_APIV3_KEY', 'TESTPAY_NOTIFY_URL', 'TESTPAY_PUBLIC_KEY', 'TESTPAY_PUBLIC_KEY_ID'];
  const old = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    process.env.APP_ENV = 'production'; process.env.PAYMENT_MODE = 'wechat';
    process.env.COMMERCIAL_LAUNCH_MODE = 'public'; process.env.WECHAT_PAY_CONFIG_MAP = '{}';
    const repo = createMemoryRepository();
    await repo.insert('brands', { _id: 'brand-test', brandId: 'brand-test', code: 'brand-test', channelRefs: { paymentCredentialRef: 'secret://pay/test' } });
    await repo.insert('products', { _id: 'p-test', brandId: 'brand-test', status: 'ON', priceFen: 1, commission: { type: 'fixed', valueFen: 0 } });
    const h5 = await services.h5Token(repo, { productId: 'p-test' }, null);
    const order = await services.createOrderFromH5(repo, { h5Token: h5.token, contactWechat: 'test-contact' });
    await assert.rejects(() => services.getPaymentParams(repo, { orderId: order.orderId, h5Token: h5.token, payType: 'JSAPI' }), /品牌支付映射不存在/);
    assert.equal((await repo.find('payments', {})).length, 0);
    // 只测试本地配置检查，不调用微信：下面请求不含 JSAPI openid，会在预支付请求前返回。
    process.env.WECHAT_PAY_CONFIG_MAP = JSON.stringify({ production: { 'brand-test': {
      entityId: 'test-entity', envPrefix: 'TESTPAY', secretRef: 'secret://pay/test',
      appId: 'wx-test', mchid: 'merchant-test', boundAppIds: ['wx-test'],
    } } });
    Object.assign(process.env, { TESTPAY_SERIAL_NO: 'serial-test', TESTPAY_PRIVATE_KEY: 'test-placeholder-not-a-key', TESTPAY_APIV3_KEY: 'x'.repeat(32), TESTPAY_NOTIFY_URL: 'https://example.com/pay-notify', TESTPAY_PUBLIC_KEY: 'test-placeholder-not-a-key', TESTPAY_PUBLIC_KEY_ID: 'PUB_KEY_ID_TEST' });
    await repo.updateById('brands', 'brand-test', { binding: { merchant: 'wrong-merchant' } });
    await assert.rejects(() => services.getPaymentParams(repo, { orderId: order.orderId, h5Token: h5.token, payType: 'JSAPI' }), /商户号与支付映射不一致/);
    assert.equal((await repo.find('payments', {})).length, 0);
    await repo.updateById('brands', 'brand-test', { binding: { merchant: 'merchant-test' } });
    const result = await services.getPaymentParams(repo, { orderId: order.orderId, h5Token: h5.token, payType: 'JSAPI' });
    assert.equal(result.message, 'JSAPI 支付缺少 openid');
    const [payment] = await repo.find('payments', {});
    assert.equal(payment.secretRef, 'secret://pay/test');
    await repo.updateById('payments', payment._id, { secretRef: 'env:wechat-pay' });
    await services.getPaymentParams(repo, { orderId: order.orderId, h5Token: h5.token, payType: 'JSAPI' });
    assert.equal((await repo.getById('payments', payment._id)).secretRef, 'secret://pay/test');
    assert.equal((await repo.find('payments', {})).length, 1);
  } finally {
    for (const key of keys) { if (old[key] === undefined) delete process.env[key]; else process.env[key] = old[key]; }
  }
});
