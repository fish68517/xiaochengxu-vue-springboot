<template>
  <view class="page-shell" :style="brandState.vars"><view class="mobile-canvas">
    <ClientHeader :title="brandName" subtitle="个人中心" :logo="logo" source="mine"/>
    <view class="profile-card">
      <view class="profile-glow"/><image class="avatar" src="/static/default-avatar.svg" mode="aspectFill"/>
      <view class="profile-copy"><text class="name">{{ displayName }}</text><text class="identity">{{ identityText }}</text></view>
    </view>
    <view class="order-panel">
      <view class="panel-head" @click="openOrders('ALL')"><text>我的订单</text><text>查看全部 ›</text></view>
      <view class="order-shortcuts">
        <view v-for="item in orderEntries" :key="item.key" @click="openOrders(item.key)"><view class="status-icon" :class="item.tone"><view class="status-paper"><view class="paper-line"/></view></view><text>{{ item.label }}</text></view>
      </view>
    </view>
    <view class="service-panel">
      <text class="section-title">常用服务</text>
      <button class="service-row" open-type="contact" :session-from="contactSession" @click="showH5Contact"><view class="row-icon"><image src="/static/icons/headset.svg" mode="aspectFit"/></view><view class="row-copy"><text>联系客服</text><text>服务咨询与订单问题</text></view><text class="arrow">›</text></button>
      <view class="service-row" @click="showRules"><view class="row-icon"><image src="/static/icons/shield.svg" mode="aspectFit"/></view><view class="row-copy"><text>服务保障</text><text>了解服务流程与售后规则</text></view><text class="arrow">›</text></view>
      <view class="service-row" @click="showPrivacy"><view class="row-icon"><image src="/static/icons/order-active.svg" mode="aspectFit"/></view><view class="row-copy"><text>隐私与协议</text><text>查看平台使用说明</text></view><text class="arrow">›</text></view>
    </view>
    <view class="brand-note"><text>{{ brandName }}</text><text>品质服务 · 全程跟进</text></view>
    <ClientTabbar active="mine"/>
  </view></view>
</template>

<script setup>
import { computed } from 'vue';
import ClientHeader from '../../components/ClientHeader.vue';
import ClientTabbar from '../../components/client-tabbar.vue';
import { brandState } from '../../brand.js';
import { brandLogo, brandContact } from '../../brand-assets.js';
import { maskPhone } from '../../client-utils.js';
const brandName=computed(()=>(brandState.brand&&brandState.brand.name)||'星河服务'); const logo=computed(brandLogo);
const user=computed(()=>{try{return uni.getStorageSync('user')||{};}catch(e){return {};}});
const displayName=computed(()=>user.value.nickname||'个人中心');
const identityText=computed(()=>user.value.phone?`用户 ${maskPhone(user.value.phone)}`:'登录后可查看完整订单进度');
const contactSession=JSON.stringify({source:'mine'});
const orderEntries=[{key:'PENDING_PAYMENT',label:'待支付',tone:'blue'},{key:'IN_SERVICE',label:'服务中',tone:'green'},{key:'PENDING_CONFIRM',label:'待确认',tone:'orange'},{key:'REFUNDING',label:'售后',tone:'purple'}];
function openOrders(status){uni.navigateTo({url:`/pages/order/list?status=${encodeURIComponent(status)}`});}
function showH5Contact(){
  // #ifdef H5
  const contact=brandContact(); const lines=[contact.serviceWechat&&`客服微信：${contact.serviceWechat}`,contact.servicePhone&&`客服电话：${contact.servicePhone}`,contact.serviceHours&&`服务时间：${contact.serviceHours}`].filter(Boolean);
  uni.showModal({title:'联系客服',content:lines.join('\n')||'请联系品牌客服获取帮助',showCancel:false});
  // #endif
}
function showRules(){uni.showModal({title:'服务保障',content:'平台提供明码标价、订单进度跟进与售后处理。具体规则以商品详情和订单约定为准。',showCancel:false});}
function showPrivacy(){uni.showModal({title:'隐私与协议',content:'平台仅在提供服务所需范围内处理订单与联系方式。正式运营前将接入完整协议页面。',showCancel:false});}
</script>

