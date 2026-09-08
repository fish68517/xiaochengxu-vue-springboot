import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBrand, missingKeys } from '../src/brand.js';

const brand = (over = {}) => ({ brandId: 'b', appId: '', name: '品牌', status: 'ON', ...over });

test('resolveBrand：按 appId 精确匹配', () => {
  const a = brand({ brandId: 'a', appId: 'wx-a' });
  const b = brand({ brandId: 'b', appId: 'wx-b' });
  assert.equal(resolveBrand([a, b], 'wx-b').brandId, 'b');
});

test('resolveBrand：无匹配返回 isDefault 且 ON 的默认品牌', () => {
  const a = brand({ brandId: 'a', appId: 'wx-a' });
  const d = brand({ brandId: 'd', appId: 'wx-d', isDefault: true });
  assert.equal(resolveBrand([a, d], 'wx-x').brandId, 'd');
});

test('resolveBrand：无 isDefault 返回第一个', () => {
  const a = brand({ brandId: 'a', appId: 'wx-a' });
  const b = brand({ brandId: 'b', appId: 'wx-b' });
  assert.equal(resolveBrand([a, b], 'wx-x').brandId, 'a');
});

test('resolveBrand：isDefault 但 OFF 不作为默认，退回第一个', () => {
  const a = brand({ brandId: 'a', appId: 'wx-a' });
  const off = brand({ brandId: 'off', appId: 'wx-off', isDefault: true, status: 'OFF' });
  assert.equal(resolveBrand([a, off], 'wx-x').brandId, 'a');
});

test('resolveBrand：空列表返回 null', () => {
  assert.equal(resolveBrand([], 'wx-x'), null);
  assert.equal(resolveBrand(null, 'wx-x'), null);
});

test('missingKeys：返回缺失/空值键（含空白字符串与空数组）', () => {
  const defaults = { title: 'T', body: 'B', tags: ['x'] };
  const copy = { title: '好的', body: '   ', tags: [] };
  assert.deepEqual(missingKeys(copy, defaults), ['body', 'tags']);
});

test('missingKeys：全部补齐返回空数组', () => {
  const defaults = { title: 'T', body: 'B' };
  assert.deepEqual(missingKeys({ title: 'ok', body: 'ok' }, defaults), []);
});

test('missingKeys：非对象入参按空处理', () => {
  assert.deepEqual(missingKeys(null, { a: '1' }), ['a']);
  assert.deepEqual(missingKeys({ a: 'x' }, null), []);
});
