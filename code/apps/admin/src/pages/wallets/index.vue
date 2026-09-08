<template>
  <AdminShell title="钱包管理">
  <view class="page">
    <PageHeader eyebrow="WALLET CONTROL" title="钱包管理" description="查询余额和账本流水，执行冻结或带原因的审计调账" />

    <view class="wallet-grid">
    <view class="form">
      <text class="section-title">选择接单服务人员</text>
      <picker :range="workerNames" @change="onPickWorker">
        <view class="picker">{{ workerNames[workerIndex] || '请选择接单服务人员' }}</view>
      </picker>

      <view class="field">
        <text class="label">余额</text>
        <text class="balance">{{ balanceText }}</text>
      </view>
      <view class="field">
        <text class="label">冻结状态</text>
        <text class="freeze-text">{{ freezeText }}</text>
      </view>
    </view>

    <view class="form">
      <text class="section-title">钱包冻结</text>
      <radio-group class="radio-row" @change="(e) => (freezeScope = e.detail.value)">
        <label class="radio-item"><radio value="WITHDRAW" :checked="freezeScope === 'WITHDRAW'" />仅冻结提现</label>
        <label class="radio-item"><radio value="BOTH" :checked="freezeScope === 'BOTH'" />冻结提现 + 接单</label>
        <label class="radio-item"><radio value="NONE" :checked="freezeScope === 'NONE'" />解除冻结</label>
      </radio-group>
      <DangerConfirm label="应用冻结设置" title="确认修改钱包冻结范围" :content="`将把 ${selected?.nickname || selected?.phone || '当前人员'} 的钱包冻结范围改为 ${freezeScope}，操作会写入审计。`" :disabled="freezing || !selected" @confirm="applyFreeze" />
    </view>

    <view class="form">
      <text class="section-title">调账</text>
      <view class="field">
        <text class="label">方向</text>
        <radio-group class="radio-row" @change="(e) => (form.direction = e.detail.value)">
          <label class="radio-item"><radio value="add" :checked="form.direction === 'add'" />增加</label>
          <label class="radio-item"><radio value="sub" :checked="form.direction === 'sub'" />减少</label>
        </radio-group>
      </view>
      <view class="field">
        <text class="label">金额（元）</text>
        <input v-model="form.amountYuan" class="input" type="digit" placeholder="> 0" />
      </view>
      <view class="field">
        <text class="label">原因（必填，留痕）</text>
        <textarea v-model="form.reason" class="textarea" placeholder="调账原因" />
      </view>
      <DangerConfirm label="提交调账" title="确认钱包调账" :content="`将对 ${selected?.nickname || selected?.phone || '当前人员'} ${form.direction === 'sub' ? '扣减' : '增加'} ¥${form.amountYuan || '0'}，原因：${form.reason || '未填写'}。`" :disabled="saving || !selected" @confirm="adjust" />
    </view>
    </view>

    <view class="form">
      <text class="section-title">钱包流水</text>
      <view v-if="txError" class="empty">
        <text>{{ txError }}</text>
        <button class="mini-btn" @click="refreshWallet">重试</button>
      </view>
      <view v-else-if="transactions.length === 0" class="empty"><text>暂无流水</text></view>
      <view v-for="t in transactions" :key="t._id || t.id" class="tx-row">
        <view class="tx-main">
          <text class="tx-type">{{ t.type }}</text>
          <text class="tx-sub">{{ t.remark || '—' }}</text>
        </view>
        <view class="tx-right">
          <text class="tx-amount" :class="{ negative: (t.amountFen || 0) < 0 }">{{ signedFen(t.amountFen) }}</text>
          <text class="tx-sub">余额 ¥{{ fenToYuan(t.balanceAfterFen) }}</text>
        </view>
      </view>
    </view>

    <view v-if="error" class="empty">
      <text>{{ error }}</text>
      <button class="mini-btn" @click="load">重试</button>
    </view>
  </view>
  </AdminShell>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '../../api.js';
import DangerConfirm from '../../components/DangerConfirm.vue';

const workers = ref([]);
const workerIndex = ref(0);
const wallet = ref(null);
const transactions = ref([]);
const error = ref('');
const txError = ref('');
const saving = ref(false);
const freezing = ref(false);
const freezeScope = ref('NONE');
const form = ref({ direction: 'add', amountYuan: '', reason: '' });

const workerNames = computed(() => workers.value.map((w) => w.nickname || w.phone || idOf(w)));
// 当前选中人员，供调账/冻结 workerId 取值。
const selected = computed(() => workers.value[workerIndex.value]);

function idOf(w) { return w._id || w.id || w.workerId; }
function fenToYuan(fen) { return ((Number(fen) || 0) / 100).toFixed(2); }
function signedFen(fen) { const n = Number(fen) || 0; return `${n > 0 ? '+' : ''}${fenToYuan(n)}`; }

const balanceText = computed(() => (wallet.value ? `¥${fenToYuan(wallet.value.balanceFen)}` : '—'));
const freezeText = computed(() => {
  const w = wallet.value || {};
  if (w.freezeWithdrawal && w.freezeAccept) return '已冻结提现 + 接单';
  if (w.freezeWithdrawal) return '已冻结提现';
  return '未冻结';
});

onLoad(load);

// 加载接单人员列表，失败显示 error/retry；选中后拉取余额/流水。
async function load() {
  error.value = '';
  try {
    const list = await api.listWorkers();
    workers.value = Array.isArray(list) ? list : [];
    if (workers.value.length) await refreshWallet();
  } catch (e) {
    error.value = e.message || '接单人员列表加载失败';
  }
}

function onPickWorker(e) {
  workerIndex.value = Number(e.detail.value);
  refreshWallet();
}

