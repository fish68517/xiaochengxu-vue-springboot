import { request } from './http'
import type { CartItem } from '@/models'

export const getCart = () => request<CartItem[]>('/cart')
export const addCartItem = (productId: number, quantity = 1) =>
  request<CartItem>('/cart/items', { method: 'POST', data: { product_id: productId, quantity } })
export const updateCartItem = (id: number, quantity: number) =>
  request<CartItem>(`/cart/items/${id}`, { method: 'PUT', data: { quantity } })
export const deleteCartItem = (id: number) => request<void>(`/cart/items/${id}`, { method: 'DELETE' })
