'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const Pay = require('../lib/wechat-pay.cjs');

const APIV3_KEY = '0123456789abcdef0123456789abcdef'; // 32 字节

function generateRsa() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

function encryptResource(plainObj, { key = APIV3_KEY, nonce = '0123456789ab', associatedData = 'transaction' } = {}) {
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(nonce));
  cipher.setAAD(Buffer.from(associatedData));
  const data = Buffer.concat([cipher.update(JSON.stringify(plainObj)), cipher.final()]);
  return {
    algorithm: 'AEAD_AES_256_GCM',
    nonce,
    associated_data: associatedData,
    ciphertext: Buffer.concat([data, cipher.getAuthTag()]).toString('base64'),
  };
}

function signMessage({ privateKey, message }) {
  return crypto.sign('RSA-SHA256', Buffer.from(message), privateKey).toString('base64');
}

function makeEnv(keys) {
  return {
    WECHAT_PAY_MCHID: '1900001001',
    WECHAT_PAY_SERIAL_NO: 'MERCHANT-SERIAL-1',
    WECHAT_PAY_PRIVATE_KEY: keys.privateKey,
    WECHAT_PAY_APIV3_KEY: APIV3_KEY,
    WECHAT_PAY_APPID: 'wxe40bb897376601cc',
    WECHAT_PAY_NOTIFY_URL: 'https://api.qmhyplayer.com/pay-notify',
  };
}

test('buildAuthorization：Authorization 头可被商户公钥验签', () => {
  const keys = generateRsa();
  const timestamp = '1700000000';
  const nonce = 'abc123';
  const url = 'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi';
  const body = JSON.stringify({ appid: 'wx1', mchid: '1900001001' });
  const auth = Pay.buildAuthorization({
    method: 'POST', url, body, mchid: '1900001001', serialNo: 'SERIAL1',
    privateKey: keys.privateKey, timestamp, nonce,
  });
  assert.ok(auth.startsWith('WECHATPAY2-SHA256-RSA2048 '));
  assert.match(auth, /mchid="1900001001"/);
  assert.match(auth, /serial_no="SERIAL1"/);
  const sig = auth.match(/signature="([^"]+)"/)[1];
  const message = `POST\n/v3/pay/transactions/jsapi\n${timestamp}\n${nonce}\n${body}\n`;
  assert.ok(crypto.verify('RSA-SHA256', Buffer.from(message), keys.publicKey, Buffer.from(sig, 'base64')));
});

test('buildJsapiPayParams：小程序支付参数 paySign 可验签', () => {
  const keys = generateRsa();
  const params = Pay.buildJsapiPayParams({
    appid: 'wxe40bb897376601cc', prepayId: 'wx301234567890abcdef',
    privateKey: keys.privateKey, timestamp: '1700000000', nonce: 'xyz789',
  });
  assert.equal(params.appId, 'wxe40bb897376601cc');
  assert.equal(params.package, 'prepay_id=wx301234567890abcdef');
  assert.equal(params.signType, 'RSA');
  const message = `${params.appId}\n${params.timeStamp}\n${params.nonceStr}\n${params.package}\n`;
  assert.ok(crypto.verify('RSA-SHA256', Buffer.from(message), keys.publicKey, Buffer.from(params.paySign, 'base64')));
});

test('decryptResource：AES-256-GCM 解密回调资源，篡改即失败', () => {
  const payload = { out_trade_no: 'GS1', transaction_id: '4200001' };
  const resource = encryptResource(payload);
  const decrypted = Pay.decryptResource({ resource, apiV3Key: APIV3_KEY });
  assert.deepEqual(decrypted, payload);

  const tampered = { ...resource, ciphertext: Buffer.from(resource.ciphertext, 'base64').reverse().toString('base64') };
  assert.throws(() => Pay.decryptResource({ resource: tampered, apiV3Key: APIV3_KEY }));
});

test('verifyNotifySignature：验签通过与失败', () => {
  const keys = generateRsa();
  const timestamp = '1700000000';
  const nonce = 'n1';
  const body = '{"a":1}';
  const signature = signMessage({ privateKey: keys.privateKey, message: `${timestamp}\n${nonce}\n${body}\n` });
  assert.equal(Pay.verifyNotifySignature({ timestamp, nonce, body, signature, publicKey: keys.publicKey }), true);
  assert.equal(Pay.verifyNotifySignature({ timestamp, nonce, body: '{"a":2}', signature, publicKey: keys.publicKey }), false);
});

