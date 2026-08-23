<script setup lang="ts">
import { reactive, ref } from 'vue'
import { api } from '../../api/http'

type RegisterRole = 'OWNER' | 'TECHNICIAN'

const role = ref<RegisterRole>('OWNER')
const submitting = ref(false)
const form = reactive({username:'',displayName:'',phone:'',residentCode:'',password:'',confirmPassword:''})

function selectRole(value:RegisterRole){role.value=value}
function back(){uni.navigateBack({delta:1})}

async function submit(){
  if (!form.username.trim() || !form.displayName.trim() || !form.phone.trim()) return uni.showToast({title:'请完整填写注册信息',icon:'none'})
  if (!/^[A-Za-z0-9_.-]{3,64}$/.test(form.username.trim())) return uni.showToast({title:'用户名限3-64位字母、数字或_.-',icon:'none'})
  if (form.password.length < 8) return uni.showToast({title:'密码至少需要8位',icon:'none'})
  if (form.password !== form.confirmPassword) return uni.showToast({title:'两次输入的密码不一致',icon:'none'})
  if (role.value === 'OWNER' && !form.residentCode.trim()) return uni.showToast({title:'业主注册请填写住户编码',icon:'none'})
  submitting.value=true
  try{
    const result=await api.register({
      username:form.username.trim(),password:form.password,displayName:form.displayName.trim(),phone:form.phone.trim(),
      role:role.value,residentCode:role.value==='OWNER'?form.residentCode.trim():undefined,
    })
    uni.setStorageSync('login_type',role.value)
    uni.setStorageSync('registered_username',form.username.trim())
    const content=result.requiresApproval?'维修师傅账号已提交，请等待管理员在后台审核启用后再登录。':'业主账号注册成功，可以立即登录。'
    uni.showModal({title:'注册成功',content,showCancel:false,success:()=>uni.redirectTo({url:'/pages/login/index'})})
  } finally{submitting.value=false}
}
</script>

<template>
  <view class="register-page">
    <view class="custom-head"><text @click="back">‹</text><strong>账号注册</strong><text></text></view>
    <view class="intro"><view>E</view><strong>创建电梯云管家账号</strong><text>请选择与实际身份一致的注册类型</text></view>
    <view class="register-card card">
      <view class="role-switch">
        <view :class="{active:role==='OWNER'}" @click="selectRole('OWNER')"><text>业</text><view><strong>注册业主</strong><small>需要住户编码</small></view></view>
        <view :class="{active:role==='TECHNICIAN'}" @click="selectRole('TECHNICIAN')"><text>修</text><view><strong>注册维修师傅</strong><small>需要后台审核</small></view></view>
      </view>
      <label><text>用户名</text><input v-model="form.username" placeholder="3-64位字母、数字或_.-" /></label>
      <label><text>姓名</text><input v-model="form.displayName" placeholder="请输入真实姓名" /></label>
      <label><text>联系电话</text><input v-model="form.phone" type="number" maxlength="24" placeholder="请输入联系电话" /></label>
      <label v-if="role==='OWNER'"><text>住户编码</text><input v-model="form.residentCode" placeholder="由管理员提供，用于绑定房屋" /></label>
      <label><text>登录密码</text><input v-model="form.password" password placeholder="至少8位" /></label>
      <label><text>确认密码</text><input v-model="form.confirmPassword" password placeholder="请再次输入密码" @confirm="submit" /></label>
      <view v-if="role==='TECHNICIAN'" class="review-tip">维修师傅注册后默认处于待审核状态，管理员审核启用后才能登录和查看工单。</view>
      <button class="primary-btn" :loading="submitting" @click="submit">提交注册</button>
      <view class="back-login" @click="back">已有账号，返回登录</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.register-page{min-height:100vh;padding-bottom:70rpx;background:linear-gradient(160deg,#eaf3ff,#f8faff 48%,#eef4ff)}.custom-head{padding:calc(var(--status-bar-height) + 20rpx) 30rpx 20rpx;display:grid;grid-template-columns:60rpx 1fr 60rpx;align-items:center}.custom-head text:first-child{font-size:60rpx;line-height:50rpx}.custom-head strong{text-align:center;font-size:32rpx}.intro{text-align:center;padding:20rpx 30rpx 30rpx}.intro>view{width:76rpx;height:76rpx;border-radius:22rpx;background:#1768ed;color:#fff;display:grid;place-items:center;margin:auto;font-size:42rpx;font-weight:900}.intro strong,.intro>text{display:block}.intro strong{font-size:35rpx;margin-top:18rpx}.intro>text{color:#78859a;margin-top:8rpx;font-size:23rpx}
.register-card{margin:0 34rpx;padding:30rpx}.role-switch{display:grid;grid-template-columns:1fr 1fr;gap:14rpx;margin-bottom:28rpx}.role-switch>view{min-height:100rpx;border:2rpx solid #dfe7f2;border-radius:18rpx;padding:14rpx;display:flex;align-items:center;gap:10rpx;background:#f8faff;color:#7b8799}.role-switch>view>text{width:46rpx;height:46rpx;border-radius:14rpx;background:#e7edf6;display:grid;place-items:center;font-size:21rpx;flex:none}.role-switch strong,.role-switch small{display:block}.role-switch strong{font-size:22rpx}.role-switch small{font-size:18rpx;margin-top:5rpx}.role-switch .active{border-color:#1768ed;background:#edf4ff;color:#1768ed}.role-switch .active>text{background:#1768ed;color:#fff}
label{display:block;margin-bottom:22rpx}label>text{display:block;font-size:24rpx;font-weight:700;margin-bottom:10rpx}input{height:80rpx;background:#f5f8fc;border:1rpx solid #dfe7f2;border-radius:15rpx;padding:0 20rpx;font-size:25rpx}.review-tip{padding:16rpx;background:#fff7e8;color:#a5660d;border-radius:12rpx;font-size:21rpx;line-height:1.55;margin-bottom:22rpx}.back-login{text-align:center;color:#1768ed;font-size:23rpx;font-weight:700;margin-top:24rpx}
</style>
