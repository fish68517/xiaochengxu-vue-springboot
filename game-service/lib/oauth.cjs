'use strict';
// 微信登录/网页授权:code 换 openid,失败即抛错(fail-closed),不降级 mock。
const https = require('node:https');

const MP_API = 'https://api.weixin.qq.com/sns/jscode2session';
const OAUTH_API = 'https://api.weixin.qq.com/sns/oauth2/access_token';

// 默认 HTTP GET JSON 请求(可通过注入 request 替换以测试)。
function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try { parsed = data ? JSON.parse(data) : {}; } catch (_) { return reject(new Error('微信接口返回非 JSON')); }
        resolve(parsed);
      });
    }).on('error', reject);
  });
}

function createOAuth({ env = process.env, request = getJson } = {}) {
  // 服务号网页授权(snsapi_base):code 换服务号 openid,供 H5 页 JSAPI 对商户支付。
  async function oauthExchange(code) {
    const appid = env.WECHAT_OFFICIAL_APPID;
    const secret = env.WECHAT_OFFICIAL_SECRET;
    if (!appid || !secret) throw new Error('服务号网页授权未配置(fail-closed)');
    if (!code) throw new Error('缺少网页授权 code');
    const url = `${OAUTH_API}?appid=${appid}&secret=${secret}&code=${encodeURIComponent(code)}&grant_type=authorization_code`;
    const data = await request(url);
    if (!data.openid) throw new Error(`网页授权换取 openid 失败: ${data.errcode || ''} ${data.errmsg || ''}`);
    return { openid: data.openid };
  }

  // 小程序登录(code2session):code 换小程序 openid,订单中心身份(与支付无关)。
  async function miniLogin(code) {
    const appid = env.WECHAT_MP_APPID;
    const secret = env.WECHAT_MP_SECRET;
    if (!appid || !secret) throw new Error('小程序登录未配置(fail-closed)');
    if (!code) throw new Error('缺少小程序登录 code');
    const url = `${MP_API}?appid=${appid}&secret=${secret}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
    const data = await request(url);
    if (!data.openid) throw new Error(`小程序登录换取 openid 失败: ${data.errcode || ''} ${data.errmsg || ''}`);
    return { openid: data.openid, sessionKey: data.session_key };
  }

  return { oauthExchange, miniLogin };
}

module.exports = { createOAuth };
