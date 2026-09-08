// verify-all：全阶段统一验证入口；任一步失败即返回非 0，并保留逐步日志和摘要。
// 退出码：任一失败即非 0。

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('TestEvidence', { recursive: true });

const results = [];
function run(name, command, args = [], { shell = false } = {}) {
  const start = Date.now();
  const res = spawnSync(command, args, { cwd: process.cwd(), encoding: 'utf8', shell });
  results.push({
    name,
    ok: res.status === 0,
    durationMs: Date.now() - start,
    status: res.status,
    error: res.error && String(res.error),
  });
  process.stdout.write(`[${res.status === 0 ? 'PASS' : 'FAIL'}] ${name} (${Date.now() - start}ms)\n`);
  return res;
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const steps = [
  ['release-preflight', process.execPath, ['scripts/release-preflight.mjs', '--environment', 'development']],
  ['brand-matrix', process.execPath, ['scripts/brand-matrix-smoke.mjs']],
  ['lint', npm, ['run', 'check:js'], { shell: process.platform === 'win32' }],
  ['domain-sync', process.execPath, ['scripts/verify-domain-sync.mjs']],
  ['tests', npm, ['test'], { shell: process.platform === 'win32' }],
  ['build-all', npm, ['run', 'build:all'], { shell: process.platform === 'win32' }],
  ['api-smoke', process.execPath, ['scripts/e2e-smoke.mjs']],
  ['ui-smoke', process.execPath, ['scripts/e2e-ui-smoke.mjs']],
];
for (const [name, command, args, options] of steps) {
  const result = run(name, command, args, options);
  const output = (result.stdout || '') + (result.stderr || '');
  writeFileSync(`TestEvidence/verify-${name}.log`, output || `[${name} produced no output]`);
  if (result.status !== 0) process.stdout.write(output);
}

const summary = {
  generatedAt: new Date().toISOString(),
  results,
  allPassed: results.every((r) => r.ok),
};
writeFileSync('TestEvidence/verify-summary.json', JSON.stringify(summary, null, 2));
writeFileSync('TestEvidence/phase1-verify-summary.json', JSON.stringify(summary, null, 2)); // 兼容旧交接链接
console.log('SUMMARY\n' + JSON.stringify(summary, null, 2));
process.exit(summary.allPassed ? 0 : 1);
