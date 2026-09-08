<template>
  <view class="tabbar-safe">
    <view class="client-tabbar">
      <view v-for="tab in tabs" :key="tab.key" class="tab-item" :class="{ active: active === tab.key }" @click="open(tab)">
        <image class="tab-icon" :src="active === tab.key ? tab.activeIcon : tab.icon" mode="aspectFit" />
        <text class="tab-label">{{ tab.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
const props = defineProps({ active: { type: String, required: true } });
const tabs = [
  { key: 'home', label: '首页', url: '/pages/index/index', icon: '/static/icons/home.svg', activeIcon: '/static/icons/home-active.svg' },
  { key: 'orders', label: '订单', url: '/pages/order/list', icon: '/static/icons/order.svg', activeIcon: '/static/icons/order-active.svg' },
  { key: 'mine', label: '我的', url: '/pages/mine/index', icon: '/static/icons/mine.svg', activeIcon: '/static/icons/mine-active.svg' },
];

function open(tab) {
  if (tab.key === props.active) return;
  uni.reLaunch({ url: tab.url });
}
</script>

<style lang="scss" scoped>
.tabbar-safe { position: fixed; z-index: 50; right: 0; bottom: 0; left: 0; padding-bottom: max(0px, env(safe-area-inset-bottom)); background: rgba(255,255,255,.98); box-shadow: 0 -8rpx 30rpx rgba(16,24,40,.08); }
.client-tabbar { height: 112rpx; display: flex; border-top: 1rpx solid var(--color-border); }
.tab-item { flex: 1; min-width: 88rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7rpx; color: var(--color-text-tertiary); line-height: 1; }
.tab-item.active { color: var(--brand-primary); }
.tab-icon { width: 44rpx; height: 44rpx; }
.tab-label { font-size: 23rpx; font-weight: 500; }
.tab-item.active .tab-label { font-weight: 700; }
@media (min-width: 480px) { .tabbar-safe { left: 50%; width: 480px; transform: translateX(-50%); } }
</style>
