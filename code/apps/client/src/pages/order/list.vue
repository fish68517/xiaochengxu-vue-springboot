<template>
  <view class="page-shell" :style="brandState.vars"><view class="mobile-canvas">
    <view class="page-hero"><text class="page-title">我的订单</text><text class="page-subtitle">服务进度和售后状态一目了然</text></view>
    <scroll-view scroll-x class="tabs" :show-scrollbar="false"><view class="tabs-row"><text v-for="tab in tabs" :key="tab.key" class="tab" :class="{active:activeTab===tab.key}" @click="activeTab=tab.key">{{ tab.label }}</text></view></scroll-view>
    <view class="query-toggle" @click="queryOpen=!queryOpen"><text>查询客服链接订单</text><text>{{ queryOpen ? '收起' : '展开' }} ›</text></view>
    <view v-if="queryOpen" class="query-panel">
      <view class="field"><text>订单号</text><input v-model="orderNoInput" placeholder="请输入订单号" @confirm="loadOrders"/></view>
      <view class="field"><text>联系方式</text><input v-model="contactInput" placeholder="手机号或微信号（选填）" @confirm="loadOrders"/></view>
      <view class="query-actions"><button class="secondary-button" @click="resetQuery">我的订单</button><button class="primary-button" @click="loadOrders">查询订单</button></view>
    </view>
    <UiSkeleton v-if="loading" :count="4"/>
    <UiState v-else-if="errorMsg" title="订单加载失败" :description="errorMsg" action-text="重新加载" @action="loadOrders"/>
    <UiState v-else-if="filteredOrders.length===0" title="暂无相关订单" description="下单后可在这里查看服务进度" action-text="去逛逛" @action="goHome"/>
    <view v-else class="orders">
      <view v-for="order in filteredOrders" :key="order.id||order.orderId||order._id" class="order-card" @click="goDetail(order)">
        <view class="order-head"><text class="order-no">{{ order.orderNo }}</text><text class="order-status">{{ order.statusText||statusText(order.status) }}</text></view>
        <view class="order-body"><image class="order-cover" :src="productCover(order)" mode="aspectFill"/><view class="order-info"><text class="order-title">{{ productTitle(order) }}</text><text class="order-time">下单时间 {{ order.createdAtText||formatDateTime(order.createdAt) }}</text><text class="order-progress">{{ statusDesc(order.status) }}</text></view></view>
        <view class="order-foot"><text class="order-amount"><text>实付 </text>¥{{ fenToYuan(order.amountFen) }}</text><button class="copy-btn" @click.stop="copyOrderNo(order)">复制单号</button></view>
      </view>
    </view>
    <ClientTabbar active="orders"/>
  </view></view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { api, ensureSession } from '../../api.js';
import { brandState } from '../../brand.js';
import { statusText, statusDesc, fenToYuan, formatDateTime } from '../../client-utils.js';
import ClientTabbar from '../../components/client-tabbar.vue';
import UiSkeleton from '../../components/UiSkeleton.vue';
import UiState from '../../components/UiState.vue';
const activeTab=ref('ALL'); const orderNoInput=ref(''); const contactInput=ref(''); const orders=ref([]); const loading=ref(true); const errorMsg=ref(''); const sourceMode=ref('mine'); const queryOpen=ref(false);
const tabs=[{key:'ALL',label:'全部'},{key:'PENDING_PAYMENT',label:'待支付'},{key:'PENDING_ACCEPT',label:'待处理'},{key:'IN_SERVICE',label:'服务中'},{key:'PENDING_CONFIRM',label:'待确认'},{key:'SETTLED',label:'已完成'},{key:'REFUNDING',label:'售后'}];
const filteredOrders=computed(()=>{if(activeTab.value==='ALL')return orders.value;if(activeTab.value==='PENDING_ACCEPT')return orders.value.filter((item)=>['PENDING_ACCEPT','PENDING_GRAB','ASSIGN_PENDING'].includes(item.status));if(activeTab.value==='REFUNDING')return orders.value.filter((item)=>['REFUNDING','REFUNDED','DISPUTING'].includes(item.status));return orders.value.filter((item)=>item.status===activeTab.value);});
onLoad((query)=>{if(query&&query.status&&tabs.some((tab)=>tab.key===query.status))activeTab.value=query.status;loadOrders();});
onShow(()=>{try{uni.setNavigationBarTitle({title:(brandState.brand&&brandState.brand.name)||'我的订单'});}catch(e){/* 忽略 */}});
async function loadOrders(){loading.value=true;errorMsg.value='';try{const orderNo=(orderNoInput.value||'').trim();const contact=(contactInput.value||'').trim();if(orderNo){const payload={orderNo};if(contact){if(/^1\d{10}$/.test(contact))payload.contactPhone=contact;else payload.contactWechat=contact;}const result=await api.queryOrderByNo(payload);orders.value=result&&(result.id||result.orderId||result._id)?[result]:(Array.isArray(result)?result:[]);sourceMode.value='query';}else{await ensureSession();const list=await api.listMyOrders({});orders.value=Array.isArray(list)?list:[];sourceMode.value='mine';}}catch(error){orders.value=[];errorMsg.value=error&&error.code==='ACTION_NOT_READY'?'客服链接订单查询即将开放，请联系客服获取帮助':((error&&error.message)||'订单加载失败');}finally{loading.value=false;}}
function resetQuery(){orderNoInput.value='';contactInput.value='';activeTab.value='ALL';sourceMode.value='mine';loadOrders();}
function productTitle(order){return (order&&order.product&&order.product.title)||(order&&order.productSnapshot&&order.productSnapshot.title)||'服务订单';}
function productCover(order){return (order&&order.product&&order.product.coverImage)||'/static/default-product.svg';}
function copyOrderNo(order){uni.setClipboardData({data:order.orderNo,success:()=>uni.showToast({title:'订单号已复制',icon:'success'})});}
function goHome(){uni.reLaunch({url:'/pages/index/index'});}
function goDetail(order){if(sourceMode.value==='query'){uni.showModal({title:'订单详情',content:`订单号：${order.orderNo}\n状态：${order.statusText||statusText(order.status)}\n金额：¥${fenToYuan(order.amountFen)}\n下单：${order.createdAtText||formatDateTime(order.createdAt)}`,showCancel:false});return;}const id=order.id||order.orderId||order._id;if(id)uni.navigateTo({url:`/pages/order/detail?id=${encodeURIComponent(id)}`});}
</script>

