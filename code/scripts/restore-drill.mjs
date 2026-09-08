// 恢复演练脚本：读取最近一次备份目录，逐集合校验 sha256 后载入内存库，输出演练报告。
// 用于定期验证备份可恢复（§G.4），不写入生产数据。

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COLLECTIONS, createMemoryDb } from '../packages/backend/src/db.js';

// 执行恢复演练：返回 { ok, backup, verified, failed, db }。
export function runRestoreDrill({ dir = process.env.BACKUP_DIR || './backups' } = {}) {
  if (!existsSync(dir)) throw new Error(`备份目录不存在：${dir}`);
  const dates = readdirSync(dir)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && statSync(join(dir, d)).isDirectory())
    .sort();
  if (dates.length === 0) throw new Error('没有可用的备份');
  const latest = dates[dates.length - 1];
  const target = join(dir, latest);
  const manifest = JSON.parse(readFileSync(join(target, 'manifest.json'), 'utf8'));
  const db = createMemoryDb();
  const verified = [];
  const failed = [];
  for (const name of COLLECTIONS) {
    const entry = manifest.collections[name];
    if (!entry) { failed.push(name); continue; }
    const raw = readFileSync(join(target, entry.file), 'utf8');
    const actual = createHash('sha256').update(raw).digest('hex');
    if (actual !== entry.sha256) { failed.push(name); continue; }
    db[name] = JSON.parse(raw);
    verified.push(name);
  }
  return { ok: failed.length === 0, backup: latest, verified, failed, db };
}

function printHelp() {
  console.log('用法：node scripts/restore-drill.mjs [--dir <备份目录>] [--help]');
  console.log('  默认目录 ./backups（可用环境变量 BACKUP_DIR）；校验最近备份并输出演练报告。');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  if (process.argv.includes('--help')) { printHelp(); process.exit(0); }
  const dirIdx = process.argv.indexOf('--dir');
  const dir = dirIdx >= 0 ? process.argv[dirIdx + 1] : undefined;
  const report = runRestoreDrill({ dir });
  console.log(JSON.stringify({ ok: report.ok, backup: report.backup, verified: report.verified.length, failed: report.failed }, null, 2));
  process.exit(report.ok ? 0 : 1);
}
