import request from '@/utils/request'

interface ChargerData {
  power: string;
  voltage: string;
  current: string;
  soc: string;
}

interface HistoryData {
  power: number[];
  voltage: number[];
  current: number[];
  soc: number[];
  times: string[];
}

// 获取充电实时数据
export function getChargerRealTimeData(): Promise<{ code: number; data: ChargerData }> {
  return request({
    url: '/charger/monitor/realtime',
    method: 'get'
  })
}

// 获取充电历史数据
export function getChargerHistoryData(params: { hours: number }): Promise<{ code: number; data: HistoryData }> {
  return request({
    url: '/charger/monitor/history',
    method: 'get',
    params
  })
}

// 获取充电设备状态
export function getChargerStatus(): Promise<{ code: number; data: any }> {
  return request({
    url: '/charger/monitor/status',
    method: 'get'
  })
} 