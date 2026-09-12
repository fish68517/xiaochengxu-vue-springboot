<template>
  <view class="page-shell" :style="brandState.vars">
    <view v-if="brandState.status !== 'success'" class="brand-gate">
      <view class="gate-mark">{{ brandInitial }}</view>
      <text class="brand-gate-title">{{ brandGateTitle }}</text>
      <text class="brand-gate-desc">{{ brandState.errorMessage || '正在加载品牌配置…' }}</text>
      <button v-if="brandState.status !== 'loading'" class="primary-button compact" @click="retryBrand">重新加载</button>
    </view>
    <template v-else>
      <view class="mobile-canvas">
        <ClientHeader :title="brandName" subtitle="品质服务 · 全程跟进" :logo="logo" source="home" />
        <view class="hero-area">
          <swiper class="brand-banners" circular autoplay :indicator-dots="banners.length > 1" indicator-color="rgba(255,255,255,.45)" indicator-active-color="#fff">
            <swiper-item v-for="(banner, index) in banners" :key="`${banner}-${index}`">
              <image class="banner-image" :src="banner" mode="aspectFill" @error="useFallbackBanner(index)" />
            </swiper-item>
          </swiper>
        </view>
        <view class="search-area"><view class="search-box"><view class="search-icon"/><input v-model="keyword" :placeholder="copy.searchPlaceholder || '搜索服务'" confirm-type="search"/><text v-if="keyword" class="clear-search" @click="keyword = ''">清除</text></view></view>
        <view class="section category-section">
          <view class="section-head"><text class="section-title">服务分类</text><text class="section-link" @click="openCategory">全部分类 ›</text></view>
          <scroll-view scroll-x class="category-scroll" :show-scrollbar="false"><view class="category-row">
            <view class="category-item" :class="{ active: selectedGame === '' }" @click="selectedGame = ''"><view class="category-icon all"><view class="grid-symbol"><view/><view/><view/><view/></view></view><text>全部</text></view>
            <view v-for="(game, index) in games" :key="game" class="category-item" :class="{ active: selectedGame === game }" @click="selectedGame = game"><view class="category-icon" :class="`tone-${index % 4}`"><text>{{ gameText(game).slice(0, 1) }}</text></view><text>{{ gameText(game) }}</text></view>
          </view></scroll-view>
        </view>
        <view class="trust-strip">
          <view><image src="/static/icons/shield.svg" mode="aspectFit"/><text>明码标价</text></view>
          <view><image src="/static/icons/headset.svg" mode="aspectFit"/><text>专人跟进</text></view>
          <view><view class="progress-icon"><view class="progress-check"/></view><text>进度可查</text></view>
        </view>
        <view class="section products-section">
          <view class="section-head"><view><text class="section-title">推荐服务</text><text class="section-subtitle">严选服务，安心下单</text></view><text class="result-count">{{ shownProducts.length }} 项</text></view>
          <UiSkeleton v-if="loading" :count="4"/>
          <UiState v-else-if="errorMsg" title="服务加载失败" :description="errorMsg" action-text="重新加载" @action="loadProducts"/>
          <UiState v-else-if="shownProducts.length === 0" title="没有找到相关服务" description="换个关键词或分类试试" action-text="清除筛选" @action="clearFilter"/>
          <view v-else class="product-grid"><ProductCard v-for="item in shownProducts" :key="item.id || item._id" :item="item" @select="goProduct"/></view>
        </view>
        <ClientTabbar active="home"/>
      </view>
    </template>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '../../api.js';
