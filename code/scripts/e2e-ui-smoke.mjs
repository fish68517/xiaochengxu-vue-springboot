// 三端 UI 冒烟：起本地静态服务器 + api-server 镜像，驱动客户、工作台和管理端正式模块，输出步骤断言报告。
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { startApiServer } from './api-server.mjs';

mkdirSync('TestEvidence', { recursive: true });
process.env.SESSION_SECRET ||= 'ui-smoke-session-secret';
process.env.H5_TOKEN_SECRET ||= 'ui-smoke-h5-token-secret';

function buildH5(app) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['run', 'build:h5'], {
    cwd: join(process.cwd(), 'apps', app),
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, VITE_API_BASE: 'http://127.0.0.1:4176' },
  });
  if (result.status !== 0) throw new Error(`${app} H5 构建失败\n${result.stdout || ''}${result.stderr || ''}`);
}

async function launchBrowser() {
  const attempts = [
    () => chromium.launch(),
    () => chromium.launch({ channel: 'msedge' }),
    () => chromium.launch({ channel: 'chrome' }),
  ];
  let lastError;
  for (const run of attempts) {
    try { return await run(); } catch (error) { lastError = error; }
  }
  throw lastError;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
function startStatic(root, port, stripPrefix = '') {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      let pathname = decodeURIComponent(url.pathname);
      if (stripPrefix && pathname.startsWith(stripPrefix)) pathname = pathname.slice(stripPrefix.length) || '/index.html';
      if (pathname === '/') pathname = '/index.html';
      const filePath = normalize(join(root, pathname));
      if (!filePath.startsWith(normalize(root))) { res.writeHead(403); res.end('forbidden'); return; }
      const data = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
      res.end(data);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

const steps = [];
const log = (step) => { steps.push({ name: step, ok: true }); console.log(step); };
const fail = (step, e) => { steps.push({ name: step, ok: false, error: String(e) }); console.log('FAIL', step, e); };

async function callApi(path, { body, token } = {}) {
  const response = await fetch(`http://127.0.0.1:4176${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} -> ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

buildH5('client');
buildH5('workbench');
buildH5('admin');
const browser = await launchBrowser();
const servers = [];
const apiServer = await startApiServer({ port: 4176, seed: true });
try {
  servers.push(await startStatic(join(process.cwd(), 'apps/client/dist/build/h5'), 4173));
  servers.push(await startStatic(join(process.cwd(), 'apps/workbench/dist/build/h5'), 4174, '/workbench'));
  servers.push(await startStatic(join(process.cwd(), 'apps/admin/dist/build/h5'), 4175, '/admin'));

  const client = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await client.goto('http://127.0.0.1:4173/#/pages/index/index', { waitUntil: 'networkidle' });
    log('客户：打开首页');
    const clientViewport = await client.evaluate(() => ({
      viewportMeta: document.querySelector('meta[name="viewport"]')?.content || '',
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      placeholders: [...document.images].filter((img) => img.src.includes('placeholder-image.svg')).length,
      brokenImages: [...document.images].filter((img) => img.complete && img.naturalWidth === 0).length,
    }));
    if (!clientViewport.viewportMeta.includes('width=device-width')) throw new Error('客户 H5 缺少移动端 viewport');
    if (clientViewport.scrollWidth > clientViewport.clientWidth + 1) throw new Error(`客户首页发生整页横向滚动：${JSON.stringify(clientViewport)}`);
    if (clientViewport.placeholders > 0 || clientViewport.brokenImages > 0) throw new Error(`客户首页仍有占位或破损图片：${JSON.stringify(clientViewport)}`);
    log('客户：移动端 viewport、横向滚动与图片资源检查通过');
    await client.screenshot({ path: join(process.cwd(), 'TestEvidence', 'client-390-home.png'), fullPage: true });
    await client.locator('.product-card').first().click();
    await client.waitForTimeout(500);
    if (client.url().includes('product')) { log('客户：点击商品进入详情'); } else { fail('客户：点击商品进入详情', new Error(client.url())); }
    await client.screenshot({ path: join(process.cwd(), 'TestEvidence', 'client-02-product.png') });

    // H5 冒烟没有 wx.login，直接通过同一 HTTP API 建立测试客户会话并写入 uni-app 存储。
    const customer = await callApi('/api/miniLogin', { body: { code: 'seed-c1', brandCode: 'demo-a' } });
    const storedCustomer = await client.evaluate((session) => {
      if (globalThis.uni && typeof globalThis.uni.setStorageSync === 'function') {
        globalThis.uni.setStorageSync('__client_session_v1__', session);
        return globalThis.uni.getStorageSync('__client_session_v1__');
      } else {
        // uni-h5 对非字符串值使用 {type,data} 包装；保持与 setStorageSync 的持久化格式一致。
        localStorage.setItem('__client_session_v1__', JSON.stringify({ type: 'object', data: session }));
        return session;
      }
    }, { token: customer.token, customerId: customer.customerId, brandId: customer.brandId, isVip: !!customer.isVip, ts: Date.now() });
    if (!storedCustomer || !storedCustomer.token) throw new Error('客户会话写入浏览器存储失败');

    // Batch 2：使用真实短期 token 打开 H5 下单页，验证表单不是静态占位。
    const products = await callApi('/api/listProducts', { body: { brandCode: 'demo-a' } });
    const orderProduct = Array.isArray(products) ? products[0] : null;
    if (!orderProduct) throw new Error('H5 下单页验证缺少可售商品');
    const orderToken = await callApi('/api/h5Token', {
      token: customer.token,
      body: { productId: orderProduct.id || orderProduct._id },
    });
    await client.goto(`http://127.0.0.1:4173/#/pages/h5-order/index?token=${encodeURIComponent(orderToken.token)}`, { waitUntil: 'networkidle' });
    await client.waitForTimeout(400);
    if (await client.locator('.form-card').count() !== 1) throw new Error('H5 下单页未显示联系信息表单');
    await client.screenshot({ path: join(process.cwd(), 'TestEvidence', 'client-03-h5-order.png'), fullPage: true });
    log('客户：H5 下单页加载真实商品和动态表单');

    await client.goto('http://127.0.0.1:4173/#/pages/order/list', { waitUntil: 'networkidle' });
    await client.waitForTimeout(800);
    log('客户：打开订单列表');
    const orderCard = client.locator('.order-card').first();
    if (await orderCard.count()) {
      await orderCard.click();
      await client.waitForTimeout(500);
      if (client.url().includes('order/detail')) { log('客户：点击订单进入详情'); } else { fail('客户：点击订单进入详情', new Error(client.url())); }
    } else {
      const stateText = await client.locator('.state-box').first().textContent().catch(() => '');
      fail('客户：订单列表应显示种子订单', new Error(`未找到 .order-card；页面状态：${stateText || '无'}`));
    }
    await client.screenshot({ path: join(process.cwd(), 'TestEvidence', 'client-04-order-detail.png') });
    await client.goto('http://127.0.0.1:4173/#/pages/mine/index', { waitUntil: 'networkidle' });
    await client.screenshot({ path: join(process.cwd(), 'TestEvidence', 'client-390-mine.png'), fullPage: true });
    log('客户：个人中心无红叉占位资源');
  } finally { await client.close(); }

  // 将种子待受理订单录入抢单池，保证工作台抢单测试有确定前置数据。
  const cs = await callApi('/api/auth/login', { body: { phone: '13800000002', password: 'cs123' } });
  const orders = await callApi('/api/listOrders', { token: cs.token, body: { brandId: 'demo-a' } });
  const pendingOrder = orders.find((item) => item.status === 'PENDING_ACCEPT');
  if (!pendingOrder) throw new Error('未找到待录入种子订单');
  await callApi('/api/enterOrder', {
    token: cs.token,
    body: {
      orderId: pendingOrder.id || pendingOrder._id,
      game: 'lol', region: '艾欧尼亚', serviceType: 'companion',
      customerUid: 'seed-ui-customer', customerNickname: 'UI 冒烟客户', expectStartAt: Date.now(),
    },
  });
  const seededWorker = await callApi('/api/workerLogin', { body: { phone: '13800000001', password: 'worker123' } });
  await callApi('/api/changePassword', {
    token: seededWorker.token,
    body: { oldPassword: 'worker123', newPassword: 'worker1234' },
  });

  const wb = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await wb.goto('http://127.0.0.1:4174/workbench/#/pages/login/index', { waitUntil: 'networkidle' });
    log('工作台：打开登录页');
    await wb.screenshot({ path: join(process.cwd(), 'TestEvidence', 'workbench-1440-login.png'), fullPage: true });
    await wb.locator('.role-item').nth(1).click();
    const inputs = wb.locator('.input input');
    if (await inputs.count() < 2) throw new Error('登录输入框数量不足');
    await inputs.nth(0).fill('13800000001');
    await inputs.nth(1).fill('worker1234');
    log('工作台：填写手机号和密码');
    await wb.locator('.login-btn').click();
    await wb.waitForTimeout(800);
    if (wb.url().includes('hall')) { log('工作台：登录成功进入抢单大厅'); } else { fail('工作台：登录进入大厅', new Error(wb.url())); }
    await wb.screenshot({ path: join(process.cwd(), 'TestEvidence', 'workbench-02-hall.png') });
    await wb.setViewportSize({ width: 390, height: 844 });
    const wbOverflow = await wb.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
    if (!wbOverflow) throw new Error('工作台移动端发生整页横向滚动');
    await wb.screenshot({ path: join(process.cwd(), 'TestEvidence', 'workbench-390-hall.png'), fullPage: true });
    await wb.setViewportSize({ width: 1440, height: 900 });
    const grabButton = wb.locator('.order-card .primary-btn').first();
    if (await grabButton.count()) {
      await grabButton.click();
      await wb.waitForTimeout(700);
      const remaining = await wb.locator('.order-card .primary-btn').count();
      if (remaining === 0) { log('工作台：点击抢单按钮，抢单成功列表清空'); } else { fail('工作台：点击抢单按钮', new Error('抢单后仍显示可抢订单')); }
      await wb.waitForTimeout(1700);
    } else {
      const stateText = await wb.locator('.empty, .error-box').first().textContent().catch(() => '');
      fail('工作台：抢单大厅应显示待抢订单', new Error(`未找到抢单按钮；页面状态：${stateText || '无'}`));
    }
    await wb.goto('http://127.0.0.1:4174/workbench/#/pages/worker/orders', { waitUntil: 'networkidle' });
    await wb.waitForTimeout(400);
    if (await wb.locator('.order-list .order-card').count() !== 1) throw new Error('接单人员我的订单未展示当前任务');
    await wb.screenshot({ path: join(process.cwd(), 'TestEvidence', 'workbench-1440-worker-orders.png'), fullPage: true });
    await wb.goto('http://127.0.0.1:4174/workbench/#/pages/worker/wallet', { waitUntil: 'networkidle' });
    await wb.waitForTimeout(400);
    if (await wb.locator('.summary-grid .summary-card').count() !== 3) throw new Error('接单人员钱包三项摘要未渲染');
    await wb.screenshot({ path: join(process.cwd(), 'TestEvidence', 'workbench-1440-worker-wallet.png'), fullPage: true });
    await wb.goto('http://127.0.0.1:4174/workbench/#/pages/worker/profile', { waitUntil: 'networkidle' });
    await wb.waitForTimeout(400);
    if (await wb.locator('.profile-grid').count() !== 1) throw new Error('接单人员实名资料页面未渲染');
    const profileText = await wb.locator('.identity-panel').innerText();
    if (profileText.includes('13800000001')) throw new Error('接单人员资料页泄露完整手机号');
    await wb.screenshot({ path: join(process.cwd(), 'TestEvidence', 'workbench-1440-worker-profile.png'), fullPage: true });
    await wb.setViewportSize({ width: 390, height: 844 });
    const profileOverflow = await wb.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
    if (!profileOverflow) throw new Error('接单人员资料页移动端发生整页横向滚动');
    await wb.screenshot({ path: join(process.cwd(), 'TestEvidence', 'workbench-390-worker-profile.png'), fullPage: true });
    log('工作台：接单人员订单、钱包、实名资料与移动端布局通过');
  } finally { await wb.close(); }

  const csPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await csPage.goto('http://127.0.0.1:4174/workbench/#/pages/login/index', { waitUntil: 'networkidle' });
    const inputs = csPage.locator('.input input');
    await inputs.nth(0).fill('13800000002');
    await inputs.nth(1).fill('cs123');
    await csPage.locator('.login-btn').click();
    await csPage.waitForTimeout(800);
    if (!csPage.url().includes('cs/workbench')) throw new Error(`客服登录后页面错误：${csPage.url()}`);
    await csPage.screenshot({ path: join(process.cwd(), 'TestEvidence', 'workbench-1440-cs-dashboard.png'), fullPage: true });
    log('工作台：客服登录进入待办工作台');
    await csPage.goto(`http://127.0.0.1:4174/workbench/#/pages/cs/order-detail?orderId=${encodeURIComponent(pendingOrder.id || pendingOrder._id)}`, { waitUntil: 'networkidle' });
    await csPage.waitForTimeout(400);
    if (await csPage.locator('.order-overview').count() !== 1) throw new Error('客服订单详情未渲染订单概览');
    await csPage.screenshot({ path: join(process.cwd(), 'TestEvidence', 'workbench-1440-cs-order-detail.png'), fullPage: true });
    await callApi('/api/requestRefund', { token: cs.token, body: { orderId: pendingOrder.id || pendingOrder._id, type: 'partial_progress', reason: 'UI Batch 4 审批视图验证' } });
    await csPage.goto('http://127.0.0.1:4174/workbench/#/pages/cs/approvals?tab=refunds', { waitUntil: 'networkidle' });
    await csPage.waitForTimeout(400);
    if (await csPage.locator('.approval-card').count() !== 1) throw new Error('客服退款审批视图未展示待审批申请');
    await csPage.screenshot({ path: join(process.cwd(), 'TestEvidence', 'workbench-1440-cs-approvals.png'), fullPage: true });
    await csPage.setViewportSize({ width: 390, height: 844 });
    const approvalsOverflow = await csPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
    if (!approvalsOverflow) throw new Error('客服审批页移动端发生整页横向滚动');
    await csPage.screenshot({ path: join(process.cwd(), 'TestEvidence', 'workbench-390-cs-approvals.png'), fullPage: true });
    log('工作台：客服订单详情、退款审批与移动端布局通过');
  } finally { await csPage.close(); }

  const admin = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  try {
    await admin.goto('http://127.0.0.1:4175/admin/#/pages/login/index', { waitUntil: 'networkidle' });
    await admin.screenshot({ path: join(process.cwd(), 'TestEvidence', 'admin-1366-login.png'), fullPage: true });
    const inputs = admin.locator('.input input');
    await inputs.nth(0).fill('13800000000'); await inputs.nth(1).fill('admin123');
    await admin.locator('.login-btn').click(); await admin.waitForTimeout(800);
    if (admin.url().includes('dashboard')) log('管理端：登录进入品牌范围 Dashboard'); else fail('管理端：登录进入 Dashboard', new Error(admin.url()));
    if (await admin.locator('.admin-shell .sidebar').count() !== 1) throw new Error('管理端统一 AdminShell 未渲染');
    const dashboardLayout = await admin.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (dashboardLayout.scrollWidth > dashboardLayout.clientWidth + 1) throw new Error(`管理端 Dashboard 发生整页横向滚动：${JSON.stringify(dashboardLayout)}`);
    await admin.screenshot({ path: join(process.cwd(), 'TestEvidence', 'admin-1366-dashboard.png'), fullPage: true });
    log('管理端：统一侧栏、顶部栏和 Dashboard 布局通过');
    const modules = [
      ['orders/index', '订单管理'], ['products/index', '商品管理'], ['brands/index', '品牌配置'], ['accounts/index', '账号管理'],
      ['ledger/index', '佣金账本与退款追佣'], ['wallets/index', '钱包管理'], ['withdrawals/index', '提现审批与出款'],
      ['disputes/index', '异议仲裁'], ['reports/index', '报表'], ['reviews/index', '审核兼容入口'],
      ['access/index', '用户—角色—品牌权限'], ['audit/index', '审计日志'], ['dicts/index', '字典管理'],
      ['configs/index', '配置管理'], ['vips/index', 'VIP 名单'],
    ];
    for (const [path, label] of modules) {
      await admin.goto(`http://127.0.0.1:4175/admin/#/pages/${path}`, { waitUntil: 'networkidle' });
      await admin.waitForTimeout(300);
      if (await admin.locator('.admin-shell .sidebar').count() && await admin.locator('.title, .head-title, .page-title, .breadcrumb').count()) log(`管理端：${label}模块可访问`); else fail(`管理端：${label}模块可访问`, new Error(admin.url()));
    }
    await admin.goto('http://127.0.0.1:4175/admin/#/pages/audit/index', { waitUntil: 'networkidle' });
    await admin.screenshot({ path: join(process.cwd(), 'TestEvidence', 'admin-1366-audit.png'), fullPage: true });
    await admin.goto('http://127.0.0.1:4175/admin/#/pages/wallets/index', { waitUntil: 'networkidle' });
    await admin.screenshot({ path: join(process.cwd(), 'TestEvidence', 'admin-1366-wallets.png'), fullPage: true });
    await admin.evaluate(() => {
      localStorage.setItem('accessProfile', JSON.stringify({ type: 'object', data: { roles: ['FINANCE_REVIEWER'], brandScopes: ['demo-a'], visibleMenus: ['dashboard', 'orders', 'ledger', 'wallets', 'withdrawals', 'reports'] } }));
      localStorage.setItem('user', JSON.stringify({ type: 'object', data: { role: 'FINANCE_REVIEWER', nickname: '财务审核员' } }));
    });
    await admin.goto('http://127.0.0.1:4175/admin/#/pages/orders/index', { waitUntil: 'networkidle' });
    const sidebarText = await admin.locator('.sidebar').innerText();
    if (!sidebarText.includes('提现审批') || sidebarText.includes('品牌配置') || sidebarText.includes('角色与权限')) throw new Error(`管理端角色菜单过滤错误：${sidebarText}`);
    await admin.screenshot({ path: join(process.cwd(), 'TestEvidence', 'admin-1366-finance-menu.png'), fullPage: true });
    log('管理端：财务角色菜单按后端 visibleMenus 收敛');
    await admin.evaluate(() => localStorage.clear());
    await admin.goto('http://127.0.0.1:4175/admin/#/pages/login/index', { waitUntil: 'networkidle' });
    const reloginInputs = admin.locator('input');
    await reloginInputs.nth(0).fill('13800000000'); await reloginInputs.nth(1).fill('admin123');
    await admin.locator('.login-btn').click(); await admin.waitForTimeout(800);
    if (!admin.url().includes('dashboard')) throw new Error(`管理端管理员重新登录失败：${admin.url()}`);
    await admin.setViewportSize({ width: 1920, height: 1080 });
    await admin.goto('http://127.0.0.1:4175/admin/#/pages/orders/index', { waitUntil: 'networkidle' });
    const restoredSidebarText = await admin.locator('.sidebar').innerText();
    if (!restoredSidebarText.includes('品牌配置') || !restoredSidebarText.includes('角色与权限')) throw new Error(`管理端管理员菜单恢复失败：${restoredSidebarText}`);
    const wideLayout = await admin.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (wideLayout.scrollWidth > wideLayout.clientWidth + 1) throw new Error(`管理端 1920 宽屏发生整页横向滚动：${JSON.stringify(wideLayout)}`);
    await admin.screenshot({ path: join(process.cwd(), 'TestEvidence', 'admin-1920-orders.png'), fullPage: true });
    await admin.goto('http://127.0.0.1:4175/admin/#/pages/products/index', { waitUntil: 'networkidle' });
    await admin.screenshot({ path: join(process.cwd(), 'TestEvidence', 'admin-1920-products.png'), fullPage: true });
    await admin.goto('http://127.0.0.1:4175/admin/#/pages/brands/index', { waitUntil: 'networkidle' });
    await admin.screenshot({ path: join(process.cwd(), 'TestEvidence', 'admin-1920-brands.png'), fullPage: true });
    log('管理端：Batch 5-6 全模块与 1366×768、1920×1080 布局冒烟完成');
  } finally { await admin.close(); }
} catch (error) {
  fail('UI 冒烟执行异常', error && (error.stack || error.message || error));
} finally {
  const ok = steps.length > 0 && steps.every((s) => s.ok !== false);
  const report = { ok, generatedAt: new Date().toISOString(), steps };
  writeFileSync(join(process.cwd(), 'TestEvidence', 'phase1-e2e-ui-smoke.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!ok) process.exitCode = 1;
  await browser.close();
  for (const server of servers) server.close();
  await apiServer.close();
}
