import { request } from './http'
import type { Address } from '@/models'

export type AddressInput = Omit<Address, 'id'>

export const getAddresses = () => request<Address[]>('/addresses')
export const createAddress = (data: AddressInput) => request<Address>('/addresses', { method: 'POST', data })
export const updateAddress = (id: number, data: AddressInput) => request<Address>(`/addresses/${id}`, { method: 'PUT', data })
export const setDefaultAddress = (id: number) => request<Address>(`/addresses/${id}/default`, { method: 'PUT' })
export const deleteAddress = (id: number) => request<void>(`/addresses/${id}`, { method: 'DELETE' })
