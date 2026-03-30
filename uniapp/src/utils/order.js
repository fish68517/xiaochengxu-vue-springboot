export const BACKEND_ORDER_STATUS = {
  pending: '待付款',
  paid: '已付款',
  done: '已完成',
  canceled: '已取消'
}

const LEGACY_ORDER_STATUS = {
  pending: '寰呬粯娆?',
  paid: '宸蹭粯娆?',
  done: '宸插畬鎴?',
  canceled: '宸插彇娑?'
}

const statusAliasMap = {
  [BACKEND_ORDER_STATUS.pending]: BACKEND_ORDER_STATUS.pending,
  [BACKEND_ORDER_STATUS.paid]: BACKEND_ORDER_STATUS.paid,
  [BACKEND_ORDER_STATUS.done]: BACKEND_ORDER_STATUS.done,
  [BACKEND_ORDER_STATUS.canceled]: BACKEND_ORDER_STATUS.canceled,
  [LEGACY_ORDER_STATUS.pending]: BACKEND_ORDER_STATUS.pending,
  [LEGACY_ORDER_STATUS.paid]: BACKEND_ORDER_STATUS.paid,
  [LEGACY_ORDER_STATUS.done]: BACKEND_ORDER_STATUS.done,
  [LEGACY_ORDER_STATUS.canceled]: BACKEND_ORDER_STATUS.canceled
}

export const normalizeOrderStatus = (status) => {
  return statusAliasMap[status] || status || '未知状态'
}

export const isPendingOrder = (status) => normalizeOrderStatus(status) === BACKEND_ORDER_STATUS.pending
export const isPaidOrder = (status) => normalizeOrderStatus(status) === BACKEND_ORDER_STATUS.paid
export const isDoneOrder = (status) => normalizeOrderStatus(status) === BACKEND_ORDER_STATUS.done
export const isCanceledOrder = (status) => normalizeOrderStatus(status) === BACKEND_ORDER_STATUS.canceled
