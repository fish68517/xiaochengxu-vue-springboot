<template>
  <div class="home">
    <div class="banner">
      <h2>智能菜品推荐</h2>
      <el-input v-model="searchKey" placeholder="搜索菜品..." clearable class="search">
        <template #append>
          <el-button icon="Search" @click="searchRecipes" />
        </template>
      </el-input>
    </div>

    <el-card class="hot-carousel">
      <template #header>
        <span>热门菜品（销量前四）</span>
      </template>
      <el-carousel v-if="hotRecipes.length" height="240px" indicator-position="outside">
        <el-carousel-item v-for="item in hotRecipes" :key="item.id">
          <div class="hot-item" @click="viewRecipe(item)">
            <el-image :src="getImageUrl(item.image)" fit="cover" class="hot-image" />
            <div class="hot-info">
              <h3>{{ item.name }}</h3>
              <p>{{ item.description }}</p>
            </div>
          </div>
        </el-carousel-item>
      </el-carousel>
      <el-empty v-else description="暂无热门菜品" />
    </el-card>

    <div class="categories">
      <el-scrollbar>
        <div class="category-list">
          <el-button
            v-for="cat in categories"
            :key="cat.id"
            :type="selectedCategory === cat.id ? 'primary' : 'default'"
            @click="selectCategory(cat.id)"
          >
            {{ cat.name }}
          </el-button>
        </div>
      </el-scrollbar>
    </div>

    <div class="recipe-list">
      <el-row :gutter="20">
        <el-col v-for="recipe in recipes" :key="recipe.id" :span="6">
          <el-card class="recipe-card" :body-style="{ padding: '0px' }">
            <el-image :src="getImageUrl(recipe.image)" class="recipe-image" fit="cover" />
            <div class="recipe-info">
              <h3>{{ recipe.name }}</h3>
              <p class="description">{{ recipe.description }}</p>
              <p class="wait-count">
                {{ getWindowName(recipe.windowId || recipe.categoryId) }}：等待 {{ getWaitingCount(recipe.windowId || recipe.categoryId) }} 人
              </p>
              <div class="bottom">
                <span class="price">￥{{ formatPrice(recipe.price) }}</span>
                <div class="actions">
                  <el-button
                    :type="recipe.isFavorite ? 'danger' : 'default'"
                    link
                    @click="toggleFavorite(recipe)"
                  >
                    {{ recipe.isFavorite ? '已收藏' : '收藏' }}
                  </el-button>
                  <el-button type="primary" link @click="viewRecipe(recipe)">查看详情</el-button>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { recipeApi, recommendApi, orderApi, favoriteApi, windowApi } from '@/api/networkApi'
import { useRouter } from 'vue-router'
import { getImageUrl } from '@/utils/image'

