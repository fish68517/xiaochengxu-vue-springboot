<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Box,
  Coin,
  DataAnalysis,
  Document,
  Goods,
  Present,
  SwitchButton,
} from '@element-plus/icons-vue'
import { api, errorMessage, TOKEN_KEY } from './api'

type Product = {
  id: number; name: string; category: string; subtitle: string; price: string; original_price: string | null
  sales: number; stock: number; image_key: string; badge: string | null; tags: string[]; is_active: boolean
  species: string | null; age: string | null; health: string | null; size: string | null
  gender: string | null; care_advice: string | null
}
type Order = {
  id: number; order_no: string; product_name: string; total_amount: string; quantity: number; status: string
  address_name: string; address_phone: string; address_detail: string; created_at: string
  shipping_company: string | null; tracking_no: string | null
}
type Activity = {
  id: number; title: string; subtitle: string; status: string; participant_count: number
  registration_start_at: string; registration_end_at: string; draw_at: string
  prizes: Array<Record<string, unknown>>; rules: string[]; winners: Array<Record<string, unknown>>
}
type Dashboard = {
  product_count: number; active_product_count: number; activity_count: number
  registering_activity_count: number; participant_count: number; order_count: number
  paid_order_count: number; paid_amount: string; recent_orders: Order[]
}
type Audit = { id: number; operator: string; action: string; resource_type: string; resource_id: string; detail: string; created_at: string }

const loggedIn = ref(Boolean(localStorage.getItem(TOKEN_KEY)))
const loginLoading = ref(false)
const loginForm = reactive({ username: 'admin', password: 'admin123' })
const activePage = ref('dashboard')
const loading = ref(false)
const dashboard = ref<Dashboard | null>(null)
const products = ref<Product[]>([])
const activities = ref<Activity[]>([])
const orders = ref<Order[]>([])
const audits = ref<Audit[]>([])
const productDialog = ref(false)
const activityDialog = ref(false)
const shipmentDialog = ref(false)
const editingProductId = ref<number | null>(null)
const shippingOrderId = ref<number | null>(null)

const productForm = reactive({
  name: '', category: '用品', subtitle: '', price: 19.9, original_price: null as number | null,
  stock: 10, image_key: 'food', badge: '', tagsText: '', species: '', age: '', health: '',
  size: '', gender: '', care_advice: '', is_active: true,
})
const activityForm = reactive({
  title: '', subtitle: '', registration_start_at: '', registration_end_at: '', draw_at: '',
})
const shipmentForm = reactive({ shipping_company: '顺丰速运', tracking_no: '' })

const pageTitle = computed(() => ({
  dashboard: '数据概览', products: '商品管理', activities: '抽奖活动', orders: '订单管理', audits: '操作审计',
}[activePage.value] ?? '管理后台'))

const statusText: Record<string, string> = {
  DRAFT: '草稿', PUBLISHED: '待报名', REGISTERING: '报名中', DRAWING: '开奖中', DRAWN: '已开奖', CLOSED: '已关闭',
  PENDING_PAYMENT: '待支付', PAID: '已支付', SHIPPED: '已发货', COMPLETED: '已完成', CANCELLED: '已取消',
}
const statusType = (status: string) => {
  if (['REGISTERING', 'PAID', 'COMPLETED'].includes(status)) return 'success'
  if (['DRAWN', 'SHIPPED'].includes(status)) return 'primary'
  if (['PENDING_PAYMENT', 'PUBLISHED'].includes(status)) return 'warning'
  return 'info'
}
const formatTime = (value: string | null) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'

async function login() {
  loginLoading.value = true
  try {
    const { data } = await api.post('/auth/login', loginForm)
    localStorage.setItem(TOKEN_KEY, data.token)
    loggedIn.value = true
    ElMessage.success('登录成功')
    await loadPage('dashboard')
  } catch (error) { ElMessage.error(errorMessage(error)) }
  finally { loginLoading.value = false }
}

function logout() {
  localStorage.removeItem(TOKEN_KEY)
  loggedIn.value = false
}

