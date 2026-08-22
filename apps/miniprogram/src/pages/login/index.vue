<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

const username = ref('user')
const password = ref('user123')
const submitting = ref(false)
const auth = useAuthStore()

async function submit() {
  if (!username.value.trim() || !password.value) return uni.showToast({ title: '请输入账号和密码', icon: 'none' })
  submitting.value = true
  try {
    await auth.login(username.value.trim(), password.value)
    uni.reLaunch({ url: '/pages/home/index' })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '登录失败', icon: 'none' })
  } finally { submitting.value = false }
}
</script>

<template>
  <view class="login-page">
    <view class="logo">🐢 🐰</view>
    <text class="title">萌宠生活商城</text>
    <text class="subtitle">登录后，购物车、地址和订单将保存到 MySQL</text>
    <view class="form app-card">
      <input v-model="username" placeholder="账号" />
      <input v-model="password" password placeholder="密码" @confirm="submit" />
      <button class="primary-button" :disabled="submitting" @click="submit">{{ submitting ? '正在登录...' : '登录' }}</button>
      <text>本地验收账号：user / user123</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.login-page{min-height:100vh;padding:160rpx 48rpx;background:radial-gradient(circle at 50% 15%,#fff4c9,#fff9f1 48%);box-sizing:border-box;text-align:center}.logo{font-size:120rpx}.title{display:block;margin-top:24rpx;color:#ef5a11;font-size:42rpx;font-weight:900}.subtitle{display:block;margin:16rpx 0 38rpx;color:#80736a;font-size:22rpx}.form{padding:30rpx;text-align:left}.form input{height:80rpx;margin-bottom:20rpx;padding:0 24rpx;border:1rpx solid #ead8c0;border-radius:18rpx;background:#fff;font-size:24rpx}.form button{width:100%;margin-top:10rpx}.form text{display:block;margin-top:22rpx;color:#95887e;text-align:center;font-size:19rpx}
</style>
