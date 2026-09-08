// 列出 uniCloud 服务空间（腾讯云/阿里云两 provider 均列出），部署前用于确认空间可用。
import { spawnSync } from 'node:child_process';
const CLI = process.env.HX_CLI || (process.platform === 'win32' ? 'F:/HBuilderX/cli.exe' : 'cli');
const PROJECT = process.env.HX_PROJECT || 'client';
for (const provider of ['tcb', 'aliyun']) {
  const res = spawnSync(CLI, ['cloud', 'functions', '--list', 'space', '--prj', PROJECT, '--provider', provider, '--cloud'], { encoding: 'utf8' });
  console.log(`== ${provider} ==`);
  console.log(res.stdout || '');
  console.log(res.stderr || '');
}
