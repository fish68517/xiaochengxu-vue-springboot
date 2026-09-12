<template>
  <AdminShell title="品牌配置">
  <view class="page">
    <PageHeader eyebrow="BRAND CENTER" title="品牌配置" description="同一套业务代码按品牌配置驱动主题、素材、客服、渠道与法务信息"><button class="header-add" @click="newBrand">＋ 新增品牌</button></PageHeader>

    <view class="list">
      <text class="section-title">品牌列表</text>
      <view v-for="b in brands" :key="b.brandId || b.id" class="brand-row" :class="{ active: editingBrandId === b.brandId }" @click="editBrand(b)">
        <view class="brand-main">
          <text class="brand-name">{{ b.name }}</text>
          <text class="brand-sub">{{ b.code || b.brandId }} · v{{ b.publishedVersion || b.version || 1 }} · {{ b.appId }} · {{ b.status === 'ON' ? '已上架' : '已下架' }}</text>
        </view>
      </view>
      <view v-if="brands.length === 0" class="empty"><text>暂无品牌，点击“新增品牌”创建</text></view>
    </view>

    <view class="form">
      <text class="section-title">{{ editingBrandId ? '编辑品牌' : '新增品牌' }}</text>
      <scroll-view scroll-x class="tabs">
        <view class="tab-row">
          <text v-for="tab in tabs" :key="tab.key" class="tab" :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">{{ tab.label }}</text>
        </view>
      </scroll-view>

      <view v-show="activeTab === 'basic'">
      <view class="field">
        <text class="label">品牌 ID</text>
        <input v-model="form.brandId" class="input" :disabled="!!editingBrandId" placeholder="唯一标识，如 brand-a" />
      </view>
      <view class="field">
        <text class="label">品牌 Code</text>
        <input v-model="form.code" class="input" placeholder="构建标识，如 demo-a" />
      </view>
      <view class="field">
        <text class="label">小程序 AppID</text>
        <input v-model="form.appId" class="input" placeholder="wx..." />
      </view>
      <view class="field">
        <text class="label">品牌名称</text>
        <input v-model="form.name" class="input" placeholder="品牌名" />
      </view>
      <view class="switch-row">
        <text class="label">上架（ON / OFF）</text>
        <switch :checked="form.status === 'ON'" @change="(e) => (form.status = e.detail.value ? 'ON' : 'OFF')" />
      </view>
      <view class="switch-row">
        <text class="label">设为默认品牌</text>
        <switch :checked="form.isDefault" @change="(e) => (form.isDefault = e.detail.value)" />
      </view>
      </view>

      <view v-show="activeTab === 'assets'">
      <text class="section-title">品牌资产</text>
      <view class="field">
        <text class="label">Logo URL（MVP 不上传）</text>
        <input v-model="form.logo" class="input" placeholder="https://..." />
      </view>
      </view>

      <view v-show="activeTab === 'theme'">
      <text class="section-title">主题色</text>
      <view class="field">
        <text class="label">主色 primary</text>
        <input v-model="form.themeTokens.primary" class="input" placeholder="#ff2442" />
      </view>
      <view class="field">
        <text class="label">辅色 secondary</text>
        <input v-model="form.themeTokens.secondary" class="input" placeholder="#5b83f7" />
      </view>
      <view class="field">
        <text class="label">背景 bg</text>
        <input v-model="form.themeTokens.bg" class="input" placeholder="#f2f2f2" />
      </view>
      <view class="field">
        <text class="label">文字 text</text>
        <input v-model="form.themeTokens.text" class="input" placeholder="#252525" />
      </view>
      <view class="field">
        <text class="label">边框 border</text>
        <input v-model="form.themeTokens.border" class="input" placeholder="#ededed" />
      </view>
      <view class="field">
        <text class="label">圆角 radius</text>
        <input v-model="form.themeTokens.radius" class="input" placeholder="14rpx" />
      </view>

      <text class="section-title">文案（key-value）</text>
      <view v-for="(row, index) in copyRows" :key="index" class="kv-row">
        <input v-model="row.key" class="kv-key" placeholder="key，如 headerTitle" />
        <input v-model="row.value" class="kv-value" placeholder="文案" />
        <button class="mini-btn danger" @click="removeCopyRow(index)">删</button>
      </view>
      <button class="mini-btn" @click="addCopyRow">+ 添加文案</button>
      </view>

      <view v-show="activeTab === 'assets'">
      <text class="section-title">Banner URL 列表</text>
      <view v-for="(url, index) in bannerRows" :key="index" class="kv-row">
        <input v-model="bannerRows[index]" class="kv-value" placeholder="https://..." />
        <button class="mini-btn danger" @click="removeBanner(index)">删</button>
      </view>
      <button class="mini-btn" @click="addBanner">+ 添加 Banner</button>
      </view>

      <view v-show="activeTab === 'contact'">
      <text class="section-title">客服与法务</text>
      <view class="field"><text class="label">客服微信</text><input v-model="form.contactConfig.serviceWechat" class="input" placeholder="公开客服微信" /></view>
      <view class="field"><text class="label">客服电话</text><input v-model="form.contactConfig.servicePhone" class="input" placeholder="公开客服电话" /></view>
      <view class="field"><text class="label">服务时间</text><input v-model="form.contactConfig.serviceHours" class="input" placeholder="例如 09:00-22:00" /></view>
      </view>

      <view v-show="activeTab === 'legal'">
      <text class="section-title">法务配置</text>
      <view class="field"><text class="label">服务协议 URL</text><input v-model="form.legalConfig.serviceAgreementUrl" class="input" placeholder="https://..." /></view>
      <view class="field"><text class="label">隐私政策 URL</text><input v-model="form.legalConfig.privacyPolicyUrl" class="input" placeholder="https://..." /></view>
      </view>

      <view v-show="activeTab === 'channel'">
      <text class="section-title">渠道安全引用</text>
      <view class="field"><text class="label">小程序密钥引用</text><input v-model="form.channelRefs.miniProgramSecretRef" class="input" placeholder="secret://...（不填写明文）" /></view>
      <view class="field"><text class="label">支付凭据引用</text><input v-model="form.channelRefs.paymentSecretRef" class="input" placeholder="secret://xinghe/wechat-pay/production（不填写私钥）" /></view>
      <view class="field"><text>此处填写技术人员提供的引用标识，须与服务端支付映射一致。保存商户号不会自动开通微信支付；证书和密钥由技术人员配置到云函数。</text></view>

      <text class="section-title">绑定字段</text>
      <view class="field">
        <text class="label">预留空间 space</text>
        <input v-model="form.binding.space" class="input" placeholder="预留" />
      </view>
      <view class="field">
        <text class="label">商户号 merchant</text>
        <input v-model="form.binding.merchant" class="input" placeholder="商户" />
      </view>
      <view class="field">
        <text class="label">回调地址 callback</text>
        <input v-model="form.binding.callback" class="input" placeholder="https://..." />
      </view>
      </view>

      <view v-show="activeTab === 'version'" class="version-panel">
        <text class="section-title">发布版本</text>
        <text class="version-text">当前发布版本：v{{ currentVersion }}</text>
        <text class="version-note">第一阶段采用直接发布模式：每次保存均执行 version + 1、保存不可变版本快照并写审计日志。</text>
      </view>

      <button class="save-btn" :disabled="saving" @click="save">保存品牌配置</button>
    </view>
  </view>
  </AdminShell>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '../../api.js';

