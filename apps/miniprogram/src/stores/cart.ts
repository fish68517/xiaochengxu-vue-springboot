import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { addCartItem, deleteCartItem, getCart, updateCartItem } from '@/api/cart'
import type { CartItem } from '@/models'

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  const loading = ref(false)
  const count = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0))
  const total = computed(() => items.value.reduce((sum, item) => sum + Number(item.line_amount), 0))

  async function load() {
    loading.value = true
    try { items.value = await getCart() } finally { loading.value = false }
    return items.value
  }

  async function add(productId: number, quantity = 1) {
    const item = await addCartItem(productId, quantity)
    const index = items.value.findIndex((current) => current.id === item.id)
    if (index >= 0) items.value[index] = item
    else items.value.push(item)
    return item
  }

  async function update(id: number, quantity: number) {
    if (quantity <= 0) return remove(id)
    const item = await updateCartItem(id, quantity)
    const index = items.value.findIndex((current) => current.id === id)
    if (index >= 0) items.value[index] = item
    return item
  }

  async function remove(id: number) {
    await deleteCartItem(id)
    items.value = items.value.filter((item) => item.id !== id)
  }

  function clearLocal() { items.value = [] }

  return { items, loading, count, total, load, add, update, remove, clearLocal }
})
