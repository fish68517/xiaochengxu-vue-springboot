import request from '@/utils/request'

// 获取充电量趋势数据
export function getChargingTrend(params) {
  return request({
    url: '/charger/statistics/trend',
    method: 'get',
    params
  })
}

// 获取充电类型分布
export function getChargingTypes() {
  return request({
    url: '/charger/statistics/types',
    method: 'get'
  })
}

// 获取站点充电量对比
export function getStationComparison() {
  return request({
    url: '/charger/statistics/stations',
    method: 'get'
  })
}

// 获取实时监控数据
export function getMonitorData() {
  return request({
    url: '/charger/statistics/monitor',
    method: 'get'
  })
} 