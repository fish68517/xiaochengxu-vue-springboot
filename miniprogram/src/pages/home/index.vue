<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '../../api/http'
import { useSessionStore } from '../../stores/session'

const store = useSessionStore()
const bills = ref<any[]>([])
const notices = ref<any[]>([])
const pendingCount = computed(() => bills.value.filter(item => ['PENDING','OVERDUE'].includes(item.status)).length)

const features = [
  { icon:'¥', color:'blue', name:'缴费服务', url:'/pages/payment/list' },
  { icon:'🛠', color:'orange', name:'报修服务', url:'/pages/repair/index' },
  { icon:'▣', color:'green', name:'维保记录', url:'/pages/maintenance/index' },
  { icon:'▤', color:'purple', name:'装修登记', url:'/pages/renovation/index' },
  { icon:'📣', color:'indigo', name:'公告通知', url:'/pages/notice/index', tab:true },
  { icon:'▥', color:'blue', name:'企业介绍', url:'' },
  { icon:'♙', color:'purple', name:'个人中心', url:'/pages/profile/index', tab:true },
]

function go(feature:any) {
  if (!feature.url) return uni.showModal({title:'企业介绍',content:'Development 模式使用本地 H5 占位页；生产环境由后台配置正式 H5 地址。',showCancel:false})
  feature.tab ? uni.switchTab({url:feature.url}) : uni.navigateTo({url:feature.url})
}
function callRescue(){ uni.makePhoneCall({phoneNumber:'96333'}) }
function goBills(){uni.navigateTo({url:'/pages/payment/list'})}
function goNotices(){uni.switchTab({url:'/pages/notice/index'})}

onShow(async () => {
  if (!store.session) await store.load()
  if (store.session?.role === 'TECHNICIAN') return uni.redirectTo({url:'/pages/technician/index'})
  try { [bills.value,notices.value] = await Promise.all([api.bills(),api.notices()]) } catch {}
})
</script>

<template>
  <view class="phone-page">
    <view class="hero">
      <view class="topline"><view class="house">{{ store.session?.house?.displayName || '正在加载房屋...' }} <text>⌄</text></view><view class="mode">MySQL实时数据</view></view>
      <view class="greeting">您好，{{ store.session?.displayName || '业主' }}</view>
      <view class="subtitle">欢迎使用加装电梯后期管理服务</view>
    </view>
    <view class="content">
      <view class="emergency card">
        <view class="bell">!</view><view class="warning-text"><text>困梯、紧急故障禁止小程序报修！</text><text>请直接拨打电梯现场救援电话</text></view>
        <button @click="callRescue">☎ 一键呼救</button>
      </view>

      <view class="feature-grid card">
        <view v-for="feature in features" :key="feature.name" class="feature" @click="go(feature)">
          <view class="feature-icon" :class="feature.color">{{ feature.icon }}<text v-if="feature.name==='缴费服务' && pendingCount" class="badge">{{ pendingCount }}</text></view>
          <text>{{ feature.name }}</text>
        </view>
      </view>

      <view class="section-title"><text>账单提醒</text><text @click="goBills">查看全部 ›</text></view>
      <view v-if="bills.find(item => ['PENDING','OVERDUE'].includes(item.status))" class="bill-reminder card" @click="goBills">
        <view><text>{{ bills.find(item => ['PENDING','OVERDUE'].includes(item.status))?.title }}</text><text>{{ pendingCount }} 笔待处理账单</text></view>
        <strong>¥{{ bills.find(item => ['PENDING','OVERDUE'].includes(item.status))?.totalAmount }}</strong>
      </view>

      <view class="section-title"><text>最新公告</text><text @click="goNotices">查看更多 ›</text></view>
      <view class="notice-card card">
        <view v-for="notice in notices.slice(0,3)" :key="notice.id" class="notice-row"><view><text v-if="notice.pinned" class="pin">置顶</text>{{ notice.title }}</view><text>{{ notice.publishedAt?.slice(5,10) }}</text></view>
        <view v-if="!notices.length" class="empty">暂无公告</view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.phone-page{min-height:100vh;max-width:920rpx;margin:auto;background:#f5f7fa}.hero{background:linear-gradient(145deg,#eaf3ff,#fff);padding:calc(var(--status-bar-height) + 30rpx) 34rpx 46rpx}.topline{display:flex;justify-content:space-between;align-items:center}.house{font-size:31rpx;font-weight:800}.house text{color:#1768ed}.mode{font-size:20rpx;background:#dceaff;color:#1768ed;padding:8rpx 14rpx;border-radius:18rpx}.greeting{font-size:42rpx;font-weight:900;margin-top:40rpx}.subtitle{color:#748094;margin-top:10rpx}.content{padding:0 26rpx 120rpx;margin-top:-20rpx}.emergency{min-height:140rpx;background:linear-gradient(100deg,#fff0f0,#ffe8e8);border-color:#ffd8d8;display:flex;align-items:center;padding:22rpx;gap:15rpx}.bell{width:42rpx;height:42rpx;border-radius:50%;background:#f04444;color:#fff;display:grid;place-items:center;font-weight:900}.warning-text{flex:1}.warning-text text{display:block;color:#ed3333;font-size:23rpx;font-weight:700;line-height:1.6}.emergency button{margin:0;background:#fff;color:#ed3333;font-size:21rpx;font-weight:700;border-radius:30rpx;line-height:60rpx;height:60rpx;padding:0 17rpx}.feature-grid{margin-top:20rpx;padding:30rpx 12rpx 20rpx;display:grid;grid-template-columns:repeat(4,1fr);row-gap:28rpx}.feature{text-align:center;font-weight:600;font-size:23rpx}.feature-icon{width:78rpx;height:78rpx;border-radius:19rpx;color:#fff;display:grid;place-items:center;margin:0 auto 11rpx;font-size:34rpx;font-weight:900;position:relative;box-shadow:0 8rpx 18rpx #265aac30}.feature-icon.blue{background:linear-gradient(135deg,#3c8bff,#0a5ce8)}.feature-icon.orange{background:linear-gradient(135deg,#ff9c4a,#ff5d28)}.feature-icon.green{background:linear-gradient(135deg,#49d3b1,#11aa81)}.feature-icon.purple{background:linear-gradient(135deg,#a16cff,#7139e6)}.feature-icon.indigo{background:linear-gradient(135deg,#766cff,#5141e9)}.badge{position:absolute;right:-10rpx;top:-10rpx;min-width:32rpx;height:32rpx;padding:0 6rpx;border-radius:16rpx;background:#f04444;color:#fff;font-size:18rpx;display:grid;place-items:center;border:3rpx solid #fff}.bill-reminder{padding:25rpx;display:flex;justify-content:space-between;align-items:center}.bill-reminder text{display:block}.bill-reminder text:first-child{font-weight:700}.bill-reminder text:last-child{font-size:22rpx;color:#8791a4;margin-top:8rpx}.bill-reminder strong{font-size:34rpx;color:#ed3f3f}.notice-card{padding:10rpx 24rpx}.notice-row{height:76rpx;border-bottom:1rpx solid #edf0f5;display:flex;align-items:center;justify-content:space-between;font-size:24rpx}.notice-row:last-child{border:0}.notice-row>text{font-size:21rpx;color:#969fb0}.pin{font-size:18rpx;color:#f04444;background:#fff0f0;border-radius:6rpx;padding:4rpx 7rpx;margin-right:8rpx}
</style>
