<template>
  <view class="page"><text class="tip">正在跳转…</text></view>
</template>

<script setup>
// 旧钱包页已迁移至 worker/wallet，此处保留重定向避免死链
import { onLoad } from '@dcloudio/uni-app';
onLoad(() => {
  uni.redirectTo({ url: '/pages/worker/wallet' });
});
</script>

<style lang="scss" scoped>
.page { padding: 80rpx; text-align: center; }
.tip { color: var(--es-text-dim); font-size: 28rpx; }
</style>
