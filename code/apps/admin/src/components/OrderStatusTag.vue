<template><text class="tag" :class="tone">{{ label }}</text></template>
<script setup>
import { computed } from 'vue';
const props = defineProps({ status: { type: String, default: '' } });
const labels = { PENDING_PAYMENT: '待支付', PENDING_ACCEPT: '待受理', PENDING_GRAB: '待抢单', ASSIGN_PENDING: '待指派确认', IN_SERVICE: '服务中', PENDING_CONFIRM: '待验收', SETTLED: '已结单', REFUNDING: '退款中', REFUNDED: '已退款', DISPUTING: '异议中', CANCELLED: '已取消', CLOSED: '已关闭' };
const label = computed(() => labels[props.status] || props.status || '未知');
const tone = computed(() => ['SETTLED'].includes(props.status) ? 'success' : ['REFUNDED', 'CANCELLED', 'CLOSED'].includes(props.status) ? 'muted' : ['REFUNDING', 'DISPUTING'].includes(props.status) ? 'danger' : 'active');
</script>
<style scoped>.tag{display:inline-block;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:650}.active{color:var(--es-primary);background:var(--es-primary-soft);border:1px solid #c7d2fe}.success{color:var(--es-success);background:var(--es-success-soft);border:1px solid #abefc6}.danger{color:var(--es-danger);background:var(--es-danger-soft);border:1px solid #fecdca}.muted{color:var(--es-text-dim);background:#f2f4f7;border:1px solid var(--es-border-soft)}</style>
