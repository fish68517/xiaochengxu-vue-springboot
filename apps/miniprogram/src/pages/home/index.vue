<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppTabBar from '@/components/AppTabBar.vue'
import PetArtwork from '@/components/PetArtwork.vue'
import ProductCard from '@/components/ProductCard.vue'
import { getProducts } from '@/api/product'
import { getCurrentActivity } from '@/api/lottery'
import { formatDate } from '@/utils/format'
import type { LotteryActivity, Product } from '@/models'

const products = ref<Product[]>([])
const activity = ref<LotteryActivity | null>(null)
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const [productData, activityData] = await Promise.all([getProducts(), getCurrentActivity()])
    products.value = productData.slice(0, 4)
    activity.value = activityData
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
  }
})

const openMall = (category = '爬宠') => uni.navigateTo({ url: `/pages/mall/index?category=${encodeURIComponent(category)}` })
const openActivity = () => uni.navigateTo({ url: '/pages/lottery/detail?id=1' })
</script>

<template>
  <view class="app-shell home">
    <view class="topbar">
      <text class="brand">萌宠生活商城</text>
      <view class="search">⌕　搜索商品或品牌</view>
      <text class="message">💬<i></i></text>
    </view>

    <view class="hero">
      <view class="hero-pets"><text>🐢</text><text>🐰</text></view>
      <view class="hero-copy">
        <text class="hero-title">健康养宠 · 快乐陪伴</text>
        <text class="hero-subtitle">科学养宠 · 正品保障 · 安心购物</text>
      </view>
      <view class="meadow"></view>
    </view>

    <view v-if="loading" class="loading-block">正在加载本地数据...</view>
    <view v-else-if="error" class="error-block">{{ error }}<br />请确认 FastAPI 已在 8000 端口启动</view>
    <template v-else>
      <view v-if="activity" class="activity-card app-card" @click="openActivity">
        <view class="activity-art"><text>🎁</text><text class="pet-pair">🐢 🐰</text></view>
        <view class="activity-content">
          <text class="status">{{ activity.joined ? '已报名' : '报名中' }}</text>
          <text class="activity-title">限时抽奖活动已开启</text>
          <text class="activity-sub">{{ activity.title }} · 免费报名</text>
          <text class="activity-date">报名截止：{{ formatDate(activity.registration_end_at) }}</text>
          <button class="activity-button">{{ activity.joined ? '查看活动' : '立即报名参与' }}　›</button>
        </view>
      </view>

      <view class="notice" @click="openActivity"><text>📣　活动通知：</text><text>{{ activity?.title }}已开启，点击参与报名</text><text>›</text></view>

      <view class="quick-grid">
        <view class="quick" @click="openMall('爬宠')"><PetArtwork type="turtle" size="sm" /><text>爬宠</text><small>乌龟 · 小兔</small></view>
        <view class="quick" @click="openMall('用品')"><PetArtwork type="food" size="sm" /><text>萌宠用品</text><small>精选好物</small></view>
        <view class="quick" @click="openActivity"><PetArtwork type="gift" size="sm" /><text>抽奖活动</text><small>免费报名</small></view>
        <view class="quick"><PetArtwork type="rabbit" size="sm" /><text>新手指南</text><small>科学养宠</small></view>
      </view>

      <view class="page-body products-section">
        <view class="section-title"><text>✦ 精选推荐</text><text class="section-title__link" @click="openMall('全部')">更多好物 ›</text></view>
        <view class="product-grid"><ProductCard v-for="product in products" :key="product.id" :product="product" /></view>
      </view>

      <view class="trust-strip">
        <view><b>🛡️ 正品保障</b><small>品牌直供</small></view>
        <view><b>🤲 安心售后</b><small>7天无理由</small></view>
        <view><b>🚚 安全配送</b><small>快速发货</small></view>
      </view>
    </template>
    <AppTabBar current="home" />
  </view>
</template>

