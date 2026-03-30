<template>
  <view class="page">
    <view v-if="loading" class="status-card">正在加载菜品详情...</view>
    <view v-else-if="!recipe.id" class="status-card">未找到菜品详情</view>

    <view v-else>
      <view class="panel">
        <image
          v-if="getImageUrl(recipe.image)"
          class="cover"
          :src="getImageUrl(recipe.image)"
          mode="aspectFill"
        />
        <view v-else class="cover cover-placeholder">暂无图片</view>

        <view class="body">
          <view class="title-row">
            <text class="title">{{ recipe.name }}</text>
            <text class="price">￥{{ formatPrice(recipe.price) }}</text>
          </view>

          <text class="desc">{{ recipe.description || '暂无菜品描述' }}</text>

          <view class="block">
            <text class="block-title">食材</text>
            <text class="block-content">{{ recipe.ingredients || '暂无食材信息' }}</text>
          </view>

          <view class="block">
            <text class="block-title">制作步骤</text>
            <text class="block-content">{{ recipe.steps || '暂无制作步骤' }}</text>
          </view>

          <view class="action-row">
            <button class="primary-btn" @tap="addToCart">加入购物车</button>
          </view>
        </view>
      </view>

      <view class="review-panel">
        <view class="review-head">
          <view>
            <text class="review-title">用户评价</text>
            <text class="review-subtitle">{{ reviews.length }} 条评价</text>
          </view>
          <button class="ghost-btn" @tap="resetReviewForm">
            {{ editingReviewId ? '取消编辑' : '写评价' }}
          </button>
        </view>

        <view class="editor-card">
          <text class="editor-label">评分</text>
          <view class="star-row">
            <view
              v-for="star in 5"
              :key="star"
              :class="['star', { active: reviewForm.rating >= star }]"
              @tap="reviewForm.rating = star"
            >
              ★
            </view>
          </view>

          <text class="editor-label">内容</text>
          <textarea
            v-model="reviewForm.content"
            class="textarea"
            maxlength="200"
            placeholder="说说你的体验"
          />

          <button class="primary-btn" :loading="submitting" @tap="submitReview">
            {{ editingReviewId ? '更新评价' : '提交评价' }}
          </button>
        </view>

        <view v-if="reviewLoading" class="review-status">正在加载评价...</view>
        <view v-else-if="!reviews.length" class="review-status">暂时还没有评价</view>

        <view v-else class="review-list">
          <view v-for="item in reviews" :key="item.id" class="review-item">
            <view class="review-user-row">
              <view class="avatar">{{ getReviewAvatar(item) }}</view>
              <view class="review-user-meta">
                <text class="review-user-name">{{ item.user?.nickname || '用户' }}</text>
                <text class="review-time">{{ formatTime(item.createdAt) }}</text>
              </view>
              <text class="review-rating">{{ renderStars(item.rating) }}</text>
            </view>

            <text class="review-content">{{ item.content || '未填写评价内容' }}</text>

            <view v-if="isMine(item)" class="review-actions">
              <button class="ghost-btn mini" @tap="startEdit(item)">编辑</button>
              <button class="ghost-btn mini danger" @tap="deleteReview(item)">删除</button>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { cartApi } from '../../api/modules/cart'
import { recipeApi } from '../../api/modules/recipe'
import { reviewApi } from '../../api/modules/review'
import { ensureLoggedIn } from '../../utils/auth'
import { getImageUrl } from '../../utils/image'
import { getUserInfo } from '../../utils/storage'
import { pickPayload, toList } from '../../utils/response'

