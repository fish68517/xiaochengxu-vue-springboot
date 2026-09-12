'use strict';

// 当前联调策略：客服、接单人员默认访问所有品牌，无需新增云端环境变量。
// 恢复品牌隔离时改为 false 并重新上传 game-service；不写入数据库永久 * 授权。
const STAFF_ALL_BRANDS = true;
function isStaff(role) {
  return ['CS', 'CUSTOMER_SERVICE', 'WORKER', 'ORDER_TAKER'].includes(role);
}
function allowsAllBrands(user) {
  return STAFF_ALL_BRANDS && isStaff(user?.role) && (!user.status || user.status === 'ACTIVE');
}
function effectiveScopes(user, storedScopes = []) {
  return allowsAllBrands(user) ? ['*'] : [...new Set(storedScopes.filter(Boolean))];
}
module.exports = { STAFF_ALL_BRANDS, isStaff, allowsAllBrands, effectiveScopes };
