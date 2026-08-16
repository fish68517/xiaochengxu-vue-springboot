import { request } from './http'
import type { Order } from '@/models'

export interface CreateOrderInput {
  product_id: number
  quantity: number
  use_coupon: boolean
  address_name: string
  address_phone: string
  address_detail: string
}

export const createOrder = (data: CreateOrderInput) => request<Order>('/orders', { method: 'POST', data })
export const localPay = (id: number) => request<Order>(`/payments/local/${id}`, { method: 'POST' })
export const getOrders = () => request<Order[]>('/orders')
