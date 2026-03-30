import { request } from '../request'

export const userApi = {
  login(data) {
    return request({
      url: '/users/login',
      method: 'POST',
      data,
      includeUserId: false
    })
  },
  logout() {
    return request({
      url: '/users/logout',
      method: 'POST',
      silent: true
    })
  },
  register(data) {
    return request({
      url: '/users',
      method: 'POST',
      data,
      includeUserId: false
    })
  },
  getUserInfo() {
    return request({
      url: '/users/info'
    })
  },
  updateUserInfo(data) {
    return request({
      url: '/users/info',
      method: 'PUT',
      data
    })
  }
}
