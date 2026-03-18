import request from '@/utils/request'

// 查询全体员工列表
export function listStaff(query) {
  return request({
    url: '/staff/staff/list',
    method: 'get',
    params: query
  })
}

// 查询全体员工详细
export function getStaff(id) {
  return request({
    url: '/staff/staff/' + id,
    method: 'get'
  })
}

// 新增全体员工
export function addStaff(data) {
  return request({
    url: '/staff/staff',
    method: 'post',
    data: data
  })
}

// 修改全体员工
export function updateStaff(data) {
  return request({
    url: '/staff/staff',
    method: 'put',
    data: data
  })
}

// 删除全体员工
export function delStaff(id) {
  return request({
    url: '/staff/staff/' + id,
    method: 'delete'
  })
}
