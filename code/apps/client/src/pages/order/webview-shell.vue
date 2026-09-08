<template>
  <view class="shell">
    <!-- 拿到 token 前展示加载态;token 就绪后渲染 web-view(其自带加载指示) -->
    <view v-if="!url" class="loading"><text>加载中…</text></view>
    <web-view v-else :src="url" />
  </view>
</template>

<script setup>
// 小程序端下单壳页:详情页先 h5Token 换取 token,再经 web-view 打开 H5 下单页(带 token 与加载态)。
// 小程序端零支付:下单/支付/支付成功均在 H5 页内完成,本页仅承载 web-view。
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { H5_ORDER_BASE_URL } from '../../api.js';

const url = ref('');

onLoad((query) => {
  const token = (query && query.token) || '';
  const orderId = (query && query.orderId) || '';
  if (!token && !orderId) {
    uni.showToast({ title: '下单链接无效', icon: 'none' });
    return;
  }
  // H5 为 hash 路由,下单页真实路径 /#/pages/h5-order/index?token=...;继续支付带 orderId。
  let params = token ? `token=${encodeURIComponent(token)}` : '';
  if (orderId) params += (params ? '&' : '') + `orderId=${encodeURIComponent(orderId)}`;
  url.value = `${H5_ORDER_BASE_URL}/#/pages/h5-order/index?${params}`;
});
</script>

<style lang="scss" scoped>
.shell { width: 100%; height: 100vh; }
.loading { display: flex; align-items: center; justify-content: center; height: 100vh; color: #888; font-size: 28rpx; }
</style>
