<template>
  <WorkbenchShell role="cs" active="orders" title="订单详情" subtitle="核对客户需求、履约凭证和完整操作记录">
    <template #actions><button class="back-button" @click="go('/pages/cs/orders')">‹ 返回订单列表</button></template>
    <view v-if="error" class="error-box"><view><text>订单加载失败</text><text>{{ error }}</text></view><button class="retry-btn" @click="load">重新加载</button></view>
    <template v-if="order">
      <view class="order-overview"><view class="overview-head"><view><view class="title-line"><text>{{ order.productTitle||snapshotTitle }}</text><text v-if="order.isVip" class="vip-tag">VIP 客户</text></view><text>{{ order.orderNo }}</text></view><view class="overview-state"><text class="order-status">{{ orderStatusText(order.status) }}</text><text class="order-amount">¥{{ fenToYuan(order.amountFen) }}</text></view></view>
        <view class="overview-grid"><view><text>服务项目</text><text>{{ gameText(order.game) }} · {{ order.region||'区服待确认' }} · {{ serviceTypeText(order.serviceType) }}</text></view><view><text>保障目标</text><text>{{ order.guaranteedOutput??'—' }}{{ order.outputUnit||'' }}</text></view><view><text>客户游戏信息</text><text>{{ order.customerUid||'UID 待确认' }} · {{ order.customerNickname||'昵称待确认' }}</text></view><view><text>客户联系方式</text><text>{{ maskPhone(order.contactPhone)||'未填写' }} · {{ maskWechat(order.contactWechat) }}</text></view><view><text>期望开始</text><text>{{ formatDateTime(order.expectStartAt) }}</text></view><view><text>接单人员</text><text>{{ order.workerName||order.workerId||'尚未指派' }}</text></view></view>
      </view>
      <view class="detail-grid"><view class="detail-main"><view class="card"><view class="section-head"><view><text class="section-title">状态时间线</text><text>订单流转和操作记录</text></view><text>{{ logs.length }} 条</text></view><view v-if="!logs.length" class="empty-line">暂无操作流水</view><view v-for="log in logs" :key="log.id||log._id||log.createdAt" class="timeline-row"><view class="timeline-mark"/><view><text>{{ log.action?orderActionText(log.action):`${orderStatusText(log.fromStatus)} → ${orderStatusText(log.toStatus)}` }}</text><text>{{ log.remark||'状态已更新' }}</text></view><text>{{ formatDateTime(log.createdAt) }}</text></view></view>
        <view class="card"><view class="section-head"><view><text class="section-title">指派历史</text><text>接单人员变更记录不会覆盖</text></view><text>{{ assignments.length }} 条</text></view><view v-if="!assignments.length" class="empty-line">暂无指派记录</view><view v-for="item in assignments" :key="item._id||item.createdAt" class="assignment-row"><view><text>{{ assignmentTypeText(item.type) }}</text><text>{{ item.previousWorkerId||'未指派' }} → {{ item.workerId||'未指派' }}</text></view><view><text>{{ item.reason||'无附加说明' }}</text><text>{{ formatDateTime(item.createdAt) }}</text></view></view></view>
        <view v-if="attachments.length" class="card"><view class="section-head"><view><text class="section-title">服务完成凭证</text><text>点击图片查看原图</text></view><text>{{ attachments.length }} 张</text></view><view class="attach-row"><image v-for="attachment in attachments" :key="attachment.url" class="attach-img" :src="attachment.url" mode="aspectFill" @click="preview(attachment.url)"/></view></view>
        <view v-if="order.dispute" class="card dispute-card"><view class="section-head"><view><text class="section-title">客户异议</text><text>请结合证据和沟通记录处理</text></view><text>{{ order.dispute.status||'处理中' }}</text></view><text class="dispute-content">{{ order.dispute.content||'客户未填写补充说明' }}</text><text class="dispute-result">当前结果：{{ order.dispute.result||'待裁决' }}</text></view>
      </view><view class="action-column">
      <view class="card action-card" v-if="order.status === 'PENDING_ACCEPT'"><view class="action-heading"><view>1</view><view><text class="section-title">确认订单录入</text><text>补齐服务信息后进入抢单池</text></view></view>
        <input v-model="enter.game" class="input" placeholder="游戏（必填）" />
        <input v-model="enter.region" class="input" placeholder="区服（必填）" />
        <input v-model="enter.serviceType" class="input" placeholder="服务类型（必填）" />
        <input v-model="enter.customerUid" class="input" placeholder="客户游戏 UID（必填）" />
        <input v-model="enter.customerNickname" class="input" placeholder="客户游戏昵称（必填）" />
        <input v-model="enter.expectStartAt" class="input" placeholder="期望开始时间（必填）" />
        <textarea v-model="enter.requirementNote" class="textarea" placeholder="陪玩要求备注（语音/性别等）" />
        <textarea v-model="enter.sessionNote" class="textarea" placeholder="会话关联备注" />
        <textarea v-model="enter.internalNote" class="textarea" placeholder="内部备注" />
        <button class="primary-btn" :disabled="busy" @click="doEnter">确认录入并进入订单池</button>
      </view>
      <view class="card action-card" v-if="order.status === 'PENDING_GRAB'"><view class="action-heading"><view>2</view><view><text class="section-title">指派服务人员</text><text>选择人员后立即生成指派记录</text></view></view>
        <picker mode="selector" :range="workerLabels" @change="onWorkerChange">
          <view class="picker-value">{{ selectedWorkerLabel || '选择接单人员' }}</view>
        </picker>
        <button class="primary-btn" :disabled="busy || !selectedWorkerId" @click="doAssign">确认指派</button><view class="danger-divider"><text>取消订单</text></view><textarea v-model="cancelReason" class="textarea" placeholder="取消原因（必填）"/><button class="danger-btn" :disabled="busy" @click="doCancel">发起取消申请</button>
      </view>
      <view class="card action-card" v-if="order.status === 'IN_SERVICE'"><view class="action-heading"><view>退</view><view><text class="section-title">服务中退款申请</text><text>提交后进入管理员资金审批</text></view></view>
        <textarea v-model="refundReason" class="textarea" placeholder="退款原因（必填）" />
        <button class="danger-btn" :disabled="busy" @click="doServiceRefund">发起退款申请</button>
      </view>
      <view class="card action-card" v-if="order.status === 'PENDING_CONFIRM'"><view class="action-heading"><view>3</view><view><text class="section-title">核对完成申请</text><text>实际 {{ order.actualOutput??'—' }} / 保底 {{ order.guaranteedOutput??'—' }}{{ order.outputUnit||'' }}</text></view></view>
        <textarea v-model="verificationNote" class="textarea" placeholder="核对说明 / 退回原因" />
        <view class="dual-actions"><button v-if="allowed('rejectCompletion')" class="danger-btn" :disabled="busy" @click="doRejectCompletion">退回重做</button><button v-if="allowed('verifyCompletion')" class="secondary-btn" :disabled="busy" @click="doVerify">核对通过</button></view>
        <checkbox-group @change="onConfirmedChange">
          <label class="checkbox-label"><checkbox value="confirmed" :checked="customerConfirmed" color="#5b63f6"/> 已与客户确认服务结果</label>
        </checkbox-group>
        <button v-if="allowed('closeOrder')" class="primary-btn" :disabled="busy" @click="doSettle">确认结单</button>
        <view class="danger-divider"><text>未达标处理</text></view>
        <textarea v-model="reworkNote" class="textarea" placeholder="补单协商备注" />
        <button class="secondary-btn" :disabled="busy" @click="doRework">补单</button>
        <textarea v-model="refundReason" class="textarea" placeholder="差额退款原因（必填）" />
        <button class="danger-btn" :disabled="busy" @click="doOutputRefund">差额退款</button>
      </view>
      <view class="card action-card" v-if="order.status === 'DISPUTING'"><view class="action-heading"><view>裁</view><view><text class="section-title">异议仲裁</text><text>退款结果仍需管理员资金审批</text></view></view>
        <picker mode="selector" :range="disputeOptions" range-key="label" @change="onDisputeChange">
          <view class="picker-value">{{ disputeLabel }}</view>
        </picker>
        <textarea v-model="disputeNote" class="textarea" placeholder="仲裁备注（必填）" />
        <button class="primary-btn" :disabled="busy" @click="doResolveDispute">提交仲裁</button>
      </view>
      <view v-if="!['PENDING_ACCEPT','PENDING_GRAB','IN_SERVICE','PENDING_CONFIRM','DISPUTING'].includes(order.status)" class="card completed-state"><view>✓</view><text>{{ orderStatusText(order.status) }}</text><text>该订单当前没有需要客服执行的操作，完整记录已保留。</text></view>
      </view></view>
    </template>
  </WorkbenchShell>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '../../api.js';
