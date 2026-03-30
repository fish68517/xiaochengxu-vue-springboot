<template>
  <div class="cart">
    <el-card>
      <template #header>
        <div class="header">
          <span>我的购物车</span>
          <el-button type="danger" plain size="small" @click="clearCart" :disabled="!cartItems.length">
            清空购物车
          </el-button>
        </div>
      </template>

      <el-empty v-if="!cartItems.length" description="购物车还是空的">
        <el-button type="primary" @click="$router.push('/user/home')">去选购</el-button>
      </el-empty>

      <div v-else class="cart-list">
        <div class="cart-top">
          <el-checkbox v-model="checkAll" :indeterminate="isIndeterminate" @change="toggleCheckAll">
            全选
          </el-checkbox>
        </div>

        <div v-for="item in cartItems" :key="item.id" class="cart-item">
          <el-checkbox v-model="selectedIds" :label="item.id" />
          <el-image :src="getImageUrl(item.recipe?.image)" class="recipe-image" fit="cover" />
          <div class="recipe-info">
            <h3>{{ item.recipe?.name }}</h3>
            <p class="description">{{ item.recipe?.description }}</p>
          </div>
          <div class="quantity-control">
            <el-input-number
              v-model="item.quantity"
              :min="1"
              :max="99"
              size="small"
              @change="(val) => updateQuantity(item, val)"
            />
          </div>
          <div class="actions">
            <el-button type="danger" link @click="removeFromCart(item.id)">删除</el-button>
          </div>
        </div>

        <div class="remark-bar">
          <span class="remark-label">订单备注模板：</span>
          <el-select v-model="remarkTemplates" multiple collapse-tags placeholder="请选择备注模板" style="width: 360px">
            <el-option label="少辣" value="少辣" />
            <el-option label="多菜" value="多菜" />
            <el-option label="可打包" value="可打包" />
            <el-option label="不要香菜" value="不要香菜" />
          </el-select>
        </div>

        <div class="cart-footer">
          <div class="total">已选 {{ selectedItems.length }} 项，共 {{ selectedQuantity }} 份</div>
          <el-button type="primary" size="large" :disabled="!selectedItems.length" @click="createOrder">
            结算已选
          </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cartApi, orderApi } from '@/api/networkApi'
import { getImageUrl } from '@/utils/image'

export default {
  setup() {
    const router = useRouter()
    const cartItems = ref([])
    const selectedIds = ref([])
    const checkAll = ref(false)
    const remarkTemplates = ref([])

    const selectedItems = computed(() =>
      cartItems.value.filter(item => selectedIds.value.includes(item.id))
    )

    const selectedQuantity = computed(() =>
      selectedItems.value.reduce((sum, item) => sum + item.quantity, 0)
    )

    const isIndeterminate = computed(() =>
      selectedIds.value.length > 0 && selectedIds.value.length < cartItems.value.length
    )

    watch(
      () => selectedIds.value.length,
      (len) => {
        checkAll.value = len > 0 && len === cartItems.value.length
      }
    )

    const toggleCheckAll = (val) => {
      selectedIds.value = val ? cartItems.value.map(i => i.id) : []
    }

    const getCartList = async () => {
      try {
        cartItems.value = await cartApi.getCartList()
        selectedIds.value = cartItems.value.map(i => i.id)
      } catch (error) {
        ElMessage.error('获取购物车失败')
      }
    }

    const updateQuantity = async (item, quantity) => {
      try {
        await cartApi.updateCartItem(item.id, { quantity })
      } catch (error) {
        ElMessage.error('更新失败')
        getCartList()
      }
    }

    const removeFromCart = async (id) => {
      try {
        await ElMessageBox.confirm('确定删除该商品吗？', '提示', { type: 'warning' })
        await cartApi.removeFromCart(id)
        selectedIds.value = selectedIds.value.filter(v => v !== id)
        getCartList()
      } catch (error) {
        if (error !== 'cancel') ElMessage.error('删除失败')
      }
    }

    const clearCart = async () => {
      try {
        await ElMessageBox.confirm('确定清空购物车吗？', '提示', { type: 'warning' })
        await cartApi.clearCart()
        cartItems.value = []
        selectedIds.value = []
      } catch (error) {
        if (error !== 'cancel') ElMessage.error('清空失败')
      }
    }

    const createOrder = async () => {
      try {
        const orderData = {
          items: selectedItems.value.map(item => ({
            recipeId: item.recipeId,
            quantity: item.quantity
          })),
          cartItemIds: selectedItems.value.map(item => item.id),
          remark: remarkTemplates.value.join(' / ')
        }
        await orderApi.createOrder(orderData)
        ElMessage.success('下单成功')
        remarkTemplates.value = []
        await getCartList()
        router.push('/user/orders')
      } catch (error) {
        ElMessage.error('创建订单失败')
      }
    }

    onMounted(getCartList)

    return {
      cartItems,
      selectedIds,
      selectedItems,
      selectedQuantity,
      checkAll,
      isIndeterminate,
      remarkTemplates,
      toggleCheckAll,
      updateQuantity,
      removeFromCart,
      clearCart,
      createOrder,
      getImageUrl
    }
  }
}
</script>

<style scoped>
.cart { padding: 20px; }
.header { display: flex; justify-content: space-between; align-items: center; }
.cart-top { margin-bottom: 10px; }
.cart-item { display: flex; align-items: center; gap: 14px; padding: 16px 0; border-bottom: 1px solid #ebeef5; }
.recipe-image { width: 90px; height: 90px; border-radius: 6px; }
.recipe-info { flex: 1; }
.description { color: #909399; font-size: 13px; }
.remark-bar { margin-top: 16px; display: flex; align-items: center; gap: 10px; }
.remark-label { color: #666; white-space: nowrap; }
.cart-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 16px; }
</style>
