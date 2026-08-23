<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type UploadFile } from 'element-plus'
import {
  assignRepair, commitImport, confirmPayment, createBuilding, createFeeItem,
  createHouse, createMaintenance, createNotice, createUser, deleteMaintenance,
  deleteNotice, getBills, getBuildings, getDashboard, getFeeItems, getHouses,
  getMaintenance, getMe, getNotices, getOutbox, getPayments, getReceipts,
  getRenovations, getRepairs, getUsers, login as loginApi, parseImport,
  updateReceiptStatus, updateRenovationStatus, updateUser, uploadAsset,
} from './api'

type MenuKey = 'dashboard' | 'repairs' | 'maintenance' | 'renovation' | 'notices' | 'company' | 'billing' | 'accounts' | 'settings'

const active = ref<MenuKey>('dashboard')
const loading = ref(false)
const authenticated = ref(!!localStorage.getItem('admin_token'))
const currentUser = ref<any>(null)
const loginForm = reactive({username:'admin_01',password:'Admin@123456'})
const loginLoading = ref(false)
const dashboard = ref<any>({})
const bills = ref<any[]>([])
const feeItems = ref<any[]>([])
const notices = ref<any[]>([])
const repairs = ref<any[]>([])
const maintenance = ref<any[]>([])
const renovations = ref<any[]>([])
const payments = ref<any[]>([])
const receipts = ref<any[]>([])
const users = ref<any[]>([])
const buildings = ref<any[]>([])
const houses = ref<any[]>([])
const outbox = ref<any[]>([])
const billStatus = ref('')
const importPreview = ref<any>(null)
const committing = ref(false)
const selectedTechnician = reactive<Record<number,number|undefined>>({})

const noticeDialog = ref(false)
const noticeForm = reactive({title:'',category:'小区公告',content:'',pinned:false})
const maintenanceDialog = ref(false)
const maintenanceForm = reactive({buildingId:undefined as number|undefined,elevatorName:'1号电梯',maintenanceDate:'',title:'',pdfUrl:'',fileSize:0})
const feeDialog = ref(false)
const feeForm = reactive({code:'',name:'',description:'',defaultAmountFen:0,enabled:true,sortOrder:0})
const userDialog = ref(false)
const userForm = reactive({username:'',displayName:'',role:'OWNER',phone:'',buildingId:undefined as number|undefined,houseId:undefined as number|undefined,password:'',enabled:true})
const buildingDialog = ref(false)
const buildingForm = reactive({communityName:'',name:''})
const houseDialog = ref(false)
const houseForm = reactive({buildingId:undefined as number|undefined,roomNo:'',residentCode:'',ownerName:''})

const menu = [
  ['dashboard', '▦', '工作台'], ['repairs', '🛠', '报修管理'], ['maintenance', '▣', '维保档案'],
  ['renovation', '▤', '装修管理'], ['notices', '📣', '公告管理'], ['company', '▥', '消息队列'],
  ['billing', '¥', '缴费服务管理'], ['accounts', '♙', '账号与权限'], ['settings', '⚙', '楼栋与房屋'],
] as const
const titles: Record<MenuKey,string> = {
  dashboard:'工作台 / 数据概览',repairs:'报修工单管理',maintenance:'维保档案管理',renovation:'装修登记管理',
  notices:'公告发布管理',company:'数据库消息队列',billing:'缴费服务管理',accounts:'账号与权限',settings:'楼栋与房屋',
}
const filteredBills = computed(() => billStatus.value ? bills.value.filter(item => item.status === billStatus.value) : bills.value)
const technicians = computed(() => users.value.filter(item => item.role === 'TECHNICIAN' && item.enabled))
const money = (value:string|number) => `¥ ${value}`
const statusText = (status:string) => ({PENDING:'待处理',OVERDUE:'欠费',PAID:'已缴',SUCCESS:'成功',COMPLETED:'已完成',REPAIRING:'处理中',ISSUED:'已开具',REJECTED:'已驳回',DEPOSIT_UNPAID:'未交押金',DEPOSIT_PAID:'已交押金',COMMITMENT_SIGNED:'已签承诺书'} as any)[status] || status
const statusType = (status:string) => ({PENDING:'warning',OVERDUE:'danger',PAID:'success',SUCCESS:'success',COMPLETED:'success',REPAIRING:'primary',ISSUED:'success',REJECTED:'danger'} as any)[status] || 'info'

