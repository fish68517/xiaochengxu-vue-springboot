import { request } from './http'
import type { Coupon, Order, OrderPreview, Payment } from '@/models'

export interface OrderSelectionInput {
  cart_item_ids: number[]
  address_id: number
  user_coupon_id: number | null
  remark?: string
}

export const getAvailableCoupons = () => request<Coupon[]>('/coupons/available')
export const previewOrder = (data: OrderSelectionInput) => request<OrderPreview>('/orders/preview', { method: 'POST', data })
export const createOrder = (data: OrderSelectionInput) => request<Order>('/orders', { method: 'POST', data })
export const getOrders = () => request<Order[]>('/orders')
export const getOrder = (id: number) => request<Order>(`/orders/${id}`)
export const cancelOrder = (id: number) => request<Order>(`/orders/${id}/cancel`, { method: 'POST' })
export const requestPayment = (id: number) => request<Payment>(`/orders/${id}/payment-request`, { method: 'POST' })
export const getPayment = (id: number) => request<Payment>(`/orders/${id}/payment`)
