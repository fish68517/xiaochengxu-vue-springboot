<template>
  <view class="client-header">
    <view class="brand-block">
      <image v-if="logo" class="brand-logo" :src="logo" mode="aspectFit" />
      <view v-else class="brand-fallback"><text>{{ initial }}</text></view>
      <view class="brand-copy">
        <text class="brand-name">{{ title }}</text>
        <text v-if="subtitle" class="brand-subtitle">{{ subtitle }}</text>
      </view>
    </view>
    <button class="service-button" open-type="contact" :session-from="sessionFrom" @click="showH5Contact">
      <image src="/static/icons/headset.svg" mode="aspectFit" />
      <text>客服</text>
    </button>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import { brandContact } from '../brand-assets.js';
const props = defineProps({
  title: { type: String, default: '品质服务' },
  subtitle: { type: String, default: '' },
  logo: { type: String, default: '' },
  source: { type: String, default: 'client' },
});
const initial = computed(() => (props.title || '服').slice(0, 1));
const sessionFrom = computed(() => JSON.stringify({ source: props.source }));
function showH5Contact() {
  // #ifdef H5
  const contact = brandContact();
  const lines = [contact.serviceWechat && `客服微信：${contact.serviceWechat}`, contact.servicePhone && `客服电话：${contact.servicePhone}`, contact.serviceHours && `服务时间：${contact.serviceHours}`].filter(Boolean);
  uni.showModal({ title: '联系客服', content: lines.join('\n') || '请联系品牌客服获取帮助', showCancel: false });
  // #endif
}
</script>

<style lang="scss" scoped>
.client-header { position: sticky; top: 0; z-index: 30; height: 112rpx; padding: 0 28rpx; display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,.96); border-bottom: 1rpx solid var(--color-border); backdrop-filter: blur(16rpx); }
.brand-block { min-width: 0; display: flex; align-items: center; gap: 16rpx; }
.brand-logo,.brand-fallback { width: 64rpx; height: 64rpx; flex: none; border-radius: 18rpx; }
.brand-fallback { display: flex; align-items: center; justify-content: center; color: #fff; font-size: 30rpx; font-weight: 800; background: linear-gradient(135deg,var(--brand-primary),var(--brand-secondary)); }
.brand-copy { min-width: 0; }
.brand-name { display: block; overflow: hidden; color: var(--color-text); font-size: 32rpx; font-weight: 800; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.brand-subtitle { display: block; margin-top: 3rpx; color: var(--color-text-tertiary); font-size: 21rpx; }
.service-button { width: auto; height: 72rpx; margin: 0; padding: 0 22rpx; display: flex; align-items: center; gap: 8rpx; color: var(--brand-primary); font-size: 25rpx; font-weight: 600; line-height: 72rpx; background: var(--color-primary-soft); border-radius: 36rpx; }
.service-button image { width: 34rpx; height: 34rpx; }
</style>
