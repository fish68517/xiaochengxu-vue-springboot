// 双域 H5 静态托管健康检查:客户域(/)与后台域(/workbench/ + /admin/),任一非 200 或超时即失败退出(CI/发布后自检用)。
// 域名经 env 注入: HOSTING_CLIENT_URL / HOSTING_BACKEND_URL(默认值为示例,部署时按实际域名配置)。
const CLIENT_URL = process.env.HOSTING_CLIENT_URL || '';
const BACKEND_URL = process.env.HOSTING_BACKEND_URL || '';
if (!CLIENT_URL || !BACKEND_URL) throw new Error('缺少 HOSTING_CLIENT_URL/HOSTING_BACKEND_URL，拒绝检查隐式域名');
const urls = [
  `${CLIENT_URL}/`,
  `${BACKEND_URL}/workbench/`,
  `${BACKEND_URL}/admin/`,
];
let failed = false;
for (const url of urls) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    console.log(res.status === 200 ? 'PASS' : 'FAIL', res.status, url);
    if (res.status !== 200) failed = true;
  } catch (e) {
    console.log('FAIL', e.message, url);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
