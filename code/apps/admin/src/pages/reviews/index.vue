<template>
  <AdminShell title="审核中心">
  <view class="page">
    <PageHeader eyebrow="LEGACY REVIEW" title="审核中心（兼容入口）" description="新入口已拆分至账本、提现与仲裁模块，本页仅保留旧外链兼容" />

    <text class="section-title">退款审批</text>
    <view v-if="refundError" class="empty">
      <text>{{ refundError }}</text>
      <button class="mini-btn" @click="loadRefunds">重试</button>
    </view>
    <view v-else-if="refunds.length === 0" class="empty"><text>暂无待审批退款</text></view>
    <view v-for="item in refunds" :key="item.refundId" class="review-row">
      <view class="review-main">
        <text class="review-title">{{ item.orderNo }} · {{ item.productTitle || item.productId }}</text>
        <text class="review-sub">退款 ¥{{ fenToYuan(item.amountFen) }} · {{ item.reason || '—' }}</text>
      </view>
      <view class="review-actions">
        <DangerConfirm label="通过并退款" title="确认批准退款" :content="`订单 ${item.orderNo} 将进入退款流程，服务端将校验支付与追佣规则。`" @confirm="onApproveRefund(item)" />
        <button class="mini-btn danger" @click="onRejectRefund(item)">驳回</button>
      </view>
    </view>

    <text class="section-title">提现审批</text>
    <view v-if="withdrawError" class="empty">
      <text>{{ withdrawError }}</text>
      <button class="mini-btn" @click="loadWithdrawals">重试</button>
    </view>
    <view v-else-if="withdrawals.length === 0" class="empty"><text>暂无待审批提现</text></view>
    <view v-for="item in withdrawals" :key="item._id || item.id" class="review-row">
      <view class="review-main">
        <text class="review-title">{{ item.workerName || item.workerId }} 提现 ¥{{ fenToYuan(item.amountFen) }}</text>
        <text class="review-sub">状态：{{ withdrawalStatusText(item.status) }} · {{ item.createdAt ? new Date(item.createdAt).toLocaleString() : '' }}</text>
        <input v-if="['APPROVED', 'PAY_FAILED', 'PAYING'].includes(item.status)" v-model="item.batchNo" class="input" placeholder="人工打款凭证号（选填）" />
      </view>
      <view class="review-actions">
        <button v-if="item.status === 'SUBMITTED'" class="mini-btn" @click="onNextWithdrawal(item)">开始审核</button>
        <DangerConfirm v-else-if="item.status === 'REVIEWING'" label="审核通过" title="确认批准提现" :content="`将批准 ${item.workerName || item.workerId} 提现 ¥${fenToYuan(item.amountFen)}。`" @confirm="onNextWithdrawal(item)" />
        <DangerConfirm v-else-if="['APPROVED', 'PAY_FAILED'].includes(item.status)" label="开始出款" title="确认开始出款" :content="`将对 ¥${fenToYuan(item.amountFen)} 发起出款，资金保持冻结直至确认。`" @confirm="onNextWithdrawal(item)" />
        <DangerConfirm v-else-if="item.status === 'PAYING'" label="确认已打款" title="确认完成出款" :content="`确认 ¥${fenToYuan(item.amountFen)} 已实际打款，提交后将扣减冻结余额并写入凭证。`" @confirm="onMarkPaid(item)" />
        <button v-if="['SUBMITTED', 'REVIEWING'].includes(item.status)" class="mini-btn danger" @click="onRejectWithdraw(item)">驳回</button>
      </view>
    </view>
  </view>
  </AdminShell>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '../../api.js';
import DangerConfirm from '../../components/DangerConfirm.vue';

const refunds = ref([]);
const withdrawals = ref([]);
const refundError = ref('');
const withdrawError = ref('');

onLoad(() => {
  loadRefunds();
  loadWithdrawals();
});

function fenToYuan(fen) { return ((fen || 0) / 100).toFixed(2); }

// 弹窗索取必填原因：确认返回内容，取消返回 null。
function promptText(title, placeholder) {
  return new Promise((resolve) => {
    uni.showModal({
      title,
      editable: true,
      placeholderText: placeholder || '请输入原因',
      success: (res) => resolve(res.confirm ? (res.content || '') : null),
      fail: () => resolve(null),
    });
  });
}

// 退款待审批：listOrders 按 REFUNDING 筛选，取 refundStatus=PENDING_APPROVAL（无该字段则视为待审批）。
async function loadRefunds() {
  refundError.value = '';
  try {
    const orders = await api.listOrders({ status: 'REFUNDING' });
    refunds.value = (Array.isArray(orders) ? orders : [])
      .filter((o) => {
        const rs = o.refundStatus || (o.refunds && o.refunds[0] && o.refunds[0].status);
        return rs === undefined || rs === 'PENDING_APPROVAL';
      })
      .map((o) => ({
        refundId: o.refundId || (o.refunds && o.refunds[0] && (o.refunds[0]._id || o.refunds[0].id)),
        orderId: o._id || o.id,
        orderNo: o.orderNo,
        productTitle: o.productSnapshot && o.productSnapshot.title,
        productId: o.productId,
        amountFen: o.amountFen,
        reason: o.refundReason || '',
      }))
      .filter((r) => r.refundId);
  } catch (e) {
    refundError.value = e.message || '退款审批加载失败';
  }
}

