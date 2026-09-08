import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ops from '../../../uniCloud-tcb/cloudfunctions/game-service/lib/commercial-ops.cjs';
import repository from '../../../uniCloud-tcb/cloudfunctions/game-service/lib/repository.cjs';
import { sendAlert } from '../../../scripts/alert.mjs';
import { evaluateAcceptance } from '../../../scripts/commercial-acceptance.mjs';

test('运维日志去除密钥、手机号和 H5 token，并保持请求关联', () => {
  const value = ops.sanitize({ requestId: 'req-123', password: 'unsafe', nested: { phone: '13812345678', message: 'https://test.cn/?token=abcd&x=1' } });
  assert.equal(value.requestId, 'req-123');
  assert.ok(!JSON.stringify(value).includes('unsafe'));
  assert.ok(!JSON.stringify(value).includes('13812345678'));
  assert.ok(!JSON.stringify(value).includes('token=abcd'));
});

test('真实 webhook 发送路径区分送达/失败；测试只连接环回服务器', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'commercial-alert-'));
  let received;
  const server = createServer((req, res) => { let raw = ''; req.on('data', chunk => { raw += chunk; }); req.on('end', () => { received = JSON.parse(raw); res.end('{"ok":true}'); }); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const result = await sendAlert({ level: 'P1', title: '测试', meta: { password: 'do-not-send' } }, { logDir: directory, webhookUrl: `http://127.0.0.1:${server.address().port}`, allowLocal: true });
    assert.equal(result.delivered, true);
    assert.equal(received.level, 'P1');
    assert.ok(!JSON.stringify(received).includes('do-not-send'));
    const absent = await sendAlert({ title: '未配置' }, { logDir: directory });
    assert.equal(absent.delivered, false);
  } finally { await new Promise(resolve => server.close(resolve)); rmSync(directory, { recursive: true, force: true }); }
});

test('分页必须在仓储层执行且不能读取其他品牌', async () => {
  const repo = repository.createMemoryRepository();
  for (let i = 0; i < 65; i++) await repo.insert('orders', { _id: `o${String(i).padStart(3, '0')}`, brandId: i % 2 ? 'b' : 'a', createdAt: i });
  const services = ops.createOperationsServices();
  const session = { userId: 'admin-a', role: 'BRAND_ADMIN', brandScopes: ['a'] };
  const first = await services.listRecordsPage(repo, { resource: 'orders', brandId: 'a', limit: 10 }, session);
  assert.equal(first.items.length, 10);
  assert.ok(first.items.every(row => row.brandId === 'a'));
  const second = await services.listRecordsPage(repo, { resource: 'orders', brandId: 'a', limit: 10, cursor: first.nextCursor }, session);
  assert.ok(!second.items.some(row => first.items.some(other => other._id === row._id)));
  await assert.rejects(() => services.listRecordsPage(repo, { resource: 'users', brandId: 'a' }, session), /资源/);
  await assert.rejects(() => services.listRecordsPage(repo, { resource: 'orders', brandId: 'b' }, session), /品牌/);
});

test('生产灰度开关、品牌/用户名单及单笔限额均 fail-closed', async () => {
  const repo = repository.createMemoryRepository();
  const env = { APP_ENV: 'production' };
  await assert.rejects(() => ops.enforceLaunchPolicy(repo, { brandId: 'a', userId: 'u', amountFen: 1 }, env), /灰度/);
  await repo.insert('configs', { _id: 'launch', cfgKey: 'COMMERCIAL_LAUNCH_POLICY', cfgValue: { approved: true, paused: false, brands: ['a'], userIds: ['u'], maxPaymentFen: 100, maxDailyPaymentFen: 200 } });
  await ops.enforceLaunchPolicy(repo, { brandId: 'a', userId: 'u', amountFen: 1 }, env);
  await assert.rejects(() => ops.enforceLaunchPolicy(repo, { brandId: 'b', userId: 'u', amountFen: 1 }, env), /灰度/);
  await assert.rejects(() => ops.enforceLaunchPolicy(repo, { brandId: 'a', userId: 'v', amountFen: 1 }, env), /灰度/);
  await assert.rejects(() => ops.enforceLaunchPolicy(repo, { brandId: 'a', userId: 'u', amountFen: 101 }, env), /限额/);
});

test('真实环境验收不接受 Mock 报告或缺失财务/恢复证据', () => {
  const report = evaluateAcceptance({ environment: 'staging', version: 'v1', checks: [] });
  assert.equal(report.ok, false);
  assert.ok(report.missing.includes('payment'));
  const mock = evaluateAcceptance({ environment: 'staging', version: 'v1', checks: [{ name: 'payment', ok: true, environment: 'development', evidence: 'local.json' }] });
  assert.equal(mock.ok, false);
  assert.ok(mock.missing.includes('payment'));
});
