import request from '@/utils/request'

// 查询车辆类型列表
export function listCarmodel(query) {
  return request({
    url: '/car/carmodel/list',
    method: 'get',
    params: query
  })
}

// 查询车辆类型详细
export function getCarmodel(id) {
  return request({
    url: '/car/carmodel/' + id,
    method: 'get'
  })
}

// 新增车辆类型
export function addCarmodel(data) {
  return request({
    url: '/car/carmodel',
    method: 'post',
    data: data
  })
}

// 修改车辆类型
export function updateCarmodel(data) {
  return request({
    url: '/car/carmodel',
    method: 'put',
    data: data
  })
}

// 删除车辆类型
export function delCarmodel(id) {
  return request({
    url: '/car/carmodel/' + id,
    method: 'delete'
  })
}
