import request from '@/utils/request'

// 查询电站信息列表
export function listChongdianzhan(query) {
  return request({
    url: '/chargingstation/chongdianzhan/list',
    method: 'get',
    params: query
  })
}

// 查询电站信息详细
export function getChongdianzhan(id) {
  return request({
    url: '/chargingstation/chongdianzhan/' + id,
    method: 'get'
  })
}

// 新增电站信息
export function addChongdianzhan(data) {
  return request({
    url: '/chargingstation/chongdianzhan',
    method: 'post',
    data: data
  })
}

// 修改电站信息
export function updateChongdianzhan(data) {
  return request({
    url: '/chargingstation/chongdianzhan',
    method: 'put',
    data: data
  })
}

// 删除电站信息
export function delChongdianzhan(id) {
  return request({
    url: '/chargingstation/chongdianzhan/' + id,
    method: 'delete'
  })
}

// 根据充电站id获取开放时间
export function getOpeningTimesByStationId(stationId) {
  return request({
    url: '/chargingstation/chongdianzhan/getOpeningTimesByStationId/' + stationId,
    method: 'get'
  })
}
export function selectServicesByStationId(stationId) {
  return request({
    url: '/chargingstation/chongdianzhan/selectServicesByStationId/' + stationId,
    method: 'get'
  })
}