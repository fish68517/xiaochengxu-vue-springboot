<template>
  <AdminShell title="商品管理">
  <view class="page">
    <PageHeader eyebrow="SERVICE CATALOG" title="商品管理" description="配置多品牌服务商品、履约保底、价格与佣金规则"><button class="header-add" @click="newProduct">＋ 新增商品</button></PageHeader>

    <view v-if="error" class="empty">
      <text>{{ error }}</text>
      <button class="mini-btn" @click="load">重试</button>
    </view>
    <view v-else-if="products.length === 0" class="empty"><text>暂无商品，点击“新增商品”创建</text></view>
    <view v-for="p in products" :key="idOf(p)" class="product-row" :class="{ active: editingId === idOf(p) }" @click="edit(p)">
      <view class="product-main">
        <text class="product-title">{{ gameText(p.game) }} · {{ serviceText(p.serviceType) }} · {{ p.tierName }}</text>
        <text class="product-sub">¥{{ fenToYuan(p.priceFen) }} · 保底 {{ p.guaranteedOutput }}{{ p.outputUnit || '' }} · 抽成 {{ commissionText(p.commission) }} · 排序 {{ p.sort ?? 0 }}</text>
        <text class="product-sub">{{ p.status === 'OFF' ? '已下架' : '已上架' }} · 品牌 {{ p.brandId || 'default' }} · 版本 v{{ p.version || 1 }}</text>
      </view>
      <button class="mini-btn" @click.stop="toggle(p)">{{ p.status === 'OFF' ? '上架' : '下架' }}</button>
    </view>

    <view class="form">
      <text class="section-title">{{ editingId ? '编辑商品' : '新增商品' }}</text>

      <view class="field">
        <text class="label">游戏</text>
        <input v-model="form.game" class="input" placeholder="游戏名（来自字典）" />
      </view>
      <view class="field">
        <text class="label">服务类型</text>
        <input v-model="form.serviceType" class="input" placeholder="如 陪玩-组队娱乐" />
      </view>
      <view class="field">
        <text class="label">档位名</text>
        <input v-model="form.tierName" class="input" placeholder="如 陪玩套餐（一档）" />
      </view>
      <view class="field">
        <text class="label">保底产出量</text>
        <input v-model="form.guaranteedOutput" class="input" type="number" placeholder="> 0" />
      </view>
      <view class="field">
        <text class="label">产出单位</text>
        <input v-model="form.outputUnit" class="input" placeholder="如 局 / 次 / 游戏内货币" />
      </view>
      <view class="field">
        <text class="label">价格（元）</text>
        <input v-model="form.priceYuan" class="input" type="digit" placeholder="> 0" />
      </view>

      <text class="label">抽成方式</text>
      <radio-group class="radio-row" @change="onCommissionType">
        <label class="radio-item"><radio value="fixed" :checked="form.commission.type === 'fixed'" />固定金额</label>
        <label class="radio-item"><radio value="percent" :checked="form.commission.type === 'percent'" />百分比</label>
      </radio-group>
      <view class="field">
        <text class="label">{{ form.commission.type === 'fixed' ? '固定金额（元）' : '百分比（%）' }}</text>
        <input v-model="form.commissionValue" class="input" type="digit" placeholder="抽成数值" />
      </view>

      <view class="field">
        <text class="label">图片 URL（每行一个）</text>
        <textarea v-model="form.imagesText" class="textarea" placeholder="https://..." />
      </view>
      <view class="field">
        <text class="label">品牌附件 ID（每行一个）</text>
        <textarea v-model="form.assetIdsText" class="textarea" placeholder="attachment-id" />
      </view>
      <view class="field">
        <text class="label">下单动态表单 JSON Schema</text>
        <textarea v-model="form.formSchemaText" class="textarea schema-input" placeholder='{"required":["server"],"properties":{"server":{"type":"string"}}}' />
      </view>
      <view class="field">
        <text class="label">排序</text>
        <input v-model="form.sort" class="input" type="number" placeholder="数字越小越靠前" />
      </view>

      <view class="switch-row">
        <text class="label">上架（ON / OFF）</text>
        <switch :checked="form.status === 'ON'" @change="(e) => (form.status = e.detail.value ? 'ON' : 'OFF')" />
      </view>

      <button class="save-btn" :disabled="saving" @click="save">保存商品</button>
    </view>
  </view>
  </AdminShell>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '../../api.js';
