'use strict';
const https = require('node:https');

// access_token 缓存：同一容器实例内复用，提前 60 秒过期避免边界失效后仍命中。
let tokenCache = { accessToken: '', expiresAt: 0 };

// 微信 API 通用请求：JSON 入参/出参，非 JSON 响应回退原文。
function request(url, { method = 'GET', body } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers: { 'content-type': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data || '{}') }); }
        catch (_) { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// 获取公众号 access_token（client_credential）：命中缓存直接返回，否则调微信接口换新并缓存；失败抛错中止下发。
async function getAccessToken({ appid, secret }) {
  const now = Date.now();
  if (tokenCache.accessToken && tokenCache.expiresAt > now + 60 * 1000) return tokenCache.accessToken;
  const res = await request(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`);
  if (!res.data || !res.data.access_token) {
    throw new Error(`获取微信 access_token 失败: ${JSON.stringify(res.data)}`);
  }
  tokenCache = { accessToken: res.data.access_token, expiresAt: now + (res.data.expires_in || 7200) * 1000 };
  return tokenCache.accessToken;
}

// 向客户 openid 下发 link 型客服消息（自动发 H5 下单链接）；errcode≠0 视为失败抛错。
async function sendCustomerServiceLink({ appid, secret, openid, link }) {
  const accessToken = await getAccessToken({ appid, secret });
  const res = await request(`https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${accessToken}`, {
    method: 'POST',
    body: {
      touser: openid,
      msgtype: 'link',
      link: {
        title: '确认下单',
        description: '点击完成订单信息填写与支付',
        url: link,
        thumb_url: '',
      },
    },
  });
  if (res.data && res.data.errcode !== 0) {
    throw new Error(`发送客服消息失败: ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

module.exports = { getAccessToken, sendCustomerServiceLink };
