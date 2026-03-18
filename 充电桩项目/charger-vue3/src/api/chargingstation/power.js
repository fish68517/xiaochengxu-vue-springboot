import request from '@/utils/request'

// 查询功率管理列表
export function listPower(query) {
  return request({
    url: '/chargingstation/power/list',
    method: 'get',
    params: query
  })
}

// 查询功率管理详细
export function getPower(id) {
  return request({
    url: '/chargingstation/power/' + id,
    method: 'get'
  })
}

// 新增功率管理
export function addPower(data) {
  return request({
    url: '/chargingstation/power',
    method: 'post',
    data: data
  })
}

// 修改功率管理
export function updatePower(data) {
  return request({
    url: '/chargingstation/power',
    method: 'put',
    data: data
  })
}

// 删除功率管理
export function delPower(id) {
  return request({
    url: '/chargingstation/power/' + id,
    method: 'delete'
  })
}
