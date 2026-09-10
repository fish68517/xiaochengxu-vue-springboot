<template>
  <view class="admin-shell">
    <view v-if="mobileOpen" class="mobile-mask" @click="mobileOpen=false" />
    <view class="sidebar" :class="{ open: mobileOpen }">
      <view class="brand-block">
        <view class="brand-mark">星</view>
        <view><text class="brand-name">星河服务</text><text class="brand-sub">多品牌管理中心</text></view>
      </view>
      <scroll-view scroll-y class="menu-scroll">
        <view v-for="group in visibleGroups" :key="group.label" class="menu-group">
          <text class="group-label">{{ group.label }}</text>
          <view v-for="item in group.items" :key="item.url" class="menu-item" :class="{ active: currentPath===item.path }" @click="go(item)">
            <text class="menu-icon">{{ item.icon }}</text><text>{{ item.label }}</text>
          </view>
        </view>
      </scroll-view>
      <view class="account-block">
        <view class="avatar">{{ userInitial }}</view>
        <view class="account-copy"><text>{{ userName }}</text><text>{{ roleLabel }}</text></view>
        <view class="account-actions"><button class="account-action" aria-label="进入安全中心" @click="openSecurity">安全</button><button class="logout" aria-label="退出登录" @click="logout">退出</button></view>
      </view>
    </view>
    <view class="workspace">
      <view class="topbar">
        <button class="menu-toggle" aria-label="打开导航" @click="mobileOpen=true">☰</button>
        <view class="breadcrumb"><text>管理控制台</text><text>/</text><text>{{ title }}</text></view>
        <view class="top-actions">
          <view class="scope-chip"><text class="scope-dot"/><text>{{ scopeText }}</text></view>
          <view class="user-chip" role="button" tabindex="0" @click="openSecurity"><view class="avatar small">{{ userInitial }}</view><text>{{ userName }}</text><text class="security-link">安全中心</text></view>
        </view>
      </view>
      <scroll-view scroll-y class="content-scroll">
        <view class="admin-content"><slot /></view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { getActiveBrandId } from '../api.js';

defineProps({ title: { type: String, default: '管理概览' } });
const mobileOpen = ref(false);
const currentPath = ref('');
const profile = ref({});
const user = ref({});

const groups = [
  { label: '总览', items: [{ key: 'dashboard', label: '管理概览', path: 'pages/dashboard/index', url: '/pages/dashboard/index', icon: '概' }] },
  { label: '业务运营', items: [
    { key: 'orders', label: '订单管理', path: 'pages/orders/index', url: '/pages/orders/index', icon: '订' },
    { key: 'products', label: '商品管理', path: 'pages/products/index', url: '/pages/products/index', icon: '商' },
    { key: 'brands', label: '品牌配置', path: 'pages/brands/index', url: '/pages/brands/index', icon: '牌' },
    { key: 'accounts', label: '账号管理', path: 'pages/accounts/index', url: '/pages/accounts/index', icon: '员' },
    { key: 'vips', label: 'VIP 名单', path: 'pages/vips/index', url: '/pages/vips/index', icon: 'V' },
  ] },
  { label: '资金与风控', items: [
    { key: 'ledger', label: '佣金账本', path: 'pages/ledger/index', url: '/pages/ledger/index', icon: '账' },
    { key: 'wallets', label: '钱包管理', path: 'pages/wallets/index', url: '/pages/wallets/index', icon: '钱' },
    { key: 'withdrawals', label: '提现审批', path: 'pages/withdrawals/index', url: '/pages/withdrawals/index', icon: '提' },
    { key: 'disputes', label: '异议仲裁', path: 'pages/disputes/index', url: '/pages/disputes/index', icon: '裁' },
    { key: 'reports', label: '经营报表', path: 'pages/reports/index', url: '/pages/reports/index', icon: '表' },
    { key: 'ledger', label: '审核兼容入口', path: 'pages/reviews/index', url: '/pages/reviews/index', icon: '审' },
  ] },
  { label: '系统治理', items: [
    { key: 'security', always: true, label: '安全中心', path: 'pages/security/index', url: '/pages/security/index', icon: '安' },
    { key: 'access', label: '角色与权限', path: 'pages/access/index', url: '/pages/access/index', icon: '权' },
    { key: 'audit', label: '审计日志', path: 'pages/audit/index', url: '/pages/audit/index', icon: '迹' },
    { key: 'configs', label: '业务字典', path: 'pages/dicts/index', url: '/pages/dicts/index', icon: '字' },
    { key: 'configs', label: '系统配置', path: 'pages/configs/index', url: '/pages/configs/index', icon: '设' },
  ] },
];

const visibleGroups = computed(() => {
  const menus = profile.value.visibleMenus || [];
  const all = menus.includes('*') || !menus.length;
  return groups.map((group) => ({ ...group, items: group.items.filter((item) => item.always || all || menus.includes(item.key)) })).filter((group) => group.items.length);
});
const userName = computed(() => user.value.nickname || user.value.phone || '管理员');
const userInitial = computed(() => userName.value.slice(0, 1));
const roleLabel = computed(() => ({ SUPER_ADMIN: '超级管理员', ADMIN: '平台管理员', BRAND_ADMIN: '品牌管理员', FINANCE_REVIEWER: '财务审核员', ARBITRATOR: '仲裁人员' }[user.value.role] || user.value.role || '管理人员'));
const scopeText = computed(() => getActiveBrandId() || ((profile.value.brandScopes || []).includes('*') ? '全部品牌' : (profile.value.brandScopes || []).join('、') || '授权品牌'));

