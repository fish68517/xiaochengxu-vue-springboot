<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api } from '../../api/http'
import { useSessionStore } from '../../stores/session'

const bill = ref<any>(null)
const paying = ref(false)
const store = useSessionStore()
let id = 0
const statusText=(s:string)=>({PENDING:'待缴费',OVERDUE:'欠费',PAID:'已缴',CLOSED:'已关闭'} as any)[s]||s
async function load(){bill.value=await api.bill(id)}
async function requestPayment(){
  paying.value=true
  try{await api.requestPayment(id);uni.showModal({title:'申请已提交',content:'管理员确认到账后，账单状态会自动更新。',showCancel:false});await load()}finally{paying.value=false}
}
async function applyReceipt(){
  try{await api.applyReceipt({billId:id,applicantName:store.session?.displayName||'业主',phone:store.session?.phone||'',title:store.session?.displayName||''});uni.showModal({title:'申请成功',content:'收据申请已提交，管理员可在后台处理。',showCancel:false})}catch{}
}
onLoad(async(options)=>{id=Number(options?.id||0);if(!store.session)await store.load();await load()})
</script>

<template>
  <view v-if="bill" class="page detail-page">
    <view class="bill-hero card"><view><strong>{{ bill.houseDisplayName }}</strong><text>{{ bill.title }}</text></view><text class="status" :class="bill.status">{{ statusText(bill.status) }}</text><view class="amount-label">{{ bill.status==='PAID'?'已付金额':'待付金额' }}</view><view class="amount">¥{{ bill.totalAmount }}</view><view class="dates"><text>收费周期：{{ bill.billingPeriod }}</text><text>截止：{{ bill.dueDate }}</text></view></view>
    <view class="items card"><view class="items-title">费用明细 <text>费用项与金额</text></view><view v-for="item in bill.items" :key="item.id" class="item"><text>{{ item.feeItemName }}</text><strong>¥{{ item.amount }}</strong></view><view class="total"><text>合计金额</text><strong>¥{{ bill.totalAmount }}</strong></view></view>
    <view class="explain"><strong>费用说明 / 综合内容</strong><text>本期费用由后台按当前房屋配置。前端只展示服务端返回的账单总额和明细，不使用统一金额覆盖按户金额。</text></view>
    <view class="bottom safe-bottom"><view><text>合计金额：</text><strong>¥{{ bill.totalAmount }}</strong></view><button v-if="bill.status!=='PAID'" class="primary-btn" :loading="paying" @click="requestPayment">提交付款确认</button><button v-else class="primary-btn" @click="applyReceipt">申请收据</button></view>
  </view>
</template>

<style lang="scss" scoped>
.detail-page{max-width:920rpx;margin:auto;padding-bottom:180rpx}.bill-hero{padding:28rpx;position:relative;background:linear-gradient(145deg,#f1f6ff,#fff)}.bill-hero>view:first-child strong,.bill-hero>view:first-child text{display:block}.bill-hero>view:first-child strong{font-size:29rpx}.bill-hero>view:first-child text{font-weight:700;margin-top:9rpx}.bill-hero>.status{position:absolute;right:24rpx;top:24rpx}.amount-label{margin-top:34rpx;color:#6f7a8e}.amount{text-align:center;font-size:54rpx;color:#ed3434;font-weight:900;margin:-25rpx 0 22rpx}.dates{display:flex;justify-content:space-between;color:#8893a6;font-size:20rpx}.items{margin-top:20rpx;padding:22rpx 28rpx}.items-title{font-size:29rpx;font-weight:800;padding-bottom:17rpx;border-bottom:1rpx solid #e7ecf3}.items-title text{font-size:21rpx;color:#8f98a9}.item,.total{display:flex;justify-content:space-between;padding:18rpx 4rpx;border-bottom:1rpx solid #eef1f5}.item strong{font-weight:600}.total{border:0;font-size:28rpx}.total strong{color:#ed3434}.explain{border:2rpx solid #9dc0ff;background:#eef5ff;border-radius:20rpx;padding:22rpx;margin-top:20rpx}.explain strong,.explain text{display:block}.explain strong{color:#1768ed;margin-bottom:9rpx}.explain text{font-size:23rpx;line-height:1.7}.bottom{position:fixed;bottom:0;left:0;right:0;max-width:920rpx;margin:auto;background:#fff;border-top:1rpx solid #e6ebf2;padding:18rpx 24rpx;display:flex;align-items:center;justify-content:space-between;z-index:4}.bottom>view{min-width:260rpx}.bottom strong{color:#ed3434;font-size:31rpx}.bottom button{width:300rpx;margin:0}
</style>
