<template>
  <AdminShell title="订单管理">
  <view class="page">
    <PageHeader eyebrow="ORDER OPERATIONS" title="订单管理" description="查询全生命周期订单，查看支付、指派、售后和事件记录"><view class="count-badge">{{ rows.length }} 条结果</view></PageHeader>
    <FilterBar><input v-model="keyword" class="input search-input" placeholder="搜索订单号、客户昵称或 UID" /><picker :range="statusLabels" :value="statusIndex" @change="changeStatus"><view class="picker status-picker">{{ statusLabels[statusIndex] }} ▾</view></picker><template #actions><button class="btn query-btn" @click="load">查询订单</button></template></FilterBar>
    <AsyncState :loading="loading" :error="error" :permission-denied="denied" :empty="!loading && !error && rows.length === 0" empty-text="暂无匹配订单" @retry="load" />
    <DataTable v-if="rows.length" :columns="columns" :rows="pageRows" min-width="1040px">
      <template #cell-product="{row}"><text>{{ row.productSnapshot?.title || row.productId }}</text></template>
      <template #cell-amount="{row}"><MoneyText :amount-fen="row.amountFen" /></template>
      <template #cell-status="{row}"><OrderStatusTag :status="row.status" /></template>
      <template #cell-worker="{row}"><text>{{ row.workerId || '未分配' }}</text></template>
      <template #cell-createdAt="{row}"><text>{{ formatTime(row.createdAt) }}</text></template>
      <template #cell-action="{row}"><button class="link action-link" @click.stop="openDetail(row)">查看详情</button></template>
    </DataTable>
    <Pagination :total="rows.length" :page="page" :page-size="pageSize" @change="page=$event" />

    <DetailDrawer :show="!!detail" :title="detail?.order?.orderNo || '订单详情'" @close="detail=null">
      <template v-if="detail">
        <view class="summary"><OrderStatusTag :status="detail.order.status" /><MoneyText :amount-fen="detail.order.amountFen" /><text class="brand-pill">品牌：{{ detail.order.brandId }}</text><button class="copy-btn" @click="copyText(detail.order.orderNo,'订单号')">复制订单号</button></view>
        <text class="section">商品与客户</text>
        <text class="line">{{ detail.order.productSnapshot?.title || detail.order.productId }} · {{ detail.order.customerNickname || detail.order.customerId }}</text>
        <text class="line">动态表单：{{ stringify(detail.order.formData) }}</text>
        <text class="section">指派/改派</text>
        <view v-if="canAssign" class="actions"><picker :range="workerLabels" :value="workerIndex" @change="workerIndex = Number($event.detail.value)"><view class="picker">{{ workerLabels[workerIndex] || '选择接单人员' }}</view></picker><DangerConfirm :label="detail.order.workerId ? '确认改派' : '确认指派'" title="确认修改接单人员" :content="`将订单交给 ${workerLabels[workerIndex] || '未选择人员'}，历史记录不会被覆盖。`" @confirm="assign" /></view>
        <text v-else class="line">当前状态无指派/改派权限</text>
        <view v-for="a in detail.assignments" :key="a._id" class="event"><text>{{ a.type }} · {{ a.workerId }}</text><text>{{ formatTime(a.createdAt) }}</text></view>
        <text class="section">支付与售后</text>
        <view v-for="p in detail.payments" :key="p._id" class="event"><text>支付 {{ p.paymentNo }} · {{ p.status }}</text><MoneyText :amount-fen="p.amountFen" /></view>
        <text v-if="detail.refund" class="line">退款：{{ detail.refund.status }} · ¥{{ ((detail.refund.amountFen || 0) / 100).toFixed(2) }}</text>
        <text v-if="detail.dispute" class="line">异议：{{ detail.dispute.status }} · {{ detail.dispute.resultNote || detail.dispute.content || '' }}</text>
        <text class="section">事件时间线</text>
        <view v-for="log in detail.logs" :key="log._id" class="event"><text>{{ log.action }} · {{ log.fromStatus || '—' }} → {{ log.toStatus || '—' }}</text><text>{{ formatTime(log.createdAt) }}</text></view>
      </template>
    </DetailDrawer>
  </view>
  </AdminShell>
