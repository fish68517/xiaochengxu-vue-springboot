<template>
  <div class="recipe-detail">
    <el-card v-if="recipe">
      <div class="recipe-header">
        <el-image :src="getImageUrl(recipe.image)" class="recipe-image" fit="cover" />
        <div class="recipe-info">
          <h1>{{ recipe.name }}</h1>
          <p class="description">{{ recipe.description }}</p>
          <div class="meta">
            <el-tag :type="getDifficultyType(recipe.difficulty)" size="small">
              {{ recipe.difficulty || '简单' }}
            </el-tag>
            <span class="cooking-time">烹饪时间：{{ recipe.cookingTime || 0 }} 分钟</span>
          </div>
        </div>
      </div>

      <el-divider>食材</el-divider>
      <div class="ingredients">{{ recipe.ingredients }}</div>

      <el-divider>烹饪步骤</el-divider>
      <div class="steps">{{ recipe.steps }}</div>

      <div class="actions">
        <el-button type="primary" @click="addToCart(recipe)">加入购物车</el-button>
      </div>
    </el-card>

    <el-card class="review-card" v-if="recipe">
      <template #header>
        <div class="review-header">
          <span>用户评价（{{ reviews.length }}）</span>
        </div>
      </template>

      <el-form :model="reviewForm" label-width="80px" class="review-form">
        <el-form-item label="评分">
          <el-rate v-model="reviewForm.rating" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="reviewForm.content" type="textarea" :rows="3" placeholder="说说你的体验..." />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="submitReview">
            {{ editingReviewId ? '更新评价' : '提交评价' }}
          </el-button>
          <el-button v-if="editingReviewId" @click="cancelEdit">取消</el-button>
        </el-form-item>
      </el-form>

      <el-empty v-if="reviews.length === 0" description="暂无评价" />
      <div v-else class="review-list">
        <div v-for="item in reviews" :key="item.id" class="review-item">
          <div class="review-top">
            <div class="review-user">
              <el-avatar :size="32" :src="item.user?.avatar || ''">
                {{ (item.user?.nickname || 'U').charAt(0) }}
              </el-avatar>
              <span>{{ item.user?.nickname || '用户' }}</span>
            </div>
            <el-rate :model-value="item.rating" disabled />
          </div>
          <div class="review-content">{{ item.content }}</div>
          <div class="review-bottom">
            <span class="time">{{ formatTime(item.createdAt) }}</span>
            <div v-if="isMine(item)">
              <el-button type="primary" link @click="startEdit(item)">编辑</el-button>
              <el-button type="danger" link @click="deleteReview(item)">删除</el-button>
            </div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { recipeApi, cartApi, reviewApi } from '@/api/networkApi'
import { getImageUrl } from '@/utils/image'

export default {
  setup() {
    const route = useRoute()
    const recipe = ref(null)
    const reviews = ref([])
    const submitting = ref(false)
    const editingReviewId = ref(null)
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}')

    const reviewForm = ref({
      rating: 5,
      content: ''
    })

    const getRecipe = async () => {
      try {
        recipe.value = await recipeApi.getRecipeById(route.params.id)
      } catch (error) {
        ElMessage.error('获取菜品详情失败')
      }
    }

    const getReviews = async () => {
      try {
        reviews.value = await reviewApi.getRecipeReviews(route.params.id)
      } catch (error) {
        ElMessage.error('获取评价失败')
      }
    }

    const submitReview = async () => {
      if (!reviewForm.value.content || !reviewForm.value.content.trim()) {
        ElMessage.warning('请输入评价内容')
        return
      }
      submitting.value = true
      try {
        const payload = {
          recipeId: Number(route.params.id),
          rating: reviewForm.value.rating,
          content: reviewForm.value.content.trim()
        }
        if (editingReviewId.value) {
          await reviewApi.updateReview(editingReviewId.value, payload)
          ElMessage.success('评价已更新')
        } else {
          await reviewApi.addReview(payload)
          ElMessage.success('评价成功')
        }
        cancelEdit()
        await getReviews()
      } catch (error) {
        ElMessage.error('提交评价失败')
      } finally {
        submitting.value = false
      }
    }

    const startEdit = (item) => {
      editingReviewId.value = item.id
      reviewForm.value.rating = item.rating || 5
      reviewForm.value.content = item.content || ''
    }

    const cancelEdit = () => {
      editingReviewId.value = null
      reviewForm.value = { rating: 5, content: '' }
    }

    const deleteReview = async (item) => {
      try {
        await ElMessageBox.confirm('确认删除这条评价吗？', '提示', { type: 'warning' })
        await reviewApi.deleteReview(item.id)
        ElMessage.success('已删除')
        await getReviews()
      } catch (error) {
        if (error !== 'cancel') ElMessage.error('删除失败')
      }
    }

    const isMine = (item) => Number(item.userId) === Number(userInfo.id)

    const addToCart = async (current) => {
      try {
        await cartApi.addToCart({ recipeId: current.id, quantity: 1 })
        ElMessage.success('已加入购物车')
      } catch (error) {
        ElMessage.error('添加失败')
      }
    }

    const getDifficultyType = (difficulty) => {
      const map = { 简单: 'success', 中等: 'warning', 困难: 'danger' }
      return map[difficulty] || 'info'
    }

    const formatTime = (value) => {
      if (!value) return '-'
      return new Date(value).toLocaleString()
    }

    onMounted(async () => {
      await getRecipe()
      await getReviews()
    })

    return {
      recipe,
      reviews,
      reviewForm,
      submitting,
      editingReviewId,
      submitReview,
      startEdit,
      cancelEdit,
      deleteReview,
      isMine,
      addToCart,
      getImageUrl,
      getDifficultyType,
      formatTime
    }
  }
}
</script>

<style scoped>
.recipe-detail { padding: 20px; }
.recipe-header { display: flex; gap: 20px; }
.recipe-image { width: 360px; height: 260px; border-radius: 8px; }
.recipe-info { flex: 1; }
.description { color: #666; margin: 12px 0; }
.meta { display: flex; align-items: center; gap: 14px; }
.ingredients, .steps { line-height: 1.8; white-space: pre-wrap; }
.actions { margin-top: 20px; text-align: right; }
.review-card { margin-top: 20px; }
.review-item { padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
.review-top { display: flex; justify-content: space-between; align-items: center; }
.review-user { display: flex; align-items: center; gap: 8px; }
.review-content { margin: 8px 0; color: #333; white-space: pre-wrap; }
.review-bottom { display: flex; justify-content: space-between; align-items: center; }
.time { color: #999; font-size: 12px; }
</style>
