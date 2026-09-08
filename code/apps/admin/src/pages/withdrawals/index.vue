<template>
  <AdminShell title="提现审批">
  <view class="page">
    <PageHeader eyebrow="WITHDRAWAL REVIEW" title="提现审批与出款" description="审核与实际出款分离，出款前资金保持冻结并全程留痕" />
    <view class="filter"><picker :range="labels" :value="statusIndex" @change="changeStatus"><view class="picker">{{ labels[statusIndex] }}</view></picker><button class="btn" @click="load">刷新</button></view>
    <AsyncState :loading="loading" :error="error" :permission-denied="denied" :empty="!loading && !error && rows.length === 0" empty-text="暂无提现记录" @retry="load" />
    <view v-for="item in rows" :key="item._id || item.id" class="card">
      <view class="card-head"><view><text class="strong">{{ item.workerName || item.workerId }}</text><MoneyText :amount-fen="item.amountFen" /></view><text class="status">{{ statusText(item.status) }}</text></view>
      <text class="line">品牌：{{ item.brandId }} · 申请：{{ formatTime(item.createdAt) }}</text>
      <text class="line">审核人：{{ item.reviewedBy || '—' }} · 审核时间：{{ formatTime(item.reviewedAt) }}</text>
      <text class="line">批次/凭证：{{ item.batchNo || '—' }} · 失败原因：{{ item.failureReason || '—' }}</text>
      <input v-if="['APPROVED','PAY_FAILED','PAYING'].includes(item.status)" v-model="item.inputBatchNo" class="input" placeholder="输入出款批次/凭证号" />
      <view class="actions">
        <button v-if="item.status === 'SUBMITTED'" class="btn" @click="advance(item, 'review')">开始审核</button>
        <button v-if="item.status === 'REVIEWING'" class="btn" @click="advance(item, 'approve')">批准提现</button>
        <button v-if="['APPROVED','PAY_FAILED'].includes(item.status)" class="btn" @click="advance(item, 'pay')">{{ item.status === 'PAY_FAILED' ? '重新出款' : '开始出款' }}</button>
        <button v-if="item.status === 'PAYING'" class="btn" @click="advance(item, 'paid')">确认已打款</button>
        <DangerConfirm v-if="item.status === 'PAYING'" label="标记出款失败" title="确认出款失败" content="资金将继续冻结，并允许重新发起出款。" @confirm="failPayment(item)" />
        <DangerConfirm v-if="['SUBMITTED','REVIEWING'].includes(item.status)" label="驳回并解冻" title="确认驳回提现" content="驳回后冻结金额将退回可用余额。" @confirm="reject(item)" />
      </view>
    </view>
  </view>
  </AdminShell>
</template>
<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '../../api.js';
import AsyncState from '../../components/AsyncState.vue';
import MoneyText from '../../components/MoneyText.vue';
import DangerConfirm from '../../components/DangerConfirm.vue';
const statuses = ['', 'SUBMITTED', 'REVIEWING', 'APPROVED', 'PAYING', 'PAY_FAILED', 'PAID', 'REJECTED'];
const labels = ['全部状态', '已提交', '审核中', '已批准', '出款中', '出款失败', '已打款', '已驳回'];
const rows = ref([]); const statusIndex = ref(0); const loading = ref(false); const error = ref(''); const denied = ref(false);
function statusText(status) { return labels[statuses.indexOf(status)] || status; }
function formatTime(value) { return value ? new Date(value).toLocaleString() : '—'; }
function changeStatus(event) { statusIndex.value = Number(event.detail.value); load(); }
async function load() { loading.value = true; error.value = ''; denied.value = false; try { const list = await api.listWithdrawals({ status: statuses[statusIndex.value] || undefined }); rows.value = (Array.isArray(list) ? list : []).map((item) => ({ ...item, inputBatchNo: item.batchNo || '' })); } catch (e) { error.value = e.message || '提现加载失败'; denied.value = e.code === 403 || e.code === 'FORBIDDEN'; rows.value = []; } finally { loading.value = false; } }
async function advance(item, step) { const withdrawalId = item._id || item.id; try { if (step === 'review') await api.startWithdrawalReview({ withdrawalId }); if (step === 'approve') await api.approveWithdrawal({ withdrawalId }); if (step === 'pay') await api.startWithdrawalPayment({ withdrawalId, batchNo: item.inputBatchNo || undefined }); if (step === 'paid') await api.markWithdrawalPaid({ withdrawalId, batchNo: item.inputBatchNo || undefined }); await load(); uni.showToast({ title: '状态已更新', icon: 'success' }); } catch (e) { uni.showToast({ title: e.message || '操作失败', icon: 'none' }); } }
async function failPayment(item) { try { await api.failWithdrawalPayment({ withdrawalId: item._id || item.id, reason: '管理端确认渠道出款失败' }); await load(); } catch (e) { uni.showToast({ title: e.message || '操作失败', icon: 'none' }); } }
async function reject(item) { try { await api.rejectWithdrawal({ withdrawalId: item._id || item.id, reason: '管理端审核驳回' }); await load(); } catch (e) { uni.showToast({ title: e.message || '操作失败', icon: 'none' }); } }
onLoad(load);
</script>
<style lang="scss" scoped>
.page{padding:24rpx}.head,.filter,.card{background:var(--es-bg-panel);border:1rpx solid var(--es-border-soft);border-radius:var(--es-radius)}.head{display:flex;justify-content:space-between;padding:28rpx;margin-bottom:18rpx}.title{font-size:36rpx;font-weight:700;color:var(--es-primary)}.hint,.line{font-size:22rpx;color:var(--es-text-dim)}.filter,.actions,.card-head,.card-head>view{display:flex;align-items:center;gap:14rpx}.filter{padding:14rpx;margin-bottom:18rpx}.picker,.input{height:68rpx;line-height:68rpx;padding:0 16rpx;background:#0f172a;color:var(--es-text);border:1rpx solid var(--es-border-soft);border-radius:var(--es-radius)}.btn{font-size:24rpx;color:var(--es-primary);border:1rpx solid var(--es-primary);background:transparent}.card{padding:22rpx;margin-bottom:14rpx}.card-head{justify-content:space-between}.strong{font-size:28rpx;color:var(--es-text);font-weight:600}.status{color:var(--es-primary)}.line{display:block;margin-top:10rpx}.input{margin-top:14rpx}.actions{flex-wrap:wrap;margin-top:16rpx}
</style>
