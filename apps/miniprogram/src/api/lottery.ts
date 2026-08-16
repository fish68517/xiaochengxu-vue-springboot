import { request } from './http'
import type { LotteryActivity, LotteryResult } from '@/models'

export const getCurrentActivity = () => request<LotteryActivity>('/lottery/activities/current')
export const getActivity = (id: number) => request<LotteryActivity>(`/lottery/activities/${id}`)
export const joinActivity = (id: number) => request<{ participant_count: number; message: string }>(`/lottery/activities/${id}/join`, { method: 'POST' })
export const getLotteryResult = (id: number) => request<LotteryResult>(`/lottery/activities/${id}/result`)