export default {
  data() {
    return {
      id: '',
      loading: false,
      reviewLoading: false,
      submitting: false,
      editingReviewId: null,
      recipe: {},
      reviews: [],
      reviewForm: {
        rating: 5,
        content: ''
      }
    }
  },
  onLoad(options) {
    this.id = options.id || ''
    if (!ensureLoggedIn()) return
    if (this.id) {
      this.loadDetail()
      this.loadReviews()
    }
  },
  methods: {
    getImageUrl,
    formatPrice(price) {
      const value = Number(price || 0)
      return Number.isNaN(value) ? '0.00' : value.toFixed(2)
    },
    async loadDetail() {
      this.loading = true
      try {
        this.recipe = pickPayload(await recipeApi.getRecipeById(this.id))
      } catch (error) {
        // request layer already handled toast
      } finally {
        this.loading = false
      }
    },
    async addToCart() {
      if (!this.recipe.id) return

      try {
        await cartApi.addToCart({
          recipeId: this.recipe.id,
          quantity: 1
        })

        uni.showToast({
          title: '已加入购物车',
          icon: 'success'
        })
      } catch (error) {
        // request layer already handled toast
      }
    },
    async loadReviews() {
      this.reviewLoading = true
      try {
        this.reviews = toList(await reviewApi.getRecipeReviews(this.id))
      } catch (error) {
        // request layer already handled toast
      } finally {
        this.reviewLoading = false
      }
    },
    renderStars(rating) {
      const value = Number(rating || 0)
      return '★'.repeat(value) + '☆'.repeat(Math.max(0, 5 - value))
    },
    formatTime(value) {
      if (!value) return '时间待补充'
      return new Date(value).toLocaleString()
    },
    getReviewAvatar(item) {
      const name = item.user?.nickname || 'U'
      return String(name).slice(0, 1).toUpperCase()
    },
    isMine(item) {
      const currentUser = getUserInfo()
      return Number(item.userId) === Number(currentUser.id)
    },
    resetReviewForm() {
      this.editingReviewId = null
      this.reviewForm = {
        rating: 5,
        content: ''
      }
    },
    startEdit(item) {
      this.editingReviewId = item.id
      this.reviewForm = {
        rating: Number(item.rating || 5),
        content: item.content || ''
      }
    },
    async submitReview() {
      if (!this.reviewForm.content.trim()) {
        uni.showToast({
          title: '请填写评价内容',
          icon: 'none'
        })
        return
      }

      this.submitting = true

      try {
        const payload = {
          recipeId: Number(this.id),
          rating: Number(this.reviewForm.rating || 5),
          content: this.reviewForm.content.trim()
        }

        if (this.editingReviewId) {
          await reviewApi.updateReview(this.editingReviewId, payload)
        } else {
          await reviewApi.addReview(payload)
        }

        uni.showToast({
          title: this.editingReviewId ? '评价已更新' : '评价已提交',
          icon: 'success'
        })

        this.resetReviewForm()
        await this.loadReviews()
      } catch (error) {
        // request layer already handled toast
      } finally {
        this.submitting = false
      }
    },
    deleteReview(item) {
      uni.showModal({
        title: '删除评价',
        content: '确定删除这条评价吗？',
        success: async (result) => {
          if (!result.confirm) return

          try {
            await reviewApi.deleteReview(item.id)
            uni.showToast({
              title: '已删除',
              icon: 'success'
            })
            await this.loadReviews()
          } catch (error) {
            // request layer already handled toast
          }
        }
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

.status-card,
.panel,
.review-panel {
  border: 1rpx solid rgba(234, 215, 196, 0.95);
  border-radius: 28rpx;
  background: $panel-bg;
  box-shadow: $shadow-soft;
}

.status-card {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240rpx;
  color: $text-secondary;
}

.panel {
  overflow: hidden;
}

.review-panel {
  margin-top: 20rpx;
  padding: 24rpx;
}

.cover {
  width: 100%;
  height: 420rpx;
}

.cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: $panel-strong;
  color: $text-light;
}

.body {
  padding: 28rpx;
}

.title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.title {
  flex: 1;
  color: $text-primary;
  font-size: 38rpx;
  font-weight: 700;
  line-height: 1.5;
}

.price {
  color: $brand-secondary;
  font-size: 34rpx;
  font-weight: 700;
}

.desc {
  display: block;
  margin-top: 16rpx;
  color: $text-secondary;
  line-height: 1.8;
}

.block {
  margin-top: 26rpx;
}

.block-title {
  display: block;
  color: $text-primary;
  font-size: 28rpx;
  font-weight: 700;
}

.block-content {
  display: block;
  margin-top: 12rpx;
  color: $text-secondary;
  line-height: 1.9;
  white-space: pre-wrap;
}

.action-row {
  margin-top: 28rpx;
}

.primary-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 88rpx;
  border-radius: 24rpx;
  background: linear-gradient(135deg, $brand-primary 0%, $brand-secondary 100%);
  color: #fff7ee;
  font-size: 30rpx;
  font-weight: 700;
}

.review-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.review-title {
  display: block;
  color: $text-primary;
  font-size: 30rpx;
  font-weight: 700;
}

.review-subtitle {
  display: block;
  margin-top: 8rpx;
  color: $text-secondary;
  font-size: 22rpx;
}

.ghost-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 120rpx;
  height: 64rpx;
  padding: 0 18rpx;
  border-radius: 18rpx;
  border: 1rpx solid $border-color;
  background: #fff8f0;
  color: $text-secondary;
  font-size: 24rpx;
}

.ghost-btn.mini {
  min-width: 92rpx;
  height: 54rpx;
  font-size: 22rpx;
}

.ghost-btn.danger {
  color: $danger-color;
}

.editor-card {
  margin-top: 18rpx;
  padding: 20rpx;
  border-radius: 22rpx;
  background: #fff8f0;
}

.editor-label {
  display: block;
  color: $text-primary;
  font-size: 24rpx;
  font-weight: 700;
}

.star-row {
  display: flex;
  gap: 10rpx;
  margin: 12rpx 0 20rpx;
}

.star {
  color: #d1c2b4;
  font-size: 42rpx;
}

.star.active {
  color: $brand-primary;
}

.textarea {
  width: 100%;
  min-height: 180rpx;
  margin-top: 12rpx;
  padding: 18rpx;
  border: 1rpx solid $border-color;
  border-radius: 20rpx;
  background: #fffdf9;
}

.review-status {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 140rpx;
  color: $text-secondary;
}

.review-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 16rpx;
}

.review-item {
  padding: 20rpx;
  border-radius: 22rpx;
  background: #fff8f0;
}

.review-user-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 68rpx;
  height: 68rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, $brand-primary 0%, $brand-secondary 100%);
  color: #fff7ee;
  font-size: 26rpx;
  font-weight: 700;
  flex-shrink: 0;
}

.review-user-meta {
  flex: 1;
}

.review-user-name {
  display: block;
  color: $text-primary;
  font-size: 26rpx;
  font-weight: 700;
}

.review-time {
  display: block;
  margin-top: 6rpx;
  color: $text-light;
  font-size: 20rpx;
}

.review-rating {
  color: $brand-primary;
  font-size: 24rpx;
}

.review-content {
  display: block;
  margin-top: 12rpx;
  color: $text-secondary;
  line-height: 1.8;
}

.review-actions {
  display: flex;
  gap: 10rpx;
  margin-top: 14rpx;
}
</style>
