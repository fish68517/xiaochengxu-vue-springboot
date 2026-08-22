import { request } from './http'
import type { User } from '@/models'

export interface LoginResult {
  token: string
  token_type: string
  user: User
}

export const login = (username: string, password: string) =>
  request<LoginResult>('/auth/login', { method: 'POST', data: { username, password } })

export const getCurrentUser = () => request<User>('/auth/me')
export const logout = () => request<{ message: string }>('/auth/logout', { method: 'POST' })
