import axios from 'axios'
import { ElMessage } from 'element-plus'

// 鍒涘缓axios瀹炰緥
const request = axios.create({
  baseURL: '/api',
  timeout: 5000
})

// 璇锋眰鎷︽埅鍣?
// 璇锋眰鎷︽埅鍣?
request.interceptors.request.use(
    config => {
      const token = localStorage.getItem('token');
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }

      // 鍦ㄨ姹傚彂閫佸墠娣诲姞 userId
      if (userInfo?.id) {
        config.params = {
          ...config.params,
          userId: userInfo.id
        };
      }

      return config;
    },
    error => {
      return Promise.reject(error);
    }
);

// 鍝嶅簲鎷︽埅鍣?
request.interceptors.response.use(
  response => {
    return response.data
  },
  error => {
    ElMessage.error(error.response?.data?.message || '璇锋眰澶辫触')
    return Promise.reject(error)
  }
)

// 鐢ㄦ埛鐩稿叧鎺ュ彛
export const userApi = {
  login: (data) => request.post('/users/login', data),
  logout: () => request.post('/users/logout'),
  register: (data) => request.post('/users/register', data),
  getUserInfo: () => request.get('/users/info'),
  updateUserInfo: (data) => request.put('/users/info', data),
  createUser: (data) => request.post('/users', data),
  getUsers(params) {
        return request.get('/users', { params })
    }
}

// 鑿滃搧鐩稿叧鎺ュ彛
export const recipeApi = {
  getCategories: () => request.get('/categories'),
  getRecipeList: (params) => request.get('/recipes', { params }),
  getRecipeById: (id) => request.get(`/recipes/${id}`),
  getRecipesByCategory: (categoryId) => request.get(`/recipes/category/${categoryId}`),
  searchRecipes: (keyword) => request.get('/recipes/search', { 
    params: { keyword }  // 浣跨敤 params 浼犻€掓煡璇㈠弬鏁?
  }),

  // 馃憞 琛ュ厖缂哄け鐨勫銆佸垹銆佹敼鎺ュ彛
  createRecipe: (data) => request.post('/recipes', data),
  
  // 鏇存柊鑿滆氨銆傛敞鎰忥細杩欓噷鐨?URL 璺緞闇€瑕佹牴鎹綘鐨?SpringBoot 鍚庣 Controller 瀹為檯瀹氫箟鐨勮矾寰勬潵鍐欍€?
  // 濡傛灉鍚庣鏄?@PutMapping("/recipes") 鍒欑敤 request.put('/recipes', data)
  // 濡傛灉鍚庣鏄?@PutMapping("/recipes/{id}") 鍒欑敤涓嬮潰鐨勫啓娉曪細
  updateRecipe: (data) => request.put(data.id ? `/recipes/${data.id}` : '/recipes', data),
  deleteRecipe: (id) => request.delete(`/recipes/${id}`)
}

// 璐墿杞︾浉鍏虫帴鍙?
export const cartApi = {
  getCartList: () => request.get('/cart/user'),
  addToCart: (data) => request.post('/cart', data),
  updateCartItem: (id, data) => request.put(`/cart/${id}`, data),
  removeFromCart: (id) => request.delete(`/cart/${id}`),
  clearCart: () => request.delete('/cart/user')
}

// 璁㈠崟鐩稿叧鎺ュ彛
export const orderApi = {
  getOrderList: (params) => {
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}')
    if (userInfo.role === 'admin') {
      return request.get('/orders/admin', { params })
    }
    if (userInfo.role === 'merchant') {
      return request.get('/orders/merchant', { params })
    }
    return request.get('/orders/user', { params })
  },
  getOrderDetail: (id) => request.get(`/orders/${id}`),
  getWaitingCount: () => request.get('/orders/waiting-count'),
  createOrder: (data) => request.post('/orders', data),
  updateOrderStatus: (id, status) => request.put(`/orders/${id}/status`, { status })
}

// 璇勪环鐩稿叧鎺ュ彛
export const reviewApi = {
  getRecipeReviews: (recipeId) => request.get(`/reviews/recipe/${recipeId}`),
  addReview: (data) => request.post('/reviews', data),
  updateReview: (id, data) => request.put(`/reviews/${id}`, data),
  deleteReview: (id) => request.delete(`/reviews/${id}`),
    getReviewList(params) {
        return request.get('/reviews', { params })
    }
}

// 缁熻鐩稿叧鎺ュ彛
export const statsApi = {
  getDashboardStats: () => request.get('/stats/dashboard')
}

// 鏀惰棌鐩稿叧鎺ュ彛
export const favoriteApi = {
  getFavorites: () => request.get('/favorites/user'),
  addFavorite: (recipeId) => request.post(`/favorites/${recipeId}`),
  removeFavorite: (recipeId) => request.delete(`/favorites/${recipeId}`),
  checkFavorite: (recipeId) => request.get(`/favorites/check/${recipeId}`)
}

// 鎺ㄨ崘鐩稿叧鎺ュ彛
export const recommendApi = {
  getRecommendedRecipes: () => request.get('/recommend'),
  getHotRecipes: () => request.get('/recommend/hot')
}

export const windowApi = {
  getWindows: () => request.get('/windows')
}

// 璇勮鐩稿叧鎺ュ彛
export const commentApi = {
  // 鑾峰彇鑿滆氨璇勮鍒楄〃
  getCommentsByRecipe: (recipeId) => {
    return request({
      url: `/api/comments/recipe/${recipeId}`,
      method: 'get'
    })
  },
  
  // 娣诲姞璇勮
  addComment: (data) => {
    return request({
      url: '/api/comments',
      method: 'post',
      data: {
        recipeId: data.recipeId,
        content: data.content,
        rating: data.rating
      }
    })
  },
  
  // 鍒犻櫎璇勮
  deleteComment: (commentId) => {
    return request({
      url: `/api/comments/${commentId}`,
      method: 'delete'
    })
  },
  
  // 鐐硅禐璇勮
  likeComment: (commentId) => {
    return request({
      url: `/api/comments/${commentId}/like`,
      method: 'post'
    })
  },
  
  // 鍙栨秷鐐硅禐璇勮
  unlikeComment: (commentId) => {
    return request({
      url: `/api/comments/${commentId}/like`,
      method: 'delete'
    })
  },
  
  // 妫€鏌ユ槸鍚﹀凡鐐硅禐璇勮
  checkCommentLike: (commentId) => {
    return request({
      url: `/api/comments/${commentId}/like`,
      method: 'get'
    })
  }
}





