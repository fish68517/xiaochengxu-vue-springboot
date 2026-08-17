<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, type UploadFile } from 'element-plus'
import { getBills, getDashboard, getFeeItems, getNotices, parseImport, commitImport } from './api'

type MenuKey = 'dashboard' | 'repairs' | 'maintenance' | 'renovation' | 'notices' | 'company' | 'billing' | 'accounts' | 'settings'

const active = ref<MenuKey>('dashboard')
const loading = ref(false)
const dashboard = ref<any>({})
const bills = ref<any[]>([])
const feeItems = ref<any[]>([])
const notices = ref<any[]>([])
const billStatus = ref('')
const importPreview = ref<any>(null)
const committing = ref(false)

const menu = [
  ['dashboard', '▦', '工作台'], ['repairs', '🛠', '报修管理'], ['maintenance', '▣', '维保档案'],
  ['renovation', '▤', '装修管理'], ['notices', '📣', '公告管理'], ['company', '▥', '企业介绍'],
  ['billing', '¥', '缴费服务管理'], ['accounts', '♙', '账号与权限'], ['settings', '⚙', '系统设置'],
] as const

const titles: Record<MenuKey, string> = {
  dashboard: '工作台 / 数据概览', repairs: '报修工单管理', maintenance: '维保档案管理', renovation: '装修登记管理',
  notices: '公告发布管理', company: '企业介绍管理', billing: '缴费服务管理', accounts: '账号与权限', settings: '系统设置',
}

const filteredBills = computed(() => billStatus.value ? bills.value.filter(item => item.status === billStatus.value) : bills.value)
const money = (value: string | number) => `¥ ${value}`
const statusText = (status: string) => ({ PENDING: '待缴', OVERDUE: '欠费', PAID: '已缴', CLOSED: '关闭' }[status] || status)
const statusType = (status: string) => ({ PENDING: 'warning', OVERDUE: 'danger', PAID: 'success', CLOSED: 'info' }[status] || 'info') as any

async function load() {
  loading.value = true
  try {
    const [summary, billData, fees, noticeData] = await Promise.all([getDashboard(), getBills(), getFeeItems(), getNotices()])
    dashboard.value = summary
    bills.value = billData
    feeItems.value = fees
    notices.value = noticeData
  } catch (error) {
    ElMessage.error('本地 API 连接失败，请确认后端已启动')
  } finally {
    loading.value = false
  }
}

async function handleFile(upload: UploadFile) {
  if (!upload.raw) return
  try {
    importPreview.value = await parseImport(upload.raw)
    ElMessage.success('解析完成，请检查预览结果')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.detail || '文件解析失败')
  }
}

