<template><text :class="['money', { negative: amountFen < 0 }]">¥{{ yuan }}</text></template>
<script setup>
import { computed } from 'vue';
const props = defineProps({ amountFen: { type: Number, default: 0 } });
const yuan = computed(() => (Number(props.amountFen || 0) / 100).toFixed(2));
</script>
<style scoped>.money{color:var(--es-text);font-weight:700;font-variant-numeric:tabular-nums}.negative{color:var(--es-danger)}</style>
