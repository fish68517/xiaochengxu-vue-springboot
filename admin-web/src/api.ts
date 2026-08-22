import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response.data.data,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem('admin_token')
      window.dispatchEvent(new Event('admin-auth-expired'))
    }
    return Promise.reject(error)
  },
)

const get = <T>(url: string) => api.get(url) as unknown as Promise<T>
const post = <T>(url: string, data?: unknown) => api.post(url, data) as unknown as Promise<T>
const put = <T>(url: string, data?: unknown) => api.put(url, data) as unknown as Promise<T>
const del = <T>(url: string) => api.delete(url) as unknown as Promise<T>

export const login = (username:string,password:string) => post<any>('/auth/login',{username,password})
export const getMe = () => get<any>('/auth/me')
export const getDashboard = () => get<any>('/admin/dashboard')
export const getBills = () => get<any[]>('/admin/bills')
export const createBill = (data:any) => post<any>('/admin/bills',data)
export const getFeeItems = () => get<any[]>('/admin/fee-items')
export const createFeeItem = (data:any) => post<any>('/admin/fee-items',data)
export const updateFeeItem = (id:number,data:any) => put<any>(`/admin/fee-items/${id}`,data)
export const getNotices = () => get<any[]>('/notices')
export const createNotice = (data:any) => post<any>('/admin/notices',data)
export const updateNotice = (id:number,data:any) => put<any>(`/admin/notices/${id}`,data)
export const deleteNotice = (id:number) => del<any>(`/admin/notices/${id}`)
export const getRepairs = () => get<any[]>('/admin/repairs')
export const assignRepair = (id:number,technicianId:number) => put<any>(`/admin/repairs/${id}/assign`,{technicianId})
export const getMaintenance = () => get<any[]>('/maintenance-records')
export const createMaintenance = (data:any) => post<any>('/admin/maintenance-records',data)
export const deleteMaintenance = (id:number) => del<any>(`/admin/maintenance-records/${id}`)
export const getRenovations = () => get<any[]>('/admin/renovations')
export const updateRenovationStatus = (id:number,status:string) => put<any>(`/admin/renovations/${id}/status`,{status})
export const getPayments = () => get<any[]>('/admin/payments')
export const confirmPayment = (id:number,referenceNo='') => post<any>(`/admin/payments/${id}/confirm`,{referenceNo})
export const getReceipts = () => get<any[]>('/admin/receipts')
export const updateReceiptStatus = (id:number,status:string) => put<any>(`/admin/receipts/${id}/status`,{status})
export const getUsers = () => get<any[]>('/admin/users')
export const createUser = (data:any) => post<any>('/admin/users',data)
export const updateUser = (id:number,data:any) => put<any>(`/admin/users/${id}`,data)
export const getBuildings = () => get<any[]>('/admin/buildings')
export const createBuilding = (data:any) => post<any>('/admin/buildings',data)
export const getHouses = () => get<any[]>('/admin/houses')
export const createHouse = (data:any) => post<any>('/admin/houses',data)
export const getOutbox = () => get<any[]>('/admin/notification-outbox')
export const uploadAsset = (file:File,folder='common') => {
  const body = new FormData()
  body.append('file',file)
  return post<any>(`/uploads?folder=${encodeURIComponent(folder)}`,body)
}
export const parseImport = (file: File) => {
  const body = new FormData()
  body.append('file', file)
  return post<any>('/admin/billing-imports/parse', body)
}
export const commitImport = (batchId: number) => post<any>(`/admin/billing-imports/${batchId}/commit`)
