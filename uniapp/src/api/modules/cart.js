import { request } from '../request'

export const cartApi = {
  getCartList() {
    return request({
      url: '/cart/user'
    })
  },
  addToCart(data) {
    return request({
      url: '/cart',
      method: 'POST',
      data
    })
  },
  updateCartItem(id, data) {
    return request({
      url: `/cart/${id}`,
      method: 'PUT',
      data
    })
  },
  removeFromCart(id) {
    return request({
      url: `/cart/${id}`,
      method: 'DELETE'
    })
  },
  clearCart() {
    return request({
      url: '/cart/user',
      method: 'DELETE'
    })
  }
}
