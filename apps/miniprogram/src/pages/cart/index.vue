<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
import AppTabBar from '@/components/AppTabBar.vue'
import PetArtwork from '@/components/PetArtwork.vue'
import { useCartStore } from '@/stores/cart'
import { money } from '@/utils/format'

const cart = useCartStore()
const checkout = () => {
  if (!cart.items.length) return uni.showToast({ title: '购物车还是空的', icon: 'none' })
  uni.navigateTo({ url: `/pages/checkout/index?productId=${cart.items[0].product.id}` })
}
const openMall = () => uni.reLaunch({ url: '/pages/mall/index' })
</script>

<template>
  <view class="app-shell cart-page">
    <AppHeader title="购物车" />
    <view v-if="!cart.items.length" class="empty-cart"><text>🛒</text><b>购物车还是空的</b><small>去商城挑选喜欢的萌宠好物吧</small><button class="primary-button" @click="openMall">去逛逛</button></view>
    <view v-else class="page-body"><view v-for="item in cart.items" :key="item.product.id" class="cart-item app-card"><PetArtwork :type="item.product.image_key" size="sm" /><view><b>{{ item.product.name }}</b><text>{{ item.product.subtitle }}</text><text class="price">¥{{ money(item.product.price) }}</text></view><view class="quantity">x{{ item.quantity }}<button @click="cart.remove(item.product.id)">删除</button></view></view><view class="cart-summary app-card"><text>共 {{ cart.count }} 件</text><text>合计：<b class="price">¥{{ money(cart.total) }}</b></text><button class="primary-button" @click="checkout">去结算</button></view></view>
    <AppTabBar current="cart" />
  </view>
</template>

<style scoped lang="scss">
.empty-cart{min-height:700rpx;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18rpx;color:#8b8078}.empty-cart>text{font-size:120rpx}.empty-cart b{color:#2b211b;font-size:29rpx}.empty-cart small{font-size:20rpx}.empty-cart button{width:260rpx;margin-top:12rpx}.cart-item{display:grid;grid-template-columns:130rpx 1fr auto;gap:16rpx;align-items:center;padding:16rpx;margin-bottom:16rpx}.cart-item>view:nth-child(2){display:flex;flex-direction:column;gap:9rpx}.cart-item b{font-size:23rpx}.cart-item text{color:#8b8078;font-size:18rpx}.cart-item .price{color:#ef5a11;font-size:26rpx}.quantity{display:flex;flex-direction:column;align-items:flex-end;gap:20rpx}.quantity button{height:42rpx;padding:0 15rpx;border-radius:21rpx;color:#8b8078;background:#f6f0e8;font-size:16rpx;line-height:42rpx}.cart-summary{padding:22rpx;display:flex;align-items:center;justify-content:space-between}.cart-summary>text{font-size:21rpx}.cart-summary .primary-button{width:190rpx;height:66rpx;font-size:22rpx}
</style>
