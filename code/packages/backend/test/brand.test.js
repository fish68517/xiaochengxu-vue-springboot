import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';
import { createMemoryDb, seedAdmin } from './helpers.js';
import { getBrandConfig, listBrands, saveBrandConfig } from '../src/services.js';

test('品牌：无品牌时返回内置默认品牌', () => {
  const db = createMemoryDb();
  const cfg = getBrandConfig(db, { appId: 'wx-x' });
  assert.equal(cfg.brandId, 'default');
  assert.equal(cfg.themeTokens.primary, '#ff2442');
  assert.equal(cfg.themeTokens.bg, '#f2f2f2');
});

test('品牌：保存后按 appId 精确匹配读取', () => {
  const db = createMemoryDb();
  const { session } = seedAdmin(db);
  saveBrandConfig(db, { brand: { brandId: 'brand-a', appId: 'wx-a', name: '甲', themeTokens: { primary: '#123456' }, copy: { headerTitle: '甲标题' }, status: 'ON' } }, session);
  assert.equal(listBrands(db, {}, session).length, 1);
  const cfg = getBrandConfig(db, { appId: 'wx-a' });
  assert.equal(cfg.name, '甲');
  assert.equal(cfg.copy.headerTitle, '甲标题');
});

test('品牌：同 brandId upsert 产生版本，OFF 后显式渠道拒绝启动', () => {
  const db = createMemoryDb();
  const { session } = seedAdmin(db);
  saveBrandConfig(db, { brand: { brandId: 'brand-a', appId: 'wx-a', name: '甲', status: 'ON' } }, session);
  saveBrandConfig(db, { brand: { brandId: 'brand-a', appId: 'wx-a', name: '甲改', status: 'OFF' } }, session);
  assert.equal(listBrands(db, {}, session).length, 1);
  assert.equal(listBrands(db, {}, session)[0].name, '甲改');
  assert.equal(db.brand_config_versions.length, 2);
  assert.equal(db.audit_logs.filter((row) => row.action === 'saveBrandConfig').length, 2);
  assert.throws(() => getBrandConfig(db, { appId: 'wx-a' }), /BRAND_DISABLED/);
});

test('品牌：校验 themeTokens/copy 必须为对象', () => {
  const db = createMemoryDb();
  const { session } = seedAdmin(db);
  assert.throws(() => saveBrandConfig(db, { brand: { brandId: 'b', appId: 'wx', name: 'n', themeTokens: 'red' } }, session), /themeTokens/);
  assert.throws(() => saveBrandConfig(db, { brand: { brandId: 'b', appId: 'wx', name: 'n', copy: ['x'] } }, session), /copy/);
});
