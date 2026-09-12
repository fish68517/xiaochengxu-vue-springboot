'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { resolvePaymentConfig, loadPaymentMap } = require('../lib/payment-config.cjs');
const Pay = require('../lib/wechat-pay.cjs');

test('文件支付：解析、优先级、安全校验、签名与支付/退款通知', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pay-config-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  // Test-only credentials, generated locally; never use customer files.
  execFileSync('openssl', ['req','-x509','-newkey','rsa:2048','-nodes','-keyout',path.join(root,'key.pem'),'-out',path.join(root,'cert.pem'),'-days','1','-subj','/CN=123'], {stdio:'ignore', windowsHide:true});
  const platform = crypto.generateKeyPairSync('rsa', {modulusLength:2048});
  fs.writeFileSync(path.join(root,'pub.pem'), platform.publicKey.export({type:'spki',format:'pem'}));
  const cert = new crypto.X509Certificate(fs.readFileSync(path.join(root,'cert.pem')));
  const map = {production:{a:{entityId:'entity',secretRef:'secret/a',envPrefix:'PAY_A',mchid:'123',appId:'wxA',boundAppIds:['wxA']}}};
  const creds = {production:{PAY_A:{SERIAL_NO:cert.serialNumber,PRIVATE_KEY_FILE:'key.pem',MERCHANT_CERT_FILE:'cert.pem',APIV3_KEY:'a'.repeat(32),NOTIFY_URL:'https://example.com/pay-notify',PUBLIC_KEY_FILE:'pub.pem',PUBLIC_KEY_ID:'PUB_KEY_ID_TEST'}}};
  const write = (name,value) => fs.writeFileSync(path.join(root,name), JSON.stringify(value));
  write('wechat-pay.json',map); write('credentials.json',creds);
  const env = {APP_ENV:'production'};
  const resolve = extra => resolvePaymentConfig({brandCode:'a',env,root,...extra});
  const config = resolve();
  assert.throws(() => resolve({ appId: 'wxMini' }), /boundAppIds/);
  map.production.a.boundAppIds.push('wxMini'); write('wechat-pay.json', map);
  assert.equal(resolve({ appId: 'wxMini' }).snapshot.appId, 'wxMini');
  assert.equal(resolve({ appId: 'wxMini' }).env.WECHAT_PAY_APPID, 'wxMini');
  assert.equal(config.snapshot.mchid,'123');
  assert.equal(config.env.WECHAT_PAY_APIV3_KEY,'a'.repeat(32));
  assert.equal(resolve({env:{...env,PAY_A_APIV3_KEY:'b'.repeat(32)}}).env.WECHAT_PAY_APIV3_KEY,'b'.repeat(32));
  assert.throws(()=>resolve({env:{...env,PAY_A_APIV3_KEY:'short'}}),/32/);
  assert.throws(()=>resolve({env:{...env,PAY_A_APIV3_KEY:'   '}}),/FIELD/);
  assert.throws(()=>resolve({env:{...env,WECHAT_PAY_CONFIG_MAP:'broken'}}),/JSON/);
  assert.throws(()=>resolve({env:{...env,WECHAT_PAY_CONFIG_MAP:'{"production":{}}'}}),/品牌/);
  assert.throws(()=>resolve({secretRef:'other'}),/引用/);
  const other = structuredClone(map); other.production.b={...map.production.a,entityId:'other'};
  assert.throws(()=>resolve({env:{...env,WECHAT_PAY_CONFIG_MAP:JSON.stringify(other)}}),/主体/);
  const large = {production:Object.fromEntries(Array.from({length:51},(_,i)=>[i,map.production.a]))};
  assert.throws(()=>loadPaymentMap({...env,WECHAT_PAY_CONFIG_MAP:JSON.stringify(large)},root),/BRAND_LIMIT/);
  const original=creds.production.PAY_A.PRIVATE_KEY_FILE;
  for (const bad of ['../key.pem','C:/secret.pem','https://example.com/key.pem','missing.pem']) {
    creds.production.PAY_A.PRIVATE_KEY_FILE=bad;write('credentials.json',creds);
    assert.throws(()=>resolve(),/PATH|FILE_MISSING/);
  }
  creds.production.PAY_A.PRIVATE_KEY_FILE=original;write('credentials.json',creds);
  fs.writeFileSync(path.join(root,'credentials.json'),'broken');
  assert.throws(()=>resolve(),/JSON/);
  write('credentials.json',creds);
  fs.writeFileSync(path.join(root,'large.pem'),'x'.repeat(32769));
  creds.production.PAY_A.PRIVATE_KEY_FILE='large.pem';write('credentials.json',creds);
  assert.throws(()=>resolve(),/SIZE/);
  const outside=fs.mkdtempSync(path.join(os.tmpdir(),'pay-outside-'));
  t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));
  fs.writeFileSync(path.join(outside,'key.pem'),'not-a-key');
  fs.symlinkSync(outside,path.join(root,'link'),'junction');
  creds.production.PAY_A.PRIVATE_KEY_FILE='link/key.pem';write('credentials.json',creds);
  assert.throws(()=>resolve(),/PATH/);
  fs.unlinkSync(path.join(root,'link'));
  creds.production.PAY_A.PRIVATE_KEY_FILE=original;write('credentials.json',creds);
  assert.throws(()=>resolve({env:{...env,PAY_A_SERIAL_NO:'BAD'}}),/CERT_MISMATCH/);
  // Complete old environment config needs no files at all.
  const oldEnv={APP_ENV:'production',WECHAT_PAY_CONFIG_MAP:JSON.stringify(map)};
  for (const [k,v] of Object.entries(config.env)) if(k.startsWith('WECHAT_PAY_'))oldEnv[k.replace('WECHAT_PAY_','PAY_A_')]=v;
  assert.equal(resolve({env:oldEnv,root:path.join(root,'absent')}).snapshot.mchid,'123');

  function sign(body) {
    const timestamp=String(Math.floor(Date.now()/1000)),nonce='nonce';
    return {'Wechatpay-Timestamp':timestamp,'Wechatpay-Nonce':nonce,'Wechatpay-Serial':'PUB_KEY_ID_TEST','Wechatpay-Signature':crypto.sign('RSA-SHA256',Buffer.from(`${timestamp}\n${nonce}\n${body}\n`),platform.privateKey).toString('base64')};
  }
  const client=Pay.createClient({env:config.env,request:async request=>{
    assert.equal(request.headers['Wechatpay-Serial'],'PUB_KEY_ID_TEST');
    assert.match(request.headers.Authorization,new RegExp(cert.serialNumber));
    const body=JSON.stringify({prepay_id:'test-prepay'});
    return {status:200,data:JSON.parse(body),rawBody:body,headers:sign(body)};
  }});
  await client.jsapiPrepay({outTradeNo:'o1',amountFen:1,description:'test',openid:'test'});
  for(const [eventType, appid] of [['TRANSACTION.SUCCESS','wxA'],['REFUND.SUCCESS','wxA'],['TRANSACTION.SUCCESS','wxMini']]) {
    const notifyClient = appid === 'wxMini' ? Pay.createClient({env: resolve({appId: appid}).env}) : client;
    const resource={mchid:'123',appid,trade_state:'SUCCESS',out_trade_no:'o1',amount:{total:1,currency:'CNY'},refund_status:'SUCCESS'};
    const nonce='123456789012',aad='test';
    const cipher=crypto.createCipheriv('aes-256-gcm',Buffer.from('a'.repeat(32)),Buffer.from(nonce));cipher.setAAD(Buffer.from(aad));
    const encrypted=Buffer.concat([cipher.update(JSON.stringify(resource)),cipher.final(),cipher.getAuthTag()]);
    const body=JSON.stringify({id:'event',event_type:eventType,resource:{nonce,associated_data:aad,ciphertext:encrypted.toString('base64')}});
    const payload={body,headers:sign(body)};
    assert.equal((await notifyClient.handleNotify(payload)).eventType,eventType);
    await assert.rejects(()=>notifyClient.handleNotify({...payload,body:body+' '}),/验签/);
    // Exercise the actual operations callback's brand enumeration with file-backed loader.
    const modulePath=require.resolve('../lib/payment-config.cjs');
    const saved=require.cache[modulePath].exports;
    require.cache[modulePath].exports={...saved,loadPaymentMap:()=>loadPaymentMap(env,root),resolvePaymentConfig:args=>resolvePaymentConfig({...args,env,root})};
    const opsPath=require.resolve('../lib/payment-operations.cjs');delete require.cache[opsPath];
    const oldApp=process.env.APP_ENV;process.env.APP_ENV='production';
    try {
      const ops=require(opsPath);
      assert.equal(ops.clientFor({brandId:'a'}).snapshot.mchid,'123');
      const repo=require('../lib/repository.cjs').createMemoryRepository();
      await assert.rejects(()=>ops.payNotify(repo,payload,()=>{}),/支付通知关联订单不存在/);
    } finally { require.cache[modulePath].exports=saved;delete require.cache[opsPath];if(oldApp===undefined)delete process.env.APP_ENV;else process.env.APP_ENV=oldApp; }
  }
});
