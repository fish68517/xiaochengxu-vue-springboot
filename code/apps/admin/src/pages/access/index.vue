<template>
  <AdminShell title="角色与品牌权限">
  <view class="page">
    <PageHeader eyebrow="ACCESS CONTROL" title="角色与品牌权限" description="配置账号品牌角色；前端菜单仅改善体验，权限仍由后端强校验" />
    <AsyncState :loading="loading" :error="error" :permission-denied="denied" :empty="!loading && !error && users.length === 0" empty-text="暂无账号" @retry="load" />
    <view v-if="users.length" class="layout">
      <scroll-view scroll-y class="users"><view v-for="user in users" :key="user._id" class="user" :class="{ active: selectedUser?._id === user._id }" @click="selectUser(user)"><text class="strong">{{ user.nickname || maskPhone(user.phone) || user._id }}</text><text>{{ roleText(user.role) }} · {{ user.status === 'DISABLED' ? '已停用' : '正常' }}</text></view></scroll-view>
      <view class="editor">
        <text class="section">{{ selectedUser?.nickname || maskPhone(selectedUser?.phone) }} 的品牌授权</text>
        <picker :range="brandLabels" :value="brandIndex" @change="changeBrand"><view class="picker">{{ brandLabels[brandIndex] || '选择品牌' }}</view></picker>
        <checkbox-group class="roles" @change="changeRoles"><label v-for="role in roleOptions" :key="role" class="role"><checkbox :value="role" :checked="selectedRoles.includes(role)" color="#22d3ee"/>{{ role }}</label></checkbox-group>
        <input v-model="permissionsText" class="input" placeholder="额外 permissions，逗号分隔（可选）" />
        <picker :range="['ACTIVE','DISABLED']" :value="grantStatus === 'ACTIVE' ? 0 : 1" @change="grantStatus = Number($event.detail.value) === 0 ? 'ACTIVE' : 'DISABLED'"><view class="picker">授权状态：{{ grantStatus }}</view></picker>
        <DangerConfirm label="保存品牌角色" title="确认修改权限" :content="`将修改 ${selectedUser?.nickname || maskPhone(selectedUser?.phone) || selectedUser?._id} 在 ${selectedBrandId} 的后端权限并写审计。`" @confirm="save" />
        <text class="section">现有授权</text><view v-for="row in grants" :key="row._id" class="grant"><text>{{ row.brandId }} · {{ (row.roles || []).join(', ') }}</text><text>{{ row.status }} · {{ (row.permissions || []).join(', ') || '无额外权限' }}</text></view>
      </view>
    </view>
  </view>
  </AdminShell>
</template>
<script setup>
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '../../api.js';
import AsyncState from '../../components/AsyncState.vue';
import DangerConfirm from '../../components/DangerConfirm.vue';
import { maskPhone, roleText } from '../../utils/display.js';
const roleOptions = ['CUSTOMER_SERVICE', 'ORDER_TAKER', 'DISPATCHER', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'ARBITRATOR'];
const users = ref([]); const brands = ref([]); const grants = ref([]); const selectedUser = ref(null); const brandIndex = ref(0); const selectedRoles = ref([]); const permissionsText = ref(''); const grantStatus = ref('ACTIVE'); const loading = ref(false); const error = ref(''); const denied = ref(false);
const brandLabels = computed(() => brands.value.map((brand) => `${brand.name || brand.brandId}（${brand.brandId}）`)); const selectedBrandId = computed(() => brands.value[brandIndex.value]?.brandId || '');
async function load() { loading.value = true; error.value = ''; denied.value = false; try { const [userRows, brandRows] = await Promise.all([api.listUsers(), api.listBrands()]); users.value = Array.isArray(userRows) ? userRows : []; brands.value = Array.isArray(brandRows) ? brandRows : []; if (!selectedUser.value && users.value.length) await selectUser(users.value[0]); } catch (e) { error.value = e.message || '权限数据加载失败'; denied.value = e.code === 403 || e.code === 'FORBIDDEN'; } finally { loading.value = false; } }
async function selectUser(user) { selectedUser.value = user; grants.value = await api.listUserBrandRoles({ userId: user._id }); applyGrant(); }
function changeBrand(event) { brandIndex.value = Number(event.detail.value); applyGrant(); }
function applyGrant() { const row = grants.value.find((item) => item.brandId === selectedBrandId.value); selectedRoles.value = [...(row?.roles || [])]; permissionsText.value = (row?.permissions || []).join(','); grantStatus.value = row?.status || 'ACTIVE'; }
function changeRoles(event) { selectedRoles.value = event.detail.value || []; }
async function save() { if (!selectedUser.value || !selectedBrandId.value || !selectedRoles.value.length) { uni.showToast({ title: '请选择用户、品牌和至少一个角色', icon: 'none' }); return; } try { await api.saveUserBrandRoles({ userId: selectedUser.value._id, brandId: selectedBrandId.value, roles: selectedRoles.value, permissions: permissionsText.value.split(',').map((item) => item.trim()).filter(Boolean), status: grantStatus.value }); grants.value = await api.listUserBrandRoles({ userId: selectedUser.value._id }); applyGrant(); uni.showToast({ title: '权限已保存', icon: 'success' }); } catch (e) { uni.showToast({ title: e.message || '保存失败', icon: 'none' }); } }
onLoad(load);
</script>
<style lang="scss" scoped>
.page{padding:24rpx}.head,.users,.editor{background:var(--es-bg-panel);border:1rpx solid var(--es-border-soft);border-radius:var(--es-radius)}.head{display:flex;justify-content:space-between;padding:28rpx;margin-bottom:18rpx}.title{font-size:36rpx;font-weight:700;color:var(--es-primary)}.hint{font-size:22rpx;color:var(--es-text-dim)}.layout{display:grid;grid-template-columns:320rpx minmax(0,1fr);gap:18rpx;min-height:700rpx}.users{max-height:75vh}.user{display:flex;flex-direction:column;gap:6rpx;padding:18rpx;color:var(--es-text-dim);border-bottom:1rpx solid var(--es-border-soft)}.user.active{background:#16213a;color:var(--es-primary)}.strong{color:var(--es-text);font-weight:600}.editor{padding:22rpx}.section{display:block;margin:12rpx 0 16rpx;color:var(--es-primary);font-weight:600}.picker,.input{height:68rpx;line-height:68rpx;padding:0 16rpx;margin-bottom:14rpx;background:#0f172a;color:var(--es-text);border:1rpx solid var(--es-border-soft);border-radius:var(--es-radius)}.roles{display:flex;flex-wrap:wrap;gap:12rpx;margin-bottom:16rpx}.role{font-size:22rpx;color:var(--es-text)}.grant{display:flex;flex-direction:column;gap:6rpx;padding:14rpx 0;color:var(--es-text-dim);border-bottom:1rpx solid var(--es-border-soft)}
@media(max-width:900px){.layout{grid-template-columns:1fr}.users{max-height:300rpx}}
</style>
