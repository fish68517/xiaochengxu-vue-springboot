import request from '@/utils/request'

// 查询支出管理列表
export function listOutlay(query) {
  return request({
    url: '/mapper/outlay/list',
    method: 'get',
    params: query
  })
}

// 查询支出管理详细
export function getOutlay(id) {
  return request({
    url: '/mapper/outlay/' + id,
    method: 'get'
  })
}

// 新增支出管理
export function addOutlay(data) {
  return request({
    url: '/mapper/outlay',
    method: 'post',
    data: data
  })
}

// 修改支出管理
export function updateOutlay(data) {
  return request({
    url: '/mapper/outlay',
    method: 'put',
    data: data
  })
}

// 删除支出管理
export function delOutlay(id) {
  return request({
    url: '/mapper/outlay/' + id,
    method: 'delete'
  })
}
