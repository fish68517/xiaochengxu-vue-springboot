// 品牌配置客户端模块：
// loadBrandConfig(appId) —— 走 api.js 通道，5 分钟缓存；生产环境品牌解析失败时阻断业务页。
// applyBrand(cfg) —— 把 themeTokens 写入全局 CSS 变量（H5 写 document.documentElement；小程序由页面根节点 :style 绑定），返回 copy 字典。
import { reactive } from 'vue';
import { api, BRAND_CODE } from './api.js';
import { clientorderCopy } from './static/content-assets.js';

export const DEFAULT_THEME = {
  primary: '#5b63f6',
  secondary: '#5b83f7',
  bg: '#f5f7fb',
  text: '#101828',
  border: '#e4e7ec',
  radius: '24rpx',
};

const CACHE_KEY = '__brand_config_v1__';
const CACHE_TTL = 5 * 60 * 1000;
const ALLOW_DEFAULT_BRAND = import.meta.env.DEV || import.meta.env.VITE_ALLOW_DEFAULT_BRAND === 'true';

function buildVars(tokens) {
  return {
    '--brand-primary': tokens.primary || DEFAULT_THEME.primary,
    '--brand-secondary': tokens.secondary || DEFAULT_THEME.secondary,
    '--brand-bg': tokens.bg || DEFAULT_THEME.bg,
    '--brand-text': tokens.text || DEFAULT_THEME.text,
    '--brand-border': tokens.border || DEFAULT_THEME.border,
    '--brand-radius': tokens.radius || DEFAULT_THEME.radius,
  };
}

// 品牌文案覆盖默认文案，缺键自动回退 content-assets.js 占位。
// 数组字段不接受标量覆盖（避免破坏 v-for），仅当品牌值类型与默认一致时才覆盖。
function mergeCopy(brandCopy) {
  const merged = { ...clientorderCopy };
  for (const [key, value] of Object.entries(brandCopy || {})) {
    if (value === undefined || value === null || value === '') continue;
    const fallback = merged[key];
    if (Array.isArray(fallback) && !Array.isArray(value)) continue;
    if (typeof fallback === 'string' && typeof value !== 'string') continue;
    merged[key] = value;
  }
  return merged;
}

// 响应式状态：页面直接绑定 brandState.vars / brandState.copy，App.onLaunch 后原地更新。
export const brandState = reactive({
  brand: null,
  vars: buildVars(DEFAULT_THEME),
  copy: { ...clientorderCopy },
  status: 'loading',
  errorCode: '',
  errorMessage: '',
});

export function getAppId() {
  try {
    if (typeof wx !== 'undefined' && wx.getAccountInfoSync) {
      const info = wx.getAccountInfoSync();
      return (info && info.miniProgram && info.miniProgram.appId) || '';
    }
  } catch (e) {
    // H5 或无 wx 环境：使用默认品牌
  }
  return '';
}

export function applyBrand(cfg) {
  const tokens = { ...DEFAULT_THEME, ...((cfg && cfg.themeTokens) || {}) };
  const vars = buildVars(tokens);
  if (typeof document !== 'undefined' && document.documentElement) {
    Object.keys(vars).forEach((k) => document.documentElement.style.setProperty(k, vars[k]));
  }
  // 原地更新，保持页面持有的引用仍响应式
  Object.assign(brandState.vars, vars);
  Object.assign(brandState.copy, mergeCopy(cfg && cfg.copy));
  brandState.brand = cfg || null;
  return (cfg && cfg.copy) || {};
}

export async function loadBrandConfig(appId) {
  const aid = appId === undefined || appId === null ? getAppId() : appId;
  brandState.status = 'loading';
  brandState.errorCode = '';
  brandState.errorMessage = '';
  try {
    const cached = uni.getStorageSync(CACHE_KEY);
    if (cached && cached.appId === aid && cached.brandCode === BRAND_CODE && cached.ts && Date.now() - cached.ts < CACHE_TTL && cached.brand) {
      applyBrand(cached.brand);
      brandState.status = 'success';
      return cached.brand;
    }
  } catch (e) {
    // 缓存读取失败忽略，走网络
  }

  let brand = null;
  try {
    brand = await api.getBrandConfig({ appId: aid, brandCode: BRAND_CODE });
  } catch (e) {
    const message = (e && e.message) || '品牌配置加载失败';
    brandState.errorCode = (e && e.code) || (/UNKNOWN_BRAND/.test(message) ? 'UNKNOWN_BRAND' : 'NETWORK_ERROR');
    brandState.errorMessage = message;
    brandState.status = /BRAND_DISABLED/.test(message) ? 'disabled' : (/UNKNOWN_BRAND|BRAND_CONTEXT_REQUIRED/.test(message) ? 'unknown' : 'network-error');
    if (!ALLOW_DEFAULT_BRAND) throw e;
  }

  if (!brand || !brand.brandId) {
    if (!ALLOW_DEFAULT_BRAND) throw new Error(brandState.errorMessage || '未解析到有效品牌');
    brand = {
      brandId: 'default',
      appId: aid,
      name: '默认品牌',
      logo: '',
      themeTokens: { ...DEFAULT_THEME },
      copy: {},
      banners: [],
    };
  }
  applyBrand(brand);
  brandState.status = 'success';
  try {
    uni.setStorageSync(CACHE_KEY, { appId: aid, brandCode: BRAND_CODE, ts: Date.now(), brand });
  } catch (e) {
    // 缓存写入失败忽略
  }
  return brand;
}

export function retryBrandConfig() {
  try { uni.removeStorageSync(CACHE_KEY); } catch (e) { /* 忽略缓存清理失败 */ }
  return loadBrandConfig(getAppId());
}

export function getBrandCopy() { return brandState.copy; }
export function getBrandVars() { return brandState.vars; }
