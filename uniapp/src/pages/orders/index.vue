<template>
  <view class="page">
    <view class="header-card">
      <text class="page-title">我的订单</text>
      <text class="page-desc">查看当前订单状态和取餐信息</text>
    </view>

    <scroll-view class="status-scroll" scroll-x show-scrollbar="false">
      <view class="status-list">
        <view
          v-for="item in statusTabs"
          :key="item.value"
          :class="['status-chip', { active: currentStatus === item.value }]"
          @tap="currentStatus = item.value"
        >
          {{ item.label }}
        </view>
      </view>
    </scroll-view>

    <view v-if="loading" class="status-card">正在加载订单...</view>
    <view v-else-if="!filteredOrders.length" class="status-card">当前没有匹配的订单</view>

    <view v-else class="order-list">
        <view v-for="order in filteredOrders" :key="order.id" class="order-card">
          <view class="order-top">
            <view>
              <text class="order-no">订单号 {{ order.orderNo || order.id }}</text>
              <text class="order-time">{{ formatTime(order.createdAt) }}</text>
            </view>
            <text :class="['order-status', getStatusClass(order.status)]">{{ displayStatus(order.status) }}</text>
          </view>

        <view v-if="shouldShowPickupCode(order)" class="pickup-box">
          <text class="pickup-label">取餐码</text>
          <text class="pickup-code">{{ order.pickupCode || '-' }}</text>
        </view>

        <view v-if="order.remark" class="remark-box">备注：{{ order.remark }}</view>

        <view class="item-list">
          <view v-for="detail in order.orderDetails || []" :key="detail.id" class="item-row">
            <image
              v-if="getImageUrl(detail.recipe?.image)"
              class="item-cover"
              :src="getImageUrl(detail.recipe?.image)"
              mode="aspectFill"
            />
            <view v-else class="item-cover placeholder">暂无图片</view>

            <view class="item-content">
              <text class="item-name">{{ detail.recipe?.name || '未命名菜品' }}</text>
              <text class="item-meta">数量 x {{ detail.quantity }}</text>
              <button
                v-if="isPaidOrder(order.status) || isDoneOrder(order.status)"
                class="review-link"
                @tap="goReview(detail)"
              >
                去评价
              </button>
            </view>
          </view>
        </view>

        <view class="order-bottom">
          <text class="order-total">合计 ￥{{ formatPrice(order.totalAmount) }}</text>
          <view class="order-actions">
            <button
              v-if="isPendingOrder(order.status)"
              class="ghost-btn"
              @tap="cancelOrder(order)"
            >
              取消订单
            </button>
            <button
              v-if="isPendingOrder(order.status)"
              class="primary-btn"
              @tap="payOrder(order)"
            >
              立即支付
            </button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { orderApi } from '../../api/modules/order'
import { ensureLoggedIn } from '../../utils/auth'
import { getImageUrl } from '../../utils/image'
import { toList } from '../../utils/response'
import {
  BACKEND_ORDER_STATUS,
  isDoneOrder,
  isPaidOrder,
  isPendingOrder,
  normalizeOrderStatus
} from '../../utils/order'

