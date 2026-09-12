'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Catalog = require('../lib/catalog.cjs');
const services = require('../lib/services.cjs');
const { createMemoryRepository } = require('../lib/repository.cjs');
const { createAuth } = require('../lib/auth.cjs');
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=';
const admin = { userId: 'test-admin', role: 'ADMIN', brandScopes: ['*'] };
async function fixture() {
  const repo = createMemoryRepository();
  for (const [id, status] of [['a', 'ON'], ['b', 'ACTIVE'], ['c', 'OFF']]) {
    await repo.insert('brands', { _id: id, brandId: id, code: id, status, name: `品牌${id}`, channelRefs: { paymentSecretRef: 'test-private-reference' }, binding: { merchant: 'test-merchant' } });
  }
  for (const id of ['a', 'b', 'c', 'missing']) await repo.insert('products', { _id: `p-${id}`, brandId: id, status: 'ON', title: '测试商品', priceFen: 100, images: ['https://example.test/image.png'], commission: { valueFen: 30 }, assetIds: ['private-asset'] });
  await repo.insert('products', { _id: 'p-off', brandId: 'a', status: 'OFF' });
  return repo;
}
test('聚合目录展示多品牌、过滤停用和孤立商品、公开 DTO 不含支付或内部素材信息', async () => {
  const repo = await fixture();
  const rows = await services.listCatalogProducts(repo);
  assert.deepEqual(rows.map(p => p.brandId), ['a', 'b']);
  assert.equal(rows[1].brandName, '品牌b');
  const dto = await services.getCatalogProduct(repo, { productId: 'p-b' });
  for (const key of ['channelRefs', 'binding', 'assetIds', 'commission']) assert.equal(dto[key], undefined);
  assert.equal(JSON.stringify(dto).includes('test-private-reference'), false);
  await assert.rejects(() => services.getCatalogProduct(repo, { productId: 'p-c' }), /停用/);
  await assert.rejects(() => services.getCatalogProduct(repo, { productId: 'p-off' }), /下架/);
  await assert.rejects(() => services.h5Token(repo, { productId: 'p-b' }, { role: 'CUSTOMER', openid: 'customer', brandScopes: ['a'] }), /BRAND_FORBIDDEN/);
});
test('目录显式分页，不被默认 100 条截断；新增接口公开读但上传需鉴权', async () => {
  const repo = await fixture();
  for (let n = 0; n < 110; n++) await repo.insert('products', { _id: `many-${String(n).padStart(3, '0')}`, brandId: 'b', status: 'ON', game: '测试游戏' });
  assert.equal((await services.listCatalogProducts(repo, { game: '测试游戏' })).length, 110);
  const auth = createAuth({ env: { SESSION_SECRET: 'test-only' } });
  await auth.require(repo, 'listCatalogProducts', {});
  await auth.require(repo, 'getCatalogProduct', {});
  await assert.rejects(() => auth.require(repo, 'uploadCatalogImage', {}), /token/);
});
test('管理员公开图片上传，存储真实后缀和归属；新品牌可先上传 Logo', async () => {
  const repo = await fixture();
  const calls = [];
  const cloud = { async uploadFile(options) { calls.push(options); return { fileID: `https://example.test/${options.cloudPath}` }; } };
  const result = await Catalog.uploadCatalogImage(repo, { brandId: 'new-brand', kind: 'logo', content: png }, admin, cloud);
  assert.match(result.url, /^https:\/\/example.test\/public-catalog\/new-brand\/logo\/.+\.png$/);
  assert.equal(calls[0].cloudPathAsRealPath, true);
  assert.ok(Buffer.isBuffer(calls[0].fileContent));
  const stored = await repo.getById('catalog_assets', result.assetId);
  assert.equal(stored.brandId, 'new-brand');
  assert.equal(stored.uploaderId, admin.userId);
  await Catalog.uploadCatalogImage(repo, { brandId: 'b', kind: 'product', content: png }, admin, cloud);
  await assert.rejects(() => Catalog.uploadCatalogImage(repo, { brandId: 'new-brand', kind: 'product', content: png }, admin, cloud), /选择已启用/);
});
test('拒绝客服、工作人员、越品牌上传，鉴权在写云存储之前', async () => {
  const repo = await fixture();
  const cloud = { uploadFile() { throw new Error('should-not-upload'); } };
  const payload = { brandId: 'b', kind: 'logo', content: png };
  for (const role of ['CS', 'WORKER', 'CUSTOMER']) await assert.rejects(() => Catalog.uploadCatalogImage(repo, payload, { ...admin, role }, cloud), /仅管理员/);
  await assert.rejects(() => Catalog.uploadCatalogImage(repo, payload, { userId: 'scoped', role: 'BRAND_ADMIN', brandScopes: ['a'] }, cloud), /BRAND_FORBIDDEN/);
  await assert.rejects(() => Catalog.uploadCatalogImage(repo, { ...payload, brandId: '../escape' }, admin, cloud), /品牌 ID/);
});
test('拒绝 SVG、伪装、损坏 Base64、空文件及超限图片；不保存临时 URL', async () => {
  assert.equal(Catalog.decodeImage(png).extension, 'png');
  for (const content of ['', 'not an image', Buffer.from('<svg></svg>').toString('base64'), Buffer.alloc(Catalog.MAX_IMAGE_BYTES + 1).toString('base64')]) assert.throws(() => Catalog.decodeImage(content), /图片|文件/);
  const repo = await fixture();
  const payload = { brandId: 'a', kind: 'logo', content: png };
  await assert.rejects(() => Catalog.uploadCatalogImage(repo, payload, admin, { uploadFile: async () => ({ fileID: 'https://example.test/file.png?expires=1' }) }), /公开 HTTPS/);
  assert.equal((await repo.find('catalog_assets')).length, 0);
});
test('路由第四参数是可信上下文，不误当云存储依赖', async () => {
  const repo = await fixture();
  const previous = globalThis.uniCloud;
  globalThis.uniCloud = { uploadFile: async () => ({ fileID: 'https://example.test/route-image.png' }) };
  try {
    const result = await services.uploadCatalogImage(repo, { brandId: 'a', kind: 'logo', content: png }, admin, { requestId: 'test-context' });
    assert.equal(result.url, 'https://example.test/route-image.png');
  } finally { globalThis.uniCloud = previous; }
});
