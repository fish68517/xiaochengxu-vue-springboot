<template>
  <AdminShell title="账号管理">
  <view class="page">
    <PageHeader eyebrow="STAFF ACCOUNTS" title="账号管理" description="统一创建接单服务人员与客服账号，管理实名审核和账号状态" />

    <view class="form">
      <text class="label">{{ staffAllBrands ? '账号归档品牌（不限制当前联调访问范围）' : '品牌（创建账号和授权均使用此选择）' }}</text>
      <picker :range="brands" range-key="label" :value="brandIndex" @change="brandIndex=Number($event.detail.value)"><view class="input">{{ brands[brandIndex]?.label || '请选择品牌' }}</view></picker>
      <text class="worker-sub">{{ staffAllBrands ? '联调模式：客服和工作人员默认授权所有品牌，无需逐个点击授权。' : '客服与工作人员必须获授权订单所属品牌，例如 demo-a。' }}</text>
      <text class="section-title">创建员工账号</text>
      <view class="field">
        <text class="label">员工角色</text>
        <picker :range="roleOptions" range-key="label" @change="(e) => (createForm.role = roleOptions[e.detail.value].value)">
          <view class="input role-picker">{{ roleOptions.find((item) => item.value === createForm.role)?.label }}</view>
        </picker>
      </view>
      <view class="field">
        <text class="label">手机号</text>
        <input v-model="createForm.phone" class="input" placeholder="接单服务人员手机号" />
      </view>
      <view class="field">
        <text class="label">初始密码</text>
        <input v-model="createForm.initialPassword" class="input" password placeholder="12–128 位，至少满足 3 类字符" />
      </view>
      <view class="field">
        <text class="label">昵称</text>
        <input v-model="createForm.nickname" class="input" placeholder="昵称（选填）" />
      </view>
      <button class="save-btn" :disabled="creating" @click="create">创建员工账号</button>
    </view>

    <text class="section-title">员工列表</text>
    <view v-if="error" class="empty">
      <text>{{ error }}</text>
      <button class="mini-btn" @click="load">重试</button>
    </view>
    <view v-else-if="workers.length === 0" class="empty"><text>暂无接单服务人员</text></view>
    <view v-for="w in workers" :key="idOf(w)" class="worker-row">
      <view class="worker-main">
        <text class="worker-name">{{ w.nickname || '未命名' }}（{{ roleText(w.role) }}）</text>
        <text class="worker-phone">{{ maskPhone(w.phone) }}</text>
        <text class="worker-sub">{{ w.role === 'WORKER' ? `实名：${realnameText(w.realnameStatus)} · ` : '' }}状态：{{ w.status === 'DISABLED' ? '已停用' : '正常' }}</text>
        <text v-if="w.realnameRejectReason" class="worker-sub">驳回原因：{{ w.realnameRejectReason }}</text>
      </view>
      <view class="worker-actions">
        <text class="worker-sub">授权品牌：{{ staffAllBrands ? '所有品牌（联调默认）' : (grants[idOf(w)] || []).join('、') || '仅历史 default' }}</text>
        <button v-if="!staffAllBrands" class="mini-btn" :disabled="grantBusy || !brands[brandIndex]" @click="grantBrand(w)">授权所选品牌</button>
        <button v-if="w.role === 'WORKER' && w.realnameStatus !== 'APPROVED'" class="mini-btn" @click="approveRealname(w)">实名通过</button>
        <button v-if="w.role === 'WORKER' && w.realnameStatus !== 'REJECTED'" class="mini-btn danger" @click="rejectRealname(w)">实名驳回</button>
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
const staffAllBrands = ref(false);
const brands = ref([]); const brandIndex = ref(0); const grants = ref({}); const grantBusy = ref(false);
const error = ref('');
const creating = ref(false);
const roleOptions = [{ label: '接单服务人员', value: 'WORKER' }, { label: '客服', value: 'CS' }];
const createForm = ref({ role: 'WORKER', phone: '', initialPassword: '', nickname: '' });

// 主键兼容：统一 _id 后以 _id 为准，兼容旧 id/workerId。
function idOf(w) { return w._id || w.id || w.workerId; }
function realnameText(s) { return { APPROVED: '已通过', PENDING: '待审核', REJECTED: '已驳回' }[s] || s || '未提交'; }
function roleText(role) { return role === 'WORKER' ? '接单服务人员' : ['CS', 'CUSTOMER_SERVICE'].includes(role) ? '客服' : role; }
function passwordClassCount(value) { return [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/].filter((rule) => rule.test(value || '')).length; }

