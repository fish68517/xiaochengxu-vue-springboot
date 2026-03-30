<template>
  <view class="page">
    <view class="summary-card">
      <view>
        <text class="summary-title">购物车</text>
        <text class="summary-desc">已选 {{ selectedItems.length }} 项，共 {{ selectedQuantity }} 份</text>
      </view>
      <button class="ghost-btn" @tap="clearCart">清空</button>
    </view>

    <view v-if="loading" class="status-card">正在加载购物车...</view>

    <view v-else-if="!cartItems.length" class="empty-card">
      <text class="empty-title">购物车还是空的</text>
      <text class="empty-desc">先去首页挑选几道菜，再回来统一结算。</text>
      <button class="primary-btn" @tap="goHome">去逛逛</button>
    </view>

    <view v-else>
      <view class="toolbar">
        <view class="select-all" @tap="toggleSelectAll">
          <view :class="['checkbox', { active: isAllSelected }]"></view>
          <text class="toolbar-text">全选</text>
        </view>

        <view class="remark-list">
          <view
            v-for="item in remarkOptions"
            :key="item"
            :class="['remark-chip', { active: remarkTemplates.includes(item) }]"
            @tap="toggleRemark(item)"
          >
            {{ item }}
          </view>
        </view>
      </view>

      <view class="cart-list">
        <view v-for="item in cartItems" :key="item.id" class="cart-card">
          <view class="card-head">
            <view class="select-all" @tap="toggleItem(item.id)">
              <view :class="['checkbox', { active: isSelected(item.id) }]"></view>
            </view>

            <image
              v-if="getImageUrl(item.recipe?.image)"
              class="cover"
              :src="getImageUrl(item.recipe?.image)"
              mode="aspectFill"
            />
            <view v-else class="cover placeholder">暂无图片</view>

            <view class="content">
              <view class="name-row">
                <text class="name">{{ item.recipe?.name || '未命名菜品' }}</text>
                <text class="price">￥{{ formatPrice(item.recipe?.price) }}</text>
              </view>

              <text class="desc">{{ item.recipe?.description || '暂无菜品描述' }}</text>

              <view class="bottom-row">
                <view class="stepper">
                  <view class="step-btn" @tap="changeQuantity(item, -1)">-</view>
                  <text class="count">{{ item.quantity }}</text>
                  <view class="step-btn solid" @tap="changeQuantity(item, 1)">+</view>
                </view>

                <button class="link-btn danger" @tap="removeItem(item.id)">删除</button>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="cartItems.length" class="footer-bar">
      <view class="footer-info">
        <text class="footer-price">￥{{ formatPrice(selectedAmount) }}</text>
        <text class="footer-desc">备注：{{ remarkPreview }}</text>
      </view>
      <button class="primary-btn footer-btn" @tap="createOrder">提交订单</button>
    </view>
  </view>
</template>

<script>
import { cartApi } from '../../api/modules/cart'
import { orderApi } from '../../api/modules/order'
import { ensureLoggedIn } from '../../utils/auth'
import { getImageUrl } from '../../utils/image'
import { toList } from '../../utils/response'