test('isConfigured：缺任一配置即未配置', () => {
  const keys = generateRsa();
  const full = makeEnv(keys);
  assert.equal(Pay.isConfigured(full), true);
  for (const missing of ['WECHAT_PAY_MCHID', 'WECHAT_PAY_SERIAL_NO', 'WECHAT_PAY_PRIVATE_KEY', 'WECHAT_PAY_APIV3_KEY', 'WECHAT_PAY_APPID']) {
    const env = { ...full };
    delete env[missing];
    assert.equal(Pay.isConfigured(env), false, `${missing} 缺失应视为未配置`);
  }
});

test('createClient：私钥环境变量支持 \\n 转义单行存储', async () => {
  const keys = generateRsa();
  const escaped = keys.privateKey.replace(/\n/g, '\\n');
  assert.ok(escaped.includes('\\n'));
  const client = Pay.createClient({
    env: { ...makeEnv(keys), WECHAT_PAY_PRIVATE_KEY: escaped },
    request: async () => ({ status: 200, data: { prepay_id: 'p1' } }),
    now: () => 1700000000000,
  });
  const prepayId = await client.jsapiPrepay({ outTradeNo: 'GS1', amountFen: 1, description: 'x', openid: 'o1' });
  assert.equal(prepayId, 'p1'); // 若未还原换行，RSA 签名会抛错
});

test('createClient.jsapiPrepay：下单请求签名与报文正确', async () => {
  const keys = generateRsa();
  const calls = [];
  const request = async (opt) => {
    calls.push(opt);
    return { status: 200, data: { prepay_id: 'prepay-1' } };
  };
  const client = Pay.createClient({ env: makeEnv(keys), request, now: () => 1700000000000 });
  const prepayId = await client.jsapiPrepay({ outTradeNo: 'GS1', amountFen: 10000, description: '陪玩一小时', openid: 'o1' });
  assert.equal(prepayId, 'prepay-1');

  const call = calls[0];
  assert.equal(call.method, 'POST');
  assert.equal(call.url, 'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi');
  const reqBody = JSON.parse(call.body);
  assert.deepEqual(reqBody, {
    appid: 'wxe40bb897376601cc', mchid: '1900001001', description: '陪玩一小时',
    out_trade_no: 'GS1', notify_url: 'https://api.qmhyplayer.com/pay-notify',
    amount: { total: 10000, currency: 'CNY' }, payer: { openid: 'o1' },
  });
  const auth = call.headers.Authorization;
  const timestamp = auth.match(/timestamp="([^"]+)"/)[1];
  const nonce = auth.match(/nonce_str="([^"]+)"/)[1];
  const sig = auth.match(/signature="([^"]+)"/)[1];
  const message = `POST\n/v3/pay/transactions/jsapi\n${timestamp}\n${nonce}\n${call.body}\n`;
  assert.ok(crypto.verify('RSA-SHA256', Buffer.from(message), keys.publicKey, Buffer.from(sig, 'base64')));
  assert.equal(timestamp, '1700000000');
});

test('createClient.jsapiPayParams：基于 prepayId 生成小程序参数', async () => {
  const keys = generateRsa();
  const client = Pay.createClient({ env: makeEnv(keys), request: async () => ({ status: 200, data: {} }), now: () => 1700000000000 });
  const params = await client.jsapiPayParams({ prepayId: 'wx301234567890abcdef' });
  assert.equal(params.appId, 'wxe40bb897376601cc');
  const message = `${params.appId}\n${params.timeStamp}\n${params.nonceStr}\n${params.package}\n`;
  assert.ok(crypto.verify('RSA-SHA256', Buffer.from(message), keys.publicKey, Buffer.from(params.paySign, 'base64')));
});

test('createClient.h5Prepay：H5 下单返回 h5_url 并携带场景信息', async () => {
  const keys = generateRsa();
  const calls = [];
  const client = Pay.createClient({
    env: makeEnv(keys),
    request: async (opt) => { calls.push(opt); return { status: 200, data: { h5_url: 'https://wx.tenpay.com/checkmweb?x=1' } }; },
  });
  const h5Url = await client.h5Prepay({ outTradeNo: 'GS2', amountFen: 5000, description: '陪玩半小时', clientIp: '1.2.3.4' });
  assert.equal(h5Url, 'https://wx.tenpay.com/checkmweb?x=1');
  const call = calls[0];
  assert.equal(call.url, 'https://api.mch.weixin.qq.com/v3/pay/transactions/h5');
  const reqBody = JSON.parse(call.body);
  assert.deepEqual(reqBody.scene_info, { payer_client_ip: '1.2.3.4', h5_info: { type: 'Wap' } });
  assert.deepEqual(reqBody.amount, { total: 5000, currency: 'CNY' });
});

