<template>
  <web-view
    :src="url"
    @load="handleWebViewLoad"
    @error="handleWebViewError"
  />
</template>

<script setup>
import { ref } from 'vue';
import { onLoad, onUnload } from '@dcloudio/uni-app';
import { H5_ORDER_BASE_URL } from '../../api.js';

const url = ref('');
const safeUrl = () => url.value.replace(/([?&](?:token|h5Token|code)=)[^&#]*/gi, '$1<REDACTED>');

function handleWebViewLoad(event) {
  console.log('================ [WebView DEBUG] LOAD SUCCESS ================');
  console.log('[WebView DEBUG] event type =', event?.type || 'load');
  console.log('[WebView DEBUG] final url =', safeUrl());
}

function handleWebViewError(event) {
  console.error('================ [WebView DEBUG] LOAD ERROR ==================');
  console.error('[WebView DEBUG] error code =', event?.detail?.errCode || 'unknown');
  console.error('[WebView DEBUG] final url =', safeUrl());
}

onLoad((query) => {
  console.log('[WebView DEBUG] PAGE ONLOAD');

  const token = query?.token || '';
  const orderId = query?.orderId || '';

  console.log('[WebView DEBUG] token present =', !!token);
  console.log('[WebView DEBUG] orderId =', orderId);

  if (!token && !orderId) {
    console.error('[WebView DEBUG] token/orderId both empty');
    return;
  }

  let params = token
    ? `token=${encodeURIComponent(token)}`
    : '';

  if (orderId) {
    params += `${params ? '&' : ''}orderId=${encodeURIComponent(orderId)}`;
  }

  url.value =
    `${H5_ORDER_BASE_URL.replace(/\/+$/, '')}/?webview_rev=${Date.now()}#/pages/h5-order/index?${params}`;

  console.log('[WebView DEBUG] final url =', safeUrl());
});

onUnload(() => {
  console.log('[WebView DEBUG] PAGE UNLOAD');
});
</script>

<style lang="scss" scoped>
.shell { width: 100%; height: 100vh; }
.loading { display: flex; align-items: center; justify-content: center; height: 100vh; color: #888; font-size: 28rpx; }
</style>
