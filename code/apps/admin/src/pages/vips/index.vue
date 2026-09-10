<template>
  <AdminShell title="VIP 名单">
  <view class="page">
    <PageHeader eyebrow="VIP DIRECTORY" title="VIP 名单" description="按手机号或微信号维护品牌重点客户名单" />

    <view v-if="error" class="empty">
      <text>{{ error }}</text>
      <button class="mini-btn" @click="load">重试</button>
    </view>
    <view v-else-if="vips.length === 0" class="empty"><text>暂无 VIP 名单</text></view>
    <view v-for="v in vips" :key="v._id || (v.matchType + v.matchKey)" class="vip-row">
      <view class="vip-main">
        <text class="vip-name">{{ v.matchType === 'phone' ? maskPhone(v.matchKey) : v.matchKey }}（{{ matchTypeText(v.matchType) }}）</text>
        <text class="vip-sub">{{ v.note || '—' }}</text>
      </view>
      <button class="mini-btn danger" @click="remove(v)">移除</button>
    </view>

    <view class="form">
      <text class="section-title">新增 VIP</text>
      <radio-group class="radio-row" @change="(e) => (form.matchType = e.detail.value)">
        <label class="radio-item"><radio value="phone" :checked="form.matchType === 'phone'" />手机号</label>
        <label class="radio-item"><radio value="wechat" :checked="form.matchType === 'wechat'" />微信号</label>
      </radio-group>
      <view class="field">
        <text class="label">匹配值</text>
        <input v-model="form.matchKey" class="input" placeholder="手机号或微信号" />
      </view>
      <view class="field">
        <text class="label">备注</text>
        <input v-model="form.note" class="input" placeholder="备注（选填）" />
      </view>
      <button class="save-btn" :disabled="saving" @click="add">新增 VIP</button>
    </view>
  </view>
  </AdminShell>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '../../api.js';
import { maskPhone } from '../../utils/display.js';

const vips = ref([]);
const error = ref('');
const saving = ref(false);
const form = ref({ matchType: 'phone', matchKey: '', note: '' });

function matchTypeText(t) { return { phone: '手机号', wechat: '微信号' }[t] || t; }

onLoad(load);

// 加载 VIP 名单，失败显示 error/retry 空态（T0-09）。
async function load() {
  error.value = '';
  try {
    const list = await api.listVips();
    vips.value = Array.isArray(list) ? list : [];
  } catch (e) {
    error.value = e.message || 'VIP 名单加载失败';
  }
}

// 新增 VIP：真实调 addVip（matchKey 唯一），成功后以服务端返回更新列表。
async function add() {
  const matchKey = form.value.matchKey.trim();
  if (!matchKey) { uni.showToast({ title: '匹配值不能为空', icon: 'none' }); return; }
  saving.value = true;
  try {
    const saved = await api.addVip({ matchType: form.value.matchType, matchKey, note: form.value.note.trim() });
    vips.value.push(saved);
    form.value = { matchType: 'phone', matchKey: '', note: '' };
    uni.showToast({ title: '已新增', icon: 'success' });
  } catch (e) {
    uni.showToast({ title: e.message || '新增失败', icon: 'none' });
  } finally {
    saving.value = false;
  }
}

// 移除 VIP：真实调 removeVip，成功后移除本地行。
async function remove(v) {
  try {
    await api.removeVip({ vipId: v._id || v.id });
    vips.value = vips.value.filter((x) => (x._id || x.id) !== (v._id || v.id));
    uni.showToast({ title: '已移除', icon: 'none' });
  } catch (e) {
    uni.showToast({ title: e.message || '操作失败', icon: 'none' });
  }
}
</script>

<style lang="scss" scoped>
.page { padding: 24rpx; }
.head { padding: 32rpx; margin-bottom: 24rpx; background: var(--es-bg-panel); border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); box-shadow: var(--es-glow); }
.head-title { font-size: 40rpx; font-weight: 700; color: var(--es-primary); }
.vip-row { display: flex; justify-content: space-between; align-items: center; padding: 24rpx; margin-bottom: 16rpx; background: var(--es-bg-panel); border-radius: var(--es-radius); }
.vip-main { display: flex; flex-direction: column; }
.vip-name { font-size: 30rpx; color: var(--es-text); font-weight: 600; }
.vip-sub { margin-top: 8rpx; font-size: 24rpx; color: var(--es-text-dim); }
.form { margin-top: 24rpx; padding: 24rpx; background: var(--es-bg-panel); border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); }
.section-title { display: block; font-size: 28rpx; color: var(--es-primary); margin-bottom: 12rpx; }
.field { margin-bottom: 20rpx; }
.label { display: block; font-size: 26rpx; color: var(--es-primary); margin-bottom: 8rpx; }
.input { height: 80rpx; padding: 0 24rpx; background: #0f172a; border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); color: var(--es-text); }
.radio-row { display: flex; gap: 32rpx; margin-bottom: 20rpx; }
.radio-item { display: flex; align-items: center; gap: 8rpx; font-size: 26rpx; color: var(--es-text); }
.save-btn { margin-top: 8rpx; background: linear-gradient(135deg, var(--es-primary), var(--es-secondary)); color: #0a0e17; font-weight: 700; border-radius: var(--es-radius); }
.mini-btn { padding: 8rpx 16rpx; font-size: 24rpx; color: var(--es-primary); border: 1rpx solid var(--es-primary); border-radius: var(--es-radius); background: transparent; }
.mini-btn.danger { color: var(--es-danger); border-color: var(--es-danger); }
.empty { padding: 32rpx; text-align: center; color: var(--es-text-dim); font-size: 26rpx; }
</style>
