<template>
  <AdminShell title="管理概览">
  <view class="page">
    <PageHeader eyebrow="OPERATIONS OVERVIEW" title="管理概览" description="实时掌握订单履约、待办事项与品牌运营状态">
      <picker v-if="brandOptions.length > 1" :range="brandOptions" range-key="name" :value="brandIndex" @change="switchBrand">
        <view class="brand-switch">当前品牌：{{ brandOptions[brandIndex]?.name || '全部授权品牌' }} ▾</view>
      </picker>
    </PageHeader>

    <view class="grid">
      <view v-for="(card,index) in cards" :key="card.label" class="stat-card">
        <view class="stat-top"><text class="stat-label">{{ card.label }}</text><view class="stat-icon" :class="`tone-${index}`">{{ ['订','待','服','员'][index] }}</view></view>
        <text class="stat-value">{{ card.value }}</text><text class="stat-trend">本地演示数据 · 实时更新</text>
      </view>
    </view>

    <view class="dashboard-layout"><view class="panel todo-panel">
      <view class="panel-head"><view><text class="panel-title">待办提醒</text><text class="panel-sub">按业务优先级处理当前事项</text></view><text class="refresh" @click="load">刷新</text></view>
      <view v-if="todoError" class="empty">
        <text>{{ todoError }}</text>
        <button class="mini-btn" @click="load">重试</button>
      </view>
      <view v-else>
        <view v-for="t in todos" :key="t.label" class="todo-row" @click="go(t.url)">
          <view class="todo-label"><view class="todo-dot"/><text>{{ t.label }}</text></view><view class="todo-count"><text>{{ t.value }}</text><text>单</text><text class="todo-arrow">›</text></view>
        </view>
      </view>
    </view><view class="panel quick-panel"><view class="panel-head"><view><text class="panel-title">快捷入口</text><text class="panel-sub">常用运营模块</text></view></view><view class="nav-grid">
      <view v-for="nav in navs" :key="nav.url" class="nav-item" @click="go(nav.url)">
        <view class="nav-icon">{{ nav.label.slice(0,1) }}</view><text class="nav-label">{{ nav.label }}</text><text class="nav-arrow">›</text>
      </view>
    </view></view></view>
  </view>
  </AdminShell>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api, getActiveBrandId, setActiveBrandId } from '../../api.js';

const cards = ref([]);
const todos = ref([]);
const todoError = ref('');
const brandOptions = ref([{ brandId: '', name: '全部授权品牌' }]);
const brandIndex = ref(0);

const allNavs = [
  { key: 'orders', label: '订单管理', url: '/pages/orders/index' },
  { key: 'products', label: '商品管理', url: '/pages/products/index' },
  { key: 'accounts', label: '账号管理', url: '/pages/accounts/index' },
  { key: 'ledger', label: '佣金账本/退款追佣', url: '/pages/ledger/index' },
  { key: 'withdrawals', label: '提现审批与出款', url: '/pages/withdrawals/index' },
  { key: 'disputes', label: '异议仲裁', url: '/pages/disputes/index' },
  { key: 'access', label: '角色与品牌权限', url: '/pages/access/index' },
  { key: 'audit', label: '审计日志', url: '/pages/audit/index' },
  { key: 'brands', label: '品牌配置', url: '/pages/brands/index' },
  { key: 'configs', label: '字典管理', url: '/pages/dicts/index' },
  { key: 'configs', label: '配置管理', url: '/pages/configs/index' },
  { key: 'accounts', label: 'VIP 名单', url: '/pages/vips/index' },
  { key: 'wallets', label: '钱包管理', url: '/pages/wallets/index' },
  { key: 'reports', label: '报表', url: '/pages/reports/index' },
];
const navs = ref([]);

function go(url) { uni.navigateTo({ url }); }

// 数字兜底：后端缺字段时展示 0，避免渲染 undefined。
function num(v) { return Number(v) || 0; }