<style lang="scss" scoped>
.page-shell{min-height:100vh;min-height:100dvh;background:#e9edf5}.mobile-canvas{min-height:100vh;min-height:100dvh;padding-bottom:calc(136rpx + env(safe-area-inset-bottom));background:var(--brand-bg)}.page-hero{padding:42rpx 30rpx 30rpx;color:#fff;background:linear-gradient(135deg,#22295f,var(--brand-primary),var(--brand-secondary))}.page-title{display:block;font-size:42rpx;font-weight:800}.page-subtitle{display:block;margin-top:8rpx;font-size:24rpx;opacity:.78}
.tabs{margin-top:-2rpx;white-space:nowrap;background:#fff;border-bottom:1rpx solid var(--color-border)}.tabs-row{padding:0 24rpx;display:inline-flex}.tab{position:relative;padding:26rpx 22rpx;color:var(--color-text-secondary);font-size:24rpx}.tab.active{color:var(--brand-primary);font-weight:700}.tab.active::after{content:'';position:absolute;right:22rpx;bottom:0;left:22rpx;height:5rpx;background:var(--brand-primary);border-radius:5rpx}
.query-toggle{margin:22rpx 28rpx 0;padding:22rpx 24rpx;display:flex;justify-content:space-between;color:var(--color-text-secondary);font-size:24rpx;background:#fff;border-radius:18rpx}.query-toggle text:last-child{color:var(--brand-primary)}.query-panel{margin:14rpx 28rpx 0;padding:24rpx;background:#fff;border-radius:22rpx}.field{margin-bottom:18rpx}.field>text{display:block;margin-bottom:8rpx;color:var(--color-text-secondary);font-size:23rpx}.field input{height:78rpx;padding:0 20rpx;font-size:26rpx;background:#f8f9fc;border:1rpx solid var(--color-border);border-radius:14rpx}.query-actions{display:flex;gap:16rpx}.query-actions button{height:76rpx;flex:1;line-height:76rpx;font-size:25rpx;border-radius:38rpx}.primary-button{color:#fff;background:var(--brand-primary)}.secondary-button{color:var(--color-text-secondary);background:#f2f4f7}
.orders{padding:22rpx 28rpx}.order-card{margin-bottom:20rpx;padding:24rpx;background:#fff;border-radius:24rpx;box-shadow:var(--shadow-card)}.order-head,.order-foot{display:flex;align-items:center;justify-content:space-between}.order-no{color:var(--color-text-tertiary);font-size:22rpx}.order-status{padding:6rpx 14rpx;color:var(--brand-primary);font-size:22rpx;font-weight:700;background:var(--color-primary-soft);border-radius:999rpx}.order-body{margin-top:20rpx;display:flex;gap:20rpx}.order-cover{width:132rpx;height:104rpx;flex:none;background:#eef0ff;border-radius:16rpx}.order-info{min-width:0;flex:1}.order-title{display:block;overflow:hidden;color:var(--color-text);font-size:28rpx;font-weight:700;text-overflow:ellipsis;white-space:nowrap}.order-time,.order-progress{display:block;margin-top:8rpx;color:var(--color-text-tertiary);font-size:21rpx}.order-progress{color:var(--color-text-secondary)}.order-foot{margin-top:20rpx;padding-top:18rpx;border-top:1rpx solid var(--color-border)}.order-amount{color:var(--color-text);font-size:29rpx;font-weight:800}.order-amount>text{color:var(--color-text-tertiary);font-size:21rpx;font-weight:400}.copy-btn{width:auto;height:62rpx;margin:0;padding:0 22rpx;color:var(--color-text-secondary);font-size:22rpx;line-height:62rpx;background:#f2f4f7;border-radius:31rpx}
@media(min-width:480px){.mobile-canvas{width:480px;margin:0 auto;box-shadow:0 0 36px rgba(16,24,40,.08)}}
</style>
