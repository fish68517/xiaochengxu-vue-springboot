import request from '@/utils/request'

// 查询评分管理列表
export function listStationgrade(query) {
  return request({
    url: '/chargingstation/stationgrade/list',
    method: 'get',
    params: query
  })
}

// 查询评分管理详细
export function getStationgrade(id) {
  return request({
    url: '/chargingstation/stationgrade/' + id,
    method: 'get'
  })
}

// 新增评分管理
export function addStationgrade(data) {
  return request({
    url: '/chargingstation/stationgrade',
    method: 'post',
    data: data
  })
}

// 修改评分管理
export function updateStationgrade(data) {
  return request({
    url: '/chargingstation/stationgrade',
    method: 'put',
    data: data
  })
}

// 删除评分管理
export function delStationgrade(id) {
  return request({
    url: '/chargingstation/stationgrade/' + id,
    method: 'delete'
  })
}
