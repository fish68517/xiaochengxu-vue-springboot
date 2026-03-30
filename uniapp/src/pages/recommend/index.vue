<template>
  <view class="page">
    <view class="header-card">
      <text class="page-title">为你推荐</text>
      <text class="page-desc">根据个人偏好和交互记录，筛出更适合你的菜品。</text>
      <button class="ghost-btn" @tap="reloadRecommendations">换一批</button>
    </view>

    <view class="filter-panel">
      <view class="filter-group">
        <text class="filter-title">口味偏好</text>
        <view class="chip-list">
          <view
            v-for="item in tasteOptions"
            :key="item"
            :class="['chip', { active: filters.taste === item }]"
            @tap="toggleFilter('taste', item)"
          >
            {{ item }}
          </view>
        </view>
      </view>

      <view class="filter-group">
        <text class="filter-title">菜系</text>
        <view class="chip-list">
          <view
            v-for="item in cuisineOptions"
            :key="item"
            :class="['chip', { active: filters.cuisineType === item }]"
            @tap="toggleFilter('cuisineType', item)"
          >
            {{ item }}
          </view>
        </view>
      </view>

      <view class="filter-group">
        <text class="filter-title">烹饪方式</text>
        <view class="chip-list">
          <view
            v-for="item in cookingMethodOptions"
            :key="item"
            :class="['chip', { active: filters.cookingMethod === item }]"
            @tap="toggleFilter('cookingMethod', item)"
          >
            {{ item }}
          </view>
        </view>
      </view>

      <view class="filter-group">
        <text class="filter-title">难度</text>
        <view class="chip-list">
          <view
            v-for="item in difficultyOptions"
            :key="item"
            :class="['chip', { active: filters.difficulty === item }]"
            @tap="toggleFilter('difficulty', item)"
          >
            {{ item }}
          </view>
        </view>
      </view>
    </view>

    <view v-if="loading" class="status-card">正在加载推荐...</view>
    <view v-else-if="!recommendedRecipes.length" class="status-card">没有匹配当前条件的菜品</view>

    <view v-else class="card-list">
      <view v-for="item in recommendedRecipes" :key="item.id" class="recipe-card" @tap="goDetail(item)">
        <image
          v-if="getImageUrl(item.image)"
          class="cover"
          :src="getImageUrl(item.image)"
          mode="aspectFill"
        />
        <view v-else class="cover placeholder">暂无图片</view>

        <view class="content">
          <view class="name-row">
            <text class="name">{{ item.name }}</text>
            <text class="difficulty">{{ item.difficulty || '简单' }}</text>
          </view>
          <text class="desc">{{ item.description || '暂无菜品描述' }}</text>

          <view class="actions">
            <button
              :class="['ghost-btn', { danger: item.isFavorite }]"
              @tap.stop="toggleFavorite(item)"
            >
              {{ item.isFavorite ? '已收藏' : '收藏' }}
            </button>
            <button class="primary-btn" @tap.stop="goDetail(item)">查看详情</button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { favoriteApi } from '../../api/modules/favorite'
import { recommendApi } from '../../api/modules/recommend'
import { ensureLoggedIn } from '../../utils/auth'
import { getImageUrl } from '../../utils/image'
import { toBool, toList } from '../../utils/response'

export default {
  data() {
    return {
      loading: false,
      allRecommendedRecipes: [],
      recommendedRecipes: [],
      tasteOptions: ['清淡', '麻辣', '酸甜', '咸鲜'],
      cuisineOptions: ['川菜', '粤菜', '湘菜', '鲁菜'],
      cookingMethodOptions: ['炒', '煮', '炖', '蒸'],
      difficultyOptions: ['简单', '中等', '困难'],
      filters: {
        taste: '',
        cuisineType: '',
        cookingMethod: '',
        difficulty: ''
      }
    }
  },
  onShow() {
    if (!ensureLoggedIn()) return
    this.loadRecommendations()
  },
  methods: {
    getImageUrl,
    async loadRecommendations() {
      this.loading = true
      try {
        this.allRecommendedRecipes = toList(await recommendApi.getRecommendedRecipes())
        await this.refreshFavoriteStatus(this.allRecommendedRecipes)
        this.applyFilters()
      } catch (error) {
        // request layer handled toast
      } finally {
        this.loading = false
      }
    },
    async refreshFavoriteStatus(list) {
      await Promise.all(
        list.map(async (item) => {
          try {
            item.isFavorite = toBool(await favoriteApi.checkFavorite(item.id))
          } catch (error) {
            item.isFavorite = false
          }
        })
      )
    },
    toggleFilter(field, value) {
      this.filters[field] = this.filters[field] === value ? '' : value
      this.applyFilters()
    },
    applyFilters() {
      let result = [...this.allRecommendedRecipes]

      if (this.filters.taste) {
        result = result.filter((item) => String(item.taste || '').includes(this.filters.taste))
      }

      if (this.filters.cuisineType) {
        result = result.filter((item) => item.cuisine_type === this.filters.cuisineType)
      }

      if (this.filters.cookingMethod) {
        result = result.filter((item) => item.cooking_method === this.filters.cookingMethod)
      }

      if (this.filters.difficulty) {
        result = result.filter((item) => item.difficulty === this.filters.difficulty)
      }

      this.recommendedRecipes = result
    },
    reloadRecommendations() {
      this.filters = {
        taste: '',
        cuisineType: '',
        cookingMethod: '',
        difficulty: ''
      }
      this.loadRecommendations()
    },
    async toggleFavorite(item) {
      try {
        if (item.isFavorite) {
          await favoriteApi.removeFavorite(item.id)
          item.isFavorite = false
        } else {
          await favoriteApi.addFavorite(item.id)
          item.isFavorite = true
        }
      } catch (error) {
        // request layer handled toast
      }
    },
    goDetail(item) {
      uni.navigateTo({
        url: `/pages/recipe/detail?id=${item.id}`
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
.filter-panel,
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

.ghost-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 132rpx;
  height: 64rpx;
  margin-top: 18rpx;
  padding: 0 18rpx;
  border-radius: 18rpx;
  border: 1rpx solid rgba(217, 119, 6, 0.22);
  background: rgba(255, 255, 255, 0.76);
  color: $brand-primary;
  font-size: 24rpx;
}

.ghost-btn.danger {
  color: $danger-color;
  border-color: rgba(194, 65, 12, 0.16);
}

.filter-panel {
  margin-top: 20rpx;
  padding: 24rpx;
}

.filter-group + .filter-group {
  margin-top: 18rpx;
}

.filter-title {
  display: block;
  margin-bottom: 12rpx;
  color: $text-primary;
  font-size: 26rpx;
  font-weight: 700;
}

.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.chip {
  padding: 14rpx 18rpx;
  border-radius: 999rpx;
  background: #fff8f0;
  border: 1rpx solid $border-color;
  color: $text-secondary;
  font-size: 24rpx;
}

.chip.active {
  background: rgba(217, 119, 6, 0.12);
  border-color: rgba(217, 119, 6, 0.2);
  color: $brand-primary;
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

.name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}

.name {
  color: $text-primary;
  font-size: 30rpx;
  font-weight: 700;
}

.difficulty {
  color: $brand-primary;
  font-size: 22rpx;
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

.primary-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 132rpx;
  height: 64rpx;
  padding: 0 18rpx;
  border-radius: 18rpx;
  background: linear-gradient(135deg, $brand-primary 0%, $brand-secondary 100%);
  color: #fff7ee;
  font-size: 24rpx;
  font-weight: 700;
}
</style>
