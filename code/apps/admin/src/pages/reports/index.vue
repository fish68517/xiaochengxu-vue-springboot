<template>
  <AdminShell title="经营报表">
  <view class="page">
    <PageHeader eyebrow="BUSINESS REPORTS" title="经营报表" description="查看订单、人员、提现和利润对账数据并导出 CSV" />

    <view class="tabs">
      <view v-for="t in REPORT_TYPES" :key="t.key" class="tab" :class="{ active: activeKey === t.key }" @click="switchTab(t.key)">
        <text>{{ t.label }}</text>
      </view>
    </view>

    <view class="filter">
      <view class="field">
        <text class="label">开始日期</text>
        <input v-model="from" class="input" placeholder="YYYY-MM-DD" />
      </view>
      <view class="field">
        <text class="label">结束日期</text>
        <input v-model="to" class="input" placeholder="YYYY-MM-DD" />
      </view>
      <view v-if="activeKey === 'profit'" class="field">
        <text class="label">维度</text>
        <picker :range="dimLabels" @change="(e) => (dim = dimKeys[Number(e.detail.value)])">
          <view class="picker">{{ dimLabel }}</view>
        </picker>
      </view>
    </view>

    <view v-if="activeKey === 'profit'" class="recon-card">
      <text class="recon-label">对账：接单人员钱包余额总和</text>
      <text class="recon-value">{{ reconText }}</text>
      <button class="mini-btn recon-btn" :disabled="reconLoading" @click="runLedgerReconciliation">
        {{ reconLoading ? '对账中…' : '执行钱包账本对账' }}
      </button>
      <text v-if="ledgerAlert" class="ledger-alert" :class="{ danger: ledgerDiffCount > 0 }">{{ ledgerAlert }}</text>
    </view>

    <view class="toolbar">
      <text class="count">{{ rows.length }} 条</text>
      <button class="mini-btn" @click="exportCurrent">导出 CSV</button>
    </view>

    <view v-if="error" class="empty">
      <text>{{ error }}</text>
      <button class="mini-btn" @click="load">重试</button>
    </view>
    <view v-else-if="rows.length === 0" class="empty"><text>暂无数据</text></view>
    <view v-else class="table">
      <view class="tr th">
        <text v-for="c in columns" :key="c.key" class="td">{{ c.label }}</text>
      </view>
      <view v-for="(r, i) in rows" :key="i" class="tr">
        <text v-for="c in columns" :key="c.key" class="td">{{ formatCell(c, r) }}</text>
      </view>
    </view>
  </view>
  </AdminShell>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '../../api.js';
import { exportCsv } from '../../utils/csv.js';

// 报表四件套定义：列配置（fen=金额转元，time=时间格式化）。
const REPORT_TYPES = [
  {
    key: 'orders', label: '订单流水', api: 'reportOrders',
    cols: [
      { key: 'orderNo', label: '订单号' },
      { key: 'createdAt', label: '时间', time: true },
      { key: 'customerNickname', label: '客户' },
      { key: 'game', label: '游戏' },
      { key: 'serviceType', label: '服务类型' },
      { key: 'amountFen', label: '金额(元)', fen: true },
      { key: 'refundFen', label: '退款(元)', fen: true },
      { key: 'status', label: '状态' },
    ],
  },
  {
    key: 'workers', label: '业绩', api: 'reportWorkers',
    cols: [
      { key: 'workerNickname', label: '人员' },
      { key: 'orderCount', label: '接单数' },
      { key: 'completedCount', label: '完成数' },
      { key: 'earningsFen', label: '佣金(元)', fen: true },
    ],
  },
  {
    key: 'withdrawals', label: '提现', api: 'reportWithdrawals',
    cols: [
      { key: 'workerNickname', label: '人员' },
      { key: 'amountFen', label: '金额(元)', fen: true },
      { key: 'status', label: '状态' },
      { key: 'batchNo', label: '打款凭证' },
      { key: 'createdAt', label: '时间', time: true },
    ],
  },
  {
    key: 'profit', label: '利润', api: 'reportProfit',
    cols: [
      { key: 'dim', label: '维度' },
      { key: 'grossIncomeFen', label: '实收(元)', fen: true },
      { key: 'feeFen', label: '手续费(元)', fen: true },
      { key: 'commissionFen', label: '佣金(元)', fen: true },
      { key: 'refundLossFen', label: '退款净损(元)', fen: true },
      { key: 'netIncomeFen', label: '净收入(元)', fen: true },
    ],
  },
];

const dimKeys = ['day', 'month', 'game', 'serviceType', 'worker'];
const dimLabels = ['日', '月', '游戏', '服务类型', '接单人员'];

const activeKey = ref('orders');
const rows = ref([]);
const error = ref('');
const from = ref('');
const to = ref('');
const dim = ref('month');
const reconText = ref('—');
const reconLoading = ref(false);
const ledgerAlert = ref('');
const ledgerDiffCount = ref(0);

const activeType = computed(() => REPORT_TYPES.find((t) => t.key === activeKey.value));
const columns = computed(() => activeType.value.cols);
const dimLabel = computed(() => dimLabels[dimKeys.indexOf(dim.value)] || dim.value);

onLoad(() => switchTab('orders'));

function switchTab(key) {
  activeKey.value = key;
  reconText.value = '—';
  ledgerAlert.value = '';
  ledgerDiffCount.value = 0;
  load();
}

