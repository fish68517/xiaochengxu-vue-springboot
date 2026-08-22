<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppTabBar from '@/components/AppTabBar.vue'
import { getProfile } from '@/api/user'
import { cancelOrder, getOrders } from '@/api/order'
import { useAuthStore } from '@/stores/auth'
import { money } from '@/utils/format'
import type { Order, Profile } from '@/models'

const profile = ref<Profile | null>(null)
const orders = ref<Order[]>([])
const loading = ref(true)
const error = ref('')
const auth = useAuthStore()
const labels: Record<string, string> = { PENDING_PAYMENT: '待付款确认', PAID: '已付款', SHIPPED: '已发货', COMPLETED: '已完成', CANCELLED: '已取消' }
async function load() {
  loading.value = true; error.value = ''
  try { [profile.value, orders.value] = await Promise.all([getProfile(), getOrders()]) }
  catch (err) { error.value = err instanceof Error ? err.message : '加载失败' }
  finally { loading.value = false }
}
onShow(load)
async function cancel(id: number) { try { await cancelOrder(id); await load() } catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '取消失败', icon: 'none' }) } }
async function logout() { await auth.logout(); uni.reLaunch({ url: '/pages/login/index' }) }
function openAddresses() { uni.navigateTo({ url: '/pages/address/index' }) }
</script>

<template>
  <view class="app-shell profile-page">
    <view v-if="loading" class="loading-block">正在加载 MySQL 个人中心...</view>
    <view v-else-if="error || !profile" class="error-block">{{ error || '用户信息不存在' }}</view>
    <template v-else>
      <view class="profile-hero"><view class="actions"><button @click="openAddresses">地址管理</button><button @click="logout">退出登录</button></view><view class="user"><view class="avatar">🐾</view><view><b>{{ profile.nickname }}</b><text>@{{ profile.username }} · Lv.{{ profile.level }}</text></view></view><view class="stats"><view><b>{{ profile.points }}</b><text>积分</text></view><view><b>{{ profile.coupon_count }}</b><text>优惠券</text></view><view><b>{{ profile.favorite_count }}</b><text>收藏</text></view><view><b>{{ orders.length }}</b><text>订单</text></view></view></view>
      <view class="page-body"><view class="orders app-card"><view class="section-title"><text>我的订单</text><text>{{ orders.length }} 笔</text></view><view v-if="!orders.length" class="empty-block">暂无订单，去商城挑选商品吧</view><view v-for="order in orders" :key="order.id" class="order"><view><b>{{ order.order_no }}</b><text :class="order.status">{{ labels[order.status] || order.status }}</text></view><view v-for="item in order.items" :key="item.id"><text>{{ item.product_name }} × {{ item.quantity }}</text><b>¥{{ money(item.line_amount) }}</b></view><view class="order-foot"><text>合计 ¥{{ money(order.total_amount) }}</text><button v-if="order.status === 'PENDING_PAYMENT'" @click="cancel(order.id)">取消订单</button></view></view></view></view>
    </template>
    <AppTabBar current="profile" />
  </view>
</template>

<style scoped lang="scss">
.profile-page{min-height:100vh;background:#fff9ef}.profile-hero{padding:45rpx 24rpx 28rpx;background:radial-gradient(circle at 70% 20%,#fff5c8,#ffe6a2)}.actions{display:flex;justify-content:flex-end;gap:12rpx}.actions button,.order button{height:48rpx;padding:0 18rpx;border-radius:24rpx;color:#7b695b;background:rgba(255,255,255,.7);font-size:18rpx;line-height:48rpx}.user{display:grid;grid-template-columns:100rpx 1fr;gap:18rpx;align-items:center;margin:24rpx 0}.avatar{width:96rpx;height:96rpx;border:4rpx solid #fff;border-radius:50%;background:#c7d69e;text-align:center;font-size:58rpx;line-height:92rpx}.user>view:last-child{display:flex;flex-direction:column;gap:8rpx}.user b{font-size:30rpx}.user text{color:#786b60;font-size:20rpx}.stats{display:grid;grid-template-columns:repeat(4,1fr);padding:18rpx 0;border-radius:22rpx;background:rgba(255,255,255,.86)}.stats view{display:flex;flex-direction:column;align-items:center;border-right:1rpx solid #eadcc8}.stats view:last-child{border:0}.stats b{font-size:28rpx}.stats text{color:#776c62;font-size:18rpx}.orders{padding:22rpx}.order{margin-top:18rpx;padding:18rpx;border-radius:16rpx;background:#fff6e8}.order>view{display:flex;justify-content:space-between;margin:10rpx 0;font-size:20rpx}.order>view:first-child{padding-bottom:10rpx;border-bottom:1rpx solid #ead8bf}.order>view:first-child text{color:#ef5a11}.order-foot{align-items:center}.order-foot>text{font-weight:700}
</style>
