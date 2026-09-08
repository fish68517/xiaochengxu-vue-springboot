// 品牌解析纯函数：新增一个客户小程序 = 新增一条品牌配置，无需改代码。
// resolveBrand 与 missingKeys 由云函数（game-service）与本地后端（packages/backend）共用。

// 按 appId 精确匹配；无匹配返回默认品牌（status=ON 且 isDefault），仍无则返回第一个；空列表返回 null。
export function resolveBrand(brands, appId) {
  const list = Array.isArray(brands) ? brands : [];
  if (list.length === 0) return null;

  if (appId) {
    const exact = list.find((b) => b && b.appId === appId);
    if (exact) return exact;
  }

  const preferred = list.find((b) => b && b.status === 'ON' && b.isDefault);
  if (preferred) return preferred;

  return list[0];
}

// 返回 copy 中缺失（或为空）的默认文案键，供客户端兜底合并。
export function missingKeys(copy, defaults) {
  const c = copy && typeof copy === 'object' ? copy : {};
  const d = defaults && typeof defaults === 'object' ? defaults : {};
  return Object.keys(d).filter((key) => {
    const value = c[key];
    if (value === undefined || value === null) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  });
}
