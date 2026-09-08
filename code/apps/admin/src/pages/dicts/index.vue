<template>
  <AdminShell title="业务字典">
  <view class="page">
    <PageHeader eyebrow="BUSINESS DICTIONARY" title="业务字典" description="维护游戏、区服和服务类型等可配置选项" />

    <view class="tabs">
      <view v-for="t in types" :key="t.key" class="tab" :class="{ active: activeType === t.key }" @click="switchType(t.key)">
        <text>{{ t.label }}</text>
      </view>
    </view>

    <view v-if="error" class="empty">
      <text>{{ error }}</text>
      <button class="mini-btn" @click="load">重试</button>
    </view>
    <view v-else-if="dicts.length === 0" class="empty"><text>暂无{{ activeLabel }}字典</text></view>
    <view v-for="d in dicts" :key="d._id || d.code" class="dict-row">
      <view class="dict-main">
        <text class="dict-name">{{ d.name }}（{{ d.code }}）</text>
        <text class="dict-sub">排序 {{ d.sort ?? 0 }}</text>
      </view>
    </view>

    <view class="form">
      <text class="section-title">新增{{ activeLabel }}</text>
      <view class="field">
        <text class="label">编码 code</text>
        <input v-model="form.code" class="input" placeholder="唯一编码" />
      </view>
      <view class="field">
        <text class="label">名称</text>
        <input v-model="form.name" class="input" placeholder="名称" />
      </view>
      <view class="field">
        <text class="label">排序</text>
        <input v-model="form.sort" class="input" type="number" placeholder="数字越小越靠前" />
      </view>
      <button class="save-btn" :disabled="saving" @click="save">新增字典项</button>
    </view>
  </view>
  </AdminShell>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '../../api.js';
import { findRedline } from '../../utils/redline.js';

const types = [
  { key: 'game', label: '游戏' },
  { key: 'region', label: '区服' },
  { key: 'service_type', label: '服务类型' },
];
const activeType = ref('game');
const activeLabel = computed(() => (types.find((t) => t.key === activeType.value) || {}).label || '');
const dicts = ref([]);
const error = ref('');
const saving = ref(false);
const form = ref({ code: '', name: '', sort: '' });

onLoad(load);

function switchType(key) {
  activeType.value = key;
  load();
}

// 加载指定 type 字典列表，失败显示 error/retry 空态（T0-09）。
async function load() {
  error.value = '';
  try {
    const list = await api.listDicts({ type: activeType.value });
    dicts.value = Array.isArray(list) ? list : [];
  } catch (e) {
    error.value = e.message || '字典加载失败';
  }
}

// 新增字典项：真实调 saveDict（type+code 唯一），成功后以服务端返回更新列表。
async function save() {
  const code = form.value.code.trim();
  const name = form.value.name.trim();
  if (!code) { uni.showToast({ title: '编码不能为空', icon: 'none' }); return; }
  if (!name) { uni.showToast({ title: '名称不能为空', icon: 'none' }); return; }
  // 服务类型等对外文案走红线校验。
  const word = findRedline(name);
  if (word) { uni.showToast({ title: `名称含违禁词“${word}”，请修改`, icon: 'none' }); return; }

  saving.value = true;
  try {
    const saved = await api.saveDict({ type: activeType.value, code, name, sort: Number(form.value.sort || 0) });
    dicts.value.push(saved);
    form.value = { code: '', name: '', sort: '' };
    uni.showToast({ title: '已新增', icon: 'success' });
  } catch (e) {
    uni.showToast({ title: e.message || '新增失败', icon: 'none' });
  } finally {
    saving.value = false;
  }
}
</script>

<style lang="scss" scoped>
.page { padding: 24rpx; }
.head { padding: 32rpx; margin-bottom: 24rpx; background: var(--es-bg-panel); border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); box-shadow: var(--es-glow); }
.head-title { font-size: 40rpx; font-weight: 700; color: var(--es-primary); }
.tabs { display: flex; gap: 16rpx; margin-bottom: 24rpx; }
.tab { flex: 1; padding: 16rpx; text-align: center; font-size: 26rpx; color: var(--es-text-dim); background: var(--es-bg-panel); border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); }
.tab.active { color: var(--es-primary); border-color: var(--es-primary); }
.dict-row { display: flex; align-items: center; padding: 24rpx; margin-bottom: 16rpx; background: var(--es-bg-panel); border-radius: var(--es-radius); }
.dict-main { display: flex; flex-direction: column; }
.dict-name { font-size: 28rpx; color: var(--es-text); font-weight: 600; }
.dict-sub { margin-top: 8rpx; font-size: 22rpx; color: var(--es-text-dim); }
.form { margin-top: 24rpx; padding: 24rpx; background: var(--es-bg-panel); border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); }
.section-title { display: block; font-size: 28rpx; color: var(--es-primary); margin-bottom: 12rpx; }
.field { margin-bottom: 20rpx; }
.label { display: block; font-size: 26rpx; color: var(--es-primary); margin-bottom: 8rpx; }
.input { height: 80rpx; padding: 0 24rpx; background: #0f172a; border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); color: var(--es-text); }
.save-btn { margin-top: 8rpx; background: linear-gradient(135deg, var(--es-primary), var(--es-secondary)); color: #0a0e17; font-weight: 700; border-radius: var(--es-radius); }
.mini-btn { margin-top: 12rpx; padding: 8rpx 20rpx; font-size: 24rpx; color: var(--es-primary); border: 1rpx solid var(--es-primary); border-radius: var(--es-radius); background: transparent; }
.empty { padding: 32rpx; text-align: center; color: var(--es-text-dim); font-size: 26rpx; }
</style>
