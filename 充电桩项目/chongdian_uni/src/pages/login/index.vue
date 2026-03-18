<template>
  <view class="page">
    <view class="card">
      <view class="title">智能充电桩</view>
      <view class="sub">毕业设计精简版（uni-app）</view>

      <view class="tabs">
        <view
          class="tab"
          :class="{ active: activeTab === 'phone' }"
          @tap="activeTab = 'phone'"
        >手机号登录</view>
        <view
          class="tab"
          :class="{ active: activeTab === 'email' }"
          @tap="activeTab = 'email'"
        >邮箱登录</view>
      </view>

      <view v-if="activeTab === 'phone'" class="form">
        <input class="input" type="number" maxlength="11" placeholder="手机号" v-model="phone" />
        <input class="input" type="text" password placeholder="密码" v-model="password" />
        <button class="btn" @tap="handlePhoneLogin" :disabled="loading">登录</button>
      </view>

      <view v-else class="form">
        <input class="input" type="text" placeholder="邮箱" v-model="email" />
        <view class="row">
          <input class="input code" type="number" maxlength="6" placeholder="验证码" v-model="code" />
          <button class="btn ghost" @tap="handleSendCode" :disabled="countdown > 0 || loading">
            {{ countdown > 0 ? `${countdown}s` : '发送验证码' }}
          </button>
        </view>
        <button class="btn" @tap="handleEmailLogin" :disabled="loading">登录</button>
      </view>

      <view class="hint">后端默认地址：{{ baseUrl }}</view>
    </view>
  </view>
</template>

<script>
import { API_BASE_URL, TOKEN_KEY, USER_KEY } from '../../common/config'
import { getPhoneInfo, loginByEmail, loginByPhone, sendEmailCode } from '../../api/auth'

export default {
  data() {
    return {
      activeTab: 'phone',
      phone: '',
      password: '',
      email: '',
      code: '',
      countdown: 0,
      timer: null,
      loading: false,
      baseUrl: API_BASE_URL
    }
  },
  onLoad() {
    const token = uni.getStorageSync(TOKEN_KEY)
    if (token) {
      uni.reLaunch({ url: '/pages/home/index' })
    }
  },
  onUnload() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },
  methods: {
    async handlePhoneLogin() {
      if (!this.phone || !this.password) {
        uni.showToast({ title: '请输入手机号和密码', icon: 'none' })
        return
      }
      this.loading = true
      uni.showLoading({ title: '登录中...' })
      try {
        const loginRes = await loginByPhone(this.phone.trim(), this.password)
        const token = loginRes.token
        if (!token) {
          throw new Error('登录成功但未返回 token')
        }
        uni.setStorageSync(TOKEN_KEY, token)
        const userRes = await getPhoneInfo()
        uni.setStorageSync(USER_KEY, userRes.wxuser || {})
        uni.reLaunch({ url: '/pages/home/index' })
      } catch (error) {
        uni.showToast({ title: error.message || '登录失败', icon: 'none' })
      } finally {
        this.loading = false
        uni.hideLoading()
      }
    },
    async handleSendCode() {
      if (!this.email) {
        uni.showToast({ title: '请输入邮箱', icon: 'none' })
        return
      }
      if (this.countdown > 0) return
      this.loading = true
      try {
        await sendEmailCode(this.email.trim())
        uni.showToast({ title: '验证码已发送', icon: 'success' })
        this.startCountdown()
      } catch (error) {
        uni.showToast({ title: error.message || '发送失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    async handleEmailLogin() {
      if (!this.email || !this.code) {
        uni.showToast({ title: '请输入邮箱和验证码', icon: 'none' })
        return
      }
      this.loading = true
      uni.showLoading({ title: '登录中...' })
      try {
        const loginRes = await loginByEmail(this.email.trim(), this.code.trim())
        const token = loginRes.token
        if (!token) {
          throw new Error('登录成功但未返回 token')
        }
        uni.setStorageSync(TOKEN_KEY, token)
        const userRes = await getPhoneInfo()
        uni.setStorageSync(USER_KEY, userRes.wxuser || {})
        uni.reLaunch({ url: '/pages/home/index' })
      } catch (error) {
        uni.showToast({ title: error.message || '登录失败', icon: 'none' })
      } finally {
        this.loading = false
        uni.hideLoading()
      }
    },
    startCountdown() {
      this.countdown = 60
      if (this.timer) {
        clearInterval(this.timer)
      }
      this.timer = setInterval(() => {
        this.countdown -= 1
        if (this.countdown <= 0) {
          clearInterval(this.timer)
          this.timer = null
          this.countdown = 0
        }
      }, 1000)
    }
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  box-sizing: border-box;
}

.card {
  width: 100%;
  max-width: 680rpx;
  background: #ffffff;
  border-radius: 20rpx;
  padding: 36rpx;
  box-sizing: border-box;
  box-shadow: 0 10rpx 36rpx rgba(15, 23, 42, 0.08);
}

.title {
  font-size: 40rpx;
  font-weight: 700;
  color: #111827;
}

.sub {
  margin-top: 10rpx;
  font-size: 26rpx;
  color: #6b7280;
}

.tabs {
  margin-top: 28rpx;
  display: flex;
  border-radius: 14rpx;
  overflow: hidden;
  background: #f3f4f6;
}

.tab {
  flex: 1;
  text-align: center;
  padding: 18rpx 0;
  font-size: 26rpx;
  color: #6b7280;
}

.tab.active {
  background: #16a34a;
  color: #ffffff;
  font-weight: 600;
}

.form {
  margin-top: 24rpx;
}

.input {
  width: 100%;
  height: 88rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 12rpx;
  padding: 0 22rpx;
  font-size: 28rpx;
  box-sizing: border-box;
  margin-bottom: 18rpx;
  background: #fff;
}

.row {
  display: flex;
  gap: 12rpx;
}

.code {
  flex: 1;
  margin-bottom: 0;
}

.btn {
  background: #16a34a;
  color: #ffffff;
  border: none;
  height: 88rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  line-height: 88rpx;
}

.btn::after {
  border: none;
}

.btn.ghost {
  width: 220rpx;
  background: #ecfdf3;
  color: #15803d;
  font-size: 24rpx;
}

.hint {
  margin-top: 20rpx;
  color: #6b7280;
  font-size: 22rpx;
}
</style>
