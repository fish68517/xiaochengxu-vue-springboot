import { getToken } from './storage'

export const ensureLoggedIn = () => {
  if (!getToken()) {
    uni.reLaunch({
      url: '/pages/auth/login'
    })
    return false
  }

  return true
}
