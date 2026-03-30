// 配置基础URL
// export const BASE_URL = process.env.VUE_APP_BASE_URL || ''
// export const BASE_RESOURCE_URL = '/resources/images/'
export const DEFAULT_RECIPE_IMAGE = '/images/default-recipe.jpg'


// 定义常量
const BASE_URL = 'http://localhost:8089';
const defaultImage = require('@/assets/image/pet/default.png'); // 引入默认图片
const BASE_RESOURCE_URL = '/image/pet/'

/**
 * 处理图片URL
 * @param {string} url - 图片URL
 * @param {string} defaultImage - 默认图片URL
 * @returns {string} - 完整的图片URL
 */
export const getImageUrl = (url, defaultImage = DEFAULT_RECIPE_IMAGE) => {

  if (!url) {
    return defaultImage
  }
  // 如果是完整的URL（以http开头），直接返回
  if (url.startsWith('http')) {
    return url
  }
  // 否则拼接基础URL
  return `${BASE_URL}${BASE_RESOURCE_URL}${url}`
} 