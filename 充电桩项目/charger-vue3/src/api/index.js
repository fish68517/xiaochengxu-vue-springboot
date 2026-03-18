import request from '@/utils/request'

// 获取首页统计数据
export function getHomeStats() {
  return request({
    url: '/system/home/stats',
    method: 'get'
  })
}

// 获取充电实时数据
export function getChargerRealTimeData() {
  return request({
    url: '/system/charger/realtime',
    method: 'get'
  })
}

// 获取充电历史数据
export function getChargerHistoryData(params) {
  return request({
    url: '/system/charger/history',
    method: 'get',
    params
  })
} 