import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '../api/http'

export interface Session { id:number; username:string; displayName:string; role:string; phone:string; enabled:boolean; house?:{ id:number; displayName:string; buildingId:number } }

export const useSessionStore = defineStore('session', () => {
  const session = ref<Session | null>(null)
  const loading = ref(false)
  const loggedIn = computed(() => !!session.value && !!uni.getStorageSync('access_token'))

  async function load() {
    if (!uni.getStorageSync('access_token')) return null
    loading.value = true
    try { session.value = await api.me(); return session.value }
    finally { loading.value = false }
  }

  async function login(username:string,password:string,loginType:'OWNER'|'TECHNICIAN') {
    loading.value = true
    try {
      const result = await api.login(username,password,loginType)
      uni.setStorageSync('access_token', result.token)
      session.value = result.user
      return result.user as Session
    } finally { loading.value = false }
  }

  async function logout() {
    try { if (uni.getStorageSync('access_token')) await api.logout() } catch {}
    uni.removeStorageSync('access_token')
    session.value = null
    uni.reLaunch({url:'/pages/login/index'})
  }

  return { session, loading, loggedIn, load, login, logout }
})