// 按 workerId 拉取 ADMIN 版余额与流水，并同步冻结 scope 回显。
async function refreshWallet() {
  const w = selected.value;
  if (!w) { wallet.value = null; transactions.value = []; return; }
  txError.value = '';
  try {
    wallet.value = await api.getWallet({ workerId: idOf(w) });
    syncFreezeScope();
  } catch (e) {
    wallet.value = null;
    txError.value = e.message || '余额加载失败';
  }
  try {
    const list = await api.walletTransactions({ workerId: idOf(w) });
    transactions.value = Array.isArray(list) ? list : [];
  } catch (e) {
    transactions.value = [];
    if (!txError.value) txError.value = e.message || '流水加载失败';
  }
}

// 由钱包冻结字段回推 scope 选择器初始值。
function syncFreezeScope() {
  const w = wallet.value || {};
  freezeScope.value = w.freezeWithdrawal && w.freezeAccept ? 'BOTH' : (w.freezeWithdrawal ? 'WITHDRAW' : 'NONE');
}

// 应用冻结：真实调 freezeWallet({workerId, scope})，以服务端返回回显冻结状态与余额。
async function applyFreeze() {
  const w = selected.value;
  if (!w) { uni.showToast({ title: '请选择接单服务人员', icon: 'none' }); return; }
  freezing.value = true;
  try {
    const updated = await api.freezeWallet({ workerId: idOf(w), scope: freezeScope.value });
    wallet.value = updated || wallet.value;
    syncFreezeScope();
    uni.showToast({ title: '冻结设置已生效', icon: 'success' });
  } catch (e) {
    uni.showToast({ title: e.message || '操作失败', icon: 'none' });
  } finally {
    freezing.value = false;
  }
}

// 调账：真实调 adjustWallet（增=正、减=负，可为负），原因必填，成功后刷新余额/流水。
async function adjust() {
  const w = selected.value;
  if (!w) { uni.showToast({ title: '请选择接单服务人员', icon: 'none' }); return; }
  const amountFen = Math.round(parseFloat(form.value.amountYuan || '0') * 100);
  if (!(amountFen > 0)) { uni.showToast({ title: '金额需大于 0', icon: 'none' }); return; }
  const reason = form.value.reason.trim();
  if (!reason) { uni.showToast({ title: '调账原因不能为空', icon: 'none' }); return; }

  saving.value = true;
  try {
    const signed = form.value.direction === 'sub' ? -amountFen : amountFen;
    const walletRes = await api.adjustWallet({ workerId: idOf(w), amountFen: signed, reason });
    wallet.value = walletRes || wallet.value;
    form.value = { direction: 'add', amountYuan: '', reason: '' };
    uni.showToast({ title: '调账已生效', icon: 'success' });
    await refreshWallet();
  } catch (e) {
    uni.showToast({ title: e.message || '调账失败', icon: 'none' });
  } finally {
    saving.value = false;
  }
}
</script>

<style lang="scss" scoped>
.page { padding: 24rpx; }
.wallet-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.wallet-grid .form{margin-bottom:0}
.head { padding: 32rpx; margin-bottom: 24rpx; background: var(--es-bg-panel); border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); box-shadow: var(--es-glow); }
.head-title { font-size: 40rpx; font-weight: 700; color: var(--es-primary); }
.form { padding: 24rpx; background: var(--es-bg-panel); border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); margin-bottom: 24rpx; }
.section-title { display: block; font-size: 28rpx; color: var(--es-primary); margin-bottom: 12rpx; }
.field { margin-bottom: 20rpx; }
.label { display: block; font-size: 26rpx; color: var(--es-primary); margin-bottom: 8rpx; }
.picker { height: 80rpx; line-height: 80rpx; padding: 0 24rpx; background: #0f172a; border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); color: var(--es-text); }
.balance { display: block; font-size: 34rpx; color: var(--es-success); font-weight: 700; }
.freeze-text { display: block; font-size: 28rpx; color: var(--es-warning); font-weight: 600; }
.input { height: 80rpx; padding: 0 24rpx; background: #0f172a; border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); color: var(--es-text); }
.textarea { width: 100%; min-height: 120rpx; padding: 16rpx 24rpx; background: #0f172a; border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); color: var(--es-text); }
.radio-row { display: flex; flex-wrap: wrap; gap: 24rpx; margin-bottom: 8rpx; }
.radio-item { display: flex; align-items: center; gap: 8rpx; font-size: 26rpx; color: var(--es-text); }
.save-btn { margin-top: 8rpx; background: linear-gradient(135deg, var(--es-primary), var(--es-secondary)); color: #0a0e17; font-weight: 700; border-radius: var(--es-radius); }
.tx-row { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 0; border-bottom: 1rpx solid var(--es-border-soft); }
.tx-row:last-child { border-bottom: none; }
.tx-main { display: flex; flex-direction: column; flex: 1; }
.tx-type { font-size: 28rpx; color: var(--es-text); font-weight: 600; }
.tx-sub { margin-top: 6rpx; font-size: 22rpx; color: var(--es-text-dim); }
.tx-right { display: flex; flex-direction: column; align-items: flex-end; }
.tx-amount { font-size: 28rpx; color: var(--es-success); font-weight: 600; }
.tx-amount.negative { color: var(--es-danger); }
.mini-btn { margin-top: 12rpx; padding: 8rpx 20rpx; font-size: 24rpx; color: var(--es-primary); border: 1rpx solid var(--es-primary); border-radius: var(--es-radius); background: transparent; }
.empty { padding: 24rpx 0; text-align: center; color: var(--es-text-dim); font-size: 26rpx; }
@media(max-width:1100px){.wallet-grid{grid-template-columns:1fr}.wallet-grid .form{margin-bottom:0}}
</style>