async function handleCommit() {
  if (!importPreview.value) return
  committing.value = true
  try {
    const result: any = await commitImport(importPreview.value.batchId)
    ElMessage.success(`导入完成：生成 ${result.createdBills} 张账单`)
    importPreview.value = null
    await load()
  } finally {
    committing.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="shell" v-loading="loading">
    <aside class="sidebar">
      <div class="brand"><span class="brand-mark">E</span><div><strong>电梯云管家</strong><small>后期管理平台</small></div></div>
      <nav>
        <button v-for="item in menu" :key="item[0]" :class="{ active: active === item[0] }" @click="active = item[0]">
          <span class="nav-icon">{{ item[1] }}</span>{{ item[2] }}<b v-if="item[0] === 'billing'">核心</b>
        </button>
      </nav>
      <div class="environment"><i></i> Development · MySQL</div>
    </aside>

    <main>
      <header><div><h1>{{ titles[active] }}</h1><p>五山新苑 · Local-First 本地开发环境</p></div><div class="admin"><span>管</span><div>系统管理员<small>admin_01</small></div></div></header>

      <section v-if="active === 'dashboard'" class="page">
        <div class="stats">
          <article><span class="blue">🛠</span><div><small>待处理工单</small><strong>{{ dashboard.pendingRepairs || 0 }}</strong></div></article>
          <article><span class="orange">⚠</span><div><small>欠费户数</small><strong>{{ dashboard.arrearsHouseholds || 0 }}</strong></div></article>
          <article><span class="green">¥</span><div><small>累计实收</small><strong>{{ money(dashboard.paid || '0.00') }}</strong></div></article>
          <article><span class="purple">▣</span><div><small>维保档案</small><strong>{{ dashboard.maintenanceCount || 0 }}</strong></div></article>
        </div>
        <div class="grid-two">
          <div class="panel"><div class="panel-title"><h2>账单状态概览</h2><button @click="active='billing'">进入缴费管理</button></div><div class="chart-placeholder"><div class="ring"></div><div><p>当前应收</p><strong>{{ money(dashboard.receivable || '0.00') }}</strong><small>按户金额由账单明细决定</small></div></div></div>
          <div class="panel"><div class="panel-title"><h2>最新公告</h2><button @click="active='notices'">管理公告</button></div><ul class="notice-list"><li v-for="notice in notices.slice(0,4)" :key="notice.id"><span>{{ notice.category }}</span><div><b>{{ notice.title }}</b><small>{{ notice.publishedAt.slice(0,10) }}</small></div></li></ul></div>
        </div>
        <div class="panel"><div class="panel-title"><h2>最近账单</h2><button @click="load">刷新数据</button></div><el-table :data="bills.slice(0,5)"><el-table-column prop="billNo" label="账单号" width="185"/><el-table-column prop="houseDisplayName" label="房屋"/><el-table-column prop="title" label="账单名称"/><el-table-column prop="totalAmount" label="应缴金额"><template #default="scope"><b class="amount">¥{{ scope.row.totalAmount }}</b></template></el-table-column><el-table-column label="状态"><template #default="scope"><el-tag :type="statusType(scope.row.status)">{{ statusText(scope.row.status) }}</el-tag></template></el-table-column></el-table></div>
      </section>

      <section v-else-if="active === 'billing'" class="page">
        <div class="billing-summary"><div><small>待收金额</small><strong>{{ money(dashboard.receivable || '0.00') }}</strong></div><div><small>累计实收</small><strong>{{ money(dashboard.paid || '0.00') }}</strong></div><div><small>欠费户数</small><strong class="danger">{{ dashboard.arrearsHouseholds || 0 }}</strong></div><div><small>收费项目</small><strong>{{ feeItems.length }}</strong></div></div>
        <el-tabs type="border-card" class="billing-tabs">
          <el-tab-pane label="账单台账">
            <div class="toolbar"><el-select v-model="billStatus" placeholder="全部状态" clearable style="width: 150px"><el-option label="待缴" value="PENDING"/><el-option label="欠费" value="OVERDUE"/><el-option label="已缴" value="PAID"/></el-select><el-button type="primary" @click="load">查询</el-button><el-button>导出</el-button></div>
            <el-table :data="filteredBills" stripe><el-table-column prop="billNo" label="账单号" width="190"/><el-table-column prop="houseDisplayName" label="房屋" width="190"/><el-table-column prop="title" label="账单名称" min-width="210"/><el-table-column prop="billingPeriod" label="周期" width="100"/><el-table-column label="应缴金额" width="110"><template #default="scope"><b class="amount">¥{{ scope.row.totalAmount }}</b></template></el-table-column><el-table-column prop="dueDate" label="截止日期" width="120"/><el-table-column label="状态" width="90"><template #default="scope"><el-tag :type="statusType(scope.row.status)">{{ statusText(scope.row.status) }}</el-tag></template></el-table-column><el-table-column label="操作" width="150"><template #default><el-button link type="primary">查看</el-button><el-button link>催缴</el-button></template></el-table-column></el-table>
          </el-tab-pane>
          <el-tab-pane label="收费项目配置"><el-table :data="feeItems"><el-table-column prop="code" label="项目编码"/><el-table-column prop="name" label="项目名称"/><el-table-column prop="defaultAmount" label="默认金额（辅助）"><template #default="scope">¥{{ scope.row.defaultAmount }}</template></el-table-column><el-table-column prop="sortOrder" label="排序"/><el-table-column label="状态"><template #default="scope"><el-tag :type="scope.row.enabled ? 'success' : 'info'">{{ scope.row.enabled ? '启用' : '停用' }}</el-tag></template></el-table-column><el-table-column label="操作"><template #default><el-button link type="primary">编辑</el-button></template></el-table-column></el-table><p class="table-tip">默认金额仅用于录入辅助，最终金额以每户账单明细为准。</p></el-tab-pane>
          <el-tab-pane label="按户收费标准"><div class="empty-business"><div>🏠</div><h3>按户设置不同收费金额</h3><p>101室 ¥388.00 · 102室 ¥428.00 · 每户费用项目均可独立配置</p><el-button type="primary">新增按户标准</el-button></div></el-tab-pane>
          <el-tab-pane label="批量上传账单">
            <div class="import-layout"><el-upload drag :auto-upload="false" :show-file-list="false" accept=".csv,.xlsx" :on-change="handleFile"><div class="upload-icon">⇧</div><h3>选择 Excel / CSV 收费文件</h3><p>先解析校验，再确认写入 MySQL</p></el-upload>
            <div v-if="importPreview" class="preview"><div class="preview-head"><h3>导入预览</h3><p><span class="ok">通过 {{ importPreview.validCount }}</span><span class="bad">错误 {{ importPreview.invalidCount }}</span></p></div><el-table :data="importPreview.rows" max-height="360"><el-table-column prop="rowNo" label="行" width="60"/><el-table-column prop="roomNo" label="房号"/><el-table-column prop="feeItemName" label="费用项目"/><el-table-column prop="amountYuan" label="金额"/><el-table-column label="校验"><template #default="scope"><el-tag :type="scope.row.valid ? 'success' : 'danger'">{{ scope.row.valid ? '通过' : scope.row.errors.join('；') }}</el-tag></template></el-table-column></el-table><el-button type="primary" :loading="committing" :disabled="!importPreview.validCount" @click="handleCommit">仅导入校验通过的记录</el-button></div></div>
          </el-tab-pane>
          <el-tab-pane label="欠费预警 / 催缴"><div class="empty-business warning"><div>⚠</div><h3>{{ dashboard.arrearsHouseholds || 0 }} 户账单已逾期</h3><p>可单户或批量生成 Mock 通知，记录将进入 notification_outbox。</p><el-button type="danger">批量催缴</el-button></div></el-tab-pane>
          <el-tab-pane label="缴费记录 / 对账"><div class="empty-business"><div>✓</div><h3>本地 Mock 支付与正式支付共用对账模型</h3><p>支付成功以服务端 Payment + Bill 事务结果为准。</p></div></el-tab-pane>
          <el-tab-pane label="收据申请管理"><div class="empty-business"><div>▤</div><h3>收据申请处理</h3><p>业主缴费成功后可申请收据，管理员可标记已开具或已驳回。</p></div></el-tab-pane>
        </el-tabs>
      </section>

      <section v-else class="page">
        <div class="module-intro"><span>{{ menu.find(item => item[0] === active)?.[1] }}</span><div><h2>{{ titles[active] }}</h2><p>该模块已纳入 Local-First 统一数据与权限架构，当前页面展示本地 development 交互骨架。</p></div></div>
        <div class="panel"><div class="panel-title"><h2>功能范围</h2><el-tag type="success">本地可演示</el-tag></div><div class="feature-cards"><article v-for="name in ['列表查询与筛选','角色权限隔离','状态流转记录','Mock 消息通知']" :key="name"><b>{{ name }}</b><p>通过统一 FastAPI Service 与 MySQL 数据模型实现。</p></article></div></div>
      </section>
    </main>
  </div>
</template>
