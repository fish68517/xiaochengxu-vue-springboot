import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateReleaseEnvironment } from '../../../scripts/release-preflight.mjs';
import { validateBrandMatrix } from '../../../scripts/brand-matrix-smoke.mjs';
import { backupDb } from '../../../scripts/backup-db.mjs';
import { runRestoreDrill } from '../../../scripts/restore-drill.mjs';
import { createMemoryDb, COLLECTIONS } from '../src/db.js';

test('第三阶段发布门禁：development 强制 Mock，production 强制备份/回滚与真实适配器', () => {
  assert.equal(validateReleaseEnvironment('development', {}).ok, true);
  assert.equal(validateReleaseEnvironment('development', { PAYMENT_MODE: 'wechat' }).ok, false);
  const prod = validateReleaseEnvironment('production', { API_MODE: 'unicloud', PAYMENT_MODE: 'wechat', MESSAGE_MODE: 'wechat', BRAND_CODE: 'demo-a' });
  assert.equal(prod.ok, false);
  assert.ok(prod.errors.some((item) => item.includes('DB_BACKUP_ID')));
  assert.ok(prod.errors.some((item) => item.includes('ROLLBACK_BUNDLE_PATH')));
});

test('第三阶段品牌矩阵：品牌 code、AppID、渠道均唯一且不含 secret', () => {
  const result = validateBrandMatrix();
  assert.equal(result.ok, true);
  assert.deepEqual(result.brands.map((item) => item.code).sort(), ['demo-a', 'demo-b']);
  assert.equal(new Set(result.brands.map((item) => item.appId)).size, 2);
});

test('第三阶段备份恢复：全部集合带 sha256 且可在隔离内存库恢复', () => {
  const directory = mkdtempSync(join(tmpdir(), 'service-platform-backup-'));
  try {
    const db = createMemoryDb(); db.orders.push({ _id: 'o-release', brandId: 'demo-a' });
    const backup = backupDb(db, { dir: directory, retentionDays: 30 });
    assert.equal(Object.keys(backup.manifest.collections).length, COLLECTIONS.length);
    const restored = runRestoreDrill({ dir: directory });
    assert.equal(restored.ok, true); assert.equal(restored.db.orders[0]._id, 'o-release');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('第三阶段管理端：六个正式模块、共享状态组件和 API 契约均已注册', () => {
  const pages = JSON.parse(readFileSync('apps/admin/src/pages.json', 'utf8')).pages.map((item) => item.path);
  const modules = ['orders', 'ledger', 'withdrawals', 'disputes', 'access', 'audit'];
  for (const name of modules) {
    assert.ok(pages.includes(`pages/${name}/index`), `${name} 未注册 pages.json`);
    assert.equal(existsSync(`apps/admin/src/pages/${name}/index.vue`), true);
  }
  for (const component of ['MoneyText', 'OrderStatusTag', 'AsyncState', 'DangerConfirm']) assert.equal(existsSync(`apps/admin/src/components/${component}.vue`), true);
  const apiSource = readFileSync('apps/admin/src/api.js', 'utf8');
  for (const action of ['getOrder', 'reassignOrder', 'listCommissionRules', 'listDisputes', 'listUserBrandRoles', 'listAuditLogs']) assert.match(apiSource, new RegExp(`${action}:`));
  const dashboard = readFileSync('apps/admin/src/pages/dashboard/index.vue', 'utf8');
  for (const name of modules) assert.match(dashboard, new RegExp(`/pages/${name}/index`));
});
