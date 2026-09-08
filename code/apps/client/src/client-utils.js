// 客户端通用工具:12 态状态文案/描述、金额(分→元)、时间格式化、状态时间线排序。

// 订单状态机 12 态中文文案(与后端 OrderStatus 对齐)。
export const ORDER_STATUS_TEXT = {
  PENDING_PAYMENT: '待支付',
  PENDING_ACCEPT: '待受理',
  PENDING_GRAB: '待抢单',
  ASSIGN_PENDING: '指派待确认',
  IN_SERVICE: '服务中',
  PENDING_CONFIRM: '待确认',
  SETTLED: '已结单',
  DISPUTING: '异议中',
  CANCELLED: '已取消',
  REFUNDING: '退款中',
  REFUNDED: '已退款',
  CLOSED: '已关闭',
};

// 12 态状态描述:面向客户的一句话说明。
export const ORDER_STATUS_DESC = {
  PENDING_PAYMENT: '订单已创建,请在 30 分钟内完成支付',
  PENDING_ACCEPT: '支付成功,等待客服受理',
  PENDING_GRAB: '已受理,等待接单人员接单',
  ASSIGN_PENDING: '等待指派接单人员确认',
  IN_SERVICE: '服务进行中',
  PENDING_CONFIRM: '服务完成,等待客服核对',
  SETTLED: '订单已结单',
  DISPUTING: '异议处理中',
  CANCELLED: '订单已取消',
  REFUNDING: '退款处理中',
  REFUNDED: '已退款',
  CLOSED: '支付超时,订单已关闭',
};

// 状态时间线顺序(12 态):用于进度条标记"已到达"。
export const ORDER_STATUS_FLOW = [
  'PENDING_PAYMENT',
  'PENDING_ACCEPT',
  'PENDING_GRAB',
  'ASSIGN_PENDING',
  'IN_SERVICE',
  'PENDING_CONFIRM',
  'SETTLED',
  'DISPUTING',
  'CANCELLED',
  'REFUNDING',
  'REFUNDED',
  'CLOSED',
];

export function statusText(status) {
  return ORDER_STATUS_TEXT[status] || status || '';
}

export function statusDesc(status) {
  return ORDER_STATUS_DESC[status] || '';
}

// 金额:分 → 元字符串(两位小数)。
export function fenToYuan(fen) {
  const n = Number(fen || 0);
  return (n / 100).toFixed(2);
}

export { formatDateTime, gameText, serviceTypeText, maskPhone } from './utils/display.js';

// 商品封面:兼容 image / images[] / coverImage 三种字段(T0-11 image/images 契约统一前兜底)。
export function coverOf(product, fallback = '/static/default-product.svg') {
  if (!product) return fallback;
  return product.coverImage || product.image || (Array.isArray(product.images) && product.images[0]) || fallback;
}
