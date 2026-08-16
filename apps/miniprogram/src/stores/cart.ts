import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Product } from '@/models'

export const useCartStore = defineStore('cart', () => {
  const items = ref<Array<{ product: Product; quantity: number }>>([])
  const count = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0))
  const total = computed(() => items.value.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0))

  function add(product: Product) {
    const item = items.value.find((entry) => entry.product.id === product.id)
    if (item) item.quantity += 1
    else items.value.push({ product, quantity: 1 })
  }

  function remove(productId: number) {
    items.value = items.value.filter((entry) => entry.product.id !== productId)
  }

  return { items, count, total, add, remove }
})
