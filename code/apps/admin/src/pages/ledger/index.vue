<template>
  <AdminShell title="佣金账本">
  <view class="page">
    <PageHeader eyebrow="FINANCIAL LEDGER" title="佣金账本与退款追佣" description="查看佣金规则版本、钱包流水与退款追佣反向记录" />
    <view class="tabs"><button v-for="tab in tabs" :key="tab.key" class="tab" :class="{ active: active === tab.key }" @click="switchTab(tab.key)">{{ tab.label }}</button></view>
    <AsyncState :loading="loading" :error="error" :permission-denied="denied" :empty="!loading && !error && visibleRows.length === 0" :empty-text="emptyText" @retry="load" />

    <template v-if="active === 'rules' && !loading">
      <view class="form"><input v-model="brandId" class="input" placeholder="品牌 ID（保存规则必填）" /><picker :range="ruleTypes" :value="ruleTypeIndex" @change="ruleTypeIndex = Number($event.detail.value)"><view class="picker">{{ ruleTypes[ruleTypeIndex] }}</view></picker><input v-model.number="ruleValue" class="input" type="number" placeholder="固定分/百分比" /><button class="btn" @click="saveRule">保存 DEMO_ONLY 版本</button></view>
      <view v-for="row in rules" :key="row._id" class="card"><text class="strong">{{ row.brandId }} · v{{ row.version }}</text><text>{{ row.status }} · {{ ruleText(row) }}</text><text>{{ formatTime(row.effectiveAt) }}</text></view>
    </template>

    <template v-if="active === 'ledger' && !loading">
      <view class="form"><picker :range="workerLabels" :value="workerIndex" @change="changeWorker"><view class="picker">{{ workerLabels[workerIndex] || '选择接单人员' }}</view></picker><button class="btn" @click="reconcile">重算对账</button></view>
      <view v-if="reconcileText" class="alert" :class="{ danger: reconcileDiff }">{{ reconcileText }}</view>
      <scroll-view v-if="transactions.length" scroll-x class="table-wrap"><view class="table"><view class="tr th"><text>时间</text><text>类型</text><text>订单/引用</text><text>方向</text><text>金额</text><text>规则版本</text><text>状态</text></view><view v-for="row in transactions" :key="row._id" class="tr"><text>{{ formatTime(row.createdAt) }}</text><text>{{ row.type }}</text><text>{{ row.orderId || row.refundId || row.referenceId || '—' }}</text><text>{{ row.direction || (row.amountFen < 0 ? 'DEBIT' : 'CREDIT') }}</text><MoneyText :amount-fen="row.amountFen"/><text>{{ row.ruleVersion || '—' }}</text><text>{{ row.status || 'POSTED' }}</text></view></view></scroll-view>
    </template>

    <template v-if="active === 'refunds' && !loading">
      <view v-for="row in refunds" :key="row._id || row.id" class="card"><view><text class="strong">{{ row.orderNo }}</text><OrderStatusTag :status="row.status" /></view><text>{{ row.productSnapshot?.title || row.productId }} · 原支付 {{ row.paymentId || '待迁移' }}</text><text>退款状态：{{ row.refundStatus || '见详情' }} · 追佣采用 REFUND_CLAWBACK 反向流水</text></view>
    </template>
  </view>
  </AdminShell>
