'use strict';
const { verifyWechatSignature } = require('./lib/wechat-signature.cjs');
const { parseBody, extractEnterTempSession } = require('./lib/handle-message.cjs');
const { sendCustomerServiceLink } = require('./lib/wechat-api.cjs');
const { signInternalRequest } = require('./lib/internal-auth.cjs');
const { buildH5OrderLink } = require('./lib/h5-link.cjs');

// 微信小程序客服消息推送回调
// GET：验签并返回 echostr（微信后台验证）
// POST：接收 user_enter_tempsession 事件，生成 H5 token 并自动发送下单链接
exports.main = async (event = {}) => {
  const token = process.env.WECHAT_MP_KF_TOKEN;
  const q = event.queryStringParameters || event.query || {};
  const method = event.httpMethod || (q.httpMethod || 'GET');

  const valid = verifyWechatSignature({
    token,
    signature: q.signature,
    timestamp: q.timestamp,
    nonce: q.nonce,
  });
  if (!valid) throw new Error('invalid signature');

  if (method === 'GET' || q.echostr) {
    return q.echostr || 'ok';
  }

  const msg = parseBody(event);
  const info = extractEnterTempSession(msg);
  if (!info || !info.sessionFrom) return 'success';

  // 系统间调用使用短时 HMAC，不把裸 INTERNAL_SECRET 放入调用参数。
  const internalSecret = process.env.INTERNAL_SECRET;
  if (!internalSecret) {
    console.error('INTERNAL_SECRET 未配置,跳过自动发链接');
    return 'success';
  }

  try {
    const payload = { openid: info.openid, productId: info.sessionFrom };
    const internalAuth = signInternalRequest({ action: 'h5Token', payload, secret: internalSecret });
    const callRes = await uniCloud.callFunction({
      name: 'game-service',
      data: {
        action: 'h5Token',
        payload,
        internalAuth,
      },
    });
    const h5Token = callRes.result && callRes.result.token;
    if (!h5Token) return 'success';

    const base = process.env.H5_ORDER_BASE_URL || 'https://h5.qmhyjoy.com';
    const link = buildH5OrderLink(base, h5Token);

    await sendCustomerServiceLink({
      appid: process.env.WECHAT_MP_APPID,
      secret: process.env.WECHAT_MP_SECRET,
      openid: info.openid,
      link,
    });
  } catch (error) {
    console.error('wechat-callback send link failed', error);
  }

  return 'success';
};
