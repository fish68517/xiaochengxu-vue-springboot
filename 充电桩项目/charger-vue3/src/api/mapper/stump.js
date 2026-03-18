import request from '@/utils/request'

// 查询充电桩信息列表
export function listStump(query) {
  return request({
    url: '/mapper/stump/list',
    method: 'get',
    params: query
  })
}

// 查询充电桩信息详细
export function getStump(id) {
  return request({
    url: '/mapper/stump/' + id,
    method: 'get'
  })
}

// 新增充电桩信息
export function addStump(data) {
  return request({
    url: '/mapper/stump',
    method: 'post',
    data: data
  })
}

// 修改充电桩信息
export function updateStump(data) {
  return request({
    url: '/mapper/stump',
    method: 'put',
    data: data
  })
}

// 删除充电桩信息
export function delStump(id) {
  return request({
    url: '/mapper/stump/' + id,
    method: 'delete'
  })
}
