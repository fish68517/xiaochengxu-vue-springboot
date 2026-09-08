<template>
  <view class="page-shell" :style="brandState.vars">
    <view class="mobile-canvas">
      <ClientHeader :title="brandName" subtitle="全部服务" :logo="logo" source="category"/>
      <view class="search-wrap"><view class="search-box"><view class="search-icon"/><input v-model="keyword" placeholder="搜索服务名称" confirm-type="search"/><text v-if="keyword" @click="keyword=''">清除</text></view></view>
      <scroll-view scroll-x class="game-strip" :show-scrollbar="false"><view class="chip-row">
        <view class="game-chip" :class="{active:selectedGame===''}" @click="selectedGame=''">全部</view>
        <view v-for="game in games" :key="game" class="game-chip" :class="{active:selectedGame===game}" @click="selectedGame=game">{{ gameText(game) }}</view>
      </view></scroll-view>
      <view class="sort-bar">
        <view class="sort-tabs"><text v-for="option in sortOptions" :key="option.key" :class="{active:sortKey===option.key}" @click="sortKey=option.key">{{ option.label }}</text></view>
        <text class="count">共 {{ shownProducts.length }} 项</text>
      </view>
      <UiSkeleton v-if="loading" :count="6"/>
      <UiState v-else-if="errorMsg" title="服务加载失败" :description="errorMsg" action-text="重新加载" @action="loadProducts"/>
      <UiState v-else-if="shownProducts.length===0" title="暂无匹配服务" description="可以清除关键词和分类后重新查看" action-text="清除筛选" @action="clearFilter"/>
      <view v-else class="product-grid"><ProductCard v-for="item in shownProducts" :key="item.id||item._id" :item="item" @select="goProduct"/></view>
      <ClientTabbar active=""/>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '../../api.js';
import { brandState } from '../../brand.js';
import { brandLogo } from '../../brand-assets.js';
import { gameText } from '../../client-utils.js';
import ClientHeader from '../../components/ClientHeader.vue';
import ClientTabbar from '../../components/client-tabbar.vue';
import ProductCard from '../../components/ProductCard.vue';
import UiSkeleton from '../../components/UiSkeleton.vue';
import UiState from '../../components/UiState.vue';
const brandName=computed(()=>(brandState.brand&&brandState.brand.name)||'星河服务'); const logo=computed(brandLogo);
const selectedGame=ref(''); const keyword=ref(''); const sortKey=ref('default'); const games=ref([]); const products=ref([]); const loading=ref(true); const errorMsg=ref('');
const sortOptions=[{key:'default',label:'综合'},{key:'priceAsc',label:'价格升序'},{key:'priceDesc',label:'价格降序'}];
const shownProducts=computed(()=>{ const rows=products.value.filter((item)=>(!selectedGame.value||item.game===selectedGame.value)&&(!keyword.value||(item.title||'').toLowerCase().includes(keyword.value.trim().toLowerCase()))); if(sortKey.value==='priceAsc') return [...rows].sort((a,b)=>(a.priceFen||0)-(b.priceFen||0)); if(sortKey.value==='priceDesc') return [...rows].sort((a,b)=>(b.priceFen||0)-(a.priceFen||0)); return rows; });
onLoad(loadProducts);
async function loadProducts(){loading.value=true;errorMsg.value='';try{const list=await api.listProducts();const rows=(Array.isArray(list)?list:[]).filter((item)=>item&&item.status==='ON');products.value=rows;games.value=[...new Set(rows.map((item)=>item.game).filter(Boolean))];}catch(error){products.value=[];errorMsg.value=(error&&error.message)||'暂时无法获取服务';}finally{loading.value=false;}}
function clearFilter(){selectedGame.value='';keyword.value='';sortKey.value='default';}
function goProduct(item){const id=item&&(item.id||item._id);if(id)uni.navigateTo({url:`/pages/product/detail?id=${encodeURIComponent(id)}`});}
</script>

<style lang="scss" scoped>
.page-shell{min-height:100vh;min-height:100dvh;background:#e9edf5}.mobile-canvas{min-height:100vh;min-height:100dvh;padding-bottom:calc(136rpx + env(safe-area-inset-bottom));background:var(--brand-bg)}
.search-wrap{padding:24rpx 28rpx 12rpx}.search-box{height:88rpx;padding:0 26rpx;display:flex;align-items:center;gap:18rpx;background:#fff;border:1rpx solid var(--color-border);border-radius:44rpx}.search-box input{flex:1;min-width:0;height:80rpx;font-size:27rpx}.search-box>text{color:var(--brand-primary);font-size:23rpx}.search-icon{width:28rpx;height:28rpx;position:relative;flex:none;border:3rpx solid var(--color-text-tertiary);border-radius:50%}.search-icon::after{content:'';position:absolute;right:-10rpx;bottom:-7rpx;width:12rpx;height:3rpx;background:var(--color-text-tertiary);transform:rotate(45deg)}
.game-strip{white-space:nowrap}.chip-row{padding:8rpx 28rpx 18rpx;display:inline-flex;gap:14rpx}.game-chip{padding:13rpx 26rpx;color:var(--color-text-secondary);font-size:24rpx;background:#fff;border:1rpx solid var(--color-border);border-radius:999rpx}.game-chip.active{color:#fff;font-weight:700;background:var(--brand-primary);border-color:var(--brand-primary)}
.sort-bar{margin:0 28rpx 22rpx;padding:18rpx 20rpx;display:flex;align-items:center;justify-content:space-between;background:#fff;border-radius:18rpx}.sort-tabs{display:flex;gap:26rpx}.sort-tabs text{color:var(--color-text-secondary);font-size:24rpx}.sort-tabs text.active{color:var(--brand-primary);font-weight:700}.count{color:var(--color-text-tertiary);font-size:22rpx}
.product-grid{padding:0 28rpx 30rpx;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20rpx}@media(min-width:480px){.mobile-canvas{width:480px;margin:0 auto;box-shadow:0 0 36px rgba(16,24,40,.08)}}
</style>
