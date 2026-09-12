<template>
  <view class="page">
    <view class="visual-panel">
      <view class="brand-mark">星</view><text class="visual-title">星河服务工作台</text><text class="visual-sub">让每一笔服务订单都清晰、及时、可追踪</text>
      <view class="value-list"><view><view class="check-icon"/><text>统一订单与待办</text></view><view><view class="check-icon"/><text>角色与品牌隔离</text></view><view><view class="check-icon"/><text>服务过程全程留痕</text></view></view>
    </view>
    <view class="login-side"><view class="panel">
      <view class="mobile-brand"><view>星</view><text>星河服务</text></view>
      <text class="title">欢迎登录</text><text class="sub">请选择身份并输入工作台账号</text>
      <view class="role-switch"><text class="role-item" :class="{active:mode==='cs'}" @click="selectMode('cs')">客服登录</text><text class="role-item" :class="{active:mode==='worker'}" @click="selectMode('worker')">接单人员登录</text></view>
      <view class="field"><text class="label">手机号</text><input v-model="phone" class="input" type="number" maxlength="11" placeholder="请输入手机号" @confirm="login"/></view>
      <view class="field"><text class="label">密码</text><input v-model="password" class="input" password placeholder="请输入密码" @confirm="login"/></view>
      <view v-if="errorMsg" class="error"><view class="error-dot"/><text>{{ errorMsg }}</text></view>
      <button class="login-btn" :disabled="loading" @click="login">{{ loading?'正在登录…':'登录工作台' }}</button>
      <view v-if="isDev" class="demo-hint"><text>本地演示账号</text><text>{{ mode==='worker'?'13800000001 / worker123':'13800000002 / cs123' }}</text></view>
      <text class="security-note">账号权限由管理员分配，请勿向他人泄露密码</text>
    </view>
    </view>
  </view>
</template>

<script setup>
import { sessionStore, assertLoginIdentity } from '../../session.js';
import { ref } from 'vue';
import { api, setActiveBrandId } from '../../api.js';
import { roleHome } from '../../common.js';

const mode = ref(sessionStore.get('lastWorkbenchMode') || 'cs');
const phone = ref('');
const password = ref('');
const loading = ref(false);
const errorMsg = ref('');
const isDev = import.meta.env.DEV;
function selectMode(value) { mode.value = value; errorMsg.value = ''; sessionStore.set('lastWorkbenchMode', value); }

// 双角色登录：客服走 authLogin，接单人员走 workerLogin；初始或弱密码统一强制进入对应安全页面。
async function login() {
  if (loading.value) return;
  errorMsg.value = '';
  if (!phone.value || !password.value) {
    errorMsg.value = '请输入手机号和密码';
    return;
  }
  loading.value = true;
  const loginMode = mode.value;
  let committedToken = '';
  try {
    const payload = { phone: phone.value, password: password.value };
    const res = loginMode === 'worker' ? await api.workerLogin(payload) : await api.authLogin(payload);
    assertLoginIdentity(res, loginMode);
    sessionStore.saveLogin(res);
    committedToken = res.token;
    setActiveBrandId('');
    sessionStore.set('accessProfile', await api.getAccessProfile());

    if (res.mustChangePwd) {
      uni.redirectTo({ url: loginMode === 'worker' ? '/pages/worker/profile' : '/pages/security/index?required=1' });
      return;
    }
    uni.redirectTo({ url: roleHome(res.user ? res.user.role : res.role) });
  } catch (e) {
    if (committedToken && sessionStore.get('token') === committedToken) sessionStore.clear();
    errorMsg.value = e.message || '登录失败，请检查账号密码';
  } finally {
    loading.value = false;
  }
}
</script>

