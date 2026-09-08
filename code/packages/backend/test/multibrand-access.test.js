import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';
import { createMemoryDb, seedAdmin } from './helpers.js';
import { insert } from '../src/db.js';
import {
  authLogin, createStaff, dispatch, getAccessProfile, h5Token, listOrders, listProducts,
  saveBrandConfig, saveProduct, saveUserBrandRoles, verifySessionToken, getSessionSecret,
} from '../src/services.js';

function seedBrands(db, adminSession) {
  saveBrandConfig(db, { brandId: 'brand-a', code: 'brand-a', appId: 'wx-a', name: '品牌 A', isDefault: true, status: 'ON' }, adminSession);
  saveBrandConfig(db, { brandId: 'brand-b', code: 'brand-b', appId: 'wx-b', name: '品牌 B', status: 'ON' }, adminSession);
}

test('多品牌：公开商品按 BrandContext 隔离，H5 token 绑定客户品牌', () => {
  const db = createMemoryDb();
  const { session: adminSession } = seedAdmin(db);
  seedBrands(db, adminSession);
  const a = saveProduct(db, { title: 'A 服务', priceFen: 1000, commission: { type: 'percent', valuePercent: 10 }, brandId: 'brand-a' }, adminSession);
  saveProduct(db, { title: 'B 服务', priceFen: 2000, commission: { type: 'percent', valuePercent: 10 }, brandId: 'brand-b' }, adminSession);

  assert.deepEqual(listProducts(db, { brandCode: 'brand-a' }).map((item) => item.title), ['A 服务']);
  assert.deepEqual(listProducts(db, { appId: 'wx-b' }).map((item) => item.title), ['B 服务']);
  const customerA = { userId: 'openid-a', role: 'CUSTOMER', roles: ['CUSTOMER'], brandScopes: ['brand-a'] };
  assert.ok(h5Token(db, { productId: a._id }, customerA).token);
  const b = db.products.find((item) => item.brandId === 'brand-b');
  assert.throws(() => h5Token(db, { productId: b._id }, customerA), /BRAND_FORBIDDEN/);
});

test('多品牌：品牌管理员 profile/列表/写操作受 scope 约束，越权由统一门禁拒绝', () => {
  const db = createMemoryDb();
  const { session: adminSession } = seedAdmin(db);
  seedBrands(db, adminSession);
  const staff = createStaff(db, { role: 'BRAND_ADMIN', phone: '13900000001', password: 'brand123', nickname: 'A 管理员', brandId: 'brand-a' }, adminSession);
  const login = authLogin(db, { phone: '13900000001', password: 'brand123' });
  const session = verifySessionToken(login.token, getSessionSecret());
  const profile = getAccessProfile(db, {}, session);
  assert.deepEqual(profile.brandScopes, ['brand-a']);
  assert.ok(profile.visibleMenus.includes('brands'));

  saveProduct(db, { title: 'A 服务', priceFen: 1000, commission: { type: 'percent', valuePercent: 10 }, brandId: 'brand-a' }, adminSession);
  assert.throws(() => saveProduct(db, { title: '越权 B 服务', priceFen: 1000, commission: { type: 'percent', valuePercent: 10 }, brandId: 'brand-b' }, session), /BRAND_FORBIDDEN/);

  insert(db, 'orders', { orderNo: 'A-1', productId: 'p-a', customerId: 'c-a', amountFen: 1000, status: 'PENDING_ACCEPT', commission: {}, brandId: 'brand-a', createdAt: Date.now() });
  const bOrder = insert(db, 'orders', { orderNo: 'B-1', productId: 'p-b', customerId: 'c-b', amountFen: 2000, status: 'PENDING_ACCEPT', commission: {}, brandId: 'brand-b', createdAt: Date.now() });
  assert.deepEqual(listOrders(db, {}, session).map((order) => order.orderNo), ['A-1']);
  const denied = dispatch(db, 'enterOrder', { orderId: bOrder._id }, session);
  assert.equal(denied.code, 'FORBIDDEN');

  saveUserBrandRoles(db, { userId: staff._id, brandId: 'brand-a', roles: ['BRAND_ADMIN'], permissions: ['brand.config.write'] }, adminSession);
  assert.ok(db.audit_logs.some((row) => row.action === 'saveUserBrandRoles' && row.brandId === 'brand-a'));
});
