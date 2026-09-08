// scripts/demo-second-brand.mjs
// Phase 5：演示性第二品牌验证 —— 证明「新增一个客户小程序 = 纯配置、零代码」。
// 链路（全部经镜像 HTTP API，scripts/api-server.mjs 的 startApiServer）：
//   api-server 启动（seed）→ 管理员登录 → 未知 appId 回退内置默认品牌
//   → saveBrandConfig 创建第二品牌 → 缺 brandId 校验 → getBrandConfig 按 appId 解析第二品牌
//   → listBrands 含第二品牌且 status=ON → domain resolveBrand/missingKeys 缺键回退。
// 运行：node scripts/demo-second-brand.mjs；输出 PASS/FAIL 落盘 TestEvidence/phase5-demo-brand.log。
// 注意：镜像 seed 的 brands 集合为空（api-server.mjs seedDb 不写 brands），
//   「未知 appId 回退内置默认品牌(primary=#ff2442)」仅在写入任何品牌前成立
//   （写入后无 isDefault 品牌时 resolveBrand 会回退首个 ON 品牌），故该断言放在 save 之前。

// fail-closed 环境密钥注入（services.js 缺失即抛错，T0-02）：本地演示用测试密钥。
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'demo-session-secret';
process.env.H5_TOKEN_SECRET = process.env.H5_TOKEN_SECRET || 'demo-h5-secret';

import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
import { startApiServer } from './api-server.mjs';
import { resolveBrand, missingKeys } from '../packages/domain/src/brand.js';

// 第二品牌配置（纯配置：新增一个客户小程序只改这段数据，不改任何代码）。
const SECOND_BRAND = {
  brandId: 'demo-brand-b',
  appId: 'wx-demo-brand-0002',
  name: '演示第二品牌',
  logo: 'https://example.com/demo-logo-b.png',
  themeTokens: {
    primary: '#1e88e5',   // 蓝
    secondary: '#43a047', // 绿
    bg: '#fafafa',
    text: '#111',
    border: '#ddd',
    radius: '10rpx',
  },
  copy: {
    headerTitle: '第二品牌首页',
    noticeBody: '第二品牌专属活动',
    searchPlaceholder: '搜索第二品牌商品',
    bannerHot: '第二品牌热卖',
    bannerAll: '全部服务',
    sectionTitle: '精选服务',
    detailTitle: '服务详情',
    detailAction: '马上开玩',
    detailRule: '服务规则',
  },
  banners: ['https://example.com/banner-b.png'],
};

// 客户端内置默认文案（代表 apps/client/src/static/content-assets.js 的 clientorderCopy），
// 供 domain missingKeys 模拟「第二品牌缺键 → 回退默认文案」。
const CLIENT_DEFAULT_COPY = {
  headerTitle: '默认首页',
  headerMenu: '默认菜单',
  noticeHot: '默认热卖',
  noticeBody: '默认活动',
  searchPlaceholder: '搜索商品',
  bannerHot: '默认热卖',
  bannerAll: '全部',
  sectionTitle: '精选服务',
  detailTitle: '商品详情',
  detailAction: '立即下单',
  detailRule: '服务规则',
};

// 内置默认品牌主题 primary（与 services.js DEFAULT_THEME 一致）。
const DEFAULT_PRIMARY = '#ff2442';

// HTTP 客户端：非 2xx 抛错（happy path 用）。
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

