import { request } from './http'
import type { Product } from '@/models'

export const getProducts = (category?: string, keyword?: string) =>
  request<Product[]>(`/products?category=${encodeURIComponent(category || '全部')}&keyword=${encodeURIComponent(keyword || '')}`)

export const getProduct = (id: number) => request<Product>(`/products/${id}`)
