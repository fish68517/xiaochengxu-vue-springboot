<script setup lang="ts">
import { useCartStore } from '@/stores/cart'

defineProps<{ current: 'home' | 'mall' | 'lottery' | 'cart' | 'profile' }>()
const cart = useCartStore()
const tabs = [
  { key: 'home', label: '首页', icon: '⌂', url: '/pages/home/index' },
  { key: 'mall', label: '商城', icon: '▣', url: '/pages/mall/index' },
  { key: 'lottery', label: '活动', icon: '♧', url: '/pages/lottery/detail' },
  { key: 'cart', label: '购物车', icon: '🛒', url: '/pages/cart/index' },
  { key: 'profile', label: '我的', icon: '♙', url: '/pages/profile/index' },
] as const

const open = (url: string) => uni.reLaunch({ url })
</script>

<template>
  <view class="tabbar">
    <view v-for="tab in tabs" :key="tab.key" class="tab" :class="{ active: current === tab.key }" @click="open(tab.url)">
      <view class="icon-wrap">
        <text class="icon">{{ tab.icon }}</text>
        <text v-if="tab.key === 'cart' && cart.count" class="badge">{{ cart.count }}</text>
      </view>
      <text>{{ tab.label }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.tabbar { position: fixed; z-index: 30; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 750rpx; height: 112rpx; display: flex; justify-content: space-around; padding: 12rpx 12rpx 18rpx; background: rgba(255,255,255,.96); border-top: 1rpx solid #f1e3d3; box-shadow: 0 -8rpx 28rpx rgba(105,66,23,.08); }
.tab { width: 20%; display: flex; flex-direction: column; align-items: center; gap: 4rpx; color: #776d66; font-size: 21rpx; }
.icon-wrap { position: relative; }
.icon { font-size: 35rpx; line-height: 42rpx; }
.active { color: #ff5a00; font-weight: 700; }
.badge { position: absolute; top: -4rpx; right: -15rpx; min-width: 28rpx; height: 28rpx; padding: 0 6rpx; border-radius: 14rpx; color: #fff; background: #ff5a00; font-size: 18rpx; line-height: 28rpx; text-align: center; }
</style>
