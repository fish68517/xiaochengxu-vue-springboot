// 文案红线清单：商品/字典等对外文案禁止出现以下词汇（含变体），命中即拦截。
const REDLINE_WORDS = [
  '代练', '代打', '代刷', '上分', '带练',
  '买币', '卖币', '刷币', '保币', '金币交易', '虚拟货币交易',
  '资金托管', '垫资', '担保交易', '充值返利',
  '博彩', '赌博', '抽奖返现',
];

// 返回命中的第一个违禁词；未命中返回空串。
export function findRedline(text) {
  const s = String(text || '');
  return REDLINE_WORDS.find((w) => s.includes(w)) || '';
}

// 是否命中红线（供表单禁用/提示判断）。
export function hasRedline(text) {
  return findRedline(text) !== '';
}
