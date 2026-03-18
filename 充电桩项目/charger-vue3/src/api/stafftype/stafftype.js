import request from '@/utils/request'

// 查询员工信息列表
export function listStafftype(query) {
  return request({
    url: '/stafftype/stafftype/list',
    method: 'get',
    params: query
  })
}

// 查询员工信息详细
export function getStafftype(id) {
  return request({
    url: '/stafftype/stafftype/' + id,
    method: 'get'
  })
}

// 新增员工信息
export function addStafftype(data) {
  return request({
    url: '/stafftype/stafftype',
    method: 'post',
    data: data
  })
}

// 修改员工信息
export function updateStafftype(data) {
  return request({
    url: '/stafftype/stafftype',
    method: 'put',
    data: data
  })
}

// 删除员工信息
export function delStafftype(id) {
  return request({
    url: '/stafftype/stafftype/' + id,
    method: 'delete'
  })
}
