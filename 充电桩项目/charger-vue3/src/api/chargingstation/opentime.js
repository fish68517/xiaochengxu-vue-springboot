import request from '@/utils/request'

// 查询开放时间列表
export function listOpentime(query) {
  return request({
    url: '/chargingstation/opentime/list',
    method: 'get',
    params: query
  })
}

// 查询开放时间详细
export function getOpentime(id) {
  return request({
    url: '/chargingstation/opentime/' + id,
    method: 'get'
  })
}

// 新增开放时间
export function addOpentime(data) {
  return request({
    url: '/chargingstation/opentime',
    method: 'post',
    data: data
  })
}

// 修改开放时间
export function updateOpentime(data) {
  return request({
    url: '/chargingstation/opentime',
    method: 'put',
    data: data
  })
}

// 删除开放时间
export function delOpentime(id) {
  return request({
    url: '/chargingstation/opentime/' + id,
    method: 'delete'
  })
}
