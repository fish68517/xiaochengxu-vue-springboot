<template>
  <AdminShell title="异议仲裁">
  <view class="page">
    <PageHeader eyebrow="DISPUTE CONTROL" title="异议仲裁" description="证据、审理、裁决和资金联动均由服务端留痕" />
    <view class="filter"><picker :range="labels" :value="statusIndex" @change="changeStatus"><view class="picker">{{ labels[statusIndex] }}</view></picker><button class="btn" @click="load">刷新</button></view>
    <AsyncState :loading="loading" :error="error" :permission-denied="denied" :empty="!loading && !error && rows.length === 0" empty-text="暂无异议" @retry="load" />
    <view v-for="item in rows" :key="item._id || item.id" class="card" @click="open(item)"><view class="card-head"><text class="strong">{{ item.orderNo || item.orderId }}</text><text class="status">{{ statusText(item.status) }}</text></view><text class="line">{{ item.content || item.reason || '未填写描述' }}</text><text class="line">品牌 {{ item.brandId }} · {{ formatTime(item.createdAt) }}</text></view>

    <view v-if="selected" class="mask" @click.self="selected = null"><scroll-view scroll-y class="drawer">
      <view class="card-head"><text class="title">异议 {{ selected._id }}</text><button class="close" @click="selected = null">×</button></view>
      <text class="section">双方内容与证据</text>
      <text class="line">客户：{{ selected.customerContent || selected.content || '—' }}</text><text class="line">接单人员：{{ selected.workerContent || '—' }}</text>
      <view v-for="e in selected.evidence || []" :key="e._id || e.createdAt" class="event"><text>{{ e.side || 'UNKNOWN' }} · {{ e.content || '附件证据' }}</text><text>{{ (e.attachmentIds || []).join(', ') }} · {{ formatTime(e.createdAt) }}</text></view>
      <view v-if="['OPEN','EVIDENCE_COLLECTION'].includes(selected.status)" class="form"><input v-model="evidenceText" class="input" placeholder="仲裁侧补充证据说明" /><button class="btn" @click="addEvidence">追加证据</button><button class="btn" @click="startReview">进入审理</button></view>
      <template v-if="selected.status === 'UNDER_REVIEW'"><text class="section">裁决</text><textarea v-model="decisionNote" class="textarea" placeholder="裁决说明（必填）"/><view class="actions"><DangerConfirm label="维持原处理" title="确认维持原处理" :content="decisionNote || '请先填写裁决说明'" @confirm="decide('maintain')"/><DangerConfirm label="部分退款" title="确认部分退款" content="将按服务端差额规则生成退款并追佣。" @confirm="decide('partial')"/><DangerConfirm label="全额退款" title="确认全额退款" content="将生成全额退款并通过领域服务联动追佣。" @confirm="decide('full')"/></view></template>
      <template v-if="selected.status === 'DECIDED'"><text class="section">裁决结果</text><text class="line">{{ selected.result }} · {{ selected.resultNote }}</text><DangerConfirm label="确认结案" title="确认关闭异议" content="结案后不再允许追加证据。" @confirm="closeCase"/></template>
      <text class="section">时间线</text><view v-for="t in selected.timeline || []" :key="t.createdAt" class="event"><text>{{ t.action }} · {{ t.operatorId || 'system' }}</text><text>{{ t.note || t.result || '' }} · {{ formatTime(t.createdAt) }}</text></view>
    </scroll-view></view>
  </view>
  </AdminShell>
