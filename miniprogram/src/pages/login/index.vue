<script setup lang="ts">
import { ref } from 'vue'
import { useSessionStore } from '../../stores/session'

const store = useSessionStore()
const username = ref('owner_101')
const password = ref('Owner@123456')
const submitting = ref(false)

async function submit() {
  if (!username.value || password.value.length < 8) return uni.showToast({title:'请输入账号和密码',icon:'none'})
  submitting.value = true
  try {
    const user = await store.login(username.value.trim(),password.value)
    uni.showToast({title:'登录成功',icon:'success'})
    if (user.role === 'TECHNICIAN') uni.redirectTo({url:'/pages/technician/index'})
    else if (user.role === 'ADMIN') uni.showModal({title:'管理员账号',content:'请使用管理后台网站登录。',showCancel:false,success:()=>store.logout()})
    else uni.switchTab({url:'/pages/home/index'})
  } finally { submitting.value = false }
}
</script>

<template>
  <view class="login-page">
    <view class="brand"><view>E</view><strong>电梯云管家</strong><text>账号由 MySQL 统一管理</text></view>
    <view class="login-card card">
      <label><text>用户名</text><input v-model="username" placeholder="请输入用户名" /></label>
      <label><text>密码</text><input v-model="password" password placeholder="请输入密码" @confirm="submit" /></label>
      <button class="primary-btn" :loading="submitting" @click="submit">登录</button>
      <view class="tip">本机业主账号：owner_101 / Owner@123456</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.login-page{min-height:100vh;padding:calc(var(--status-bar-height) + 110rpx) 42rpx;background:linear-gradient(160deg,#eaf3ff,#f7faff 48%,#eef4ff)}
.brand{text-align:center}.brand view{width:100rpx;height:100rpx;border-radius:28rpx;background:#1768ed;color:white;display:grid;place-items:center;margin:auto;font-size:54rpx;font-weight:900}.brand strong,.brand text{display:block}.brand strong{font-size:42rpx;margin-top:24rpx}.brand text{color:#77849a;margin-top:10rpx}
.login-card{margin-top:60rpx;padding:34rpx}.login-card label{display:block;margin-bottom:28rpx}.login-card label text{display:block;font-weight:700;margin-bottom:12rpx}.login-card input{height:86rpx;background:#f5f8fc;border:1rpx solid #dfe7f2;border-radius:16rpx;padding:0 22rpx}.tip{text-align:center;color:#8b96a8;font-size:21rpx;margin-top:24rpx}
</style>
