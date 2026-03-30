<template>
  <div class="orders">
    <el-card>
      <template #header>
        <div class="header">
          <span>订单管理</span>
          <el-input
            v-model="searchQuery"
            placeholder="搜索订单号"
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

      <el-table :data="orders" stripe v-loading="loading">
        <el-table-column prop="orderNo" label="订单号" width="180" />
        <el-table-column prop="pickupCode" label="取餐码" width="120">
          <template #default="{ row }">
            {{ shouldShowPickupCode(row) ? (row.pickupCode || '-') : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="totalAmount" label="金额" width="120" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleViewDetails(row)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>

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

    <el-dialog title="订单详情" v-model="detailsVisible" width="700px">
      <template v-if="currentOrder">
        <div class="order-info">
          <div class="info-item">
            <span class="label">订单号：</span>
            <span>{{ currentOrder.orderNo }}</span>
          </div>
          <div class="info-item">
            <span class="label">下单时间：</span>
            <span>{{ formatDate(currentOrder.createdAt) }}</span>
          </div>
          <div class="info-item">
            <span class="label">订单状态：</span>
            <el-tag :type="getStatusType(currentOrder.status)">{{ currentOrder.status }}</el-tag>
          </div>
          <div class="info-item">
            <span class="label">取餐码：</span>
            <span>{{ shouldShowPickupCode(currentOrder) ? (currentOrder.pickupCode || '-') : '-' }}</span>
          </div>
          <div class="info-item" v-if="currentOrder.remark">
            <span class="label">订单备注：</span>
            <span>{{ currentOrder.remark }}</span>
          </div>
        </div>

        <el-divider>订单菜品</el-divider>

        <el-table :data="currentOrder.orderDetails || []" stripe>
          <el-table-column prop="recipe.name" label="菜品名称" />
          <el-table-column prop="quantity" label="数量" width="100" />
          <el-table-column prop="price" label="单价" width="120" />
        </el-table>

        <div class="order-total">总计：￥{{ currentOrder.totalAmount }}</div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { orderApi } from '@/api/networkApi'

export default {
  setup() {
    const loading = ref(false)
    const orders = ref([])
    const searchQuery = ref('')
    const currentPage = ref(1)
    const pageSize = ref(10)
    const total = ref(0)
    const detailsVisible = ref(false)
    const currentOrder = ref(null)

    const getOrders = async () => {
      loading.value = true
      try {
        const params = {
          page: currentPage.value,
          pageSize: pageSize.value,
          query: searchQuery.value
        }
        const response = await orderApi.getOrderList(params)
        if (Array.isArray(response)) {
          orders.value = response
          total.value = response.length
        } else {
          const list = response?.data || []
          orders.value = list
          total.value = response?.total ?? list.length
        }
      } catch (error) {
        ElMessage.error('获取订单列表失败')
      } finally {
        loading.value = false
      }
    }

    const getStatusType = (status) => {
      const types = {
        待付款: 'warning',
        已付款: 'primary',
        已完成: 'success',
        已取消: 'info'
      }
      return types[status] || 'info'
    }

    const shouldShowPickupCode = (order) => {
      return ['已付款', '已完成'].includes(order?.status)
    }

    const handleSearch = () => {
      currentPage.value = 1
      getOrders()
    }

    const handleSizeChange = (val) => {
      pageSize.value = val
      getOrders()
    }

    const handleCurrentChange = (val) => {
      currentPage.value = val
      getOrders()
    }

    const handleViewDetails = async (order) => {
      try {
        const data = await orderApi.getOrderDetail(order.id)
        currentOrder.value = data
        detailsVisible.value = true
      } catch (error) {
        ElMessage.error('获取订单详情失败')
      }
    }

    const handleUpdateStatus = async (order, status) => {
      try {
        const actionText = {
          已付款: '接单',
          已完成: '完成',
          已取消: '取消'
        }[status]

        await ElMessageBox.confirm(`确定要${actionText}该订单吗？`)
        await orderApi.updateOrderStatus(order.id, status)
        ElMessage.success(`${actionText}成功`)
        getOrders()
      } catch (error) {
        if (error !== 'cancel') {
          ElMessage.error('操作失败')
        }
      }
    }

    const formatDate = (date) => {
      if (!date) return '-'
      return new Date(date).toLocaleString()
    }

    onMounted(getOrders)

    return {
      loading,
      orders,
      searchQuery,
      currentPage,
      pageSize,
      total,
      detailsVisible,
      currentOrder,
      getStatusType,
      shouldShowPickupCode,
      handleSearch,
      handleSizeChange,
      handleCurrentChange,
      handleViewDetails,
      handleUpdateStatus,
      formatDate
    }
  }
}
</script>

<style scoped>
.orders {
  padding: 20px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.search-input {
  width: 320px;
}
.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
.order-info {
  padding: 16px;
  background-color: #f5f7fa;
  border-radius: 4px;
}
.info-item {
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.label {
  color: #666;
}
.order-total {
  margin-top: 16px;
  text-align: right;
  font-weight: 700;
}
</style>