import { confirmAction, guard, go, oid, fenToYuan, orderStatusText } from '../../common.js';
import { assignmentTypeText, formatDateTime, gameText, maskPhone, maskWechat, orderActionText, serviceTypeText } from '../../utils/display.js';
import WorkbenchShell from '../../components/WorkbenchShell.vue';

const orderId = ref('');
const order = ref(null);
const logs = ref([]);
const attachments = ref([]);
const assignments = ref([]);
const workers = ref([]);
const error = ref('');
const busy = ref(false);

// 录入/取消/退款/补单/仲裁表单态
const enter = ref({ game: '', region: '', serviceType: '', customerUid: '', customerNickname: '', expectStartAt: '', requirementNote: '', sessionNote: '', internalNote: '' });
const cancelReason = ref('');
const refundReason = ref('');
const reworkNote = ref('');
const customerConfirmed = ref(false);
const verificationNote = ref('');
const selectedWorkerId = ref('');
const selectedWorkerLabel = ref('');
const disputeResult = ref('MAINTAIN');
const disputeNote = ref('');

const snapshotTitle = computed(() => {
  const s = (order.value && order.value.productSnapshot) || {};
  return s.title || s.name || '-';
});
const workerLabels = computed(() => workers.value.map((w) => `${w.nickname || '接单人员'}（${maskPhone(w.phone) || '号码已隐藏'}） · 进行中 ${w.activeCount != null ? w.activeCount : 0} 单`));

