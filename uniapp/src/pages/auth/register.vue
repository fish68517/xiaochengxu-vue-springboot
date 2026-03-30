<template>
  <view class="page">
    <view class="panel">
      <text class="title">用户注册</text>
      <text class="subtitle">当前移动端只面向普通用户，后台与商家端继续使用 Web。</text>

      <view class="field">
        <text class="label">用户名</text>
        <input v-model="form.username" class="input" placeholder="请输入用户名" />
      </view>

      <view class="field">
        <text class="label">昵称</text>
        <input v-model="form.nickname" class="input" placeholder="请输入昵称" />
      </view>

      <view class="field">
        <text class="label">密码</text>
        <input v-model="form.password" class="input" password placeholder="请输入密码" />
      </view>

      <view class="field">
        <text class="label">确认密码</text>
        <input v-model="form.confirmPassword" class="input" password placeholder="请再次输入密码" />
      </view>

      <button class="primary-btn" :loading="loading" @tap="handleRegister">注册</button>
      <button class="ghost-btn" @tap="goLogin">返回登录</button>
    </view>
  </view>
</template>

<script>
import { userApi } from '../../api/modules/user'

export default {
  data() {
    return {
      loading: false,
      form: {
        username: '',
        nickname: '',
        password: '',
        confirmPassword: ''
      }
    }
  },
  methods: {
    async handleRegister() {
      if (this.loading) return

      if (!this.form.username.trim()) {
        uni.showToast({ title: '请输入用户名', icon: 'none' })
        return
      }

      if (!this.form.password.trim()) {
        uni.showToast({ title: '请输入密码', icon: 'none' })
        return
      }

      if (this.form.password !== this.form.confirmPassword) {
        uni.showToast({ title: '两次密码不一致', icon: 'none' })
        return
      }

      this.loading = true
      try {
        await userApi.register({
          username: this.form.username.trim(),
          nickname: this.form.nickname.trim(),
          password: this.form.password.trim(),
          role: 'user'
        })

        uni.showToast({
          title: '注册成功',
          icon: 'success'
        })

        setTimeout(() => {
          uni.navigateBack({
            delta: 1
          })
        }, 250)
      } catch (error) {
        // request layer handled toast
      } finally {
        this.loading = false
      }
    },
    goLogin() {
      uni.navigateBack({
        delta: 1
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 36rpx;
  background:
    radial-gradient(circle at top left, rgba(255, 213, 168, 0.84), transparent 32%),
    linear-gradient(180deg, #fff8f0 0%, #f7f4ef 100%);
}

.panel {
  margin-top: 80rpx;
  padding: 34rpx 30rpx;
  border: 1rpx solid rgba(234, 215, 196, 0.9);
  border-radius: 32rpx;
  background: rgba(255, 253, 248, 0.96);
  box-shadow: $shadow-soft;
}

.title {
  display: block;
  color: $text-primary;
  font-size: 40rpx;
  font-weight: 700;
}

.subtitle {
  display: block;
  margin-top: 12rpx;
  color: $text-secondary;
  font-size: 24rpx;
  line-height: 1.7;
}

.field {
  margin-top: 20rpx;
}

.label {
  display: block;
  margin-bottom: 10rpx;
  color: $text-secondary;
  font-size: 24rpx;
}

.input {
  width: 100%;
  height: 88rpx;
  padding: 0 22rpx;
  border: 1rpx solid $border-color;
  border-radius: 22rpx;
  background: #fff;
}

.primary-btn,
.ghost-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 92rpx;
  margin-top: 24rpx;
  border-radius: 24rpx;
  font-size: 30rpx;
  font-weight: 700;
}

.primary-btn {
  background: linear-gradient(135deg, $brand-primary 0%, $brand-secondary 100%);
  color: #fff7ee;
}

.ghost-btn {
  margin-top: 16rpx;
  border: 1rpx solid $border-color;
  background: #fff8f0;
  color: $text-secondary;
}
</style>
