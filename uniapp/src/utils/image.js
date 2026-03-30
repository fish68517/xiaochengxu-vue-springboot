import { IMAGE_BASE_URL } from './config'

export const getImageUrl = (url) => {
  if (!url) return ''
  if (typeof url !== 'string') return ''
  if (url.startsWith('http')) return url
  return `${IMAGE_BASE_URL}${url}`
}
