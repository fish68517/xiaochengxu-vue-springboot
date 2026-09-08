// e2e-smoke：本地镜像 HTTP API 全链路冒烟（Phase 3 波次 5b 收口版）。
// 链路（对齐 docs/API.md §H 与三端 api.js PATH 表）：
//   api-server 启动 → miniLogin → h5Token → createOrderFromH5 → getPaymentParams → payNotify
//   → enterOrder → grabOrder → submitCompletion → verifyCompletion → closeOrder → 佣金入账校验
//   → applyWithdrawal → 审核 → 批准 → 出款 → markWithdrawalPaid
// 全部经镜像 HTTP API（scripts/api-server.mjs 的 startApiServer），生产契约由云函数 game-service 承载。
// 运行：node scripts/e2e-smoke.mjs；输出 JSON 报告，落盘 TestEvidence/phase3-e2e-smoke.log。

// fail-closed 环境密钥注入（services.js 缺失即抛错，T0-02）：本地冒烟用测试密钥。
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'e2e-session-secret';
process.env.H5_TOKEN_SECRET = process.env.H5_TOKEN_SECRET || 'e2e-h5-secret';

import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { startApiServer } from './api-server.mjs';

// 单步封装：记录 name/ok/耗时，失败时记录错误并继续抛出让外层停止。
async function makeStep(steps) {
  return async function step(name, fn) {
    const started = Date.now();
    try {
      const value = await fn();
      steps.push({ name, ok: true, ms: Date.now() - started });
      return value;
    } catch (error) {
      steps.push({ name, ok: false, ms: Date.now() - started, error: String(error.message || error) });
      throw error;
    }
  };
}

// JSON HTTP 客户端（对齐 backend 测试的 j 辅助，token 走 Authorization: Bearer）。
function makeClient(base) {
  return async function j(url, { method = 'GET', body, token } = {}) {
    const res = await fetch(base + url, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(`${method} ${url} -> ${res.status}: ${JSON.stringify(data)}`);
      err.status = res.status;
      throw err;
    }
    return data;
  };
}

