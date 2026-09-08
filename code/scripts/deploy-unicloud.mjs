// 云函数 + 数据库 schema 部署：先构建领域单一源(domain.cjs)，再经 HBuilderX CLI 上传 game-service/wechat-callback 与全部 schema。
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildDomain, DOMAIN_OUTFILE } from './build-domain.mjs';

const CLI = process.env.HX_CLI || (process.platform === 'win32' ? 'F:/HBuilderX/cli.exe' : 'cli');
const PROJECT = process.env.HX_PROJECT || 'client';
const PROVIDER = process.env.UNICLOUD_PROVIDER || 'aliyun';
const SPACE = process.env.UNICLOUD_SPACE || '';

if (!SPACE) {
  console.error('缺少 UNICLOUD_SPACE 环境变量（服务空间名称或 id）');
  console.error('可用命令：node scripts/list-unicloud.mjs');
  process.exit(2);
}

function run(args) {
  const res = spawnSync(CLI, args, { cwd: process.cwd(), encoding: 'utf8' });
  process.stdout.write(res.stdout || '');
  process.stderr.write(res.stderr || '');
  if (res.status !== 0) {
    console.error(`命令失败: ${CLI} ${args.join(' ')}`);
    process.exit(res.status || 1);
  }
  return res.stdout;
}

// 部署前先构建领域单一源：构建失败或产物缺失则中止部署。
try {
  await buildDomain();
} catch (err) {
  console.error('领域逻辑构建失败，中止部署：', err);
  process.exit(1);
}
if (!existsSync(DOMAIN_OUTFILE)) {
  console.error(`构建产物缺失：${DOMAIN_OUTFILE}，中止部署`);
  process.exit(1);
}
console.log('领域逻辑已由 packages/domain 构建生成：', DOMAIN_OUTFILE);

run(['project', 'open', '--path', join(process.cwd(), 'apps/client')]);
run(['cloud', 'functions', '--prj', PROJECT, '--provider', PROVIDER, '--assignspace', SPACE]);
run(['cloud', 'functions', '--upload', 'cloudfunction', '--prj', PROJECT, '--provider', PROVIDER, '--name', 'game-service', '--force']);
run(['cloud', 'functions', '--upload', 'cloudfunction', '--prj', PROJECT, '--provider', PROVIDER, '--name', 'wechat-callback', '--force']);
run(['cloud', 'functions', '--upload', 'cloudfunction', '--prj', PROJECT, '--provider', PROVIDER, '--name', 'system-runner', '--force']);

for (const file of readdirSync('uniCloud-tcb/database')) {
  if (file.endsWith('.schema.json')) {
    run(['cloud', 'functions', '--upload', 'db', '--prj', PROJECT, '--provider', PROVIDER, '--name', file, '--force']);
  }
}

console.log('\n云函数与 schema 上传完成。仍需在 uniCloud 控制台手动完成 URL 化（CLI 不支持）：');
console.log('- game-service：开启 URL 化并配置路径 /pay-notify（微信支付回调，地址 https://api.qmhyplayer.com/pay-notify）');
console.log('- wechat-callback：开启 URL 化，绑定域名/路径后配置微信消息推送');
console.log('- system-runner：不要开启 URL 化；仅配置定时触发器，并在触发参数中注入 SCHEDULER_SECRET');
