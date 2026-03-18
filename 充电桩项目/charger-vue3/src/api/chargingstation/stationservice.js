import request from '@/utils/request'

// 查询服务类型列表
export function listStationservice(query) {
  return request({
    url: '/chargingstation/stationservice/list',
    method: 'get',
    params: query
  })
}

// 查询服务类型详细
export function getStationservice(id) {
  return request({
    url: '/chargingstation/stationservice/' + id,
    method: 'get'
  })
}

// 新增服务类型
export function addStationservice(data) {
  return request({
    url: '/chargingstation/stationservice',
    method: 'post',
    data: data
  })
}

// 修改服务类型
export function updateStationservice(data) {
  return request({
    url: '/chargingstation/stationservice',
    method: 'put',
    data: data
  })
}

// 删除服务类型
export function delStationservice(id) {
  return request({
    url: '/chargingstation/stationservice/' + id,
    method: 'delete'
  })
}
