<template>
  <view class="page">
    <view class="header-card">
      <text class="page-title">我的收藏</text>
      <text class="page-desc">把常点菜品沉淀下来，下一次下单更快。</text>
      <input
        v-model="searchKey"
        class="search-input"
        type="text"
        placeholder="搜索收藏菜品"
      />
    </view>

    <view v-if="loading" class="status-card">正在加载收藏...</view>
    <view v-else-if="!filteredFavorites.length" class="status-card">当前还没有收藏菜品</view>

    <view v-else class="card-list">
      <view v-for="item in filteredFavorites" :key="item.id" class="recipe-card">
        <image
          v-if="getImageUrl(item.recipe?.image)"
          class="cover"
          :src="getImageUrl(item.recipe?.image)"
          mode="aspectFill"
        />
        <view v-else class="cover placeholder">暂无图片</view>

        <view class="content">
          <text class="name">{{ item.recipe?.name || '未命名菜品' }}</text>
          <text class="desc">{{ item.recipe?.description || '暂无菜品描述' }}</text>

          <view class="actions">
            <button class="ghost-btn" @tap="removeFavorite(item)">取消收藏</button>
            <button class="primary-btn" @tap="quickOrder(item)">快捷下单</button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { favoriteApi } from '../../api/modules/favorite'
import { orderApi } from '../../api/modules/order'
import { ensureLoggedIn } from '../../utils/auth'
import { getImageUrl } from '../../utils/image'
import { toList } from '../../utils/response'

export default {
  data() {
    return {
      loading: false,
      searchKey: '',
      favorites: []
    }
  },
  onShow() {
    if (!ensureLoggedIn()) return
    this.loadFavorites()
  },
  computed: {
    filteredFavorites() {
      const keyword = this.searchKey.trim().toLowerCase()
      if (!keyword) return this.favorites

      return this.favorites.filter((item) => {
        const name = String(item.recipe?.name || '').toLowerCase()
        const description = String(item.recipe?.description || '').toLowerCase()
        return name.includes(keyword) || description.includes(keyword)
      })
    }
  },
  methods: {
    getImageUrl,
    async loadFavorites() {
      this.loading = true
      try {
        this.favorites = toList(await favoriteApi.getFavorites())
      } catch (error) {
        // request layer handled toast
      } finally {
        this.loading = false
      }
    },
    removeFavorite(item) {
      uni.showModal({
        title: '取消收藏',
        content: '确定取消这道菜的收藏吗？',
        success: async (result) => {
          if (!result.confirm) return

          try {
            await favoriteApi.removeFavorite(item.recipeId)
            this.favorites = this.favorites.filter((favorite) => favorite.id !== item.id)
          } catch (error) {
            // request layer handled toast
          }
        }
      })
    },
    async quickOrder(item) {
      try {
        await orderApi.createOrder({
          items: [{ recipeId: item.recipeId, quantity: 1 }]
        })

        uni.showToast({
          title: '下单成功',
          icon: 'success'
        })

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
  padding: 24rpx;
}

.header-card,
.status-card,
.recipe-card {
  border: 1rpx solid rgba(234, 215, 196, 0.95);
  border-radius: 28rpx;
  background: $panel-bg;
  box-shadow: $shadow-soft;
}

.header-card {
  padding: 24rpx;
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
  line-height: 1.6;
}

.search-input {
  width: 100%;
  height: 84rpx;
  margin-top: 18rpx;
  padding: 0 22rpx;
  border-radius: 20rpx;
  background: #fffdf9;
  border: 1rpx solid $border-color;
}

.status-card {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180rpx;
  margin-top: 20rpx;
  color: $text-secondary;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 20rpx;
}

.recipe-card {
  display: flex;
  overflow: hidden;
}

.cover {
  width: 210rpx;
  height: 210rpx;
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
  padding: 22rpx;
}

.name {
  color: $text-primary;
  font-size: 30rpx;
  font-weight: 700;
}

.desc {
  margin-top: 12rpx;
  color: $text-secondary;
  font-size: 24rpx;
  line-height: 1.7;
}

.actions {
  display: flex;
  gap: 12rpx;
  margin-top: auto;
  padding-top: 16rpx;
}

.ghost-btn,
.primary-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 132rpx;
  height: 64rpx;
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
