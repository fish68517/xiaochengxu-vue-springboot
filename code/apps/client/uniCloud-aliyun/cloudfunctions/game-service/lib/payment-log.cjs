'use strict';
// 日志字段白名单：禁止记录回调原文、签名、OpenID、联系方式、token及密钥。
function failureCode(error) {
  if (error?.code && /^[A-Za-z0-9_:-]{1,80}$/.test(String(error.code))) return String(error.code);
  const message = String(error?.message || '');
  if (/where|transaction|commit|rollback/i.test(message)) return 'PAYMENT_TRANSACTION_ERROR';
  if (/验签|签名/.test(message)) return 'PAYMENT_SIGNATURE_ERROR';
  if (/AppID|商户|品牌|付款人|金额|币种/.test(message)) return 'PAYMENT_VALIDATION_ERROR';
  if (/超时|timeout/i.test(message)) return 'PAYMENT_TIMEOUT';
  return 'PAYMENT_UNKNOWN_ERROR';
}
function paymentLog(stage, fields = {}) {
  const record = { revision: '20260913-payment-confirm-2', stage };
  for (const key of ['orderNo', 'orderId', 'paymentId', 'eventId', 'tradeState', 'orderStatus', 'paymentStatus', 'errorCode', 'duplicate', 'hasSignature', 'httpStatus']) {
    if (fields[key] !== undefined) record[key] = typeof fields[key] === 'string' ? fields[key].slice(0, 160) : fields[key];
  }
  console.info('[PaymentConfirm]', JSON.stringify(record));
}
module.exports = { paymentLog, failureCode };
