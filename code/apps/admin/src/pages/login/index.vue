<template>
  <view class="login-page">
    <view class="brand-side">
      <view class="brand-lockup"><view class="brand-mark">星</view><view><text class="brand-name">星河服务</text><text class="brand-caption">MULTI-BRAND SERVICE PLATFORM</text></view></view>
      <view class="brand-copy"><text class="eyebrow">运营管理控制台</text><text class="hero-title">让每个品牌的服务运营<br/>清晰、稳健、可追溯</text><text class="hero-desc">统一管理订单、商品、人员、资金与风控流程，所有关键操作由后端权限校验并保留审计记录。</text></view>
      <view class="feature-list"><view><text class="feature-icon">✓</text><text>多品牌数据隔离与授权范围</text></view><view><text class="feature-icon">✓</text><text>订单全生命周期与资金账本</text></view><view><text class="feature-icon">✓</text><text>退款、提现、仲裁风险闭环</text></view></view>
      <text class="brand-foot">© 2026 星河服务 · 本地演示环境</text>
    </view>
    <view class="form-side">
      <view class="panel">
        <view class="mobile-brand"><view class="brand-mark">星</view><text>星河服务管理台</text></view>
        <text class="welcome">欢迎回来</text>
        <text class="sub">使用有管理权限的账号登录控制台</text>
        <view class="field"><text class="label">手机号</text><input v-model="phone" class="input" type="number" maxlength="11" placeholder="请输入管理员手机号" /></view>
        <view class="field"><view class="label-row"><text class="label">密码</text><text>安全登录</text></view><input v-model="password" class="input" password placeholder="请输入密码" @confirm="login" /></view>
        <view v-if="errorMsg" class="form-error"><text>{{ errorMsg }}</text></view>
        <button class="login-btn" :disabled="loading" @click="login">{{ loading ? '正在验证…' : '登录管理台' }}</button>
        <view class="demo-hint"><text>本地演示账号</text><text>管理员：13800000000 / admin123</text></view>
        <text class="security-note">登录即表示您已获授权使用本系统。关键操作将记录操作人、时间与变更内容。</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { api, setActiveBrandId } from '../../api.js';
const phone = ref('');
const password = ref('');
const loading = ref(false);
const errorMsg = ref('');

// 管理端入口允许平台/品牌/财务/仲裁管理角色，菜单和数据范围以后端 profile 为准。
async function login() {
  if (!phone.value || !password.value) {
    errorMsg.value = '请输入手机号和密码';
    return;
  }
  errorMsg.value = '';
  loading.value = true;
  try {
    const res = await api.authLogin({ phone: phone.value, password: password.value });
    const allowed = ['ADMIN', 'SUPER_ADMIN', 'BRAND_ADMIN', 'FINANCE_REVIEWER', 'ARBITRATOR'];
    if (!allowed.includes(res.user.role)) {
      errorMsg.value = '该账号没有管理台访问权限';
      return;
    }
    uni.setStorageSync('token', res.token);
    uni.setStorageSync('user', res.user);
    setActiveBrandId('');
    uni.setStorageSync('accessProfile', await api.getAccessProfile());
    uni.redirectTo({ url: '/pages/dashboard/index' });
  } catch (e) {
    errorMsg.value = e.message || '登录失败，请检查账号或网络';
  } finally {
    loading.value = false;
  }
}
</script>

