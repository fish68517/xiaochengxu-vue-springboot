<script setup lang="ts">
import { reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/AppHeader.vue'
import { createAddress, deleteAddress, getAddresses, setDefaultAddress, updateAddress } from '@/api/address'
import type { Address } from '@/models'

const addresses = ref<Address[]>([])
const editingId = ref<number | null>(null)
const showForm = ref(false)
const form = reactive({ receiver_name: '', phone: '', province: '', city: '', district: '', detail: '', is_default: false })

async function load() { addresses.value = await getAddresses() }
onShow(() => { load().catch(showError) })
function showError(error: unknown) { uni.showToast({ title: error instanceof Error ? error.message : '操作失败', icon: 'none' }) }
function resetForm() { editingId.value = null; Object.assign(form, { receiver_name: '', phone: '', province: '', city: '', district: '', detail: '', is_default: !addresses.value.length }); showForm.value = true }
function edit(item: Address) { editingId.value = item.id; Object.assign(form, item); showForm.value = true }
async function save() {
  if (!form.receiver_name || !form.phone || !form.province || !form.city || !form.detail) return uni.showToast({ title: '请填写完整地址', icon: 'none' })
  try {
    if (editingId.value) await updateAddress(editingId.value, { ...form })
    else await createAddress({ ...form })
    showForm.value = false; await load()
  } catch (error) { showError(error) }
}
async function makeDefault(id: number) { try { await setDefaultAddress(id); await load() } catch (error) { showError(error) } }
async function remove(id: number) { try { await deleteAddress(id); await load() } catch (error) { showError(error) } }
function changeDefault(event: Event) { form.is_default = (event as unknown as { detail: { value: boolean } }).detail.value }
</script>

<template>
  <view class="app-shell address-page">
    <AppHeader title="收货地址" back />
    <view class="page-body">
      <view v-for="item in addresses" :key="item.id" class="address app-card"><view><b>{{ item.receiver_name }}　{{ item.phone }}</b><text>{{ item.province }}{{ item.city }}{{ item.district }}{{ item.detail }}</text><small v-if="item.is_default">默认地址</small></view><view><button @click="edit(item)">编辑</button><button v-if="!item.is_default" @click="makeDefault(item.id)">设为默认</button><button @click="remove(item.id)">删除</button></view></view>
      <view v-if="showForm" class="form app-card"><input v-model="form.receiver_name" placeholder="收货人" /><input v-model="form.phone" placeholder="手机号" /><input v-model="form.province" placeholder="省" /><input v-model="form.city" placeholder="市" /><input v-model="form.district" placeholder="区/县" /><input v-model="form.detail" placeholder="详细地址" /><label><switch :checked="form.is_default" color="#f56b16" @change="changeDefault" />设为默认地址</label><button class="primary-button" @click="save">保存地址</button></view>
      <button v-else class="primary-button add" @click="resetForm">＋ 新增收货地址</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.address-page{min-height:100vh}.address,.form{padding:24rpx;margin-bottom:18rpx}.address>view:first-child{display:flex;flex-direction:column;gap:12rpx}.address b{font-size:24rpx}.address text{color:#746b64;font-size:21rpx;line-height:1.5}.address small{width:max-content;padding:3rpx 12rpx;border-radius:12rpx;color:#fff;background:#f56b16}.address>view:last-child{display:flex;gap:10rpx;margin-top:18rpx}.address button{height:48rpx;padding:0 18rpx;border-radius:24rpx;color:#7d7068;background:#f8f0e5;font-size:18rpx;line-height:48rpx}.form input{height:68rpx;margin-bottom:14rpx;padding:0 18rpx;border:1rpx solid #ebdcc8;border-radius:14rpx;background:#fff}.form label{display:flex;align-items:center;margin:15rpx 0;font-size:21rpx}.form .primary-button,.add{width:100%}
</style>