export default {
  data() {
    return {
      loading: false,
      orders: [],
      currentStatus: 'all',
      statusTabs: [
        { label: '全部', value: 'all' },
        { label: '待付款', value: '待付款' },
        { label: '已付款', value: '已付款' },
        { label: '已完成', value: '已完成' },
        { label: '已取消', value: '已取消' }
      ]
    }
  },
  onShow() {
    if (!ensureLoggedIn()) return
    this.loadOrders()
  },
  computed: {
    filteredOrders() {
      if (this.currentStatus === 'all') return this.orders
      return this.orders.filter((order) => this.displayStatus(order.status) === this.currentStatus)
    }
  },
  methods: {
    getImageUrl,
    isPendingOrder,
    isPaidOrder,
    isDoneOrder,
    formatPrice(price) {
      const value = Number(price || 0)
      return Number.isNaN(value) ? '0.00' : value.toFixed(2)
    },
    formatTime(value) {
      if (!value) return '时间待补充'
      return new Date(value).toLocaleString()
    },
    displayStatus(status) {
      return normalizeOrderStatus(status)
    },
    getStatusClass(status) {
      if (isPendingOrder(status)) return 'warning'
      if (isPaidOrder(status)) return 'primary'
      if (isDoneOrder(status)) return 'success'
      return 'muted'
    },
    shouldShowPickupCode(order) {
      return isPaidOrder(order.status) || isDoneOrder(order.status)
    },
    async loadOrders() {
      this.loading = true
      try {
        this.orders = toList(await orderApi.getOrderList())
      } catch (error) {
        // request layer handled toast
      } finally {
        this.loading = false
      }
    },
    payOrder(order) {
      uni.showModal({
        title: '确认支付',
        content: '是否支付当前订单？',
        success: async (result) => {
          if (!result.confirm) return

          try {
            await orderApi.updateOrderStatus(order.id, BACKEND_ORDER_STATUS.paid)
            order.status = BACKEND_ORDER_STATUS.paid
            await this.loadOrders()
          } catch (error) {
            // request layer handled toast
          }
        }
      })
    },
    cancelOrder(order) {
      uni.showModal({
        title: '取消订单',
        content: '是否取消当前订单？',
        success: async (result) => {
          if (!result.confirm) return

          try {
            await orderApi.updateOrderStatus(order.id, BACKEND_ORDER_STATUS.canceled)
            order.status = BACKEND_ORDER_STATUS.canceled
            await this.loadOrders()
          } catch (error) {
            // request layer handled toast
          }
        }
      })
    },
    goReview(detail) {
      uni.navigateTo({
        url: `/pages/recipe/detail?id=${detail.recipeId}&review=1`
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
}

.header-card,
.status-card,
.order-card {
  border: 1rpx solid rgba(234, 215, 196, 0.95);
  border-radius: 28rpx;
  background: $panel-bg;
  box-shadow: $shadow-soft;
}

.header-card {
  padding: 26rpx;
}

.page-title {
  display: block;
  color: $text-primary;
  font-size: 36rpx;
  font-weight: 700;
}

.page-desc {
  display: block;
  margin-top: 10rpx;
  color: $text-secondary;
  font-size: 24rpx;
}

.status-scroll {
  margin-top: 20rpx;
  white-space: nowrap;
}

.status-list {
  display: inline-flex;
  gap: 14rpx;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 66rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: #fff8f0;
  border: 1rpx solid $border-color;
  color: $text-secondary;
  font-size: 24rpx;
}

.status-chip.active {
  background: linear-gradient(135deg, $brand-primary 0%, $brand-secondary 100%);
  border-color: transparent;
  color: #fff7ee;
}

.status-card {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180rpx;
  margin-top: 20rpx;
  color: $text-secondary;
}

.order-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 20rpx;
}

.order-card {
  padding: 24rpx;
}

.order-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.order-no {
  display: block;
  color: $text-primary;
  font-size: 28rpx;
  font-weight: 700;
}

.order-time {
  display: block;
  margin-top: 8rpx;
  color: $text-light;
  font-size: 22rpx;
}

.order-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 120rpx;
  height: 54rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
}

.order-status.warning {
  background: rgba(217, 119, 6, 0.12);
  color: $brand-primary;
}

.order-status.primary {
  background: rgba(59, 130, 246, 0.12);
  color: #2563eb;
}

.order-status.success {
  background: rgba(21, 128, 61, 0.12);
  color: $success-color;
}

.order-status.muted {
  background: rgba(122, 104, 92, 0.12);
  color: $text-secondary;
}

.pickup-box,
.remark-box {
  margin-top: 18rpx;
  padding: 18rpx 20rpx;
  border-radius: 20rpx;
  background: #fff8f0;
}

.pickup-label {
  display: block;
  color: $text-secondary;
  font-size: 22rpx;
}

.pickup-code {
  display: block;
  margin-top: 6rpx;
  color: $brand-secondary;
  font-size: 36rpx;
  font-weight: 700;
  letter-spacing: 3rpx;
}

.remark-box {
  color: $text-secondary;
  font-size: 24rpx;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 18rpx;
}

.item-row {
  display: flex;
  gap: 14rpx;
}

.item-cover {
  width: 120rpx;
  height: 120rpx;
  border-radius: 18rpx;
  flex-shrink: 0;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: $panel-strong;
  color: $text-light;
  font-size: 22rpx;
}

.item-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
}

.item-name {
  color: $text-primary;
  font-size: 28rpx;
  font-weight: 700;
}

.item-meta {
  margin-top: 8rpx;
  color: $text-secondary;
  font-size: 22rpx;
}

.review-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  height: 54rpx;
  margin-top: 10rpx;
  padding: 0 16rpx;
  border-radius: 16rpx;
  background: rgba(217, 119, 6, 0.12);
  color: $brand-primary;
  font-size: 22rpx;
}

.order-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 18rpx;
}

.order-total {
  color: $text-primary;
  font-size: 30rpx;
  font-weight: 700;
}

.order-actions {
  display: flex;
  gap: 12rpx;
}

.ghost-btn,
.primary-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 140rpx;
  height: 68rpx;
  padding: 0 18rpx;
  border-radius: 18rpx;
  font-size: 24rpx;
  font-weight: 700;
}

.ghost-btn {
  border: 1rpx solid $border-color;
  background: #fff8f0;
  color: $text-secondary;
}

.primary-btn {
  background: linear-gradient(135deg, $brand-primary 0%, $brand-secondary 100%);
  color: #fff7ee;
}
</style>
