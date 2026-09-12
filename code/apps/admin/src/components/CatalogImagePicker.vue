<template>
  <view class="catalog-picker">
    <view class="image-list">
      <view v-for="(url, index) in modelValue" :key="index" class="image-item">
        <image :src="url" mode="aspectFit" @click="preview(url)" />
        <button :disabled="busy || disabled" @click="remove(index)">移除</button>
      </view>
    </view>
    <button class="pick-button" :disabled="busy || disabled || modelValue.length >= max" @click="choose">{{ busy ? '正在上传…' : '选择本地图片' }}</button>
    <text class="hint">PNG / JPEG / WebP，单张不超过 1 MiB{{ max > 1 ? `，最多 ${max} 张，首张为封面` : '' }}。上传后请保存配置。</text>
    <text v-if="error" class="error">{{ error }}</text>
  </view>
</template>

<script setup>
import { nextTick, ref } from 'vue';
import { api } from '../api.js';
const props = defineProps({ modelValue: { type: Array, default: () => [] }, brandId: { type: String, default: '' }, kind: { type: String, required: true }, max: { type: Number, default: 1 }, disabled: Boolean });
const emit = defineEmits(['update:modelValue', 'busy']);
const busy = ref(false);
const error = ref('');
function remove(index) { if (!busy.value && !props.disabled) emit('update:modelValue', props.modelValue.filter((_, i) => i !== index)); }
function preview(url) { uni.previewImage({ urls: props.modelValue, current: url }); }
async function readImage(path) {
  // 管理员为 H5：只读取选择器给出的本地 blob，不让云端抓取任意 URL。
  const response = await fetch(path);
  if (!response.ok) throw new Error('无法读取本地图片，请重新选择');
  const blob = await response.blob();
  if (!blob.size || blob.size > 1024 * 1024) throw new Error('图片不得超过 1 MiB，请压缩后重试');
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type)) throw new Error('请选择 PNG、JPEG 或 WebP 图片');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(blob);
  });
}
async function choose() {
  if (busy.value || props.disabled) return;
  error.value = '';
  const brandId = props.brandId.trim();
  if (!brandId) { error.value = '请先填写或选择所属品牌'; return; }
  busy.value = true; emit('busy', true);
  const token = uni.getStorageSync('token');
  try {
    const selected = await new Promise((resolve, reject) => uni.chooseImage({ count: Math.max(1, props.max - props.modelValue.length), sizeType: ['original'], sourceType: ['album'], success: resolve, fail: reject }));
    for (const path of (selected.tempFilePaths || []).slice(0, props.max - props.modelValue.length)) {
      const content = await readImage(path);
      if (props.brandId.trim() !== brandId || uni.getStorageSync('token') !== token) throw new Error('品牌或登录账号已切换，请重新选择图片');
      const result = await api.uploadCatalogImage({ brandId, kind: props.kind, content });
      if (props.brandId.trim() !== brandId || uni.getStorageSync('token') !== token) throw new Error('品牌或登录账号已切换，请重新选择图片');
      if (!result?.url?.startsWith('https://')) throw new Error('未返回有效图片地址');
      emit('update:modelValue', [...props.modelValue, result.url]);
      // 等待父级 v-model 更新，下一张追加时不覆盖前一张。
      await nextTick();
    }
  } catch (e) {
    if (!/cancel/i.test(e?.errMsg || '')) error.value = e?.message || e?.errMsg || '上传失败，请重新选择';
  } finally { busy.value = false; emit('busy', false); }
}
</script>

<style scoped>
.image-list{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:12px}.image-item{width:112px;padding:6px;border:1px solid #e4e7ec;border-radius:8px}.image-item image{width:100px;height:88px;cursor:pointer}.image-item button{margin-top:6px;padding:0;font-size:12px;color:#d92d20;line-height:28px}.pick-button{width:auto;display:inline-block;margin:0;padding:0 16px;font-size:13px;line-height:36px;color:#4f46e5;background:#eef2ff}.hint,.error{display:block;margin-top:8px;font-size:12px;line-height:1.6}.hint{color:#667085}.error{color:#d92d20}
</style>
