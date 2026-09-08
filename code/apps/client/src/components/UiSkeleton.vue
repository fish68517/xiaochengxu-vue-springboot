<template>
  <view class="skeleton-grid">
    <view v-for="index in count" :key="index" class="skeleton-card">
      <view class="skeleton-cover pulse" />
      <view class="skeleton-line wide pulse" />
      <view class="skeleton-line pulse" />
    </view>
  </view>
</template>
<script setup>defineProps({ count: { type: Number, default: 4 } });</script>
<style lang="scss" scoped>
.skeleton-grid { padding: 12rpx 28rpx 28rpx; display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 20rpx; }
.skeleton-card { overflow: hidden; padding-bottom: 24rpx; background: #fff; border-radius: var(--brand-radius); }
.skeleton-cover { width: 100%; aspect-ratio: 4/3; }
.skeleton-line { width: 55%; height: 22rpx; margin: 18rpx 20rpx 0; border-radius: 11rpx; }
.skeleton-line.wide { width: calc(100% - 40rpx); height: 28rpx; }
.pulse { background: linear-gradient(90deg,#eef0f4 25%,#f8f9fb 38%,#eef0f4 63%); background-size: 400% 100%; animation: pulse 1.4s ease infinite; }
@keyframes pulse { from { background-position: 100% 0; } to { background-position: 0 0; } }
@media (prefers-reduced-motion: reduce) { .pulse { animation: none; } }
</style>