async function doLogin(){
  loginLoading.value=true
  try{
    const result=await loginApi(loginForm.username,loginForm.password)
    if(result.user.role!=='ADMIN')throw new Error('只有管理员账号可以登录后台')
    localStorage.setItem('admin_token',result.token)
    currentUser.value=result.user
    authenticated.value=true
    await load()
    ElMessage.success('登录成功')
  }catch(error:any){ElMessage.error(error?.response?.data?.detail||error?.message||'登录失败')}
  finally{loginLoading.value=false}
}

function logout(){localStorage.removeItem('admin_token');authenticated.value=false;currentUser.value=null}
function authExpired(){authenticated.value=false;currentUser.value=null}

async function load(){
  if(!authenticated.value)return
  loading.value=true
  try{
    const [me,summary,billData,fees,noticeData,repairData,maintenanceData,renovationData,paymentData,receiptData,userData,buildingData,houseData,outboxData]=await Promise.all([
      getMe(),getDashboard(),getBills(),getFeeItems(),getNotices(),getRepairs(),getMaintenance(),getRenovations(),getPayments(),getReceipts(),getUsers(),getBuildings(),getHouses(),getOutbox(),
    ])
    currentUser.value=me;dashboard.value=summary;bills.value=billData;feeItems.value=fees;notices.value=noticeData
    repairs.value=repairData;maintenance.value=maintenanceData;renovations.value=renovationData;payments.value=paymentData
    receipts.value=receiptData;users.value=userData;buildings.value=buildingData;houses.value=houseData;outbox.value=outboxData
  }catch(error:any){ElMessage.error(error?.response?.data?.detail||'API加载失败')}
  finally{loading.value=false}
}

async function handleFile(upload:UploadFile){if(!upload.raw)return;try{importPreview.value=await parseImport(upload.raw);ElMessage.success('解析完成，请检查预览结果')}catch(error:any){ElMessage.error(error?.response?.data?.detail||'文件解析失败')}}
async function handleCommit(){if(!importPreview.value)return;committing.value=true;try{const result:any=await commitImport(importPreview.value.batchId);ElMessage.success(`导入完成：生成 ${result.createdBills} 张账单`);importPreview.value=null;await load()}finally{committing.value=false}}
async function saveNotice(){await createNotice(noticeForm);noticeDialog.value=false;Object.assign(noticeForm,{title:'',category:'小区公告',content:'',pinned:false});await load();ElMessage.success('公告已写入MySQL')}
async function removeNotice(id:number){await ElMessageBox.confirm('确认删除该公告？','提示');await deleteNotice(id);await load()}
async function assign(item:any){const id=selectedTechnician[item.id];if(!id)return ElMessage.warning('请选择维修师傅');await assignRepair(item.id,id);await load();ElMessage.success('派单成功')}
async function maintenanceFile(upload:UploadFile){if(!upload.raw)return;const result=await uploadAsset(upload.raw,'maintenance');maintenanceForm.pdfUrl=result.url;maintenanceForm.fileSize=result.size;ElMessage.success('PDF上传成功')}
async function saveMaintenance(){await createMaintenance(maintenanceForm);maintenanceDialog.value=false;Object.assign(maintenanceForm,{buildingId:undefined,elevatorName:'1号电梯',maintenanceDate:'',title:'',pdfUrl:'',fileSize:0});await load();ElMessage.success('维保记录已写入MySQL')}
async function removeMaintenance(id:number){await ElMessageBox.confirm('确认删除该维保记录？','提示');await deleteMaintenance(id);await load()}
async function setRenovation(id:number,status:string){await updateRenovationStatus(id,status);await load();ElMessage.success('装修状态已更新')}
async function confirmPay(id:number){await ElMessageBox.confirm('确认该笔线下款项已经到账？','财务确认');await confirmPayment(id);await load();ElMessage.success('缴费和账单已在同一事务中更新')}
async function setReceipt(id:number,status:string){await updateReceiptStatus(id,status);await load();ElMessage.success('收据状态已更新')}
async function saveFee(){await createFeeItem(feeForm);feeDialog.value=false;Object.assign(feeForm,{code:'',name:'',description:'',defaultAmountFen:0,enabled:true,sortOrder:0});await load()}
async function saveUser(){await createUser(userForm);userDialog.value=false;Object.assign(userForm,{username:'',displayName:'',role:'OWNER',phone:'',buildingId:undefined,houseId:undefined,password:'',enabled:true});await load();ElMessage.success('数据库账号已创建')}
async function toggleUser(item:any){
  const enabled=!item.enabled
  await updateUser(item.id,{username:item.username,displayName:item.displayName,role:item.role,phone:item.phone||'',buildingId:item.house?.buildingId,houseId:item.house?.id,password:null,enabled})
  await load()
  ElMessage.success(enabled?'账号已启用':'账号已停用')
}
async function saveBuilding(){await createBuilding(buildingForm);buildingDialog.value=false;Object.assign(buildingForm,{communityName:'',name:''});await load()}
async function saveHouse(){await createHouse(houseForm);houseDialog.value=false;Object.assign(houseForm,{buildingId:undefined,roomNo:'',residentCode:'',ownerName:''});await load()}