test('createClient.refund：申请退款报文正确并归一化返回', async () => {
  const keys = generateRsa();
  const calls = [];
  const client = Pay.createClient({
    env: makeEnv(keys),
    request: async (opt) => { calls.push(opt); return { status: 200, data: { refund_id: 'refund-1', status: 'PROCESSING' } }; },
  });
  const res = await client.refund({ outTradeNo: 'GS1', outRefundNo: 'RGS1', totalFen: 10000, refundFen: 10000, reason: '协商退款' });
  assert.deepEqual(res, { status: 'PROCESSING', refundId: 'refund-1' });
  const call = calls[0];
  assert.equal(call.url, 'https://api.mch.weixin.qq.com/v3/refund/domestic/refunds');
  const reqBody = JSON.parse(call.body);
  assert.deepEqual(reqBody, {
    out_trade_no: 'GS1', out_refund_no: 'RGS1', reason: '协商退款',
    notify_url: 'https://api.qmhyplayer.com/pay-notify',
    amount: { refund: 10000, total: 10000, currency: 'CNY' },
  });
});

test('createClient.refund：微信返回 SUCCESS 时归一化', async () => {
  const keys = generateRsa();
  const client = Pay.createClient({
    env: makeEnv(keys),
    request: async () => ({ status: 200, data: { refund_id: 'refund-2', status: 'SUCCESS' } }),
  });
  const res = await client.refund({ outTradeNo: 'GS1', outRefundNo: 'RGS1', totalFen: 10000, refundFen: 10000 });
  assert.deepEqual(res, { status: 'SUCCESS', refundId: 'refund-2' });
});

test('createClient：支付接口返回错误时抛出带 code 的错误', async () => {
  const keys = generateRsa();
  const client = Pay.createClient({
    env: makeEnv(keys),
    request: async () => ({ status: 400, data: { code: 'PARAM_ERROR', message: '参数错误' } }),
  });
  await assert.rejects(() => client.jsapiPrepay({ outTradeNo: 'GS1', amountFen: 1, description: 'x', openid: 'o1' }), /PARAM_ERROR.*参数错误/);
});

test('createClient.handleNotify：支付成功回调验签解密并归一化，证书只拉取一次', async () => {
  const keys = generateRsa();
  const platformKeys = generateRsa();
  let certFetches = 0;
  const request = async (opt) => {
    if (opt.url.includes('/v3/certificates')) {
      certFetches += 1;
      return {
        status: 200,
        data: {
          data: [{
            serial_no: 'PLATFORM-1',
            effective_time: '2023-01-01T00:00:00+08:00',
            expire_time: '2030-01-01T00:00:00+08:00',
            encrypt_certificate: encryptResource({ serial_no: 'PLATFORM-1', certificate: platformKeys.publicKey }, { key: APIV3_KEY }),
          }],
        },
      };
    }
    throw new Error(`unexpected request: ${opt.url}`);
  };
  const client = Pay.createClient({ env: makeEnv(keys), request, now: () => 1700000000000 });

  const notifyBody = JSON.stringify({
    id: 'evt-1', create_time: '2023-11-19T12:00:00+08:00', resource_type: 'encrypt-resource',
    event_type: 'TRANSACTION.SUCCESS', summary: '支付成功',
    resource: encryptResource({
      mchid: '1900001001', out_trade_no: 'GS1', transaction_id: '4200001', trade_state: 'SUCCESS',
      success_time: '2023-11-19T12:00:01+08:00', payer: { openid: 'o1' },
      amount: { total: 10000, payer_total: 10000, currency: 'CNY', payer_currency: 'CNY' },
    }, { key: APIV3_KEY }),
  });
  const timestamp = '1700000000';
  const nonce = 'notify-nonce';
  const signature = signMessage({ privateKey: platformKeys.privateKey, message: `${timestamp}\n${nonce}\n${notifyBody}\n` });

  const event = await client.handleNotify({
    headers: { 'wechatpay-timestamp': timestamp, 'wechatpay-nonce': nonce, 'wechatpay-signature': signature, 'wechatpay-serial': 'PLATFORM-1' },
    body: notifyBody,
  });
  assert.equal(event.eventType, 'TRANSACTION.SUCCESS');
  assert.equal(event.outTradeNo, 'GS1');
  assert.equal(event.transactionId, '4200001');
  assert.equal(event.amount.total, 10000);
  assert.equal(event.payerOpenid, 'o1');

  // 第二次回调：证书命中缓存，不再拉取
  const notifyBody2 = JSON.stringify({
    id: 'evt-2', event_type: 'REFUND.SUCCESS', resource_type: 'encrypt-resource', create_time: '2023-11-19T12:10:00+08:00',
    resource: encryptResource({
      mchid: '1900001001', out_trade_no: 'GS1', out_refund_no: 'RGS1', refund_id: 'refund-1',
      refund_status: 'SUCCESS', success_time: '2023-11-19T12:10:01+08:00',
      amount: { total: 10000, refund: 10000, payer_total: 10000, payer_refund: 10000 },
    }, { key: APIV3_KEY }),
  });
  const timestamp2 = '1700000060';
  const nonce2 = 'notify-nonce-2';
  const signature2 = signMessage({ privateKey: platformKeys.privateKey, message: `${timestamp2}\n${nonce2}\n${notifyBody2}\n` });
  const refundEvent = await client.handleNotify({
    headers: { 'wechatpay-timestamp': timestamp2, 'wechatpay-nonce': nonce2, 'wechatpay-signature': signature2, 'wechatpay-serial': 'PLATFORM-1' },
    body: notifyBody2,
  });
  assert.equal(refundEvent.eventType, 'REFUND.SUCCESS');
  assert.equal(refundEvent.outRefundNo, 'RGS1');
  assert.equal(refundEvent.refundId, 'refund-1');
  assert.equal(certFetches, 1);
});

