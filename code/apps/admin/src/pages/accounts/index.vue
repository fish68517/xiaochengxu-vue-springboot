<template>
  <AdminShell title="账号管理">
  <view class="page">
    <PageHeader eyebrow="STAFF ACCOUNTS" title="账号管理" description="创建接单人员账号并管理实名审核与账号状态" />

    <view class="form">
      <text class="section-title">创建接单服务人员</text>
      <view class="field">
        <text class="label">手机号</text>
        <input v-model="createForm.phone" class="input" placeholder="接单服务人员手机号" />
      </view>
      <view class="field">
        <text class="label">初始密码</text>
        <input v-model="createForm.initialPassword" class="input" password placeholder="初始密码（首次登录强制改密）" />
      </view>
      <view class="field">
        <text class="label">昵称</text>
        <input v-model="createForm.nickname" class="input" placeholder="昵称（选填）" />
      </view>
      <button class="save-btn" :disabled="creating" @click="create">创建账号</button>
    </view>

    <text class="section-title">接单服务人员列表</text>
    <view v-if="error" class="empty">
      <text>{{ error }}</text>
      <button class="mini-btn" @click="load">重试</button>
    </view>
    <view v-else-if="workers.length === 0" class="empty"><text>暂无接单服务人员</text></view>
    <view v-for="w in workers" :key="idOf(w)" class="worker-row">
      <view class="worker-main">
        <text class="worker-name">{{ w.nickname || '未命名' }}（服务接单人员）</text>
        <text class="worker-phone">{{ maskPhone(w.phone) }}</text>
        <text class="worker-sub">实名：{{ realnameText(w.realnameStatus) }} · 状态：{{ w.status === 'DISABLED' ? '已停用' : '正常' }}</text>
      </view>
      <view class="worker-actions">
        <button v-if="w.realnameStatus !== 'APPROVED'" class="mini-btn" @click="approveRealname(w)">审核实名通过</button>
        <button class="mini-btn" :class="{ danger: w.status !== 'DISABLED' }" @click="toggleStatus(w)">
          {{ w.status === 'DISABLED' ? '启用账号' : '停用账号' }}
        </button>
      </view>
    </view>
  </view>
  </AdminShell>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '../../api.js';
import { maskPhone } from '../../utils/display.js';

const workers = ref([]);
const error = ref('');
const creating = ref(false);
const createForm = ref({ phone: '', initialPassword: '', nickname: '' });

// 主键兼容：统一 _id 后以 _id 为准，兼容旧 id/workerId。
function idOf(w) { return w._id || w.id || w.workerId; }
function realnameText(s) { return { APPROVED: '已通过', PENDING: '待审核', REJECTED: '已驳回' }[s] || s || '未提交'; }

onLoad(load);

// 加载接单人员列表，失败显示 error/retry 空态（T0-09）。
async function load() {
  error.value = '';
  try {
    const list = await api.listWorkers();
    workers.value = Array.isArray(list) ? list : [];
  } catch (e) {
    error.value = e.message || '账号列表加载失败';
  }
}

// 创建接单人员（createWorker：手机号唯一 + mustChangePwd=true），成功以服务端返回更新列表。
async function create() {
  const { phone, initialPassword, nickname } = createForm.value;
  if (!phone) { uni.showToast({ title: '手机号不能为空', icon: 'none' }); return; }
  if (!initialPassword) { uni.showToast({ title: '初始密码不能为空', icon: 'none' }); return; }
  creating.value = true;
  try {
    const user = await api.createWorker({ phone, initialPassword, nickname: nickname || phone });
    workers.value.push(user);
    createForm.value = { phone: '', initialPassword: '', nickname: '' };
    uni.showToast({ title: '已创建，首次登录强制改密', icon: 'success' });
  } catch (e) {
    uni.showToast({ title: e.message || '创建失败', icon: 'none' });
  } finally {
    creating.value = false;
  }
}

// 实名审核通过：真实调 updateWorker，成功后以服务端结果替换本地行。
async function approveRealname(w) {
  try {
    const updated = await api.updateWorker({ workerId: idOf(w), realnameStatus: 'APPROVED' });
    replaceRow(w, updated);
    uni.showToast({ title: '已审核通过', icon: 'success' });
  } catch (e) {
    uni.showToast({ title: e.message || '操作失败', icon: 'none' });
  }
}

// 启用/停用账号：真实调 updateWorker，失败不修改本地状态（回滚）。
async function toggleStatus(w) {
  const next = w.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED';
  try {
    const updated = await api.updateWorker({ workerId: idOf(w), status: next });
    replaceRow(w, updated);
    uni.showToast({ title: next === 'DISABLED' ? '已停用' : '已启用', icon: 'success' });
  } catch (e) {
    uni.showToast({ title: e.message || '操作失败', icon: 'none' });
  }
}

function replaceRow(w, updated) {
  const idx = workers.value.findIndex((x) => idOf(x) === idOf(w));
  if (idx >= 0) workers.value[idx] = updated || w;
}
</script>

<style lang="scss" scoped>
.page { padding: 24rpx; }
.head { padding: 32rpx; margin-bottom: 24rpx; background: var(--es-bg-panel); border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); box-shadow: var(--es-glow); }
.head-title { font-size: 40rpx; font-weight: 700; color: var(--es-primary); }
.section-title { display: block; font-size: 28rpx; color: var(--es-primary); margin: 24rpx 0 12rpx; }
.form { padding: 24rpx; background: var(--es-bg-panel); border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); margin-bottom: 24rpx; }
.field { margin-bottom: 20rpx; }
.label { display: block; font-size: 26rpx; color: var(--es-primary); margin-bottom: 8rpx; }
.input { height: 80rpx; padding: 0 24rpx; background: #0f172a; border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); color: var(--es-text); }
.worker-row { display: flex; justify-content: space-between; align-items: center; padding: 24rpx; margin-bottom: 16rpx; background: var(--es-bg-panel); border-radius: var(--es-radius); }
.worker-main { display: flex; flex-direction: column; }
.worker-name { font-size: 30rpx; color: var(--es-text); font-weight: 600; }
.worker-phone { margin-top: 8rpx; font-size: 24rpx; color: var(--es-text-dim); }
.worker-sub { margin-top: 8rpx; font-size: 22rpx; color: var(--es-text-dim); }
.worker-actions { display: flex; flex-direction: column; gap: 12rpx; }
.mini-btn { padding: 8rpx 16rpx; font-size: 24rpx; color: var(--es-primary); border: 1rpx solid var(--es-primary); border-radius: var(--es-radius); background: transparent; }
.mini-btn.danger { color: var(--es-danger); border-color: var(--es-danger); }
.save-btn { margin-top: 8rpx; background: linear-gradient(135deg, var(--es-primary), var(--es-secondary)); color: #0a0e17; font-weight: 700; border-radius: var(--es-radius); }
.empty { padding: 32rpx; text-align: center; color: var(--es-text-dim); font-size: 26rpx; }
</style>
