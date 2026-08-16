import { request } from './http'
import type { Profile } from '@/models'

export const getProfile = () => request<Profile>('/me')