async function loadPage(page = activePage.value) {
  activePage.value = page
  loading.value = true
  try {
    if (page === 'dashboard') dashboard.value = (await api.get('/dashboard')).data
    if (page === 'products') products.value = (await api.get('/products')).data
    if (page === 'activities') activities.value = (await api.get('/lottery/activities')).data
    if (page === 'orders') orders.value = (await api.get('/orders')).data
    if (page === 'audits') audits.value = (await api.get('/audit-logs')).data
  } catch (error) {
    if ((error as { response?: { status?: number } }).response?.status === 401) logout()
    ElMessage.error(errorMessage(error))
  } finally { loading.value = false }
}

function openProduct(product?: Product) {
  editingProductId.value = product?.id ?? null
  Object.assign(productForm, product ? {
    ...product,
    price: Number(product.price),
    original_price: product.original_price ? Number(product.original_price) : null,
    tagsText: product.tags.join(','),
    badge: product.badge ?? '', species: product.species ?? '', age: product.age ?? '',
    health: product.health ?? '', size: product.size ?? '', gender: product.gender ?? '',
    care_advice: product.care_advice ?? '',
  } : {
    name: '', category: '用品', subtitle: '', price: 19.9, original_price: null, stock: 10,
    image_key: 'food', badge: '', tagsText: '', species: '', age: '', health: '', size: '',
    gender: '', care_advice: '', is_active: true,
  })
  productDialog.value = true
}

async function saveProduct() {
  const payload = {
    ...productForm,
    badge: productForm.badge || null,
    species: productForm.species || null,
    age: productForm.age || null,
    health: productForm.health || null,
    size: productForm.size || null,
    gender: productForm.gender || null,
    care_advice: productForm.care_advice || null,
    tags: productForm.tagsText.split(',').map((item) => item.trim()).filter(Boolean),
  }
  delete (payload as Record<string, unknown>).tagsText
  try {
    if (editingProductId.value) await api.put(`/products/${editingProductId.value}`, payload)
    else await api.post('/products', payload)
    ElMessage.success(editingProductId.value ? '商品已更新' : '商品已创建')
    productDialog.value = false
    await loadPage('products')
  } catch (error) { ElMessage.error(errorMessage(error)) }
}

async function toggleProduct(product: Product) {
  try {
    await api.put(`/products/${product.id}`, { ...product, is_active: !product.is_active })
    ElMessage.success(product.is_active ? '商品已下架' : '商品已上架')
    await loadPage('products')
  } catch (error) { ElMessage.error(errorMessage(error)) }
}

async function deleteProduct(product: Product) {
  try {
    await ElMessageBox.confirm(`确认删除“${product.name}”？为保留历史订单，系统会执行软删除。`, '删除商品', { type: 'warning', confirmButtonText: '确认删除' })
    await api.delete(`/products/${product.id}`)
    ElMessage.success('商品已删除（历史订单仍保留）')
    await loadPage('products')
  } catch (error) { if (error !== 'cancel') ElMessage.error(errorMessage(error)) }
}

function openActivity() {
  const now = new Date(); const end = new Date(now.getTime() + 3 * 86400000); const draw = new Date(now.getTime() + 4 * 86400000)
  const local = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19)
  Object.assign(activityForm, { title: '', subtitle: '', registration_start_at: local(now), registration_end_at: local(end), draw_at: local(draw) })
  activityDialog.value = true
}

async function createActivity() {
  try {
    await api.post('/lottery/activities', {
      ...activityForm,
      prizes: [{ level: '一等奖', name: '商城优惠券', quantity: 1, icon: 'coupon' }],
      rules: ['用户在报名时间内免费报名', '到达开奖时间后由服务端开奖'],
    })
    ElMessage.success('活动草稿已创建')
    activityDialog.value = false
    await loadPage('activities')
  } catch (error) { ElMessage.error(errorMessage(error)) }
}

async function publishActivity(activity: Activity) {
  try {
    await ElMessageBox.confirm(`确认发布“${activity.title}”？`, '发布活动', { type: 'warning' })
    await api.post(`/lottery/activities/${activity.id}/publish`)
    ElMessage.success('活动已发布')
    await loadPage('activities')
  } catch (error) { if (error !== 'cancel') ElMessage.error(errorMessage(error)) }
}

async function showParticipants(activity: Activity) {
  try {
    const { data } = await api.get(`/lottery/activities/${activity.id}/participants`)
    const names = data.length ? data.map((item: { nickname: string }) => item.nickname).join('、') : '暂无报名用户'
    await ElMessageBox.alert(names, `${activity.title} · 报名名单`, { confirmButtonText: '知道了' })
  } catch (error) { ElMessage.error(errorMessage(error)) }
}

