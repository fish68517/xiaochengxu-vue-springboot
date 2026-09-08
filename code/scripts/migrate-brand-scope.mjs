// 品牌边界迁移工具：对数据库备份 JSON 做离线回填和孤儿数据报告。
// 默认只输出报告；传 --write --output <新文件> 才写迁移结果，禁止覆盖输入文件。
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ORDER_RELATED = ['order_logs', 'order_messages', 'refunds', 'disputes', 'attachments'];

export function migrateBrandScope(snapshot, { defaultBrandId = 'default' } = {}) {
  const data = structuredClone(snapshot || {});
  const report = { defaultBrandId, updated: {}, orphans: [] };
  const collection = (name) => Array.isArray(data[name]) ? data[name] : (data[name] = []);
  const count = (name) => { report.updated[name] = (report.updated[name] || 0) + 1; };

  for (const brand of collection('brands')) {
    let changed = false;
    if (!brand.code) { brand.code = brand.brandId; changed = true; }
    if (!Number.isInteger(brand.version) || brand.version < 1) { brand.version = 1; changed = true; }
    if (!Number.isInteger(brand.publishedVersion) || brand.publishedVersion < 0) { brand.publishedVersion = brand.version; changed = true; }
    if (changed) count('brands');
  }

  const products = new Map(collection('products').map((item) => [item._id, item]));
  for (const product of products.values()) {
    if (!product.brandId) { product.brandId = defaultBrandId; count('products'); }
  }

  const orders = new Map(collection('orders').map((item) => [item._id, item]));
  for (const order of orders.values()) {
    if (!order.brandId) {
      order.brandId = (products.get(order.productId) && products.get(order.productId).brandId) || defaultBrandId;
      count('orders');
    }
  }

  for (const name of ORDER_RELATED) {
    for (const item of collection(name)) {
      if (item.brandId) continue;
      const order = orders.get(item.orderId || item.bizId);
      if (order) { item.brandId = order.brandId; count(name); }
      else report.orphans.push({ collection: name, id: item._id, relation: item.orderId || item.bizId || '' });
    }
  }

  const roleRows = collection('user_brand_roles');
  const scopedUsers = new Set(roleRows.filter((row) => row.status !== 'DISABLED').map((row) => row.userId));
  for (const user of collection('users')) {
    if (scopedUsers.has(user._id)) continue;
    roleRows.push({
      _id: `ubr-${user._id}-${defaultBrandId}`,
      userId: user._id,
      brandId: user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' ? '*' : defaultBrandId,
      roles: [user.role], permissions: [], status: 'ACTIVE', createdAt: Date.now(), updatedAt: Date.now(),
    });
    count('user_brand_roles');
  }

  const userScope = new Map(roleRows.filter((row) => row.status !== 'DISABLED').map((row) => [row.userId, row.brandId]));
  for (const name of ['worker_profiles', 'wallets', 'withdrawals', 'notifications', 'subscribe_quota']) {
    for (const item of collection(name)) {
      if (item.brandId) continue;
      const ownerId = item.workerId || item.ownerId || item.receiverId || item.customerId;
      item.brandId = (ownerId && userScope.get(ownerId) && userScope.get(ownerId) !== '*') ? userScope.get(ownerId) : defaultBrandId;
      count(name);
    }
  }

  const wallets = new Map(collection('wallets').map((item) => [item._id, item]));
  for (const tx of collection('wallet_transactions')) {
    if (!tx.brandId) {
      tx.brandId = (wallets.get(tx.walletId) && wallets.get(tx.walletId).brandId) || defaultBrandId;
      count('wallet_transactions');
    }
  }
  const withdrawals = new Map(collection('withdrawals').map((item) => [item._id, item]));
  for (const transfer of collection('transfer_records')) {
    if (!transfer.brandId) {
      transfer.brandId = (withdrawals.get(transfer.withdrawalId) && withdrawals.get(transfer.withdrawalId).brandId) || defaultBrandId;
      count('transfer_records');
    }
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
  const result = migrateBrandScope(JSON.parse(readFileSync(input, 'utf8')), { defaultBrandId: arg('--default-brand') || 'default' });
  console.log(JSON.stringify(result.report, null, 2));
  if (process.argv.includes('--write')) {
    if (!outputArg) throw new Error('--write 必须同时指定 --output <新文件>');
    const output = resolve(outputArg);
    if (output === input) throw new Error('输出文件不能覆盖输入备份');
    writeFileSync(output, `${JSON.stringify(result.data, null, 2)}\n`);
    console.log(`迁移结果已写入 ${output}`);
  }
}
