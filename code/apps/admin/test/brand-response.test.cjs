'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(result, transport = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/api.js'), 'utf8')
    .replace(/import\.meta/g, 'IMPORT_META').replace(/export /g, '');
  const sandbox = {
    IMPORT_META: { env: { VITE_APP_ENV: 'production', VITE_API_MODE: 'unicloud' } },
    uni: { getStorageSync: () => '', setStorageSync: () => {}, reLaunch: () => {} },
    uniCloud: { callFunction: async () => ({ result, ...transport }) },
  };
  vm.createContext(sandbox);
  vm.runInContext(source + '\nglobalThis.testApi = api;', sandbox);
  return sandbox.testApi;
}
test('品牌 code 是业务字段，保存结果必须正常返回', async () => {
  const brand = { brandId: 'demo-a', code: 'demo-a', version: 10, channelRefs: { paymentSecretRef: 'secret://test' } };
  const saved = await load(brand).saveBrandConfig(brand);
  assert.equal(saved, brand);
  assert.equal(saved.channelRefs.paymentSecretRef, 'secret://test');
});
test('业务失败与 SDK 失败仍被拒绝', async () => {
  await assert.rejects(() => load({ ok: false, code: 'DOMAIN_ERROR', message: '引用冲突' }).saveBrandConfig({}), /引用冲突/);
  await assert.rejects(() => load({}, { errCode: 500, errMsg: 'SDK失败' }).saveBrandConfig({}), /SDK失败/);
});
test('刷新列表保留支付引用，不把品牌短码当作错误', async () => {
  const rows = [{ brandId: 'demo-a', code: 'demo-a', channelRefs: { paymentSecretRef: 'secret://test' } }];
  assert.equal((await load(rows).listBrands())[0].channelRefs.paymentSecretRef, 'secret://test');
});
