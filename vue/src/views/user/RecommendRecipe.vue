<template>
  <div class="recommend">
    <el-card>
      <template #header>
        <div class="header">
          <span class="title">为您推荐</span>
          <el-button @click="refreshRecommendations" :loading="loading">
            <el-icon><Refresh /></el-icon>
            换一批
          </el-button>
        </div>
      </template>

      <!-- 添加搜索过滤区域 -->
      <div class="filter-container">
        <el-form :inline="true" :model="filterForm" class="filter-form" width="200px">
          <el-form-item label="口味偏好">
            <el-select
                style="width: 100px;"
              v-model="filterForm.taste" 
              placeholder="口味"
              clearable
              @change="applyFilters"
            >
              <el-option label="清淡" value="清淡" />
              <el-option label="麻辣" value="麻辣" />
              <el-option label="酸甜" value="酸甜" />
              <el-option label="咸鲜" value="咸鲜" />

            </el-select>
          </el-form-item>
          
          <el-form-item label="菜系">
            <el-select
                style="width: 100px;"
              v-model="filterForm.cuisineType" 
              placeholder="菜系"
              clearable
              @change="applyFilters"
            >
              <el-option label="川菜" value="川菜" />
                <el-option label="粤菜" value="粤菜" />
              <el-option label="湘菜" value="湘菜" />
              <el-option label="鲁菜" value="鲁菜" />
            </el-select>
          </el-form-item>
          
          <el-form-item label="烹饪方式">
            <el-select
                style="width: 100px;"
              v-model="filterForm.cookingMethod" 
              placeholder="烹饪方式"
              clearable
              @change="applyFilters"
            >
              <el-option label="炒" value="炒" />
              <el-option label="煮" value="煮" />
              <el-option label="炖" value="炖" />
              <el-option label="蒸" value="蒸" />

            </el-select>
          </el-form-item>
          
          <el-form-item label="食物分类">
            <el-select
                style="width: 100px;"
              v-model="filterForm.foodCategory" 
              placeholder="食物分类"
              clearable
              @change="applyFilters"
            >
              <el-option label="主食" value="主食" />
              <el-option label="甜点" value="甜点" />
              <el-option label="小吃" value="小吃" />
              <el-option label="汤品" value="汤品" />
              <el-option label="菜品" value="饮品" />
            </el-select>
          </el-form-item>

          <el-form-item label="烹饪难度">
            <el-select
                style="width: 100px;"
              v-model="filterForm.difficulty" 
              placeholder="难度"
              clearable
              @change="applyFilters"
            >
              <el-option label="简单" value="简单" />
              <el-option label="中等" value="中等" />
              <el-option label="困难" value="困难" />
            </el-select>
          </el-form-item>
          
          <el-form-item>
            <el-button type="primary" @click="resetFilters">
              <el-icon><RefreshLeft /></el-icon>
              重置筛选
            </el-button>
          </el-form-item>
        </el-form>
      </div>

      <div v-if="loading" class="loading-container">
        <el-skeleton :rows="3" animated />
      </div>

      <el-empty 
        v-else-if="recommendedRecipes.length === 0" 
        description="暂无推荐菜品"
      />

      <div v-else>
        <!-- 推荐原因说明 -->
        <div class="recommendation-info">
          <el-alert
            type="info"
            show-icon
            :closable="false"
          >
            <template #title>
              <span>根据您的历史订单、收藏和购物车记录，个人喜好和口味偏好，为您精选了以下菜品</span>
            </template>
          </el-alert>
        </div>

        <!-- 推荐菜品列表 -->
        <el-row :gutter="20">
          <el-col 
            v-for="recipe in recommendedRecipes" 
            :key="recipe.id" 
            :xs="24" 
            :sm="12" 
            :md="8" 
            :lg="6"
          >
            <el-card class="recipe-card" :body-style="{ padding: '0px' }">
              <el-image 
                :src="getImageUrl(recipe.image)"
                class="recipe-image"
                fit="cover"
              >
                <template #error>
                  <div class="image-error">
                    <el-icon><PictureIcon /></el-icon>
                  </div>
                </template>
              </el-image>
              
              <div class="recipe-info">
                <h3>{{ recipe.name }}</h3>
                <p class="description">{{ recipe.description }}</p>
                <div class="bottom">
                  <div class="left">
                    <el-tag 
                      :type="getDifficultyType(recipe.difficulty)"
                      size="small"
                      class="difficulty-tag"
                    >
                      {{ recipe.difficulty || '简单' }}
                    </el-tag>
                  </div>
                  <div class="right">
                    <el-button 
                      :type="recipe.isFavorite ? 'danger' : 'default'"
                      circle
                      @click="toggleFavorite(recipe)"
                    >
                      <el-icon>
                        <component :is="recipe.isFavorite ? Star : StarFilled" />
                      </el-icon>
                    </el-button>
                    <el-button 
                      type="primary" 
                      link 
                      @click="viewRecipe(recipe)"
                    >
                      查看详情
                    </el-button>
                  </div>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </div>
    </el-card>
  </div>
</template>