</template>
<script setup>
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '../../api.js';
import AsyncState from '../../components/AsyncState.vue';
import MoneyText from '../../components/MoneyText.vue';
import OrderStatusTag from '../../components/OrderStatusTag.vue';
import DangerConfirm from '../../components/DangerConfirm.vue';
import { copyText } from '../../utils/display.js';
const statuses = ['', 'PENDING_ACCEPT', 'PENDING_GRAB', 'ASSIGN_PENDING', 'IN_SERVICE', 'PENDING_CONFIRM', 'SETTLED', 'REFUNDING', 'DISPUTING'];
const statusLabels = ['全部状态', '待受理', '待抢单', '待接指派', '服务中', '待验收', '已结单', '退款中', '异议中'];
const columns = [
  { key: 'orderNo', label: '订单号', width: '170px' }, { key: 'product', label: '商品', width: 'minmax(180px,1.4fr)' },
  { key: 'amount', label: '金额', width: '110px' }, { key: 'status', label: '状态', width: '120px' },
  { key: 'worker', label: '接单人员', width: '150px' }, { key: 'createdAt', label: '创建时间', width: '180px' }, { key: 'action', label: '操作', width: '100px' },
];
const rows = ref([]); const keyword = ref(''); const statusIndex = ref(0); const loading = ref(false); const error = ref(''); const denied = ref(false); const detail = ref(null); const workers = ref([]); const workerIndex = ref(0);
const page = ref(1); const pageSize = 10; const pageRows = computed(() => rows.value.slice((page.value - 1) * pageSize, page.value * pageSize));
const workerLabels = computed(() => workers.value.map((item) => `${item.nickname || item.phone || item._id}（${item._id}）`));
const canAssign = computed(() => (detail.value?.order.allowedActions || []).some((action) => ['assignOrder', 'reassignOrder'].includes(action)));
function formatTime(value) { return value ? new Date(value).toLocaleString() : '—'; }
function stringify(value) { try { return JSON.stringify(value || {}); } catch (e) { return '—'; } }
function changeStatus(event) { statusIndex.value = Number(event.detail.value); load(); }
async function load() { loading.value = true; error.value = ''; denied.value = false; page.value = 1; try { const result = await api.listOrders({ keyword: keyword.value || undefined, status: statuses[statusIndex.value] || undefined }); rows.value = Array.isArray(result) ? result : []; workers.value = await api.listWorkers().catch(() => []); } catch (e) { error.value = e.message || '订单加载失败'; denied.value = e.code === 403 || e.code === 'FORBIDDEN'; rows.value = []; } finally { loading.value = false; } }
async function openDetail(item) { try { detail.value = await api.getOrder(item._id || item.id); const current = workers.value.findIndex((worker) => worker._id === detail.value.order.workerId); workerIndex.value = current >= 0 ? current : 0; } catch (e) { uni.showToast({ title: e.message || '详情加载失败', icon: 'none' }); } }
async function assign() { const worker = workers.value[workerIndex.value]; if (!worker || !detail.value) { uni.showToast({ title: '请选择接单人员', icon: 'none' }); return; } try { const payload = { orderId: detail.value.order._id, workerId: worker._id }; const actions = detail.value.order.allowedActions || []; if (actions.includes('reassignOrder')) await api.reassignOrder({ ...payload, reason: '管理端人工改派' }); else await api.assignOrder(payload); await openDetail(detail.value.order); await load(); uni.showToast({ title: '指派已更新', icon: 'success' }); } catch (e) { uni.showToast({ title: e.message || '指派失败', icon: 'none' }); } }
onLoad(load);
</script>
<style lang="scss" scoped>
.count-badge{padding:7px 11px;color:var(--es-text-dim);font-size:12px;background:#fff;border:1px solid var(--es-border-soft);border-radius:999px}.input,.picker{height:40px;line-height:40px;padding:0 12px;color:var(--es-text);background:#fff;border:1px solid var(--es-border);border-radius:8px}.search-input{min-width:260px;flex:1}.status-picker{min-width:150px}.query-btn{height:40px;margin:0;padding:0 18px;color:#fff;background:var(--es-primary);border:0;border-radius:8px;font-size:12px;font-weight:650}.action-link,.copy-btn{width:auto;margin:0;padding:5px 9px;font-size:11px;line-height:1.2}.copy-btn{margin-left:auto;color:var(--es-primary);background:#fff;border:1px solid #c7d2fe;border-radius:7px}.summary,.event,.actions{display:flex;justify-content:space-between;align-items:center;gap:12px}.summary{flex-wrap:wrap;padding:14px;background:#f8fafc;border:1px solid var(--es-border-soft);border-radius:10px}.brand-pill{padding:5px 8px;color:var(--es-text-dim);font-size:11px;background:#fff;border:1px solid var(--es-border-soft);border-radius:999px}.section{display:block;margin:24px 0 9px;color:var(--es-text);font-size:13px;font-weight:700}.line,.event{padding:10px 0;color:var(--es-text);font-size:12px;border-bottom:1px solid var(--es-border-soft)}.line{display:block}.event text:last-child{color:var(--es-text-dim)}.actions{flex-wrap:wrap;justify-content:flex-start}@media(max-width:760px){.search-input,.status-picker{min-width:0;width:100%}}
</style>
