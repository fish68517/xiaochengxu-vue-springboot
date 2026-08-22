import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getCurrentUser, login as loginApi, logout as logoutApi } from '@/api/auth'
import { TOKEN_KEY } from '@/api/http'
import type { User } from '@/models'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(uni.getStorageSync(TOKEN_KEY) || '')
  const currentUser = ref<User | null>(null)
  const authenticated = computed(() => Boolean(token.value && currentUser.value))

  async function login(username: string, password: string) {
    const result = await loginApi(username, password)
    token.value = result.token
    currentUser.value = result.user
    uni.setStorageSync(TOKEN_KEY, result.token)
    return result.user
  }

  async function restoreSession() {
    if (!token.value) return null
    try {
      currentUser.value = await getCurrentUser()
      return currentUser.value
    } catch {
      clearSession()
      return null
    }
  }

  function clearSession() {
    token.value = ''
    currentUser.value = null
    uni.removeStorageSync(TOKEN_KEY)
  }

  async function logout() {
    try { if (token.value) await logoutApi() } finally { clearSession() }
  }

  return { token, currentUser, authenticated, login, restoreSession, logout, clearSession }
})
