<template>
  <WorkbenchShell role="cs" active="security" title="安全中心" subtitle="修改当前客服账号的登录密码">
    <view v-if="required" class="required-banner"><view class="banner-mark">!</view><view><text>必须先修改密码</text><text>当前账号仍在使用初始密码或弱密码，修改并重新登录后才能继续处理订单。</text></view></view>
    <view class="security-grid">
      <view class="panel">
        <text class="panel-title">修改登录密码</text>
        <text class="panel-desc">为确保账号安全，修改成功后当前会话会失效，请使用新密码重新登录。</text>
        <label class="field"><text>当前密码</text><input v-model="oldPassword" class="input" password placeholder="请输入当前登录密码" /></label>
        <label class="field"><text>新密码</text><input v-model="newPassword" class="input" password placeholder="12–128 位，至少满足 3 类字符" /></label>
        <label class="field"><text>确认新密码</text><input v-model="confirmPassword" class="input" password placeholder="再次输入新密码" @confirm="submit" /></label>
        <view class="rules"><text :class="{ ok: lengthValid }">12–128 位</text><text :class="{ ok: classValid }">大写、小写、数字、特殊字符至少 3 类</text><text :class="{ ok: sameValid }">两次输入一致</text></view>
        <view v-if="errorMessage" class="error-message">{{ errorMessage }}</view>
        <button class="submit-button" :disabled="submitting" @click="submit">{{ submitting ? '正在修改…' : '确认修改密码' }}</button>
      </view>
      <view class="tips-panel"><text>安全建议</text><text>不要使用手机号、姓名或连续数字作为密码。</text><text>不要与其他网站共用同一密码。</text><text>管理员和平台工作人员不会索要您的密码。</text></view>
    </view>
  </WorkbenchShell>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '../../api.js';
import { guard, logout } from '../../common.js';
import WorkbenchShell from '../../components/WorkbenchShell.vue';

const oldPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const submitting = ref(false);
const errorMessage = ref('');
const required = ref(false);

const lengthValid = computed(() => newPassword.value.length >= 12 && newPassword.value.length <= 128);
const classValid = computed(() => passwordClassCount(newPassword.value) >= 3);
const sameValid = computed(() => !!newPassword.value && newPassword.value === confirmPassword.value);

function passwordClassCount(value) {
  return [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/].filter((rule) => rule.test(value || '')).length;
}

async function submit() {
  errorMessage.value = '';
  if (!oldPassword.value || !newPassword.value || !confirmPassword.value) {
    errorMessage.value = '请完整填写当前密码、新密码和确认密码';
    return;
  }
  if (!lengthValid.value || !classValid.value) {
    errorMessage.value = '新密码需为 12–128 位，并满足大写、小写、数字、特殊字符中的至少 3 类';
    return;
  }
  if (!sameValid.value) {
    errorMessage.value = '两次输入的新密码不一致';
    return;
  }
  submitting.value = true;
  try {
    await api.changePassword({ oldPassword: oldPassword.value, newPassword: newPassword.value });
    uni.removeStorageSync('mustChangePwd');
    uni.showModal({
      title: '密码修改成功',
      content: '为保护账号安全，请使用新密码重新登录。',
      showCancel: false,
      success: logout,
    });
  } catch (error) {
    errorMessage.value = error.message || '密码修改失败，请稍后重试';
  } finally {
    submitting.value = false;
  }
}

onLoad((query) => {
  if (!guard(['CS'])) return;
  required.value = query?.required === '1' || !!uni.getStorageSync('mustChangePwd');
});
</script>

<style lang="scss" scoped>
.required-banner{margin-bottom:18px;padding:16px 18px;display:flex;align-items:center;gap:13px;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px}.banner-mark{width:34px;height:34px;flex:none;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;background:#f97316;border-radius:50%}.required-banner text{display:block}.required-banner text:first-child{font-size:14px;font-weight:700}.required-banner text:last-child{margin-top:4px;font-size:12px;line-height:1.6}.security-grid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(250px,.7fr);gap:18px}.panel,.tips-panel{padding:24px;background:#fff;border:1px solid var(--es-border-soft);border-radius:14px;box-shadow:var(--es-glow)}.panel-title,.panel-desc{display:block}.panel-title{font-size:18px;font-weight:700}.panel-desc{margin:7px 0 22px;color:var(--es-text-dim);font-size:12px;line-height:1.6}.field{display:block;margin-top:16px}.field>text{display:block;margin-bottom:7px;color:#344054;font-size:12px;font-weight:600}.input{width:100%;height:44px;padding:0 13px;color:var(--es-text);background:#fff!important;border:1px solid var(--es-border)!important;border-radius:9px}.rules{margin:14px 0;display:flex;flex-wrap:wrap;gap:9px 16px;color:#98a2b3;font-size:11px}.rules text::before{content:'○';margin-right:4px}.rules text.ok{color:#027a48}.rules text.ok::before{content:'✓'}.error-message{margin:12px 0;padding:10px 12px;color:#b42318;font-size:12px;background:#fef3f2;border-radius:8px}.submit-button{height:42px;margin-top:5px;color:#fff;font-size:13px;font-weight:650;background:var(--es-primary);border-radius:9px}.submit-button[disabled]{opacity:.55}.tips-panel{height:max-content;color:var(--es-text-dim)}.tips-panel text{display:block;margin-top:12px;font-size:12px;line-height:1.6}.tips-panel text:first-child{margin-top:0;color:var(--es-text);font-size:15px;font-weight:700}.tips-panel text:not(:first-child)::before{content:'•';margin-right:8px;color:var(--es-primary)}
@media(max-width:760px){.security-grid{grid-template-columns:1fr}.panel,.tips-panel{padding:18px}.required-banner{align-items:flex-start}}
</style>
