<template>
  <div class="dashboard-container">
    <div class="chart-row">
      <!-- 充电量趋势图 -->
      <div class="chart-item">
        <div class="chart-header">
          <h3>充电量趋势</h3>
        </div>
        <div class="chart" ref="trendChart"></div>
      </div>
      <!-- 充电类型分布 -->
      <div class="chart-item">
        <div class="chart-header">
          <h3>充电类型分布</h3>
        </div>
        <div class="chart" ref="pieChart"></div>
      </div>
    </div>
    <div class="chart-row">
      <!-- 各站点充电量对比 -->
      <div class="chart-item">
        <div class="chart-header">
          <h3>站点充电量对比</h3>
        </div>
        <div class="chart" ref="barChart"></div>
      </div>
      <!-- 24小时实时监控 -->
      <div class="chart-item">
        <div class="chart-header">
          <h3>24小时实时监控</h3>
        </div>
        <div class="chart" ref="monitorChart"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'

// 图表引用
const trendChart = ref()
const pieChart = ref()
const barChart = ref()
const monitorChart = ref()

// 存储图表实例
const charts = ref<echarts.ECharts[]>([])

// 初始化趋势图
const initTrendChart = () => {
  const chart = echarts.init(trendChart.value)
  charts.value.push(chart)
  
  const option = {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['快充', '慢充']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    },
    yAxis: {
      type: 'value',
      name: '充电量(kWh)'
    },
    series: [
      {
        name: '快充',
        type: 'line',
        data: [820, 932, 901, 934, 1290, 1330, 1320],
        smooth: true,
        lineStyle: { color: '#409EFF' }
      },
      {
        name: '慢充',
        type: 'line',
        data: [420, 532, 501, 534, 690, 730, 620],
        smooth: true,
        lineStyle: { color: '#67C23A' }
      }
    ]
  }
  chart.setOption(option)
}

// 初始化饼图
const initPieChart = () => {
  const chart = echarts.init(pieChart.value)
  charts.value.push(chart)
  
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 10,
      data: ['快充', '慢充', '超级快充', '应急充电']
    },
    series: [
      {
        name: '充电类型',
        type: 'pie',
        radius: ['50%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 20,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: [
          { value: 1048, name: '快充' },
          { value: 735, name: '慢充' },
          { value: 580, name: '超级快充' },
          { value: 484, name: '应急充电' }
        ]
      }
    ]
  }
  chart.setOption(option)
}

// 初始化柱状图
const initBarChart = () => {
  const chart = echarts.init(barChart.value)
  charts.value.push(chart)
  
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    legend: {
      data: ['本月充电量', '上月充电量']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      name: '充电量(kWh)'
    },
    yAxis: {
      type: 'category',
      data: ['站点A', '站点B', '站点C', '站点D', '站点E']
    },
    series: [
      {
        name: '本月充电量',
        type: 'bar',
        data: [320, 302, 301, 334, 390],
        itemStyle: { color: '#409EFF' }
      },
      {
        name: '上月充电量',
        type: 'bar',
        data: [120, 132, 101, 134, 90],
        itemStyle: { color: '#E6A23C' }
      }
    ]
  }
  chart.setOption(option)
}

// 初始化监控图
const initMonitorChart = () => {
  const chart = echarts.init(monitorChart.value)
  charts.value.push(chart)
  
  const option = {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['电压', '电流', '功率']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ['00:00', '06:00', '12:00', '18:00', '24:00']
    },
    yAxis: [
      {
        type: 'value',
        name: '电压(V)/电流(A)',
        position: 'left'
      },
      {
        type: 'value',
        name: '功率(kW)',
        position: 'right'
      }
    ],
    series: [
      {
        name: '电压',
        type: 'line',
        data: [220, 225, 230, 225, 220],
        smooth: true,
        lineStyle: { color: '#409EFF' }
      },
      {
        name: '电流',
        type: 'line',
        data: [150, 160, 170, 165, 155],
        smooth: true,
        lineStyle: { color: '#67C23A' }
      },
      {
        name: '功率',
        type: 'line',
        yAxisIndex: 1,
        data: [33, 36, 39, 37, 34],
        smooth: true,
        lineStyle: { color: '#E6A23C' }
      }
    ]
  }
  chart.setOption(option)
}

// 处理窗口大小变化
const handleResize = () => {
  charts.value.forEach(chart => chart.resize())
}

onMounted(() => {
  // 初始化所有图表
  initTrendChart()
  initPieChart()
  initBarChart()
  initMonitorChart()
  
  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  // 移除事件监听
  window.removeEventListener('resize', handleResize)
  // 销毁图表实例
  charts.value.forEach(chart => chart.dispose())
})
</script>

<style scoped>
.dashboard-container {
  padding: 20px;
  background-color: #f0f2f5;
  min-height: 100vh;
}

.chart-row {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.chart-item {
  flex: 1;
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.chart-header {
  margin-bottom: 20px;
}

.chart-header h3 {
  margin: 0;
  font-size: 16px;
  color: #303133;
  font-weight: 500;
}

.chart {
  height: 300px;
}
</style>

