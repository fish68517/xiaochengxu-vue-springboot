import request from '@/utils/request'

// 查询故障管理列表
export function listBreakdown(query) {
  return request({
    url: '/breaks/breakdown/list',
    method: 'get',
    params: query
  })
}

// 查询故障管理详细
export function getBreakdown(id) {
  return request({
    url: '/breaks/breakdown/' + id,
    method: 'get'
  })
}

// 新增故障管理
export function addBreakdown(data) {
  return request({
    url: '/breaks/breakdown',
    method: 'post',
    data: data
  })
}

// 修改故障管理
export function updateBreakdown(data) {
  return request({
    url: '/breaks/breakdown',
    method: 'put',
    data: data
  })
}

// 删除故障管理
export function delBreakdown(id) {
  return request({
    url: '/breaks/breakdown/' + id,
    method: 'delete'
  })
}
