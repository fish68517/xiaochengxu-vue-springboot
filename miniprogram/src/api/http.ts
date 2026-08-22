const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

interface ApiResponse<T> { code:number; message:string; data:T }
type RequestOptions = Omit<UniApp.RequestOptions,'url'> & { auth?: boolean }

export function request<T>(path:string, options:RequestOptions = {} as RequestOptions):Promise<T> {
  const token = uni.getStorageSync('access_token')
  const { auth = true, ...requestOptions } = options
  return new Promise((resolve,reject) => {
    uni.request({
      ...requestOptions,
      url: `${API_BASE_URL}${path}`,
      header: {
        'content-type':'application/json',
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
        ...(requestOptions.header || {}),
      },
      success: (result) => {
        const body = result.data as ApiResponse<T> | { detail?:string }
        if (result.statusCode >= 200 && result.statusCode < 300 && 'data' in body) return resolve(body.data)
        const message = 'detail' in body ? body.detail || '请求失败' : '请求失败'
        if (result.statusCode === 401 && auth) {
          uni.removeStorageSync('access_token')
          uni.reLaunch({ url:'/pages/login/index' })
        }
        uni.showToast({ title:message, icon:'none' })
        reject(new Error(message))
      },
      fail: (error) => {
        uni.showToast({ title:'API连接失败，请检查后端服务', icon:'none' })
        reject(error)
      },
    })
  })
}

export function uploadFile(filePath:string, folder='common'):Promise<any> {
  const token = uni.getStorageSync('access_token')
  return new Promise((resolve,reject) => {
    uni.uploadFile({
      url:`${API_BASE_URL}/uploads?folder=${encodeURIComponent(folder)}`,
      filePath,
      name:'file',
      header:{ Authorization:`Bearer ${token}` },
      success:(result) => {
        try {
          const body = JSON.parse(result.data) as ApiResponse<any> | { detail?:string }
          if (result.statusCode >= 200 && result.statusCode < 300 && 'data' in body) return resolve(body.data)
          reject(new Error('detail' in body ? body.detail || '上传失败' : '上传失败'))
        } catch (error) { reject(error) }
      },
      fail:reject,
    })
  })
}

export const api = {
  login: (username:string,password:string) => request<any>('/auth/login',{ method:'POST',data:{username,password},auth:false }),
  me: () => request<any>('/auth/me'),
  logout: () => request<any>('/auth/logout',{method:'POST'}),
  bills: () => request<any[]>('/bills/my'),
  bill: (id:number) => request<any>(`/bills/${id}`),
  requestPayment: (billId:number) => request<any>('/payments/manual-request',{ method:'POST',data:{billId} }),
  payments: () => request<any[]>('/payments/my'),
  receipts: () => request<any[]>('/receipts/my'),
  applyReceipt: (data:any) => request<any>('/receipts',{ method:'POST',data }),
  repairs: () => request<any[]>('/repairs/my'),
  createRepair: (data:any) => request<any>('/repairs',{ method:'POST',data }),
  maintenance: () => request<any[]>('/maintenance-records'),
  notices: () => request<any[]>('/notices'),
  renovations: () => request<any[]>('/renovations/my'),
  createRenovation: (data:any) => request<any>('/renovations',{method:'POST',data}),
  technicianRepairs: () => request<any[]>('/technician/repairs'),
  technicianAction: (id:number,action:string,text='') => request<any>(`/technician/repairs/${id}/action`,{method:'POST',data:{action,text}}),
}
