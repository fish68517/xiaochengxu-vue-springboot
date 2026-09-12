import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/session.js',import.meta.url),'utf8');
const { createSessionStore, assertLoginIdentity }=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};};

test('两个工作台标签页分别登录客服和工作人员，互不覆盖',()=>{
  const cs=createSessionStore(storage());const worker=createSessionStore(storage());
  cs.saveLogin({token:'test-cs',user:{role:'CS'}});
  worker.saveLogin({token:'test-worker',user:{role:'WORKER'}});
  assert.equal(cs.get('token'),'test-cs');assert.equal(cs.get('user').role,'CS');
  worker.clear();assert.equal(cs.get('token'),'test-cs');
});
test('不读取旧通用登录键；同标签页账号切换原子清理旧权限与筛选',()=>{
  const s=storage();s.setItem('token','legacy-worker');
  const state=createSessionStore(s);assert.equal(state.get('token'),undefined);
  state.set('accessProfile',{roles:['CS']});state.set('__workbench_active_brand__','old-brand');
  state.saveLogin({token:'test-worker',user:{role:'WORKER'}});
  assert.equal(state.get('accessProfile'),undefined);assert.equal(state.get('__workbench_active_brand__'),undefined);
  assert.equal(createSessionStore(s).get('token'),'test-worker');
});
test('客服登录不能保存工作人员身份，存储禁用时内存降级仍可退出',()=>{
  assert.throws(()=>assertLoginIdentity({token:'test',user:{role:'WORKER'}},'cs'),/不是客服/);
  assert.doesNotThrow(()=>assertLoginIdentity({token:'test',user:{role:'CUSTOMER_SERVICE'}},'cs'));
  assert.throws(()=>assertLoginIdentity({token:'test',user:{role:'CS'}},'worker'),/不是工作人员/);
  const state=createSessionStore({getItem(){throw Error('disabled');},setItem(){throw Error('disabled');}});
  state.saveLogin({token:'test-cs',user:{role:'CS'}});assert.equal(state.get('token'),'test-cs');
  state.clear();assert.equal(state.get('token'),undefined);
});
test('账号切换后丢弃旧请求响应，写请求不会自动重试',async(t)=>{
  const state=createSessionStore(storage());state.saveLogin({token:'old',user:{role:'CS'}});
  globalThis.__testWorkbenchSession=state;
  let finish;let calls=0;
  globalThis.uniCloud={callFunction:()=>{calls++;return new Promise(resolve=>{finish=resolve;});}};
  t.after(()=>{delete globalThis.__testWorkbenchSession;delete globalThis.uniCloud;});
  const apiSource=fs.readFileSync(new URL('../src/api.js',import.meta.url),'utf8').replace("import { sessionStore } from './session.js';",'const sessionStore=globalThis.__testWorkbenchSession;');
  const { api }=await import(`data:text/javascript;base64,${Buffer.from(apiSource).toString('base64')}`);
  const request=api.enterOrder({orderId:'test-order'});
  state.saveLogin({token:'new',user:{role:'WORKER'}});finish({result:{status:'PENDING_GRAB'}});
  await assert.rejects(request,e=>e.code==='SESSION_CHANGED');assert.equal(calls,1);
});
