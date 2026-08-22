<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api, uploadFile } from '../../api/http'
import { useSessionStore } from '../../stores/session'

const active=ref<'create'|'list'>('create')
const store=useSessionStore()
const description=ref('')
const type=ref('运行异响')
const submitting=ref(false)
const repairs=ref<any[]>([])
const imageUrls=ref<string[]>([])
const statusText=(s:string)=>({PENDING:'待处理',REPAIRING:'维修中',COMPLETED:'已完成'} as any)[s]||s
async function load(){try{repairs.value=await api.repairs()}catch{}}
async function submit(){if(description.value.trim().length<5)return uni.showToast({title:'请至少填写5个字的故障描述',icon:'none'});submitting.value=true;try{await api.createRepair({description:`${type.value}：${description.value}`,contactName:store.session?.displayName||'',contactPhone:store.session?.phone||'',imageUrls:imageUrls.value});uni.showToast({title:'报修已提交',icon:'success'});description.value='';imageUrls.value=[];active.value='list';await load()}finally{submitting.value=false}}
function chooseImage(){uni.chooseImage({count:3-imageUrls.value.length,success:async(result)=>{for(const path of result.tempFilePaths){try{const uploaded=await uploadFile(path,'repairs');imageUrls.value.push(uploaded.url)}catch{uni.showToast({title:'图片上传失败',icon:'none'})}}}})}
function call(){uni.makePhoneCall({phoneNumber:'96333'})}
onShow(async()=>{if(!store.session)await store.load();await load()})
</script>

<template>
  <view class="page repair-page">
    <view class="tabs"><view :class="{active:active==='create'}" @click="active='create'">提交报修</view><view :class="{active:active==='list'}" @click="active='list'">我的报修</view></view>
    <view class="emergency"><text>⚠</text><view><strong>困梯、人员被困、紧急故障禁止小程序报修！</strong><text>请立即拨打现场救援电话。</text></view><button @click="call">☎ 呼救</button></view>
    <template v-if="active==='create'">
      <view class="form card"><label><text>报修房屋</text><view>{{ store.session?.house?.displayName }}</view></label><label><text>故障类型</text><picker :range="['运行异响','按钮故障','照明故障','开关门异常','其他普通故障']" @change="type=['运行异响','按钮故障','照明故障','开关门异常','其他普通故障'][$event.detail.value]"><view>{{ type }}　›</view></picker></label><label class="block"><text>故障描述</text><textarea v-model="description" maxlength="300" placeholder="请详细描述电梯普通故障现象（至少5个字）"/></label><label><text>联系人</text><view>{{ store.session?.displayName }}</view></label><label><text>联系电话</text><view>{{ store.session?.phone }}</view></label></view>
      <view class="upload-tip card" @click="chooseImage"><view>＋</view><text>上传故障图片（{{ imageUrls.length }}/3）</text><small>图片上传服务器后，URL随工单写入MySQL</small></view><button class="primary-btn submit" :loading="submitting" @click="submit">提交普通故障报修</button>
    </template>
    <template v-else><view v-for="item in repairs" :key="item.id" class="repair-card card"><view><text>工单号：{{ item.orderNo }}</text><text class="status" :class="item.status">{{ statusText(item.status) }}</text></view><strong>{{ item.description }}</strong><text>提交时间：{{ item.createdAt?.replace('T',' ').slice(0,16) }}</text><view v-if="item.progressText" class="progress">进度：{{ item.progressText }}</view></view><view v-if="!repairs.length" class="empty">暂无报修工单</view></template>
  </view>
</template>

<style lang="scss" scoped>
.repair-page{max-width:920rpx;margin:auto}.tabs{display:grid;grid-template-columns:1fr 1fr;background:#fff;margin:-24rpx -28rpx 20rpx;height:84rpx}.tabs view{display:grid;place-items:center;position:relative}.tabs .active{color:#1768ed;font-weight:800}.tabs .active:after{content:"";position:absolute;bottom:0;width:70rpx;height:5rpx;background:#1768ed}.emergency{display:flex;align-items:center;gap:12rpx;background:#fff0f0;border:1rpx solid #ffd7d7;border-radius:20rpx;padding:20rpx;margin-bottom:20rpx;color:#ed3c3c}.emergency>text{font-size:34rpx}.emergency>view{flex:1}.emergency strong,.emergency view text{display:block;font-size:21rpx;line-height:1.6}.emergency button{margin:0;padding:0 15rpx;height:56rpx;line-height:56rpx;background:#fff;color:#ed3c3c;font-size:20rpx;border-radius:28rpx}.form{padding:5rpx 25rpx}.form label{display:flex;align-items:center;padding:22rpx 0;border-bottom:1rpx solid #edf0f4}.form label>text{width:150rpx;font-weight:700}.form label>view,.form picker{flex:1;color:#667185}.form .block{display:block}.form .block>text{display:block;margin-bottom:15rpx}.form textarea{width:100%;height:180rpx;background:#f7f9fc;border-radius:15rpx;padding:18rpx;font-size:25rpx}.upload-tip{margin-top:18rpx;padding:25rpx;text-align:center}.upload-tip>view{width:90rpx;height:90rpx;display:grid;place-items:center;border:2rpx dashed #aebdd4;border-radius:15rpx;margin:auto;font-size:42rpx;color:#8b99ad}.upload-tip text,.upload-tip small{display:block}.upload-tip text{margin-top:10rpx}.upload-tip small{font-size:20rpx;color:#98a2b3;margin-top:6rpx}.submit{margin-top:24rpx}.repair-card{padding:25rpx;margin-bottom:18rpx}.repair-card>view:first-child{display:flex;justify-content:space-between;align-items:center;color:#697487;font-size:22rpx}.repair-card>strong,.repair-card>text{display:block}.repair-card>strong{margin:20rpx 0 14rpx}.repair-card>text{font-size:22rpx;color:#8a94a6}.progress{margin-top:16rpx;padding:13rpx;background:#edf5ff;color:#1768ed;border-radius:10rpx;font-size:22rpx}
</style>
