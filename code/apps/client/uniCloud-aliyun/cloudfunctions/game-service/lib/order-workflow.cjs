'use strict';

// 保留旧数组契约，但显式分页读取，不能先取默认前100条再做品牌筛选。
async function readAll(repo, name, where = {}) {
  if (typeof repo.queryPage !== 'function') return repo.find(name, where);
  const items = [];
  let afterId = '';
  for (let page = 0; page < 100; page += 1) {
    const result = await repo.queryPage(name, { where, afterId, limit: 99 });
    items.push(...result.items);
    if (!result.hasMore) return items;
    const next = result.items[result.items.length - 1]?._id;
    if (!next || next === afterId) throw new Error('订单分页读取异常，请重试');
    afterId = next;
  }
  throw new Error('查询结果过多，请按品牌和订单状态缩小范围');
}

function workerOrder(order, dto, allowedActions) {
  const fields = ['brandId', 'game', 'region', 'serviceType', 'customerUid', 'customerNickname',
    'expectStartAt', 'requirementNote', 'guaranteedOutput', 'outputUnit', 'actualOutput',
    'workerId', 'earningsFen', 'verificationStatus', 'verificationNote', 'verificationRejectReason',
    'assignedAt', 'startedAt', 'submittedAt', 'updatedAt', 'version'];
  const snapshot = order.productSnapshot || {};
  const value = key => order[key] ?? snapshot[key];
  return { ...dto, ...Object.fromEntries(fields.filter(key => value(key) !== undefined).map(key => [key, value(key)])),
    productTitle: dto.product.title, allowedActions };
}

function logTransition(action, order, fromStatus) {
  console.info('[OrderWorkflow]', JSON.stringify({ action, orderId: order._id,
    fromStatus, toStatus: order.status, version: order.version || 0 }));
}

module.exports = { readAll, workerOrder, logTransition };
