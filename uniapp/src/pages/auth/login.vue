<template>
  <view class="page">
    <view class="hero">
      <view class="hero-mark">USER</view>
      <text class="hero-title">移动端用户入口</text>
      <text class="hero-subtitle">保留 SpringBoot 后端接口，先打通用户端登录和浏览链路。</text>
    </view>

    <view class="panel">
      <view class="panel-header">
        <text class="panel-title">登录</text>
        <text class="panel-tip">当前阶段先迁移用户端</text>
      </view>

      <view class="field">
        <text class="label">用户名</text>
        <input
          v-model="form.username"
          class="input"
          type="text"
          placeholder="请输入用户名"
          confirm-type="next"
        />
      </view>

      <view class="field">
        <text class="label">密码</text>
        <input
          v-model="form.password"
          class="input"
          type="password"
          password
          placeholder="请输入密码"
          confirm-type="done"
          @confirm="handleLogin"
        />
      </view>

      <button class="submit-btn" :loading="loading" @tap="handleLogin">
        登录并进入首页
      </button>

      <button class="register-btn" @tap="goRegister">还没有账号？去注册</button>

      <view class="helper">
        <text>说明：商家端和后台仍继续使用 `vue/` Web 端。</text>
      </view>
    </view>
  </view>
</template>

<script>
import { userApi } from '../../api/modules/user'
import { getToken, setToken, setUserInfo } from '../../utils/storage'
import { pickPayload } from '../../utils/response'

export default {
  data() {
    return {
      loading: false,
      form: {
        username: '',
        password: ''
      }
    }
  },
  onLoad() {
    if (getToken()) {
      uni.switchTab({
        url: '/pages/home/index'
      })
    }
  },
  methods: {
    async handleLogin() {
      if (this.loading) return

      if (!this.form.username.trim()) {
        uni.showToast({
          title: '请输入用户名',
          icon: 'none'
        })
        return
      }

      if (!this.form.password.trim()) {
        uni.showToast({
          title: '请输入密码',
          icon: 'none'
        })
        return
      }

      this.loading = true

      try {
        const response = await userApi.login({
          username: this.form.username.trim(),
          password: this.form.password.trim(),
          role: 'user'
        })

        const userInfo = pickPayload(response)

        if (!userInfo || (!userInfo.token && !userInfo.id)) {
          uni.showToast({
            title: '登录返回数据异常',
            icon: 'none'
          })
          return
        }

        setToken(userInfo.token || 'session')
        setUserInfo(userInfo)

        uni.showToast({
          title: '登录成功',
          icon: 'success'
        })

        setTimeout(() => {
          uni.switchTab({
            url: '/pages/home/index'
          })
        }, 250)
      } catch (error) {
        // request layer already handled toast
      } finally {
        this.loading = false
      }
    },
    goRegister() {
      uni.navigateTo({
        url: '/pages/auth/register'
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 56rpx 36rpx;
  background:
    radial-gradient(circle at top right, rgba(255, 211, 153, 0.9), transparent 36%),
    linear-gradient(180deg, #fff6ea 0%, #f7f4ef 56%, #efe4d5 100%);
}

.hero {
  padding-top: 48rpx;
  margin-bottom: 40rpx;
}

.hero-mark {
  display: inline-flex;
  align-items: center;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(217, 119, 6, 0.12);
  color: $brand-primary;
  font-size: 22rpx;
  letter-spacing: 3rpx;
}

.hero-title {
  display: block;
  margin-top: 24rpx;
  color: $text-primary;
  font-size: 56rpx;
  font-weight: 700;
  line-height: 1.16;
}

.hero-subtitle {
  display: block;
  margin-top: 18rpx;
  color: $text-secondary;
  line-height: 1.7;
}

.panel {
  padding: 38rpx 32rpx;
  border: 1rpx solid rgba(234, 215, 196, 0.9);
  border-radius: 32rpx;
  background: rgba(255, 253, 248, 0.94);
  box-shadow: $shadow-soft;
  backdrop-filter: blur(14rpx);
}

.panel-header {
  margin-bottom: 28rpx;
}

.panel-title {
  display: block;
  color: $text-primary;
  font-size: 40rpx;
  font-weight: 700;
}

.panel-tip {
  display: block;
  margin-top: 10rpx;
  color: $text-light;
  font-size: 24rpx;
}

.field + .field {
  margin-top: 22rpx;
}

.label {
  display: block;
  margin-bottom: 12rpx;
  color: $text-secondary;
  font-size: 24rpx;
}

.input {
  width: 100%;
  height: 92rpx;
  padding: 0 24rpx;
  border: 1rpx solid $border-color;
  border-radius: 22rpx;
  background: #fff;
  color: $text-primary;
  font-size: 28rpx;
}

.submit-btn {
  width: 100%;
  height: 96rpx;
  margin-top: 30rpx;
  border-radius: 24rpx;
  background: linear-gradient(135deg, $brand-primary 0%, $brand-secondary 100%);
  color: #fff7ee;
  font-size: 30rpx;
  font-weight: 700;
  box-shadow: 0 18rpx 36rpx rgba(217, 119, 6, 0.24);
}

.helper {
  margin-top: 24rpx;
  color: $text-light;
  font-size: 22rpx;
  line-height: 1.7;
}

.register-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 84rpx;
  margin-top: 16rpx;
  border-radius: 22rpx;
  border: 1rpx solid $border-color;
  background: #fff8f0;
  color: $text-secondary;
  font-size: 26rpx;
}
</style>
