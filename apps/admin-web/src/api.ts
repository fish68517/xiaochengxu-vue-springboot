import axios from 'axios'

export const TOKEN_KEY = 'pet-life-admin-token'

export const api = axios.create({
  baseURL: import.meta.env.VITE_ADMIN_API_BASE ?? 'http://127.0.0.1:8000/api/v1/admin',
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (detail?.message) return detail.message
    if (error.response?.status === 401) return '登录已失效，请重新登录'
    return error.message
  }
  return error instanceof Error ? error.message : '操作失败'
}
