<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppHeader from '@/components/AppHeader.vue'
import PetArtwork from '@/components/PetArtwork.vue'
import { getProduct } from '@/api/product'
import { createOrder, localPay } from '@/api/order'
import { money } from '@/utils/format'
import type { Product } from '@/models'

const product = ref<Product | null>(null)
const loading = ref(true)
const paying = ref(false)
const useCoupon = ref(true)
const quantity = ref(1)
const address = { name: '张小萌', phone: '138****1234', rawPhone: '13800001234', detail: '广东省深圳市南山区科技园路创新大厦 B座12楼1202室' }

onLoad(async (options) => {
  try { product.value = await getProduct(Number(options?.productId || 1)) }
  finally { loading.value = false }
})

const subtotal = computed(() => Number(product.value?.price || 0) * quantity.value)
const discount = computed(() => useCoupon.value ? Math.min(30, subtotal.value) : 0)
const total = computed(() => Math.max(0.01, subtotal.value - discount.value))

async function pay() {
  if (!product.value || paying.value) return
  paying.value = true
  try {
    const order = await createOrder({ product_id: product.value.id, quantity: quantity.value, use_coupon: useCoupon.value, address_name: address.name, address_phone: address.rawPhone, address_detail: address.detail })
    const paid = await localPay(order.id)
    uni.showModal({ title: '本地支付成功', content: `development 模拟支付已完成\n订单号：${paid.order_no}\n实付：¥${paid.total_amount}`, showCancel: false, success: () => uni.reLaunch({ url: '/pages/profile/index' }) })
  } catch (err) { uni.showToast({ title: err instanceof Error ? err.message : '下单失败', icon: 'none' }) }
  finally { paying.value = false }
}
</script>

<template>
  <view class="app-shell checkout-page">
    <AppHeader title="确认订单" back />
    <view v-if="loading" class="loading-block">正在准备订单...</view>
    <view v-else-if="!product" class="error-block">商品不存在</view>
    <view v-else class="page-body">
      <view class="address app-card"><view class="address-head"><b>📍 收货地址</b><text>修改</text></view><view><b>{{ address.name }}</b><text>{{ address.phone }}</text></view><text class="detail">{{ address.detail }}　›</text><view class="airmail"></view></view>
      <view class="goods app-card"><view class="section-title"><text>商品清单</text><text class="section-title__link">共{{ quantity }}件</text></view><view class="goods-row"><PetArtwork :type="product.image_key" size="sm" /><view><b>{{ product.name }}</b><text>{{ product.size || '标准规格' }} | 品质保障</text><view class="tags"><text v-for="tag in product.tags.slice(0,2)" :key="tag">{{ tag }}</text></view></view><view><b class="price">¥{{ money(product.price) }}</b><text>x{{ quantity }}</text></view></view></view>
      <view class="discount app-card"><view class="section-title"><text>优惠券抵扣</text></view><view class="coupon" :class="{ selected: useCoupon }" @click="useCoupon = !useCoupon"><text class="percent">%</text><view><b>恭喜中奖！萌宠专区优惠券</b><small>满29减30元优惠券</small></view><text class="minus">- ¥{{ money(discount) }}</text><text class="check">{{ useCoupon ? '✓' : '○' }}</text></view><text v-if="useCoupon" class="saved">已使用优惠券，节省{{ money(discount) }}元</text><view class="line"><b>运费</b><text class="orange">包邮（活动免运费）</text></view><view class="line"><b>留言</b><text class="muted">选填：如需备注请在此留言　›</text></view></view>
      <view class="summary app-card"><view><text>商品金额</text><b>¥{{ money(subtotal) }}</b></view><view><text>优惠券抵扣</text><b class="orange">- ¥{{ money(discount) }}</b></view><view><text>运费</text><b>¥0</b></view><view class="total"><text>合计</text><b class="price">¥{{ money(total) }}</b></view><button class="wechat" :disabled="paying" @click="pay">{{ paying ? '正在创建本地订单...' : '●●　微信支付（本地模拟）' }}</button><text class="security">🛡 development 环境不会调用真实微信支付</text></view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.checkout-page{background:linear-gradient(135deg,#fff9ed,#fff3d7)}.address,.goods,.discount,.summary{padding:22rpx;margin-bottom:18rpx}.address-head{display:flex;justify-content:space-between;margin-bottom:22rpx}.address-head b{font-size:27rpx}.address-head text,.orange{color:#f25d12}.address>view:nth-child(2){display:flex;gap:24rpx;font-size:22rpx}.detail{display:block;margin-top:13rpx;color:#6f6761;font-size:21rpx;line-height:1.6}.airmail{height:6rpx;margin:20rpx -22rpx -22rpx;background:repeating-linear-gradient(135deg,#ff8b32 0 25rpx,#fff 25rpx 45rpx,#6fb44c 45rpx 70rpx,#fff 70rpx 90rpx)}.goods .section-title,.discount .section-title{margin:0 0 16rpx}.goods-row{display:grid;grid-template-columns:135rpx 1fr auto;gap:16rpx;align-items:center}.goods-row>view:nth-child(2){display:flex;flex-direction:column;gap:10rpx}.goods-row>view:last-child{display:flex;flex-direction:column;align-items:flex-end;gap:15rpx}.goods-row b{font-size:23rpx}.goods-row text{color:#8b8078;font-size:19rpx}.tags{display:flex;gap:8rpx}.tags text{padding:3rpx 7rpx;color:#58842f;border:1rpx solid #b7ce96;border-radius:9rpx;font-size:16rpx}.coupon{display:grid;grid-template-columns:60rpx 1fr auto 44rpx;gap:12rpx;align-items:center;padding:15rpx;border:1rpx solid #f3b064;border-radius:16rpx}.coupon.selected{background:#fff5e4}.percent{width:50rpx;height:50rpx;border-radius:10rpx;color:#fff;background:#ff791d;text-align:center;font-size:32rpx;line-height:50rpx}.coupon view{display:flex;flex-direction:column}.coupon b{font-size:20rpx}.coupon small{margin-top:4rpx;color:#ed6a15;font-size:16rpx}.minus{color:#ef5b12;font-size:20rpx}.check{color:#54b768;font-size:31rpx}.saved{display:block;padding:12rpx;color:#f07728;background:#fff1d9;font-size:18rpx}.line{display:flex;justify-content:space-between;padding:22rpx 0 5rpx;border-bottom:1rpx solid #f0e4d4;font-size:21rpx}.summary>view{display:flex;justify-content:space-between;margin:14rpx 0;font-size:21rpx}.summary .total{padding-top:16rpx;border-top:1rpx dashed #e8d6c1;font-size:25rpx}.summary .price{font-size:36rpx}.wechat{height:88rpx;margin-top:22rpx;border-radius:46rpx;color:#fff;background:linear-gradient(135deg,#43c75d,#18a63c);font-size:29rpx;font-weight:800;line-height:88rpx}.wechat[disabled]{opacity:.65}.security{display:block;margin-top:13rpx;text-align:center;color:#8b8078;font-size:17rpx}
</style>
