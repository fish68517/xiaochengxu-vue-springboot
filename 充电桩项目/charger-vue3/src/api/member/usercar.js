import request from '@/utils/request'

// 查询用户车辆列表
export function listUsercar(query) {
  return request({
    url: '/member/usercar/list',
    method: 'get',
    params: query
  })
}

// 查询用户车辆详细
export function getUsercar(id) {
  return request({
    url: '/member/usercar/' + id,
    method: 'get'
  })
}

// 新增用户车辆
export function addUsercar(data) {
  return request({
    url: '/member/usercar',
    method: 'post',
    data: data
  })
}

// 修改用户车辆
export function updateUsercar(data) {
  return request({
    url: '/member/usercar',
    method: 'put',
    data: data
  })
}

// 删除用户车辆
export function delUsercar(id) {
  return request({
    url: '/member/usercar/' + id,
    method: 'delete'
  })
}
