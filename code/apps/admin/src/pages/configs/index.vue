<template>
  <AdminShell title="系统配置">
  <view class="page">
    <PageHeader eyebrow="SYSTEM SETTINGS" title="系统配置" description="管理支付时限、接单上限、提现规则和异议窗口" />

    <view v-if="error" class="empty">
      <text>{{ error }}</text>
      <button class="mini-btn" @click="load">重试</button>
    </view>
    <view v-else class="form">
      <text class="section-title">全系统配置项</text>

      <view class="field">
        <text class="label">支付时限（分钟）</text>
        <input v-model="form.payTimeoutMinutes" class="input" type="number" />
      </view>
      <view class="field">
        <text class="label">无人抢单超时（分钟）</text>
        <input v-model="form.poolTimeoutMinutes" class="input" type="number" />
      </view>
      <view class="field">
        <text class="label">指派处理超时（分钟）</text>
        <input v-model="form.assignTimeoutMinutes" class="input" type="number" />
      </view>
      <view class="field">
        <text class="label">同时接单上限</text>
        <input v-model="form.maxActiveOrders" class="input" type="number" />
      </view>
      <view class="field">
        <text class="label">周提现次数</text>
        <input v-model="form.weeklyWithdrawLimit" class="input" type="number" />
      </view>
      <view class="field">
        <text class="label">补单次数上限</text>
        <input v-model="form.maxReworkCount" class="input" type="number" />
      </view>
      <view class="field">
        <text class="label">结单后异议窗口（小时）</text>
        <input v-model="form.disputeWindowHours" class="input" type="number" />
      </view>
      <view class="field">
        <text class="label">起提金额（元）</text>
        <input v-model="form.minWithdrawYuan" class="input" type="digit" />
      </view>
      <view class="field">
        <text class="label">轮询刷新频率（秒）</text>
        <input v-model="form.pollIntervalSeconds" class="input" type="number" />
      </view>
      <view class="field">
        <text class="label">会话超时（分钟）</text>
        <input v-model="form.sessionTimeoutMinutes" class="input" type="number" />
      </view>

      <button class="save-btn" :disabled="saving" @click="save">保存配置</button>
    </view>
  </view>
  </AdminShell>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '../../api.js';

// 配置项默认值（§11.1），getConfigs 缺字段时兜底展示。
const DEFAULTS = {
  payTimeoutMinutes: 30,
  poolTimeoutMinutes: 30,
  assignTimeoutMinutes: 30,
  maxActiveOrders: 3,
  weeklyWithdrawLimit: 3,
  maxReworkCount: 1,
  disputeWindowHours: 72,
  minWithdrawFen: 1000,
  pollIntervalSeconds: 10,
  sessionTimeoutMinutes: 30,
};

const form = ref({ ...DEFAULTS });
const error = ref('');
const saving = ref(false);

onLoad(load);

// 归一化 configs 返回值：对象直接用；数组 [{cfgKey,cfgValue}] 转为对象。
function normalize(res) {
  if (!res) return {};
  if (Array.isArray(res)) {
    const obj = {};
    res.forEach((r) => { if (r && r.cfgKey) obj[r.cfgKey] = r.cfgValue; });
    return obj;
  }
  return res;
}

// 加载配置项，失败显示 error/retry 空态（T0-09）。
async function load() {
  error.value = '';
  try {
    const cfg = normalize(await api.getConfigs());
    const minWithdrawFen = cfg.minWithdrawFen != null ? cfg.minWithdrawFen : DEFAULTS.minWithdrawFen;
    form.value = {
      payTimeoutMinutes: cfg.payTimeoutMinutes ?? DEFAULTS.payTimeoutMinutes,
      poolTimeoutMinutes: cfg.poolTimeoutMinutes ?? DEFAULTS.poolTimeoutMinutes,
      assignTimeoutMinutes: cfg.assignTimeoutMinutes ?? DEFAULTS.assignTimeoutMinutes,
      maxActiveOrders: cfg.maxActiveOrders ?? DEFAULTS.maxActiveOrders,
      weeklyWithdrawLimit: cfg.weeklyWithdrawLimit ?? DEFAULTS.weeklyWithdrawLimit,
      maxReworkCount: cfg.maxReworkCount ?? DEFAULTS.maxReworkCount,
      disputeWindowHours: cfg.disputeWindowHours ?? DEFAULTS.disputeWindowHours,
      minWithdrawYuan: ((minWithdrawFen || 0) / 100).toString(),
      pollIntervalSeconds: cfg.pollIntervalSeconds ?? DEFAULTS.pollIntervalSeconds,
      sessionTimeoutMinutes: cfg.sessionTimeoutMinutes ?? DEFAULTS.sessionTimeoutMinutes,
    };
  } catch (e) {
    error.value = e.message || '配置加载失败';
  }
}

// 保存配置：真实调 updateConfigs，configs 为键值对象（起提金额元 → 分）。
async function save() {
  saving.value = true;
  try {
    const configs = {
      payTimeoutMinutes: Number(form.value.payTimeoutMinutes),
      poolTimeoutMinutes: Number(form.value.poolTimeoutMinutes),
      assignTimeoutMinutes: Number(form.value.assignTimeoutMinutes),
      maxActiveOrders: Number(form.value.maxActiveOrders),
      weeklyWithdrawLimit: Number(form.value.weeklyWithdrawLimit),
      maxReworkCount: Number(form.value.maxReworkCount),
      disputeWindowHours: Number(form.value.disputeWindowHours),
      minWithdrawFen: Math.round(parseFloat(form.value.minWithdrawYuan || '0') * 100),
      pollIntervalSeconds: Number(form.value.pollIntervalSeconds),
      sessionTimeoutMinutes: Number(form.value.sessionTimeoutMinutes),
    };
    const saved = normalize(await api.updateConfigs({ configs }));
    uni.showToast({ title: '已保存', icon: 'success' });
    // 成功后以服务端返回值刷新本地表单，避免展示与服务端不一致。
    const minWithdrawFen = saved.minWithdrawFen != null ? saved.minWithdrawFen : configs.minWithdrawFen;
    form.value.minWithdrawYuan = ((minWithdrawFen || 0) / 100).toString();
  } catch (e) {
    uni.showToast({ title: e.message || '保存失败', icon: 'none' });
  } finally {
    saving.value = false;
  }
}
</script>

<style lang="scss" scoped>
.page { padding: 24rpx; }
.head { padding: 32rpx; margin-bottom: 24rpx; background: var(--es-bg-panel); border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); box-shadow: var(--es-glow); }
.head-title { font-size: 40rpx; font-weight: 700; color: var(--es-primary); }
.form { padding: 24rpx; background: var(--es-bg-panel); border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); }
.section-title { display: block; font-size: 28rpx; color: var(--es-primary); margin-bottom: 12rpx; }
.field { margin-bottom: 20rpx; }
.label { display: block; font-size: 26rpx; color: var(--es-primary); margin-bottom: 8rpx; }
.input { height: 80rpx; padding: 0 24rpx; background: #0f172a; border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); color: var(--es-text); }
.save-btn { margin-top: 8rpx; background: linear-gradient(135deg, var(--es-primary), var(--es-secondary)); color: #0a0e17; font-weight: 700; border-radius: var(--es-radius); }
.mini-btn { margin-top: 12rpx; padding: 8rpx 20rpx; font-size: 24rpx; color: var(--es-primary); border: 1rpx solid var(--es-primary); border-radius: var(--es-radius); background: transparent; }
.empty { padding: 32rpx; text-align: center; color: var(--es-text-dim); font-size: 26rpx; }
</style>
