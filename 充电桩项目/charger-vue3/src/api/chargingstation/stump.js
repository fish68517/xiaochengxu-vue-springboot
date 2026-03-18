import request from '@/utils/request'

// 查询电桩信息列表
export function listStump(query) {
  return request({
    url: '/chargingstation/stump/list',
    method: 'get',
    params: query
  })
}

// 查询电桩信息详细
export function getStump(id) {
  return request({
    url: '/chargingstation/stump/' + id,
    method: 'get'
  })
}

// 新增电桩信息
export function addStump(data) {
  return request({
    url: '/chargingstation/stump',
    method: 'post',
    data: data
  })
}

// 修改电桩信息
export function updateStump(data) {
  return request({
    url: '/chargingstation/stump',
    method: 'put',
    data: data
  })
}

// 删除电桩信息
export function delStump(id) {
  return request({
    url: '/chargingstation/stump/' + id,
    method: 'delete'
  })
}
//根据充电站id获取充电桩数量
export function stumpCount(chargingstationId) {
  return request({
    url: '/chargingstation/stump/countByChargingstationId/' + chargingstationId,
    method: 'get'
  })
}