<template>
  <view class="product-card" @click="$emit('select', item)">
    <view class="cover-wrap">
      <image class="product-image" :src="cover" mode="aspectFill" @error="onImageError" />
      <text v-if="item.tierName" class="tier-badge">{{ item.tierName }}</text>
    </view>
    <view class="product-info">
      <text class="product-title">{{ item.title || '品质服务' }}</text>
      <view class="labels">
        <text>{{ gameText(item.game) }}</text>
        <text>{{ serviceTypeText(item.serviceType) }}</text>
      </view>
      <view class="product-meta">
        <text class="price"><text class="currency">¥</text>{{ fenToYuan(item.priceFen) }}</text>
        <text class="more">去看看 ›</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue';
import { fenToYuan, gameText, serviceTypeText } from '../client-utils.js';
import { productCover } from '../brand-assets.js';
const props = defineProps({ item: { type: Object, required: true } });
defineEmits(['select']);
const cover = ref(productCover(props.item));
watch(() => props.item, (value) => { cover.value = productCover(value); });
function onImageError() { cover.value = '/static/default-product.svg'; }
</script>

<style lang="scss" scoped>
.product-card { min-width: 0; overflow: hidden; background: var(--color-surface); border: 1rpx solid rgba(16,24,40,.04); border-radius: var(--brand-radius); box-shadow: var(--shadow-card); }
.cover-wrap { position: relative; overflow: hidden; aspect-ratio: 4 / 3; background: #eef0ff; }
.product-image { display: block; width: 100%; height: 100%; }
.tier-badge { position: absolute; top: 14rpx; left: 14rpx; padding: 6rpx 14rpx; color: #fff; font-size: 21rpx; font-weight: 600; background: rgba(16,24,40,.68); border-radius: 999rpx; }
.product-info { padding: 20rpx; }
.product-title { display: -webkit-box; min-height: 76rpx; overflow: hidden; color: var(--color-text); font-size: 29rpx; font-weight: 700; line-height: 1.35; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.labels { height: 34rpx; margin-top: 8rpx; display: flex; gap: 8rpx; overflow: hidden; }
.labels text { flex: none; padding: 3rpx 9rpx; color: var(--color-text-secondary); font-size: 20rpx; line-height: 28rpx; background: #f2f4f7; border-radius: 7rpx; }
.product-meta { margin-top: 16rpx; display: flex; align-items: baseline; justify-content: space-between; gap: 8rpx; }
.price { color: var(--brand-primary); font-size: 31rpx; font-weight: 800; white-space: nowrap; }
.currency { margin-right: 2rpx; font-size: 21rpx; }
.more { color: var(--color-text-tertiary); font-size: 21rpx; white-space: nowrap; }
</style>
