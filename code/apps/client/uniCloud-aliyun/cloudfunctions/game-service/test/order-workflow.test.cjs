'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.SESSION_SECRET = 'workflow-test-only';
const services = require('../lib/services.cjs');
const { createMemoryRepository } = require('../lib/repository.cjs');
const { protectRepository } = require('../lib/privacy.cjs');

const cs = { userId: 'cs', role: 'CS', brandScopes: ['demo-a'] };
const worker = { userId: 'worker', role: 'WORKER', brandScopes: ['demo-a'] };
const admin = { userId: 'admin', role: 'ADMIN', brandScopes: ['*'] };
async function fixture() {
  const repo = createMemoryRepository();
  const get = repo.getById.bind(repo);
  repo.getById = async (...args) => structuredClone(await get(...args));
  const transaction = repo.transaction.bind(repo);
  repo.transaction = fn => transaction(tr => fn({ ...tr,
    find: async () => { throw new Error('Transaction must use document IDs'); },
    findOne: async () => { throw new Error('Transaction must use document IDs'); },
    updateWhere: async () => { throw new Error('Aliyun forbids where update'); },
  }));
  await repo.insert('brands', { _id: 'brand', brandId: 'demo-a', name: '星河服务' });
  await repo.insert('users', { _id: 'worker', role: 'WORKER', status: 'ACTIVE', acceptEnabled: true });
  await repo.insert('user_brand_roles', { _id: 'grant', userId: 'worker', brandId: 'demo-a', status: 'ACTIVE' });
  await repo.insert('orders', { _id: 'order', brandId: 'demo-a', customerId: 'customer-openid', orderNo: 'TEST-WORKFLOW',
    status: 'PENDING_ACCEPT', amountFen: 100, commission: { type: 'fixed', valueFen: 20 },
    guaranteedOutput: 3, outputUnit: '局', productSnapshot: { title: '服务' }, createdAt: Date.now(), version: 1 });
  await repo.insert('attachments', { _id: 'proof', bizId: 'order', brandId: 'demo-a', uploaderId: 'worker', bizType: 'complete_proof', fileID: 'test-file' });
  return repo;
}
const entry = { orderId: 'order', game: '王者荣耀', region: '微信区', serviceType: '陪玩', customerUid: 'uid', customerNickname: '客户', expectStartAt: Date.now() };

test('人工指派闭环：文档事务、拒绝回池、验收退回、结单只入账一次', async () => {
  const repo = await fixture();
  assert.equal((await services.listOrders(repo, {}, cs)).length, 1);
  assert.equal((await services.listOrders(repo, {}, { ...cs, brandScopes: ['default'] })).length, 0);
  await assert.rejects(()=>services.listOrders(repo,{brandId:'demo-a'},{...cs,brandScopes:['default']}),/BRAND_FORBIDDEN/);
  assert.equal((await services.enterOrder(repo, entry, cs)).status, 'PENDING_GRAB');
  assert.equal((await services.assignOrder(repo, { orderId: 'order', workerId: 'worker' }, cs)).status, 'ASSIGN_PENDING');
  const mine = (await services.listMyOrders(repo, {}, worker))[0];
  assert.equal(mine.customerUid, 'uid');
  assert.ok(mine.allowedActions.includes('acceptAssignment'));
  await services.rejectAssignment(repo, { assignmentId: 'order', reason: '时间冲突' }, worker);
  assert.equal((await repo.getById('orders', 'order')).status, 'PENDING_GRAB');
  await services.assignOrder(repo, { orderId: 'order', workerId: 'worker' }, admin);
  await assert.rejects(()=>services.acceptAssignment(repo,{assignmentId:'order'},{...worker,userId:'other'}),/不一致/);
  assert.equal((await services.acceptAssignment(repo, { assignmentId: 'order' }, worker)).status, 'IN_SERVICE');
  await assert.rejects(()=>services.submitCompletion(repo,{orderId:'order',actualOutput:3,attachmentIds:['missing']},worker),/凭证/);
  await services.submitCompletion(repo, { orderId: 'order', actualOutput: 3, attachmentIds: ['proof'] }, worker);
  await assert.rejects(()=>services.confirmSettlement(repo,{orderId:'order',customerConfirmed:true},cs),/验收/);
  await services.rejectCompletion(repo, { orderId: 'order', reason: '重新上传完整凭证' }, cs);
  assert.equal((await repo.getById('orders', 'order')).status, 'IN_SERVICE');
  await services.submitCompletion(repo, { orderId: 'order', actualOutput: 3, attachmentIds: ['proof'] }, worker);
  await services.verifyCompletion(repo, { orderId: 'order', note: '已核对' }, admin);
  const result = await services.confirmSettlement(repo, { orderId: 'order', customerConfirmed: true }, cs);
  assert.equal(result.status, 'SETTLED');
  await services.confirmSettlement(repo, { orderId: 'order', customerConfirmed: true }, admin);
  assert.equal((await repo.find('wallet_transactions', { orderId: 'order' })).length, 1);
  assert.equal((await repo.findOne('wallets', { ownerId: 'worker' })).availableFen, 20);
  assert.equal((await services.listMyOrders(repo, {}, { role: 'CUSTOMER', openid: 'customer-openid', brandScopes: ['demo-a'] }))[0].status, 'SETTLED');
});

test('抢单分支直接服务，重复抢单不能抢走订单', async () => {
  const repo = await fixture();
  await services.enterOrder(repo, entry, cs);
  const version = (await repo.getById('orders', 'order')).version;
  assert.equal((await services.grabOrder(repo, { orderId: 'order', expectedVersion: version }, worker)).status, 'IN_SERVICE');
  await assert.rejects(()=>services.grabOrder(repo,{orderId:'order',expectedVersion:version},worker),/CONFLICT/);
});

test('超过默认100条仍可查询新订单，隐私包装保留分页解密', async () => {
  const base = createMemoryRepository();
  const repo = protectRepository(base, { APP_ENV: 'development' });
  for(let i=0;i<140;i++) await repo.insert('orders', { _id: String(i).padStart(4,'0'), brandId: i===139?'demo-a':'other', status: 'PENDING_ACCEPT', contactPhone: '13800000000', createdAt: i });
  const find = base.find.bind(base);base.find=async(...args)=>(await find(...args)).slice(0,100);
  const rows = await services.listOrders(repo, {}, cs);
  assert.equal(rows.length, 1);assert.equal(rows[0]._id, '0139');assert.equal(rows[0].contactPhone, '13800000000');
});

test('结算事务失败回滚订单与钱包，重试成功后仍只入账一次', async () => {
  const repo=await fixture();
  await repo.updateById('orders','order',{status:'PENDING_CONFIRM',workerId:'worker',verificationStatus:'VERIFIED'});
  const transaction=repo.transaction.bind(repo);
  repo.transaction=fn=>transaction(tr=>fn({...tr,insert:async(name,doc)=>{if(name==='wallet_transactions')throw Error('ledger unavailable');return tr.insert(name,doc);}}));
  await assert.rejects(()=>services.confirmSettlement(repo,{orderId:'order',customerConfirmed:true},cs),/ledger unavailable/);
  assert.equal((await repo.getById('orders','order')).status,'PENDING_CONFIRM');
  assert.equal((await repo.findOne('wallets',{ownerId:'worker'})).availableFen,0);
  repo.transaction=transaction;
  await services.confirmSettlement(repo,{orderId:'order',customerConfirmed:true},cs);
  assert.equal((await repo.find('wallet_transactions',{})).length,1);
});
