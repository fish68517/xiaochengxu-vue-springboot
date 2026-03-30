import { request } from '../request'

export const reviewApi = {
  getRecipeReviews(recipeId) {
    return request({
      url: `/reviews/recipe/${recipeId}`,
      includeUserId: false
    })
  },
  addReview(data) {
    return request({
      url: '/reviews',
      method: 'POST',
      data
    })
  },
  updateReview(id, data) {
    return request({
      url: `/reviews/${id}`,
      method: 'PUT',
      data
    })
  },
  deleteReview(id) {
    return request({
      url: `/reviews/${id}`,
      method: 'DELETE'
    })
  }
}
