import request from '@/utils/request'
//充值用户钱包金额
export function recharge(data) {
  return request({
      url: '/mamber/record/recharge',
    method: 'post',
    data: data
  })

}
//消费用户钱包金额
export function expense(data) {
  return request({
      url: '/mamber/record/expense',
    method: 'post',
    data: data
  })
}
