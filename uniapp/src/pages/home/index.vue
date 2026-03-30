<template>
  <view class="page">
    <view class="hero-card">
      <view class="hero-top">
        <view>
          <text class="hero-greeting">你好，{{ displayName }}</text>
          <text class="hero-title">今天吃点什么</text>
        </view>
        <button class="ghost-btn" @tap="handleLogout">退出</button>
      </view>

      <view class="search-bar">
        <input
          v-model="searchKey"
          class="search-input"
          type="text"
          placeholder="搜索菜品名称"
          confirm-type="search"
          @confirm="handleSearch"
        />
        <button class="search-btn" @tap="handleSearch">搜索</button>
      </view>

      <view class="quick-grid">
        <view class="quick-item" @tap="openFavorites">
          <text class="quick-title">我的收藏</text>
          <text class="quick-desc">查看高频选择的菜品</text>
        </view>
        <view class="quick-item accent" @tap="openRecommend">
          <text class="quick-title">智能推荐</text>
          <text class="quick-desc">按个人偏好快速筛选</text>
        </view>
      </view>
    </view>

    <view class="section" v-if="hotRecipes.length">
      <view class="section-head">
        <text class="section-title">热门推荐</text>
        <button class="text-btn" @tap="refreshAll">刷新</button>
      </view>

      <swiper class="hot-swiper" circular autoplay interval="3500" duration="500">
        <swiper-item v-for="item in hotRecipes" :key="item.id">
          <view class="hot-card" @tap="goDetail(item)">
            <image
              v-if="getImageUrl(item.image)"
              class="hot-image"
              :src="getImageUrl(item.image)"
              mode="aspectFill"
            />
            <view v-else class="hot-image hot-placeholder">暂无图片</view>
            <view class="hot-info">
              <text class="hot-name">{{ item.name }}</text>
              <text class="hot-desc">{{ item.description || '暂无菜品描述' }}</text>
            </view>
          </view>
        </swiper-item>
      </swiper>
    </view>

    <view class="section">
      <view class="section-head">
        <text class="section-title">分类筛选</text>
        <button class="text-btn" @tap="clearFilter">全部</button>
      </view>

      <scroll-view class="category-scroll" scroll-x show-scrollbar="false">
        <view class="category-list">
          <view
            v-for="item in categories"
            :key="item.id"
            :class="['category-chip', { active: selectedCategory === item.id }]"
            @tap="selectCategory(item.id)"
          >
            {{ item.name }}
          </view>
        </view>
      </scroll-view>
    </view>

    <view class="section">
      <view class="section-head">
        <text class="section-title">菜品列表</text>
        <text class="section-meta">{{ recipes.length }} 道菜</text>
      </view>

      <view v-if="loading" class="status-card">正在加载菜品...</view>
      <view v-else-if="!recipes.length" class="status-card">暂无符合条件的菜品</view>

      <view v-else class="recipe-list">
        <view v-for="item in recipes" :key="item.id" class="recipe-card" @tap="goDetail(item)">
          <image
            v-if="getImageUrl(item.image)"
            class="recipe-image"
            :src="getImageUrl(item.image)"
            mode="aspectFill"
          />
          <view v-else class="recipe-image recipe-placeholder">暂无图片</view>

          <view class="recipe-content">
            <view class="recipe-head">
              <text class="recipe-name">{{ item.name }}</text>
              <text class="recipe-price">￥{{ formatPrice(item.price) }}</text>
            </view>

            <text class="recipe-desc">{{ item.description || '暂无菜品描述' }}</text>

            <text class="recipe-wait" v-if="getWindowName(item.windowId || item.categoryId)">
              {{ getWindowName(item.windowId || item.categoryId) }} 当前排队 {{ getWaitingCount(item.windowId || item.categoryId) }} 人
            </text>

            <view class="recipe-actions">
              <view
                :class="['pill-action', { danger: item.isFavorite }]"
                @tap.stop="toggleFavorite(item)"
              >
                {{ item.isFavorite ? '已收藏' : '收藏' }}
              </view>
              <view class="pill-action solid" @tap.stop="goDetail(item)">
                查看详情
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { favoriteApi } from '../../api/modules/favorite'
import { orderApi } from '../../api/modules/order'
import { recipeApi } from '../../api/modules/recipe'
import { recommendApi } from '../../api/modules/recommend'
import { userApi } from '../../api/modules/user'
import { windowApi } from '../../api/modules/window'
import { ensureLoggedIn } from '../../utils/auth'
import { getImageUrl } from '../../utils/image'
import { clearAuth, getUserInfo } from '../../utils/storage'
import { toBool, toList, toMap } from '../../utils/response'

