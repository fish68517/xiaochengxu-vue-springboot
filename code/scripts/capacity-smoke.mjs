import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

export function runCapacitySmoke({ count = 100000, pageSize = 100, maxP95Ms = 50 } = {}) {
  if (!Number.isSafeInteger(count) || count < 1000 || count > 1000000) throw new Error('count 必须为 1000～1000000');
  const rows = Array.from({ length: count }, (_, index) => ({
    _id: `order-${String(index).padStart(8, '0')}`,
    brandId: index % 2 ? 'capacity-b' : 'capacity-a',
    status: index % 7 === 0 ? 'PENDING_ACCEPT' : 'SETTLED',
    createdAt: index,
  }));
  const samples = [];
  for (let attempt = 0; attempt < 100; attempt++) {
    const started = performance.now();
    const page = rows.filter((row) => row.brandId === 'capacity-a' && row.status === 'PENDING_ACCEPT').slice(attempt * pageSize, (attempt + 1) * pageSize);
    if (!Array.isArray(page)) throw new Error('分页结果异常');
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  const p95Ms = samples[Math.ceil(samples.length * 0.95) - 1];
  return { ok: p95Ms <= maxP95Ms, count, pageSize, p95Ms: Number(p95Ms.toFixed(3)), maxP95Ms, boundary: '本地内存查询基线；真实云数据库容量和并发仍须 staging 压测' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = runCapacitySmoke();
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ok ? 0 : 2;
}
