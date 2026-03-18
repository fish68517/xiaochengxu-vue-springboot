import request from '@/utils/request'

// 查询答案管理列表
export function listAnswer(query) {
  return request({
    url: '/breaks/answer/list',
    method: 'get',
    params: query
  })
}

// 查询答案管理详细
export function getAnswer(id) {
  return request({
    url: '/breaks/answer/' + id,
    method: 'get'
  })
}

// 新增答案管理
export function addAnswer(data) {
  return request({
    url: '/breaks/answer',
    method: 'post',
    data: data
  })
}

// 修改答案管理
export function updateAnswer(data) {
  return request({
    url: '/breaks/answer',
    method: 'put',
    data: data
  })
}

// 删除答案管理
export function delAnswer(id) {
  return request({
    url: '/breaks/answer/' + id,
    method: 'delete'
  })
}