export default {
  data() {
    return {
      loading: false,
      cartItems: [],
      selectedIds: [],
      remarkTemplates: [],
      remarkOptions: ['少辣', '多菜', '可打包', '不要香菜']
    }
  },
  onShow() {
    if (!ensureLoggedIn()) return
    this.loadCart()
  },
  computed: {
    selectedItems() {
      return this.cartItems.filter((item) => this.selectedIds.includes(item.id))
    },
    selectedQuantity() {
      return this.selectedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    },
    selectedAmount() {
      return this.selectedItems.reduce((sum, item) => {
        const price = Number(item.recipe?.price || 0)
        const quantity = Number(item.quantity || 0)
        return sum + price * quantity
      }, 0)
    },
    isAllSelected() {
      return this.cartItems.length > 0 && this.selectedIds.length === this.cartItems.length
    },
    remarkPreview() {
      return this.remarkTemplates.length ? this.remarkTemplates.join(' / ') : '无'
    }
  },
  methods: {
    getImageUrl,
    formatPrice(price) {
      const value = Number(price || 0)
      return Number.isNaN(value) ? '0.00' : value.toFixed(2)
    },
    async loadCart() {
      this.loading = true
      try {
        this.cartItems = toList(await cartApi.getCartList())
        this.selectedIds = this.cartItems.map((item) => item.id)
      } catch (error) {
        // request layer handled toast
      } finally {
        this.loading = false
      }
    },
    goHome() {
      uni.switchTab({
        url: '/pages/home/index'
      })
    },
    isSelected(id) {
      return this.selectedIds.includes(id)
    },
    toggleItem(id) {
      if (this.isSelected(id)) {
        this.selectedIds = this.selectedIds.filter((itemId) => itemId !== id)
        return
      }
      this.selectedIds = [...this.selectedIds, id]
    },
    toggleSelectAll() {
      this.selectedIds = this.isAllSelected ? [] : this.cartItems.map((item) => item.id)
    },
    toggleRemark(value) {
      if (this.remarkTemplates.includes(value)) {
        this.remarkTemplates = this.remarkTemplates.filter((item) => item !== value)
        return
      }
      this.remarkTemplates = [...this.remarkTemplates, value]
    },
    async changeQuantity(item, delta) {
      const nextValue = Math.max(1, Number(item.quantity || 1) + delta)
      if (nextValue === item.quantity) return

      const previousValue = item.quantity
      item.quantity = nextValue

      try {
        await cartApi.updateCartItem(item.id, { quantity: nextValue })
      } catch (error) {
        item.quantity = previousValue
      }
    },
    removeItem(id) {
      uni.showModal({
        title: '确认删除',
        content: '确定要移除这道菜吗？',
        success: async (result) => {
          if (!result.confirm) return

          try {
            await cartApi.removeFromCart(id)
            this.cartItems = this.cartItems.filter((item) => item.id !== id)
            this.selectedIds = this.selectedIds.filter((itemId) => itemId !== id)
          } catch (error) {
            // request layer handled toast
          }
        }
      })
    },
    clearCart() {
      if (!this.cartItems.length) return

      uni.showModal({
        title: '清空购物车',
        content: '确定清空当前购物车吗？',
        success: async (result) => {
          if (!result.confirm) return

          try {
            await cartApi.clearCart()
            this.cartItems = []
            this.selectedIds = []
            this.remarkTemplates = []
          } catch (error) {
            // request layer handled toast
          }
        }
      })
    },
    async createOrder() {
      if (!this.selectedItems.length) {
        uni.showToast({
          title: '请先选择菜品',
          icon: 'none'
        })
        return
      }

      try {
        await orderApi.createOrder({
          items: this.selectedItems.map((item) => ({
            recipeId: item.recipeId,
            quantity: item.quantity
          })),
          cartItemIds: this.selectedItems.map((item) => item.id),
          remark: this.remarkTemplates.join(' / ')
        })

        uni.showToast({
          title: '下单成功',
          icon: 'success'
        })

        this.remarkTemplates = []
        await this.loadCart()
        uni.switchTab({
          url: '/pages/orders/index'
        })
      } catch (error) {
        // request layer handled toast
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 24rpx 24rpx 188rpx;
}

.summary-card,
.status-card,
.empty-card,
.toolbar,
.cart-card {
  border: 1rpx solid rgba(234, 215, 196, 0.95);
  border-radius: 28rpx;
  background: $panel-bg;
  box-shadow: $shadow-soft;
}

.summary-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 26rpx;
}

.summary-title {
  display: block;
  color: $text-primary;
  font-size: 36rpx;
  font-weight: 700;
}

.summary-desc {
  display: block;
  margin-top: 10rpx;
  color: $text-secondary;
  font-size: 24rpx;
}

.ghost-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 112rpx;
  height: 64rpx;
  padding: 0 18rpx;
  border: 1rpx solid rgba(217, 119, 6, 0.22);
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.76);
  color: $brand-primary;
  font-size: 24rpx;
}