const disputeOptions = [
  { value: 'MAINTAIN', label: '维持结单' },
  { value: 'PARTIAL', label: '部分退款' },
  { value: 'FULL', label: '全额退款' },
];
const disputeLabel = computed(() => {
  const hit = disputeOptions.find((d) => d.value === disputeResult.value);
  return hit ? hit.label : '维持结单';
});

// 加载订单详情与操作流水、接单人员列表
async function load() {
  error.value = '';
  try {
    const o = await api.getOrder(orderId.value);
    order.value = (o && o.order) || o || null;
    logs.value = Array.isArray(o && o.logs) ? o.logs : [];
    attachments.value = Array.isArray(o && o.attachments) ? o.attachments : (Array.isArray(o && o.proofImages) ? o.proofImages : []);
    assignments.value = Array.isArray(o && o.assignments) ? o.assignments : [];
    if (order.value && (order.value.status === 'PENDING_GRAB' || order.value.status === 'PENDING_CONFIRM')) {
      workers.value = (await api.listWorkers()) || [];
    }
  } catch (e) {
    error.value = e.message || '加载失败';
  }
}

function toast(title, icon = 'none') { uni.showToast({ title, icon }); }
function allowed(action) { return Array.isArray(order.value && order.value.allowedActions) && order.value.allowedActions.includes(action); }

// K-05 确认录入：校验必填后进池
async function doEnter() {
  const f = enter.value;
  if (!f.game || !f.region || !f.serviceType || !f.customerUid || !f.customerNickname || !f.expectStartAt) {
    toast('请补齐必填字段');
    return;
  }
  busy.value = true;
  try {
    order.value = await api.enterOrder({ orderId: orderId.value, ...f });
    toast('已录入，订单进池', 'success');
    load();
  } catch (e) { toast(e.message || '录入失败'); } finally { busy.value = false; }
}

function onWorkerChange(e) {
  const w = workers.value[Number(e.detail.value)];
  selectedWorkerId.value = w ? (w._id || w.id) : '';
  selectedWorkerLabel.value = workerLabels.value[Number(e.detail.value)] || '';
}

// K-07 指派
async function doAssign() {
  if (!selectedWorkerId.value) { toast('请选择接单人员'); return; }
  if (!(await confirmAction({ title: '确认指派订单', content: `确认将订单指派给 ${selectedWorkerLabel.value}？操作将写入指派历史。`, confirmText: '确认指派' }))) return;
  busy.value = true;
  try {
    order.value = await api.assignOrder(orderId.value, selectedWorkerId.value);
    toast('已指派', 'success');
    load();
  } catch (e) { toast(e.message || '指派失败'); } finally { busy.value = false; }
}

