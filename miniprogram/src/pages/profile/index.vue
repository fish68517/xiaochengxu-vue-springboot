<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '../../api/http'
import { useSessionStore } from '../../stores/session'
const store=useSessionStore();const receipts=ref<any[]>([])
const menus=[
  {icon:'¥',color:'blue',name:'我的缴费',url:'/pages/payment/list'}, {icon:'▤',color:'blue',name:'缴费记录',url:'/pages/payment/list'},
  {icon:'▣',color:'green',name:'我的收据',action:'receipt'}, {icon:'🛠',color:'purple',name:'我的报修',url:'/pages/repair/index'},
  {icon:'▤',color:'orange',name:'我的装修记录',url:'/pages/renovation/index'}, {icon:'▣',color:'green',name:'我的楼栋维保记录',url:'/pages/maintenance/index'},
  {icon:'📣',color:'orange',name:'消息通知',url:'/pages/notice/index'}, {icon:'▥',color:'purple',name:'账户信息',action:'account'},
]
function go(item:any){if(item.action==='receipt')return uni.showModal({title:'我的收据',content:receipts.value.length?`当前共有 ${receipts.value.length} 条收据申请。`:'暂无收据申请，可从已缴账单申请。',showCancel:false});if(item.action==='account')return uni.showModal({title:'账户信息',content:`测试账号：${store.username}\n角色：${store.session?.role}\n环境：development`,showCancel:false});uni.navigateTo({url:item.url})}
async function switchTech(){await store.switchUser('technician_01');uni.redirectTo({url:'/pages/technician/index'})}
onShow(async()=>{await store.load();try{receipts.value=await api.receipts()}catch{}})
</script>
<template><view class="profile-page"><view class="custom-nav"><text class="title">个人中心</text><text class="env-badge">Development</text></view><view class="page"><view class="user"><view class="avatar">{{ store.session?.displayName?.slice(0,1) }}</view><view><view><strong>{{ store.session?.displayName }}</strong><text>业主</text></view><p>{{ store.session?.house?.displayName }}</p></view></view><view class="menu card"><view v-for="item in menus" :key="item.name" @click="go(item)"><text class="mi" :class="item.color">{{ item.icon }}</text><strong>{{ item.name }}</strong><text class="count" v-if="item.action==='receipt'">{{ receipts.length||'' }}</text><text class="arrow">›</text></view></view><view class="dev-switch card"><view><strong>开发身份切换</strong><text>用于本地演示业主 → 维修师傅完整流程</text></view><button class="ghost-btn" @click="switchTech">进入师傅端</button></view></view></view></template>
<style lang="scss" scoped>.profile-page{max-width:920rpx;margin:auto;min-height:100vh}.user{display:flex;align-items:center;gap:22rpx;padding:25rpx 15rpx 35rpx}.avatar{width:104rpx;height:104rpx;border-radius:52rpx;background:linear-gradient(135deg,#8ab8ff,#0e62e9);color:#fff;font-size:45rpx;font-weight:900;display:grid;place-items:center}.user>view:last-child{flex:1}.user strong{font-size:38rpx}.user view view text{font-size:20rpx;color:#1768ed;border:1rpx solid #74a8ff;border-radius:15rpx;padding:4rpx 10rpx;margin-left:13rpx}.user p{color:#667287;margin:9rpx 0 0}.menu{padding:4rpx 24rpx}.menu>view{height:93rpx;border-bottom:1rpx solid #e9edf3;display:flex;align-items:center;gap:18rpx}.menu>view:last-child{border:0}.mi{width:56rpx;height:56rpx;border-radius:13rpx;color:#fff;display:grid;place-items:center;font-weight:800}.mi.blue{background:#2379ff}.mi.green{background:#25bd92}.mi.purple{background:#884dec}.mi.orange{background:#ff762f}.menu strong{flex:1}.arrow{font-size:42rpx;color:#8d96a6}.count{color:#1768ed}.dev-switch{margin-top:20rpx;padding:22rpx;display:flex;align-items:center;gap:15rpx}.dev-switch>view{flex:1}.dev-switch strong,.dev-switch text{display:block}.dev-switch text{font-size:20rpx;color:#8893a5;margin-top:6rpx}.dev-switch button{margin:0}</style>