async function drawActivity(activity: Activity) {
  try {
    await ElMessageBox.confirm('本地联调将强制执行开奖，结果写入 MySQL，且不可重复。是否继续？', '确认开奖', { type: 'warning', confirmButtonText: '执行开奖' })
    await api.post(`/lottery/activities/${activity.id}/draw?force=true`)
    ElMessage.success('开奖完成')
    await loadPage('activities')
  } catch (error) { if (error !== 'cancel') ElMessage.error(errorMessage(error)) }
}

function openShipment(order: Order) {
  shippingOrderId.value = order.id
  shipmentForm.shipping_company = order.shipping_company || '顺丰速运'
  shipmentForm.tracking_no = order.tracking_no || ''
  shipmentDialog.value = true
}

async function saveShipment() {
  try {
    await api.put(`/orders/${shippingOrderId.value}/shipment`, shipmentForm)
    ElMessage.success('发货信息已保存')
    shipmentDialog.value = false
    await loadPage('orders')
  } catch (error) { ElMessage.error(errorMessage(error)) }
}

onMounted(() => { if (loggedIn.value) loadPage('dashboard') })
</script>

<template>
  <div v-if="!loggedIn" class="login-page">
    <el-card class="login-card" shadow="always">
      <div class="login-brand"><div class="brand-mark">宠</div><div><h1>萌宠生活商城</h1><p>Element Plus 本地管理后台</p></div></div>
      <el-form label-position="top" @submit.prevent="login">
        <el-form-item label="管理员账号"><el-input v-model="loginForm.username" size="large" autocomplete="username" /></el-form-item>
        <el-form-item label="管理员密码"><el-input v-model="loginForm.password" type="password" size="large" show-password autocomplete="current-password" @keyup.enter="login" /></el-form-item>
        <el-button type="primary" size="large" style="width: 100%" :loading="loginLoading" @click="login">登录管理后台</el-button>
      </el-form>
      <div class="login-tip"><span class="status-dot" />FastAPI + MySQL 本地开发环境</div>
    </el-card>
  </div>

  <div v-else class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-brand"><div class="brand-mark">宠</div><span>萌宠商城管理端</span></div>
      <nav class="nav">
        <button v-for="item in [
          ['dashboard','数据概览',DataAnalysis], ['products','商品管理',Goods], ['activities','抽奖活动',Present],
          ['orders','订单管理',Box], ['audits','操作审计',Document]
        ]" :key="item[0] as string" class="nav-item" :class="{ active: activePage === item[0] }" @click="loadPage(item[0] as string)">
          <el-icon><component :is="item[2]" /></el-icon><span>{{ item[1] }}</span>
        </button>
      </nav>
    </aside>

    <main class="main">
      <header class="topbar"><h2>{{ pageTitle }}</h2><div class="topbar-right"><el-tag type="success" effect="plain">MySQL 8 · development</el-tag><span>admin</span><el-button text :icon="SwitchButton" @click="logout">退出</el-button></div></header>
      <section class="content" v-loading="loading">
        <template v-if="activePage === 'dashboard' && dashboard">
          <div class="metric-grid">
            <el-card class="metric-card"><div class="metric-label">商品总数</div><div class="metric-value">{{ dashboard.product_count }}</div><div class="metric-hint">在售 {{ dashboard.active_product_count }} 件</div></el-card>
            <el-card class="metric-card"><div class="metric-label">抽奖活动</div><div class="metric-value">{{ dashboard.activity_count }}</div><div class="metric-hint">报名中 {{ dashboard.registering_activity_count }} 场</div></el-card>
            <el-card class="metric-card"><div class="metric-label">订单数量</div><div class="metric-value">{{ dashboard.order_count }}</div><div class="metric-hint">已支付 {{ dashboard.paid_order_count }} 单</div></el-card>
            <el-card class="metric-card"><div class="metric-label">成交金额</div><div class="metric-value">¥{{ dashboard.paid_amount }}</div><div class="metric-hint">本地联调数据</div></el-card>
          </div>
          <el-card class="section-card"><div class="page-actions"><div><h3>最近订单</h3><p class="page-subtitle">管理接口实时读取 MySQL 数据</p></div><el-button @click="loadPage('orders')">查看全部</el-button></div>
            <el-table :data="dashboard.recent_orders"><el-table-column prop="order_no" label="订单号" min-width="220" /><el-table-column prop="product_name" label="商品" min-width="180" /><el-table-column prop="total_amount" label="金额" width="100" /><el-table-column label="状态" width="110"><template #default="scope"><el-tag :type="statusType(scope.row.status)">{{ statusText[scope.row.status] || scope.row.status }}</el-tag></template></el-table-column></el-table>
          </el-card>
        </template>

        <el-card v-if="activePage === 'products'" class="section-card">
          <div class="page-actions"><div><h3>商品列表</h3><p class="page-subtitle">创建、编辑与上下架均通过 FastAPI 写入 MySQL</p></div><el-button type="primary" :icon="Goods" @click="openProduct()">新增商品</el-button></div>
          <el-table :data="products" stripe><el-table-column prop="id" label="ID" width="70" /><el-table-column label="商品" min-width="220"><template #default="scope"><div class="table-name">{{ scope.row.name }}</div><div class="muted">{{ scope.row.subtitle }}</div></template></el-table-column><el-table-column prop="category" label="分类" width="90" /><el-table-column prop="price" label="售价" width="100" /><el-table-column prop="stock" label="库存" width="90" /><el-table-column label="状态" width="90"><template #default="scope"><el-tag :type="scope.row.is_active ? 'success' : 'info'">{{ scope.row.is_active ? '在售' : '下架' }}</el-tag></template></el-table-column><el-table-column label="操作" width="250" fixed="right"><template #default="scope"><el-button link type="primary" @click="openProduct(scope.row)">编辑</el-button><el-button link :type="scope.row.is_active ? 'warning' : 'success'" @click="toggleProduct(scope.row)">{{ scope.row.is_active ? '下架' : '上架' }}</el-button><el-button v-if="scope.row.is_active" link type="danger" @click="deleteProduct(scope.row)">删除</el-button></template></el-table-column></el-table>
        </el-card>

        <el-card v-if="activePage === 'activities'" class="section-card">
          <div class="page-actions"><div><h3>活动列表</h3><p class="page-subtitle">支持创建草稿、发布、查看报名名单及本地开奖</p></div><el-button type="primary" :icon="Present" @click="openActivity">新建活动</el-button></div>
          <el-table :data="activities" stripe><el-table-column prop="id" label="ID" width="70" /><el-table-column label="活动" min-width="230"><template #default="scope"><div class="table-name">{{ scope.row.title }}</div><div class="muted">{{ scope.row.subtitle }}</div></template></el-table-column><el-table-column label="状态" width="100"><template #default="scope"><el-tag :type="statusType(scope.row.status)">{{ statusText[scope.row.status] || scope.row.status }}</el-tag></template></el-table-column><el-table-column prop="participant_count" label="报名人数" width="100" /><el-table-column label="开奖时间" width="190"><template #default="scope">{{ formatTime(scope.row.draw_at) }}</template></el-table-column><el-table-column label="操作" width="270" fixed="right"><template #default="scope"><el-button link type="primary" @click="showParticipants(scope.row)">名单</el-button><el-button v-if="['DRAFT','PUBLISHED'].includes(scope.row.status)" link type="success" @click="publishActivity(scope.row)">发布</el-button><el-button v-if="scope.row.status !== 'DRAWN'" link type="warning" @click="drawActivity(scope.row)">开奖</el-button></template></el-table-column></el-table>
        </el-card>

        <el-card v-if="activePage === 'orders'" class="section-card">
          <div class="page-actions"><div><h3>订单列表</h3><p class="page-subtitle">已支付订单可录入快递公司与运单号</p></div><el-button :icon="Box" @click="loadPage('orders')">刷新</el-button></div>
          <el-table :data="orders" stripe><el-table-column prop="order_no" label="订单号" min-width="220" /><el-table-column prop="product_name" label="商品" min-width="170" /><el-table-column prop="address_name" label="收货人" width="100" /><el-table-column prop="total_amount" label="金额" width="90" /><el-table-column label="状态" width="100"><template #default="scope"><el-tag :type="statusType(scope.row.status)">{{ statusText[scope.row.status] || scope.row.status }}</el-tag></template></el-table-column><el-table-column label="创建时间" width="180"><template #default="scope">{{ formatTime(scope.row.created_at) }}</template></el-table-column><el-table-column label="操作" width="110" fixed="right"><template #default="scope"><el-button v-if="['PAID','SHIPPED'].includes(scope.row.status)" link type="primary" @click="openShipment(scope.row)">{{ scope.row.status === 'SHIPPED' ? '改运单' : '发货' }}</el-button></template></el-table-column></el-table>
        </el-card>

        <el-card v-if="activePage === 'audits'" class="section-card">
          <div class="page-actions"><div><h3>操作审计</h3><p class="page-subtitle">记录管理端关键写操作</p></div><el-button :icon="Document" @click="loadPage('audits')">刷新</el-button></div>
          <el-table :data="audits" stripe><el-table-column prop="id" label="ID" width="70" /><el-table-column prop="operator" label="操作人" width="100" /><el-table-column prop="action" label="动作" width="110" /><el-table-column prop="resource_type" label="资源" width="150" /><el-table-column prop="resource_id" label="资源ID" width="100" /><el-table-column prop="detail" label="详情" min-width="220" /><el-table-column label="时间" width="180"><template #default="scope">{{ formatTime(scope.row.created_at) }}</template></el-table-column></el-table>
        </el-card>
      </section>
    </main>
  </div>

  <el-dialog v-model="productDialog" :title="editingProductId ? '编辑商品' : '新增商品'" width="720px">
    <el-form label-position="top"><div class="form-grid">
      <el-form-item label="商品名称"><el-input v-model="productForm.name" /></el-form-item><el-form-item label="分类"><el-select v-model="productForm.category" style="width:100%"><el-option v-for="item in ['爬宠','用品','套餐']" :key="item" :label="item" :value="item" /></el-select></el-form-item>
      <el-form-item class="wide" label="副标题"><el-input v-model="productForm.subtitle" /></el-form-item><el-form-item label="售价"><el-input-number v-model="productForm.price" :min="0.01" :precision="2" style="width:100%" /></el-form-item><el-form-item label="原价"><el-input-number v-model="productForm.original_price" :min="0.01" :precision="2" style="width:100%" /></el-form-item><el-form-item label="库存"><el-input-number v-model="productForm.stock" :min="0" style="width:100%" /></el-form-item><el-form-item label="图片标识"><el-input v-model="productForm.image_key" /></el-form-item><el-form-item label="角标"><el-input v-model="productForm.badge" /></el-form-item><el-form-item label="标签（逗号分隔）"><el-input v-model="productForm.tagsText" /></el-form-item><el-form-item class="wide" label="说明"><el-input v-model="productForm.care_advice" type="textarea" /></el-form-item><el-form-item label="上架状态"><el-switch v-model="productForm.is_active" /></el-form-item>
    </div></el-form><template #footer><div class="dialog-footer"><el-button @click="productDialog=false">取消</el-button><el-button type="primary" @click="saveProduct">保存</el-button></div></template>
  </el-dialog>

  <el-dialog v-model="activityDialog" title="新建抽奖活动" width="620px"><el-form label-position="top"><el-form-item label="活动标题"><el-input v-model="activityForm.title" /></el-form-item><el-form-item label="活动副标题"><el-input v-model="activityForm.subtitle" /></el-form-item><div class="form-grid"><el-form-item label="报名开始"><el-date-picker v-model="activityForm.registration_start_at" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width:100%" /></el-form-item><el-form-item label="报名结束"><el-date-picker v-model="activityForm.registration_end_at" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width:100%" /></el-form-item><el-form-item class="wide" label="开奖时间"><el-date-picker v-model="activityForm.draw_at" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width:100%" /></el-form-item></div></el-form><template #footer><div class="dialog-footer"><el-button @click="activityDialog=false">取消</el-button><el-button type="primary" @click="createActivity">创建草稿</el-button></div></template></el-dialog>
  <el-dialog v-model="shipmentDialog" title="录入发货信息" width="480px"><el-form label-position="top"><el-form-item label="快递公司"><el-input v-model="shipmentForm.shipping_company" /></el-form-item><el-form-item label="运单号"><el-input v-model="shipmentForm.tracking_no" /></el-form-item></el-form><template #footer><div class="dialog-footer"><el-button @click="shipmentDialog=false">取消</el-button><el-button type="primary" @click="saveShipment">确认发货</el-button></div></template></el-dialog>
</template>
