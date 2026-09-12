// 品牌资产单一读取入口：页面不直接解析品牌配置层级，也不散落品牌条件判断。
import { brandState } from './brand.js';

function current() { return brandState.brand || {}; }

export function brandLogo() {
  const brand = current();
  return brand.logo || (brand.assetConfig && brand.assetConfig.logo) || '';
}

export function brandBanners() {
  const brand = current();
  const value = (brand.assetConfig && brand.assetConfig.banners) || brand.banners || [];
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function heroBanners() {
  const banners = brandBanners();
  return banners.length ? banners : ['/static/default-banner.svg'];
}

export function brandContact() {
  const contact = current().contactConfig || {};
  return { serviceWechat: contact.serviceWechat || '', servicePhone: contact.servicePhone || '', serviceHours: contact.serviceHours || '' };
}

export function productCover(product) {
  if (product) {
    const own = product.coverImage || product.image || (Array.isArray(product.images) && product.images[0]);
    if (own) return own;
    if (product.brandId && product.brandId !== current().brandId) return '/static/default-product.svg';
  }
  const assets = current().assetConfig || {};
  return assets.defaultProductImage || '/static/default-product.svg';
}