export default {
  data() {
    return {
      loading: false,
      searchKey: '',
      selectedCategory: null,
      categories: [],
      recipes: [],
      hotRecipes: [],
      waitingMap: {},
      windowMap: {},
      userInfo: {}
    }
  },
  onLoad() {
    this.guardLogin()
  },
  onShow() {
    if (!this.guardLogin()) return
    this.userInfo = getUserInfo()
    this.refreshAll()
  },
  onPullDownRefresh() {
    this.refreshAll().finally(() => {
      uni.stopPullDownRefresh()
    })
  },
  computed: {
    displayName() {
      return this.userInfo.nickname || this.userInfo.username || '用户'
    }
  },
  methods: {
    getImageUrl,
    guardLogin() {
      return ensureLoggedIn()
    },
    formatPrice(price) {
      const value = Number(price || 0)
      return Number.isNaN(value) ? '0.00' : value.toFixed(2)
    },
    getWaitingCount(windowId) {
      if (!windowId) return 0
      return this.waitingMap[windowId] || 0
    },
    getWindowName(windowId) {
      if (!windowId) return ''
      return this.windowMap[windowId] || `窗口${windowId}`
    },
    async refreshFavoriteStatus(list) {
      if (!list.length) return list

      await Promise.all(
        list.map(async (item) => {
          try {
            item.isFavorite = toBool(await favoriteApi.checkFavorite(item.id))
          } catch (error) {
            item.isFavorite = false
          }
        })
      )

      return list
    },
    async getCategories() {
      const list = toList(await recipeApi.getCategories())
      this.categories = list
    },
    async getRecipes(categoryId = null) {
      this.loading = true

      try {
        let response

        if (categoryId) {
          response = await recipeApi.getRecipesByCategory(categoryId)
        } else {
          response = await recipeApi.getRecipeList({
            page: 1,
            pageSize: 50
          })
        }

        const list = toList(response)
        this.recipes = await this.refreshFavoriteStatus(list)
      } finally {
        this.loading = false
      }
    },
    async getHotRecipes() {
      this.hotRecipes = toList(await recommendApi.getHotRecipes())
    },
    async getWindows() {
      const list = toList(await windowApi.getWindows())
      const map = {}
      list.forEach((item) => {
        map[item.id] = item.name
      })
      this.windowMap = map
    },
    async getWaitingMap() {
      this.waitingMap = toMap(await orderApi.getWaitingCount())
    },
    async refreshAll() {
      try {
        await Promise.all([
          this.getCategories(),
          this.getHotRecipes(),
          this.getWindows(),
          this.getWaitingMap()
        ])
        await this.getRecipes(this.selectedCategory)
      } catch (error) {
        // request layer already handled toast
      }
    },
    async handleSearch() {
      const keyword = this.searchKey.trim()

      if (!keyword) {
        await this.getRecipes(this.selectedCategory)
        return
      }

      this.loading = true

      try {
        const list = toList(await recipeApi.searchRecipes(keyword))
        this.recipes = await this.refreshFavoriteStatus(list)
      } catch (error) {
        // request layer already handled toast
      } finally {
        this.loading = false
      }
    },
    clearFilter() {
      this.selectedCategory = null
      this.searchKey = ''
      this.getRecipes()
    },
    selectCategory(categoryId) {
      this.selectedCategory = categoryId
      this.searchKey = ''
      this.getRecipes(categoryId)
    },
    async toggleFavorite(item) {
      try {
        if (item.isFavorite) {
          await favoriteApi.removeFavorite(item.id)
          item.isFavorite = false
          uni.showToast({
            title: '已取消收藏',
            icon: 'none'
          })
        } else {
          await favoriteApi.addFavorite(item.id)
          item.isFavorite = true
          uni.showToast({
            title: '收藏成功',
            icon: 'success'
          })
        }
      } catch (error) {
        // request layer already handled toast
      }
    },
    goDetail(item) {
      uni.navigateTo({
        url: `/pages/recipe/detail?id=${item.id}`
      })
    },
    openFavorites() {
      uni.navigateTo({
        url: '/pages/favorites/index'
      })
    },
    openRecommend() {
      uni.navigateTo({
        url: '/pages/recommend/index'
      })
    },
    handleLogout() {
      uni.showModal({
        title: '确认退出',
        content: '是否退出当前登录状态？',
        success: async (result) => {
          if (!result.confirm) return

          try {
            await userApi.logout()
          } catch (error) {
            // ignore backend logout failure
          } finally {
            clearAuth()
            uni.reLaunch({
              url: '/pages/auth/login'
            })
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

.hero-card,
.section,
.recipe-card,
.hot-card,
.status-card {
  border: 1rpx solid rgba(234, 215, 196, 0.95);
  border-radius: 28rpx;
  background: $panel-bg;
  box-shadow: $shadow-soft;
}

.hero-card {
  padding: 28rpx;
  background:
    radial-gradient(circle at top right, rgba(255, 213, 168, 0.78), transparent 36%),
    linear-gradient(135deg, #fff8f0 0%, #fff2e1 100%);
}

.hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.hero-greeting {
  display: block;
  color: $text-secondary;
  font-size: 24rpx;
}

.hero-title {
  display: block;
  margin-top: 8rpx;
  color: $text-primary;
  font-size: 46rpx;
  font-weight: 700;
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
  background: rgba(255, 255, 255, 0.7);
  color: $brand-primary;
  font-size: 24rpx;
}

.search-bar {
  display: flex;
  gap: 16rpx;
  margin-top: 28rpx;
}

.search-input {
  flex: 1;
  height: 84rpx;
  padding: 0 24rpx;
  border-radius: 22rpx;
  background: #fffdf9;
  color: $text-primary;
  border: 1rpx solid rgba(234, 215, 196, 0.95);
}

.search-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 138rpx;
  height: 84rpx;
  border-radius: 22rpx;
  background: linear-gradient(135deg, $brand-primary 0%, $brand-secondary 100%);
  color: #fff7ee;
  font-size: 28rpx;
  font-weight: 700;
}

.quick-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
  margin-top: 22rpx;
}

.quick-item {
  padding: 22rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.76);
  border: 1rpx solid rgba(234, 215, 196, 0.9);
}

.quick-item.accent {
  background: rgba(255, 244, 230, 0.96);
}

.quick-title {
  display: block;
  color: $text-primary;
  font-size: 28rpx;
  font-weight: 700;
}

.quick-desc {
  display: block;
  margin-top: 8rpx;
  color: $text-secondary;
  font-size: 22rpx;
  line-height: 1.6;
}

.section {
  margin-top: 24rpx;
  padding: 24rpx;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.section-title {
  color: $text-primary;
  font-size: 32rpx;
  font-weight: 700;
}

.section-meta {
  color: $text-light;
  font-size: 24rpx;
}

.text-btn {
  color: $brand-primary;
  font-size: 24rpx;
}

.hot-swiper {
  height: 320rpx;
}

.hot-card {
  height: 100%;
  overflow: hidden;
}

.hot-image {
  width: 100%;
  height: 188rpx;
}

.hot-placeholder,
.recipe-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: $panel-strong;
  color: $text-light;
  font-size: 24rpx;
}

.hot-info {
  padding: 20rpx 22rpx;
}

.hot-name {
  display: block;
  color: $text-primary;
  font-size: 30rpx;
  font-weight: 700;
}

.hot-desc {
  display: block;
  margin-top: 10rpx;
  color: $text-secondary;
  font-size: 24rpx;
  line-height: 1.6;
}

.category-scroll {
  white-space: nowrap;
}

.category-list {
  display: inline-flex;
  gap: 16rpx;
}

.category-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 68rpx;
  padding: 0 28rpx;
  border-radius: 999rpx;
  background: #fff8f0;
  border: 1rpx solid $border-color;
  color: $text-secondary;
  font-size: 24rpx;
}

.category-chip.active {
  background: linear-gradient(135deg, $brand-primary 0%, $brand-secondary 100%);
  border-color: transparent;
  color: #fff7ee;
}

.status-card {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180rpx;
  color: $text-secondary;
}

.recipe-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.recipe-card {
  display: flex;
  overflow: hidden;
}

.recipe-image {
  width: 220rpx;
  height: 220rpx;
  flex-shrink: 0;
}

.recipe-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 22rpx;
}

.recipe-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.recipe-name {
  flex: 1;
  color: $text-primary;
  font-size: 30rpx;
  font-weight: 700;
  line-height: 1.5;
}

.recipe-price {
  color: $brand-secondary;
  font-size: 30rpx;
  font-weight: 700;
}

.recipe-desc {
  margin-top: 12rpx;
  color: $text-secondary;
  font-size: 24rpx;
  line-height: 1.7;
}

.recipe-wait {
  margin-top: 12rpx;
  color: $brand-primary;
  font-size: 22rpx;
}

.recipe-actions {
  display: flex;
  gap: 14rpx;
  margin-top: auto;
  padding-top: 18rpx;
}

.pill-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 124rpx;
  height: 60rpx;
  padding: 0 18rpx;
  border: 1rpx solid rgba(217, 119, 6, 0.2);
  border-radius: 999rpx;
  background: rgba(255, 248, 240, 0.8);
  color: $brand-primary;
  font-size: 24rpx;
}

.pill-action.solid {
  background: $text-primary;
  border-color: $text-primary;
  color: #fff8f0;
}

.pill-action.danger {
  background: rgba(194, 65, 12, 0.1);
  border-color: rgba(194, 65, 12, 0.16);
  color: $danger-color;
}
</style>