async function runLedgerReconciliation() {
  reconLoading.value = true;
  ledgerAlert.value = '';
  try {
    const result = await api.reconcileWalletLedger();
    const rows = Array.isArray(result) ? result : (result?.items || result?.rows || []);
    ledgerDiffCount.value = rows.filter((row) => row.ok === false || Number(row.differenceFen || row.diffFen || 0) !== 0).length;
    ledgerAlert.value = ledgerDiffCount.value > 0
      ? `发现 ${ledgerDiffCount.value} 个钱包账本差异，请立即复核` : `对账通过：已核对 ${rows.length} 个钱包`;
  } catch (e) {
    ledgerAlert.value = e.message || '钱包账本对账失败';
    ledgerDiffCount.value = 1;
  } finally {
    reconLoading.value = false;
  }
}

// 归一化报表返回：兼容数组或 { list/rows/items } 包装。
function toRows(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.list)) return res.list;
  if (res && Array.isArray(res.rows)) return res.rows;
  if (res && Array.isArray(res.items)) return res.items;
  return [];
}

function fenToYuan(fen) { return ((Number(fen) || 0) / 100).toFixed(2); }

function formatTime(v) {
  if (v == null || v === '') return '—';
  const d = new Date(typeof v === 'number' ? v : Date.parse(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

function formatCell(col, row) {
  const v = row[col.key];
  if (col.fen) return fenToYuan(v);
  if (col.time) return formatTime(v);
  return v == null || v === '' ? '—' : String(v);
}

// 加载当前报表；profit 额外取对账余额总和。
async function load() {
  error.value = '';
  const t = activeType.value;
  const params = { dim: activeKey.value === 'profit' ? dim.value : undefined, from: from.value || undefined, to: to.value || undefined };
  try {
    const res = await api[t.api](params);
    rows.value = toRows(res);
    if (activeKey.value === 'profit' && res) {
      const fen = res.reconciliationFen ?? res.totalWalletBalanceFen ?? res.walletBalanceSumFen;
      reconText.value = fen != null ? `¥${fenToYuan(fen)}` : '—（后端未返回对账项）';
    }
  } catch (e) {
    error.value = e.message || '报表加载失败';
    rows.value = [];
  }
}

// 导出当前报表为 CSV（表头 + 数据行，金额已转元）。
function exportCurrent() {
  if (rows.value.length === 0) { uni.showToast({ title: '暂无数据可导出', icon: 'none' }); return; }
  const header = columns.value.map((c) => c.label);
  const body = rows.value.map((r) => columns.value.map((c) => formatCell(c, r)));
  exportCsv(`report-${activeKey.value}.csv`, [header, ...body]);
}
</script>

<style lang="scss" scoped>
.page { padding: 24rpx; }
.head { padding: 32rpx; margin-bottom: 24rpx; background: var(--es-bg-panel); border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); box-shadow: var(--es-glow); }
.head-title { font-size: 40rpx; font-weight: 700; color: var(--es-primary); }
.tabs { display: flex; gap: 16rpx; margin-bottom: 24rpx; }
.tab { flex: 1; padding: 16rpx; text-align: center; font-size: 26rpx; color: var(--es-text-dim); background: var(--es-bg-panel); border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); }
.tab.active { color: var(--es-primary); border-color: var(--es-primary); }
.filter { display: flex; flex-wrap: wrap; gap: 16rpx; margin-bottom: 24rpx; }
.field { flex: 1; min-width: 40%; }
.label { display: block; font-size: 24rpx; color: var(--es-primary); margin-bottom: 8rpx; }
.input { height: 72rpx; padding: 0 20rpx; background: #0f172a; border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); color: var(--es-text); }
.picker { height: 72rpx; line-height: 72rpx; padding: 0 20rpx; background: #0f172a; border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); color: var(--es-text); }
.recon-card { padding: 24rpx; margin-bottom: 24rpx; background: var(--es-bg-panel); border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); display: flex; flex-direction: column; }
.recon-label { font-size: 24rpx; color: var(--es-text-dim); }
.recon-value { margin-top: 8rpx; font-size: 40rpx; font-weight: 700; color: var(--es-success); }
.recon-btn { align-self: flex-start; margin: 20rpx 0 0; }
.ledger-alert { margin-top: 12rpx; font-size: 24rpx; color: var(--es-success); }
.ledger-alert.danger { color: var(--es-danger, #f87171); }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.count { font-size: 24rpx; color: var(--es-text-dim); }
.mini-btn { padding: 8rpx 20rpx; font-size: 24rpx; color: var(--es-primary); border: 1rpx solid var(--es-primary); border-radius: var(--es-radius); background: transparent; }
.table { background: var(--es-bg-panel); border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); overflow-x: auto; }
.tr { display: flex; border-bottom: 1rpx solid var(--es-border-soft); }
.tr.th { background: #16213a; }
.tr:last-child { border-bottom: none; }
.td { flex: 1; min-width: 160rpx; padding: 16rpx 12rpx; font-size: 22rpx; color: var(--es-text); border-right: 1rpx solid var(--es-border-soft); word-break: break-all; }
.td:last-child { border-right: none; }
.th .td { color: var(--es-primary); font-weight: 600; }
.empty { padding: 32rpx; text-align: center; color: var(--es-text-dim); font-size: 26rpx; }
</style>
