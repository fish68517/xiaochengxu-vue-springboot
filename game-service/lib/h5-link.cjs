'use strict';
const H5_ORDER_HASH_ROUTE = '/#/pages/h5-order/index';

function buildH5OrderLink(baseUrl, token) {
  if (!token) throw new Error('H5 下单 token 不能为空');
  const base = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^/]+/i.test(base)) throw new Error('H5_ORDER_BASE_URL 不合法');
  return `${base}${H5_ORDER_HASH_ROUTE}?token=${encodeURIComponent(token)}`;
}

module.exports = { H5_ORDER_HASH_ROUTE, buildH5OrderLink };

