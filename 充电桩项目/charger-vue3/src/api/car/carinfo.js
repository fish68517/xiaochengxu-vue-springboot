import request from '@/utils/request'

// 查询车辆信息列表
export function listCarinfo(query) {
  return request({
    url: '/car/carinfo/list',
    method: 'get',
    params: query
  })
}

// 查询车辆信息详细
export function getCarinfo(id) {
  return request({
    url: '/car/carinfo/' + id,
    method: 'get'
  })
}

// 新增车辆信息
export function addCarinfo(data) {
  return request({
    url: '/car/carinfo',
    method: 'post',
    data: data
  })
}

// 修改车辆信息
export function updateCarinfo(data) {
  return request({
    url: '/car/carinfo',
    method: 'put',
    data: data
  })
}

// 删除车辆信息
export function delCarinfo(id) {
  return request({
    url: '/car/carinfo/' + id,
    method: 'delete'
  })
}
