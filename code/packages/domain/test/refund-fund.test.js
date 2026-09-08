import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRefundRatio,
  calculateRefundAmount,
  calculateCommissionRecovery,
} from '../src/commission.js';
import { createWallet, creditWallet, debitWallet } from '../src/wallet.js';

test('退款比例 = 1 − 实际产出/保底产出（未达标退差额）', () => {
  assert.equal(calculateRefundRatio({ actualOutput: 80, guaranteedOutput: 100 }), 0.2);
  assert.equal(calculateRefundRatio({ actualOutput: 50, guaranteedOutput: 200 }), 0.75);
});

test('退款比例夹在 [0,1]：达标退 0，无产出退全额', () => {
  assert.equal(calculateRefundRatio({ actualOutput: 150, guaranteedOutput: 100 }), 0);
  assert.equal(calculateRefundRatio({ actualOutput: -5, guaranteedOutput: 100 }), 1);
});

test('保底产出量为 0 或负数时兜底返回 0', () => {
  assert.equal(calculateRefundRatio({ actualOutput: 80, guaranteedOutput: 0 }), 0);
  assert.equal(calculateRefundRatio({ actualOutput: 80, guaranteedOutput: -1 }), 0);
});

test('退款金额 = 订单金额 × 退款比例，四舍五入到分', () => {
  assert.equal(calculateRefundAmount({ amountFen: 10000, ratio: 0.2 }), 2000);
  assert.equal(calculateRefundAmount({ amountFen: 9999, ratio: 0.75 }), 7499);
});

test('追佣 = 全额追回已入账佣金，与退款比例无关', () => {
  assert.equal(calculateCommissionRecovery({ earningsFen: 2000 }), 2000);
  assert.equal(calculateCommissionRecovery({ earningsFen: 0 }), 0);
});

test('E5/E7 比例退款 + 追佣：扣款可为负', () => {
  const wallet = createWallet();
  creditWallet(wallet, 2000); // 已入账佣金 20 元
  const ratio = calculateRefundRatio({ actualOutput: 80, guaranteedOutput: 100 });
  assert.equal(ratio, 0.2);
  const refundFen = calculateRefundAmount({ amountFen: 10000, ratio });
  assert.equal(refundFen, 2000);
  // 追回佣金：钱包扣成负数
  const recovered = calculateCommissionRecovery({ earningsFen: 2000 });
  debitWallet(wallet, recovered);
  assert.equal(wallet.availableFen, 0);
  // 再扣一笔追佣，验证余额允许为负
  debitWallet(wallet, 500);
  assert.equal(wallet.availableFen, -500);
});

test('debitWallet 允许余额为负，creditWallet 仅接受正数', () => {
  const wallet = createWallet();
  debitWallet(wallet, 300);
  assert.equal(wallet.availableFen, -300);
  creditWallet(wallet, 1000);
  assert.equal(wallet.availableFen, 700);
  assert.throws(() => creditWallet(wallet, -100), /正整数/);
  assert.throws(() => debitWallet(wallet, 0), /正整数/);
});
