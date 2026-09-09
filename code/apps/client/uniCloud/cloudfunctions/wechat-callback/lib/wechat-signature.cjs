'use strict';
const { createHash } = require('node:crypto');

// 微信消息推送验签：token/timestamp/nonce 按字典序排序拼接后 SHA1，与微信下发 signature 比对。
// GET（后台配置验证）与 POST（事件推送）均携带这四参，任一缺失即拒绝，防伪造回调。
function verifyWechatSignature({ token, signature, timestamp, nonce }) {
  if (!token || !signature || !timestamp || !nonce) return false;
  const expected = createHash('sha1')
    .update([token, timestamp, nonce].sort().join(''))
    .digest('hex');
  return expected === signature;
}

module.exports = { verifyWechatSignature };
