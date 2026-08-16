<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppTabBar from '@/components/AppTabBar.vue'
import PetArtwork from '@/components/PetArtwork.vue'
import { getProfile } from '@/api/user'
import { getOrders } from '@/api/order'
import type { Order, Profile } from '@/models'

const profile = ref<Profile | null>(null)
const orders = ref<Order[]>([])
const loading = ref(true)
const error = ref('')
onMounted(async () => {
  try { [profile.value, orders.value] = await Promise.all([getProfile(), getOrders()]) }
  catch (err) { error.value = err instanceof Error ? err.message : '加载失败' }
  finally { loading.value = false }
})
</script>

<template>
  <view class="app-shell profile-page">
    <view v-if="loading" class="loading-block">正在加载我的萌宠...</view>
    <view v-else-if="error || !profile" class="error-block">{{ error || '用户信息不存在' }}</view>
    <template v-else>
      <view class="profile-hero"><view class="top-actions"><text>🎁 签到领萌豆</text><text>⚙</text></view><view class="user"><view class="avatar">🐢</view><view><text class="nickname">{{ profile.nickname }} <b>VIP</b></text><text>Lv.{{ profile.level }}　萌宠爱心家</text><view class="progress"><i></i></view></view><text class="duck">🐥</text></view><view class="stats"><view><b>{{ profile.points }}</b><text>萌豆</text></view><view><b>{{ profile.coupons }}</b><text>优惠券</text></view><view><b>{{ profile.pets.length }}</b><text>我的萌宠</text></view><view><b>{{ profile.favorites }}</b><text>收藏夹</text></view></view></view>
      <view class="page-body profile-body">
        <view class="pets app-card"><view class="section-title"><text>我的萌宠</text><text class="section-title__link">全部萌宠 ›</text></view><view class="pet-grid"><view v-for="pet in profile.pets" :key="pet.name" class="pet"><PetArtwork :type="pet.imageKey" size="md" /><b>{{ pet.name }}</b><text>{{ pet.age }} | <i>{{ pet.health }}</i></text><button>成长记录</button></view><view class="add-pet"><b>＋</b><text>添加萌宠</text><small>记录成长每一刻</small></view></view></view>
        <view class="reminders app-card"><view class="section-title"><text>喂养提醒</text><text class="section-title__link">全部提醒 ›</text></view><view v-for="item in profile.reminders" :key="item.pet" class="reminder"><text class="reminder-icon">◉</text><view><b>{{ item.pet }}　{{ item.task }}</b><small>建议按时完成照护任务</small></view><text class="time">{{ item.time }}</text><button>去处理</button></view></view>
        <view class="orders app-card"><view class="section-title"><text>我的订单</text><text class="section-title__link">全部订单 ›</text></view><view class="order-icons"><view><text>▣<b v-if="profile.order_counts.pending">{{ profile.order_counts.pending }}</b></text><small>待付款</small></view><view><text>📦<b v-if="profile.order_counts.shipping">{{ profile.order_counts.shipping }}</b></text><small>待发货</small></view><view><text>🚚</text><small>待收货</small></view><view><text>💬</text><small>待评价</small></view><view><text>¥</text><small>售后/退款</small></view></view><view v-if="orders.length" class="latest">最近订单：{{ orders[0].product_name }}　<text>{{ orders[0].status === 'PAID' ? '已支付' : '待付款' }}</text></view></view>
        <view class="services app-card"><view class="section-title"><text>常用服务</text></view><view class="service-grid"><view>▤<text>成长记录</text></view><view>📖<text>喂养指南</text></view><view>✚<text>健康档案</text></view><view>🎧<text>客服中心</text></view></view></view>
        <view class="invite app-card"><view><b>邀请好友 领萌豆 🎁</b><text>每成功邀请 1 位好友，得 50 萌豆</text></view><text>🐢🐰</text><button>去邀请 ›</button></view>
      </view>
    </template>
    <AppTabBar current="profile" />
  </view>
</template>