// 全链路冒烟（启动独立 api-server，种子含 admin/cs/worker/上架商品 + worker 实名已通过）。
export async function runFullJourney() {
  const server = await startApiServer({ port: 0, seed: true });
  const base = `http://127.0.0.1:${server.port}`;
  const j = makeClient(base);
  const steps = [];
  const step = await makeStep(steps);
  try {
    // 会话：admin/cs/worker 登录（worker 种子实名 APPROVED，满足提现前置）。
    const admin = await step('管理员登录 authLogin', () => j('/api/auth/login', { method: 'POST', body: { phone: '13800000000', password: 'admin123' } }));
    const cs = await step('客服登录 authLogin', () => j('/api/auth/login', { method: 'POST', body: { phone: '13800000002', password: 'cs123' } }));
    const worker = await step('接单人员登录 workerLogin', () => j('/api/workerLogin', { method: 'POST', body: { phone: '13800000001', password: 'worker123' } }));
    assert.ok(admin.token && cs.token && worker.token, '三端会话 token 均应存在');

    // 商品：公开列表取首件上架商品。
    const products = await step('商品列表 listProducts', () => j('/api/products'));
    const product = products[0];
    assert.ok(product && product._id, '应存在上架商品');

    // 小程序会话 → H5 下单 token（绑定 openid + productId）→ 创建待支付订单。
    const customer = await step('小程序登录 miniLogin', () => j('/api/miniLogin', { method: 'POST', body: { code: 'e2e-c1' } }));
    assert.ok(customer.token && customer.customerId, 'miniLogin 应返回 token 与 customerId');
    const h5 = await step('H5 下单 token h5Token', () => j('/api/h5Token', { method: 'POST', token: customer.token, body: { productId: product._id } }));
    const order = await step('H5 创建订单 createOrderFromH5', () => j('/api/createOrderFromH5', { method: 'POST', body: { h5Token: h5.token, contactWechat: 'wx-e2e' } }));
    assert.equal(order.amountFen, 10000, '订单金额应为 10000 分');
    assert.ok(order.orderId && order.orderNo, '下单应返回 orderId/orderNo');

    // 支付参数：本地默认 Mock；生产微信通道仍按 MWEB/JSAPI 返回。
    const pay = await step('获取支付参数 getPaymentParams', () => j('/api/getPaymentParams', { method: 'POST', token: customer.token, body: { orderId: order.orderId, payType: 'MWEB' } }));
    assert.ok(['MOCK', 'MWEB'].includes(pay.payType), '应返回 Mock 或微信 MWEB 通道');

    // Mock 显式确认；微信模式模拟支付回调。两者共用独立支付单成功入口。
    const notify = pay.payType === 'MOCK'
      ? await step('Mock 支付确认 confirmMockPayment', () => j('/api/confirmMockPayment', { method: 'POST', token: customer.token, body: { paymentId: pay.paymentId } }))
      : await step('支付回调 payNotify', () => j('/api/payNotify', { method: 'POST', body: { orderId: order.orderId, transactionId: 'txn-e2e-smoke' } }));
    assert.equal(notify.code, 'SUCCESS', '支付回调应返回 SUCCESS');

    // 录入 → 待抢单；抢单 → 服务中；完成申请 → 待确认；结单 → 已结单。
    const entered = await step('客服录入 enterOrder', () => j('/api/enterOrder', { method: 'POST', token: cs.token, body: { orderId: order.orderId, game: 'lol', region: '艾欧尼亚', serviceType: 'companion', customerUid: 'uid-e2e', customerNickname: '测试客户', expectStartAt: Date.now() } }));
    assert.equal(entered.status, 'PENDING_GRAB', '录入后应进入待抢单');
    const grabbed = await step('抢单 grabOrder', () => j('/api/grabOrder', { method: 'POST', token: worker.token, body: { orderId: order.orderId } }));
    assert.equal(grabbed.status, 'IN_SERVICE', '抢单后应进入服务中');
    const completed = await step('完成申请 submitCompletion', () => j('/api/submitCompletion', { method: 'POST', token: worker.token, body: { orderId: order.orderId, actualOutput: 10, attachmentIds: ['att-e2e'] } }));
    assert.equal(completed.status, 'PENDING_CONFIRM', '完成申请后应进入待确认');
    const verified = await step('验收 verifyCompletion', () => j('/api/verifyCompletion', { method: 'POST', token: cs.token, body: { orderId: order.orderId, note: '冒烟验收通过' } }));
    assert.equal(verified.verificationStatus, 'VERIFIED', '验收后应为 VERIFIED');
    const settled = await step('结单 closeOrder', () => j('/api/closeOrder', { method: 'POST', token: cs.token, body: { orderId: order.orderId, customerConfirmed: true } }));
    assert.equal(settled.status, 'SETTLED', '结单后应进入已结单');

    // 佣金入账：抽成 20% × 10000 分 = 2000 分。
    const wallet = await step('佣金入账校验 getWallet', () => j('/api/getWallet', { token: worker.token }));
    assert.equal(wallet.availableFen, 2000, '结单后钱包可用余额应为 2000 分');

    // 提现：提交 → 审核 → 批准 → 出款 → 已打款。
    const withdrawal = await step('申请提现 applyWithdrawal', () => j('/api/applyWithdrawal', { method: 'POST', token: worker.token, body: { amountFen: 1000 } }));
    assert.equal(withdrawal.status, 'SUBMITTED', '提现申请后应进入已提交');
    await step('开始审核 startWithdrawalReview', () => j('/api/withdrawals/review', { method: 'POST', token: admin.token, body: { withdrawalId: withdrawal._id } }));
    await step('批准提现 approveWithdrawal', () => j('/api/withdrawals/approve', { method: 'POST', token: admin.token, body: { withdrawalId: withdrawal._id } }));
    await step('开始出款 startWithdrawalPayment', () => j('/api/withdrawals/start-payment', { method: 'POST', token: admin.token, body: { withdrawalId: withdrawal._id, batchNo: 'BATCH-SMOKE' } }));
    const paid = await step('提现打款 markWithdrawalPaid', () => j('/api/withdrawals/mark-paid', { method: 'POST', token: admin.token, body: { withdrawalId: withdrawal._id, batchNo: 'BATCH-SMOKE' } }));
    assert.equal(paid.status, 'PAID', '打款后提现单应为已打款');

    return { ok: true, steps, order: { orderId: order.orderId, orderNo: order.orderNo }, withdrawalId: withdrawal._id };
  } finally {
    await server.close();
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  mkdirSync('TestEvidence', { recursive: true });
  const report = await runFullJourney();
  const line = `${JSON.stringify(report, null, 2)}\n`;
  writeFileSync('TestEvidence/phase3-e2e-smoke.log', line);
  console.log(line);
  if (!report.ok) process.exit(1);
}
