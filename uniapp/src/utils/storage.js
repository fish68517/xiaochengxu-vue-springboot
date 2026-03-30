const TOKEN_KEY = 'token'
const USER_INFO_KEY = 'userInfo'

export const getToken = () => uni.getStorageSync(TOKEN_KEY) || ''

export const setToken = (token) => {
  uni.setStorageSync(TOKEN_KEY, token || '')
}

export const getUserInfo = () => {
  return uni.getStorageSync(USER_INFO_KEY) || {}
}

export const setUserInfo = (userInfo) => {
  uni.setStorageSync(USER_INFO_KEY, userInfo || {})
}

export const clearAuth = () => {
  uni.removeStorageSync(TOKEN_KEY)
  uni.removeStorageSync(USER_INFO_KEY)
}
