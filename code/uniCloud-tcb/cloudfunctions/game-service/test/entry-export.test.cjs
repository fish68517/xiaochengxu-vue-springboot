'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const entry = require('../index.js');

test('game-service 同时兼容函数型 module.exports 与 exports.main 加载器', () => {
  assert.equal(typeof entry, 'function');
  assert.equal(entry.main, entry);
});