const DEFAULT_THEME = {
  primary: '#ff2442',
  secondary: '#5b83f7',
  bg: '#f2f2f2',
  text: '#252525',
  border: '#ededed',
  radius: '14rpx',
};

const brands = ref([]);
const editingBrandId = ref('');
const copyRows = ref([]);
const bannerRows = ref([]);
const saving = ref(false);
const activeTab = ref('basic');
const tabs = [
  { key: 'basic', label: '基本信息' }, { key: 'theme', label: '主题文案' }, { key: 'assets', label: '资产' },
  { key: 'contact', label: '客服' }, { key: 'channel', label: '渠道' }, { key: 'legal', label: '法务' }, { key: 'version', label: '发布版本' },
];
const currentVersion = ref(0);

function emptyForm() {
  return {
    brandId: '',
    code: '',
    appId: '',
    name: '',
    logo: '',
    themeTokens: { ...DEFAULT_THEME },
    binding: { space: '', merchant: '', callback: '' },
    contactConfig: { serviceWechat: '', servicePhone: '', serviceHours: '' },
    legalConfig: { serviceAgreementUrl: '', privacyPolicyUrl: '' },
    channelRefs: { miniProgramSecretRef: '', paymentSecretRef: '' },
    status: 'ON',
    isDefault: false,
  };
}
const form = ref(emptyForm());

