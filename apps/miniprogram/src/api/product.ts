import { request } from './http'
import type { Category, Product } from '@/models'

export const getCategories = () => request<Category[]>('/categories')

export const getProducts = (category?: string, keyword?: string, sortBy = 'default') =>
  request<Product[]>(`/products?category=${encodeURIComponent(category || '全部')}&keyword=${encodeURIComponent(keyword || '')}&sort_by=${encodeURIComponent(sortBy)}`)

export const getProduct = (id: number) => request<Product>(`/products/${id}`)
export const getFavorite = (id: number) => request<{ product_id: number; favorite: boolean }>(`/products/${id}/favorite`)
export const addFavorite = (id: number) => request<{ product_id: number; favorite: boolean }>(`/products/${id}/favorite`, { method: 'PUT' })
export const removeFavorite = (id: number) => request<{ product_id: number; favorite: boolean }>(`/products/${id}/favorite`, { method: 'DELETE' })
