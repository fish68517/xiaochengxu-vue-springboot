<template>
  <view class="page-shell" :style="brandState.vars"><view class="mobile-canvas">
    <UiSkeleton v-if="loading" :count="2"/>
    <UiState v-else-if="errorMsg" title="暂时无法查看服务" :description="errorMsg" action-text="重新加载" @action="loadProduct"/>
    <template v-else-if="product">
      <view class="cover-wrap"><image class="main-image" :src="cover" mode="aspectFill" @error="cover='/static/default-product.svg'"/><view class="cover-gradient"/><text class="cover-badge">品质服务</text></view>
      <view class="summary">
        <text class="brand-label">{{ product.brandName || '服务品牌' }}</text>
        <text class="title">{{ product.title }}</text>
        <view class="meta"><text v-if="product.game">{{ gameText(product.game) }}</text><text v-if="product.serviceType">{{ serviceTypeText(product.serviceType) }}</text><text v-if="product.tierName">{{ product.tierName }}</text></view>
        <view v-if="product.guaranteedOutput" class="guarantee"><image src="/static/icons/shield.svg" mode="aspectFit"/><text>服务保障：{{ product.guaranteedOutput }}{{ product.outputUnit||'' }}</text></view>
        <view class="price-row"><text class="price"><text>¥</text>{{ fenToYuan(product.priceFen) }}</text><text class="price-note">价格透明，无隐藏收费</text></view>
      </view>
      <view class="trust-card"><view><text class="number">01</text><text>确认需求</text></view><view><text class="number">02</text><text>专人服务</text></view><view><text class="number">03</text><text>完成确认</text></view></view>
      <view class="content-card"><text class="heading">服务说明</text><text class="line">{{ product.description||'下单后由客服确认具体需求，并为您安排合适的服务人员。服务过程可在订单中查看。' }}</text></view>
      <view v-if="otherBrand" class="content-card"><text class="heading">下单渠道说明</text><text class="line">该商品由 {{ product.brandName }} 提供。当前支持全品牌浏览，请前往该品牌对应的小程序下单；当前小程序的登录和支付身份不能直接用于其他品牌。</text></view>
      <view class="content-card"><text class="heading">下单须知</text><view class="notice"><view class="notice-dot"/><text>请填写准确的联系方式和服务信息</text></view><view class="notice"><view class="notice-dot"/><text>服务时间以客服与您最终确认的信息为准</text></view><view class="notice"><view class="notice-dot"/><text>如遇问题，可通过订单联系专属客服</text></view></view>
      <view class="bottom-bar"><button class="contact" open-type="contact" :session-from="contactSession" @click="showH5Contact"><image src="/static/icons/headset.svg" mode="aspectFit"/><text>客服</text></button><view class="checkout"><view><text>合计</text><text>¥{{ fenToYuan(product.priceFen) }}</text></view><button class="cta" :disabled="ordering" @click="orderNow">{{ ordering?'跳转中…':'立即下单' }}</button></view></view>
    </template>
  </view></view>
</template>

<script setup>
import { computed, ref } from 'vue'; import { onLoad,onShow } from '@dcloudio/uni-app'; import { api,getH5OrderToken,BRAND_CODE } from '../../api.js'; import { brandState } from '../../brand.js'; import { brandContact } from '../../brand-assets.js'; import { fenToYuan,coverOf,gameText,serviceTypeText } from '../../client-utils.js'; import UiSkeleton from '../../components/UiSkeleton.vue'; import UiState from '../../components/UiState.vue';
const product=ref(null);const cover=ref('/static/default-product.svg');const loading=ref(true);const errorMsg=ref('');const ordering=ref(false);const contactSession=ref('');
const otherBrand = computed(() => {
  if (!product.value) return false;
  const channel = brandState.brand;
  return channel?.brandId ? product.value.brandId !== channel.brandId : !!BRAND_CODE && product.value.brandCode !== BRAND_CODE;
});
onLoad((query)=>{const id=(query&&query.id)||'';contactSession.value=id?`{"productId":"${id}"}`:'';loadProduct(id);});onShow(()=>{try{uni.setNavigationBarTitle({title:(brandState.brand&&brandState.brand.name)||'商品详情'});}catch(e){/* 忽略 */}});
async function loadProduct(id){loading.value=true;errorMsg.value='';try{const currentId=product.value&&(product.value.id||product.value._id);const data=await api.getProduct(id||currentId);if(!data||!(data.id||data._id))throw new Error('商品不存在或已下架');product.value=data;cover.value=coverOf(data);}catch(error){product.value=null;errorMsg.value=(error&&error.message)||'商品加载失败';}finally{loading.value=false;}}
async function orderNow(){if(!product.value||ordering.value)return;if(otherBrand.value){uni.showModal({title:'请使用对应品牌下单渠道',content:`该商品属于${product.value.brandName}，请前往该品牌对应的小程序下单。全品牌展示不会改变当前登录与支付身份。`,showCancel:false});return;}ordering.value=true;try{const res=await getH5OrderToken(product.value.id||product.value._id);if(!res||!res.token)throw new Error('下单链接生成失败');uni.navigateTo({url:`/pages/order/webview-shell?token=${encodeURIComponent(res.token)}`});}catch(error){uni.showToast({title:(error&&error.message)||'下单失败',icon:'none'});}finally{ordering.value=false;}}
function showH5Contact(){
  // #ifdef H5
  const contact=product.value?.brandContact||brandContact();const lines=[contact.serviceWechat&&`客服微信：${contact.serviceWechat}`,contact.servicePhone&&`客服电话：${contact.servicePhone}`,contact.serviceHours&&`服务时间：${contact.serviceHours}`].filter(Boolean);uni.showModal({title:'联系客服',content:lines.join('\n')||'请联系品牌客服获取帮助',showCancel:false});
  // #endif
}
</script>

