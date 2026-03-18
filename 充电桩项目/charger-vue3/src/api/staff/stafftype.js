import request from '@/utils/request'

// 查询员工类型列表
export function listStafftype(query) {
  return request({
    url: '/staff/stafftype/list',
    method: 'get',
    params: query
  })
}

// 查询员工类型详细
export function getStafftype(id) {
  return request({
    url: '/staff/stafftype/' + id,
    method: 'get'
  })
}

// 新增员工类型
export function addStafftype(data) {
  return request({
    url: '/staff/stafftype',
    method: 'post',
    data: data
  })
}

// 修改员工类型
export function updateStafftype(data) {
  return request({
    url: '/staff/stafftype',
    method: 'put',
    data: data
  })
}

// 删除员工类型
export function delStafftype(id) {
  return request({
    url: '/staff/stafftype/' + id,
    method: 'delete'
  })
}
