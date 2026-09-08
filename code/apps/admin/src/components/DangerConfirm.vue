<template><button class="danger" :disabled="disabled" @click="confirm">{{ label }}</button></template>
<script setup>
const props = defineProps({ label: { type: String, default: '危险操作' }, title: { type: String, default: '请确认操作' }, content: { type: String, default: '该操作会修改业务数据，是否继续？' }, disabled: Boolean });
const emit = defineEmits(['confirm']);
function confirm() { uni.showModal({ title: props.title, content: props.content, confirmColor: '#ef4444', success: (res) => { if (res.confirm) emit('confirm'); } }); }
</script>
<style scoped>.danger{width:auto;margin:0;padding:7px 12px;color:var(--es-danger);font-size:12px;line-height:1.25;background:var(--es-danger-soft);border:1px solid #fecdca;border-radius:8px}.danger:hover{background:#fee4e2}.danger[disabled]{color:var(--es-text-soft);background:#f9fafb;border-color:var(--es-border-soft)}</style>
