const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1'

interface RequestOptions {
  method?: UniApp.RequestOptions['method']
  data?: UniApp.RequestOptions['data']
}

export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
  }
}

export function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}${path}`,
      method: options.method || 'GET',
      data: options.data,
      timeout: 10000,
      header: { 'Content-Type': 'application/json', 'X-Demo-User': '1' },
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data as T)
          return
        }
        const payload = response.data as { detail?: { message?: string } | string }
        const detail = typeof payload?.detail === 'string' ? payload.detail : payload?.detail?.message
        reject(new ApiError(response.statusCode, detail || '请求失败'))
      },
      fail(error) {
        reject(new ApiError(0, error.errMsg || '无法连接本地 API，请确认后端已启动'))
      },
    })
  })
}