// K-08 未开工取消申请
async function doCancel() {
  if (!cancelReason.value) { toast('请填写取消原因'); return; }
  if (!(await confirmAction({ title: '确认发起取消', content: '取消申请将进入后续处理，原因会写入订单记录。', confirmText: '确认取消', danger: true }))) return;
  busy.value = true;
  try {
    await api.requestCancellation(orderId.value, cancelReason.value);
    toast('取消申请已提交，待管理员审批', 'success');
    load();
  } catch (e) { toast(e.message || '提交失败'); } finally { busy.value = false; }
}

// K-09 服务中退款申请（差额）
async function doServiceRefund() {
  if (!refundReason.value) { toast('请填写退款原因'); return; }
  if (!(await confirmAction({ title: '确认发起退款', content: '退款申请提交后将进入管理员资金审批，并可能触发佣金追回应收。', confirmText: '确认申请', danger: true }))) return;
  busy.value = true;
  try {
    await api.requestRefund(orderId.value, 'partial_progress', undefined, refundReason.value);
    toast('退款申请已提交，待管理员审批', 'success');
    load();
  } catch (e) { toast(e.message || '提交失败'); } finally { busy.value = false; }
}

function onConfirmedChange(e) {
  customerConfirmed.value = (e.detail.value || []).includes('confirmed');
}

// K-10 结单：必须勾选已与客户确认
async function doSettle() {
  if (!customerConfirmed.value) { toast('请先勾选「已与客户确认」'); return; }
  if (!(await confirmAction({ title: '确认结单', content: '结单后将按规则结算佣金，操作会写入订单流水。', confirmText: '确认结单' }))) return;
  busy.value = true;
  try {
    order.value = await api.closeOrder(orderId.value);
    toast('已结单，佣金已入账', 'success');
    load();
  } catch (e) { toast(e.message || '结单失败'); } finally { busy.value = false; }
}

async function doVerify() {
  busy.value = true;
  try { await api.verifyCompletion(orderId.value, verificationNote.value); toast('核对已通过', 'success'); load(); }
  catch (e) { toast(e.message || '核对失败'); }
  finally { busy.value = false; }
}

async function doRejectCompletion() {
  if (!verificationNote.value.trim()) { toast('请填写退回原因'); return; }
  if (!(await confirmAction({ title: '确认退回重做', content: '订单将退回服务中，接单人员需根据说明重新提交完成凭证。', confirmText: '确认退回', danger: true }))) return;
  busy.value = true;
  try { await api.rejectCompletion(orderId.value, verificationNote.value); toast('已退回服务中', 'success'); load(); }
  catch (e) { toast(e.message || '退回失败'); }
  finally { busy.value = false; }
}

// K-11 补单
async function doRework() {
  if (!reworkNote.value) { toast('请填写补单备注'); return; }
  busy.value = true;
  try {
    order.value = await api.reworkOrder(orderId.value, reworkNote.value);
    toast('已补单，订单回服务中', 'success');
    load();
  } catch (e) { toast(e.message || '补单失败'); } finally { busy.value = false; }
}

// K-11 未达标差额退款：比例 = 1 - actual/guaranteed
async function doOutputRefund() {
  if (!refundReason.value) { toast('请填写退款原因'); return; }
  const actual = Number(order.value.actualOutput || 0);
  const guaranteed = Number(order.value.guaranteedOutput || 0);
  let ratio = 1;
  if (guaranteed > 0) ratio = Math.min(1, Math.max(0, 1 - actual / guaranteed));
  if (!(await confirmAction({ title: '确认差额退款', content: `将按未达标比例 ${(ratio * 100).toFixed(0)}% 发起退款申请，最终金额由服务端校验。`, confirmText: '确认申请', danger: true }))) return;
  busy.value = true;
  try {
    await api.requestRefund(orderId.value, 'partial_output', ratio, refundReason.value);
    toast('差额退款申请已提交', 'success');
    load();
  } catch (e) { toast(e.message || '提交失败'); } finally { busy.value = false; }
}

function onDisputeChange(e) {
  disputeResult.value = disputeOptions[Number(e.detail.value)].value;
}

