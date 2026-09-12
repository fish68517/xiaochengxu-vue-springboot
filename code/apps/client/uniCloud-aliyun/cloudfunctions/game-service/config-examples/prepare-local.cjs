'use strict';
// Local deployment artifact generator. Never logs credential contents or overwrites a prepared directory.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
function main() {
  const source = process.argv[2];
  if (!source) throw new Error('需要本地凭据目录参数');
  const root = path.resolve(__dirname, '../private-config');
  if (fs.existsSync(root)) throw new Error('private-config 已存在，为防覆盖已停止');
  execFileSync('git', ['check-ignore', '--quiet', path.join(root, 'credentials.json')], {cwd:__dirname, stdio:'ignore'});
  const certPem = fs.readFileSync(path.join(source, 'apiclient_cert.pem'), 'utf8');
  const keyPem = fs.readFileSync(path.join(source, 'apiclient_key.pem'), 'utf8');
  const pubPem = fs.readFileSync(path.join(source, 'pub_key.pem'), 'utf8');
  const bytes = fs.readFileSync(path.join(source, '[c08819-2874].txt'));
  let text = new TextDecoder('utf-8').decode(bytes);
  if (text.includes('\ufffd')) text = new TextDecoder('gb18030').decode(bytes);
  const lines = text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const label = lines.findIndex(x=>/APIV3/i.test(x));
  const apiKey = lines[label + 1];
  const publicIds = text.match(/PUB_KEY_ID_[A-Za-z0-9]+/g) || [];
  const cert = new crypto.X509Certificate(certPem);
  if (label < 0 || !apiKey || Buffer.byteLength(apiKey)!==32 || publicIds.length!==1) throw new Error('TXT 凭据标识不明确');
  if (!cert.subject.split('\n').includes('CN=1116677386') || !cert.checkPrivateKey(crypto.createPrivateKey(keyPem))) throw new Error('商户证书与私钥不匹配');
  crypto.createPublicKey(pubPem);
  const prefix = 'merchants/1116677386/';
  // 本地allowlist不是微信侧绑定凭证，上线前必须在商户平台确认两个AppID的关联。
  const map = {production:{'demo-a':{entityId:'qingmu-huyu',secretRef:'secret://xinghe/wechat-pay/production',envPrefix:'PAY_XINGHE',appId:'wxc2da39cc9c2d35da',mchid:'1116677386',boundAppIds:['wxc2da39cc9c2d35da','wxe40bb897376601cc'],h5Enabled:false}}};
  const creds = {production:{PAY_XINGHE:{SERIAL_NO:cert.serialNumber,MERCHANT_CERT_FILE:prefix+'apiclient_cert.pem',PRIVATE_KEY_FILE:prefix+'apiclient_key.pem',APIV3_KEY:apiKey,NOTIFY_URL:'https://api.qmhyplayer.com/pay-notify',PUBLIC_KEY_FILE:prefix+'pub_key.pem',PUBLIC_KEY_ID:publicIds[0]}}};
  fs.mkdirSync(path.join(root,prefix),{recursive:true});
  for (const [name,body] of Object.entries({'apiclient_cert.pem':certPem,'apiclient_key.pem':keyPem,'pub_key.pem':pubPem})) fs.writeFileSync(path.join(root,prefix,name),body,{flag:'wx',mode:0o600});
  fs.writeFileSync(path.join(root,'wechat-pay.json'),JSON.stringify(map,null,2),{flag:'wx',mode:0o600});
  fs.writeFileSync(path.join(root,'credentials.json'),JSON.stringify(creds,null,2),{flag:'wx',mode:0o600});
  const result = require('../lib/payment-config.cjs').resolvePaymentConfig({brandCode:'demo-a',env:{APP_ENV:'production'},root});
  console.log(JSON.stringify({prepared:true,brandCode:result.snapshot.brandCode,merchant:result.snapshot.mchid,localValidation:'passed',deployed:false}));
}
try { main(); } catch (_) { console.error('准备失败：请核查输入文件、Git 忽略及目标目录；未输出敏感错误详情。');process.exitCode=1; }
