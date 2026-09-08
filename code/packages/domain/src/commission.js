// 抽成与退款资金纯函数。金额单位一律为「分」（整数）。

// 计算订单佣金：固定金额或百分比（四舍五入到分）。
export function calculateEarnings({ amountFen, commission }) {
  if (!Number.isInteger(amountFen) || amountFen <= 0) {
    throw new Error('订单金额必须为正整数（分）');
  }
  if (!commission) {
    throw new Error('缺少抽成配置');
  }
  if (commission.type === 'fixed') {
    if (!Number.isInteger(commission.valueFen) || commission.valueFen < 0) {
      throw new Error('固定抽成必须为非负整数（分）');
    }
    return commission.valueFen;
  }
  if (commission.type === 'percent') {
    if (typeof commission.valuePercent !== 'number' || commission.valuePercent < 0 || commission.valuePercent > 100) {
      throw new Error('百分比抽成必须在 0-100 之间');
    }
    return Math.round((amountFen * commission.valuePercent) / 100);
  }
  throw new Error('未知抽成类型');
}

// 计算退款比例 = 未履约占比 = 1 − clamp(实际产出/保底产出, 0, 1)。
// 语义：未达标退差额比例（实际产出 80% → 退 20%）；达标（实际≥保底）退 0；无产出退全额。
export function calculateRefundRatio({ actualOutput, guaranteedOutput }) {
  // 保底产出量为 0 或负数时无基准，兜底按不退款处理（比例 0）。
  if (!(guaranteedOutput > 0)) return 0;
  const delivered = Math.min(1, Math.max(0, actualOutput / guaranteedOutput));
  // 保留 6 位小数，避免浮点误差（如 1-0.8=0.1999...）。
  return Math.round((1 - delivered) * 1000000) / 1000000;
}

// 计算退款金额 = 订单金额 × 退款比例（未履约占比），四舍五入到分。
export function calculateRefundAmount({ amountFen, ratio }) {
  return Math.round(amountFen * ratio);
}

// 计算退款追回佣金：全额追回该订单已入账佣金，与退款比例无关（V1.1 §11.2）。
export function calculateCommissionRecovery({ earningsFen }) {
  return earningsFen;
}
