import test from 'node:test';
import assert from 'node:assert/strict';
import { assertBrandAccess, hasBrandAccess, resolveBrandContext } from '../src/index.js';

const brands = [
  { brandId: 'demo-a', code: 'demo-a', appId: 'wx-a', status: 'ON', isDefault: true, version: 2 },
  { brandId: 'demo-b', code: 'demo-b', appId: 'wx-b', status: 'ON', version: 3 },
  { brandId: 'off', code: 'off', appId: 'wx-off', status: 'OFF' },
];

test('BrandContext：brandCode/AppID 解析同一品牌', () => {
  assert.deepEqual(resolveBrandContext(brands, { brandCode: 'demo-a', appId: 'wx-a' }), {
    brandId: 'demo-a', brandCode: 'demo-a', appId: 'wx-a', version: 2,
  });
});

test('BrandContext：品牌与渠道错配被拒绝', () => {
  assert.throws(() => resolveBrandContext(brands, { brandCode: 'demo-a', appId: 'wx-b' }), /BRAND_CHANNEL_MISMATCH/);
  assert.throws(() => resolveBrandContext(brands, { brandCode: 'off' }), /UNKNOWN_BRAND/);
});

test('BrandContext：仅显式允许时回落默认品牌', () => {
  assert.throws(() => resolveBrandContext(brands), /BRAND_CONTEXT_REQUIRED/);
  assert.equal(resolveBrandContext(brands, { allowDefault: true }).brandId, 'demo-a');
});

test('品牌权限：普通账号按 scope，管理员可跨品牌', () => {
  assert.equal(hasBrandAccess({ role: 'BRAND_ADMIN', brandScopes: ['demo-a'] }, 'demo-a'), true);
  assert.equal(hasBrandAccess({ role: 'BRAND_ADMIN', brandScopes: ['demo-a'] }, 'demo-b'), false);
  assert.equal(hasBrandAccess({ role: 'SUPER_ADMIN', brandScopes: [] }, 'demo-b'), true);
  assert.throws(() => assertBrandAccess({ role: 'WORKER', brandScopes: ['demo-a'] }, 'demo-b'), /BRAND_FORBIDDEN/);
});
