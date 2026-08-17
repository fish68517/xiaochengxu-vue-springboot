<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '../../api/http'

const bills = ref<any[]>([])
const active = ref('ALL')
const tabs = [{key:'ALL',label:'全部'},{key:'PENDING',label:'待缴'},{key:'OVERDUE',label:'欠费'},{key:'PAID',label:'已缴'}]
const filtered = computed(() => active.value === 'ALL' ? bills.value : bills.value.filter(item => item.status === active.value))
const statusText=(s:string)=>({PENDING:'待缴费',OVERDUE:'欠费',PAID:'已缴',CLOSED:'已关闭'} as any)[s]||s
onShow(async()=>{ try{bills.value=await api.bills()}catch{} })
</script>

<template>
  <view class="page payment-page">
    <view class="tabs"><view v-for="tab in tabs" :key="tab.key" :class="{active:active===tab.key}" @click="active=tab.key">{{ tab.label }}<text v-if="tab.key!=='ALL'">({{ bills.filter(i=>i.status===tab.key).length }})</text></view></view>
    <view class="summary card"><view><text>当前房屋账单</text><strong>{{ bills.length }}</strong></view><view><text>待缴 / 欠费</text><strong class="red">{{ bills.filter(i=>['PENDING','OVERDUE'].includes(i.status)).length }}</strong></view><view><text>已缴</text><strong class="green">{{ bills.filter(i=>i.status==='PAID').length }}</strong></view></view>
    <view v-for="bill in filtered" :key="bill.id" class="bill card" @click="uni.navigateTo({url:`/pages/payment/detail?id=${bill.id}`})">
      <view class="bill-head"><strong>{{ bill.houseDisplayName }}</strong><text class="status" :class="bill.status">{{ statusText(bill.status) }}</text></view>
      <view class="bill-title">{{ bill.title }}</view>
      <view class="row"><text>收费周期</text><text>{{ bill.billingPeriod }}</text></view><view class="row"><text>截止日期</text><text>{{ bill.dueDate }}</text></view>
      <view class="bill-foot"><view><text>应缴金额</text><strong>¥{{ bill.totalAmount }}</strong></view><button class="ghost-btn">{{ bill.status==='PAID'?'查看详情':'去缴费' }}</button></view>
    </view>
    <view v-if="!filtered.length" class="empty">当前分类暂无账单</view>
  </view>
</template>

<style lang="scss" scoped>
.payment-page{max-width:920rpx;margin:auto}.tabs{height:86rpx;background:#fff;display:grid;grid-template-columns:repeat(4,1fr);margin:-24rpx -28rpx 20rpx;border-bottom:1rpx solid #e8ecf2}.tabs view{display:grid;place-items:center;position:relative;color:#697386}.tabs view.active{color:#1768ed;font-weight:800}.tabs view.active:after{content:"";position:absolute;bottom:0;width:54rpx;height:5rpx;background:#1768ed;border-radius:3rpx}.tabs text{font-size:19rpx;margin-left:3rpx}.summary{display:grid;grid-template-columns:repeat(3,1fr);padding:22rpx 5rpx;margin-bottom:20rpx}.summary view{text-align:center;border-right:1rpx solid #edf0f5}.summary view:last-child{border:0}.summary text,.summary strong{display:block}.summary text{font-size:21rpx;color:#8b94a5}.summary strong{font-size:31rpx;margin-top:7rpx}.red{color:#ed3f3f}.green{color:#19a661}.bill{padding:25rpx;margin-bottom:19rpx}.bill-head,.bill-foot{display:flex;align-items:center;justify-content:space-between}.bill-head>strong{font-size:29rpx}.bill-title{font-size:26rpx;font-weight:700;margin:16rpx 0}.row{display:flex;color:#7e889a;font-size:23rpx;margin:8rpx 0}.row text:first-child{width:145rpx}.bill-foot{border-top:1rpx solid #edf0f5;margin-top:17rpx;padding-top:18rpx}.bill-foot>view text{font-size:21rpx;color:#8b94a5}.bill-foot strong{display:block;color:#ed3f3f;font-size:34rpx;margin-top:3rpx}
</style>

