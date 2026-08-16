<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppHeader from '@/components/AppHeader.vue'
import AppTabBar from '@/components/AppTabBar.vue'
import ProductCard from '@/components/ProductCard.vue'
import { getProducts } from '@/api/product'
import type { Product } from '@/models'

const categories = ['爬宠', '用品', '套餐']
const filters = ['综合', '销量', '价格', '新品']
const activeCategory = ref('爬宠')
const activeFilter = ref('综合')
const keyword = ref('')
const products = ref<Product[]>([])
const loading = ref(true)
const error = ref('')

onLoad((options) => { if (options?.category && categories.includes(options.category)) activeCategory.value = options.category })

async function load() {
  loading.value = true; error.value = ''
  try {
    let data = await getProducts(activeCategory.value, keyword.value)
    if (activeFilter.value === '销量') data = [...data].sort((a, b) => b.sales - a.sales)
    if (activeFilter.value === '价格') data = [...data].sort((a, b) => Number(a.price) - Number(b.price))
    if (activeFilter.value === '新品') data = data.filter((item) => item.badge === '新品')
    products.value = data
  } catch (err) { error.value = err instanceof Error ? err.message : '加载失败' }
  finally { loading.value = false }
}

onMounted(load)
const setCategory = (value: string) => { activeCategory.value = value; load() }
const setFilter = (value: string) => { activeFilter.value = value; load() }
</script>

<template>
  <view class="app-shell mall-page">
    <AppHeader title="萌宠生活商城" />
    <view class="page-body controls">
      <view class="search"><text>⌕</text><input v-model="keyword" placeholder="搜索商品，如“巴西龟”" confirm-type="search" @confirm="load" /><button @click="load">搜索</button></view>
      <view class="categories"><button v-for="item in categories" :key="item" :class="{ active: activeCategory === item }" @click="setCategory(item)">{{ item }}</button></view>
      <view class="filters"><button v-for="item in filters" :key="item" :class="{ active: activeFilter === item }" @click="setFilter(item)">{{ item }}</button></view>
    </view>
    <view v-if="loading" class="loading-block">正在加载商品...</view>
    <view v-else-if="error" class="error-block">{{ error }}<button @click="load">重新加载</button></view>
    <view v-else-if="!products.length" class="empty-block">暂时没有符合条件的商品</view>
    <view v-else class="page-body product-grid"><ProductCard v-for="product in products" :key="product.id" :product="product" /></view>
    <view class="service app-card"><view>🛡️<b>正品保障</b><small>品质自检</small></view><view>💚<b>安心售后</b><small>7天无理由</small></view><view>🚚<b>快速发货</b><small>48小时内</small></view></view>
    <AppTabBar current="mall" />
  </view>
</template>

<style scoped lang="scss">
.controls { padding-bottom: 6rpx; }.search { height: 72rpx; display: grid; grid-template-columns: 40rpx 1fr 105rpx; align-items: center; padding-left: 18rpx; border: 2rpx solid #ff8a35; border-radius: 38rpx; background: #fff; color: #8b8078; }.search input { font-size: 23rpx; }.search button { height: 58rpx; margin-right: 6rpx; border-radius: 29rpx; color: #fff; background: linear-gradient(135deg,#ff9a3c,#ff6200); font-size: 22rpx; line-height: 58rpx; }
.categories,.filters { display: grid; gap: 18rpx; margin-top: 20rpx; }.categories { grid-template-columns: repeat(3,1fr); }.filters { grid-template-columns: repeat(4,1fr); }.categories button,.filters button { height: 64rpx; border-radius: 33rpx; background: #fff; color: #746a63; font-size: 23rpx; line-height: 64rpx; box-shadow: 0 6rpx 22rpx rgba(80,50,20,.05); }.categories button.active { color: #fff; background: linear-gradient(135deg,#ff9c3a,#ff5e00); font-weight: 700; }.filters button { height: 54rpx; line-height: 54rpx; font-size: 21rpx; }.filters button.active { color: #ff5d00; border: 1rpx solid #ff8c3d; }
.product-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; padding-top: 12rpx; }.service { display: grid; grid-template-columns: repeat(3,1fr); margin: 0 24rpx 24rpx; padding: 20rpx 10rpx; }.service view { display: flex; flex-direction: column; align-items: center; gap: 4rpx; border-right: 1rpx solid #efdcc5; }.service view:last-child { border:0; }.service b { color:#83441f;font-size:20rpx;}.service small{color:#8b8078;font-size:17rpx;}
</style>
