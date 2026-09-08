import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateBrandScope } from '../../../scripts/migrate-brand-scope.mjs';

test('品牌迁移：回填商品/订单/关联数据并生成账号品牌范围', () => {
  const source = {
    brands: [{ _id: 'b1', brandId: 'demo-a', appId: 'wx-a', name: 'A', status: 'ON' }],
    products: [{ _id: 'p1', status: 'ON' }],
    orders: [{ _id: 'o1', productId: 'p1' }],
    refunds: [{ _id: 'r1', orderId: 'o1' }],
    users: [{ _id: 'u1', role: 'WORKER' }],
  };
  const { data, report } = migrateBrandScope(source, { defaultBrandId: 'demo-a' });
  assert.equal(data.brands[0].code, 'demo-a');
  assert.equal(data.products[0].brandId, 'demo-a');
  assert.equal(data.orders[0].brandId, 'demo-a');
  assert.equal(data.refunds[0].brandId, 'demo-a');
  assert.equal(data.user_brand_roles[0].brandId, 'demo-a');
  assert.equal(report.orphans.length, 0);
  assert.equal(source.products[0].brandId, undefined, '不得原地修改输入备份');
});
