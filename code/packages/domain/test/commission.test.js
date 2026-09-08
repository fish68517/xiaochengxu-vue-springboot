import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEarnings,
  calculateRefundRatio,
  calculateRefundAmount,
  calculateCommissionRecovery,
} from '../src/commission.js';

test('固定金额抽成：返回配置的固定金额（分）', () => {
  assert.equal(calculateEarnings({ amountFen: 10000, commission: { type: 'fixed', valueFen: 800 } }), 800);
});

test('百分比抽成：按订单金额百分比计算并四舍五入到分', () => {
  assert.equal(calculateEarnings({ amountFen: 10000, commission: { type: 'percent', valuePercent: 20 } }), 2000);
  assert.equal(calculateEarnings({ amountFen: 9999, commission: { type: 'percent', valuePercent: 15 } }), 1500);
});

test('非法抽成类型抛错', () => {
  assert.throws(() => calculateEarnings({ amountFen: 10000, commission: { type: 'unknown', value: 1 } }));
});

test('金额为 0 或负数抛错', () => {
  assert.throws(() => calculateEarnings({ amountFen: 0, commission: { type: 'fixed', valueFen: 100 } }));
  assert.throws(() => calculateEarnings({ amountFen: -100, commission: { type: 'fixed', valueFen: 100 } }));
});

test('退款比例 = 1 − 实际产出/保底产出，夹在 [0,1]（未达标退差额）', () => {
  assert.equal(calculateRefundRatio({ actualOutput: 80, guaranteedOutput: 100 }), 0.2);
  assert.equal(calculateRefundRatio({ actualOutput: 150, guaranteedOutput: 100 }), 0);
  assert.equal(calculateRefundRatio({ actualOutput: -5, guaranteedOutput: 100 }), 1);
});

test('保底产出量为 0 时退款比例兜底为 0', () => {
  assert.equal(calculateRefundRatio({ actualOutput: 80, guaranteedOutput: 0 }), 0);
});

test('退款金额 = 订单金额 × 退款比例（四舍五入到分）', () => {
  assert.equal(calculateRefundAmount({ amountFen: 10000, ratio: 0.2 }), 2000);
  assert.equal(calculateRefundAmount({ amountFen: 9999, ratio: 0.75 }), 7499);
});

test('退款追回佣金 = 全额', () => {
  assert.equal(calculateCommissionRecovery({ earningsFen: 1500 }), 1500);
});
