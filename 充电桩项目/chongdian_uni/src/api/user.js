import { get } from '../common/http/request'

export function fetchUserList(params = {}) {
  return get('member/userinfo/list', params)
}

export async function fetchUserById(id) {
  const res = await fetchUserList({ id, pageSize: 1 })
  return (res.rows || [])[0] || null
}
