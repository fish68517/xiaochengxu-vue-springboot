// 领域单一源回归校验：重新构建 domain.cjs 后，对比其与 packages/domain 的导出集合与关键行为。
// 用法：node scripts/verify-domain-sync.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildDomain } from './build-domain.mjs';
import * as esm from '../packages/domain/src/index.js';

const require = createRequire(import.meta.url);

await buildDomain();

const cjs = require('../uniCloud-tcb/cloudfunctions/game-service/lib/domain.cjs');

// 1. 导出集合一致（忽略 esbuild 注入的 __esModule 标记）
const esmNames = Object.keys(esm).sort();
const cjsNames = Object.keys(cjs).filter((n) => n !== '__esModule' && n !== 'default').sort();
assert.deepEqual(cjsNames, esmNames, '构建产物导出集合与 packages/domain 不一致');

// 2. 抽样函数行为一致（返回值或抛错信息）
function same(fn, args) {
  const run = (mod) => {
    try {
      return { ok: true, value: mod[fn](...args) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };
  assert.deepEqual(run(cjs), run(esm), `${fn}(${JSON.stringify(args)}) 行为不一致`);
}

same('createOrder', [{ id: 'o1', amountFen: 100, createdAt: 12345 }]);
same('createOrder', [{ id: '', amountFen: 100 }]);
same('calculateEarnings', [{ amountFen: 1000, commission: { type: 'percent', valuePercent: 10 } }]);
same('calculateEarnings', [{ amountFen: 1000, commission: { type: 'fixed', valueFen: 50 } }]);
same('calculateEarnings', [{ amountFen: 1000, commission: { type: 'bogus' } }]);
same('createWallet', []);
same('creditWallet', [{ availableFen: 0, pendingWithdrawFen: 0, withdrawnFen: 0, freezeWithdrawal: false, freezeAccept: false }, 500]);
same('createWithdrawal', [
  { availableFen: 3000, pendingWithdrawFen: 0, withdrawnFen: 0, freezeWithdrawal: false, freezeAccept: false },
  { id: 'w1', amountFen: 1000, createdAt: 12345 },
]);
same('payOrder', [{ id: 'x', amountFen: 100, status: 'IN_SERVICE', createdAt: 0, updatedAt: 0 }, { paidAt: 1 }]);

// 3. 状态机迁移（原地修改对象，结果一致）
{
  const a = { id: 'x', amountFen: 100, status: esm.OrderStatus.PENDING_PAYMENT, createdAt: 0, updatedAt: 0 };
  const b = structuredClone(a);
  esm.payOrder(a, { paidAt: 1 });
  cjs.payOrder(b, { paidAt: 1 });
  assert.deepEqual(a, b, 'payOrder 状态迁移不一致');
}

console.log(`校验通过：domain.cjs 与 packages/domain 导出集合一致（${cjsNames.length} 个导出），抽样行为一致。`);
