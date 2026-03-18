<template>
  <view class="page">
    <view class="success-card">
      <view class="icon">✓</view>
      <view class="title">预约创建成功</view>
      <view class="desc">请按预约时间到站充电</view>
    </view>

    <view class="detail-card" v-if="order">
      <view class="row"><text class="label">订单号</text><text class="value">#{{ order.id || '-' }}</text></view>
      <view class="row"><text class="label">站点</text><text class="value">{{ stationName }}</text></view>
      <view class="row"><text class="label">充电桩</text><text class="value">{{ order.stumpID || order.stumpId || '-' }}</text></view>
      <view class="row"><text class="label">功率</text><text class="value">{{ order.maxPower || '-' }} kW</text></view>
      <view class="row"><text class="label">时长</text><text class="value">{{ order.chargingTime || '-' }} 小时</text></view>
      <view class="row"><text class="label">金额</text><text class="value">¥{{ order.orderPrice || '-' }}</text></view>
      <view class="row"><text class="label">支付方式</text><text class="value">{{ order.payWay || '-' }}</text></view>
      <view class="row"><text class="label">创建时间</text><text class="value">{{ order.createTime || '-' }}</text></view>
    </view>

    <view class="btns">
      <button class="btn ghost" @tap="goHome">返回首页</button>
      <button class="btn primary" @tap="goOrderList">查看我的订单</button>
    </view>
  </view>
</template>

<script>
import { fetchOrderById } from '../../api/order'
import { fetchStationById } from '../../api/station'

export default {
  data() {
    return {
      orderId: '',
      order: null,
      stationName: '-'
    }
  },
  async onLoad(options) {
    this.orderId = options.orderId || ''
    if (!this.orderId) {
      uni.showToast({ title: '缺少订单编号', icon: 'none' })
      return
    }
    await this.loadOrder()
  },
  methods: {
    async loadOrder() {
      uni.showLoading({ title: '加载中...' })
      try {
        const res = await fetchOrderById(this.orderId)
        const order = res.data || null
        this.order = order
        const stationId = order?.chargingStationID || order?.chargingStationId || order?.chargingstationId
        if (stationId) {
          const stationRes = await fetchStationById(stationId)
          this.stationName = stationRes.data?.stationName || '-'
        }
      } catch (error) {
        uni.showToast({ title: error.message || '获取订单失败', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    },
    goHome() {
      uni.reLaunch({
        url: '/pages/home/index'
      })
    },
    goOrderList() {
      uni.reLaunch({
        url: '/pages/order-list/index'
      })
    }
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 22rpx;
  box-sizing: border-box;
}

.success-card {
  background: #ffffff;
  border-radius: 14rpx;
  padding: 30rpx;
  text-align: center;
}

.icon {
  width: 96rpx;
  height: 96rpx;
  margin: 0 auto;
  border-radius: 999rpx;
  background: #16a34a;
  color: #fff;
  font-size: 56rpx;
  line-height: 96rpx;
}

.title {
  margin-top: 14rpx;
  font-size: 34rpx;
  font-weight: 700;
  color: #111827;
}

.desc {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #6b7280;
}

.detail-card {
  background: #ffffff;
  border-radius: 14rpx;
  padding: 20rpx;
  margin-top: 14rpx;
}

.row {
  display: flex;
  justify-content: space-between;
  margin-top: 10rpx;
  gap: 20rpx;
}

.label {
  font-size: 24rpx;
  color: #6b7280;
}

.value {
  font-size: 24rpx;
  color: #111827;
  text-align: right;
}

.btns {
  margin-top: 16rpx;
  display: flex;
  gap: 12rpx;
}

.btn {
  flex: 1;
  height: 82rpx;
  line-height: 82rpx;
  border-radius: 12rpx;
  border: none;
  font-size: 26rpx;
}

.btn::after {
  border: none;
}

.btn.primary {
  background: #16a34a;
  color: #fff;
}

.btn.ghost {
  background: #fff;
  color: #374151;
  border: 1rpx solid #d1d5db;
}
</style>