// HTTP 客户端：返回 { status, data }，不抛错（业务错误断言用）。
function makeRawClient(base) {
  return async function raw(url, { method = 'GET', body, token } = {}) {
    const res = await fetch(base + url, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };
}

async function run() {
  const server = await startApiServer({ port: 0, seed: true });
  const base = `http://127.0.0.1:${server.port}`;
  const j = makeClient(base);
  const raw = makeRawClient(base);

  const steps = [];
  const lines = [];
  let pass = 0;
  let fail = 0;

  const step = async (name, fn) => {
    const started = Date.now();
    try {
      const value = await fn();
      steps.push({ name, ok: true, ms: Date.now() - started });
      pass += 1;
      lines.push(`[PASS] ${name} (${Date.now() - started}ms)`);
      return value;
    } catch (error) {
      const msg = String((error && error.message) || error);
      steps.push({ name, ok: false, ms: Date.now() - started, error: msg });
      fail += 1;
      lines.push(`[FAIL] ${name} — ${msg}`);
      throw error;
    }
  };

  try {
    lines.push(`[INFO] api-server 就绪 http://127.0.0.1:${server.port} (seed=true)`);

    // 1. 管理员登录（镜像 seed 管理员账号，实查 api-server.mjs seedDb）。
    const admin = await step('管理员登录 authLogin（ADMIN）', async () => {
      const r = await j('/api/auth/login', { method: 'POST', body: { phone: '13800000000', password: 'admin123' } });
      assert.ok(r.token, '应返回 token');
      assert.equal(r.role, 'ADMIN', '登录角色应为 ADMIN');
      return r;
    });

    // 2. 未知 appId → 回退内置默认品牌（brands 集合为空，实查：defaultBrandConfig）。
    await step('getBrandConfig(wx-unknown-0000) 回退内置默认品牌', async () => {
      const r = await j('/api/getBrandConfig?appId=wx-unknown-0000');
      assert.equal(r.brandId, 'default', '未知 appId 应回退默认品牌');
      assert.equal(r.themeTokens.primary, DEFAULT_PRIMARY, `默认 primary 应为 ${DEFAULT_PRIMARY}`);
      assert.equal(r.name, '默认品牌', '默认品牌名应为「默认品牌」');
    });

    // 3. saveBrandConfig 创建第二品牌（纯配置，无代码改动）。
    await step('saveBrandConfig 创建第二品牌 demo-brand-b', async () => {
      const r = await j('/api/brands', { method: 'POST', token: admin.token, body: { brand: SECOND_BRAND } });
      assert.equal(r.brandId, 'demo-brand-b', 'brandId 应为 demo-brand-b');
      assert.equal(r.appId, 'wx-demo-brand-0002', 'appId 应为 wx-demo-brand-0002');
      assert.equal(r.status, 'ON', '状态应为 ON');
      assert.equal(r.themeTokens.primary, '#1e88e5', 'primary 应为 #1e88e5');
      assert.equal(r.copy.headerTitle, '第二品牌首页', 'headerTitle 应为「第二品牌首页」');
    });

    // 4. saveBrandConfig 校验：缺 brandId 的写 → 业务错误返回（HTTP 400 BAD_REQUEST）。
    await step('saveBrandConfig 缺 brandId → 业务错误 BAD_REQUEST', async () => {
      const res = await raw('/api/brands', { method: 'POST', token: admin.token, body: { brand: { appId: 'wx-invalid', name: '缺brandId' } } });
      assert.equal(res.status, 400, '应返回 HTTP 400');
      assert.equal(res.data.ok, false, '应为业务失败');
      assert.equal(res.data.code, 'BAD_REQUEST', '错误码应为 BAD_REQUEST');
      assert.equal(res.data.message, 'brandId 不能为空', '错误消息应提示 brandId 不能为空');
    });

    // 5. 按 appId 精确解析第二品牌（与默认品牌不同）。
    await step('getBrandConfig(wx-demo-brand-0002) 解析第二品牌', async () => {
      const r = await j('/api/getBrandConfig?appId=wx-demo-brand-0002');
      assert.equal(r.brandId, 'demo-brand-b', 'brandId 应为 demo-brand-b');
      assert.equal(r.themeTokens.primary, '#1e88e5', 'primary 应为 #1e88e5');
      assert.equal(r.copy.headerTitle, '第二品牌首页', 'headerTitle 应为「第二品牌首页」');
      assert.notEqual(r.themeTokens.primary, DEFAULT_PRIMARY, '第二品牌 primary 应区别于默认品牌');
    });

    // 6. listBrands(ADMIN) 含 demo-brand-b 且 status=ON。
    await step('listBrands(ADMIN) 含 demo-brand-b 且 status=ON', async () => {
      const r = await j('/api/brands', { token: admin.token });
      assert.ok(Array.isArray(r), '应返回数组');
      const b = r.find((x) => x.brandId === 'demo-brand-b');
      assert.ok(b, '应包含 demo-brand-b');
      assert.equal(b.status, 'ON', 'demo-brand-b 状态应为 ON');
      assert.equal(b.appId, 'wx-demo-brand-0002', 'demo-brand-b appId 应为 wx-demo-brand-0002');
    });

    // 7. domain resolveBrand：精确匹配第二品牌 + 未知 appId 回退 isDefault 默认品牌。
    await step('domain resolveBrand 精确匹配第二品牌 / 未知回退默认', async () => {
      const brands = [
        { brandId: 'default', appId: 'wx-default-0000', name: '默认品牌', status: 'ON', isDefault: true },
        { brandId: 'demo-brand-b', appId: 'wx-demo-brand-0002', name: '演示第二品牌', status: 'ON', copy: SECOND_BRAND.copy },
      ];
      const hit = resolveBrand(brands, 'wx-demo-brand-0002');
      assert.equal(hit.brandId, 'demo-brand-b', '精确匹配应命中 demo-brand-b');
      const fallback = resolveBrand(brands, 'wx-unknown-0000');
      assert.equal(fallback.brandId, 'default', '未知 appId 应回退 isDefault 品牌');
    });

    // 8. domain missingKeys：第二品牌 copy 缺键 → 回退默认文案。
    await step('domain missingKeys 第二品牌缺键回退默认文案', async () => {
      const missing = missingKeys(SECOND_BRAND.copy, CLIENT_DEFAULT_COPY);
      assert.deepEqual(missing, ['headerMenu', 'noticeHot'], '缺键应为 headerMenu/noticeHot');
      const merged = { ...CLIENT_DEFAULT_COPY, ...SECOND_BRAND.copy };
      assert.equal(merged.headerTitle, '第二品牌首页', '品牌键应覆盖默认文案');
      assert.equal(merged.headerMenu, '默认菜单', '缺键 headerMenu 应回退默认文案');
      assert.equal(merged.noticeHot, '默认热卖', '缺键 noticeHot 应回退默认文案');
    });

    return { ok: true, pass, fail, lines, steps };
  } catch (error) {
    return { ok: false, pass, fail, lines, steps, error: String((error && error.message) || error) };
  } finally {
    await server.close();
  }
}

function buildLog(report, startedAt) {
  const head = [
    '='.repeat(64),
    'Phase 5 演示性第二品牌验证 —— 新增客户小程序 = 纯配置、零代码',
    `运行时间: ${startedAt.toISOString()}`,
    '镜像: scripts/api-server.mjs (startApiServer seed=true, 内存 brands 集合为空)',
    '口径: 「未知 appId 回退内置默认品牌(primary=#ff2442)」在写入任何品牌前验证;',
    '      写入第二品牌后按 appId 精确解析; domain resolveBrand/missingKeys 验证缺键回退。',
    '='.repeat(64),
    '',
  ];
  const summary = [
    '',
    '-'.repeat(64),
    `结果: ${report.pass}/${report.pass + report.fail} PASS`,
    `退出码: ${report.ok ? 0 : 1}`,
    ...(report.error ? [`失败原因: ${report.error}`] : []),
    '',
  ];
  return [...head, ...report.lines, ...summary].join('\n');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const startedAt = new Date();
  const report = await run();
  const log = buildLog(report, startedAt);
  writeFileSync('TestEvidence/phase5-demo-brand.log', log);
  console.log(log);
  // 仅失败时显式退出 1；成功自然退出（避免 Windows libuv 下 process.exit(0) 触发 teardown 断言）。
  if (!report.ok) process.exit(1);
}
