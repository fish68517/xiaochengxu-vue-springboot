import { createRouter, createWebHistory } from 'vue-router'
import Favorites from '@/views/user/Favorites.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/login' },
    { path: '/login', component: () => import('../views/Login.vue') },
    { path: '/register', component: () => import('../views/Register.vue') },
    {
      path: '/user',
      component: () => import('../views/user/Layout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: '/user/home' },
        { path: 'home', component: () => import('../views/user/Home.vue'), meta: { title: '首页' } },
        { path: 'recipe/:id', component: () => import('../views/recipe/Detail.vue'), meta: { title: '菜品详情' } },
        { path: 'cart', component: () => import('../views/user/Cart.vue'), meta: { title: '购物车' } },
        { path: 'orders', component: () => import('../views/user/Orders.vue'), meta: { title: '我的订单' } },
        { path: 'profile', component: () => import('../views/user/Profile.vue'), meta: { title: '个人中心' } },
        {
          path: 'favorites',
          name: 'UserFavorites',
          component: Favorites,
          meta: { title: '我的收藏', requiresAuth: true }
        },
        { path: 'recommend', component: () => import('../views/user/RecommendRecipe.vue'), meta: { title: '推荐菜品' } }
      ]
    },
    {
      path: '/admin',
      component: () => import('../views/admin/Layout.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
      children: [
        { path: '', redirect: '/admin/dashboard' },
        { path: 'dashboard', component: () => import('../views/admin/Dashboard.vue'), meta: { title: '控制台' } },
        { path: 'users', component: () => import('../views/admin/Users.vue'), meta: { title: '用户管理' } },
        { path: 'recipes', component: () => import('../views/admin/Recipes.vue'), meta: { title: '菜品管理' } },
        { path: 'orders', component: () => import('../views/admin/Orders.vue'), meta: { title: '订单管理' } },
        { path: 'reviews', component: () => import('../views/admin/Reviews.vue'), meta: { title: '评价管理' } }
      ]
    },
    {
      path: '/merchant',
      component: () => import('../views/merchant/Layout.vue'),
      meta: { requiresAuth: true, requiresMerchant: true },
      children: [
        { path: '', redirect: '/merchant/recipes' },
        { path: 'recipes', component: () => import('../views/admin/Recipes.vue'), meta: { title: '菜品管理' } },
        { path: 'orders', component: () => import('../views/admin/Orders.vue'), meta: { title: '订单管理' } }
      ]
    }
  ]
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}')
  const isAdmin = userInfo.role === 'admin'
  const isMerchant = userInfo.role === 'merchant'

  if (to.meta.requiresAuth && !token) {
    next('/login')
    return
  }
  if (to.meta.requiresAdmin && !isAdmin) {
    next(isMerchant ? '/merchant' : '/user')
    return
  }
  if (to.meta.requiresMerchant && !isMerchant) {
    next(isAdmin ? '/admin' : '/user')
    return
  }
  next()
})

export default router
