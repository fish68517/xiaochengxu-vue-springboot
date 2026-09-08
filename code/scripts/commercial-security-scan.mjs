import { readFileSync, readdirSync, lstatSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
const SKIP = new Set(['node_modules', '.git', '.runtime', 'TestEvidence', 'ReleaseArtifacts', 'backups', 'alerts']);
export function scanSources(root, { productionBuild = false } = {}) {
  const findings = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name) || !productionBuild && ['dist', 'unpackage', 'BuildArtifacts'].includes(name)) continue;
      const path = join(dir, name); const stat = lstatSync(path); if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) { walk(path); continue; }
      if (name.startsWith('.env') && name !== '.env.example') continue;
      if (!/\.(?:js|cjs|mjs|vue|json|html|ya?ml|md|txt)$/.test(name) || stat.size > 20000000) continue;
      const value = readFileSync(path, 'utf8'); const file = relative(root, path).replace(/\\/g, '/');
      const checks = [
        ['private-key', new RegExp('-----BEGIN ' + '(?:RSA |EC )?PRIVATE KEY-----')],
        ['cloud-secret', new RegExp('(?:AKIA|LTAI)[A-Z0-9]{16,}')],
      ];
      if (productionBuild) checks.push(['local-api', /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?\/api/], ['demo-appid', /wxdemo[a-z0-9]+/i]);
      for (const [rule, regex] of checks) if (regex.test(value)) findings.push({ file, rule });
    }
  }
  walk(resolve(root)); return { ok: findings.length === 0, findings, productionBuild, scannedAt: new Date().toISOString() };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const index = process.argv.indexOf('--root'); const root = index >= 0 ? process.argv[index + 1] : process.cwd();
  if (!existsSync(root)) throw new Error('扫描目录不存在');
  const report = scanSources(root, { productionBuild: process.argv.includes('--production-build') });
  mkdirSync('TestEvidence', { recursive: true }); writeFileSync('TestEvidence/security-scan.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); process.exitCode = report.ok ? 0 : 1;
}
