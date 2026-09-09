'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseBody, extractEnterTempSession } = require('../lib/handle-message.cjs');

test('解析 JSON 字符串 body', () => {
  const msg = parseBody({ body: '{"MsgType":"event","Event":"user_enter_tempsession","FromUserName":"openid-1","SessionFrom":"p-1"}' });
  assert.equal(msg.FromUserName, 'openid-1');
  assert.equal(msg.SessionFrom, 'p-1');
});

test('提取用户进入客服会话事件', () => {
  const info = extractEnterTempSession({ MsgType: 'event', Event: 'user_enter_tempsession', FromUserName: 'openid-1', SessionFrom: 'p-1' });
  assert.deepEqual(info, { openid: 'openid-1', sessionFrom: 'p-1' });
});

test('非进入会话事件返回 null', () => {
  assert.equal(extractEnterTempSession({ MsgType: 'text', Event: 'x' }), null);
});