<style lang="scss" scoped>
.brand-label{display:block;margin-bottom:14rpx;color:#4338ca;font-size:26rpx;font-weight:700}
.page-shell{min-height:100vh;background:#e9edf5}.mobile-canvas{min-height:100vh;padding-bottom:calc(142rpx + env(safe-area-inset-bottom));background:var(--brand-bg)}.cover-wrap{height:590rpx;position:relative;overflow:hidden;background:#eef0ff}.main-image{width:100%;height:100%}.cover-gradient{position:absolute;inset:55% 0 0;background:linear-gradient(transparent,rgba(16,24,40,.42))}.cover-badge{position:absolute;left:28rpx;bottom:24rpx;padding:8rpx 18rpx;color:#fff;font-size:22rpx;font-weight:700;background:rgba(16,24,40,.62);border-radius:999rpx}
.summary{padding:30rpx;background:#fff}.title{display:block;color:var(--color-text);font-size:38rpx;font-weight:800;line-height:1.4}.meta{margin-top:14rpx;display:flex;flex-wrap:wrap;gap:10rpx}.meta text{padding:6rpx 14rpx;color:var(--brand-primary);font-size:22rpx;background:var(--color-primary-soft);border-radius:8rpx}.guarantee{margin-top:20rpx;padding:16rpx 18rpx;display:flex;align-items:center;gap:10rpx;color:var(--color-text-secondary);font-size:24rpx;background:#f8f9fc;border-radius:14rpx}.guarantee image{width:34rpx;height:34rpx}.price-row{margin-top:22rpx;display:flex;align-items:baseline;justify-content:space-between}.price{color:var(--brand-primary);font-size:50rpx;font-weight:800}.price>text{font-size:27rpx}.price-note{color:var(--color-text-tertiary);font-size:21rpx}
.trust-card{margin:20rpx 24rpx;padding:24rpx 8rpx;display:grid;grid-template-columns:repeat(3,1fr);background:#fff;border-radius:22rpx}.trust-card>view{display:flex;flex-direction:column;align-items:center;gap:8rpx;color:var(--color-text-secondary);font-size:22rpx;border-right:1rpx solid var(--color-border)}.trust-card>view:last-child{border-right:0}.number{color:var(--brand-primary);font-size:24rpx;font-weight:800}.content-card{margin:20rpx 24rpx;padding:28rpx;background:#fff;border-radius:22rpx}.heading{display:block;margin-bottom:18rpx;font-size:30rpx;font-weight:800}.line{display:block;color:var(--color-text-secondary);font-size:26rpx;line-height:1.8}.notice{margin-top:14rpx;display:flex;align-items:flex-start;gap:12rpx;color:var(--color-text-secondary);font-size:24rpx;line-height:1.55}.notice i{width:10rpx;height:10rpx;margin-top:13rpx;flex:none;background:var(--brand-primary);border-radius:50%}
.bottom-bar{position:fixed;z-index:40;right:0;bottom:0;left:0;padding:14rpx 24rpx calc(14rpx + env(safe-area-inset-bottom));display:flex;align-items:center;gap:18rpx;background:rgba(255,255,255,.98);border-top:1rpx solid var(--color-border);box-shadow:0 -8rpx 28rpx rgba(16,24,40,.08)}.contact{width:86rpx;height:92rpx;margin:0;padding:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3rpx;color:var(--brand-primary);font-size:20rpx;line-height:1;background:transparent}.contact image{width:38rpx;height:38rpx}.checkout{min-width:0;flex:1;display:flex;align-items:center;justify-content:flex-end;gap:18rpx}.checkout>view{text-align:right}.checkout>view text:first-child{display:block;color:var(--color-text-tertiary);font-size:19rpx}.checkout>view text:last-child{display:block;color:var(--brand-primary);font-size:27rpx;font-weight:800}.cta{width:230rpx;height:88rpx;margin:0;color:#fff;font-size:28rpx;font-weight:800;line-height:88rpx;background:var(--brand-primary);border-radius:44rpx}.cta[disabled]{opacity:.6}
@media(min-width:480px){.mobile-canvas,.bottom-bar{width:480px;margin:0 auto}.mobile-canvas{box-shadow:0 0 36px rgba(16,24,40,.08)}.bottom-bar{left:50%;right:auto;transform:translateX(-50%)}}
.notice-dot{width:10rpx;height:10rpx;margin-top:13rpx;flex:none;background:var(--brand-primary);border-radius:50%}
</style>