import { findRedline } from '../../utils/redline.js';
import { gameText, serviceText } from '../../utils/display.js';

const products = ref([]);
const error = ref('');
const saving = ref(false);
const editingId = ref('');

function emptyForm() {
  return {
    game: '', serviceType: '', tierName: '', guaranteedOutput: '', outputUnit: '',
    priceYuan: '', commission: { type: 'fixed' }, commissionValue: '', imagesText: '', assetIdsText: '', formSchemaText: '{\n  "required": [],\n  "properties": {}\n}',
    sort: '', status: 'ON',
  };
}
const form = ref(emptyForm());

// 主键兼容：统一 _id 后以 _id 为准，兼容旧 id。
function idOf(p) { return p._id || p.id; }

onLoad(load);

// 加载商品列表，失败显示 error/retry 空态（T0-09）。
async function load() {
  error.value = '';
  try {
    const list = await api.listProducts({});
    products.value = Array.isArray(list) ? list : [];
  } catch (e) {
    error.value = e.message || '商品列表加载失败';
  }
}

function fenToYuan(fen) { return ((fen || 0) / 100).toFixed(2); }
function commissionText(c) {
  if (!c) return '—';
  return c.type === 'fixed' ? `固定 ¥${((c.valueFen || 0) / 100).toFixed(2)}` : `${c.valuePercent || 0}%`;
}

// 上架/下架：真实调 updateProductStatus，成功以服务端返回更新，失败回滚。
async function toggle(p) {
  const next = p.status === 'OFF' ? 'ON' : 'OFF';
  try {
    const updated = await api.updateProductStatus({ productId: idOf(p), status: next });
    const idx = products.value.findIndex((x) => idOf(x) === idOf(p));
    if (idx >= 0) products.value[idx] = updated || { ...p, status: next };
    uni.showToast({ title: next === 'OFF' ? '已下架' : '已上架', icon: 'success' });
  } catch (e) {
    uni.showToast({ title: e.message || '操作失败', icon: 'none' });
  }
}

function edit(p) {
  editingId.value = idOf(p);
  form.value = {
    game: p.game || '',
    serviceType: p.serviceType || '',
    tierName: p.tierName || '',
    guaranteedOutput: p.guaranteedOutput ?? '',
    outputUnit: p.outputUnit || '',
    priceYuan: ((p.priceFen || 0) / 100).toString(),
    commission: p.commission && p.commission.type ? { type: p.commission.type } : { type: 'fixed' },
    commissionValue: p.commission
      ? (p.commission.type === 'fixed' ? ((p.commission.valueFen || 0) / 100).toString() : String(p.commission.valuePercent || ''))
      : '',
    imagesText: Array.isArray(p.images) ? p.images.join('\n') : '',
    assetIdsText: Array.isArray(p.assetIds) ? p.assetIds.join('\n') : '',
    formSchemaText: JSON.stringify(p.formSchema || { required: [], properties: {} }, null, 2),
    sort: p.sort ?? '',
    status: p.status === 'OFF' ? 'OFF' : 'ON',
  };
}

function newProduct() {
  editingId.value = '';
  form.value = emptyForm();
}

function onCommissionType(e) { form.value.commission.type = e.detail.value; }

// 文案红线校验：档位名/服务类型禁止出现禁用词，命中即拦截并提示。
function validateRedline() {
  for (const key of ['tierName', 'serviceType', 'game']) {
    const word = findRedline(form.value[key]);
    if (word) { uni.showToast({ title: `文案含违禁词“${word}”，请修改`, icon: 'none' }); return false; }
  }
  return true;
}

// 组装商品入参（元 → 分；抽成按 fixed/percent 分别落 valueFen/valuePercent）。
function buildPayload() {
  const priceFen = Math.round(parseFloat(form.value.priceYuan) * 100);
  const commission = form.value.commission.type === 'fixed'
    ? { type: 'fixed', valueFen: Math.round(parseFloat(form.value.commissionValue || '0') * 100) }
    : { type: 'percent', valuePercent: parseFloat(form.value.commissionValue || '0') };
  const images = form.value.imagesText.split('\n').map((s) => s.trim()).filter(Boolean);
  const assetIds = form.value.assetIdsText.split('\n').map((s) => s.trim()).filter(Boolean);
  const formSchema = JSON.parse(form.value.formSchemaText || '{}');
  return {
    title: form.value.tierName.trim(),
    game: form.value.game.trim(),
    serviceType: form.value.serviceType.trim(),
    tierName: form.value.tierName.trim(),
    guaranteedOutput: Number(form.value.guaranteedOutput),
    outputUnit: form.value.outputUnit.trim(),
    priceFen,
    commission,
    images,
    assetIds,
    formSchema,
    status: form.value.status,
    sort: Number(form.value.sort || 0),
  };
}

