import { defineStore } from 'pinia'
import { ref } from 'vue'
import { request } from '../api/http'

export interface Session { username:string; displayName:string; role:string; phone:string; house?:{ id:number; displayName:string; buildingId:number } }

export const useSessionStore = defineStore('session', () => {
  const username = ref(uni.getStorageSync('dev_user') || import.meta.env.VITE_DEFAULT_USER || 'owner_101')
  const session = ref<Session | null>(null)
  async function load() { session.value = await request<Session>('/dev/session', { data: { username: username.value }, header: { 'X-Dev-User': username.value } }) }
  async function switchUser(next:string) { username.value = next; uni.setStorageSync('dev_user', next); await load() }
  return { username, session, load, switchUser }
})

