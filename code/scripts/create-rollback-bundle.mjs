// 生成发布回滚清单：只引用已校验备份和已构建产物，不自动覆盖生产数据。
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const arg = (name) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : ''; };
const backupRoot = resolve(arg('--backup-dir') || process.env.BACKUP_DIR || 'backups');
const output = resolve(arg('--output') || join('ReleaseArtifacts', `rollback-${new Date().toISOString().replace(/[:.]/g, '-')}.json`));
if (!existsSync(backupRoot)) throw new Error(`备份目录不存在: ${backupRoot}`);
const backups = readdirSync(backupRoot).filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name) && statSync(join(backupRoot, name)).isDirectory()).sort();
if (!backups.length) throw new Error('没有可用备份，请先运行 backup:local 或生产数据库导出');
const backupId = backups[backups.length - 1];
const manifestPath = join(backupRoot, backupId, 'manifest.json');
if (!existsSync(manifestPath)) throw new Error(`备份缺少 manifest: ${manifestPath}`);
const backupManifestRaw = readFileSync(manifestPath, 'utf8');
const brandRoot = resolve('BuildArtifacts', 'brands');
const builds = [];
if (existsSync(brandRoot)) for (const brand of readdirSync(brandRoot)) for (const platform of readdirSync(join(brandRoot, brand))) {
  const file = join(brandRoot, brand, platform, 'brand-build.json');
  if (existsSync(file)) builds.push({ ...JSON.parse(readFileSync(file, 'utf8')), manifest: file });
}
const bundle = {
  createdAt: new Date().toISOString(), backupId, backupManifest: manifestPath,
  backupManifestSha256: createHash('sha256').update(backupManifestRaw).digest('hex'), builds,
  rollbackOrder: ['暂停写入入口', '切回上一版本静态托管与云函数', '校验备份 manifest/sha256', '在隔离空间执行恢复演练', '经负责人批准后恢复生产数据', '执行健康检查和资金对账'],
  safety: '本清单不会自动写入生产；数据恢复必须在隔离空间演练并取得审批。',
};
mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, `${JSON.stringify(bundle, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, output, backupId, builds: builds.length }, null, 2));
