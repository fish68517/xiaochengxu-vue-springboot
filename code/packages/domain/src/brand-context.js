// 品牌上下文纯函数：统一解析 brandCode/AppID，并校验员工品牌范围。
// 前端携带的 brandId 只作为候选信息，最终上下文必须由服务端配置与会话共同决定。

export const SUPER_ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);

export function resolveBrandContext(brands, {
  brandCode = '',
  appId = '',
  allowDefault = false,
} = {}) {
  const enabled = (Array.isArray(brands) ? brands : []).filter((brand) => brand && ['ON', 'ACTIVE'].includes(brand.status));
  const byCode = brandCode ? enabled.find((brand) => brand.code === brandCode || brand.brandId === brandCode) : null;
  const byAppId = appId ? enabled.find((brand) => brand.appId === appId || (Array.isArray(brand.appIds) && brand.appIds.includes(appId))) : null;

  if (brandCode && !byCode) throw new Error('UNKNOWN_BRAND');
  if (appId && !byAppId) throw new Error('UNKNOWN_BRAND_CHANNEL');
  if (byCode && byAppId && byCode.brandId !== byAppId.brandId) throw new Error('BRAND_CHANNEL_MISMATCH');

  const brand = byCode || byAppId || (allowDefault ? enabled.find((item) => item.isDefault) : null);
  if (!brand) throw new Error('BRAND_CONTEXT_REQUIRED');
  return {
    brandId: brand.brandId,
    brandCode: brand.code || brand.brandId,
    appId: appId || brand.appId || '',
    version: brand.publishedVersion || brand.version || 1,
  };
}

export function hasBrandAccess(session, brandId) {
  if (!session || !brandId) return false;
  const roles = new Set([session.role, ...(Array.isArray(session.roles) ? session.roles : [])].filter(Boolean));
  if ([...roles].some((role) => SUPER_ADMIN_ROLES.has(role))) return true;
  const scopes = Array.isArray(session.brandScopes) ? session.brandScopes : [];
  return scopes.includes('*') || scopes.includes(brandId);
}

export function assertBrandAccess(session, brandId) {
  if (!hasBrandAccess(session, brandId)) throw new Error('BRAND_FORBIDDEN');
  return true;
}
