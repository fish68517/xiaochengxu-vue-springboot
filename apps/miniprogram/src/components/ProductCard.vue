<script setup lang="ts">
import type { Product } from '@/models'
import { compactSales, money } from '@/utils/format'
import { useCartStore } from '@/stores/cart'
import PetArtwork from './PetArtwork.vue'

const props = defineProps<{ product: Product }>()
const cart = useCartStore()
const open = () => uni.navigateTo({ url: `/pages/product/detail?id=${props.product.id}` })
const add = async () => {
  try { await cart.add(props.product.id); uni.showToast({ title: '已加入购物车', icon: 'success' }) }
  catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '加入失败', icon: 'none' }) }
}
</script>

<template>
  <view class="product-card app-card" @click="open">
    <view class="visual">
      <PetArtwork :type="product.image_key" size="md" />
      <text v-if="product.badge" class="badge">{{ product.badge }}</text>
    </view>
    <view class="info">
      <text class="name">{{ product.name }}</text>
      <view class="tags"><text v-for="tag in product.tags.slice(0, 2)" :key="tag">{{ tag }}</text></view>
      <view class="meta">
        <text class="price">¥{{ money(product.price) }}<small> 起</small></text>
        <text class="sales">已售 {{ compactSales(product.sales) }}</text>
        <button class="cart" @click.stop="add">＋</button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.product-card { overflow: hidden; min-width: 0; }
.visual { position: relative; }.badge { position: absolute; left: 12rpx; top: 12rpx; padding: 5rpx 12rpx; border-radius: 16rpx; color: #fff; background: linear-gradient(135deg,#67b34d,#4f9e38); font-size: 20rpx; }
.info { padding: 16rpx; }.name { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 27rpx; font-weight: 700; }
.tags { display: flex; gap: 7rpx; min-height: 39rpx; margin-top: 9rpx; }.tags text { padding: 3rpx 8rpx; color: #65833a; border: 1rpx solid #b7cf91; border-radius: 10rpx; font-size: 18rpx; }
.meta { display: grid; grid-template-columns: auto 1fr 48rpx; align-items: end; gap: 6rpx; margin-top: 10rpx; }.price { font-size: 30rpx; }.price small { font-size: 17rpx; }.sales { color: #958b83; font-size: 18rpx; text-align: right; }.cart { width: 48rpx; height: 48rpx; padding: 0; border-radius: 15rpx; color: #fff; background: #ff6a00; font-size: 30rpx; line-height: 45rpx; }
</style>
