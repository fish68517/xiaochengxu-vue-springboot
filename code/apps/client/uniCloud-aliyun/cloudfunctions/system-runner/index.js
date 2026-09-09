'use strict';
const { timingSafeEqual } = require('node:crypto');
const { signInternalRequest } = require('./lib/internal-auth.cjs');

const SCHEDULED_ACTIONS = new Set([
  'timeoutCloseUnpaidOrders',
  'timeoutMarkPool',
  'timeoutRejectAssignments',
]);

function secretEqual(actual, expected) {
  const a = Buffer.from(String(actual || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

// 此云函数仅供 uniCloud 定时触发器调用。定时触发器事件需注入 schedulerSecret，且该值只保存在控制台配置。
exports.main = async (event = {}) => {
  const schedulerSecret = process.env.SCHEDULER_SECRET;
  const internalSecret = process.env.INTERNAL_SECRET;
  if (!schedulerSecret || !internalSecret) throw new Error('系统任务密钥未配置(fail-closed)');
  if (!secretEqual(event.schedulerSecret, schedulerSecret)) throw new Error('非法系统任务调用');
  const action = event.action;
  if (!SCHEDULED_ACTIONS.has(action)) throw new Error(`系统任务 action 不允许: ${action || ''}`);
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
  const internalAuth = signInternalRequest({ action, payload, secret: internalSecret });
  const response = await uniCloud.callFunction({
    name: 'game-service',
    data: { action, payload, internalAuth },
  });
  return response.result;
};

module.exports.SCHEDULED_ACTIONS = SCHEDULED_ACTIONS;
