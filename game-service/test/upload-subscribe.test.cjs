'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { BIZ_TYPE_ROLES, ALLOWED_BIZ_TYPES, isBizTypeAllowedForRole, buildWatermarkText, createUploadClient } = require('../lib/upload.cjs');
const { consumeQuota, refundQuota, createSubscribeClient } = require('../lib/subscribe.cjs');
const { createMemoryRepository } = require('../lib/repository.cjs');

test('biz_type 权限映射:complete_proof/id_card=WORKER,dispute=CUSTOMER', () => {
  assert.deepEqual(BIZ_TYPE_ROLES.complete_proof, ['WORKER']);
  assert.deepEqual(BIZ_TYPE_ROLES.id_card, ['WORKER']);
  assert.deepEqual(BIZ_TYPE_ROLES.dispute, ['CUSTOMER']);
  assert.deepEqual(ALLOWED_BIZ_TYPES, ['complete_proof', 'id_card', 'dispute']);
  assert.equal(isBizTypeAllowedForRole('complete_proof', 'WORKER'), true);
  assert.equal(isBizTypeAllowedForRole('id_card', 'WORKER'), true);
  assert.equal(isBizTypeAllowedForRole('dispute', 'CUSTOMER'), true);
  assert.equal(isBizTypeAllowedForRole('complete_proof', 'CUSTOMER'), false);
  assert.equal(isBizTypeAllowedForRole('dispute', 'WORKER'), false);
  assert.equal(isBizTypeAllowedForRole('unknown', 'WORKER'), false);
});

test('水印文本:接单人员姓名 + 上传时间', () => {
  const ts = new Date(2026, 7, 19, 10, 5).getTime(); // 本地时间 2026-08-19 10:05
  assert.equal(buildWatermarkText({ uploaderName: '张三', uploadedAt: ts }), '张三 2026-08-19 10:05');
  assert.equal(buildWatermarkText({ uploaderName: '', uploadedAt: ts }), '接单人员 2026-08-19 10:05');
});

test('订阅额度:未用额度扣减,已用不重复扣,回补清除 usedAt', () => {
  const quota = { _id: 'subq-1', usedAt: null };
  const c = consumeQuota(quota, 123);
  assert.equal(c.ok, true);
  assert.equal(c.quota.usedAt, 123);
  const c2 = consumeQuota(c.quota, 456); // 已用额度再次扣减失败
  assert.equal(c2.ok, false);
  assert.equal(c2.quota.usedAt, 123);
  const r = refundQuota(c.quota);
  assert.equal(r.ok, true);
  assert.equal(r.quota.usedAt, null);
  assert.equal(quota.usedAt, null); // 纯函数:不改原对象
});

test('uploadAttachment:id_card 落库带水印/encrypted,storageKey 幂等', async () => {
  const calls = [];
  const fakeUniCloud = {
    uploadFile: async ({ cloudPath, fileContent }) => {
      calls.push({ cloudPath, content: fileContent.toString() });
      return { fileID: `file-${cloudPath}` };
    },
    getTempFileURL: async ({ fileList }) => ({ fileList: fileList.map((f) => ({ fileID: f, tempFileURL: `https://signed/${f}` })) }),
  };
  const client = createUploadClient({ uniCloud: fakeUniCloud, now: () => 1754539200000 });
  const repo = createMemoryRepository();
  const res = await client.uploadAttachment(repo, {
    bizType: 'id_card', bizId: 'w1', fileName: 'front.jpg', content: Buffer.from('abc').toString('base64'),
    storageKey: 'idcard-w1', uploaderId: 'w1', uploaderName: '张三',
  });
  assert.equal(res.storageKey, 'idcard-w1');
  assert.equal(res.url, 'https://signed/file-id_card/w1/idcard-w1-front.jpg');
  const doc = await repo.findOne('attachments', { storageKey: 'idcard-w1' });
  assert.equal(doc.bizType, 'id_card');
  assert.equal(doc.encrypted, true);
  assert.ok(doc.watermarkText.includes('张三'));
  assert.equal(doc.uploaderId, 'w1');
  // storageKey 唯一幂等:重复上传返回原记录,不再走对象存储
  const again = await client.uploadAttachment(repo, { bizType: 'id_card', storageKey: 'idcard-w1', uploaderId: 'w1' });
  assert.equal(again.attachmentId, res.attachmentId);
  assert.equal(calls.length, 1);
});

test('sendWithQuota:1 授权 1 下发,扣减并写 SUBSCRIBE_MSG SENT 留痕', async () => {
  const repo = createMemoryRepository();
  await repo.insert('subscribe_quota', { _id: 'subq-1', customerId: 'c1', templateKey: 'ORDER_STATUS', orderId: 'o1', usedAt: null });
  await repo.insert('customers', { _id: 'c1', openid: 'openid-c1' });
  const client = createSubscribeClient({
    env: { WECHAT_MP_APPID: 'wx', WECHAT_MP_SECRET: 'sec', WECHAT_MP_TEMPLATE_IDS: { ORDER_STATUS: 'TPL123' } },
    request: async ({ url }) => (url.includes('/cgi-bin/token') ? { access_token: 'tok', expires_in: 7200 } : { errcode: 0 }),
    now: () => 1000,
  });
  const res = await client.sendWithQuota(repo, { receiverId: 'c1', templateKey: 'ORDER_STATUS', data: { thing1: { value: '已结单' } } });
  assert.equal(res.sent, true);
  assert.equal((await repo.getById('subscribe_quota', 'subq-1')).usedAt, 1000);
  const notif = await repo.findOne('notifications', { channel: 'SUBSCRIBE_MSG', status: 'SENT' });
  assert.equal(notif.template, 'ORDER_STATUS');
  assert.equal(notif.payload.templateId, 'TPL123');
});

test('sendWithQuota:下发失败回补额度并写 FAILED 留痕', async () => {
  const repo = createMemoryRepository();
  await repo.insert('subscribe_quota', { _id: 'subq-1', customerId: 'c1', templateKey: 'ORDER_STATUS', orderId: 'o1', usedAt: null });
  await repo.insert('customers', { _id: 'c1', openid: 'openid-c1' });
  const client = createSubscribeClient({
    env: { WECHAT_MP_APPID: 'wx', WECHAT_MP_SECRET: 'sec' },
    request: async ({ url }) => (url.includes('/cgi-bin/token') ? { access_token: 'tok', expires_in: 7200 } : { errcode: 43101 }),
    now: () => 2000,
  });
  const res = await client.sendWithQuota(repo, { receiverId: 'c1', templateKey: 'ORDER_STATUS', data: {} });
  assert.equal(res.sent, false);
  assert.equal((await repo.getById('subscribe_quota', 'subq-1')).usedAt, null); // 失败回补
  const notif = await repo.findOne('notifications', { channel: 'SUBSCRIBE_MSG', status: 'FAILED' });
  assert.ok(notif);
});

test('sendWithQuota:无可用额度/未配置时静默跳过并写 SKIPPED 留痕', async () => {
  const repo = createMemoryRepository();
  const client = createSubscribeClient({ env: {}, now: () => 3000 });
  const res = await client.sendWithQuota(repo, { receiverId: 'c1', templateKey: 'ORDER_STATUS', data: {} });
  assert.equal(res.sent, false);
  assert.equal(res.reason, 'NOT_CONFIGURED');
  assert.ok(await repo.findOne('notifications', { channel: 'SUBSCRIBE_MSG', status: 'SKIPPED' }));
});