<style lang="scss" scoped>
.page{min-height:100vh;min-height:100dvh;display:grid;grid-template-columns:minmax(420px,46%) 1fr;background:#fff}.visual-panel{position:relative;padding:72px;overflow:hidden;display:flex;flex-direction:column;justify-content:center;color:#fff;background:linear-gradient(145deg,#151b3c,#3f46b5 58%,#7556df)}.visual-panel::before,.visual-panel::after{content:'';position:absolute;border:1px solid rgba(255,255,255,.12);border-radius:50%}.visual-panel::before{width:520px;height:520px;right:-240px;top:-180px}.visual-panel::after{width:360px;height:360px;left:-160px;bottom:-170px}.brand-mark{width:58px;height:58px;position:relative;display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;font-weight:800;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28);border-radius:17px}.visual-title{position:relative;margin-top:26px;font-size:34px;font-weight:700}.visual-sub{position:relative;max-width:460px;margin-top:14px;color:rgba(255,255,255,.72);font-size:16px;line-height:1.7}.value-list{position:relative;margin-top:48px;display:flex;flex-direction:column;gap:18px}.value-list>view{display:flex;align-items:center;gap:12px;color:rgba(255,255,255,.86);font-size:14px}.value-list i{width:21px;height:21px;position:relative;border:1px solid rgba(255,255,255,.5);border-radius:50%}.value-list i::after{content:'';position:absolute;left:5px;top:5px;width:8px;height:4px;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(-45deg)}
.login-side{padding:48px;display:flex;align-items:center;justify-content:center;background:#f8f9fc}.panel{width:100%;max-width:430px;padding:42px;background:#fff;border:1px solid var(--es-border-soft);border-radius:18px;box-shadow:0 18px 48px rgba(16,24,40,.1)}.mobile-brand{display:none}.title{display:block;color:var(--es-text);font-size:28px;font-weight:700}.sub{display:block;margin-top:8px;color:var(--es-text-dim);font-size:14px}.role-switch{margin:28px 0 26px;padding:4px;display:flex;gap:4px;background:#f2f4f7;border-radius:10px}.role-item{height:40px;flex:1;display:flex;align-items:center;justify-content:center;color:var(--es-text-dim);font-size:14px;border-radius:8px;cursor:pointer}.role-item.active{color:var(--es-primary);font-weight:600;background:#fff;box-shadow:0 1px 3px rgba(16,24,40,.1)}.field{margin-bottom:18px}.label{display:block;margin-bottom:8px;color:var(--es-text);font-size:13px;font-weight:600}.input{width:100%;height:44px;padding:0 14px;color:var(--es-text);font-size:14px;background:#fff!important;border:1px solid var(--es-border);border-radius:9px}.error{margin:-2px 0 14px;padding:10px 12px;display:flex;align-items:center;gap:8px;color:#b42318;font-size:12px;background:#fef3f2;border-radius:8px}.error i{width:7px;height:7px;flex:none;background:var(--es-danger);border-radius:50%}.login-btn{height:46px;margin-top:4px;color:#fff;font-size:15px;font-weight:600;line-height:46px;background:var(--es-primary);border-radius:9px}.login-btn[disabled]{opacity:.62}.demo-hint{margin-top:18px;padding:12px 14px;display:flex;justify-content:space-between;color:var(--es-text-dim);font-size:12px;background:#f8f9fc;border-radius:8px}.demo-hint text:last-child{color:var(--es-primary);font-family:Consolas,monospace}.security-note{display:block;margin-top:18px;text-align:center;color:#98a2b3;font-size:11px}
@media(max-width:820px){.page{display:block;padding:24px 16px;background:linear-gradient(160deg,#eef0ff,#f8f9fc 40%)}.visual-panel{display:none}.login-side{min-height:calc(100dvh - 48px);padding:0;background:transparent}.panel{padding:28px 22px;border-radius:16px}.mobile-brand{margin-bottom:26px;display:flex;align-items:center;gap:10px;color:var(--es-text);font-size:16px;font-weight:700}.mobile-brand>view{width:38px;height:38px;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(135deg,#5b63f6,#7c3aed);border-radius:11px}.title{font-size:24px}.demo-hint{display:block}.demo-hint text{display:block}.demo-hint text:last-child{margin-top:5px}}
.check-icon{width:21px;height:21px;position:relative;border:1px solid rgba(255,255,255,.5);border-radius:50%}.check-icon::after{content:'';position:absolute;left:5px;top:5px;width:8px;height:4px;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(-45deg)}.error-dot{width:7px;height:7px;flex:none;background:var(--es-danger);border-radius:50%}
</style>