// 保存商品：真实调 saveProduct，成功后以服务端返回替换/新增本地行。
async function save() {
  if (!form.value.game) { uni.showToast({ title: '游戏不能为空', icon: 'none' }); return; }
  if (!form.value.serviceType) { uni.showToast({ title: '服务类型不能为空', icon: 'none' }); return; }
  if (!form.value.tierName) { uni.showToast({ title: '档位名不能为空', icon: 'none' }); return; }
  if (!validateRedline()) return;
  const guaranteedOutput = Number(form.value.guaranteedOutput);
  const priceFen = Math.round(parseFloat(form.value.priceYuan) * 100);
  if (!(guaranteedOutput > 0)) { uni.showToast({ title: '保底产出量需大于 0', icon: 'none' }); return; }
  if (!(priceFen > 0)) { uni.showToast({ title: '价格需大于 0', icon: 'none' }); return; }

  saving.value = true;
  try {
    const payload = buildPayload();
    if (editingId.value) payload.id = editingId.value;
    const saved = await api.saveProduct(payload);
    const idx = products.value.findIndex((x) => idOf(x) === idOf(saved));
    if (idx >= 0) products.value[idx] = saved;
    else products.value.push(saved);
    editingId.value = idOf(saved);
    uni.showToast({ title: '已保存', icon: 'success' });
  } catch (e) {
    uni.showToast({ title: e instanceof SyntaxError ? '动态表单 JSON 格式错误' : (e.message || '保存失败'), icon: 'none' });
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
.product-row { display: flex; justify-content: space-between; align-items: center; padding: 15px 17px; margin-bottom: 10px; background: var(--es-bg-panel); border: 1px solid var(--es-border-soft); border-radius: var(--es-radius); box-shadow:var(--es-glow);cursor:pointer }
.product-row.active { border-color: var(--es-primary); }
.product-main { display: flex; flex-direction: column; flex: 1; }
.product-title { font-size: 14px; color: var(--es-text); font-weight: 700; }
.product-sub { margin-top: 6px; font-size: 11px; color: var(--es-text-dim); }
.mini-btn { width:auto;margin:0;padding: 6px 11px; font-size: 11px; color: var(--es-primary); border: 1px solid #c7d2fe; border-radius: 7px; background: var(--es-primary-soft); }
.add-btn { margin-top: 16rpx; color: var(--es-primary); border: 1rpx dashed var(--es-primary); background: transparent; border-radius: var(--es-radius); }
.form { margin-top: 18px; padding: 20px; background: var(--es-bg-panel); border: 1px solid var(--es-border-soft); border-radius: var(--es-radius); box-shadow:var(--es-glow) }
.section-title { display: block; font-size: 15px; color: var(--es-text); margin: 20px 0 10px;font-weight:700 }
.field { margin-bottom: 14px; }
.label { display: block; font-size: 12px; color: #344054; margin-bottom: 6px;font-weight:600 }
.input { height: 40px; padding: 0 12px; background: #fff; border: 1px solid var(--es-border); border-radius: 8px; color: var(--es-text); }
.textarea { width: 100%; min-height: 90px; padding: 10px 12px; background: #fff; border: 1px solid var(--es-border); border-radius: 8px; color: var(--es-text); }
.schema-input { min-height: 220rpx; font-family: monospace; }
.radio-row { display: flex; gap: 32rpx; margin-bottom: 20rpx; }
.radio-item { display: flex; align-items: center; gap: 8rpx; font-size: 26rpx; color: var(--es-text); }
.switch-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; }
.save-btn { margin-top: 8px; background: var(--es-primary); color: #fff; font-weight: 700; border-radius: 8px; }
.empty { padding: 32rpx; text-align: center; color: var(--es-text-dim); font-size: 26rpx; }
</style>