// 加载 dashboard 待办分区计数并映射为卡片与待办跳转。
async function load() {
  todoError.value = '';
  try {
    const access = (await api.getAccessProfile()) || {};
    uni.setStorageSync('accessProfile', access);
    const roles = access.roles || [];
    const scopes = (access.brandScopes || []).filter((item) => item && item !== '*');
    let brands = [];
    if (roles.some((role) => ['ADMIN', 'SUPER_ADMIN', 'BRAND_ADMIN'].includes(role))) {
      brands = await api.listBrands().catch(() => []);
    }
    if (!brands.length) brands = scopes.map((brandId) => ({ brandId, name: brandId }));
    brandOptions.value = [{ brandId: '', name: '全部授权品牌' }, ...brands.map((item) => ({ brandId: item.brandId, name: item.name || item.brandId }))];
    const active = getActiveBrandId();
    const found = brandOptions.value.findIndex((item) => item.brandId === active);
    brandIndex.value = found >= 0 ? found : 0;
    if (found < 0) setActiveBrandId('');
    const menus = access.visibleMenus || [];
    navs.value = menus.includes('*') ? allNavs : allNavs.filter((item) => menus.includes(item.key));
    const d = (await api.dashboard()) || {};
    cards.value = [
      { label: '订单总数', value: num(d.totalOrders) },
      { label: '待受理', value: num(d.pendingAcceptOrders) },
      { label: '服务中', value: num(d.inServiceOrders) },
      { label: '接单人员', value: num(d.workers) },
    ];
    todos.value = [
      { label: '待受理订单', value: num(d.pendingAcceptOrders), url: '/pages/orders/index' },
      { label: '待确认结单', value: num(d.pendingConfirmOrders), url: '/pages/orders/index' },
      { label: '待审批退款', value: num(d.pendingRefunds), url: '/pages/ledger/index' },
      { label: '待审批提现', value: num(d.pendingWithdrawals), url: '/pages/withdrawals/index' },
      { label: '异议处理', value: num(d.pendingDisputes), url: '/pages/disputes/index' },
    ];
  } catch (e) {
    todoError.value = e.message || '待办加载失败';
    cards.value = [
      { label: '订单总数', value: 0 },
      { label: '待受理', value: 0 },
      { label: '服务中', value: 0 },
      { label: '接单人员', value: 0 },
    ];
    todos.value = [];
  }
}

function switchBrand(event) {
  brandIndex.value = Number(event.detail.value) || 0;
  setActiveBrandId(brandOptions.value[brandIndex.value]?.brandId || '');
  cards.value = [];
  todos.value = [];
  load();
}

onLoad(load);
</script>

<style lang="scss" scoped>
.brand-switch{padding:9px 13px;color:var(--es-primary);font-size:12px;font-weight:650;background:#fff;border:1px solid #c7d2fe;border-radius:8px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:18px}.stat-card{padding:18px;background:#fff;border:1px solid var(--es-border-soft);border-radius:var(--es-radius);box-shadow:var(--es-glow)}.stat-top{display:flex;align-items:center;justify-content:space-between}.stat-label{color:var(--es-text-dim);font-size:12px;font-weight:600}.stat-icon{width:34px;height:34px;display:flex;align-items:center;justify-content:center;color:#4f46e5;font-size:12px;font-weight:700;background:#eef2ff;border-radius:9px}.tone-1{color:#dc6803;background:#fffaeb}.tone-2{color:#079455;background:#ecfdf3}.tone-3{color:#0284c7;background:#f0f9ff}.stat-value{display:block;margin-top:13px;color:var(--es-text);font-size:30px;font-weight:780;font-variant-numeric:tabular-nums}.stat-trend{display:block;margin-top:5px;color:var(--es-text-soft);font-size:10px}.dashboard-layout{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(320px,.8fr);gap:18px}.panel{padding:18px;background:#fff;border:1px solid var(--es-border-soft);border-radius:var(--es-radius);box-shadow:var(--es-glow)}.panel-head{min-height:38px;display:flex;align-items:flex-start;justify-content:space-between}.panel-title,.panel-sub{display:block}.panel-title{color:var(--es-text);font-size:15px;font-weight:700}.panel-sub{margin-top:4px;color:var(--es-text-soft);font-size:11px}.refresh{color:var(--es-primary);font-size:11px;cursor:pointer}.todo-row{min-height:51px;padding:0 4px;display:flex;align-items:center;justify-content:space-between;color:var(--es-text);font-size:13px;border-bottom:1px solid var(--es-border-soft);cursor:pointer}.todo-row:last-child{border-bottom:0}.todo-label,.todo-count{display:flex;align-items:center}.todo-label{gap:10px}.todo-dot{width:7px;height:7px;background:#818cf8;border-radius:50%}.todo-count{gap:5px}.todo-count>text:first-child{color:var(--es-text);font-size:16px;font-weight:700}.todo-count>text:nth-child(2){color:var(--es-text-soft);font-size:10px}.todo-arrow{margin-left:8px;color:var(--es-text-soft);font-size:20px}.nav-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:15px}.nav-item{min-height:48px;padding:0 10px;display:flex;align-items:center;gap:9px;color:var(--es-text);background:#fafbff;border:1px solid var(--es-border-soft);border-radius:9px;cursor:pointer}.nav-item:hover{border-color:#c7d2fe;background:var(--es-primary-soft)}.nav-icon{width:26px;height:26px;display:flex;align-items:center;justify-content:center;color:var(--es-primary);font-size:11px;font-weight:700;background:#eef2ff;border-radius:7px}.nav-label{min-width:0;flex:1;overflow:hidden;color:var(--es-text);font-size:11px;font-weight:600;text-overflow:ellipsis;white-space:nowrap}.nav-arrow{color:var(--es-text-soft)}.mini-btn{margin-top:10px;padding:6px 12px;font-size:12px}.empty{padding:18px 0;text-align:center;color:var(--es-text-dim);font-size:12px}
@media(max-width:1100px){.grid{grid-template-columns:repeat(2,1fr)}.dashboard-layout{grid-template-columns:1fr}}@media(max-width:560px){.grid{grid-template-columns:1fr}.nav-grid{grid-template-columns:1fr}}
</style>
