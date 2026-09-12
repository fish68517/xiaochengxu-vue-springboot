'use strict';
const { randomUUID } = require('node:crypto');
const { readAll } = require('./order-workflow.cjs');
const MAX_IMAGE_BYTES = 1024 * 1024;
const enabled = brand => brand && ['ON', 'ACTIVE'].includes(brand.status);

function publicProduct(product, brand) {
  const fields = ['title', 'game', 'serviceType', 'tierName', 'guaranteedOutput', 'outputUnit', 'priceFen', 'description', 'sort', 'status'];
  const contact = brand.contactConfig || {};
  return {
    ...Object.fromEntries(fields.filter(key => product[key] !== undefined).map(key => [key, product[key]])),
    _id: product._id, id: product._id,
    images: Array.isArray(product.images) ? product.images.filter(url => typeof url === 'string') : [],
    brandId: brand.brandId, brandCode: brand.code || brand.brandId,
    brandName: brand.name || brand.brandId, brandLogo: brand.logo || brand.assetConfig?.logo || '',
    brandContact: { serviceWechat: contact.serviceWechat || '', servicePhone: contact.servicePhone || '', serviceHours: contact.serviceHours || '' },
  };
}
async function listCatalogProducts(repo, { game } = {}) {
  const brands = new Map((await readAll(repo, 'brands')).filter(enabled).map(b => [b.brandId, b]));
  const products = await readAll(repo, 'products', { status: 'ON' });
  return products.filter(p => p.status === 'ON' && brands.has(p.brandId || 'default') && (!game || p.game === game))
    .sort((a, b) => (a.sort || 0) - (b.sort || 0) || String(a._id).localeCompare(String(b._id)))
    .map(p => publicProduct(p, brands.get(p.brandId || 'default')));
}
async function getCatalogProduct(repo, { productId } = {}) {
  const product = productId && await repo.getById('products', productId);
  if (!product || product.status !== 'ON') throw new Error('商品已下架或不存在');
  const brand = await repo.findOne('brands', { brandId: product.brandId || 'default' });
  if (!enabled(brand)) throw new Error('商品所属品牌已停用或不存在');
  return publicProduct(product, brand);
}

function decodeImage(content) {
  if (typeof content !== 'string' || !content || content.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4
    || content.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(content)) throw new Error('图片内容无效或超过 1 MiB');
  const buffer = Buffer.from(content, 'base64');
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES || buffer.toString('base64') !== content) throw new Error('图片内容无效或超过 1 MiB');
  let extension = '';
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && buffer.toString('ascii', 12, 16) === 'IHDR') extension = 'png';
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff && buffer.subarray(-2).equals(Buffer.from([0xff, 0xd9]))) extension = 'jpg';
  if (buffer.length >= 20 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
    && ['VP8 ', 'VP8L', 'VP8X'].includes(buffer.toString('ascii', 12, 16))) extension = 'webp';
  if (!extension) throw new Error('仅支持 PNG、JPEG、WebP 图片，不支持 SVG 或其他文件');
  return { buffer, extension };
}
async function uploadCatalogImage(repo, payload, session, cloud = globalThis.uniCloud || (typeof uniCloud !== 'undefined' ? uniCloud : undefined)) {
  const roles = [session?.role, ...(session?.roles || [])];
  if (!roles.some(role => ['ADMIN', 'SUPER_ADMIN', 'BRAND_ADMIN'].includes(role))) throw new Error('仅管理员可上传品牌和商品图片');
  const { brandId, kind, content } = payload || {};
  if (typeof brandId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(brandId)) throw new Error('请先填写有效品牌 ID');
  if (!roles.includes('ADMIN') && !roles.includes('SUPER_ADMIN') && !(session.brandScopes || []).some(scope => scope === '*' || scope === brandId)) throw new Error('BRAND_FORBIDDEN');
  if (!['logo', 'product'].includes(kind)) throw new Error('不支持的公开图片类型');
  if (kind === 'product' && !enabled(await repo.findOne('brands', { brandId }))) throw new Error('请先选择已启用的所属品牌');
  const { buffer, extension } = decodeImage(content);
  if (!cloud || typeof cloud.uploadFile !== 'function') throw new Error('当前环境缺少阿里云图片上传能力');
  const assetId = `catalog-${randomUUID()}`;
  const cloudPath = `public-catalog/${brandId}/${kind}/${assetId}.${extension}`;
  const result = await cloud.uploadFile({ cloudPath, cloudPathAsRealPath: true, fileContent: buffer });
  // 此接口仅支持阿里云公开资源；不将临时签名链接、私有附件或 blob 地址持久化。
  const url = result?.fileID;
  if (typeof url !== 'string' || !url.startsWith('https://') || new URL(url).search) throw new Error('云存储未返回公开 HTTPS 图片地址，请检查阿里云存储配置');
  await repo.insert('catalog_assets', { _id: assetId, brandId, kind, fileID: url, url, size: buffer.length, cloudPath, uploaderId: session.userId, createdAt: Date.now() });
  return { assetId, url };
}
module.exports = { listCatalogProducts, getCatalogProduct, uploadCatalogImage, decodeImage, MAX_IMAGE_BYTES };
