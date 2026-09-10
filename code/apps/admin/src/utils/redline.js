// 单一源来自 packages/domain；云函数使用同一清单做最终强制校验。
import { REDLINE_WORDS, findRedlineWord } from '../../../../packages/domain/src/redline.js';

// 返回命中的第一个违禁词；未命中返回空串。
export function findRedline(text) {
  return findRedlineWord(text);
}

export { REDLINE_WORDS };

// 是否命中红线（供表单禁用/提示判断）。
export function hasRedline(text) {
  return findRedline(text) !== '';
}