export default {
  setup() {
    const router = useRouter()
    const searchKey = ref('')
    const categories = ref([])
    const recipes = ref([])
    const hotRecipes = ref([])
    const selectedCategory = ref(null)
    const waitingMap = ref({})
    const windowMap = ref({})
    let timer = null

    const refreshFavoriteStatus = async (list) => {
      if (!list.length) return
      await Promise.all(
        list.map(async (item) => {
          try {
            item.isFavorite = await favoriteApi.checkFavorite(item.id)
          } catch (error) {
            item.isFavorite = false
          }
        })
      )
    }

    const getCategories = async () => {
      try {
        categories.value = await recipeApi.getCategories()
      } catch (error) {
        ElMessage.error('获取分类失败')
      }
    }

    const getRecipes = async (categoryId = null) => {
      try {
        let list = []
        if (categoryId) {
          list = await recipeApi.getRecipesByCategory(categoryId)
        } else {
          const resp = await recipeApi.getRecipeList({ page: 1, pageSize: 100 })
          list = Array.isArray(resp) ? resp : (resp?.data || [])
        }
        await refreshFavoriteStatus(list)
        recipes.value = list
      } catch (error) {
        ElMessage.error('获取菜品失败')
      }
    }

    const getHotRecipes = async () => {
      try {
        hotRecipes.value = await recommendApi.getHotRecipes()
      } catch (error) {
        ElMessage.error('获取热门菜品失败')
      }
    }

    const getWindowWaiting = async () => {
      try {
        waitingMap.value = await orderApi.getWaitingCount()
      } catch (error) {
        // ignore polling errors
      }
    }

    const getWindows = async () => {
      try {
        const list = await windowApi.getWindows()
        const map = {}
        list.forEach((w) => {
          map[w.id] = w.name
        })
        windowMap.value = map
      } catch (error) {
        // keep fallback names
      }
    }

    const getWaitingCount = (windowId) => {
      if (!windowId) return 0
      return waitingMap.value?.[windowId] || 0
    }

    const getWindowName = (windowId) => {
      if (!windowId) return '默认窗口'
      return windowMap.value?.[windowId] || `窗口${windowId}`
    }

    const formatPrice = (price) => {
      const value = Number(price || 0)
      return Number.isNaN(value) ? '0.00' : value.toFixed(2)
    }

    const searchRecipes = async () => {
      if (!searchKey.value.trim()) {
        getRecipes()
        return
      }
      try {
        const list = await recipeApi.searchRecipes(searchKey.value.trim())
        await refreshFavoriteStatus(list)
        recipes.value = list
      } catch (error) {
        ElMessage.error('搜索失败')
      }
    }

    const toggleFavorite = async (recipe) => {
      try {
        if (recipe.isFavorite) {
          await favoriteApi.removeFavorite(recipe.id)
          recipe.isFavorite = false
          ElMessage.success('已取消收藏')
        } else {
          await favoriteApi.addFavorite(recipe.id)
          recipe.isFavorite = true
          ElMessage.success('收藏成功')
        }
      } catch (error) {
        ElMessage.error('操作失败')
      }
    }

    const selectCategory = (categoryId) => {
      selectedCategory.value = categoryId
      getRecipes(categoryId)
    }

    const viewRecipe = (recipe) => {
      router.push(`/user/recipe/${recipe.id}`)
    }

    onMounted(async () => {
      await getCategories()
      await getRecipes()
      await getHotRecipes()
      await getWindows()
      await getWindowWaiting()
      timer = setInterval(getWindowWaiting, 10000)
    })

    onUnmounted(() => {
      if (timer) clearInterval(timer)
    })

    return {
      searchKey,
      categories,
      recipes,
      hotRecipes,
      selectedCategory,
      selectCategory,
      searchRecipes,
      toggleFavorite,
      viewRecipe,
      getImageUrl,
      formatPrice,
      getWaitingCount,
      getWindowName
    }
  }
}
</script>

<style scoped>
.home { padding: 20px; }
.banner { text-align: center; margin-bottom: 20px; }
.search { max-width: 500px; margin: 0 auto; }
.hot-carousel { margin-bottom: 20px; }
.hot-item { display: flex; gap: 16px; height: 240px; cursor: pointer; }
.hot-image { width: 1150px; height: 240px; border-radius: 8px; }
.hot-info { flex: 1; display: flex; flex-direction: column; justify-content: center; }
.categories { margin-bottom: 20px; }
.category-list { display: flex; gap: 10px; padding: 10px 0; }
.recipe-card { margin-bottom: 20px; }
.recipe-image { width: 100%; height: 200px; }
.recipe-info { padding: 14px; }
.description { color: #909399; font-size: 13px; margin: 8px 0; min-height: 34px; }
.wait-count { color: #e67e22; font-size: 12px; margin: 4px 0 8px; }
.bottom { display: flex; justify-content: space-between; align-items: center; }
.price { color: #e67e22; font-size: 16px; font-weight: 700; }
.actions { display: flex; gap: 8px; align-items: center; }
</style>
