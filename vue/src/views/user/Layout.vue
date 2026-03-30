<template>
  <div class="user-layout">
    <el-container>
      <el-aside width="200px">
        <el-menu
          :default-active="$route.path"
          router
          background-color="#304156"
          text-color="#fff"
          active-text-color="#409EFF"
        >
          <el-menu-item index="/user/home">
            <el-icon><HomeFilled /></el-icon>
            <span class="menu-item-text">首页</span>
          </el-menu-item>
          <el-menu-item index="/user/profile">
            <el-icon><User /></el-icon>
            <span class="menu-item-text">个人中心</span>
          </el-menu-item>
          <el-menu-item index="/user/cart">
            <el-icon><ShoppingCart /></el-icon>
            <span class="menu-item-text">购物车</span>
<!--            <el-badge
              v-if="cartCount" 
              :value="cartCount" 
              class="cart-badge"
            />-->
          </el-menu-item>
          <el-menu-item index="/user/orders">
            <el-icon><List /></el-icon>
            <span class="menu-item-text">我的订单</span>
          </el-menu-item>
          <el-menu-item index="/user/favorites">
            <el-icon><Star /></el-icon>
            <span class="menu-item-text">我的收藏</span>
          </el-menu-item>
          <el-menu-item index="/user/recommend">
            <el-icon><Guide /></el-icon>
            <span class="menu-item-text">推荐菜品</span>
          </el-menu-item>
          <el-menu-item @click="handleLogout">
            <el-icon><SwitchButton /></el-icon>
            <span class="menu-item-text">退出登录</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-main>
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { 
  HomeFilled,
  User, 
  ShoppingCart,
  List, 
  Star,
  SwitchButton,
  Guide
} from '@element-plus/icons-vue'
import { cartApi, userApi } from '@/api/networkApi'

export default {
  components: {
    HomeFilled,
    User,
    ShoppingCart,
    List,
    Star,
    SwitchButton,
    Guide
  },

  setup() {
    const router = useRouter()
    const cartCount = ref(0)

    const getCartCount = async () => {
      try {
        const cartItems = await cartApi.getCartList()
        cartCount.value = cartItems.length
      } catch (error) {
        console.error('获取购物车数量失败:', error)
      }
    }

    const handleLogout = () => {
      ElMessageBox.confirm(
        '确定要退出登录吗？',
        '提示',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning',
        }
      ).then(async () => {
        try {
          await userApi.logout()
          // 清除本地存储的用户信息和token
          localStorage.removeItem('token')
          localStorage.removeItem('userInfo')
          // 跳转到登录页
          router.push('/login')
          ElMessage.success('退出登录成功')
        } catch (error) {
          console.error('退出登录失败:', error)
        }
      }).catch(() => {
        // 取消退出
      })
    }

    onMounted(() => {
      getCartCount()
    })

    return {
      cartCount,
      handleLogout
    }
  }
}
</script>

<style scoped>
.user-layout {
  height: calc(100vh - 60px);
}

.el-container {
  height: 100%;
}

.el-aside {
  background-color: #304156;
  border-right: 1px solid #dcdfe6;
}

.el-menu {
  border-right: none;
  background-color: #304156;
}

.menu-item-text {
  color: white;
  font-size: 16px;
}

.el-menu-item {
  margin-bottom: 15px;
  position: relative; /* 为徽标定位 */
}

.cart-badge {
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
}

.el-main {
  background-color: #f5f7fa;
  padding: 0;
  overflow-x: hidden;
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 激活菜单项样式 */
.el-menu-item.is-active {
  background-color: #263445 !important;
}

/* 菜单项悬停样式 */
.el-menu-item:hover {
  background-color: #263445 !important;
}

/* 图标样式 */
.el-icon {
  font-size: 18px;
  margin-right: 10px;
}
</style>