</template>
<script setup>
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api, getActiveBrandId } from '../../api.js';
import AsyncState from '../../components/AsyncState.vue';
import MoneyText from '../../components/MoneyText.vue';
import OrderStatusTag from '../../components/OrderStatusTag.vue';
const tabs = [{ key: 'rules', label: '佣金规则' }, { key: 'ledger', label: '账本流水' }, { key: 'refunds', label: '退款追佣' }];
const active = ref('rules'); const loading = ref(false); const error = ref(''); const denied = ref(false); const rules = ref([]); const transactions = ref([]); const refunds = ref([]); const workers = ref([]); const workerIndex = ref(0); const brandId = ref(getActiveBrandId()); const ruleTypes = ['percent', 'fixed']; const ruleTypeIndex = ref(0); const ruleValue = ref(20); const reconcileText = ref(''); const reconcileDiff = ref(false);
const workerLabels = computed(() => workers.value.map((worker) => `${worker.nickname || worker.phone || worker._id}（${worker._id}）`));
const visibleRows = computed(() => active.value === 'rules' ? rules.value : active.value === 'ledger' ? transactions.value : refunds.value);
const emptyText = computed(() => active.value === 'ledger' && !workers.value.length ? '暂无可查询接单人员' : '暂无数据');
function formatTime(value) { return value ? new Date(value).toLocaleString() : '—'; }
function ruleText(row) { return row.rule?.type === 'fixed' ? `固定 ¥${((row.rule.valueFen || 0) / 100).toFixed(2)}` : `比例 ${row.rule?.valuePercent || 0}%`; }
function switchTab(key) { active.value = key; load(); }
async function load() { loading.value = true; error.value = ''; denied.value = false; try { if (active.value === 'rules') rules.value = await api.listCommissionRules({ brandId: brandId.value || undefined }); else if (active.value === 'refunds') { const all = await Promise.all([api.listOrders({ status: 'REFUNDING' }), api.listOrders({ status: 'REFUNDED' })]); refunds.value = all.flat().filter((row, index, arr) => arr.findIndex((item) => (item._id || item.id) === (row._id || row.id)) === index); } else { workers.value = workers.value.length ? workers.value : await api.listWorkers(); await loadTransactions(); } } catch (e) { error.value = e.message || '加载失败'; denied.value = e.code === 403 || e.code === 'FORBIDDEN'; } finally { loading.value = false; } }
async function loadTransactions() { const worker = workers.value[workerIndex.value]; transactions.value = worker ? await api.walletTransactions({ workerId: worker._id }) : []; }
async function changeWorker(event) { workerIndex.value = Number(event.detail.value); await loadTransactions(); }
async function saveRule() { if (!brandId.value) { uni.showToast({ title: '请先选择或输入品牌 ID', icon: 'none' }); return; } const type = ruleTypes[ruleTypeIndex.value]; const rule = type === 'fixed' ? { type, valueFen: Number(ruleValue.value) } : { type, valuePercent: Number(ruleValue.value) }; try { await api.saveCommissionRule({ brandId: brandId.value, rule, status: 'DEMO_ONLY' }); await load(); uni.showToast({ title: '规则版本已保存', icon: 'success' }); } catch (e) { uni.showToast({ title: e.message || '保存失败', icon: 'none' }); } }
async function reconcile() { const worker = workers.value[workerIndex.value]; if (!worker) return; try { const result = await api.reconcileWalletLedger({ workerId: worker._id }); const row = Array.isArray(result) ? result[0] : null; reconcileDiff.value = !row?.ok; reconcileText.value = row?.ok ? '对账通过：钱包与账本一致' : `发现差异：${row?.differenceFen || 0} 分，请复核`; } catch (e) { reconcileDiff.value = true; reconcileText.value = e.message || '对账失败'; } }
onLoad(load);
</script>
<style lang="scss" scoped>
.page{padding:24rpx}.head,.form,.card,.table-wrap,.alert{background:var(--es-bg-panel);border:1rpx solid var(--es-border-soft);border-radius:var(--es-radius)}.head{padding:28rpx;margin-bottom:18rpx}.title{font-size:36rpx;font-weight:700;color:var(--es-primary)}.tabs,.form{display:flex;gap:12rpx;margin-bottom:18rpx}.tab,.btn{font-size:24rpx;color:var(--es-text-dim);background:transparent;border:1rpx solid var(--es-border-soft)}.tab.active,.btn{color:var(--es-primary);border-color:var(--es-primary)}.form{padding:16rpx;flex-wrap:wrap}.input,.picker{height:68rpx;line-height:68rpx;padding:0 16rpx;min-width:220rpx;background:#0f172a;color:var(--es-text);border:1rpx solid var(--es-border-soft);border-radius:var(--es-radius)}.card{display:flex;flex-direction:column;gap:10rpx;padding:20rpx;margin-bottom:12rpx;color:var(--es-text);font-size:24rpx}.strong{margin-right:16rpx;color:var(--es-primary);font-weight:600}.alert{padding:16rpx;margin-bottom:14rpx;color:var(--es-success)}.alert.danger{color:var(--es-danger)}.table{min-width:1350rpx}.tr{display:grid;grid-template-columns:250rpx 220rpx 260rpx 140rpx 160rpx 150rpx 160rpx;align-items:center;min-height:80rpx;border-bottom:1rpx solid var(--es-border-soft)}.tr>*{padding:10rpx;font-size:22rpx}.th{color:var(--es-primary)}
</style>
