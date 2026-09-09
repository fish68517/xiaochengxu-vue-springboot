'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const runner = require('../index.js');

test('system-runner：校验调度密钥、限制 action，并只向 game-service 发送 HMAC', async () => {
  const beforeScheduler = process.env.SCHEDULER_SECRET;
  const beforeInternal = process.env.INTERNAL_SECRET;
  const beforeCloud = global.uniCloud;
  process.env.SCHEDULER_SECRET = 'scheduler-secret-at-least-32-chars-x';
  process.env.INTERNAL_SECRET = 'internal-secret-at-least-32-chars-xx';
  let captured;
  global.uniCloud = {
    callFunction: async (request) => {
      captured = request;
      return { result: { marked: 0 } };
    },
  };
  try {
    await assert.rejects(() => runner.main({ action: 'timeoutMarkPool', schedulerSecret: 'wrong' }), /非法系统任务调用/);
    await assert.rejects(() => runner.main({ action: 'transferNotify', schedulerSecret: process.env.SCHEDULER_SECRET }), /action 不允许/);
    const result = await runner.main({ action: 'timeoutMarkPool', payload: {}, schedulerSecret: process.env.SCHEDULER_SECRET });
    assert.deepEqual(result, { marked: 0 });
    assert.equal(captured.name, 'game-service');
    assert.equal(captured.data.action, 'timeoutMarkPool');
    assert.ok(captured.data.internalAuth.signature);
    assert.equal(Object.hasOwn(captured.data, 'internalSecret'), false);
  } finally {
    if (beforeScheduler === undefined) delete process.env.SCHEDULER_SECRET; else process.env.SCHEDULER_SECRET = beforeScheduler;
    if (beforeInternal === undefined) delete process.env.INTERNAL_SECRET; else process.env.INTERNAL_SECRET = beforeInternal;
    global.uniCloud = beforeCloud;
  }
});

