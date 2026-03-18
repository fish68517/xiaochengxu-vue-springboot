import request from '@/utils/request'

// 查询银行卡表列表
export function listBankcard(query) {
  return request({
    url: '/member/bankcard/list',
    method: 'get',
    params: query
  })
}

// 查询银行卡表详细
export function getBankcard(id) {
  return request({
    url: '/member/bankcard/' + id,
    method: 'get'
  })
}

// 新增银行卡表
export function addBankcard(data) {
  return request({
    url: '/member/bankcard',
    method: 'post',
    data: data
  })
}

// 修改银行卡表
export function updateBankcard(data) {
  return request({
    url: '/member/bankcard',
    method: 'put',
    data: data
  })
}

// 删除银行卡表
export function delBankcard(id) {
  return request({
    url: '/member/bankcard/' + id,
    method: 'delete'
  })
}
