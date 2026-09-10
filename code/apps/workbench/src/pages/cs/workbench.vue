<template>
  <WorkbenchShell role="cs" active="dashboard" title="客服工作台" subtitle="聚合需要立即处理的订单、售后和资金待办">
    <template #actions>
      <picker v-if="brandOptions.length > 2" :range="brandOptions" range-key="name" :value="brandIndex" @change="switchBrand">
        <view class="brand-switch">{{ brandOptions[brandIndex]?.name || '全部授权品牌' }} ▾</view>
      </picker>
    </template>
    <view v-if="error" class="error-box"><view><text class="error-title">待办加载失败</text><text class="error-text">{{ error }}</text></view><button class="retry-btn" @click="load">重新加载</button></view>
    <view class="todo-grid"><view v-for="(item,index) in todoCards" :key="item.key" class="todo-card" @click="go(item.url)"><view class="todo-top"><view class="todo-icon" :class="`tone-${index}`"><view class="todo-shape"/></view><text class="todo-arrow">›</text></view><text class="todo-count">{{ item.count }}</text><text class="todo-label">{{ item.label }}</text><text class="todo-action">查看待办</text></view></view>
    <view class="overview-grid"><view class="recent-panel"><view class="panel-head"><view><text class="panel-title">处理建议</text><text class="panel-subtitle">按优先级开始今天的工作</text></view><text class="refresh-time">{{ lastRefresh }}</text></view><view class="recommendation"><view class="recommend-mark urgent"/><view><text>优先处理待受理与超时订单</text><text>减少客户等待时间，必要时及时指派服务人员。</text></view></view><view class="recommendation"><view class="recommend-mark"/><view><text>及时核对完成凭证</text><text>确认服务结果后完成结单或进入售后流程。</text></view></view></view><view class="status-panel"><text class="panel-title">今日状态</text><view class="status-ring"><view><text>{{ total }}</text><text>全部待办</text></view></view><text class="status-note">数据每 {{ pollSeconds }} 秒自动刷新</text></view></view>
  </WorkbenchShell>
</template>

<script setup>
import { reactive, ref, computed } from 'vue';
import { onLoad, onUnload } from '@dcloudio/uni-app';
import { api, getActiveBrandId, setActiveBrandId } from '../../api.js';
import { guard, go, playBeep, startPoll } from '../../common.js';
import WorkbenchShell from '../../components/WorkbenchShell.vue';

const todos = reactive({ pendingAccept: 0, pendingConfirm: 0, disputing: 0, pendingRefund: 0, pendingWithdrawal: 0 });
const error = ref('');
const brandOptions = ref([{ brandId: '', name: '全部授权品牌' }]);
const brandIndex = ref(0);
let stop = null;
const lastRefresh = ref('等待首次刷新');
const pollSeconds = ref(10);

const todoCards = computed(() => [
  { key: 'pendingAccept', label: '待受理', count: todos.pendingAccept, url: '/pages/cs/orders?status=PENDING_ACCEPT' },
  { key: 'pendingConfirm', label: '待确认', count: todos.pendingConfirm, url: '/pages/cs/orders?status=PENDING_CONFIRM' },
  { key: 'disputing', label: '异议', count: todos.disputing, url: '/pages/cs/orders?status=DISPUTING' },
  { key: 'pendingRefund', label: '待审批退款', count: todos.pendingRefund, url: '/pages/cs/approvals?tab=refunds' },
  { key: 'pendingWithdrawal', label: '待审批提现', count: todos.pendingWithdrawal, url: '/pages/cs/approvals?tab=withdrawals' },
]);

const total = computed(() => Object.values(todos).reduce((a, b) => a + b, 0));

