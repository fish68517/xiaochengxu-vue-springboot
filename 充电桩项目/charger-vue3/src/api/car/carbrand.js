import request from '@/utils/request'

// 查询车辆品牌列表
export function listCarbrand(query) {
  return request({
    url: '/car/carbrand/list',
    method: 'get',
    params: query
  })
}

// 查询车辆品牌详细
export function getCarbrand(id) {
  return request({
    url: '/car/carbrand/' + id,
    method: 'get'
  })
}

// 新增车辆品牌
export function addCarbrand(data) {
  return request({
    url: '/car/carbrand',
    method: 'post',
    data: data
  })
}

// 修改车辆品牌
export function updateCarbrand(data) {
  return request({
    url: '/car/carbrand',
    method: 'put',
    data: data
  })
}

// 删除车辆品牌
export function delCarbrand(id) {
  return request({
    url: '/car/carbrand/' + id,
    method: 'delete'
  })
}
