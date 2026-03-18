import request from '@/utils/request'

// 查询用户搜索列表
export function listSearchrecord(query) {
  return request({
    url: '/SC/searchrecord/list',
    method: 'get',
    params: query
  })
}

// 查询用户搜索详细
export function getSearchrecord(id) {
  return request({
    url: '/SC/searchrecord/' + id,
    method: 'get'
  })
}

// 新增用户搜索
export function addSearchrecord(data) {
  return request({
    url: '/SC/searchrecord',
    method: 'post',
    data: data
  })
}

// 修改用户搜索
export function updateSearchrecord(data) {
  return request({
    url: '/SC/searchrecord',
    method: 'put',
    data: data
  })
}

// 删除用户搜索
export function delSearchrecord(id) {
  return request({
    url: '/SC/searchrecord/' + id,
    method: 'delete'
  })
}
