<template>
  <div class="admin-layout">
    <el-container>
      <el-aside width="200px">
        <div class="logo">
          <Logo />
          <span>菜谱推荐系统</span>
        </div>
        <el-menu
          :default-active="$route.path"
          router
          class="admin-menu"
          background-color="#001529"
          text-color="#fff"
          active-text-color="#409EFF"
        >
          <el-menu-item index="/admin">
            <el-icon><HomeFilled /></el-icon>
            <span>管理首页</span>
          </el-menu-item>
          <el-menu-item index="/admin/users">
            <el-icon><User /></el-icon>
            <span>用户管理</span>
          </el-menu-item>
          <el-menu-item index="/admin/recipes">
            <el-icon><Bowl /></el-icon>
            <span>菜品动态管理</span>
          </el-menu-item>
<!--          <el-menu-item index="/admin/nutrition">
            <el-icon><Notebook /></el-icon>
            <span>营养知识管理</span>
          </el-menu-item>-->
          <el-menu-item index="/admin/reviews">
            <el-icon><ChatDotRound /></el-icon>
            <span>评价管理</span>
          </el-menu-item>
          <el-menu-item @click="handleLogout">
            <el-icon><SwitchButton /></el-icon>
            <span>退出登录</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-main>
        <router-view></router-view>
      </el-main>
    </el-container>
  </div>
</template>

<script>
import Logo from '@/components/Logo.vue'
import {
  HomeFilled,
  User,
  Bowl,
  ChatDotRound,
  SwitchButton
} from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { userApi } from '@/api/networkApi'

export default {
  components: {
    Logo,
    HomeFilled,
    User,
    Bowl,
    ChatDotRound,
    SwitchButton
  },

  setup() {
    const router = useRouter()

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

    return {
      handleLogout
    }
  }
}
</script>

<style scoped>
.admin-layout {
  height: 100vh;
}
.el-container {
  height: 100%;
}
.el-aside {
  background-color: #001529;
  color: #fff;
  width: 200px !important;
}
.logo {
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  color: #fff;
  font-size: 16px;
  font-weight: bold;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.logo img {
  height: 32px;
  margin-right: 10px;
}
.admin-menu {
  border-right: none;
}
.admin-menu :deep(.el-menu-item) {
  height: 50px;
  line-height: 50px;
  margin: 4px 0;
}
.admin-menu :deep(.el-menu-item.is-active) {
  background-color: #1890ff !important;
  color: #fff !important;
}
.admin-menu :deep(.el-menu-item:hover) {
  background-color: #1890ff !important;
  color: #fff !important;
}
.el-main {
  background-color: #f0f2f5;
  padding: 20px;
}
</style> 