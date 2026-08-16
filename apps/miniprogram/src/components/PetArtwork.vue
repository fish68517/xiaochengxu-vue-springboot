<script setup lang="ts">
withDefaults(defineProps<{ type?: string; size?: 'sm' | 'md' | 'lg' }>(), { type: 'turtle', size: 'md' })

const icons: Record<string, string> = {
  turtle: '🐢', 'turtle-dark': '🐢', rabbit: '🐰', 'rabbit-brown': '🐇', food: '🥕', tank: '🏡', gift: '🎁', coupon: '🎫', points: '🪙',
}
</script>

<template>
  <view class="art" :class="[`art--${size}`, `art--${type}`]">
    <text>{{ icons[type] || '🐾' }}</text>
    <view class="leaf leaf-a"></view><view class="leaf leaf-b"></view>
  </view>
</template>

<style scoped lang="scss">
.art { position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 42%, #fffdf1 0, #f4efd4 45%, #dce8bf 100%); }
.art text { position: relative; z-index: 2; filter: drop-shadow(0 12rpx 12rpx rgba(75,79,25,.16)); }
.art--sm { height: 100rpx; border-radius: 18rpx; }.art--sm text { font-size: 70rpx; }
.art--md { height: 220rpx; border-radius: 22rpx; }.art--md text { font-size: 150rpx; }
.art--lg { height: 450rpx; border-radius: 0 0 36rpx 36rpx; }.art--lg text { font-size: 280rpx; }
.art--rabbit, .art--rabbit-brown { background: radial-gradient(circle at 50% 45%, #fffdf7, #f6e7c9 53%, #d9e7c2); }
.art--food { background: linear-gradient(145deg,#f9edce,#dce9c2); }.art--tank { background: linear-gradient(145deg,#d8eddf,#c9ddaa); }
.leaf { position: absolute; width: 80rpx; height: 35rpx; border-radius: 100% 0 100% 0; background: rgba(114,160,72,.22); transform: rotate(35deg); }
.leaf-a { left: 8%; bottom: 12%; }.leaf-b { right: 8%; top: 14%; transform: rotate(210deg); }
</style>
