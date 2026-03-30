import { request } from '../request'

export const recommendApi = {
  getRecommendedRecipes() {
    return request({
      url: '/recommend',
      silent: true
    })
  },
  getHotRecipes() {
    return request({
      url: '/recommend/hot',
      silent: true
    })
  }
}