test('createClient.handleNotify：验签失败拒绝，过期回调拒绝', async () => {
  const keys = generateRsa();
  const platformKeys = generateRsa();
  const request = async (opt) => {
    if (opt.url.includes('/v3/certificates')) {
      return {
        status: 200,
        data: { data: [{ serial_no: 'PLATFORM-2', encrypt_certificate: encryptResource({ certificate: platformKeys.publicKey }, { key: APIV3_KEY }) }] },
      };
    }
    throw new Error(`unexpected request: ${opt.url}`);
  };
  const client = Pay.createClient({ env: makeEnv(keys), request, now: () => 1700000000000 });
  const body = JSON.stringify({ id: 'evt-x', event_type: 'TRANSACTION.SUCCESS', resource: encryptResource({ out_trade_no: 'GS1' }, { key: APIV3_KEY }) });
  const timestamp = '1700000000';
  const nonce = 'n1';

  const badSig = signMessage({ privateKey: platformKeys.privateKey, message: `${timestamp}\n${nonce}\n{"tampered":true}\n` });
  await assert.rejects(() => client.handleNotify({
    headers: { 'wechatpay-timestamp': timestamp, 'wechatpay-nonce': nonce, 'wechatpay-signature': badSig, 'wechatpay-serial': 'PLATFORM-2' },
    body,
  }), /验签失败/);

  const goodSig = signMessage({ privateKey: platformKeys.privateKey, message: `${timestamp}\n${nonce}\n${body}\n` });
  await assert.rejects(() => client.handleNotify({
    headers: { 'wechatpay-timestamp': '1690000000', 'wechatpay-nonce': nonce, 'wechatpay-signature': goodSig, 'wechatpay-serial': 'PLATFORM-2' },
    body,
  }), /过期/);
});

test('createClient.handleNotify：未知事件类型返回忽略标记', async () => {
  const keys = generateRsa();
  const platformKeys = generateRsa();
  const request = async () => ({
    status: 200,
    data: { data: [{ serial_no: 'PLATFORM-3', encrypt_certificate: encryptResource({ certificate: platformKeys.publicKey }, { key: APIV3_KEY }) }] },
  });
  const client = Pay.createClient({ env: makeEnv(keys), request, now: () => 1700000000000 });
  const body = JSON.stringify({ id: 'evt-y', event_type: 'COUPON.USE', resource: encryptResource({ coupon_id: 'c1' }, { key: APIV3_KEY }) });
  const timestamp = '1700000000';
  const nonce = 'n1';
  const signature = signMessage({ privateKey: platformKeys.privateKey, message: `${timestamp}\n${nonce}\n${body}\n` });
  const event = await client.handleNotify({
    headers: { 'wechatpay-timestamp': timestamp, 'wechatpay-nonce': nonce, 'wechatpay-signature': signature, 'wechatpay-serial': 'PLATFORM-3' },
    body,
  });
  assert.equal(event.eventType, 'IGNORED');
});