import ClientHeader from '../../components/ClientHeader.vue';
import ClientTabbar from '../../components/client-tabbar.vue';
import ProductCard from '../../components/ProductCard.vue';
import UiSkeleton from '../../components/UiSkeleton.vue';
import UiState from '../../components/UiState.vue';
import { brandState, retryBrandConfig } from '../../brand.js';
import { brandLogo, heroBanners } from '../../brand-assets.js';
import { gameText } from '../../client-utils.js';
const copy = brandState.copy;
const brandName = computed(() => (brandState.brand && brandState.brand.name) || '星河服务');
const brandInitial = computed(() => brandName.value.slice(0, 1));
const logo = computed(brandLogo);
const banners = ref(['/static/default-banner.svg']);
const brandGateTitle = computed(() => ({ loading: '正在加载', unknown: '品牌不存在', disabled: '品牌已停用', 'network-error': '网络连接失败' }[brandState.status] || '暂时无法进入'));
const keyword = ref(''); const selectedGame = ref(''); const games = ref([]); const products = ref([]); const loading = ref(true); const errorMsg = ref('');
const shownProducts = computed(() => products.value.filter((item) => (!selectedGame.value || item.game === selectedGame.value) && (!keyword.value || (item.title || '').toLowerCase().includes(keyword.value.trim().toLowerCase()))));
onLoad(() => loadProducts());
async function retryBrand() { try { await retryBrandConfig(); banners.value = heroBanners(); await loadProducts(); } catch (e) { /* 品牌门禁展示错误 */ } }
async function loadProducts() { loading.value = true; errorMsg.value = ''; try { banners.value = heroBanners(); const list = await api.listProducts(); const onList = (Array.isArray(list) ? list : []).filter((item) => item && item.status === 'ON'); products.value = onList; games.value = [...new Set(onList.map((item) => item.game).filter(Boolean))]; } catch (error) { products.value = []; errorMsg.value = (error && error.message) || '暂时无法获取服务，请稍后重试'; } finally { loading.value = false; } }
function useFallbackBanner(index) { banners.value[index] = '/static/default-banner.svg'; }
function clearFilter() { keyword.value = ''; selectedGame.value = ''; }
function openCategory() { navigate('/pages/category/index'); }
function goProduct(item) {
  const id = item && (item.id || item._id);
  if (!id) { uni.showToast({ title: '商品信息不完整，请刷新后重试', icon: 'none' }); return; }
  navigate(`/pages/product/detail?id=${encodeURIComponent(id)}`);
}
function navigate(url) {
  console.info('[ClientUI] navigate:start', url.split('?')[0]);
  uni.navigateTo({ url,
    success: () => console.info('[ClientUI] navigate:success'),
    fail: (error) => {
      console.error('[ClientUI] navigate:fail', error && error.errMsg);
      uni.showToast({ title: '页面打开失败，请返回首页重试', icon: 'none' });
    },
  });
}
</script>

