// H5 按标签页隔离会话，避免客服、工作人员以及同域 admin/client 覆盖彼此的 token。
// 不迁移旧的通用 token/user 键：这些值可能已经串号，升级后明确要求重新登录。
const KEY = 'game-service.workbench.session.v1';
export function assertLoginIdentity(result, mode) {
  const role = result?.user?.role || result?.role;
  const allowed = mode === 'worker' ? ['WORKER', 'ORDER_TAKER'] : ['CS', 'CUSTOMER_SERVICE', 'ADMIN', 'SUPER_ADMIN', 'BRAND_ADMIN', 'DISPATCHER'];
  if (!result?.token || !allowed.includes(role)) throw new Error(mode === 'worker'
    ? '返回的登录身份不是工作人员，请使用接单人员账号'
    : '返回的登录身份不是客服，请使用客服或管理员账号');
}
export function createSessionStore(storage) {
  let fallback = {};
  let unavailable = !storage;
  function read() {
    if (unavailable) return { ...fallback };
    try {
      const value = JSON.parse(storage.getItem(KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }
    catch (_) { unavailable = true; return { ...fallback }; }
  }
  function write(value) {
    fallback = { ...value };
    if (!unavailable) try { storage.setItem(KEY, JSON.stringify(value)); }
    catch (_) { unavailable = true; }
  }
  return {
    get(key) { return read()[key]; },
    set(key, value) { write({ ...read(), [key]: value }); },
    remove(key) { const value=read(); delete value[key]; write(value); },
    clear() { write({}); },
    saveLogin(result) { write({ token: result.token, user: result.user || { role: result.role }, mustChangePwd: !!result.mustChangePwd }); },
  };
}
let storage;
try {
  if (typeof window !== 'undefined') storage = window.sessionStorage;
  else if (typeof uni !== 'undefined') storage = {
    getItem: key => uni.getStorageSync(key),
    setItem: (key, value) => uni.setStorageSync(key, value),
  };
} catch (_) { /* 浏览器禁用存储时只在本标签页内存保存，不退回共享 token。 */ }
export const sessionStore = createSessionStore(storage);
