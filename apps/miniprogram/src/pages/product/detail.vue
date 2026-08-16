<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppHeader from '@/components/AppHeader.vue'
import PetArtwork from '@/components/PetArtwork.vue'
import { getProduct } from '@/api/product'
import { useCartStore } from '@/stores/cart'
import { money } from '@/utils/format'
import type { Product } from '@/models'

const product = ref<Product | null>(null)
const loading = ref(true)
const error = ref('')
const favorite = ref(false)
const cart = useCartStore()

onLoad(async (options) => {
  try { product.value = await getProduct(Number(options?.id || 1)) }
  catch (err) { error.value = err instanceof Error ? err.message : '商品加载失败' }
  finally { loading.value = false }
})

const addCart = () => { if (product.value) { cart.add(product.value); uni.showToast({ title: '已加入购物车', icon: 'success' }) } }
const buyNow = () => { if (product.value) uni.navigateTo({ url: `/pages/checkout/index?productId=${product.value.id}` }) }
</script>

<template>
  <view class="app-shell detail-page">
    <AppHeader title="萌宠详情" back />
    <view v-if="loading" class="loading-block">正在加载萌宠档案...</view>
    <view v-else-if="error || !product" class="error-block">{{ error || '商品不存在' }}</view>
    <template v-else>
      <view class="media"><PetArtwork :type="product.image_key" size="lg" /><text class="counter">1/5</text><view class="health">🛡️ 健康保证<small>专业检测 放心选购</small></view><view class="video">▣ 视频</view></view>
      <view class="info-panel">
        <view class="title-row"><text class="name">{{ product.name }}</text><text class="favorite" :class="{ on: favorite }" @click="favorite = !favorite">☆ {{ favorite ? '已收藏' : '收藏' }}</text></view>
        <view class="tags"><text v-for="tag in product.tags" :key="tag">{{ tag }}</text></view>
        <view class="price-row"><text class="price">¥{{ money(product.price) }} <small>起</small></text><text>已售 {{ product.sales }}</text></view>
        <view class="guarantees"><view>🛡️<b>健康保证</b><small>专属检测</small></view><view>🚚<b>安全运输</b><small>活体包装</small></view><view>🌱<b>7天保障</b><small>规则内售后</small></view></view>
        <view class="coupon app-card"><text class="coupon-icon">券</text><view><b>领券下单更优惠</b><small>新人专享券，满99减10</small></view><button>立即领取 ›</button></view>
        <view class="profile-card app-card">
          <text class="card-title">萌宠档案</text>
          <view class="profile-grid"><b>品种</b><text>{{ product.species || '商品用品' }}</text><b>年龄</b><text>{{ product.age || '—' }}</text><b>健康状态</b><text class="green">{{ product.health || '品质检查通过' }}</text><b>体长 / 规格</b><text>{{ product.size || '—' }}</text><b>性别</b><text>{{ product.gender || '—' }}</text><b>饲养建议</b><text>{{ product.care_advice || '请按照包装说明使用' }}</text></view>
          <view class="farm">🛡 专业养殖基地直发 · 检疫合格 · 品质保证</view>
        </view>
      </view>
      <view class="action-bar">
        <view class="small-action">🎧<text>客服</text></view><view class="small-action" @click="favorite = !favorite">☆<text>收藏</text></view><view class="small-action">💬<text>咨询</text></view>
        <button class="add" @click="addCart">加入购物车</button><button class="buy" @click="buyNow">立即购买</button>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.detail-page { padding-bottom: 130rpx; }.media { position: relative; }.counter { position: absolute; right: 24rpx; top: 20rpx; padding: 7rpx 15rpx; border-radius: 22rpx; color: #fff; background: rgba(0,0,0,.55); font-size: 22rpx; }.health,.video { position: absolute; bottom: 24rpx; padding: 13rpx 21rpx; border-radius: 24rpx; color:#e95b00;background:rgba(255,249,226,.93);font-size:22rpx;font-weight:700;}.health{left:24rpx;display:flex;flex-direction:column;}.health small{color:#7c6856;font-size:16rpx;font-weight:400;}.video{right:24rpx;border:1rpx solid #ff7d27;}
.info-panel { margin-top: -18rpx; position: relative; z-index: 2; padding: 28rpx 24rpx 110rpx; border-radius: 34rpx 34rpx 0 0; background: #fffaf3; }.title-row,.price-row { display:flex;align-items:center;justify-content:space-between;}.name{font-size:37rpx;font-weight:900;}.favorite{color:#9b8d81;font-size:23rpx}.favorite.on{color:#ff6500}.tags{display:flex;gap:10rpx;margin-top:15rpx}.tags text{padding:5rpx 13rpx;color:#598131;border:1rpx solid #acc987;border-radius:13rpx;font-size:20rpx}.price-row{margin-top:18rpx;color:#8b8078;font-size:22rpx}.price{font-size:40rpx}.price small{font-size:20rpx;color:#7f756e}.guarantees{display:grid;grid-template-columns:repeat(3,1fr);margin-top:20rpx;padding:20rpx 10rpx;border-radius:20rpx;background:#fff4df}.guarantees view{display:grid;grid-template-columns:auto 1fr;column-gap:6rpx;border-right:1rpx solid #efd8bb}.guarantees view:last-child{border:0}.guarantees b{font-size:20rpx}.guarantees small{grid-column:2;color:#8b8078;font-size:16rpx}.coupon{margin-top:20rpx;padding:18rpx;display:grid;grid-template-columns:55rpx 1fr auto;gap:14rpx;align-items:center;background:#fff1d3}.coupon-icon{width:50rpx;height:50rpx;border-radius:12rpx;color:#fff;background:#ff7b1a;text-align:center;line-height:50rpx;font-weight:800}.coupon view{display:flex;flex-direction:column}.coupon b{font-size:22rpx}.coupon small{color:#9a6f4c;font-size:17rpx}.coupon button{padding:0 18rpx;height:48rpx;border-radius:25rpx;color:#ec5b00;background:#ffd992;font-size:18rpx;line-height:48rpx}.profile-card{margin-top:22rpx;padding:26rpx;background:linear-gradient(140deg,#fffef9,#fff4dd)}.card-title{display:block;margin-bottom:20rpx;font-size:28rpx;font-weight:800}.profile-grid{display:grid;grid-template-columns:150rpx 1fr;gap:16rpx 12rpx;font-size:22rpx}.profile-grid b{font-weight:700}.green{color:#5f953f}.farm{margin-top:23rpx;padding:15rpx;border-radius:18rpx;color:#a16431;background:rgba(255,255,255,.75);font-size:18rpx}
.action-bar{position:fixed;z-index:30;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:750rpx;height:115rpx;padding:10rpx 15rpx 18rpx;display:grid;grid-template-columns:55rpx 55rpx 55rpx 1fr 1fr;gap:8rpx;align-items:center;background:#fff;border-top:1rpx solid #f0e1ce}.small-action{display:flex;flex-direction:column;align-items:center;font-size:28rpx}.small-action text{font-size:18rpx}.action-bar button{height:76rpx;padding:0;border-radius:0;font-size:24rpx;font-weight:700;line-height:76rpx}.add{color:#f15b00;background:#fff0d0;border-radius:35rpx 0 0 35rpx!important}.buy{color:#fff;background:linear-gradient(135deg,#ff8d24,#ee4b00);border-radius:0 35rpx 35rpx 0!important}
</style>
