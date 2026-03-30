import { request } from '../request'

export const windowApi = {
  getWindows() {
    return request({
      url: '/windows',
      silent: true
    })
  }
}