<style lang="scss" scoped>
.page-shell{min-height:100vh;min-height:100dvh;background:#e9edf5;color:var(--color-text)}.mobile-canvas{min-height:100vh;min-height:100dvh;padding-bottom:calc(136rpx + env(safe-area-inset-bottom));background:var(--brand-bg)}
.hero-area{padding:24rpx 28rpx 0}.brand-banners{height:294rpx;overflow:hidden;border-radius:28rpx;box-shadow:0 12rpx 34rpx rgba(31,38,91,.18)}.banner-image{width:100%;height:100%}
.search-area{padding:24rpx 28rpx 8rpx}.search-box{height:88rpx;padding:0 26rpx;display:flex;align-items:center;gap:18rpx;background:#fff;border:1rpx solid var(--color-border);border-radius:44rpx;box-shadow:var(--shadow-card)}.search-icon{width:28rpx;height:28rpx;position:relative;flex:none;border:3rpx solid var(--color-text-tertiary);border-radius:50%}.search-icon::after{content:'';position:absolute;right:-10rpx;bottom:-7rpx;width:12rpx;height:3rpx;background:var(--color-text-tertiary);transform:rotate(45deg);border-radius:3rpx}.search-box input{flex:1;min-width:0;height:80rpx;color:var(--color-text);font-size:27rpx}.clear-search{color:var(--brand-primary);font-size:23rpx}
.section{margin-top:20rpx}.section-head{padding:0 28rpx 20rpx;display:flex;align-items:flex-end;justify-content:space-between}.section-title{color:var(--color-text);font-size:34rpx;font-weight:800}.section-subtitle{display:block;margin-top:5rpx;color:var(--color-text-tertiary);font-size:22rpx}.section-link,.result-count{color:var(--brand-primary);font-size:24rpx}
.category-scroll{width:100%;white-space:nowrap}.category-row{padding:0 28rpx 8rpx;display:inline-flex;gap:28rpx}.category-item{width:106rpx;display:flex;flex-direction:column;align-items:center;gap:12rpx;color:var(--color-text-secondary);font-size:23rpx}.category-item>text{width:130rpx;overflow:hidden;text-align:center;text-overflow:ellipsis;white-space:nowrap}.category-icon{width:92rpx;height:92rpx;display:flex;align-items:center;justify-content:center;color:#5b63f6;font-size:30rpx;font-weight:800;background:#eef0ff;border:2rpx solid transparent;border-radius:28rpx;transition:transform .18s ease}.category-item.active .category-icon{border-color:var(--brand-primary);transform:translateY(-3rpx);box-shadow:0 8rpx 20rpx rgba(91,99,246,.15)}.tone-1{color:#0e9384;background:#e8f8f5}.tone-2{color:#dc6803;background:#fff4e6}.tone-3{color:#7a5af8;background:#f2edff}.grid-symbol{width:42rpx;height:42rpx;display:grid;grid-template-columns:1fr 1fr;gap:6rpx}.grid-symbol i{display:block;background:var(--brand-primary);border-radius:5rpx}
.trust-strip{margin:26rpx 28rpx 0;padding:22rpx 16rpx;display:grid;grid-template-columns:repeat(3,1fr);background:#fff;border-radius:22rpx;box-shadow:var(--shadow-card)}.trust-strip>view{display:flex;align-items:center;justify-content:center;gap:8rpx;color:var(--color-text-secondary);font-size:22rpx;border-right:1rpx solid var(--color-border)}.trust-strip>view:last-child{border-right:0}.trust-strip image,.progress-icon{width:32rpx;height:32rpx}.progress-icon{position:relative;border:3rpx solid var(--brand-primary);border-radius:50%}.progress-icon i{position:absolute;left:7rpx;top:13rpx;width:9rpx;height:3rpx;background:var(--brand-primary);transform:rotate(38deg)}.progress-icon i::after{content:'';position:absolute;left:7rpx;bottom:0;width:12rpx;height:3rpx;background:var(--brand-primary);transform:rotate(-78deg);transform-origin:left}
.products-section{padding-top:6rpx}.product-grid{padding:0 28rpx 28rpx;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20rpx}
.brand-gate{min-height:100vh;padding:200rpx 60rpx 80rpx;display:flex;flex-direction:column;align-items:center;text-align:center;background:var(--brand-bg)}.gate-mark{width:120rpx;height:120rpx;display:flex;align-items:center;justify-content:center;color:#fff;font-size:50rpx;font-weight:800;background:linear-gradient(135deg,var(--brand-primary),var(--brand-secondary));border-radius:36rpx}.brand-gate-title{margin-top:30rpx;font-size:36rpx;font-weight:800}.brand-gate-desc{margin-top:14rpx;color:var(--color-text-secondary);font-size:26rpx;line-height:1.5}.primary-button{height:88rpx;color:#fff;font-size:28rpx;line-height:88rpx;background:var(--brand-primary);border-radius:44rpx}.primary-button.compact{width:260rpx;margin-top:30rpx}
@media (min-width:480px){.mobile-canvas,.brand-gate{width:480px;margin:0 auto;box-shadow:0 0 36px rgba(16,24,40,.08)}}@media (prefers-reduced-motion:reduce){.category-icon{transition:none}}
.grid-symbol>view{display:block;background:var(--brand-primary);border-radius:5rpx}.progress-check{position:absolute;left:7rpx;top:13rpx;width:9rpx;height:3rpx;background:var(--brand-primary);transform:rotate(38deg)}.progress-check::after{content:'';position:absolute;left:7rpx;bottom:0;width:12rpx;height:3rpx;background:var(--brand-primary);transform:rotate(-78deg);transform-origin:left}
</style>