function syncContext() {
  try { user.value = uni.getStorageSync('user') || {}; profile.value = uni.getStorageSync('accessProfile') || {}; } catch (_e) { user.value = {}; profile.value = {}; }
  currentPath.value = globalThis.location?.hash?.replace(/^#\//, '').split('?')[0] || '';
}
function go(item) { mobileOpen.value = false; if (currentPath.value === item.path) return; uni.redirectTo({ url: item.url }); }
function openSecurity() { mobileOpen.value = false; if (currentPath.value !== 'pages/security/index') uni.redirectTo({ url: '/pages/security/index' }); }
function logout() { try { uni.removeStorageSync('token'); uni.removeStorageSync('user'); uni.removeStorageSync('accessProfile'); uni.removeStorageSync('mustChangePwd'); uni.removeStorageSync('__admin_active_brand__'); } catch (_e) { /* 本地存储不可用时仍返回登录页 */ } uni.reLaunch({ url: '/pages/login/index' }); }
onShow(syncContext);
</script>

<style lang="scss" scoped>
.admin-shell{height:100vh;display:flex;overflow:hidden;background:var(--es-bg);color:var(--es-text)}
.sidebar{width:232px;flex:none;display:flex;flex-direction:column;color:#d1d5db;background:var(--es-sidebar);z-index:40}.brand-block{height:72px;padding:0 20px;display:flex;align-items:center;gap:12px;border-bottom:1px solid rgba(255,255,255,.08)}.brand-mark{width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:17px;font-weight:800;background:linear-gradient(135deg,#6366f1,#14b8a6);border-radius:10px}.brand-name,.brand-sub{display:block}.brand-name{color:#fff;font-size:15px;font-weight:700}.brand-sub{margin-top:3px;color:#8b95a7;font-size:11px}.menu-scroll{min-height:0;flex:1;padding:16px 12px}.menu-group{margin-bottom:18px}.group-label{display:block;padding:0 10px 7px;color:#778195;font-size:11px}.menu-item{height:40px;padding:0 10px;margin:2px 0;display:flex;align-items:center;gap:11px;color:#aeb7c7;font-size:13px;border-radius:8px;cursor:pointer;transition:background .16s,color .16s}.menu-item:hover{color:#fff;background:rgba(255,255,255,.06)}.menu-item.active{color:#fff;background:linear-gradient(90deg,#4f46e5,#5b56df)}.menu-icon{width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:1px solid currentColor;border-radius:6px}.account-block{min-height:72px;padding:12px;display:flex;align-items:center;gap:9px;border-top:1px solid rgba(255,255,255,.08)}.avatar{width:34px;height:34px;flex:none;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:700;background:#4f46e5;border-radius:50%}.avatar.small{width:28px;height:28px}.account-copy{min-width:0;flex:1}.account-copy text{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.account-copy text:first-child{color:#fff;font-size:12px}.account-copy text:last-child{margin-top:2px;color:#8290a5;font-size:10px}.account-actions{display:flex;align-items:center;gap:2px}.account-action,.logout{width:auto;margin:0;padding:5px;color:#98a2b3;font-size:11px;line-height:1;background:transparent;border:0}.account-action{color:#c7d2fe}.workspace{min-width:0;flex:1;display:flex;flex-direction:column}.topbar{height:64px;flex:none;padding:0 24px;display:flex;align-items:center;justify-content:space-between;background:#fff;border-bottom:1px solid var(--es-border-soft)}.breadcrumb{display:flex;align-items:center;gap:8px;color:var(--es-text-soft);font-size:13px}.breadcrumb text:last-child{color:var(--es-text);font-weight:600}.top-actions,.scope-chip,.user-chip{display:flex;align-items:center}.top-actions{gap:16px}.scope-chip{gap:7px;padding:7px 10px;color:var(--es-text-dim);font-size:12px;background:#f8fafc;border:1px solid var(--es-border-soft);border-radius:999px}.scope-dot{width:7px;height:7px;background:var(--es-success);border-radius:50%}.user-chip{gap:8px;color:var(--es-text);font-size:12px;cursor:pointer}.security-link{color:var(--es-primary);font-size:11px}.content-scroll{min-height:0;flex:1}.admin-content{width:100%;max-width:1480px;min-height:calc(100vh - 64px);margin:0 auto;padding:24px 28px 40px}.menu-toggle{display:none}.mobile-mask{display:none}
@media(max-width:900px){.sidebar{position:fixed;inset:0 auto 0 0;transform:translateX(-102%);transition:transform .18s ease}.sidebar.open{transform:translateX(0)}.mobile-mask{position:fixed;inset:0;display:block;background:rgba(15,23,42,.5);z-index:35}.topbar{height:58px;padding:0 14px}.menu-toggle{display:block;width:34px;height:34px;margin:0;padding:0;color:var(--es-text);font-size:20px;line-height:34px;background:#fff;border:1px solid var(--es-border-soft);border-radius:8px}.breadcrumb text:first-child,.breadcrumb text:nth-child(2),.user-chip{display:none}.top-actions{gap:8px}.admin-content{min-height:calc(100vh - 58px);padding:16px}.scope-chip{max-width:150px}.scope-chip text:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
@media(prefers-reduced-motion:reduce){.sidebar,.menu-item{transition:none}}
</style>
