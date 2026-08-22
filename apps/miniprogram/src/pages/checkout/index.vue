<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/AppHeader.vue'
import PetArtwork from '@/components/PetArtwork.vue'
import { getAddresses } from '@/api/address'
import { createOrder, getAvailableCoupons, previewOrder, requestPayment } from '@/api/order'
import { useCartStore } from '@/stores/cart'
import { money } from '@/utils/format'
import type { Address, Coupon, OrderPreview } from '@/models'

const cartItemIds = ref<number[]>([])
const addresses = ref<Address[]>([])
const coupons = ref<Coupon[]>([])
const addressId = ref<number | null>(null)
const userCouponId = ref<number | null>(null)
const remark = ref('')
const preview = ref<OrderPreview | null>(null)
const loading = ref(true)
const submitting = ref(false)
const cart = useCartStore()
const selectedAddress = computed(() => addresses.value.find((item) => item.id === addressId.value) || null)

onLoad((options) => { cartItemIds.value = String(options?.cartItemIds || '').split(',').map(Number).filter(Boolean) })
onShow(() => { load().catch(showError) })
function showError(error: unknown) { uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' }) }
async function load() {
  if (!cartItemIds.value.length) return
  loading.value = true
  try {
    const result = await Promise.all([getAddresses(), getAvailableCoupons()])
    addresses.value = result[0]
    coupons.value = result[1]
    if (!addressId.value) addressId.value = (addresses.value.find((item) => item.is_default) || addresses.value[0])?.id || null
    await refreshPreview()
  } finally { loading.value = false }
}
async function refreshPreview() {
  if (!addressId.value || !cartItemIds.value.length) { preview.value = null; return }
  preview.value = await previewOrder({ cart_item_ids: cartItemIds.value, address_id: addressId.value, user_coupon_id: userCouponId.value, remark: remark.value })
}
async function selectCoupon(id: number) { userCouponId.value = userCouponId.value === id ? null : id; try { await refreshPreview() } catch (error) { showError(error) } }
function openAddresses() { uni.navigateTo({ url: '/pages/address/index' }) }
async function submit() {
  if (!addressId.value || !preview.value || submitting.value) return uni.showToast({ title: '请先选择收货地址', icon: 'none' })
  submitting.value = true
  try {
    const order = await createOrder({ cart_item_ids: cartItemIds.value, address_id: addressId.value, user_coupon_id: userCouponId.value, remark: remark.value })
    const payment = await requestPayment(order.id)
    cart.clearLocal()
    uni.showModal({ title: '付款申请已提交', content: `订单号：${order.order_no}\n付款单：${payment.payment_no}\n请到管理后台确认付款。`, showCancel: false, success: () => uni.reLaunch({ url: '/pages/profile/index' }) })
  } catch (error) { showError(error) }
  finally { submitting.value = false }
}
</script>

<template>
  <view class="app-shell checkout-page">
    <AppHeader title="确认订单" back />
    <view v-if="loading" class="loading-block">正在从 MySQL 试算订单...</view>
    <view v-else class="page-body">
      <view class="address app-card" @click="openAddresses"><view><b>📍 收货地址</b><text>管理地址 ›</text></view><template v-if="selectedAddress"><b>{{ selectedAddress.receiver_name }}　{{ selectedAddress.phone }}</b><text>{{ selectedAddress.province }}{{ selectedAddress.city }}{{ selectedAddress.district }}{{ selectedAddress.detail }}</text></template><text v-else class="warning">请先新增收货地址</text></view>
      <view v-if="preview" class="goods app-card"><view class="section-title"><text>商品清单</text><text>共 {{ preview.items.length }} 种</text></view><view v-for="item in preview.items" :key="item.cart_item_id" class="goods-row"><PetArtwork :type="item.image_key" size="sm" /><view><b>{{ item.product_name }}</b><text>¥{{ money(item.unit_price) }} × {{ item.quantity }}</text></view><b class="price">¥{{ money(item.line_amount) }}</b></view></view>
      <view class="discount app-card"><view class="section-title"><text>可用优惠券</text></view><view v-if="!coupons.length" class="muted">当前没有可用优惠券</view><view v-for="coupon in coupons" :key="coupon.user_coupon_id" class="coupon" :class="{ selected: userCouponId === coupon.user_coupon_id }" @click="selectCoupon(coupon.user_coupon_id)"><view><b>{{ coupon.name }}</b><text>满 ¥{{ money(coupon.threshold_amount) }} 减 ¥{{ money(coupon.discount_amount) }}</text></view><text>{{ userCouponId === coupon.user_coupon_id ? '✓ 已选择' : '选择' }}</text></view><input v-model="remark" placeholder="订单备注（选填）" /></view>
      <view v-if="preview" class="summary app-card"><view><text>商品金额</text><b>¥{{ money(preview.subtotal) }}</b></view><view><text>优惠</text><b class="orange">- ¥{{ money(preview.discount) }}</b></view><view><text>运费</text><b>¥{{ money(preview.shipping_fee) }}</b></view><view class="total"><text>应付</text><b class="price">¥{{ money(preview.total_amount) }}</b></view><button class="primary-button" :disabled="submitting" @click="submit">{{ submitting ? '正在提交...' : '提交订单并申请付款' }}</button><text class="security">本地联调付款由管理后台人工确认</text></view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.checkout-page{min-height:100vh;background:linear-gradient(135deg,#fff9ed,#fff3d7)}.address,.goods,.discount,.summary{padding:22rpx;margin-bottom:18rpx}.address>view:first-child,.section-title,.summary>view{display:flex;justify-content:space-between}.address>b,.address>text{display:block;margin-top:14rpx}.address>text{color:#6f6761;font-size:20rpx;line-height:1.5}.warning,.orange{color:#ef5a11}.goods-row{display:grid;grid-template-columns:130rpx 1fr auto;gap:15rpx;align-items:center;padding:12rpx 0;border-bottom:1rpx solid #eee0cf}.goods-row>view{display:flex;flex-direction:column;gap:10rpx}.goods-row text,.muted{color:#8b8078;font-size:19rpx}.coupon{display:flex;justify-content:space-between;margin:12rpx 0;padding:16rpx;border:1rpx solid #efc38e;border-radius:16rpx}.coupon.selected{background:#fff0d3;border-color:#f5791b}.coupon view{display:flex;flex-direction:column;gap:6rpx}.coupon text{color:#ef5a11;font-size:18rpx}.discount input{height:68rpx;margin-top:18rpx;padding:0 18rpx;border:1rpx solid #ead9c4;border-radius:15rpx;background:#fff}.summary>view{margin:14rpx 0;font-size:22rpx}.summary .total{padding-top:15rpx;border-top:1rpx dashed #ddc9ae;font-size:26rpx}.summary .primary-button{width:100%;margin-top:20rpx}.security{display:block;margin-top:14rpx;color:#8b8078;text-align:center;font-size:18rpx}
</style>
