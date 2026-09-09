'use strict';
const { createHash, randomUUID } = require('node:crypto');
function assertWithdrawalReviewer(withdrawal, session, finalReview = false) {
  if (!session?.userId || withdrawal.workerId === session.userId) throw new Error('提现申请人不能自审');
  if (finalReview && (!withdrawal.reviewedBy || withdrawal.reviewedBy === session.userId)) throw new Error('初审与复核必须由不同人员完成');
}
function assertPayoutReceipt(withdrawal, receipt, externalReference) {
  if (!receipt || !['private', 'PRIVATE'].includes(receipt.storageVisibility || receipt.visibility) || receipt.scanStatus !== 'CLEAN') throw new Error('出款必须登记已通过扫描的私有凭证');
  if (receipt.brandId !== withdrawal.brandId || !['PAYOUT_RECEIPT', 'payout_receipt'].includes(receipt.purpose || receipt.bizType)) throw new Error('出款凭证品牌或用途不符');
  if (!externalReference || !/^[\w\-:/]{6,128}$/.test(externalReference)) throw new Error('请填写有效的银行或渠道回单流水号');
}
function assertRefundBudget(payment, refunds, current) {
  if (!Number.isSafeInteger(current.amountFen) || current.amountFen <= 0) throw new Error('退款金额必须为正整数分');
  const used = refunds.filter((row) => row._id !== current._id && ['PENDING_APPROVAL', 'PROCESSING', 'SUCCESS'].includes(row.status)).reduce((sum, row) => sum + row.amountFen, 0);
  if (!Number.isSafeInteger(payment.amountFen) || used + current.amountFen > payment.amountFen) throw new Error('退款超过原支付可退余额（含在途退款）');
}
function assertRefundApproval(refund, session, env = process.env) {
  const limit = Number(env.REFUND_REVIEW_LIMIT_FEN || 100000);
  if (!Number.isSafeInteger(limit) || limit <= 0) throw new Error('退款审批限额配置无效');
  if (refund.amountFen > limit && ![session.role, ...(session.roles || [])].some((r) => ['FINANCE_REVIEWER', 'SUPER_ADMIN'].includes(r))) throw new Error('退款超出审批限额，请升级财务复核');
}
function access(session, brandId, system = false) {
  if (!session || ![session.role, ...(session.roles || [])].some((r) => ['ADMIN', 'SUPER_ADMIN', 'FINANCE_REVIEWER', ...(system ? ['SYSTEM'] : [])].includes(r))) throw new Error('无财务权限');
  if (!brandId) throw new Error('必须指定品牌');
  if (session.role !== 'SYSTEM' && !['ADMIN', 'SUPER_ADMIN'].includes(session.role) && !(session.brandScopes || []).some((b) => b === '*' || b === brandId)) throw new Error('无权访问品牌财务数据');
}
async function audit(repo, action, brandId, resourceId, session, after) {
  await repo.insert('audit_logs', { _id: randomUUID(), action, brandId, resourceType: 'finance', resourceId, operatorId: session.userId, operatorRole: session.role, requestId: session.requestId || '', after, createdAt: Date.now() });
}
const hash = (s) => createHash('sha256').update(s).digest('hex');
async function runFinancialReconciliation(repo, { brandId, date = new Date().toISOString().slice(0, 10), channelRows = [] }, session) {
  access(session, brandId, true);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(channelRows) || channelRows.length > 100000) throw new Error('对账日期或账单无效');
  const [orders, payments, refunds, withdrawals, ledger, wallets] = await Promise.all(['orders', 'payments', 'refunds', 'withdrawals', 'wallet_transactions', 'wallets'].map((name) => repo.find(name, name === 'wallets' ? {} : { brandId })));
  const findings = [];
  const add = (type, resourceId, expectedFen, actualFen) => findings.push({ type, resourceId, expectedFen, actualFen, differenceFen: actualFen - expectedFen });
  for (const p of payments) {
    if (p.status !== 'SUCCESS') continue;
    const order = orders.find((o) => o._id === p.orderId);
    if (!order || order.amountFen !== p.amountFen || !order.paidAt) add('PAYMENT_ORDER', p._id, order?.amountFen || 0, p.amountFen);
    const returned = refunds.filter((r) => r.paymentId === p._id && r.status === 'SUCCESS').reduce((s, r) => s + r.amountFen, 0);
    if (returned > p.amountFen) add('REFUND_OVERPAY', p._id, p.amountFen, returned);
    const channel = channelRows.find((r) => r.transactionId === p.providerTransactionId);
    if (channelRows.length && (!channel || channel.amountFen !== p.amountFen)) add('CHANNEL_PAYMENT', p._id, p.amountFen, channel?.amountFen || 0);
  }
  for (const channel of channelRows) {
    if (!Number.isSafeInteger(channel.amountFen) || channel.amountFen < 0) throw new Error('渠道金额必须为整数分');
    if (!payments.some((p) => p.providerTransactionId === channel.transactionId && p.status === 'SUCCESS')) add('CHANNEL_ORPHAN', hash(String(channel.transactionId)), 0, channel.amountFen);
  }
  for (const wd of withdrawals) {
    const paid = ledger.filter((l) => (l.withdrawalId || l.refId) === wd._id && l.type === 'WITHDRAWAL_PAID');
    if (wd.status === 'PAID' && (!wd.receiptAttachmentId || !wd.externalReference || paid.length !== 1)) add('PAYOUT_RECEIPT', wd._id, wd.amountFen, paid.length === 1 ? wd.amountFen : 0);
  }
  for (const wallet of wallets) {
    const rows = await repo.find('wallet_transactions', { walletId: wallet._id });
    if (!rows.some((l) => l.brandId === brandId)) continue;
    const available = rows.filter((l) => l.status !== 'REVERSED').reduce((s, l) => s + l.amountFen, 0);
    if (available !== wallet.availableFen) add('WALLET_LEDGER', wallet._id, available, wallet.availableFen);
  }
  for (const finding of findings) {
    const id = hash(`${brandId}:${date}:${finding.type}:${finding.resourceId}`);
    if (!(await repo.getById('reconciliation_cases', id))) await repo.insert('reconciliation_cases', { _id: id, brandId, date, ...finding, status: 'OPEN', severity: 'P0', history: [], createdAt: Date.now(), updatedAt: Date.now() });
  }
  const run = { _id: randomUUID(), brandId, date, caseCount: findings.length, channelStatementProvided: channelRows.length > 0, status: findings.length ? 'DIFFERENCES' : channelRows.length ? 'MATCHED' : 'INTERNAL_ONLY', checkedCounts: { orders: orders.length, payments: payments.length, refunds: refunds.length, withdrawals: withdrawals.length }, createdAt: Date.now() };
  await repo.insert('reconciliation_runs', run);
  await audit(repo, 'runFinancialReconciliation', brandId, run._id, session, { caseCount: run.caseCount, status: run.status });
  return run;
}
async function listReconciliationCases(repo, { brandId, status = '', page = 1, pageSize = 20 }, session) {
  access(session, brandId);
  const rows = (await repo.find('reconciliation_cases', { brandId })).filter((r) => !status || r.status === status).sort((a, b) => b.updatedAt - a.updatedAt);
  const size = Math.max(1, Math.min(100, Number(pageSize) || 20)); const p = Math.max(1, Number(page) || 1);
  return { items: rows.slice((p - 1) * size, p * size), total: rows.length, page: p, pageSize: size };
}
async function resolveReconciliationCase(repo, { caseId, reason, resolution }, session) {
  const row = await repo.getById('reconciliation_cases', caseId); if (!row) throw new Error('对账工单不存在'); access(session, row.brandId);
  if (row.status !== 'OPEN' || !reason?.trim() || !resolution?.trim()) throw new Error('请填写原因和处理记录，且工单须待处理');
  const result = await repo.updateById('reconciliation_cases', caseId, { status: 'RESOLVED', assignedTo: session.userId, resolvedBy: session.userId, reason, resolution, history: [...(row.history || []), { action: 'RESOLVED', by: session.userId, at: Date.now(), reason, resolution }], updatedAt: Date.now() });
  await audit(repo, 'resolveReconciliationCase', row.brandId, caseId, session, { status: 'RESOLVED' }); return result;
}
async function closeReconciliationCase(repo, { caseId, reviewNote }, session) {
  const row = await repo.getById('reconciliation_cases', caseId); if (!row) throw new Error('对账工单不存在'); access(session, row.brandId);
  if (row.resolvedBy === session.userId) throw new Error('工单关闭审核必须由不同人员完成');
  if (row.status !== 'RESOLVED' || !reviewNote?.trim()) throw new Error('工单必须已处理并填写复核意见');
  const result = await repo.updateById('reconciliation_cases', caseId, { status: 'CLOSED', reviewedBy: session.userId, reviewNote, history: [...(row.history || []), { action: 'CLOSED', by: session.userId, at: Date.now(), reviewNote }], updatedAt: Date.now() });
  await audit(repo, 'closeReconciliationCase', row.brandId, caseId, session, { status: 'CLOSED' }); return result;
}
async function exportFinancialReconciliation(repo, { brandId, purpose }, session) {
  access(session, brandId); if (!purpose?.trim()) throw new Error('导出用途不能为空');
  const rows = await repo.find('reconciliation_cases', { brandId }); const id = randomUUID();
  const watermark = `内部财务 · ${session.userId} · ${new Date().toISOString()} · ${id}`;
  const cell = (value) => '"' + String(value ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"';
  const csv = '\uFEFF' + [watermark, '日期,类型,资源,应有分,实有分,差额分,状态', ...rows.map((r) => [r.date, r.type, r.resourceId, r.expectedFen, r.actualFen, r.differenceFen, r.status].map(cell).join(','))].join('\r\n');
  await repo.insert('financial_exports', { _id: id, brandId, purpose, watermark, exportedBy: session.userId, rowCount: rows.length, sha256: hash(csv), createdAt: Date.now() });
  await audit(repo, 'exportFinancialReconciliation', brandId, id, session, { purpose, rowCount: rows.length });
  return { filename: `reconciliation-${brandId}-${id}.csv`, csv, watermark };
}
module.exports = { assertWithdrawalReviewer, assertPayoutReceipt, assertRefundBudget, assertRefundApproval, runFinancialReconciliation, listReconciliationCases, resolveReconciliationCase, closeReconciliationCase, exportFinancialReconciliation };
