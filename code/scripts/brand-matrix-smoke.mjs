// 品牌矩阵静态门禁；--build 时额外构建每个品牌，默认只做快速配置校验。
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function parseBrandFile(file) {
  const env = {};
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue;
    const at = line.indexOf('='); if (at <= 0) throw new Error(`品牌配置格式错误: ${file}`);
    const key = line.slice(0, at).trim(); const value = line.slice(at + 1).trim();
    if (/SECRET|PRIVATE|PASSWORD|API_KEY|MCH_KEY/i.test(key)) throw new Error(`品牌配置含敏感键: ${key}`);
    env[key] = value;
  }
  return env;
}

export function validateBrandMatrix(directory = resolve('config', 'brands')) {
  if (!existsSync(directory)) throw new Error(`品牌目录不存在: ${directory}`);
  const rows = readdirSync(directory).filter((name) => name.endsWith('.env')).map((name) => parseBrandFile(resolve(directory, name)));
  if (rows.length < 2) throw new Error('品牌矩阵至少需要两个品牌');
  const keys = ['VITE_BRAND_CODE', 'VITE_WECHAT_APP_ID', 'VITE_PUBLIC_CHANNEL_ID'];
  const errors = [];
  for (const row of rows) {
    if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(row.VITE_BRAND_CODE || '')) errors.push('品牌 code 不合法');
    if (!/^wx[a-zA-Z0-9]{6,30}$/.test(row.VITE_WECHAT_APP_ID || '')) errors.push(`${row.VITE_BRAND_CODE || 'unknown'} AppID 不合法`);
    if (!row.VITE_BRAND_DISPLAY_NAME || !row.VITE_PUBLIC_CHANNEL_ID) errors.push(`${row.VITE_BRAND_CODE || 'unknown'} 缺少显示名或渠道`);
  }
  for (const key of keys) if (new Set(rows.map((row) => row[key])).size !== rows.length) errors.push(`${key} 在品牌间必须唯一`);
  return { ok: errors.length === 0, brands: rows.map((row) => ({ code: row.VITE_BRAND_CODE, displayName: row.VITE_BRAND_DISPLAY_NAME, appId: row.VITE_WECHAT_APP_ID, channelId: row.VITE_PUBLIC_CHANNEL_ID })), errors };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const result = validateBrandMatrix();
  if (result.ok && process.argv.includes('--build')) {
    const platformIndex = process.argv.indexOf('--platform'); const platform = platformIndex >= 0 ? process.argv[platformIndex + 1] : 'h5';
    for (const brand of result.brands) {
      const child = spawnSync(process.execPath, ['scripts/build-brand.mjs', '--brand', brand.code, '--platform', platform], { cwd: process.cwd(), stdio: 'inherit' });
      if (child.status !== 0) result.errors.push(`${brand.code}/${platform} 构建失败`);
    }
    result.ok = result.errors.length === 0;
  }
  console.log(JSON.stringify(result, null, 2)); process.exit(result.ok ? 0 : 1);
}
