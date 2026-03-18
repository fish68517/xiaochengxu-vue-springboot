import { get, post, put } from '../common/http/request'

export function createOrder(data) {
  return post('chargingstation/order', data)
}

export function fetchOrderById(id) {
  return get(`chargingstation/order/${id}`)
}

export function fetchOrderList(params = {}) {
  return get('chargingstation/order/list', params)
}

export function updateOrder(data) {
  return put('chargingstation/order', data)
}

export function createOutlay(data) {
  return post('member/outlay', data)
}
