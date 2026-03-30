<template>
  <div class="reviews">
    <el-card>
      <template #header>
        <div class="header">
          <span>评价管理</span>
          <el-input
            v-model="searchQuery"
            placeholder="搜索用户名/菜品名称"
            clearable
            class="search-input"
            @keyup.enter="handleSearch"
          >
            <template #append>
              <el-button icon="Search" @click="handleSearch" />
            </template>
          </el-input>
        </div>
      </template>

      <!-- 评价列表 -->
      <el-table :data="reviews" stripe v-loading="loading">
        <el-table-column label="用户信息" width="150">
          <template #default="{ row }">
            <div class="user-info">
              <el-avatar :size="30" :src="row.user?.avatar">
                {{ row.user?.nickname?.charAt(0) }}
              </el-avatar>
              <span>{{ row.user?.nickname || row.user?.username }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="菜品信息" width="200">
          <template #default="{ row }">
            <div class="recipe-info">

              <span>{{ row.recipe?.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="评分" width="120">
          <template #default="{ row }">
            <el-rate v-model="row.rating" disabled />
          </template>
        </el-table-column>
        <el-table-column prop="content" label="评价内容" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="评价时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-popconfirm
              title="确定要删除这条评价吗？"
              @confirm="handleDelete(row)"
            >
              <template #reference>
                <el-button type="danger" link>删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { reviewApi } from '@/api/networkApi'

export default {
  setup() {
    const loading = ref(false)
    const reviews = ref([])
    const searchQuery = ref('')
    const currentPage = ref(1)
    const pageSize = ref(10)
    const total = ref(0)

    const getReviews = async () => {
      loading.value = true
      try {
        const params = {
          page: currentPage.value,
          pageSize: pageSize.value,
          query: searchQuery.value
        }
        const { data, total: totalCount } = await reviewApi.getReviewList(params)
        reviews.value = data
        total.value = totalCount
      } catch (error) {
        ElMessage.error('获取评价列表失败')
      } finally {
        loading.value = false
      }
    }

    const handleSearch = () => {
      currentPage.value = 1
      getReviews()
    }

    const handleSizeChange = (val) => {
      pageSize.value = val
      getReviews()
    }

    const handleCurrentChange = (val) => {
      currentPage.value = val
      getReviews()
    }

    const handleDelete = async (review) => {
      try {
        await reviewApi.deleteReview(review.id)
        ElMessage.success('删除成功')
        getReviews()
      } catch (error) {
        ElMessage.error('删除失败')
      }
    }

    const formatDate = (date) => {
      return new Date(date).toLocaleString()
    }

    onMounted(getReviews)

    return {
      loading,
      reviews,
      searchQuery,
      currentPage,
      pageSize,
      total,
      handleSearch,
      handleSizeChange,
      handleCurrentChange,
      handleDelete,
      formatDate
    }
  }
}
</script>

<style scoped>
.reviews {
  padding: 20px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.search-input {
  width: 300px;
}
.user-info, .recipe-info {
  display: flex;
  align-items: center;
  gap: 10px;
}
.recipe-image {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
}
.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style> 