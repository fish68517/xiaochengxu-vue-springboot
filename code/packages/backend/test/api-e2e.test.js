import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';
import { startApiServer } from '../../../scripts/api-server.mjs';

test('HTTP API 端到端：登录->下单->支付->录入->抢单->完成->结单->提现->取消退款', async () => {
  const server = await startApiServer({ port: 0, seed: true });
  const base = `http://127.0.0.1:${server.port}`;
  const j = async (url, { method = 'GET', body, token } = {}) => {
    const res = await fetch(base + url, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}: ${JSON.stringify(data)}`);
    return data;
  };
  try {
    // 匿名访问受保护接口应被拒（admin kebab 路由 listOrders）。
    const anon = await fetch(base + '/api/orders');
    assert.equal(anon.status, 401);

    const admin = await j('/api/auth/login', { method: 'POST', body: { phone: '13800000000', password: 'admin123' } });
    const cs = await j('/api/auth/login', { method: 'POST', body: { phone: '13800000002', password: 'cs123' } });
    const worker = await j('/api/workerLogin', { method: 'POST', body: { phone: '13800000001', password: 'worker123' } });
    assert.ok(admin.token && cs.token && worker.token);

    // multipart 上传：api-server 解析 bizType + file（对齐云函数 upload.cjs）。
    const fd = new FormData();
    fd.append('bizType', 'complete_proof');
    fd.append('file', new Blob(['x'.repeat(64)], { type: 'application/octet-stream' }), 'proof.png');
    const upRes = await fetch(base + '/api/uploadFile', { method: 'POST', headers: { authorization: `Bearer ${worker.token}` }, body: fd });
    const upData = await upRes.json();
    assert.equal(upData.bizType, 'complete_proof');
    assert.ok(upData._id);

    const products = await j('/api/products');
    const product = products[0];

    const customer = await j('/api/miniLogin', { method: 'POST', body: { code: 'e2e' } });
    const tokenRes = await j('/api/h5Token', { method: 'POST', token: customer.token, body: { productId: product._id } });
    const order = await j('/api/createOrderFromH5', { method: 'POST', body: { h5Token: tokenRes.token, contactWechat: 'wx-e2e' } });
    assert.equal(order.amountFen, 10000);

    // 公开兜底查询：orderNo + 联系方式（无会话，client 统一 POST /api/<action>）。
    const q = await j('/api/queryOrderByNo', { method: 'POST', body: { orderNo: order.orderNo, contactWechat: 'wx-e2e' } });
    assert.equal(q.orderNo, order.orderNo);
    assert.equal(q.contactWechat, undefined);

    await j('/api/payNotify', { method: 'POST', body: { orderId: order.orderId, transactionId: 'txn-e2e-1' } });

    await j('/api/enterOrder', { method: 'POST', token: cs.token, body: { orderId: order.orderId, game: 'lol', region: '艾欧尼亚', serviceType: 'companion', customerUid: 'uid-1', customerNickname: '峡谷先锋', expectStartAt: Date.now() } });
    await j('/api/grabOrder', { method: 'POST', token: worker.token, body: { orderId: order.orderId } });
    await j('/api/submitCompletion', { method: 'POST', token: worker.token, body: { orderId: order.orderId, actualOutput: 10, attachmentIds: ['att-1'] } });
    await j('/api/verifyCompletion', { method: 'POST', token: cs.token, body: { orderId: order.orderId } });
    await j('/api/confirmSettlement', { method: 'POST', token: cs.token, body: { orderId: order.orderId, customerConfirmed: true } });

    const wallet = await j('/api/getWallet', { token: worker.token });
    assert.equal(wallet.availableFen, 2000);

    const withdrawal = await j('/api/applyWithdrawal', { method: 'POST', token: worker.token, body: { amountFen: 1000 } });
    assert.equal(withdrawal.status, 'SUBMITTED');
    await j('/api/withdrawals/review', { method: 'POST', token: admin.token, body: { withdrawalId: withdrawal._id } });
    await j('/api/withdrawals/approve', { method: 'POST', token: admin.token, body: { withdrawalId: withdrawal._id } });
    await j('/api/withdrawals/start-payment', { method: 'POST', token: admin.token, body: { withdrawalId: withdrawal._id, batchNo: 'BATCH-E2E' } });
    await j('/api/withdrawals/mark-paid', { method: 'POST', token: admin.token, body: { withdrawalId: withdrawal._id, batchNo: 'BATCH-E2E' } });

    // 第二单：取消退款链路。
    const token2 = await j('/api/h5Token', { method: 'POST', token: customer.token, body: { productId: product._id } });
    const order2 = await j('/api/createOrderFromH5', { method: 'POST', body: { h5Token: token2.token, contactWechat: 'wx-e2e' } });
    await j('/api/payNotify', { method: 'POST', body: { orderId: order2.orderId, transactionId: 'txn-e2e-2' } });
    const cancel = await j('/api/requestCancellation', { method: 'POST', token: cs.token, body: { orderId: order2.orderId, reason: '不要了' } });
    await j('/api/refunds/approve', { method: 'POST', token: admin.token, body: { refundId: cancel.refundId } });
    const detail = await j(`/api/getOrder?orderId=${order2.orderId}`, { token: cs.token });
    assert.equal(detail.order.status, 'CANCELLED');
  } finally {
    await server.close();
  }
});
