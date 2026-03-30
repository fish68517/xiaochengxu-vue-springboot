<template>
  <div class="orders">
    <h2>我的订单</h2>

    <div v-if="orders.length === 0" class="empty-orders">
      <el-empty description="暂无订单" />
    </div>

    <template v-else>
      <el-card v-for="order in orders" :key="order.id" class="order-card">
        <div class="order-header">
          <span class="order-no">订单号：{{ order.orderNo }}</span>
          <el-tag :type="getStatusType(order.status)">{{ order.status }}</el-tag>
        </div>

        <div class="pickup-code" v-if="shouldShowPickupCode(order)">
          取餐码：<b>{{ order.pickupCode || '-' }}</b>
        </div>
        <div class="pickup-code" v-if="order.remark">订单备注：{{ order.remark }}</div>

        <div class="order-items">
          <div v-for="detail in order.orderDetails" :key="detail.id" class="order-item">
            <el-image :src="getImageUrl(detail.recipe?.image)" fit="cover" class="item-image" />
            <div class="item-info">
              <h4>{{ detail.recipe?.name }}</h4>
              <p>数量：{{ detail.quantity }}</p>
            </div>
          </div>
        </div>

        <div class="order-footer">
          <span class="total">总计：￥{{ order.totalAmount }}</span>
          <div class="actions">
            <el-button v-if="order.status === '待付款'" type="primary" @click="payOrder(order)">立即支付</el-button>
            <el-button v-if="order.status === '待付款'" @click="cancelOrder(order)">取消订单</el-button>
          </div>
        </div>
      </el-card>
    </template>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { orderApi } from '@/api/networkApi'
import { getImageUrl } from '@/utils/image'

export default {
  setup() {
    const orders = ref([])

    const getOrders = async () => {
      try {
        const data = await orderApi.getOrderList()
        orders.value = Array.isArray(data) ? data : (data?.data || [])
      } catch (error) {
        ElMessage.error('获取订单失败')
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

    const payOrder = async (order) => {
      try {
        await ElMessageBox.confirm('确认支付该订单？')
        await orderApi.updateOrderStatus(order.id, '已付款')
        order.status = '已付款'
      } catch (error) {
        if (error !== 'cancel') ElMessage.error('支付失败')
      }
    }

    const cancelOrder = async (order) => {
      try {
        await ElMessageBox.confirm('确认取消该订单？')
        await orderApi.updateOrderStatus(order.id, '已取消')
        order.status = '已取消'
      } catch (error) {
        if (error !== 'cancel') ElMessage.error('取消失败')
      }
    }

    onMounted(getOrders)

    return {
      orders,
      getStatusType,
      shouldShowPickupCode,
      payOrder,
      cancelOrder,
      getImageUrl
    }
  }
}
</script>

<style scoped>
.orders { padding: 20px; }
.order-card { margin-bottom: 20px; }
.order-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
.pickup-code { margin-bottom: 10px; color: #e67e22; }
.order-item { display: flex; gap: 12px; margin-bottom: 10px; }
.item-image { width: 72px; height: 72px; }
.order-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
.actions { display: flex; gap: 10px; }
</style>