onLoad(load);

async function load() {
  try {
    const list = await api.listBrands();
    if (Array.isArray(list)) brands.value = list;
  } catch (e) {
    console.log('品牌列表加载失败', e.message);
    uni.showToast({ title: e.message || '品牌列表加载失败', icon: 'none' });
  }
}

function editBrand(b) {
  editingBrandId.value = b.brandId || b.id || '';
  form.value = {
    brandId: b.brandId || b.id || '',
    code: b.code || b.brandId || '',
    appId: b.appId || '',
    name: b.name || '',
    logo: b.logo || '',
    themeTokens: { ...DEFAULT_THEME, ...(b.themeTokens || {}) },
    binding: { space: '', merchant: '', callback: '', ...(b.binding || {}) },
    contactConfig: { serviceWechat: '', servicePhone: '', serviceHours: '', ...(b.contactConfig || {}) },
    legalConfig: { serviceAgreementUrl: '', privacyPolicyUrl: '', ...(b.legalConfig || {}) },
    channelRefs: { miniProgramSecretRef: '', ...(b.channelRefs || {}), paymentSecretRef: b.channelRefs?.paymentSecretRef || b.channelRefs?.paymentCredentialRef || '' },
    status: b.status === 'OFF' ? 'OFF' : 'ON',
    isDefault: b.isDefault === true,
  };
  copyRows.value = Object.entries(b.copy || {}).map(([key, value]) => ({ key, value }));
  bannerRows.value = Array.isArray(b.banners) ? [...b.banners] : [];
  currentVersion.value = b.publishedVersion || b.version || 1;
}

function newBrand() {
  editingBrandId.value = '';
  form.value = emptyForm();
  copyRows.value = [];
  bannerRows.value = [];
  currentVersion.value = 0;
}

function addCopyRow() { copyRows.value.push({ key: '', value: '' }); }
function removeCopyRow(index) { copyRows.value.splice(index, 1); }
function addBanner() { bannerRows.value.push(''); }
function removeBanner(index) { bannerRows.value.splice(index, 1); }

function buildBrand() {
  const channelRefs = { ...form.value.channelRefs, paymentSecretRef: (form.value.channelRefs.paymentSecretRef || '').trim() };
  delete channelRefs.paymentCredentialRef;
  const copy = {};
  for (const row of copyRows.value) {
    const key = (row.key || '').trim();
    if (key) copy[key] = row.value == null ? '' : row.value;
  }
  return {
    brandId: (form.value.brandId || '').trim(),
    code: (form.value.code || form.value.brandId || '').trim(),
    appId: (form.value.appId || '').trim(),
    name: (form.value.name || '').trim(),
    logo: (form.value.logo || '').trim(),
    themeTokens: { ...form.value.themeTokens },
    copy,
    banners: bannerRows.value.filter((u) => u && String(u).trim()),
    binding: { ...form.value.binding },
    assetConfig: { banners: bannerRows.value.filter((u) => u && String(u).trim()) },
    contactConfig: { ...form.value.contactConfig },
    legalConfig: { ...form.value.legalConfig },
    channelRefs,
    status: form.value.status,
    isDefault: form.value.isDefault,
  };
}

