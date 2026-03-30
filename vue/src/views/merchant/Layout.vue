<template>
  <div class="merchant-layout">
    <el-container>
      <el-aside width="200px">
        <div class="logo">
          <Logo />
          <span>商家中心</span>
        </div>
        <el-menu
          :default-active="$route.path"
          router
          class="merchant-menu"
          background-color="#1f2d3d"
          text-color="#fff"
          active-text-color="#409EFF"
        >
          <el-menu-item index="/merchant/recipes">
            <el-icon><Bowl /></el-icon>
            <span>菜品管理</span>
          </el-menu-item>
          <el-menu-item index="/merchant/orders">
            <el-icon><List /></el-icon>
            <span>订单管理</span>
          </el-menu-item>
          <el-menu-item @click="handleLogout">
            <el-icon><SwitchButton /></el-icon>
            <span>退出登录</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </div>
</template>

<script>
import Logo from '@/components/Logo.vue'
import { Bowl, List, SwitchButton } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { userApi } from '@/api/networkApi'

export default {
  components: {
    Logo,
    Bowl,
    List,
    SwitchButton
  },
  setup() {
    const router = useRouter()
    const handleLogout = () => {
      ElMessageBox.confirm('确定要退出登录吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        await userApi.logout()
        localStorage.removeItem('token')
        localStorage.removeItem('userInfo')
        router.push('/login')
        ElMessage.success('退出登录成功')
      }).catch(() => {})
    }
    return { handleLogout }
  }
}
</script>

<style scoped>
.merchant-layout {
  height: 100vh;
}
.el-container {
  height: 100%;
}
.el-aside {
  background-color: #1f2d3d;
}
.logo {
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  color: #fff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.logo img {
  height: 32px;
  margin-right: 10px;
}
.merchant-menu {
  border-right: none;
}
.el-main {
  background-color: #f0f2f5;
  padding: 20px;
}
</style>
