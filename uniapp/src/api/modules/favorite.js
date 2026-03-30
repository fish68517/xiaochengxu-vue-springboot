import { request } from '../request'

export const favoriteApi = {
  getFavorites() {
    return request({
      url: '/favorites/user'
    })
  },
  addFavorite(recipeId) {
    return request({
      url: `/favorites/${recipeId}`,
      method: 'POST'
    })
  },
  removeFavorite(recipeId) {
    return request({
      url: `/favorites/${recipeId}`,
      method: 'DELETE'
    })
  },
  checkFavorite(recipeId) {
    return request({
      url: `/favorites/check/${recipeId}`,
      silent: true
    })
  }
}
