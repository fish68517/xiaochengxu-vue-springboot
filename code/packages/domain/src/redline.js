// 商品文案红线单一源：前端预检与云函数最终校验共用。
export const REDLINE_WORDS = Object.freeze([
  '代练', '代打', '代刷', '上分', '带练', '买币', '卖币', '刷币', '保币',
  '金币交易', '虚拟货币交易', '托管', '资金托管', '垫资', '担保', '担保交易',
  '返利', '充值返利', '博彩', '赌博', '抽奖返现',
]);

export function findRedlineWord(text = '') {
  const value = String(text || '');
  return REDLINE_WORDS.find((word) => value.includes(word)) || '';
}

export function assertNoRedline(text = '') {
  const hit = findRedlineWord(text);
  if (hit) throw new Error(`商品文案含禁用词: ${hit}`);
  return true;
}
