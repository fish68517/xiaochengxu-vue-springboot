// 每日全量备份脚本：按 COLLECTIONS 动态导出全部集合为 JSON，按日期留存（默认 ≥30 天），可配置目录。
// 每个备份目录内写 manifest.json（含逐集合 sha256 校验和），供 restore-drill.mjs 校验恢复。

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readdirSync, statSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COLLECTIONS, createMemoryDb } from '../packages/backend/src/db.js';

// sha256 校验和。
function sha256(s) {
  return createHash('sha256').update(s).digest('hex');
}

// 清理早于保留期的备份目录（按目录名日期比较）。
function pruneOld(dir, retentionDays) {
  if (!existsSync(dir)) return 0;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let removed = 0;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory() || !/^\d{4}-\d{2}-\d{2}$/.test(entry)) continue;
    if (entry < cutoff) {
      rmSync(full, { recursive: true, force: true });
      removed += 1;
    }
  }
  return removed;
}

// 执行备份：导出全部集合 + manifest，返回 { dir, manifest, pruned }。
export function backupDb(db, { dir = process.env.BACKUP_DIR || './backups', retentionDays = 30 } = {}) {
  const date = new Date().toISOString().slice(0, 10);
  const target = join(dir, date);
  mkdirSync(target, { recursive: true });
  const manifest = { createdAt: Date.now(), collections: {} };
  for (const name of COLLECTIONS) {
    const data = JSON.stringify(db[name], null, 2);
    const file = `${name}.json`;
    writeFileSync(join(target, file), data);
    manifest.collections[name] = { file, count: db[name].length, sha256: sha256(data) };
  }
  writeFileSync(join(target, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const pruned = pruneOld(dir, retentionDays);
  return { dir: target, manifest, pruned };
}

function printHelp() {
  console.log('用法：node scripts/backup-db.mjs [--dir <目录>] [--retention-days <天>] [--seed] [--help]');
  console.log('  --dir              备份目录（默认 ./backups，可用环境变量 BACKUP_DIR）');
  console.log('  --retention-days   留存天数（默认 30）');
  console.log('  --seed             导出前填充演示数据');
}

// 填充少量演示数据（冒烟用）。
function seedDemo(db) {
  db.products.push({ _id: 'product-1', title: '陪玩一小时', priceFen: 10000, status: 'ON', createdAt: Date.now() });
  db.users.push({ _id: 'user-1', role: 'ADMIN', phone: '13800000000', status: 'ACTIVE', createdAt: Date.now() });
  db.configs.push({ _id: 'config-1', cfgKey: 'MAX_ACTIVE_ORDERS', cfgValue: 5, createdAt: Date.now() });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  if (process.argv.includes('--help')) { printHelp(); process.exit(0); }
  const opt = (flag) => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : undefined; };
  const dir = opt('--dir');
  const retentionDays = Number(opt('--retention-days') || 30);
  const db = createMemoryDb();
  if (process.argv.includes('--seed')) seedDemo(db);
  const result = backupDb(db, { dir, retentionDays });
  console.log(JSON.stringify(result, null, 2));
}