// K-12 异议仲裁
async function doResolveDispute() {
  if (!disputeNote.value) { toast('请填写仲裁备注'); return; }
  const dispute = order.value && order.value.dispute;
  if (!dispute) { toast('无异议记录'); return; }
  if (!(await confirmAction({ title: '确认提交仲裁', content: `裁决结果：${disputeLabel.value}。提交后会写入异议与订单记录。`, confirmText: '确认提交', danger: disputeResult.value !== 'MAINTAIN' }))) return;
  busy.value = true;
  try {
    if (['OPEN', 'EVIDENCE_COLLECTION', 'PENDING'].includes(dispute.status)) await api.startDisputeReview(dispute.id || dispute._id);
    await api.resolveDispute(dispute.id || dispute._id, disputeResult.value, disputeNote.value);
    toast('仲裁已提交', 'success');
    load();
  } catch (e) { toast(e.message || '仲裁失败'); } finally { busy.value = false; }
}

function preview(url) {
  uni.previewImage({ urls: [url], current: url });
}

onLoad((query) => {
  if (!guard(['CS'])) return;
  orderId.value = query && query.orderId ? decodeURIComponent(query.orderId) : '';
  if (orderId.value) load();
});
</script>

<style lang="scss" scoped>
.back-button{width:auto;height:36px;margin:0;padding:0 13px;color:var(--es-primary);font-size:12px;line-height:36px;background:#fff;border:1px solid #c7d7fe;border-radius:9px}.error-box{margin-bottom:14px;padding:13px 15px;display:flex;align-items:center;justify-content:space-between;color:#b42318;background:#fef3f2;border:1px solid #fecdca;border-radius:10px}.error-box text{display:block;font-size:11px}.error-box text:first-child{font-size:13px;font-weight:700}.retry-btn{width:auto;height:32px;margin:0;padding:0 12px;color:#b42318;font-size:11px;line-height:32px;background:#fff;border:1px solid #fda29b;border-radius:8px}
.order-overview{padding:21px;background:#fff;border:1px solid var(--es-border-soft);border-radius:14px;box-shadow:var(--es-glow)}.overview-head,.title-line,.overview-state{display:flex;align-items:center}.overview-head{justify-content:space-between;gap:16px}.title-line{gap:9px}.title-line>text:first-child{font-size:18px;font-weight:750}.overview-head>view:first-child>text{display:block;margin-top:5px;color:var(--es-text-dim);font-size:11px}.vip-tag{padding:3px 7px;color:#b54708;font-size:10px!important;font-weight:650;background:#fffaeb;border-radius:999px}.overview-state{gap:13px}.order-status{padding:5px 9px;color:#4338ca;font-size:11px;font-weight:650;background:#eef0ff;border-radius:999px}.order-amount{font-size:22px;font-weight:750}.overview-grid{margin-top:18px;display:grid;grid-template-columns:1.5fr .7fr 1.2fr 1.2fr 1fr 1fr;gap:14px}.overview-grid text{display:block}.overview-grid text:first-child{color:var(--es-text-dim);font-size:10px}.overview-grid text:last-child{margin-top:5px;overflow:hidden;font-size:12px;font-weight:550;text-overflow:ellipsis;white-space:nowrap}
.detail-grid{margin-top:16px;display:grid;grid-template-columns:minmax(0,1.55fr) minmax(320px,.75fr);align-items:start;gap:16px}.detail-main,.action-column{display:flex;flex-direction:column;gap:14px}.card{padding:19px;background:#fff;border:1px solid var(--es-border-soft);border-radius:14px}.section-head{margin-bottom:13px;display:flex;justify-content:space-between;gap:12px}.section-head text{display:block}.section-title{font-size:14px;font-weight:700}.section-head>view>text:last-child{margin-top:4px;color:var(--es-text-dim);font-size:10px}.section-head>text{color:var(--es-text-dim);font-size:10px}.empty-line{padding:28px;text-align:center;color:var(--es-text-dim);font-size:11px;background:#f8fafc;border-radius:9px}.timeline-row{min-height:61px;position:relative;padding:11px 0 11px 22px;display:flex;align-items:flex-start;gap:10px;border-bottom:1px solid var(--es-border-soft)}.timeline-row:last-child{border-bottom:0}.timeline-mark{position:absolute;left:2px;top:16px;width:9px;height:9px;background:var(--es-primary);border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 3px #eef0ff}.timeline-row>view:nth-child(2){min-width:0;flex:1}.timeline-row text{display:block}.timeline-row>view:nth-child(2) text:first-child{font-size:12px;font-weight:650}.timeline-row>view:nth-child(2) text:last-child{margin-top:4px;color:var(--es-text-dim);font-size:10px}.timeline-row>text{color:var(--es-text-dim);font-size:10px}.assignment-row{padding:11px 0;display:flex;justify-content:space-between;gap:14px;border-bottom:1px solid var(--es-border-soft)}.assignment-row:last-child{border-bottom:0}.assignment-row text{display:block}.assignment-row>view:first-child text:first-child{font-size:12px;font-weight:650}.assignment-row>view:first-child text:last-child,.assignment-row>view:last-child text{margin-top:3px;color:var(--es-text-dim);font-size:10px}.assignment-row>view:last-child{text-align:right}.attach-row{display:grid;grid-template-columns:repeat(5,1fr);gap:9px}.attach-img{width:100%;height:90px;border-radius:9px}.dispute-card{border-color:#fedf89}.dispute-content,.dispute-result{display:block;font-size:12px;line-height:1.6}.dispute-result{margin-top:8px;color:#b54708;font-size:10px}
.action-card{position:sticky;top:0}.action-heading{margin-bottom:15px;display:flex;gap:10px}.action-heading>view:first-child{width:30px;height:30px;flex:none;display:flex;align-items:center;justify-content:center;color:#4338ca;font-size:11px;font-weight:750;background:#eef0ff;border-radius:9px}.action-heading>view:last-child text{display:block}.action-heading>view:last-child>text:last-child{margin-top:3px;color:var(--es-text-dim);font-size:10px}.input,.textarea,.picker-value{width:100%;margin-bottom:10px;color:var(--es-text);font-size:12px;background:#fff!important;border:1px solid var(--es-border)!important;border-radius:8px}.input{height:38px;padding:0 11px}.textarea{height:76px;padding:10px}.picker-value{height:40px;padding:0 11px;display:flex;align-items:center}.primary-btn,.secondary-btn,.danger-btn{width:100%;height:38px;margin:0 0 9px;padding:0;font-size:12px;line-height:38px;border-radius:8px}.primary-btn{color:#fff;font-weight:650;background:var(--es-primary)}.secondary-btn{color:var(--es-primary);background:#fff;border:1px solid #c7d7fe}.danger-btn{color:#b42318;background:#fff;border:1px solid #fda29b}.primary-btn[disabled],.secondary-btn[disabled],.danger-btn[disabled]{opacity:.5}.dual-actions{display:flex;gap:8px}.checkbox-label{margin:3px 0 11px;display:flex;align-items:center;color:#344054;font-size:11px}.danger-divider{margin:10px 0;padding-top:12px;border-top:1px solid var(--es-border-soft)}.danger-divider text{color:#b42318;font-size:11px;font-weight:650}.completed-state{min-height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--es-text-dim)}.completed-state>view{width:46px;height:46px;display:flex;align-items:center;justify-content:center;color:#027a48;font-size:18px;font-weight:800;background:#ecfdf3;border-radius:50%}.completed-state>text:nth-child(2){margin-top:12px;color:var(--es-text);font-size:14px;font-weight:700}.completed-state>text:last-child{margin-top:5px;text-align:center;font-size:10px}
@media(max-width:1050px){.overview-grid{grid-template-columns:repeat(3,1fr)}.detail-grid{grid-template-columns:1fr}.action-card{position:static}}@media(max-width:767px){.order-overview{padding:16px}.overview-head{align-items:flex-start;flex-direction:column}.overview-state{width:100%;justify-content:space-between}.overview-grid{grid-template-columns:1fr 1fr}.detail-grid{gap:12px}.card{padding:16px}.attach-row{grid-template-columns:repeat(3,1fr)}.action-column{order:-1}.back-button{height:32px;line-height:32px}.timeline-row{align-items:flex-start;flex-wrap:wrap}.timeline-row>text{width:100%;padding-left:0}.dual-actions{flex-direction:column;gap:0}}
</style>