onMounted(async()=>{window.addEventListener('admin-auth-expired',authExpired);if(authenticated.value){try{await load()}catch{logout()}}})
onBeforeUnmount(()=>window.removeEventListener('admin-auth-expired',authExpired))
</script>

<template>
  <div v-if="!authenticated" class="login-shell">
    <el-card class="login-card">
      <div class="login-brand"><span>E</span><h1>电梯云管家</h1><p>管理后台 · MySQL数据库账号登录</p></div>
      <el-form @submit.prevent="doLogin"><el-form-item><el-input v-model="loginForm.username" size="large" placeholder="管理员用户名"/></el-form-item><el-form-item><el-input v-model="loginForm.password" size="large" type="password" show-password placeholder="密码" @keyup.enter="doLogin"/></el-form-item><el-button type="primary" size="large" :loading="loginLoading" style="width:100%" @click="doLogin">登录管理后台</el-button></el-form>
      <p class="login-tip">本机账号：admin_01 / Admin@123456</p>
    </el-card>
  </div>

  <div v-else class="shell" v-loading="loading">
    <aside class="sidebar"><div class="brand"><span class="brand-mark">E</span><div><strong>电梯云管家</strong><small>后期管理平台</small></div></div><nav><button v-for="item in menu" :key="item[0]" :class="{active:active===item[0]}" @click="active=item[0]"><span class="nav-icon">{{ item[1] }}</span>{{ item[2] }}<b v-if="item[0]==='billing'">核心</b></button></nav><div class="environment"><i></i> FastAPI · MySQL</div></aside>
    <main><header><div><h1>{{ titles[active] }}</h1><p>所有页面数据均通过 FastAPI 读写 MySQL</p></div><div class="admin"><span>管</span><div>{{ currentUser?.displayName }}<small>{{ currentUser?.username }}</small></div><el-button link type="danger" @click="logout">退出</el-button></div></header>

      <section v-if="active==='dashboard'" class="page">
        <div class="stats"><article><span class="blue">🛠</span><div><small>待处理工单</small><strong>{{ dashboard.pendingRepairs||0 }}</strong></div></article><article><span class="orange">⚠</span><div><small>欠费户数</small><strong>{{ dashboard.arrearsHouseholds||0 }}</strong></div></article><article><span class="green">¥</span><div><small>累计实收</small><strong>{{ money(dashboard.paid||'0.00') }}</strong></div></article><article><span class="purple">▣</span><div><small>维保档案</small><strong>{{ dashboard.maintenanceCount||0 }}</strong></div></article></div>
        <div class="grid-two"><div class="panel"><div class="panel-title"><h2>应收概览</h2><button @click="active='billing'">进入缴费管理</button></div><div class="chart-placeholder"><div class="ring"></div><div><p>当前应收</p><strong>{{ money(dashboard.receivable||'0.00') }}</strong><small>实时汇总 MySQL 账单</small></div></div></div><div class="panel"><div class="panel-title"><h2>最新公告</h2><button @click="active='notices'">管理公告</button></div><ul class="notice-list"><li v-for="item in notices.slice(0,5)" :key="item.id"><span>{{ item.category }}</span><div><b>{{ item.title }}</b><small>{{ item.publishedAt.slice(0,10) }}</small></div></li></ul></div></div>
        <div class="panel"><div class="panel-title"><h2>最近账单</h2><button @click="load">刷新数据库</button></div><el-table :data="bills.slice(0,6)"><el-table-column prop="billNo" label="账单号" width="190"/><el-table-column prop="houseDisplayName" label="房屋"/><el-table-column prop="title" label="账单名称"/><el-table-column prop="totalAmount" label="金额"><template #default="scope"><b class="amount">¥{{ scope.row.totalAmount }}</b></template></el-table-column><el-table-column label="状态"><template #default="scope"><el-tag :type="statusType(scope.row.status)">{{ statusText(scope.row.status) }}</el-tag></template></el-table-column></el-table></div>
      </section>

      <section v-else-if="active==='billing'" class="page"><div class="billing-summary"><div><small>待收金额</small><strong>{{ money(dashboard.receivable||'0.00') }}</strong></div><div><small>累计实收</small><strong>{{ money(dashboard.paid||'0.00') }}</strong></div><div><small>欠费户数</small><strong class="danger">{{ dashboard.arrearsHouseholds||0 }}</strong></div><div><small>收费项目</small><strong>{{ feeItems.length }}</strong></div></div>
        <el-tabs type="border-card" class="billing-tabs"><el-tab-pane label="账单台账"><div class="toolbar"><el-select v-model="billStatus" placeholder="全部状态" clearable style="width:150px"><el-option label="待缴" value="PENDING"/><el-option label="欠费" value="OVERDUE"/><el-option label="已缴" value="PAID"/></el-select><el-button type="primary" @click="load">查询</el-button></div><el-table :data="filteredBills" stripe><el-table-column prop="billNo" label="账单号" width="190"/><el-table-column prop="houseDisplayName" label="房屋"/><el-table-column prop="title" label="账单名称"/><el-table-column prop="billingPeriod" label="周期" width="100"/><el-table-column prop="totalAmount" label="金额" width="100"/><el-table-column label="状态" width="100"><template #default="scope"><el-tag :type="statusType(scope.row.status)">{{ statusText(scope.row.status) }}</el-tag></template></el-table-column></el-table></el-tab-pane>
          <el-tab-pane label="收费项目"><div class="toolbar"><el-button type="primary" @click="feeDialog=true">新增收费项目</el-button></div><el-table :data="feeItems"><el-table-column prop="code" label="编码"/><el-table-column prop="name" label="名称"/><el-table-column prop="defaultAmount" label="默认金额"/><el-table-column prop="sortOrder" label="排序"/><el-table-column label="状态"><template #default="scope"><el-tag :type="scope.row.enabled?'success':'info'">{{ scope.row.enabled?'启用':'停用' }}</el-tag></template></el-table-column></el-table></el-tab-pane>
          <el-tab-pane label="批量上传账单"><div class="import-layout"><el-upload drag :auto-upload="false" :show-file-list="false" accept=".csv,.xlsx" :on-change="handleFile"><div class="upload-icon">⇧</div><h3>选择 Excel / CSV 收费文件</h3><p>先校验，再确认写入MySQL</p></el-upload><div v-if="importPreview" class="preview"><div class="preview-head"><h3>导入预览</h3><p><span class="ok">通过 {{ importPreview.validCount }}</span><span class="bad">错误 {{ importPreview.invalidCount }}</span></p></div><el-table :data="importPreview.rows" max-height="360"><el-table-column prop="rowNo" label="行" width="60"/><el-table-column prop="roomNo" label="房号"/><el-table-column prop="feeItemName" label="费用项目"/><el-table-column prop="amountYuan" label="金额"/><el-table-column label="校验"><template #default="scope"><el-tag :type="scope.row.valid?'success':'danger'">{{ scope.row.valid?'通过':scope.row.errors.join('；') }}</el-tag></template></el-table-column></el-table><el-button type="primary" :loading="committing" :disabled="!importPreview.validCount" @click="handleCommit">确认写入MySQL</el-button></div></div></el-tab-pane>
          <el-tab-pane label="付款确认"><el-table :data="payments"><el-table-column prop="paymentNo" label="缴费单号" width="210"/><el-table-column prop="billNo" label="账单号"/><el-table-column prop="amount" label="金额"/><el-table-column prop="provider" label="渠道"/><el-table-column label="状态"><template #default="scope"><el-tag :type="statusType(scope.row.status)">{{ statusText(scope.row.status) }}</el-tag></template></el-table-column><el-table-column label="操作"><template #default="scope"><el-button v-if="scope.row.status==='PENDING'" type="success" link @click="confirmPay(scope.row.id)">确认到账</el-button></template></el-table-column></el-table></el-tab-pane>
          <el-tab-pane label="收据申请"><el-table :data="receipts"><el-table-column prop="applicationNo" label="申请号"/><el-table-column prop="applicantName" label="申请人"/><el-table-column prop="title" label="抬头"/><el-table-column label="状态"><template #default="scope"><el-tag :type="statusType(scope.row.status)">{{ statusText(scope.row.status) }}</el-tag></template></el-table-column><el-table-column label="操作"><template #default="scope"><el-button link type="success" @click="setReceipt(scope.row.id,'ISSUED')">开具</el-button><el-button link type="danger" @click="setReceipt(scope.row.id,'REJECTED')">驳回</el-button></template></el-table-column></el-table></el-tab-pane></el-tabs>
      </section>

      <section v-else-if="active==='repairs'" class="page"><div class="panel"><div class="panel-title"><h2>报修工单</h2><button @click="load">刷新</button></div><el-table :data="repairs"><el-table-column prop="orderNo" label="工单号" width="190"/><el-table-column prop="house" label="房屋"/><el-table-column prop="description" label="故障描述"/><el-table-column prop="technicianName" label="维修师傅"/><el-table-column label="状态"><template #default="scope"><el-tag :type="statusType(scope.row.status)">{{ statusText(scope.row.status) }}</el-tag></template></el-table-column><el-table-column label="派单" width="260"><template #default="scope"><el-select v-model="selectedTechnician[scope.row.id]" placeholder="选择师傅" style="width:140px"><el-option v-for="item in technicians" :key="item.id" :label="item.displayName" :value="item.id"/></el-select><el-button type="primary" link @click="assign(scope.row)">确认</el-button></template></el-table-column></el-table></div></section>

      <section v-else-if="active==='maintenance'" class="page"><div class="panel"><div class="panel-title"><h2>维保档案</h2><el-button type="primary" @click="maintenanceDialog=true">新增维保记录</el-button></div><el-table :data="maintenance"><el-table-column prop="title" label="标题"/><el-table-column prop="elevatorName" label="电梯"/><el-table-column prop="maintenanceDate" label="维保日期"/><el-table-column prop="uploaderName" label="上传人"/><el-table-column prop="pdfUrl" label="PDF地址"/><el-table-column label="操作"><template #default="scope"><el-button link type="danger" @click="removeMaintenance(scope.row.id)">删除</el-button></template></el-table-column></el-table></div></section>

      <section v-else-if="active==='renovation'" class="page"><div class="panel"><div class="panel-title"><h2>装修登记</h2><button @click="load">刷新</button></div><el-table :data="renovations"><el-table-column prop="applicantName" label="申请人"/><el-table-column prop="phone" label="电话"/><el-table-column prop="plan" label="装修方案"/><el-table-column label="状态"><template #default="scope"><el-tag>{{ statusText(scope.row.status) }}</el-tag></template></el-table-column><el-table-column label="办理"><template #default="scope"><el-select :model-value="scope.row.status" style="width:150px" @change="setRenovation(scope.row.id,$event)"><el-option label="未交押金" value="DEPOSIT_UNPAID"/><el-option label="已交押金" value="DEPOSIT_PAID"/><el-option label="已签承诺书" value="COMMITMENT_SIGNED"/><el-option label="已办结" value="COMPLETED"/><el-option label="已驳回" value="REJECTED"/></el-select></template></el-table-column></el-table></div></section>

      <section v-else-if="active==='notices'" class="page"><div class="panel"><div class="panel-title"><h2>公告列表</h2><el-button type="primary" @click="noticeDialog=true">发布公告</el-button></div><el-table :data="notices"><el-table-column prop="category" label="分类"/><el-table-column prop="title" label="标题"/><el-table-column prop="content" label="内容"/><el-table-column prop="publishedAt" label="发布时间"/><el-table-column label="置顶"><template #default="scope">{{ scope.row.pinned?'是':'否' }}</template></el-table-column><el-table-column label="操作"><template #default="scope"><el-button link type="danger" @click="removeNotice(scope.row.id)">删除</el-button></template></el-table-column></el-table></div></section>

      <section v-else-if="active==='company'" class="page"><div class="panel"><div class="panel-title"><h2>数据库通知 Outbox</h2><button @click="load">刷新</button></div><el-table :data="outbox"><el-table-column prop="eventType" label="事件"/><el-table-column prop="recipient" label="接收方"/><el-table-column prop="status" label="状态"/><el-table-column prop="createdAt" label="创建时间"/></el-table></div></section>

      <section v-else-if="active==='accounts'" class="page"><div class="panel"><div class="panel-title"><h2>数据库账号</h2><el-button type="primary" @click="userDialog=true">新增账号</el-button></div><el-table :data="users"><el-table-column prop="username" label="用户名"/><el-table-column prop="displayName" label="姓名"/><el-table-column prop="role" label="角色"/><el-table-column prop="phone" label="电话"/><el-table-column label="绑定房屋"><template #default="scope">{{ scope.row.house?.displayName||'-' }}</template></el-table-column><el-table-column label="状态"><template #default="scope"><el-tag :type="scope.row.enabled?'success':'warning'">{{ scope.row.enabled?'已启用':'待审核/停用' }}</el-tag></template></el-table-column><el-table-column label="操作" width="120"><template #default="scope"><el-button link :type="scope.row.enabled?'danger':'primary'" :disabled="scope.row.username===currentUser?.username" @click="toggleUser(scope.row)">{{ scope.row.enabled?'停用':'审核启用' }}</el-button></template></el-table-column></el-table></div></section>

      <section v-else class="page"><div class="grid-two"><div class="panel"><div class="panel-title"><h2>楼栋</h2><el-button type="primary" @click="buildingDialog=true">新增楼栋</el-button></div><el-table :data="buildings"><el-table-column prop="communityName" label="小区"/><el-table-column prop="name" label="楼栋"/></el-table></div><div class="panel"><div class="panel-title"><h2>房屋</h2><el-button type="primary" @click="houseDialog=true">新增房屋</el-button></div><el-table :data="houses"><el-table-column prop="buildingName" label="楼栋"/><el-table-column prop="roomNo" label="房号"/><el-table-column prop="residentCode" label="住户编码"/><el-table-column prop="ownerName" label="业主"/></el-table></div></div></section>
    </main>
  </div>

  <el-dialog v-model="noticeDialog" title="发布公告" width="560px"><el-form label-width="80px"><el-form-item label="标题"><el-input v-model="noticeForm.title"/></el-form-item><el-form-item label="分类"><el-select v-model="noticeForm.category"><el-option v-for="item in ['电梯通知','缴费通知','维保通知','小区公告']" :key="item" :label="item" :value="item"/></el-select></el-form-item><el-form-item label="内容"><el-input v-model="noticeForm.content" type="textarea" :rows="5"/></el-form-item><el-form-item label="置顶"><el-switch v-model="noticeForm.pinned"/></el-form-item></el-form><template #footer><el-button @click="noticeDialog=false">取消</el-button><el-button type="primary" @click="saveNotice">发布并写入MySQL</el-button></template></el-dialog>
  <el-dialog v-model="maintenanceDialog" title="新增维保记录" width="600px"><el-form label-width="90px"><el-form-item label="楼栋"><el-select v-model="maintenanceForm.buildingId"><el-option v-for="item in buildings" :key="item.id" :label="item.communityName+item.name" :value="item.id"/></el-select></el-form-item><el-form-item label="电梯"><el-input v-model="maintenanceForm.elevatorName"/></el-form-item><el-form-item label="日期"><el-date-picker v-model="maintenanceForm.maintenanceDate" value-format="YYYY-MM-DD"/></el-form-item><el-form-item label="标题"><el-input v-model="maintenanceForm.title"/></el-form-item><el-form-item label="PDF"><el-upload :auto-upload="false" :show-file-list="true" accept=".pdf" :on-change="maintenanceFile"><el-button>选择并上传PDF</el-button></el-upload><span class="form-tip">{{ maintenanceForm.pdfUrl }}</span></el-form-item></el-form><template #footer><el-button @click="maintenanceDialog=false">取消</el-button><el-button type="primary" @click="saveMaintenance">保存</el-button></template></el-dialog>
  <el-dialog v-model="feeDialog" title="新增收费项目" width="520px"><el-form label-width="100px"><el-form-item label="编码"><el-input v-model="feeForm.code"/></el-form-item><el-form-item label="名称"><el-input v-model="feeForm.name"/></el-form-item><el-form-item label="说明"><el-input v-model="feeForm.description"/></el-form-item><el-form-item label="默认金额(分)"><el-input-number v-model="feeForm.defaultAmountFen" :min="0"/></el-form-item><el-form-item label="排序"><el-input-number v-model="feeForm.sortOrder"/></el-form-item></el-form><template #footer><el-button @click="feeDialog=false">取消</el-button><el-button type="primary" @click="saveFee">保存</el-button></template></el-dialog>
  <el-dialog v-model="userDialog" title="新增数据库账号" width="600px"><el-form label-width="90px"><el-form-item label="用户名"><el-input v-model="userForm.username"/></el-form-item><el-form-item label="姓名"><el-input v-model="userForm.displayName"/></el-form-item><el-form-item label="角色"><el-select v-model="userForm.role"><el-option label="业主" value="OWNER"/><el-option label="维修师傅" value="TECHNICIAN"/><el-option label="管理员" value="ADMIN"/></el-select></el-form-item><el-form-item label="电话"><el-input v-model="userForm.phone"/></el-form-item><el-form-item label="楼栋"><el-select v-model="userForm.buildingId" clearable><el-option v-for="item in buildings" :key="item.id" :label="item.communityName+item.name" :value="item.id"/></el-select></el-form-item><el-form-item label="房屋"><el-select v-model="userForm.houseId" clearable><el-option v-for="item in houses" :key="item.id" :label="item.buildingName+' '+item.roomNo" :value="item.id"/></el-select></el-form-item><el-form-item label="登录密码"><el-input v-model="userForm.password" type="password" show-password/></el-form-item></el-form><template #footer><el-button @click="userDialog=false">取消</el-button><el-button type="primary" @click="saveUser">创建账号</el-button></template></el-dialog>
  <el-dialog v-model="buildingDialog" title="新增楼栋" width="460px"><el-form label-width="80px"><el-form-item label="小区"><el-input v-model="buildingForm.communityName"/></el-form-item><el-form-item label="楼栋"><el-input v-model="buildingForm.name"/></el-form-item></el-form><template #footer><el-button @click="buildingDialog=false">取消</el-button><el-button type="primary" @click="saveBuilding">保存</el-button></template></el-dialog>
  <el-dialog v-model="houseDialog" title="新增房屋" width="520px"><el-form label-width="90px"><el-form-item label="楼栋"><el-select v-model="houseForm.buildingId"><el-option v-for="item in buildings" :key="item.id" :label="item.communityName+item.name" :value="item.id"/></el-select></el-form-item><el-form-item label="房号"><el-input v-model="houseForm.roomNo"/></el-form-item><el-form-item label="住户编码"><el-input v-model="houseForm.residentCode"/></el-form-item><el-form-item label="业主姓名"><el-input v-model="houseForm.ownerName"/></el-form-item></el-form><template #footer><el-button @click="houseDialog=false">取消</el-button><el-button type="primary" @click="saveHouse">保存</el-button></template></el-dialog>
</template>

<style scoped>
.login-shell{min-height:100vh;display:grid;place-items:center;background:linear-gradient(145deg,#eaf2ff,#f6f9ff)}
.login-card{width:420px;padding:18px}.login-brand{text-align:center;margin-bottom:28px}.login-brand span{display:grid;place-items:center;width:68px;height:68px;margin:auto;border-radius:20px;background:#1768ed;color:#fff;font-size:36px;font-weight:900}.login-brand h1{margin:16px 0 6px}.login-brand p,.login-tip{color:#8994a7;font-size:13px}.login-tip{text-align:center;margin-top:20px}.form-tip{font-size:12px;color:#8290a6;margin-left:10px;max-width:300px;overflow:hidden;text-overflow:ellipsis}
</style>
