import request from '@/utils/request'

// 查询常见问题列表
export function listQuestion(query) {
  return request({
    url: '/breaks/question/list',
    method: 'get',
    params: query
  })
}

// 查询常见问题详细
export function getQuestion(id) {
  return request({
    url: '/breaks/question/' + id,
    method: 'get'
  })
}

// 新增常见问题
export function addQuestion(data) {
  return request({
    url: '/breaks/question',
    method: 'post',
    data: data
  })
}

// 修改常见问题
export function updateQuestion(data) {
  return request({
    url: '/breaks/question',
    method: 'put',
    data: data
  })
}

// 删除常见问题
export function delQuestion(id) {
  return request({
    url: '/breaks/question/' + id,
    method: 'delete'
  })
}
