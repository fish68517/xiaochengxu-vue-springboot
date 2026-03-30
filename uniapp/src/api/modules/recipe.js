import { request } from '../request'

export const recipeApi = {
  getCategories() {
    return request({
      url: '/categories'
    })
  },
  getRecipeList(params) {
    return request({
      url: '/recipes',
      data: params
    })
  },
  getRecipeById(id) {
    return request({
      url: `/recipes/${id}`
    })
  },
  getRecipesByCategory(categoryId) {
    return request({
      url: `/recipes/category/${categoryId}`
    })
  },
  searchRecipes(keyword) {
    return request({
      url: '/recipes/search',
      data: { keyword }
    })
  }
}
