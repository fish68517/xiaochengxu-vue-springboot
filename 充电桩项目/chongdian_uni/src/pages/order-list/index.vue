<template>
  <view class="page">
    <view class="top">
      <view class="title">我的订单</view>
      <button class="back-btn" @tap="goHome">返回首页</button>
    </view>

    <view class="tabs">
      <view
        v-for="tab in tabs"
        :key="tab.value"
        class="tab"
        :class="{ active: activeTab === tab.value }"
        @tap="activeTab = tab.value"
      >
        {{ tab.label }}
      </view>
    </view>

    <scroll-view class="list" scroll-y>
      <view v-for="item in filteredOrders" :key="item.id" class="card">
        <view class="row strong">
          <text>#{{ item.id }}</text>
          <text>{{ statusText(item.state) }}</text>
        </view>
        <view class="row">站点：{{ stationName(item) }}</view>
        <view class="row">金额：¥{{ item.orderPrice || 0 }}</view>
        <view class="row">时长：{{ item.chargingTime || 0 }} 小时</view>
        <view class="row">创建：{{ item.createTime || '-' }}</view>

        <view class="actions" v-if="Number(item.state) === 0">
          <button class="btn plain" @tap="goDetail(item)">详情</button>
          <button class="btn plain" @tap="markCompleted(item)">完成</button>
          <button class="btn danger" @tap="cancelOrder(item)">取消订单</button>
        </view>
        <view class="actions" v-else>
          <button class="btn plain" @tap="goDetail(item)">详情</button>
          <button class="btn plain" @tap="rebook(item)">再次预约</button>
        </view>
      </view>
      <view v-if="!filteredOrders.length" class="empty">当前分类下暂无订单</view>
    </scroll-view>
  </view>
</template>

<script>
import { USER_KEY } from '../../common/config'
import { fetchOrderList, updateOrder } from '../../api/order'
import { fetchStations, updateStump } from '../../api/station'

export default {
  data() {
    return {
      userId: '',
      activeTab: 'pending',
      tabs: [
        { value: 'pending', label: '待充电' },
        { value: 'completed', label: '已完成' },
        { value: 'cancelled', label: '已取消' }
      ],
      orders: [],
      stationMap: {}
    }
  },
  computed: {
    filteredOrders() {
      if (this.activeTab === 'pending') {
        return this.orders.filter((o) => Number(o.state) === 0)
      }
      if (this.activeTab === 'completed') {
        return this.orders.filter((o) => Number(o.state) === 1)
      }
      return this.orders.filter((o) => Number(o.state) === 2)
    }
  },
  onShow() {
    this.bootstrap()
  },
  methods: {
    async bootstrap() {
      const user = uni.getStorageSync(USER_KEY) || {}
      if (!user.id) {
        uni.reLaunch({ url: '/pages/login/index' })
        return
      }
      this.userId = user.id
      await this.loadAll()
    },
    async loadAll() {
      uni.showLoading({ title: '加载中...' })
      try {
        const [orderRes, stationRes] = await Promise.all([
          fetchOrderList({ userID: this.userId, pageSize: 200, orderByColumn: 'id', isAsc: 'desc' }),
          fetchStations({ pageSize: 200 })
        ])
        this.orders = orderRes.rows || []
        const map = {}
        ;(stationRes.rows || []).forEach((s) => {
          map[String(s.id)] = s.stationName || `站点#${s.id}`
        })
        this.stationMap = map
      } catch (error) {
        uni.showToast({ title: error.message || '加载失败', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    },
    statusText(state) {
      const n = Number(state)
      if (n === 1) return '已完成'
      if (n === 2) return '已取消'
      return '待充电'
    },
    stationName(order) {
      const sid = order.chargingStationID || order.chargingStationId || order.chargingstationId || ''
      return this.stationMap[String(sid)] || `站点#${sid || '-'}`
    },
    async markCompleted(order) {
      uni.showLoading({ title: '处理中...' })
      try {
        await updateOrder({ id: order.id, state: 1 })
        if (order.stumpID || order.stumpId) {
          await updateStump({ id: Number(order.stumpID || order.stumpId), occupy: 0 })
        }
        uni.showToast({ title: '已标记完成', icon: 'success' })
        await this.loadAll()
      } catch (error) {
        uni.showToast({ title: error.message || '操作失败', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    },
    cancelOrder(order) {
      uni.showModal({
        title: '提示',
        content: '确定取消该订单吗？',
        success: async (res) => {
          if (!res.confirm) return
          uni.showLoading({ title: '处理中...' })
          try {
            await updateOrder({
              id: order.id,
              state: 2,
              cancelCause: '用户主动取消'
            })
            if (order.stumpID || order.stumpId) {
              await updateStump({ id: Number(order.stumpID || order.stumpId), occupy: 0 })
            }
            uni.showToast({ title: '订单已取消', icon: 'success' })
            await this.loadAll()
          } catch (error) {
            uni.showToast({ title: error.message || '取消失败', icon: 'none' })
          } finally {
            uni.hideLoading()
          }
        }
      })
    },
    rebook(order) {
      const sid = order.chargingStationID || order.chargingStationId || order.chargingstationId
      if (!sid) {
        uni.showToast({ title: '订单缺少站点信息', icon: 'none' })
        return
      }
      uni.navigateTo({
        url: `/pages/order-create/index?stationId=${sid}`
      })
    },
    goDetail(order) {
      uni.navigateTo({
        url: `/pages/order-detail/index?id=${order.id}`
      })
    },
    goHome() {
      uni.reLaunch({
        url: '/pages/home/index'
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

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title {
  font-size: 34rpx;
  font-weight: 700;
  color: #111827;
}

.back-btn {
  height: 64rpx;
  line-height: 64rpx;
  border-radius: 10rpx;
  border: none;
  padding: 0 18rpx;
  font-size: 22rpx;
  background: #f3f4f6;
  color: #374151;
}

.back-btn::after {
  border: none;
}

.tabs {
  margin-top: 12rpx;
  display: flex;
  border-radius: 10rpx;
  overflow: hidden;
  background: #f3f4f6;
}

.tab {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  font-size: 24rpx;
  color: #6b7280;
}

.tab.active {
  background: #16a34a;
  color: #fff;
  font-weight: 600;
}

.list {
  margin-top: 14rpx;
  height: calc(100vh - 220rpx);
}

.card {
  background: #fff;
  border-radius: 12rpx;
  padding: 16rpx;
  margin-bottom: 12rpx;
}

.row {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #4b5563;
  display: flex;
  justify-content: space-between;
  gap: 10rpx;
}

.row.strong {
  color: #111827;
  font-weight: 700;
}

.actions {
  margin-top: 12rpx;
  display: flex;
  gap: 10rpx;
}

.btn {
  flex: 1;
  height: 70rpx;
  line-height: 70rpx;
  border: none;
  border-radius: 10rpx;
  font-size: 24rpx;
}

.btn::after {
  border: none;
}

.btn.plain {
  background: #f3f4f6;
  color: #374151;
}

.btn.danger {
  background: #ef4444;
  color: #fff;
}

.empty {
  text-align: center;
  color: #9ca3af;
  font-size: 24rpx;
  margin-top: 24rpx;
}
</style>