const withdrawalStatusText = (status) => ({ SUBMITTED: '已提交', REVIEWING: '审核中', APPROVED: '已批准', PAYING: '出款中', PAY_FAILED: '出款失败', PAID: '已打款', REJECTED: '已驳回', PENDING_REVIEW: '待迁移' }[status] || status);

// 提现工作队列：展示全部未终态记录，旧 PENDING_REVIEW 由迁移工具转换。
async function loadWithdrawals() {
  withdrawError.value = '';
  try {
    const list = await api.listWithdrawals({});
    withdrawals.value = (Array.isArray(list) ? list : [])
      .filter((w) => !['PAID', 'REJECTED'].includes(w.status))
      .map((w) => ({ ...w, batchNo: '' }));
  } catch (e) {
    withdrawError.value = e.message || '提现审批加载失败';
  }
}

// 通过退款：真实调 approveRefund（服务端调微信退款），成功后移除本地行。
async function onApproveRefund(item) {
  try {
    await api.approveRefund({ refundId: item.refundId });
    refunds.value = refunds.value.filter((x) => x.refundId !== item.refundId);
    uni.showToast({ title: '已通过，系统调微信退款', icon: 'success' });
  } catch (e) {
    uni.showToast({ title: e.message || '操作失败', icon: 'none' });
  }
}

// 驳回退款：必填原因，真实调 rejectRefund。
async function onRejectRefund(item) {
  const reason = await promptText('驳回退款', '驳回原因（必填）');
  if (reason == null) return;
  if (!reason) { uni.showToast({ title: '驳回原因不能为空', icon: 'none' }); return; }
  try {
    await api.rejectRefund({ refundId: item.refundId, reason });
    refunds.value = refunds.value.filter((x) => x.refundId !== item.refundId);
    uni.showToast({ title: '已驳回退款', icon: 'none' });
  } catch (e) {
    uni.showToast({ title: e.message || '操作失败', icon: 'none' });
  }
}

async function onNextWithdrawal(item) {
  const withdrawalId = item._id || item.id;
  try {
    if (item.status === 'SUBMITTED') await api.startWithdrawalReview({ withdrawalId });
    else if (item.status === 'REVIEWING') await api.approveWithdrawal({ withdrawalId });
    else if (['APPROVED', 'PAY_FAILED'].includes(item.status)) await api.startWithdrawalPayment({ withdrawalId, batchNo: item.batchNo || undefined });
    await loadWithdrawals();
    uni.showToast({ title: '提现状态已更新', icon: 'success' });
  } catch (e) {
    uni.showToast({ title: e.message || '操作失败', icon: 'none' });
  }
}

// 出款中记录确认已打款。
async function onMarkPaid(item) {
  let user = {};
  try { user = uni.getStorageSync('user') || {}; } catch (e) { /* 忽略 */ }
  const paidBy = user.nickname || user.phone || 'admin';
  try {
    await api.markWithdrawalPaid({ withdrawalId: item._id || item.id, paidBy, batchNo: item.batchNo || undefined });
    withdrawals.value = withdrawals.value.filter((x) => (x._id || x.id) !== (item._id || item.id));
    uni.showToast({ title: '已标记打款并结算', icon: 'success' });
  } catch (e) {
    uni.showToast({ title: e.message || '操作失败', icon: 'none' });
  }
}

// 驳回提现：必填原因，真实调 rejectWithdrawal。
async function onRejectWithdraw(item) {
  const reason = await promptText('驳回提现', '驳回原因（必填）');
  if (reason == null) return;
  if (!reason) { uni.showToast({ title: '驳回原因不能为空', icon: 'none' }); return; }
  try {
    await api.rejectWithdrawal({ withdrawalId: item._id || item.id, reason });
    withdrawals.value = withdrawals.value.filter((x) => (x._id || x.id) !== (item._id || item.id));
    uni.showToast({ title: '已驳回提现', icon: 'none' });
  } catch (e) {
    uni.showToast({ title: e.message || '操作失败', icon: 'none' });
  }
}
</script>

<style lang="scss" scoped>
.page { padding: 24rpx; }
.head { padding: 32rpx; margin-bottom: 24rpx; background: var(--es-bg-panel); border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); box-shadow: var(--es-glow); }
.head-title { font-size: 40rpx; font-weight: 700; color: var(--es-primary); }
.deprecated { display: block; margin-top: 8rpx; font-size: 22rpx; color: var(--es-text-dim); }
.section-title { display: block; font-size: 28rpx; color: var(--es-primary); margin: 24rpx 0 12rpx; }
.review-row { display: flex; justify-content: space-between; align-items: center; padding: 24rpx; margin-bottom: 16rpx; background: var(--es-bg-panel); border-radius: var(--es-radius); }
.review-main { display: flex; flex-direction: column; flex: 1; margin-right: 16rpx; }
.review-title { font-size: 28rpx; color: var(--es-text); font-weight: 600; }
.review-sub { margin-top: 8rpx; font-size: 24rpx; color: var(--es-text-dim); }
.input { height: 72rpx; padding: 0 20rpx; margin-top: 12rpx; background: #0f172a; border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); color: var(--es-text); }
.review-actions { display: flex; flex-direction: column; gap: 12rpx; }
.mini-btn { padding: 8rpx 16rpx; font-size: 24rpx; color: var(--es-primary); border: 1rpx solid var(--es-primary); border-radius: var(--es-radius); background: transparent; }
.mini-btn.danger { color: var(--es-danger); border-color: var(--es-danger); }
.empty { padding: 32rpx; text-align: center; color: var(--es-text-dim); font-size: 26rpx; }
</style>