<script>
import { ref, onMounted, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { recommendApi, favoriteApi } from '@/api/networkApi'
import { Picture as PictureIcon, Star, StarFilled, Refresh, RefreshLeft } from '@element-plus/icons-vue'
import { getImageUrl } from '@/utils/image'

export default {
  components: {
    PictureIcon,
    Star,
    StarFilled,
    Refresh,
    RefreshLeft
  },

  setup() {
    const router = useRouter()
    const allRecommendedRecipes = ref([]) // 存储所有推荐菜品
    const recommendedRecipes = ref([]) // 过滤后显示的菜品
    const loading = ref(false)

    // 过滤表单
    const filterForm = reactive({
      taste: '',
      cuisineType: '',
      cookingMethod: '',
      foodCategory: '',
      difficulty: ''
    })

    // 获取推荐菜品
    const getRecommendations = async () => {
      loading.value = true
      try {
        const data = await recommendApi.getRecommendedRecipes()
        allRecommendedRecipes.value = data
        recommendedRecipes.value = [...data] // 初始显示所有菜品
        // 获取收藏状态
        await getFavoriteStatus(allRecommendedRecipes.value)
      } catch (error) {
        ElMessage.error('获取推荐菜品失败')
      } finally {
        loading.value = false
      }
    }

    // 获取收藏状态
    const getFavoriteStatus = async (recipes) => {
      try {
        const promises = recipes.map(recipe => 
          favoriteApi.checkFavorite(recipe.id)
            .then(isFavorite => recipe.isFavorite = isFavorite)
        )
        await Promise.all(promises)
      } catch (error) {
        console.error('获取收藏状态失败:', error)
      }
    }

    // 切换收藏状态
    const toggleFavorite = async (recipe) => {
      try {
        if (recipe.isFavorite) {
          await favoriteApi.removeFavorite(recipe.id)
          recipe.isFavorite = false
          ElMessage.success('已取消收藏')
        } else {
          await favoriteApi.addFavorite(recipe.id)
          recipe.isFavorite = true
          ElMessage.success('已添加到收藏')
        }
      } catch (error) {
        ElMessage.error(recipe.isFavorite ? '取消收藏失败' : '收藏失败')
      }
    }

    // 应用过滤条件
    const applyFilters = () => {
      // 先复制所有菜品
      let filteredRecipes = [...allRecommendedRecipes.value]
      // 打印 filteredRecipes
      console.log("过滤菜谱：" + JSON.stringify(filteredRecipes));
      
      // 依次应用各个过滤条件
      if (filterForm.taste) {
        filteredRecipes = filteredRecipes.filter(recipe => 
          recipe.taste && recipe.taste.includes(filterForm.taste)
        )
      }
      
      if (filterForm.cuisineType) {
        filteredRecipes = filteredRecipes.filter(recipe => 
          recipe.cuisine_type === filterForm.cuisineType
        )
      }
      
      if (filterForm.cookingMethod) {
        filteredRecipes = filteredRecipes.filter(recipe => 
          recipe.cooking_method === filterForm.cookingMethod
        )
      }
      
      if (filterForm.foodCategory) {
        filteredRecipes = filteredRecipes.filter(recipe => 
          recipe.food_category === filterForm.foodCategory
        )
      }
      
      if (filterForm.difficulty) {
        filteredRecipes = filteredRecipes.filter(recipe => 
          recipe.difficulty === filterForm.difficulty
        )
      }
      
      // 更新显示的菜品
      recommendedRecipes.value = filteredRecipes
      
      // 如果过滤后没有结果，显示提示
      if (filteredRecipes.length === 0) {
        ElMessage.info('没有找到符合条件的菜品')
      }
    }
    
    // 重置过滤条件
    const resetFilters = () => {
      // 清空所有过滤条件
      Object.keys(filterForm).forEach(key => {
        filterForm[key] = ''
      })
      
      // 重置显示的菜品
      recommendedRecipes.value = [...allRecommendedRecipes.value]
    }

    // 刷新推荐
    const refreshRecommendations = () => {
      getRecommendations()
      // 同时重置过滤条件
      resetFilters()
    }

    // 查看菜品详情
    const viewRecipe = (recipe) => {
      router.push(`/user/recipe/${recipe.id}`)
    }

    // 获取难度对应的类型
    const getDifficultyType = (difficulty) => {
      const types = {
        '简单': 'success',
        '中等': 'warning',
        '困难': 'danger'
      }
      return types[difficulty] || 'info'
    }

    onMounted(() => {
      getRecommendations()
    })

    return {
      recommendedRecipes,
      loading,
      filterForm,
      getImageUrl,
      getDifficultyType,
      toggleFavorite,
      viewRecipe,
      refreshRecommendations,
      applyFilters,
      resetFilters,
      Star,
      StarFilled
    }
  }
}
</script>

<style scoped>
.recommend {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-size: 18px;
  font-weight: bold;
}

.recommendation-info {
  margin-bottom: 20px;
}

.recipe-card {
  margin-bottom: 20px;
  transition: all 0.3s;
  height: 100%;
}

.recipe-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 2px 12px 0 rgba(0,0,0,.1);
}

.recipe-image {
  width: 100%;
  height: 200px;
}

.image-error {
  height: 200px;
  background-color: #f5f7fa;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #909399;
  font-size: 30px;
}

.recipe-info {
  padding: 14px;
}

.recipe-info h3 {
  margin: 0;
  font-size: 16px;
  color: #303133;
}

.description {
  font-size: 13px;
  color: #909399;
  line-height: 1.4;
  margin: 8px 0;
  height: 36px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.difficulty-tag {
  font-size: 12px;
}

.bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}

.right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.loading-container {
  padding: 20px;
}

.filter-container {
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .el-form-item {
    margin-right: 0;
    width: 100%;
  }
}
</style> 