async function save() {
  const brand = buildBrand();
  if (!brand.brandId) { uni.showToast({ title: '品牌 ID 不能为空', icon: 'none' }); return; }
  if (!brand.appId) { uni.showToast({ title: 'AppID 不能为空', icon: 'none' }); return; }
  if (!brand.name) { uni.showToast({ title: '品牌名称不能为空', icon: 'none' }); return; }

  saving.value = true;
  try {
    // 真实落库：以服务端返回为准更新本地列表，不做“假成功只改本地”。
    const saved = await api.saveBrandConfig(brand);
    const idx = brands.value.findIndex((b) => (b.brandId || b.id) === saved.brandId || (saved.id && (b.id === saved.id)));
    if (idx >= 0) brands.value[idx] = saved;
    else brands.value.push(saved);
    editingBrandId.value = saved.brandId;
    currentVersion.value = saved.publishedVersion || saved.version || currentVersion.value + 1;
    uni.showToast({ title: '已保存', icon: 'success' });
  } catch (e) {
    // 失败不修改本地状态，回滚已输入但未落库的表单仅由用户重试。
    uni.showToast({ title: e.message || '保存失败', icon: 'none' });
  } finally {
    saving.value = false;
  }
}
</script>

<style lang="scss" scoped>
.page { padding: 0; }
.header-add{width:auto;margin:0;padding:8px 14px;color:#fff;font-size:12px;font-weight:650;background:var(--es-primary);border:0;border-radius:8px}
.head { padding: 32rpx; margin-bottom: 24rpx; background: var(--es-bg-panel); border: 1rpx solid var(--es-border-soft); border-radius: var(--es-radius); box-shadow: var(--es-glow); }
.head-title { font-size: 40rpx; font-weight: 700; color: var(--es-primary); }
.list { margin-bottom: 24rpx; }
.section-title { display: block; font-size: 28rpx; color: var(--es-primary); margin: 24rpx 0 12rpx; }
.brand-row { display: flex; align-items: center; padding: 14px 16px; margin-bottom: 10px; background: var(--es-bg-panel); border: 1px solid var(--es-border-soft); border-radius: var(--es-radius); box-shadow:var(--es-glow);cursor:pointer }
.brand-row.active { border-color: var(--es-primary); }
.brand-main { display: flex; flex-direction: column; }
.brand-name { font-size: 14px; color: var(--es-text); font-weight: 700; }
.brand-sub { margin-top: 6px; font-size: 11px; color: var(--es-text-dim); }
.empty { padding: 32rpx; text-align: center; color: var(--es-text-dim); font-size: 26rpx; }
.form { padding: 20px; background: var(--es-bg-panel); border: 1px solid var(--es-border-soft); border-radius: var(--es-radius); box-shadow:var(--es-glow) }
.tabs { margin: 8rpx 0 24rpx; white-space: nowrap; }
.tab-row { display: flex; gap: 12rpx; }
.tab { flex: 0 0 auto; padding: 7px 12px; color: var(--es-text-dim); border: 1px solid var(--es-border-soft); border-radius: 7px; font-size: 11px; }
.tab.active { color: var(--es-primary); background: var(--es-primary-soft); border-color: #c7d2fe; font-weight: 700; }
.version-panel { min-height: 220rpx; }
.version-text, .version-note { display: block; margin-top: 16rpx; color: var(--es-text); font-size: 26rpx; }
.version-note { color: var(--es-text-dim); line-height: 1.7; }
.field { margin-bottom: 20rpx; }
.label { display: block; font-size: 26rpx; color: var(--es-primary); margin-bottom: 8rpx; }
.input { height: 40px; padding: 0 12px; background: #fff; border: 1px solid var(--es-border); border-radius: 8px; color: var(--es-text); }
.kv-row { display: flex; gap: 12rpx; margin-bottom: 12rpx; }
.kv-key { flex: 1; height: 38px; padding: 0 10px; background: #fff; border: 1px solid var(--es-border); border-radius: 8px; color: var(--es-text); }
.kv-value { flex: 2; height: 38px; padding: 0 10px; background: #fff; border: 1px solid var(--es-border); border-radius: 8px; color: var(--es-text); }
.switch-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; }
.mini-btn { margin: 8rpx 0; padding: 8rpx 20rpx; font-size: 24rpx; color: var(--es-primary); border: 1rpx solid var(--es-primary); border-radius: var(--es-radius); background: transparent; }
.mini-btn.danger { color: var(--es-danger); border-color: var(--es-danger); }
.add-btn { margin-top: 16rpx; color: var(--es-primary); border: 1rpx dashed var(--es-primary); background: transparent; border-radius: var(--es-radius); }
.save-btn { margin-top: 18px; background: var(--es-primary); color: #fff; font-weight: 700; border-radius: 8px; }
</style>