<style lang="scss" scoped>
.page-shell{min-height:100vh;min-height:100dvh;background:#e9edf5}.mobile-canvas{min-height:100vh;min-height:100dvh;padding-bottom:calc(146rpx + env(safe-area-inset-bottom));background:var(--brand-bg)}
.profile-card{position:relative;margin:24rpx 28rpx;padding:38rpx 34rpx;overflow:hidden;display:flex;align-items:center;gap:24rpx;color:#fff;background:linear-gradient(135deg,#242b63,var(--brand-primary) 64%,var(--brand-secondary));border-radius:30rpx;box-shadow:0 16rpx 38rpx rgba(60,68,180,.22)}.profile-glow{position:absolute;right:-70rpx;top:-100rpx;width:280rpx;height:280rpx;background:rgba(255,255,255,.12);border-radius:50%}.avatar{position:relative;width:112rpx;height:112rpx;flex:none;border:5rpx solid rgba(255,255,255,.72);border-radius:50%}.profile-copy{position:relative;min-width:0}.name{display:block;font-size:36rpx;font-weight:800}.identity{display:block;margin-top:10rpx;font-size:23rpx;opacity:.8}
.order-panel,.service-panel{margin:24rpx 28rpx;padding:0 26rpx;background:#fff;border-radius:26rpx;box-shadow:var(--shadow-card)}.panel-head{height:90rpx;display:flex;align-items:center;justify-content:space-between;border-bottom:1rpx solid var(--color-border)}.panel-head text:first-child,.section-title{color:var(--color-text);font-size:30rpx;font-weight:800}.panel-head text:last-child{color:var(--color-text-tertiary);font-size:23rpx}.order-shortcuts{padding:30rpx 0 26rpx;display:grid;grid-template-columns:repeat(4,1fr)}.order-shortcuts>view{display:flex;flex-direction:column;align-items:center;gap:12rpx;color:var(--color-text-secondary);font-size:22rpx}.status-icon{width:66rpx;height:66rpx;display:flex;align-items:center;justify-content:center;background:#eef0ff;border-radius:20rpx}.status-icon.green{background:#e9f8f1}.status-icon.orange{background:#fff3e0}.status-icon.purple{background:#f3edff}.status-paper{width:28rpx;height:34rpx;position:relative;border:3rpx solid #5b63f6;border-radius:5rpx}.green .status-paper{border-color:#12b76a}.orange .status-paper{border-color:#f79009}.purple .status-paper{border-color:#7c3aed}.status-paper i,.status-paper::after{content:'';position:absolute;left:5rpx;right:5rpx;height:3rpx;top:10rpx;background:currentColor}.status-paper::after{top:19rpx}
.service-panel{padding-top:26rpx}.section-title{display:block;margin-bottom:12rpx}.service-row{width:100%;min-height:106rpx;margin:0;padding:14rpx 0;display:flex;align-items:center;text-align:left;background:transparent;border-bottom:1rpx solid var(--color-border);border-radius:0}.service-row:last-child{border-bottom:0}.row-icon{width:66rpx;height:66rpx;flex:none;display:flex;align-items:center;justify-content:center;background:var(--color-primary-soft);border-radius:18rpx}.row-icon image{width:38rpx;height:38rpx}.row-copy{min-width:0;flex:1;margin-left:20rpx}.row-copy text:first-child{display:block;color:var(--color-text);font-size:27rpx;font-weight:700}.row-copy text:last-child{display:block;margin-top:4rpx;color:var(--color-text-tertiary);font-size:21rpx}.arrow{color:var(--color-text-tertiary);font-size:36rpx}.brand-note{padding:24rpx 0 40rpx;text-align:center;color:var(--color-text-tertiary);font-size:22rpx}.brand-note text{display:block}.brand-note text:last-child{margin-top:6rpx;font-size:20rpx}
@media(min-width:480px){.mobile-canvas{width:480px;margin:0 auto;box-shadow:0 0 36px rgba(16,24,40,.08)}}
.paper-line{position:absolute;left:5rpx;right:5rpx;height:3rpx;top:10rpx;background:currentColor}
</style>
