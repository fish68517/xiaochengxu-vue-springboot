<template>
  <div class="login-container">
    <el-card class="login-card">
      <h2>登录</h2>
      <el-form ref="loginFormRef" :model="loginForm" @submit.prevent="handleLogin">
        <el-form-item prop="username" :rules="[{ required: true, message: '请输入用户名', trigger: 'blur' }]">
          <el-input v-model="loginForm.username" placeholder="用户名">
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item prop="password" :rules="[{ required: true, message: '请输入密码', trigger: 'blur' }]">
          <el-input v-model="loginForm.password" type="password" placeholder="密码" show-password>
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-radio-group v-model="loginForm.userType">
            <el-radio label="user">用户登录</el-radio>
            <el-radio label="merchant">商家登录</el-radio>
            <el-radio label="admin">管理员登录</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" native-type="submit" :loading="loading" block>登录</el-button>
        </el-form-item>
        <el-link v-if="loginForm.userType !== 'admin'" @click="$router.push('/register')">
          还没有账号？立即注册
        </el-link>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { userApi } from '@/api/networkApi'

const router = useRouter()
const userStore = useUserStore()
const loginFormRef = ref(null)
const loading = ref(false)

const loginForm = ref({
  username: '',
  password: '',
  userType: 'user'
})

const handleLogin = async () => {
  if (!loginFormRef.value) return
  await loginFormRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      const response = await userApi.login({
        username: loginForm.value.username,
        password: loginForm.value.password,
        role: loginForm.value.userType
      })

      if (response.code !== 200 || !response.data) {
        ElMessage.error(response.message || '登录失败')
        return
      }

      userStore.setToken(response.data.token || 'session')
      userStore.setUserInfo(response.data)

      if (response.data.role === 'admin') {
        await router.push('/admin/dashboard')
      } else if (response.data.role === 'merchant') {
        await router.push('/merchant/recipes')
      } else {
        await router.push('/user/home')
      }
      ElMessage.success('登录成功')
    } catch (error) {
      ElMessage.error('登录失败，请检查用户名和密码')
    } finally {
      loading.value = false
    }
  })
}
</script>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-image: url('@/assets/image/background_image.png');
  background-size: cover;
  background-position: center;
}

.login-card {
  width: 520px;
}
</style>
