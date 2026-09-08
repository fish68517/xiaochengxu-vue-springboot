// 第二阶段模型迁移：离线升级订单快照、支付单、账本、提现与异议状态。
// 默认只输出报告；仅 --write --output <新文件> 写入新快照，且禁止覆盖原备份。
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const WITHDRAWAL_STATUS = { PENDING_REVIEW: 'SUBMITTED', PROCESSING: 'PAYING' };
const DISPUTE_STATUS = { PENDING: 'OPEN', 处理中: 'UNDER_REVIEW', RESOLVED: 'DECIDED' };

export function migratePhase2Models(snapshot) {
  const data = structuredClone(snapshot || {});
  const report = { updated: {}, created: {}, orphans: [] };
  const rows = (name) => Array.isArray(data[name]) ? data[name] : (data[name] = []);
  const updated = (name) => { report.updated[name] = (report.updated[name] || 0) + 1; };
  const created = (name) => { report.created[name] = (report.created[name] || 0) + 1; };
  const brands = new Map(rows('brands').map((row) => [row.brandId, row]));
  const products = new Map(rows('products').map((row) => [row._id, row]));

  for (const product of products.values()) {
    let changed = false;
    if (!Number.isInteger(product.version) || product.version < 1) { product.version = 1; changed = true; }
    if (!Array.isArray(product.assetIds)) { product.assetIds = []; changed = true; }
    if (changed) updated('products');
  }

  const payments = rows('payments');
  const paymentByOrder = new Map(payments.map((row) => [row.orderId, row]));
  const orders = rows('orders');
  for (const order of orders) {
    let changed = false;
    const product = products.get(order.productId);
    const brandId = order.brandId || (product && product.brandId) || 'default';
    const brand = brands.get(brandId);
    if (!order.brandSnapshot) {
      order.brandSnapshot = { brandId, brandCode: brand && brand.code || brandId, name: brand && brand.name || brandId, version: brand && (brand.publishedVersion || brand.version) || 1, publicConfig: brand && brand.publicConfig || {} };
      changed = true;
    }
    if (!order.commissionRuleSnapshot) {
      order.commissionRuleSnapshot = { ruleId: '', version: product && product.version || 1, status: 'DEMO_ONLY', rule: order.commission || product && product.commission || {} };
      changed = true;
    }
    if (!order.idempotencyScope && order.idempotencyKey) { order.idempotencyScope = `${brandId}:${order.customerId || order.contactWechat || order.contactPhone || order._id}`; changed = true; }
    let payment = paymentByOrder.get(order._id);
    if (!payment && order.transactionId) {
      payment = { _id: `payment-migrated-${order._id}`, paymentNo: `LEGACY-${order.orderNo || order._id}`, brandId, orderId: order._id, channel: order.payType ? `WECHAT_${order.payType}` : 'WECHAT_LEGACY', amountFen: order.amountFen, status: 'SUCCESS', providerTransactionId: order.transactionId, paidAt: order.paidAt || order.updatedAt || Date.now(), idempotencyKey: `legacy:${order._id}`, secretRef: 'legacy', createdAt: order.createdAt || Date.now(), updatedAt: Date.now() };
      payments.push(payment); paymentByOrder.set(order._id, payment); created('payments');
    }
    if (payment && order.paymentId !== payment._id) { order.paymentId = payment._id; order.paymentStatus = payment.status; changed = true; }
    if (changed) updated('orders');
  }

  for (const refund of rows('refunds')) {
    if (refund.paymentId) continue;
    const payment = paymentByOrder.get(refund.orderId);
    if (payment) { refund.paymentId = payment._id; updated('refunds'); }
    else report.orphans.push({ collection: 'refunds', id: refund._id, relation: refund.orderId || '' });
  }

  for (const withdrawal of rows('withdrawals')) {
    const next = WITHDRAWAL_STATUS[withdrawal.status];
    if (next) { withdrawal.legacyStatus = withdrawal.status; withdrawal.status = next; withdrawal.migratedAt = Date.now(); updated('withdrawals'); }
  }
  for (const dispute of rows('disputes')) {
    const next = DISPUTE_STATUS[dispute.status];
    let changed = false;
    if (next) { dispute.legacyStatus = dispute.status; dispute.status = next; changed = true; }
    if (!Array.isArray(dispute.evidence)) { dispute.evidence = []; changed = true; }
    if (!Array.isArray(dispute.timeline)) { dispute.timeline = [{ action: dispute.status, operatorId: dispute.handledBy || dispute.customerId || 'migration', createdAt: dispute.createdAt || Date.now() }]; changed = true; }
    if (changed) { dispute.migratedAt = Date.now(); updated('disputes'); }
  }

  const wallets = new Map(rows('wallets').map((row) => [row._id, row]));
  for (const tx of rows('wallet_transactions')) {
    let changed = false;
    const wallet = wallets.get(tx.walletId);
    if (!tx.accountType) { tx.accountType = 'WORKER_AVAILABLE'; changed = true; }
    if (!tx.accountId && wallet) { tx.accountId = wallet.ownerId; changed = true; }
    if (!tx.direction) { tx.direction = (tx.amountFen || 0) < 0 ? 'DEBIT' : 'CREDIT'; changed = true; }
    if (!tx.status) { tx.status = 'POSTED'; changed = true; }
    if (tx.type === 'COMMISSION_REVERSAL') { tx.type = 'REFUND_CLAWBACK'; changed = true; }
    if (changed) updated('wallet_transactions');
  }
  return { data, report };
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const inputArg = arg('--input');
  if (!inputArg) throw new Error('请使用 --input <数据库备份.json> 指定输入文件');
  const input = resolve(inputArg);
  const outputArg = arg('--output');
  const result = migratePhase2Models(JSON.parse(readFileSync(input, 'utf8')));
  console.log(JSON.stringify(result.report, null, 2));
  if (process.argv.includes('--write')) {
    if (!outputArg) throw new Error('--write 必须同时指定 --output <新文件>');
    const output = resolve(outputArg);
    if (output === input) throw new Error('输出文件不能覆盖输入备份');
    writeFileSync(output, `${JSON.stringify(result.data, null, 2)}\n`);
    console.log(`迁移结果已写入 ${output}`);
  }
}
