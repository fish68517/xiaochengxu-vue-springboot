<script setup lang="ts">
defineProps<{ title: string; back?: boolean; subtitle?: string }>()
const goBack = () => uni.navigateBack({ fail: () => uni.reLaunch({ url: '/pages/home/index' }) })
</script>

<template>
  <view class="header">
    <view v-if="back" class="back" @click="goBack">‹</view>
    <view class="heading">
      <text class="title">{{ title }}</text>
      <text v-if="subtitle" class="subtitle">{{ subtitle }}</text>
    </view>
    <view class="capsule">•••　◉</view>
  </view>
</template>

<style scoped lang="scss">
.header { height: 118rpx; padding: 34rpx 24rpx 16rpx; display: flex; align-items: center; justify-content: center; position: relative; background: rgba(255,249,241,.96); }
.heading { display: flex; flex-direction: column; align-items: center; }
.title { font-size: 32rpx; font-weight: 800; }
.subtitle { margin-top: 3rpx; color: #8b8078; font-size: 20rpx; }
.back { position: absolute; left: 24rpx; top: 38rpx; width: 54rpx; height: 54rpx; font-size: 58rpx; line-height: 46rpx; }
.capsule { position: absolute; right: 22rpx; top: 39rpx; padding: 10rpx 19rpx; border: 1rpx solid #eadfcf; border-radius: 30rpx; font-size: 21rpx; background: rgba(255,255,255,.8); }
</style>
