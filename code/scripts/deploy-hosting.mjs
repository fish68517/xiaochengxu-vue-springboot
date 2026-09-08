// 双域 H5 静态托管部署:
//   client  → 客户域(web-view H5 下单/浏览),仅 apps/client,前缀 /
//   backend → 后台域(客服+接单+管理),workbench 前缀 /workbench/、admin 前缀 /admin/
// 用法: node scripts/deploy-hosting.mjs client|backend
// 空间配置: HOSTING_CLIENT_SPACE / HOSTING_BACKEND_SPACE(缺省回退 UNICLOUD_SPACE);域名在 uniCloud 控制台绑定到对应空间。
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const CLI = process.env.HX_CLI || (process.platform === 'win32' ? 'F:/HBuilderX/cli.exe' : 'cli');
const PROVIDER = process.env.UNICLOUD_PROVIDER || 'aliyun';
const DEFAULT_SPACE = process.env.UNICLOUD_SPACE || '';

const TARGETS = {
  client: {
    space: process.env.HOSTING_CLIENT_SPACE || DEFAULT_SPACE,
    items: [['apps/client/dist/build/h5', '/']],
  },
  backend: {
    space: process.env.HOSTING_BACKEND_SPACE || DEFAULT_SPACE,
    items: [
      ['apps/workbench/dist/build/h5', '/workbench/'],
      ['apps/admin/dist/build/h5', '/admin/'],
    ],
  },
};

const target = process.argv[2];
const conf = TARGETS[target];
if (!conf) {
  console.error('用法: node scripts/deploy-hosting.mjs client|backend');
  process.exit(1);
}
if (!conf.space) {
  console.error(`缺少 ${target === 'client' ? 'HOSTING_CLIENT_SPACE' : 'HOSTING_BACKEND_SPACE'} 或 UNICLOUD_SPACE，拒绝使用隐式生产空间`);
  process.exit(2);
}

function run(args) {
  const res = spawnSync(CLI, args, { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
  process.stdout.write(res.stdout || '');
  process.stderr.write(res.stderr || '');
  if (res.status !== 0) {
    console.error(`失败: ${CLI} ${args.join(' ')}`);
    process.exit(res.status || 1);
  }
}

for (const [source, prefix] of conf.items) {
  run(['hosting', 'deploy', '--provider', PROVIDER, '--space', conf.space, '--source', join(process.cwd(), source).replace(/\\/g, '/'), '--prefix', prefix]);
}
console.log(`hosting deploy done: ${target} -> space ${conf.space}`);
