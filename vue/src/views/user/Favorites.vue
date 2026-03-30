<template>
  <div class="favorites">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>我的收藏</span>
          <el-input
            v-model="searchKey"
            placeholder="搜索收藏菜品..."
            class="search-input"
            clearable
          />
        </div>
      </template>

      <el-row :gutter="20">
        <el-col v-for="favorite in filteredFavorites" :key="favorite.id" :span="6">
          <el-card class="recipe-card" :body-style="{ padding: '0px' }">
            <el-image :src="getImageUrl(favorite.recipe.image)" class="recipe-image" fit="cover" />
            <div class="recipe-info">
              <h3>{{ favorite.recipe.name }}</h3>
              <p class="description">{{ favorite.recipe.description }}</p>
              <div class="bottom">
                <el-button type="primary" link @click="quickOrder(favorite)">快捷下单</el-button>
                <el-button type="danger" link @click="removeFavorite(favorite)">取消收藏</el-button>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-empty v-if="filteredFavorites.length === 0" description="暂无收藏菜品" />
    </el-card>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { favoriteApi, orderApi } from '@/api/networkApi'
import { getImageUrl } from '@/utils/image'

export default {
  setup() {
    const router = useRouter()
    const favorites = ref([])
    const searchKey = ref('')

    const getFavorites = async () => {
      try {
        favorites.value = await favoriteApi.getFavorites()
      } catch (error) {
        ElMessage.error('获取收藏列表失败')
      }
    }

    const filteredFavorites = computed(() => {
      if (!searchKey.value) return favorites.value
      const key = searchKey.value.toLowerCase()
      return favorites.value.filter(f =>
        (f.recipe?.name || '').toLowerCase().includes(key) ||
        (f.recipe?.description || '').toLowerCase().includes(key)
      )
    })

    const removeFavorite = async (favorite) => {
      try {
        await favoriteApi.removeFavorite(favorite.recipeId)
        favorites.value = favorites.value.filter(f => f.id !== favorite.id)
        ElMessage.success('已取消收藏')
      } catch (error) {
        ElMessage.error('取消收藏失败')
      }
    }

    const quickOrder = async (favorite) => {
      try {
        await ElMessageBox.confirm('确认直接下单该菜品吗？', '快捷下单')
        await orderApi.createOrder({
          items: [{ recipeId: favorite.recipeId, quantity: 1 }]
        })
        ElMessage.success('下单成功')
        router.push('/user/orders')
      } catch (error) {
        if (error !== 'cancel') ElMessage.error('下单失败')
      }
    }

    onMounted(getFavorites)

    return {
      searchKey,
      filteredFavorites,
      removeFavorite,
      quickOrder,
      getImageUrl
    }
  }
}
</script>

<style scoped>
.favorites { padding: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.search-input { width: 320px; }
.recipe-card { margin-bottom: 20px; }
.recipe-image { width: 100%; height: 200px; }
.recipe-info { padding: 14px; }
.description { color: #909399; font-size: 13px; min-height: 34px; }
.bottom { display: flex; justify-content: space-between; align-items: center; }
</style>
