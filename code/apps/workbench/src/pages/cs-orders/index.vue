<template>
  <view class="page"><text class="tip">正在跳转…</text></view>
</template>

<script setup>
// 旧客服订单台已迁移至 cs/orders，此处保留重定向避免死链
import { onLoad } from '@dcloudio/uni-app';
onLoad(() => {
  uni.redirectTo({ url: '/pages/cs/orders' });
});
</script>

<style lang="scss" scoped>
.page { padding: 80rpx; text-align: center; }
.tip { color: var(--es-text-dim); font-size: 28rpx; }
</style>