// 拉取待办计数：以订单状态 + 提现状态统计，声音提醒在总量增加时触发
async function load() {
  error.value = '';
  const before = total.value;
  try {
  const summary = await api.dashboard();
  const next = {
    pendingAccept: Number(summary.pendingAcceptOrders || 0),
    pendingConfirm: Number(summary.pendingConfirmOrders || 0),
    disputing: Number(summary.pendingDisputes || 0),
    pendingRefund: Number(summary.pendingRefunds || 0),
    pendingWithdrawal: Number(summary.pendingWithdrawals || 0),
  };
  Object.assign(todos, next);
  if (total.value > before) playBeep();
  lastRefresh.value = `最近刷新 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  } catch (e) { error.value = e.message || '暂时无法读取待办'; }
}

function initBrandSwitcher() {
  const profile = uni.getStorageSync('accessProfile') || {};
  const scopes = (profile.brandScopes || []).filter((item) => item && item !== '*');
  brandOptions.value = [{ brandId: '', name: '全部授权品牌' }, ...scopes.map((brandId) => ({ brandId, name: brandId }))];
  const found = brandOptions.value.findIndex((item) => item.brandId === getActiveBrandId());
  brandIndex.value = found >= 0 ? found : 0;
  if (found < 0) setActiveBrandId('');
}

function switchBrand(event) {
  brandIndex.value = Number(event.detail.value) || 0;
  setActiveBrandId(brandOptions.value[brandIndex.value]?.brandId || '');
  Object.keys(todos).forEach((key) => { todos[key] = 0; });
  load();
}

onLoad(async () => {
  if (!guard(['CS'])) return;
  initBrandSwitcher();
  try {
    const config = await api.getRuntimeConfig();
    pollSeconds.value = Number(config.pollIntervalSeconds) || 10;
  } catch (_error) { /* 配置不可用时使用安全默认值；业务统计仍由后端负责 */ }
  stop = startPoll(load, pollSeconds.value * 1000);
});

onUnload(() => { if (stop) stop(); });
</script>

<style lang="scss" scoped>
.brand-switch{height:38px;padding:0 14px;display:flex;align-items:center;color:var(--es-primary);font-size:13px;font-weight:600;background:#fff;border:1px solid #c7d7fe;border-radius:9px}.todo-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}.todo-card{min-height:158px;padding:18px;position:relative;background:#fff;border:1px solid var(--es-border-soft);border-radius:14px;box-shadow:var(--es-glow);cursor:pointer;transition:transform .18s ease,box-shadow .18s ease}.todo-card:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(16,24,40,.09)}.todo-top{display:flex;justify-content:space-between}.todo-icon{width:38px;height:38px;display:flex;align-items:center;justify-content:center;background:#eef0ff;border-radius:10px}.todo-icon i{width:14px;height:14px;border:3px solid #5b63f6;border-radius:50%}.tone-1{background:#e9f8f1}.tone-1 i{border-color:#12b76a}.tone-2{background:#fff3e0}.tone-2 i{border-color:#f79009}.tone-3{background:#fef3f2}.tone-3 i{border-color:#f04438}.tone-4{background:#f3edff}.tone-4 i{border-color:#7c3aed}.todo-arrow{color:#98a2b3;font-size:24px}.todo-count{display:block;margin-top:12px;color:var(--es-text);font-size:30px;font-weight:700}.todo-label{display:block;margin-top:3px;color:var(--es-text-dim);font-size:13px}.todo-action{display:block;margin-top:12px;color:var(--es-primary);font-size:11px;font-weight:600}.overview-grid{margin-top:18px;display:grid;grid-template-columns:minmax(0,2fr) minmax(260px,1fr);gap:18px}.recent-panel,.status-panel{padding:22px;background:#fff;border:1px solid var(--es-border-soft);border-radius:14px}.panel-head{margin-bottom:6px;display:flex;justify-content:space-between}.panel-title{display:block;color:var(--es-text);font-size:16px;font-weight:700}.panel-subtitle,.refresh-time{display:block;margin-top:4px;color:var(--es-text-dim);font-size:12px}.recommendation{padding:18px 0;display:flex;align-items:flex-start;gap:13px;border-bottom:1px solid var(--es-border-soft)}.recommendation:last-child{border-bottom:0}.recommend-mark{width:10px;height:10px;margin-top:5px;flex:none;background:var(--es-primary);border-radius:50%;box-shadow:0 0 0 5px #eef0ff}.recommend-mark.urgent{background:var(--es-warning);box-shadow:0 0 0 5px #fff3e0}.recommendation text{display:block}.recommendation text:first-child{font-size:14px;font-weight:600}.recommendation text:last-child{margin-top:5px;color:var(--es-text-dim);font-size:12px;line-height:1.55}.status-panel{text-align:center}.status-panel>.panel-title{text-align:left}.status-ring{width:146px;height:146px;margin:22px auto 16px;padding:11px;border-radius:50%;background:conic-gradient(var(--es-primary) 0 72%,#eef0ff 72%)}.status-ring>view{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;border-radius:50%}.status-ring text:first-child{font-size:32px;font-weight:700}.status-ring text:last-child{margin-top:3px;color:var(--es-text-dim);font-size:11px}.status-note{color:var(--es-text-dim);font-size:12px}.error-box{margin-bottom:16px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fef3f2;border:1px solid #fecdca;border-radius:10px}.error-title,.error-text{display:block;color:#b42318;font-size:13px}.error-title{font-weight:700}.error-text{margin-top:3px;font-size:12px}.retry-btn{width:auto;height:34px;margin:0;padding:0 13px;color:#b42318;font-size:12px;line-height:34px;background:#fff;border:1px solid #fda29b;border-radius:8px}
@media(max-width:1050px){.todo-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:767px){.todo-grid{grid-template-columns:repeat(2,1fr);gap:10px}.todo-card{min-height:138px;padding:15px}.overview-grid{grid-template-columns:1fr}.status-panel{display:none}.brand-switch{height:34px}.todo-count{font-size:26px}}
.todo-shape{width:14px;height:14px;border:3px solid #5b63f6;border-radius:50%}.tone-1 .todo-shape{border-color:#12b76a}.tone-2 .todo-shape{border-color:#f79009}.tone-3 .todo-shape{border-color:#f04438}.tone-4 .todo-shape{border-color:#7c3aed}
</style>
