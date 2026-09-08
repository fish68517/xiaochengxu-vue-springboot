<template>
  <view v-if="loading || error || permissionDenied || empty" class="state" :class="{ denied: permissionDenied, loading }">
    <view class="state-icon"><view v-if="loading" class="spinner"/><text v-else>{{ permissionDenied ? '!' : error ? '×' : '○' }}</text></view>
    <text class="title">{{ title }}</text>
    <text v-if="detail" class="detail">{{ detail }}</text>
    <button v-if="error && !permissionDenied" class="retry" @click="$emit('retry')">重试</button>
  </view>
</template>
<script setup>
import { computed } from 'vue';
const props = defineProps({ loading: Boolean, error: { type: String, default: '' }, empty: Boolean, permissionDenied: Boolean, emptyText: { type: String, default: '暂无数据' } });
defineEmits(['retry']);
const title = computed(() => props.loading ? '加载中…' : props.permissionDenied ? '无权访问此模块' : props.error ? '加载失败' : props.emptyText);
const detail = computed(() => props.permissionDenied ? '请联系管理员配置当前品牌角色权限' : props.error);
</script>
<style scoped>.state{padding:48px 24px;text-align:center;background:#fff;border:1px solid var(--es-border-soft);border-radius:var(--es-radius);box-shadow:var(--es-glow)}.state-icon{width:38px;height:38px;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;color:var(--es-text-soft);font-size:20px;background:#f8fafc;border-radius:50%}.spinner{width:17px;height:17px;border:2px solid #d0d5dd;border-top-color:var(--es-primary);border-radius:50%;animation:spin .8s linear infinite}.title,.detail{display:block;color:var(--es-text);font-size:14px}.detail{max-width:480px;margin:7px auto 0;color:var(--es-text-dim);font-size:12px}.denied .state-icon,.denied .title{color:var(--es-danger);background:var(--es-danger-soft)}.retry{width:auto;margin-top:16px;padding:7px 16px;color:var(--es-primary);font-size:12px;background:var(--es-primary-soft);border:1px solid #c7d2fe;border-radius:8px}@keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.spinner{animation:none}}</style>