<style scoped lang="scss">
.profile-page{background:#fff9ef}.profile-hero{min-height:390rpx;padding:45rpx 24rpx 22rpx;background:radial-gradient(circle at 70% 20%,#fff5c8,#ffe6a2);position:relative;overflow:hidden}.top-actions{display:flex;justify-content:flex-end;gap:28rpx;font-size:23rpx}.top-actions text:first-child{padding:8rpx 18rpx;border:1rpx solid #f5b767;border-radius:25rpx;background:rgba(255,255,255,.6)}.user{display:grid;grid-template-columns:100rpx 1fr auto;gap:18rpx;align-items:center;margin-top:28rpx}.avatar{width:96rpx;height:96rpx;border:5rpx solid #fff;border-radius:50%;background:#c5d598;text-align:center;font-size:65rpx;line-height:90rpx}.user>view:nth-child(2){display:flex;flex-direction:column;gap:9rpx;font-size:20rpx}.nickname{font-size:29rpx;font-weight:800}.nickname b{padding:3rpx 9rpx;border-radius:10rpx;color:#fff;background:#ff6a00;font-size:17rpx}.progress{width:220rpx;height:10rpx;border-radius:6rpx;background:#f8c881}.progress i{display:block;width:70%;height:100%;border-radius:6rpx;background:#f35d13}.duck{font-size:76rpx}.stats{display:grid;grid-template-columns:repeat(4,1fr);margin-top:26rpx;padding:19rpx 0;border-radius:24rpx;background:rgba(255,255,255,.85)}.stats view{display:flex;flex-direction:column;align-items:center;border-right:1rpx solid #eee1cb}.stats view:last-child{border:0}.stats b{font-size:29rpx}.stats text{margin-top:5rpx;color:#776c62;font-size:18rpx}.profile-body{margin-top:-8rpx}.pets,.reminders,.orders,.services,.invite{padding:20rpx;margin-bottom:18rpx}.pets .section-title,.reminders .section-title,.orders .section-title,.services .section-title{margin:0 0 16rpx}.pet-grid{display:grid;grid-template-columns:1fr 1fr .72fr;gap:13rpx}.pet{overflow:hidden;display:flex;flex-direction:column;border:1rpx solid #f1d9b9;border-radius:20rpx}.pet>b,.pet>text,.pet>button{margin:7rpx 12rpx}.pet>b{font-size:20rpx}.pet>text{font-size:16rpx;color:#776c62}.pet i{color:#5b9639;font-style:normal}.pet button{width:100rpx;height:42rpx;padding:0;border:1rpx solid #9bc46e;border-radius:21rpx;color:#54882f;background:#eff8e3;font-size:16rpx;line-height:40rpx}.add-pet{display:flex;flex-direction:column;align-items:center;justify-content:center;border:2rpx dashed #f5bd73;border-radius:20rpx}.add-pet b{width:58rpx;height:58rpx;border-radius:50%;color:#f16813;background:#fff0d8;text-align:center;font-size:38rpx;line-height:55rpx}.add-pet text{margin-top:10rpx;font-size:20rpx}.add-pet small{margin-top:5rpx;color:#8b8078;font-size:14rpx;text-align:center}.reminder{display:grid;grid-template-columns:48rpx 1fr auto auto;gap:10rpx;align-items:center;padding:12rpx 0;border-bottom:1rpx solid #efe3d2}.reminder:last-child{border:0}.reminder-icon{width:42rpx;height:42rpx;border-radius:50%;color:#f08a1e;background:#fff0d5;text-align:center;line-height:42rpx}.reminder view{display:flex;flex-direction:column}.reminder b{font-size:18rpx}.reminder small{color:#8b8078;font-size:15rpx}.time{color:#f45a11;font-size:17rpx}.reminder button{width:90rpx;height:45rpx;padding:0;border-radius:23rpx;color:#fff;background:#f4741b;font-size:16rpx;line-height:45rpx}.order-icons{display:grid;grid-template-columns:repeat(5,1fr)}.order-icons view{display:flex;flex-direction:column;align-items:center;gap:7rpx}.order-icons view>text{position:relative;font-size:31rpx}.order-icons b{position:absolute;right:-16rpx;top:-8rpx;width:24rpx;height:24rpx;border-radius:50%;color:#fff;background:#f45a11;text-align:center;font-size:14rpx;line-height:24rpx}.order-icons small{font-size:17rpx}.latest{margin-top:18rpx;padding:12rpx;border-radius:12rpx;background:#fff5e6;font-size:17rpx}.latest text{color:#4eaa55}.service-grid{display:grid;grid-template-columns:repeat(4,1fr)}.service-grid view{display:flex;flex-direction:column;align-items:center;gap:10rpx;color:#57a548;font-size:35rpx}.service-grid text{color:#4b443f;font-size:17rpx}.invite{display:grid;grid-template-columns:1fr auto auto;align-items:center;background:linear-gradient(90deg,#fff4d6,#ffe6b8)}.invite view{display:flex;flex-direction:column;gap:8rpx}.invite b{color:#d85d10;font-size:22rpx}.invite view text{font-size:16rpx}.invite>text{font-size:45rpx}.invite button{height:50rpx;padding:0 18rpx;border-radius:25rpx;color:#fff;background:#f36a12;font-size:17rpx;line-height:50rpx}
</style>
