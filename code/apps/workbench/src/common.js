import { sessionStore } from './session.js';
// common.js — 工作台共享工具：会话、角色守卫、金额/状态文案、轮询、声音提醒、导航
export function getSession() {
  return {
    token: sessionStore.get('token') || '',
    user: sessionStore.get('user') || {},
    accessProfile: sessionStore.get('accessProfile') || {},
  };
}

// 角色归一：CS/CUSTOMER_SERVICE/ADMIN 视作客服侧，WORKER 为接单侧
export function normalizeRole(role) {
  if (role === 'WORKER') return 'WORKER';
  if (['CS', 'CUSTOMER_SERVICE', 'ADMIN', 'SUPER_ADMIN', 'BRAND_ADMIN', 'DISPATCHER'].includes(role)) return 'CS';
  return role || '';
}

export function roleHome(role) {
  return normalizeRole(role) === 'WORKER' ? '/pages/worker/hall' : '/pages/cs/workbench';
}

// 角色守卫：未登录跳登录页，角色不符跳对应角色首页；返回是否放行
export function guard(roles) {
  const { token, user } = getSession();
  const role = normalizeRole(user.role);
  if (!token) {
    uni.reLaunch({ url: '/pages/login/index' });
    return false;
  }
  if (roles && roles.length && !roles.includes(role)) {
    uni.reLaunch({ url: roleHome(role) });
    return false;
  }
  return true;
}

export function fenToYuan(fen) {
  const n = Number(fen || 0);
  return (n / 100).toFixed(2);
}

// 订单主键：T0-03 后业务主键为 _id，兼容历史 id 字段
export function oid(order) {
  return (order && (order._id || order.id)) || '';
}

export const ORDER_STATUS_TEXT = {
  PENDING_PAYMENT: '待支付',
  PENDING_ACCEPT: '待受理',
  PENDING_GRAB: '待抢单',
  ASSIGN_PENDING: '待指派确认',
  IN_SERVICE: '服务中',
  PENDING_CONFIRM: '待验收',
  SETTLED: '已结单',
  DISPUTING: '异议中',
  CANCELLED: '已取消',
  REFUNDING: '退款中',
  REFUNDED: '已退款',
  CLOSED: '已关闭',
};

export function orderStatusText(status) {
  return ORDER_STATUS_TEXT[status] || status || '未知';
}

// 提现 3 态文案（V1.1 D-08：待审批/已打款·已结算/驳回）
export const WITHDRAWAL_STATUS_TEXT = {
  PENDING_REVIEW: '待审批',
  REVIEWING: '审核中',
  APPROVED: '已通过',
  PAYING: '出款中',
  PAY_FAILED: '出款失败',
  PAID: '已打款·已结算',
  REJECTED: '已驳回',
};

export function withdrawalStatusText(status) {
  return WITHDRAWAL_STATUS_TEXT[status] || status || '未知';
}

// 退款子阶段文案
export function refundStatusText(status) {
  return {
    PENDING_APPROVAL: '退款待审批',
    PROCESSING: '退款处理中',
    SUCCESS: '退款成功',
    FAILED: '退款失败',
  }[status] || status || '';
}

// 实名审核状态文案
export function realnameStatusText(status) {
  return { PENDING: '待审核', PENDING_REVIEW: '待审核', APPROVED: '已通过', REJECTED: '已驳回', UNSUBMITTED: '未提交' }[status] || status || '未提交';
}

// 统一敏感/不可逆操作确认；业务方法仍由各页面调用原 API，不改变服务端权限与审计。
export function confirmAction({ title = '确认操作', content, confirmText = '确认', danger = false } = {}) {
  return new Promise((resolve) => {
    uni.showModal({
      title,
      content: content || '提交后将立即生效，请确认信息无误。',
      confirmText,
      confirmColor: danger ? '#d92d20' : '#5b63f6',
      success: (result) => resolve(!!result.confirm),
      fail: () => resolve(false),
    });
  });
}

// 页面内导航与退出登录
export function go(url) {
  uni.navigateTo({ url });
}

export function logout() {
  sessionStore.remove('token');
  sessionStore.remove('user');
  sessionStore.remove('accessProfile');
  sessionStore.remove('mustChangePwd');
  sessionStore.remove('__workbench_active_brand__');
  uni.reLaunch({ url: '/pages/login/index' });
}

// 声音提醒：H5 用 Web Audio 短促提示音，失败回退震动
export function playBeep() {
  try {
    const Ctx = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || null;
    if (!Ctx) {
      uni.vibrateShort && uni.vibrateShort({});
      return;
    }
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.start();
    setTimeout(() => { try { osc.stop(); ctx.close(); } catch (e) { /* 忽略关闭异常 */ } }, 300);
  } catch (e) {
    try { uni.vibrateShort && uni.vibrateShort({}); } catch (e2) { /* 忽略 */ }
  }
}

// 启动轮询：返回 stop 函数，页面 onUnload 时调用清理
export function startPoll(fn, intervalMs = 10000) {
  let stopped = false;
  let timer = null;
  const loop = async () => {
    if (stopped) return;
    try { await fn(); } catch (e) { /* 单次轮询失败静默，下轮重试 */ }
    if (!stopped) timer = setTimeout(loop, intervalMs);
  };
  timer = setTimeout(loop, 0);
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}