</template>
<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '../../api.js';
import AsyncState from '../../components/AsyncState.vue';
import DangerConfirm from '../../components/DangerConfirm.vue';
const statuses = ['', 'OPEN', 'EVIDENCE_COLLECTION', 'UNDER_REVIEW', 'DECIDED', 'CLOSED']; const labels = ['全部状态', '已发起', '举证中', '审理中', '已裁决', '已结案'];
const rows = ref([]); const statusIndex = ref(0); const loading = ref(false); const error = ref(''); const denied = ref(false); const selected = ref(null); const evidenceText = ref(''); const decisionNote = ref('');
function statusText(status) { return labels[statuses.indexOf(status)] || status; } function formatTime(v) { return v ? new Date(v).toLocaleString() : '—'; }
function changeStatus(event) { statusIndex.value = Number(event.detail.value); load(); }
async function load() { loading.value = true; error.value = ''; denied.value = false; try { const data = await api.listDisputes({ status: statuses[statusIndex.value] || undefined }); rows.value = Array.isArray(data) ? data : []; } catch (e) { error.value = e.message || '异议加载失败'; denied.value = e.code === 403 || e.code === 'FORBIDDEN'; rows.value = []; } finally { loading.value = false; } }
async function open(item) { try { selected.value = await api.getDispute(item._id || item.id); decisionNote.value = selected.value.resultNote || ''; } catch (e) { uni.showToast({ title: e.message || '详情加载失败', icon: 'none' }); } }
async function refreshSelected() { const id = selected.value?._id; if (id) selected.value = await api.getDispute(id); await load(); }
async function addEvidence() { if (!evidenceText.value.trim()) { uni.showToast({ title: '证据说明不能为空', icon: 'none' }); return; } try { await api.addDisputeEvidence({ disputeId: selected.value._id, side: 'ARBITRATOR', content: evidenceText.value.trim(), attachmentIds: [] }); evidenceText.value = ''; await refreshSelected(); } catch (e) { uni.showToast({ title: e.message || '追加失败', icon: 'none' }); } }
async function startReview() { try { await api.startDisputeReview({ disputeId: selected.value._id }); await refreshSelected(); } catch (e) { uni.showToast({ title: e.message || '操作失败', icon: 'none' }); } }
async function decide(result) { if (!decisionNote.value.trim()) { uni.showToast({ title: '裁决说明不能为空', icon: 'none' }); return; } try { await api.resolveDispute({ disputeId: selected.value._id, result, note: decisionNote.value.trim() }); await refreshSelected(); } catch (e) { uni.showToast({ title: e.message || '裁决失败', icon: 'none' }); } }
async function closeCase() { try { await api.closeDispute({ disputeId: selected.value._id }); await refreshSelected(); } catch (e) { uni.showToast({ title: e.message || '结案失败', icon: 'none' }); } }
onLoad(load);
</script>
<style lang="scss" scoped>
.page{padding:24rpx}.head,.filter,.card,.drawer{background:var(--es-bg-panel);border:1rpx solid var(--es-border-soft);border-radius:var(--es-radius)}.head{display:flex;justify-content:space-between;padding:28rpx;margin-bottom:18rpx}.title{font-size:36rpx;font-weight:700;color:var(--es-primary)}.hint,.line{font-size:22rpx;color:var(--es-text-dim)}.filter,.actions,.card-head,.event,.form{display:flex;align-items:center;gap:14rpx}.filter{padding:14rpx;margin-bottom:18rpx}.picker,.input,.textarea{padding:0 16rpx;background:#0f172a;color:var(--es-text);border:1rpx solid var(--es-border-soft);border-radius:var(--es-radius)}.picker,.input{height:68rpx;line-height:68rpx}.textarea{width:100%;min-height:150rpx;padding:14rpx;box-sizing:border-box}.btn,.close{font-size:24rpx;color:var(--es-primary);border:1rpx solid var(--es-primary);background:transparent}.card{padding:20rpx;margin-bottom:12rpx}.card-head{justify-content:space-between}.strong,.status{color:var(--es-primary)}.line{display:block;margin-top:10rpx}.mask{position:fixed;inset:0;background:rgba(0,0,0,.65);display:flex;justify-content:flex-end;z-index:20}.drawer{width:min(900rpx,92vw);height:100%;padding:28rpx;box-sizing:border-box;border-radius:0}.close{width:64rpx;height:64rpx}.section{display:block;margin:28rpx 0 12rpx;color:var(--es-primary);font-weight:600}.event{justify-content:space-between;padding:12rpx 0;border-bottom:1rpx solid var(--es-border-soft);font-size:22rpx}.form,.actions{flex-wrap:wrap;margin-top:16rpx}
</style>
