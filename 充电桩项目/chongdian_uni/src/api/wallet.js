import { post } from '../common/http/request'

export function expense(data) {
  return post('mamber/record/expense', data)
}

export function recharge(data) {
  return post('mamber/record/recharge', data)
}
