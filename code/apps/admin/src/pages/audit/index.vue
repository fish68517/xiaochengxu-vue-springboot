<template>
  <AdminShell title="审计日志">
  <view class="page">
    <PageHeader eyebrow="AUDIT TRAIL" title="审计日志" description="关键配置、权限、订单和资金操作记录不可覆盖" />
    <view class="filters"><input v-model="action" class="input" placeholder="action 精确筛选"/><input v-model="resourceType" class="input" placeholder="resourceType 精确筛选"/><button class="btn" @click="load">查询</button></view>
    <AsyncState :loading="loading" :error="error" :permission-denied="denied" :empty="!loading && !error && rows.length === 0" empty-text="暂无审计记录" @retry="load" />
    <scroll-view v-if="rows.length" scroll-x class="table-wrap"><view class="table"><view class="tr th"><text>时间</text><text>品牌</text><text>操作人/角色</text><text>动作</text><text>资源</text><text>请求 ID</text><text>变更摘要</text></view><view v-for="row in rows" :key="row._id" class="tr"><text>{{ formatTime(row.createdAt) }}</text><text>{{ row.brandId }}</text><text>{{ row.operatorId || row.operator?.userId || 'system' }} / {{ row.operatorRole || row.operator?.role || 'SYSTEM' }}</text><text>{{ row.action }}</text><text>{{ row.resourceType }} / {{ row.resourceId || '—' }}</text><text>{{ row.requestId || '—' }}</text><button class="link" @click="open(row)">查看 before/after</button></view></view></scroll-view>
    <view v-if="selected" class="mask" @click.self="selected = null"><view class="dialog"><view class="dialog-head"><text class="title">{{ selected.action }}</text><button class="link" @click="selected = null">关闭</button></view><text class="label">Before</text><scroll-view scroll-y class="json"><text>{{ pretty(selected.before) }}</text></scroll-view><text class="label">After</text><scroll-view scroll-y class="json"><text>{{ pretty(selected.after) }}</text></scroll-view><text class="label">Metadata</text><text class="meta">{{ pretty(selected.metadata) }}</text></view></view>
  </view>
  </AdminShell>
</template>
<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api, getActiveBrandId } from '../../api.js';
import AsyncState from '../../components/AsyncState.vue';
const rows = ref([]); const action = ref(''); const resourceType = ref(''); const selected = ref(null); const loading = ref(false); const error = ref(''); const denied = ref(false);
function formatTime(v) { return v ? new Date(v).toLocaleString() : '—'; } function pretty(value) { try { return JSON.stringify(value ?? null, null, 2); } catch (e) { return String(value); } } function open(row) { selected.value = row; }
async function load() { loading.value = true; error.value = ''; denied.value = false; try { const data = await api.listAuditLogs({ brandId: getActiveBrandId() || undefined, action: action.value || undefined, resourceType: resourceType.value || undefined }); rows.value = Array.isArray(data) ? data : []; } catch (e) { error.value = e.message || '审计日志加载失败'; denied.value = e.code === 403 || e.code === 'FORBIDDEN'; rows.value = []; } finally { loading.value = false; } }
onLoad(load);
</script>
<style lang="scss" scoped>
.page{padding:24rpx}.head,.filters,.table-wrap,.dialog{background:var(--es-bg-panel);border:1rpx solid var(--es-border-soft);border-radius:var(--es-radius)}.head{display:flex;justify-content:space-between;padding:28rpx;margin-bottom:18rpx}.title{font-size:36rpx;font-weight:700;color:var(--es-primary)}.hint{font-size:22rpx;color:var(--es-text-dim)}.filters{display:flex;gap:12rpx;padding:14rpx;margin-bottom:18rpx}.input{height:68rpx;padding:0 16rpx;flex:1;background:#0f172a;color:var(--es-text);border:1rpx solid var(--es-border-soft);border-radius:var(--es-radius)}.btn,.link{font-size:24rpx;color:var(--es-primary);border:1rpx solid var(--es-primary);background:transparent}.table{min-width:1650rpx}.tr{display:grid;grid-template-columns:260rpx 180rpx 280rpx 240rpx 300rpx 220rpx 170rpx;align-items:center;min-height:80rpx;border-bottom:1rpx solid var(--es-border-soft)}.tr>*{padding:10rpx;font-size:22rpx}.th{color:var(--es-primary)}.mask{position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.68)}.dialog{width:min(1000rpx,90vw);max-height:86vh;padding:24rpx}.dialog-head{display:flex;justify-content:space-between}.label{display:block;margin:18rpx 0 8rpx;color:var(--es-primary)}.json{max-height:220rpx;padding:12rpx;background:#0f172a;color:var(--es-text);font-family:monospace;white-space:pre-wrap}.meta{color:var(--es-text-dim);font-family:monospace}
</style>
