import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
  headers: { 'X-Dev-User': 'admin_01' },
})

api.interceptors.response.use((response) => response.data.data)

const get = <T>(url: string) => api.get(url) as unknown as Promise<T>
const post = <T>(url: string, data?: unknown) => api.post(url, data) as unknown as Promise<T>

export const getDashboard = () => get<any>('/admin/dashboard')
export const getBills = () => get<any[]>('/admin/bills')
export const getFeeItems = () => get<any[]>('/admin/fee-items')
export const getNotices = () => get<any[]>('/notices')
export const parseImport = (file: File) => {
  const body = new FormData()
  body.append('file', file)
  return post<any>('/admin/billing-imports/parse', body)
}
export const commitImport = (batchId: number) => post<any>(`/admin/billing-imports/${batchId}/commit`)
