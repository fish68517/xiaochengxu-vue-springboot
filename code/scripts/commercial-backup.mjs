// 封装已由 uniCloud 导出的快照及私有附件；不读取生产凭据，不自动回写云数据库。
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, lstatSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, join, relative, isAbsolute, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const digest = value => createHash('sha256').update(value).digest('hex');
function key(value) { const bytes = Buffer.from(value || '', 'base64'); if (bytes.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY 必须是32字节 base64'); return bytes; }
function child(root, file) { const path = resolve(root, file); const rel = relative(resolve(root), path); if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('快照路径越界'); return path; }
function files(root) {
  const found = [];
  function walk(dir) { for (const name of readdirSync(dir)) { const full = join(dir, name); const stat = lstatSync(full); if (stat.isSymbolicLink()) throw new Error('备份拒绝符号链接'); if (stat.isDirectory()) walk(full); else if (stat.isFile()) found.push(full); } }
  walk(root); return found;
}
export function sealBackup({ source, output, environment, spaceId, exportedAt, encryptionKey, replica }) {
  if (!['staging', 'production'].includes(environment) || !spaceId || !Number.isFinite(Date.parse(exportedAt))) throw new Error('必须指定真实导出环境、空间和导出时间');
  const root = resolve(source); const target = resolve(output);
  if (existsSync(target)) throw new Error('备份目标已存在，拒绝覆盖');
  if (!relative(root, target).startsWith('..') && !isAbsolute(relative(root, target))) throw new Error('备份目标不能位于输入目录内');
  const input = files(root); if (!input.length) throw new Error('输入快照为空');
  const secret = key(encryptionKey); mkdirSync(target, { recursive: true });
  const manifest = { version: 1, environment, spaceId, exportedAt, createdAt: new Date().toISOString(), algorithm: 'AES-256-GCM', files: [] };
  for (const full of input) {
    const name = relative(root, full).replace(/\\/g, '/'); const raw = readFileSync(full);
    const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', secret, iv);
    const aad = `${environment}:${spaceId}:${name}`; cipher.setAAD(Buffer.from(aad));
    const encrypted = Buffer.concat([cipher.update(raw), cipher.final()]); const stored = `${name}.enc`; const dest = child(target, stored);
    mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, encrypted, { flag: 'wx' });
    manifest.files.push({ name, stored, bytes: raw.length, sha256: digest(raw), cipherSha256: digest(encrypted), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') });
  }
  writeFileSync(join(target, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
  if (replica) {
    const dest = resolve(replica); if (existsSync(dest) || !relative(target, dest).startsWith('..') && !isAbsolute(relative(target, dest))) throw new Error('副本必须是独立且尚不存在的目标');
    mkdirSync(dest, { recursive: true });
    for (const full of files(target)) { const file = child(dest, relative(target, full)); mkdirSync(dirname(file), { recursive: true }); copyFileSync(full, file); }
  }
  return { ok: true, output: target, replica: replica || null, manifestSha256: digest(readFileSync(join(target, 'manifest.json'))), files: manifest.files.length, environment, spaceId };
}
export function restoreBackup({ source, output, encryptionKey, expectedManifestSha256, maxRpoHours = 24, maxRtoMinutes = 240, now = Date.now() }) {
  const started = Date.now(); const root = resolve(source); const target = resolve(output);
  if (existsSync(target)) throw new Error('隔离恢复目录已存在，拒绝覆盖');
  const rawManifest = readFileSync(join(root, 'manifest.json'));
  if (!expectedManifestSha256 || digest(rawManifest) !== expectedManifestSha256) throw new Error('备份manifest摘要不匹配');
  const manifest = JSON.parse(rawManifest); const secret = key(encryptionKey);
  if (!Array.isArray(manifest.files) || !manifest.files.length) throw new Error('备份为空');
  const verified = [];
  for (const entry of manifest.files) {
    const bytes = readFileSync(child(root, entry.stored)); if (digest(bytes) !== entry.cipherSha256) throw new Error('备份内容校验失败');
    const cipher = createDecipheriv('aes-256-gcm', secret, Buffer.from(entry.iv, 'base64')); cipher.setAAD(Buffer.from(`${manifest.environment}:${manifest.spaceId}:${entry.name}`)); cipher.setAuthTag(Buffer.from(entry.tag, 'base64'));
    const data = Buffer.concat([cipher.update(bytes), cipher.final()]); if (digest(data) !== entry.sha256 || data.length !== entry.bytes) throw new Error('恢复数据校验失败');
    verified.push({ path: child(target, entry.name), data });
  }
  mkdirSync(target, { recursive: true }); for (const item of verified) { mkdirSync(dirname(item.path), { recursive: true }); writeFileSync(item.path, item.data, { flag: 'wx' }); }
  const rpoHours = (now - Date.parse(manifest.exportedAt)) / 3600000; const rtoMinutes = (Date.now() - started) / 60000;
  return { ok: Number.isFinite(rpoHours) && rpoHours >= 0 && rpoHours <= maxRpoHours && rtoMinutes <= maxRtoMinutes, files: verified.length, rpoHours, rtoMinutes, environment: manifest.environment, spaceId: manifest.spaceId, boundary: '已验证隔离文件恢复；云数据库导入及业务回归须单独验收', output: target };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = name => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : ''; };
  const options = { source: arg('--source'), output: arg('--output'), encryptionKey: process.env.BACKUP_ENCRYPTION_KEY };
  if (!options.source || !options.output) throw new Error('用法 seal|restore --source 输入目录 --output 新目录；密钥来自 BACKUP_ENCRYPTION_KEY');
  const result = process.argv[2] === 'seal' ? sealBackup({ ...options, environment: arg('--environment'), spaceId: arg('--space'), exportedAt: arg('--exported-at'), replica: arg('--replica') }) : process.argv[2] === 'restore' ? restoreBackup({ ...options, expectedManifestSha256: arg('--manifest-sha256') }) : (() => { throw new Error('请选择 seal/restore'); })();
  console.log(JSON.stringify(result, null, 2)); process.exitCode = result.ok ? 0 : 2;
}
