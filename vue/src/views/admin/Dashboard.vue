<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="stat-card">
          <template #header>
            <div class="card-header">
              <span>总用户数</span>
            </div>
          </template>
          <div class="card-body">
            <h2>{{ stats.userCount }}</h2>
            <div class="trend">
              <span>较昨日</span>
              <span :class="{ 'up': stats.userIncrease > 0 }">
                {{ stats.userIncrease > 0 ? '+' : '' }}{{ stats.userIncrease }}
              </span>
            </div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="6">
        <el-card class="stat-card">
          <template #header>
            <div class="card-header">
              <span>总订单数</span>
            </div>
          </template>
          <div class="card-body">
            <h2>{{ stats.orderCount }}</h2>
            <div class="trend">
              <span>较昨日</span>
              <span :class="{ 'up': stats.orderIncrease > 0 }">
                {{ stats.orderIncrease > 0 ? '+' : '' }}{{ stats.orderIncrease }}
              </span>
            </div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="6">
        <el-card class="stat-card">
          <template #header>
            <div class="card-header">
              <span>总菜品数</span>
            </div>
          </template>
          <div class="card-body">
            <h2>{{ stats.recipeCount }}</h2>
            <div class="trend">
              <span>较昨日</span>
              <span :class="{ 'up': stats.recipeIncrease > 0 }">
                {{ stats.recipeIncrease > 0 ? '+' : '' }}{{ stats.recipeIncrease }}
              </span>
            </div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="6">
        <el-card class="stat-card">
          <template #header>
            <div class="card-header">
              <span>总评价数</span>
            </div>
          </template>
          <div class="card-body">
            <h2>{{ stats.reviewCount }}</h2>
            <div class="trend">
              <span>较昨日</span>
              <span :class="{ 'up': stats.reviewIncrease > 0 }">
                {{ stats.reviewIncrease > 0 ? '+' : '' }}{{ stats.reviewIncrease }}
              </span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区域 -->
    <el-row :gutter="20" class="charts-row">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>订单趋势</span>
              <el-radio-group v-model="orderChartType" size="small">
                <el-radio-button label="week">周</el-radio-button>
                <el-radio-button label="month">月</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div class="chart-container">
            <v-chart :option="orderChartOption" autoresize />
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>菜品分类统计</span>
            </div>
          </template>
          <div class="chart-container">
            <v-chart :option="categoryChartOption" autoresize />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 最新订单列表 -->
    <el-card class="recent-orders">
      <template #header>
        <div class="card-header">
          <span>最新订单</span>
          <el-button v-show="false" type="primary" link @click="$router.push('/admin/orders')">
            查看全部
          </el-button>
        </div>
      </template>
      
      <el-table :data="recentOrders" stripe>
        <el-table-column prop="orderNo" label="订单号" width="180" />
        <el-table-column prop="user.username" label="用户" width="120" />
        <el-table-column prop="totalAmount" label="金额" width="120">
          <template #default="{ row }">
            ¥{{ row.totalAmount }}
          </template>
        </el-table-column>
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
      </el-table>
    </el-card>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, PieChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from 'echarts/components'
import VChart from 'vue-echarts'
import { orderApi, statsApi } from '@/api/networkApi'

use([
  CanvasRenderer,
  LineChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
])

export default {
  components: {
    VChart
  },
  
  setup() {
    const stats = ref({
      userCount: 0,
      userIncrease: 0,
      orderCount: 0,
      orderIncrease: 0,
      recipeCount: 0,
      recipeIncrease: 0,
      reviewCount: 0,
      reviewIncrease: 0
    })

    const orderChartType = ref('week')
    const recentOrders = ref([])

    // 订单趋势图配置
    const orderChartOption = ref({
      tooltip: {
        trigger: 'axis'
      },
      xAxis: {
        type: 'category',
        data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      },
      yAxis: {
        type: 'value'
      },
      series: [{
        data: [150, 230, 224, 218, 135, 147, 260],
        type: 'line',
        smooth: true
      }]
    })

    // 菜品分类统计图配置
    const categoryChartOption = ref({
      tooltip: {
        trigger: 'item'
      },
      legend: {
        orient: 'vertical',
        left: 'left'
      },
      series: [{
        type: 'pie',
        radius: '50%',
        data: [
          { value: 1048, name: '川菜' },
          { value: 735, name: '粤菜' },
          { value: 580, name: '苏菜' },
          { value: 484, name: '鲁菜' },
          { value: 300, name: '其他' }
        ],
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    })

    const getStatusType = (status) => {
      const types = {
        '待付款': 'warning',
        '已付款': 'primary',
        '已完成': 'success',
        '已取消': 'info'
      }
      return types[status] || 'info'
    }

    const formatDate = (date) => {
      return new Date(date).toLocaleString()
    }

    const getRecentOrders = async () => {
      try {
        const data = await orderApi.getOrderList({ limit: 10 })
        recentOrders.value = data
      } catch (error) {
        console.error('获取最新订单失败:', error)
      }
    }

    const loadStats = async () => {
      try {
        const data = await statsApi.getDashboardStats()
        stats.value = data
      } catch (error) {
        console.error('获取统计数据失败:', error)
      }
    }

    onMounted(() => {
      getRecentOrders()
      loadStats()
    })

    return {
      stats,
      orderChartType,
      orderChartOption,
      categoryChartOption,
      recentOrders,
      getStatusType,
      formatDate
    }
  }
}
</script>

<style scoped>
.dashboard {
  padding: 20px;
}
.stat-card {
  .card-body {
    text-align: center;
    h2 {
      font-size: 24px;
      margin: 10px 0;
    }
    .trend {
      color: #909399;
      font-size: 14px;
      .up {
        color: #67C23A;
      }
    }
  }
}
.charts-row {
  margin-top: 20px;
}
.chart-container {
  height: 300px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.recent-orders {
  margin-top: 20px;
}
</style> 