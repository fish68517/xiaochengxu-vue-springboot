import request from '@/utils/request'

// 查询故障分类列表
export function listBreaktype(query) {
  return request({
    url: '/breaks/breaktype/list',
    method: 'get',
    params: query
  })
}

// 查询故障分类详细
export function getBreaktype(id) {
  return request({
    url: '/breaks/breaktype/' + id,
    method: 'get'
  })
}

// 新增故障分类
export function addBreaktype(data) {
  return request({
    url: '/breaks/breaktype',
    method: 'post',
    data: data
  })
}

// 修改故障分类
export function updateBreaktype(data) {
  return request({
    url: '/breaks/breaktype',
    method: 'put',
    data: data
  })
}

// 删除故障分类
export function delBreaktype(id) {
  return request({
    url: '/breaks/breaktype/' + id,
    method: 'delete'
  })
}
