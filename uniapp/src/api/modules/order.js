import { request } from '../request'

export const orderApi = {
  getOrderList(params = {}) {
    return request({
      url: '/orders/user',
      data: params
    })
  },
  getWaitingCount() {
    return request({
      url: '/orders/waiting-count',
      silent: true
    })
  },
  createOrder(data) {
    return request({
      url: '/orders',
      method: 'POST',
      data
    })
  },
  updateOrderStatus(id, status) {
    return request({
      url: `/orders/${id}/status`,
      method: 'PUT',
      data: { status }
    })
  }
}
