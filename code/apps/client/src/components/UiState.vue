<template>
  <view class="ui-state">
    <image class="state-image" src="/static/empty-state.svg" mode="aspectFit" />
    <text class="state-title">{{ title }}</text>
    <text v-if="description" class="state-description">{{ description }}</text>
    <button v-if="actionText" class="state-action" @click="$emit('action')">{{ actionText }}</button>
  </view>
</template>
<script setup>
defineProps({ title: { type: String, default: '暂无内容' }, description: { type: String, default: '' }, actionText: { type: String, default: '' } });
defineEmits(['action']);
</script>
<style lang="scss" scoped>
.ui-state { min-height: 480rpx; padding: 70rpx 32rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.state-image { width: 260rpx; height: 180rpx; opacity: .92; }
.state-title { margin-top: 20rpx; color: var(--color-text); font-size: 30rpx; font-weight: 700; }
.state-description { max-width: 560rpx; margin-top: 10rpx; color: var(--color-text-secondary); font-size: 25rpx; line-height: 1.55; }
.state-action { width: 240rpx; height: 76rpx; margin-top: 28rpx; color: #fff; font-size: 26rpx; line-height: 76rpx; background: var(--brand-primary); border-radius: 40rpx; }
</style>
