'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createOAuth } = require('../lib/oauth.cjs');

test('阿里云服务号网页授权读取 OAUTH_APPID/OAUTH_SECRET', async () => {
  let requestedUrl = '';
  const oauth = createOAuth({
    env: { OAUTH_APPID: 'wx-official-test', OAUTH_SECRET: 'official-test-secret' },
    request: async (url) => {
      requestedUrl = url;
      return { openid: 'official-openid' };
    },
  });

  assert.deepEqual(await oauth.oauthExchange('oauth-code'), { openid: 'official-openid' });
  const url = new URL(requestedUrl);
  assert.equal(url.searchParams.get('appid'), 'wx-official-test');
  assert.equal(url.searchParams.get('secret'), 'official-test-secret');
  assert.equal(url.searchParams.get('code'), 'oauth-code');
});

test('阿里云服务号网页授权缺少变量时不降级到小程序账号', async () => {
  const oauth = createOAuth({ env: { WECHAT_MP_APPID: 'wx-mini-test', WECHAT_MP_SECRET: 'mini-test-secret' } });
  await assert.rejects(() => oauth.oauthExchange('oauth-code'), /服务号网页授权未配置/);
});
