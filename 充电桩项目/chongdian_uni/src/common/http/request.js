import { API_BASE_URL, TOKEN_KEY } from '../config'

function normalizeHeaders(headers = {}) {
  const token = uni.getStorageSync(TOKEN_KEY)
  if (token) {
    return {
      ...headers,
      Authorization: token
    }
  }
  return headers
}

export function request(options) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${API_BASE_URL}/${options.url.replace(/^\//, '')}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: normalizeHeaders(options.header),
      success: (res) => {
        const payload = res.data || {}
        if (payload.code === 200 || payload.code === undefined) {
          resolve(payload)
          return
        }
        const msg = payload.msg || `请求失败(${payload.code})`
        reject(new Error(msg))
      },
      fail: (err) => {
        reject(new Error(err.errMsg || '网络异常'))
      }
    })
  })
}

export function post(url, data, header) {
  return request({ url, method: 'POST', data, header })
}

export function get(url, data, header) {
  return request({ url, method: 'GET', data, header })
}

export function put(url, data, header) {
  return request({ url, method: 'PUT', data, header })
}

export function del(url, data, header) {
  return request({ url, method: 'DELETE', data, header })
}
