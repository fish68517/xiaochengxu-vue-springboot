const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

interface ApiResponse<T> { code:number; message:string; data:T }

export function request<T>(path:string, options:UniApp.RequestOptions = {} as UniApp.RequestOptions):Promise<T> {
  const username = uni.getStorageSync('dev_user') || import.meta.env.VITE_DEFAULT_USER || 'owner_101'
  return new Promise((resolve,reject) => {
    uni.request({
      ...options,
      url: `${API_BASE_URL}${path}`,
      header: { 'content-type':'application/json', 'X-Dev-User': username, ...(options.header || {}) },
      success: (result) => {
        const body = result.data as ApiResponse<T> | { detail?:string }
        if (result.statusCode >= 200 && result.statusCode < 300 && 'data' in body) resolve(body.data)
        else { const message = 'detail' in body ? body.detail || '请求失败' : '请求失败'; uni.showToast({ title:message, icon:'none' }); reject(new Error(message)) }
      },
      fail: (error) => { uni.showToast({ title:'本地 API 连接失败', icon:'none' }); reject(error) },
    })
  })
}

export const api = {
  bills: () => request<any[]>('/bills/my'),
  bill: (id:number) => request<any>(`/bills/${id}`),
  pay: (billId:number,result='success') => request<any>('/payments/mock',{ method:'POST', data:{ billId,result } }),
  receipts: () => request<any[]>('/receipts/my'),
  applyReceipt: (data:any) => request<any>('/receipts',{ method:'POST',data }),
  repairs: () => request<any[]>('/repairs/my'),
  createRepair: (data:any) => request<any>('/repairs',{ method:'POST',data }),
  maintenance: () => request<any[]>('/maintenance-records'),
  notices: () => request<any[]>('/notices'),
  renovations: () => request<any[]>('/renovations/my'),
  technicianRepairs: () => request<any[]>('/technician/repairs'),
  technicianAction: (id:number,action:string,text='') => request<any>(`/technician/repairs/${id}/action`,{method:'POST',data:{action,text}}),
}