<style lang="scss" scoped>
.login-page{min-height:100vh;display:grid;grid-template-columns:minmax(430px,46%) 1fr;background:#fff}.brand-side{position:relative;min-height:100vh;padding:46px clamp(40px,5vw,88px);display:flex;flex-direction:column;overflow:hidden;color:#fff;background:linear-gradient(145deg,#121937 0%,#28328f 54%,#4f46e5 100%)}.brand-side::before,.brand-side::after{content:'';position:absolute;border:1px solid rgba(255,255,255,.12);border-radius:50%}.brand-side::before{width:520px;height:520px;right:-260px;top:-130px}.brand-side::after{width:320px;height:320px;left:-190px;bottom:-100px}.brand-lockup,.mobile-brand{display:flex;align-items:center;gap:12px}.brand-mark{width:42px;height:42px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:800;background:linear-gradient(135deg,#7c83ff,#2dd4bf);border-radius:12px;box-shadow:0 10px 24px rgba(0,0,0,.18)}.brand-name,.brand-caption{display:block}.brand-name{font-size:18px;font-weight:750}.brand-caption{margin-top:3px;color:rgba(255,255,255,.56);font-size:9px;letter-spacing:.12em}.brand-copy{position:relative;z-index:1;margin:auto 0 34px}.eyebrow{display:block;margin-bottom:18px;color:#a5f3fc;font-size:12px;font-weight:700;letter-spacing:.14em}.hero-title{display:block;font-size:clamp(34px,3vw,48px);font-weight:780;line-height:1.3;letter-spacing:-.02em}.hero-desc{display:block;max-width:530px;margin-top:22px;color:rgba(255,255,255,.72);font-size:15px;line-height:1.8}.feature-list{position:relative;z-index:1;display:grid;gap:13px}.feature-list>view{display:flex;align-items:center;gap:10px;color:rgba(255,255,255,.82);font-size:13px}.feature-icon{width:22px;height:22px;display:flex;align-items:center;justify-content:center;color:#0f766e;background:#ccfbf1;border-radius:50%;font-size:12px;font-weight:800}.brand-foot{position:relative;z-index:1;margin-top:50px;color:rgba(255,255,255,.45);font-size:11px}.form-side{padding:40px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 80% 15%,#eef2ff 0,transparent 31%),#fff}.panel{width:100%;max-width:420px}.mobile-brand{display:none}.welcome{display:block;color:var(--es-text);font-size:30px;font-weight:780}.sub{display:block;margin:9px 0 34px;color:var(--es-text-dim);font-size:14px}.field{margin-bottom:20px}.label-row{display:flex;justify-content:space-between}.label-row>text:last-child{color:var(--es-text-soft);font-size:11px}.label{display:block;margin-bottom:8px;color:#344054;font-size:13px;font-weight:650}.input{height:46px;padding:0 14px;color:var(--es-text);background:#fff;border:1px solid var(--es-border);border-radius:9px}.input:focus-within{border-color:var(--es-primary);box-shadow:0 0 0 3px rgba(79,70,229,.12)}.form-error{margin:-6px 0 16px;padding:10px 12px;color:var(--es-danger);font-size:12px;background:var(--es-danger-soft);border:1px solid #fecdca;border-radius:8px}.login-btn{height:46px;margin:4px 0 0;color:#fff;font-size:14px;font-weight:700;background:var(--es-primary);border-radius:9px;box-shadow:0 8px 18px rgba(79,70,229,.2)}.login-btn:hover{background:var(--es-primary-hover)}.demo-hint{margin-top:22px;padding:12px 14px;color:var(--es-text-dim);font-size:12px;background:#f8fafc;border:1px solid var(--es-border-soft);border-radius:9px}.demo-hint text{display:block}.demo-hint text:first-child{margin-bottom:4px;color:var(--es-text);font-weight:650}.security-note{display:block;margin-top:18px;color:var(--es-text-soft);font-size:11px;line-height:1.65}
@media(max-width:820px){.login-page{display:block;padding:24px;background:linear-gradient(155deg,#eef2ff,#f8fafc 45%,#fff)}.brand-side{display:none}.form-side{min-height:calc(100vh - 48px);padding:0;background:transparent}.panel{padding:28px 22px;background:#fff;border:1px solid var(--es-border-soft);border-radius:16px;box-shadow:var(--es-shadow-lg)}.mobile-brand{display:flex;margin-bottom:30px;color:var(--es-text);font-size:16px;font-weight:700}.mobile-brand .brand-mark{width:36px;height:36px;font-size:16px}.welcome{font-size:25px}}
</style>
