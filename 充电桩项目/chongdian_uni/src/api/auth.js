import { get, post } from '../common/http/request'

export function loginByPhone(phoneNumber, password) {
  return post(`loginPhone?phoneNumber=${encodeURIComponent(phoneNumber)}&password=${encodeURIComponent(password)}`)
}

export function loginByEmail(email, code) {
  return post(`loginEmail?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`)
}

export function sendEmailCode(email) {
  return get('member/sendEmail', { email })
}

export function getPhoneInfo() {
  return get('getPhoneInfo')
}
