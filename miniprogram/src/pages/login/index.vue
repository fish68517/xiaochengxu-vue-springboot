<script setup lang="ts">
import { ref } from 'vue'
import { useSessionStore } from '../../stores/session'

type LoginType = 'OWNER' | 'TECHNICIAN'

const store = useSessionStore()
const cachedType = uni.getStorageSync('login_type')
const loginType = ref<LoginType>(cachedType === 'TECHNICIAN' ? 'TECHNICIAN' : 'OWNER')
const username = ref(String(uni.getStorageSync('registered_username') || ''))
const password = ref('')
const submitting = ref(false)

function selectType(type:LoginType) {
  loginType.value = type
  uni.setStorageSync('login_type',type)
}

async function submit() {
  if (!username.value.trim() || password.value.length < 8) {
    return uni.showToast({title:'请输入用户名和至少8位密码',icon:'none'})
  }
  submitting.value = true
  try {
    const user = await store.login(username.value.trim(),password.value,loginType.value)
    uni.setStorageSync('registered_username',username.value.trim())
    uni.showToast({title:'登录成功',icon:'success'})
    if (user.role === 'TECHNICIAN') uni.redirectTo({url:'/pages/technician/index'})
    else uni.switchTab({url:'/pages/home/index'})
  } finally { submitting.value = false }
}

function goRegister(){uni.navigateTo({url:'/pages/register/index'})}
</script>

<template>
  <view class="login-page">
    <view class="brand"><view>E</view><strong>电梯云管家</strong><text>账号由 MySQL 统一管理</text></view>
    <view class="login-card card">
      <view class="type-title">请选择登录类型</view>
      <view class="type-switch">
        <view :class="{active:loginType==='OWNER'}" @click="selectType('OWNER')"><text>业</text><strong>业主登录</strong></view>
        <view :class="{active:loginType==='TECHNICIAN'}" @click="selectType('TECHNICIAN')"><text>修</text><strong>维修师傅登录</strong></view>
      </view>
      <label><text>用户名</text><input v-model="username" placeholder="请输入用户名" /></label>
      <label><text>密码</text><input v-model="password" password placeholder="请输入密码" @confirm="submit" /></label>
      <button class="primary-btn" :loading="submitting" @click="submit">{{ loginType==='OWNER'?'业主登录':'维修师傅登录' }}</button>
      <view class="register-row"><text>还没有账号？</text><text @click="goRegister">立即注册</text></view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.login-page{min-height:100vh;padding:calc(var(--status-bar-height) + 80rpx) 42rpx 60rpx;background:linear-gradient(160deg,#eaf3ff,#f7faff 48%,#eef4ff)}
.brand{text-align:center}.brand view{width:100rpx;height:100rpx;border-radius:28rpx;background:#1768ed;color:white;display:grid;place-items:center;margin:auto;font-size:54rpx;font-weight:900}.brand strong,.brand text{display:block}.brand strong{font-size:42rpx;margin-top:24rpx}.brand text{color:#77849a;margin-top:10rpx}
.login-card{margin-top:45rpx;padding:34rpx}.type-title{font-weight:700;margin-bottom:16rpx}.type-switch{display:grid;grid-template-columns:1fr 1fr;gap:16rpx;margin-bottom:30rpx}.type-switch>view{height:92rpx;padding:0 16rpx;border:2rpx solid #dfe7f2;border-radius:18rpx;display:flex;align-items:center;justify-content:center;gap:10rpx;color:#7d8798;background:#f8faff}.type-switch text{width:42rpx;height:42rpx;border-radius:14rpx;background:#e7edf6;display:grid;place-items:center;font-size:21rpx}.type-switch strong{font-size:23rpx}.type-switch .active{color:#1768ed;border-color:#1768ed;background:#edf4ff;box-shadow:0 6rpx 18rpx #1768ed1f}.type-switch .active text{background:#1768ed;color:#fff}
.login-card label{display:block;margin-bottom:28rpx}.login-card label>text{display:block;font-weight:700;margin-bottom:12rpx}.login-card input{height:86rpx;background:#f5f8fc;border:1rpx solid #dfe7f2;border-radius:16rpx;padding:0 22rpx}.register-row{display:flex;justify-content:center;gap:10rpx;color:#8b96a8;font-size:23rpx;margin-top:26rpx}.register-row text:last-child{color:#1768ed;font-weight:700}
</style>
