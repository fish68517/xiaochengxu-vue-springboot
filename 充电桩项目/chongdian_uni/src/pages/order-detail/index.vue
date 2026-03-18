<template>
  <view class="page">
    <view class="header-card">
      <view class="title">订单详情</view>
      <view class="status">{{ statusText(order?.state) }}</view>
    </view>

    <view class="detail-card" v-if="order">
      <view class="row"><text class="label">订单号</text><text class="value">#{{ order.id || '-' }}</text></view>
      <view class="row"><text class="label">站点名称</text><text class="value">{{ stationName }}</text></view>
      <view class="row"><text class="label">站点地址</text><text class="value">{{ stationAddress }}</text></view>
      <view class="row"><text class="label">充电桩</text><text class="value">{{ order.stumpID || order.stumpId || '-' }}</text></view>
      <view class="row"><text class="label">功率</text><text class="value">{{ order.maxPower || '-' }} kW</text></view>
      <view class="row"><text class="label">时长</text><text class="value">{{ order.chargingTime || '-' }} 小时</text></view>
      <view class="row"><text class="label">金额</text><text class="value">¥{{ order.orderPrice || '-' }}</text></view>
      <view class="row"><text class="label">支付方式</text><text class="value">{{ order.payWay || '-' }}</text></view>
      <view class="row"><text class="label">创建时间</text><text class="value">{{ order.createTime || '-' }}</text></view>
      <view class="row" v-if="Number(order.state) === 2">
        <text class="label">取消原因</text><text class="value">{{ order.cancelCause || '用户主动取消' }}</text>
      </view>
    </view>

    <view class="btns" v-if="order">
      <button class="btn ghost" @tap="goOrderList">返回订单列表</button>
      <button v-if="Number(order.state) === 0" class="btn plain" @tap="markCompleted">标记完成</button>
      <button v-if="Number(order.state) === 0" class="btn danger" @tap="cancelOrder">取消订单</button>
      <button v-if="Number(order.state) !== 0" class="btn primary" @tap="rebook">再次预约</button>
    </view>
  </view>
</template>

<script>
import { fetchOrderById, updateOrder } from '../../api/order'
import { fetchStationById, updateStump } from '../../api/station'

export default {
  data() {
    return {
      orderId: '',
      order: null,
      stationName: '-',
      stationAddress: '-'
    }
  },
  async onLoad(options) {
    this.orderId = options.id || options.orderId || ''
    if (!this.orderId) {
      uni.showToast({ title: '缺少订单编号', icon: 'none' })
      return
    }
    await this.loadOrder()
  },
  methods: {
    statusText(state) {
      const n = Number(state)
      if (n === 1) return '已完成'
      if (n === 2) return '已取消'
      return '待充电'
    },
    async loadOrder() {
      uni.showLoading({ title: '加载中...' })
      try {
        const res = await fetchOrderById(this.orderId)
        this.order = res.data || null
        const sid = this.order?.chargingStationID || this.order?.chargingStationId || this.order?.chargingstationId
        if (sid) {
          const stationRes = await fetchStationById(sid)
          this.stationName = stationRes.data?.stationName || `站点#${sid}`
          this.stationAddress = stationRes.data?.stationAddress || '-'
        }
      } catch (error) {
        uni.showToast({ title: error.message || '获取订单失败', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    },
    async markCompleted() {
      if (!this.order) return
      uni.showLoading({ title: '处理中...' })
      try {
        await updateOrder({ id: this.order.id, state: 1 })
        const stumpId = this.order.stumpID || this.order.stumpId
        if (stumpId) {
          await updateStump({ id: Number(stumpId), occupy: 0 })
        }
        uni.showToast({ title: '已标记完成', icon: 'success' })
        await this.loadOrder()
      } catch (error) {
        uni.showToast({ title: error.message || '操作失败', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    },
    cancelOrder() {
      if (!this.order) return
      uni.showModal({
        title: '提示',
        content: '确定取消该订单吗？',
        success: async (res) => {
          if (!res.confirm) return
          uni.showLoading({ title: '处理中...' })
          try {
            await updateOrder({
              id: this.order.id,
              state: 2,
              cancelCause: '用户主动取消'
            })
            const stumpId = this.order.stumpID || this.order.stumpId
            if (stumpId) {
              await updateStump({ id: Number(stumpId), occupy: 0 })
            }
            uni.showToast({ title: '订单已取消', icon: 'success' })
            await this.loadOrder()
          } catch (error) {
            uni.showToast({ title: error.message || '取消失败', icon: 'none' })
          } finally {
            uni.hideLoading()
          }
        }
      })
    },
    rebook() {
      const sid = this.order?.chargingStationID || this.order?.chargingStationId || this.order?.chargingstationId
      if (!sid) {
        uni.showToast({ title: '订单缺少站点信息', icon: 'none' })
        return
      }
      uni.navigateTo({
        url: `/pages/order-create/index?stationId=${sid}`
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
  padding: 20rpx;
  box-sizing: border-box;
}

.header-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 20rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-size: 32rpx;
  font-weight: 700;
  color: #111827;
}

.status {
  font-size: 24rpx;
  color: #16a34a;
  background: #ecfdf3;
  border-radius: 999rpx;
  padding: 6rpx 16rpx;
}

.detail-card {
  background: #fff;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-top: 14rpx;
}

.row {
  margin-top: 10rpx;
  display: flex;
  justify-content: space-between;
  gap: 18rpx;
}

.label {
  color: #6b7280;
  font-size: 24rpx;
}

.value {
  color: #111827;
  font-size: 24rpx;
  text-align: right;
}

.btns {
  margin-top: 16rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.btn {
  flex: 1;
  min-width: 200rpx;
  height: 78rpx;
  line-height: 78rpx;
  border: none;
  border-radius: 10rpx;
  font-size: 24rpx;
}

.btn::after {
  border: none;
}

.btn.primary {
  background: #16a34a;
  color: #fff;
}

.btn.plain {
  background: #f3f4f6;
  color: #374151;
}

.btn.ghost {
  background: #fff;
  color: #374151;
  border: 1rpx solid #d1d5db;
}

.btn.danger {
  background: #ef4444;
  color: #fff;
}
</style>