.status-card,
.empty-card {
  margin-top: 24rpx;
  padding: 44rpx 28rpx;
  text-align: center;
}

.empty-title {
  display: block;
  color: $text-primary;
  font-size: 32rpx;
  font-weight: 700;
}

.empty-desc {
  display: block;
  margin-top: 14rpx;
  color: $text-secondary;
  line-height: 1.7;
}

.toolbar {
  margin-top: 24rpx;
  padding: 24rpx;
}

.select-all {
  display: inline-flex;
  align-items: center;
  gap: 12rpx;
}

.checkbox {
  width: 34rpx;
  height: 34rpx;
  border: 2rpx solid $border-color;
  border-radius: 10rpx;
  background: #fff;
}

.checkbox.active {
  border-color: $brand-primary;
  background: linear-gradient(135deg, $brand-primary 0%, $brand-secondary 100%);
}

.toolbar-text {
  color: $text-primary;
  font-size: 26rpx;
}

.remark-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 20rpx;
}

.remark-chip {
  padding: 14rpx 18rpx;
  border-radius: 999rpx;
  background: #fff8f0;
  border: 1rpx solid $border-color;
  color: $text-secondary;
  font-size: 24rpx;
}

.remark-chip.active {
  background: rgba(217, 119, 6, 0.12);
  border-color: rgba(217, 119, 6, 0.2);
  color: $brand-primary;
}

.cart-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 18rpx;
}

.cart-card {
  padding: 20rpx;
}

.card-head {
  display: flex;
  gap: 16rpx;
}

.cover {
  width: 170rpx;
  height: 170rpx;
  border-radius: 22rpx;
  flex-shrink: 0;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: $panel-strong;
  color: $text-light;
  font-size: 24rpx;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.name-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.name {
  flex: 1;
  color: $text-primary;
  font-size: 30rpx;
  font-weight: 700;
  line-height: 1.5;
}

.price {
  color: $brand-secondary;
  font-size: 30rpx;
  font-weight: 700;
}

.desc {
  margin-top: 10rpx;
  color: $text-secondary;
  font-size: 24rpx;
  line-height: 1.7;
}

.bottom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: auto;
  padding-top: 16rpx;
}

.stepper {
  display: inline-flex;
  align-items: center;
  gap: 12rpx;
}

.step-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
  border-radius: 16rpx;
  background: #fff7ee;
  border: 1rpx solid $border-color;
  color: $brand-primary;
  font-size: 30rpx;
  font-weight: 700;
}

.step-btn.solid {
  background: $text-primary;
  border-color: $text-primary;
  color: #fff8f0;
}

.count {
  min-width: 36rpx;
  text-align: center;
  color: $text-primary;
  font-size: 28rpx;
  font-weight: 700;
}

.link-btn {
  color: $brand-primary;
  font-size: 24rpx;
}

.link-btn.danger {
  color: $danger-color;
}

.footer-bar {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: 32rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 20rpx 22rpx;
  border-radius: 28rpx;
  background: rgba(47, 36, 29, 0.96);
  box-shadow: 0 26rpx 50rpx rgba(47, 36, 29, 0.2);
}

.footer-info {
  flex: 1;
}

.footer-price {
  display: block;
  color: #fff7ee;
  font-size: 34rpx;
  font-weight: 700;
}

.footer-desc {
  display: block;
  margin-top: 8rpx;
  color: rgba(255, 247, 238, 0.76);
  font-size: 22rpx;
}

.primary-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 180rpx;
  height: 84rpx;
  padding: 0 24rpx;
  border-radius: 24rpx;
  background: linear-gradient(135deg, $brand-primary 0%, $brand-secondary 100%);
  color: #fff7ee;
  font-size: 28rpx;
  font-weight: 700;
}

.footer-btn {
  min-width: 220rpx;
}
</style>