<style scoped lang="scss">
.topbar { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 15rpx; padding: 48rpx 28rpx 20rpx; background: #fffaf2; }.brand { color: #f45113; font-size: 34rpx; font-weight: 900; white-space: nowrap; }.search { overflow: hidden; padding: 18rpx 22rpx; color: #928982; border: 1rpx solid #eadfce; border-radius: 38rpx; background: #fff; font-size: 23rpx; white-space: nowrap; }.message { position: relative; font-size: 32rpx; }.message i { position: absolute; right: 0; top: 0; width: 12rpx; height: 12rpx; border-radius: 50%; background: #ff4d00; }
.hero { height: 285rpx; position: relative; overflow: hidden; background: radial-gradient(circle at 50% 10%,#fffdf4 0,#fff1cd 55%,#dce7bb 100%); }.hero-pets { position: absolute; z-index: 2; inset: 70rpx 15rpx auto; display: flex; justify-content: space-between; font-size: 160rpx; filter: drop-shadow(0 15rpx 12rpx rgba(65,78,20,.13)); }.hero-copy { position: relative; z-index: 3; display: flex; flex-direction: column; align-items: center; padding-top: 75rpx; }.hero-title { color: #883b08; font-size: 38rpx; font-weight: 900; }.hero-subtitle { margin-top: 16rpx; color: #713f24; font-size: 23rpx; }.meadow { position: absolute; bottom: -35rpx; left: -5%; width: 110%; height: 100rpx; border-radius: 50% 50% 0 0; background: #b8cc85; opacity: .5; }
.activity-card { display: grid; grid-template-columns: 42% 58%; margin: -16rpx 22rpx 0; overflow: hidden; border-color: #ffc17c; }.activity-art { position: relative; min-height: 290rpx; display: flex; align-items: center; justify-content: center; background: linear-gradient(140deg,#fff5d7,#ffdfaa); font-size: 104rpx; }.pet-pair { position: absolute; bottom: 22rpx; font-size: 68rpx; }.activity-content { padding: 22rpx 22rpx 20rpx; display: flex; flex-direction: column; align-items: flex-start; }.status { padding: 5rpx 19rpx; color: #fff; border-radius: 18rpx; background: #ff6a00; font-size: 22rpx; font-weight: 700; }.activity-title { margin-top: 16rpx; font-size: 30rpx; font-weight: 900; }.activity-sub,.activity-date { margin-top: 9rpx; color: #786d64; font-size: 21rpx; }.activity-button { width: 100%; height: 68rpx; margin-top: auto; border-radius: 35rpx; color: #fff; background: linear-gradient(135deg,#ff8b22,#f14c00); font-size: 24rpx; font-weight: 700; line-height: 68rpx; }
.notice { margin: 16rpx 22rpx; padding: 18rpx 22rpx; display: grid; grid-template-columns: auto 1fr auto; gap: 8rpx; align-items: center; border-radius: 22rpx; color: #6b4a31; background: #fff1d8; font-size: 21rpx; }.notice text:first-child { font-weight: 700; }
.quick-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 13rpx; padding: 0 22rpx; }.quick { padding: 14rpx 8rpx 16rpx; display: flex; flex-direction: column; gap: 5rpx; text-align: center; border-radius: 23rpx; background: #fff; }.quick > text { font-size: 23rpx; font-weight: 700; }.quick small { color: #8b8078; font-size: 18rpx; }
.products-section { padding-top: 0; }.product-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; }
.trust-strip { margin: 0 22rpx 24rpx; padding: 20rpx 10rpx; display: grid; grid-template-columns: repeat(3,1fr); border-radius: 23rpx; background: #fff5e5; }.trust-strip view { display: flex; flex-direction: column; align-items: center; border-right: 1rpx solid #f0d7b7; }.trust-strip view:last-child { border: 0; }.trust-strip b { color: #9d4b18; font-size: 20rpx; }.trust-strip small { margin-top: 6rpx; color: #8b8078; font-size: 17rpx; }
@media (max-width: 380px) { .brand { font-size: 29rpx; }.activity-title { font-size: 27rpx; } }
</style>