onLoad(load);

// 加载接单人员列表，失败显示 error/retry 空态（T0-09）。
async function load() {
  error.value = '';
  try {
    const [list, brandList, roleRows, profile] = await Promise.all([api.listStaffForAccess(), api.listBrands(), api.listUserBrandRoles(), api.getAccessProfile()]);
    staffAllBrands.value = profile.staffAllBrands === true;
    brands.value = brandList.map(b => ({ ...b, label: `${b.name}（${b.brandId}）` }));
    grants.value = {};
    for (const row of roleRows) if(row.status === 'ACTIVE') (grants.value[row.userId] ||= []).push(row.brandId);
    workers.value = (Array.isArray(list) ? list : []).filter((item) => ['WORKER', 'CS', 'CUSTOMER_SERVICE'].includes(item.role));
  } catch (e) {
    error.value = e.message || '账号列表加载失败';
  }
}

// 创建接单人员（createWorker：手机号唯一 + mustChangePwd=true），成功以服务端返回更新列表。
async function create() {
  const { role, phone, initialPassword, nickname } = createForm.value;
  const brandId = brands.value[brandIndex.value]?.brandId || (staffAllBrands.value ? 'default' : '');
  if (!brandId) { uni.showToast({title:'请先选择品牌',icon:'none'}); return; }
  if (!phone) { uni.showToast({ title: '手机号不能为空', icon: 'none' }); return; }
  if (!initialPassword) { uni.showToast({ title: '初始密码不能为空', icon: 'none' }); return; }
  if (initialPassword.length < 12 || initialPassword.length > 128 || passwordClassCount(initialPassword) < 3) {
    uni.showToast({ title: '初始密码需 12–128 位且至少满足 3 类字符', icon: 'none' });
    return;
  }
  creating.value = true;
  try {
    const user = await api.createStaff({ role, phone, password: initialPassword, nickname: nickname || phone, brandId });
    await load();
    createForm.value = { role: 'WORKER', phone: '', initialPassword: '', nickname: '' };
    uni.showToast({ title: '已创建，首次登录强制改密', icon: 'success' });
  } catch (e) {
    uni.showToast({ title: e.message || '创建失败', icon: 'none' });
  } finally {
    creating.value = false;
  }
}

async function grantBrand(w) {
  const brand = brands.value[brandIndex.value]; if (!brand || grantBusy.value) return;
  const confirmed = await new Promise(resolve=>uni.showModal({title:'确认品牌授权',content:`允许 ${w.nickname || '该员工'} 处理 ${brand.label} 的订单？员工需重新登录。`,success:r=>resolve(r.confirm),fail:()=>resolve(false)}));
  if (!confirmed) return;
  grantBusy.value=true;
  try {
    const existing=(await api.listUserBrandRoles({userId:idOf(w)})).find(r=>r.brandId===brand.brandId);
    await api.saveUserBrandRoles({userId:idOf(w),brandId:brand.brandId,roles:existing?.roles?.length?existing.roles:[w.role==='WORKER'?'WORKER':'CS'],permissions:existing?.permissions||[],status:'ACTIVE'});
    await load(); uni.showToast({title:'授权成功，请员工重新登录',icon:'none'});
  } catch(e){uni.showToast({title:e.message||'授权失败',icon:'none'});}finally{grantBusy.value=false;}
}
async function rejectRealname(w) {
  const result = await new Promise((resolve) => uni.showModal({ title: '实名审核驳回', content: '', editable: true, placeholderText: '请输入驳回原因', success: resolve }));
  if (!result.confirm) return;
  const reason = String(result.content || '').trim();
  if (!reason) { uni.showToast({ title: '驳回原因不能为空', icon: 'none' }); return; }
  try {
    await api.updateWorker({ workerId: idOf(w), realnameStatus: 'REJECTED', realnameRejectReason: reason });
    await load();
    uni.showToast({ title: '已驳回', icon: 'none' });
  } catch (e) { uni.showToast({ title: e.message || '操作失败', icon: 'none' }); }
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
    const updated = await api.updateStaff({ userId: idOf(w), status: next });
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
.role-picker { display: flex; align-items: center; }
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
