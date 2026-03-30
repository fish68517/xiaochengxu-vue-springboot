import { API_BASE_URL } from '../utils/config'
import { clearAuth, getToken, getUserInfo } from '../utils/storage'

const redirectToLogin = () => {
  const pages = getCurrentPages()
  const currentRoute = pages.length ? `/${pages[pages.length - 1].route}` : ''
  if (currentRoute === '/pages/auth/login') return
  uni.reLaunch({
    url: '/pages/auth/login'
  })
}

const showErrorToast = (message) => {
  uni.showToast({
    title: message || '请求失败',
    icon: 'none'
  })
}

const extractErrorMessage = (body, fallback) => {
  if (typeof body === 'string' && body.trim()) return body
  if (body?.message) return body.message
  return fallback
}

const buildUrl = (path, query = {}) => {
  const entries = Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '')
  if (!entries.length) return `${API_BASE_URL}${path}`

  const queryString = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')

  return `${API_BASE_URL}${path}${path.includes('?') ? '&' : '?'}${queryString}`
}

export const request = ({
  url,
  method = 'GET',
  data = {},
  header = {},
  silent = false,
  includeUserId = true,
  query = {}
}) => {
  const token = getToken()
  const userInfo = getUserInfo()
  const requestQuery = { ...query }

  if (includeUserId && userInfo?.id) {
    requestQuery.userId = userInfo.id
  }

  const finalUrl = buildUrl(url, requestQuery)

  return new Promise((resolve, reject) => {
    uni.request({
      url: finalUrl,
      method,
      data,
      timeout: 10000,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...header
      },
      success: (response) => {
        const { statusCode, data: body } = response

        if (statusCode === 401 || body?.code === 401) {
          clearAuth()
          if (!silent) {
            showErrorToast(extractErrorMessage(body, '登录已失效，请重新登录'))
          }
          redirectToLogin()
          reject(body)
          return
        }

        if (statusCode < 200 || statusCode >= 300) {
          if (!silent) {
            showErrorToast(extractErrorMessage(body, `请求失败(${statusCode})`))
          }
          reject(body)
          return
        }

        if (body && typeof body === 'object' && 'code' in body && body.code !== 200) {
          if (!silent) {
            showErrorToast(extractErrorMessage(body, '业务处理失败'))
          }
          reject(body)
          return
        }

        resolve(body)
      },
      fail: (error) => {
        if (!silent) {
          showErrorToast('网络异常，请稍后再试')
        }
        reject(error)
      }
    })
  })
}
