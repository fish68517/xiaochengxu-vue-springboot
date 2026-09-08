// 离线验证真实环境证据清单，不会替操作者执行支付或发布。
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const REQUIRED_CHECKS = ['hosting', 'cloud', 'database-indexes', 'storage-private', 'timers', 'wechat-login', 'payment', 'refund', 'manual-payout', 'reconciliation', 'brand-isolation', 'authorization', 'pii', 'backup-restore', 'rollback', 'alert-delivery', 'capacity', 'legal-approval'];
export function evaluateAcceptance(manifest, { evidenceRoot, now = Date.now() } = {}) {
  const missing = []; const errors = [];
  if (!['staging', 'production'].includes(manifest.environment)) errors.push('environment 必须为 staging/production');
  if (!manifest.version || !manifest.spaceId || !manifest.executedBy || !manifest.completedAt) errors.push('缺少版本、空间、执行人或时间');
  if (!Number.isFinite(Date.parse(manifest.completedAt)) || Date.parse(manifest.completedAt) > now || now - Date.parse(manifest.completedAt) > 14 * 86400000) errors.push('验收证据必须在最近14日内');
  for (const name of REQUIRED_CHECKS) {
    const check = manifest.checks?.find(item => item.name === name && item.ok === true && item.environment === manifest.environment && item.mode === 'real' && item.evidence && /^[a-f0-9]{64}$/.test(item.sha256 || ''));
    if (!check) { missing.push(name); continue; }
    if (evidenceRoot) {
      const file = resolve(evidenceRoot, check.evidence); const rel = relative(resolve(evidenceRoot), file);
      if (rel.startsWith('..') || isAbsolute(rel) || !existsSync(file)) { errors.push(`${name}: 证据文件不存在或越界`); continue; }
      if (createHash('sha256').update(readFileSync(file)).digest('hex') !== check.sha256) errors.push(`${name}: 证据摘要不匹配`);
    }
  }
  const requiredRoles = ['technical', 'qa', 'operations', 'finance', 'legal'];
  for (const role of requiredRoles) if (!manifest.approvals?.some(item => item.role === role && item.name && item.approved === true && item.approvedAt)) errors.push(`缺少 ${role} 签字`);
  if (manifest.environment === 'production' && (!manifest.backupId || !manifest.rollbackBundleSha256 || !manifest.releaseArtifactSha256 || !manifest.migrationVersion)) errors.push('生产验收缺少备份、产物/回滚摘要或迁移版本');
  if (manifest.openP0 !== 0) errors.push('必须确认未关闭 P0 数量为 0');
  return { ok: !missing.length && !errors.length, environment: manifest.environment, version: manifest.version, missing, errors, generatedAt: new Date(now).toISOString(), boundary: '校验文件完整性；真实性仍由签字人负责' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = name => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : ''; };
  const input = arg('--input'); const output = arg('--output') || 'TestEvidence/commercial-acceptance.json';
  if (!input) throw new Error('用法：node scripts/commercial-acceptance.mjs --input 证据清单.json [--output 报告.json]');
  const report = evaluateAcceptance(JSON.parse(readFileSync(input, 'utf8')), { evidenceRoot: dirname(resolve(input)) });
  mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2)); process.exitCode = report.ok ? 0 : 2;
}
