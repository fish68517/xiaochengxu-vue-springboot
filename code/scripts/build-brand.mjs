// 按非敏感品牌构建配置复用同一套客户代码；拒绝 secret/private-key 等敏感键进入 env 文件。
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).map((arg, index, all) => {
  if (!arg.startsWith('--')) return [null, null];
  const [key, inline] = arg.slice(2).split('=', 2);
  return [key, inline === undefined ? all[index + 1] : inline];
}).filter(([key]) => key));

const brand = args.brand;
const platform = args.platform || 'mp-weixin';
if (!brand || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(brand)) throw new Error('请使用 --brand demo-a 指定合法品牌 code');
if (!['h5', 'mp-weixin'].includes(platform)) throw new Error('--platform 仅支持 h5/mp-weixin');

const file = resolve('config', 'brands', `${brand}.env`);
if (!existsSync(file)) throw new Error(`品牌构建配置不存在: ${file}`);
const env = {};
for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const at = line.indexOf('=');
  if (at <= 0) throw new Error(`品牌配置行格式错误: ${line}`);
  const key = line.slice(0, at).trim();
  const value = line.slice(at + 1).trim();
  if (/SECRET|PRIVATE|PASSWORD|API_KEY|MCH_KEY/i.test(key)) throw new Error(`品牌构建配置禁止包含敏感键: ${key}`);
  env[key] = value;
}
if (env.VITE_BRAND_CODE !== brand) throw new Error(`VITE_BRAND_CODE 必须等于 ${brand}`);
if (!/^wx[a-zA-Z0-9]{6,30}$/.test(env.VITE_WECHAT_APP_ID || '')) throw new Error('VITE_WECHAT_APP_ID 必须是合法的非敏感微信 AppID');
if (!env.VITE_PUBLIC_CHANNEL_ID) throw new Error('VITE_PUBLIC_CHANNEL_ID 不能为空');

const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
const commandArgs = process.platform === 'win32'
  ? ['/d', '/s', '/c', `npm run build:${platform}`]
  : ['run', `build:${platform}`];
const buildStartedAt = Date.now();
const child = spawn(command, commandArgs, {
  cwd: resolve('apps', 'client'), stdio: 'inherit', shell: false, env: { ...process.env, ...env },
});
let status = await new Promise((resolveStatus, reject) => {
  child.once('error', reject);
  child.once('exit', (code) => resolveStatus(code == null ? 1 : code));
});
const source = resolve('apps', 'client', 'dist', 'build', platform);
function artifactContainsBrand(directory) {
  if (!existsSync(directory)) return false;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory() && artifactContainsBrand(path)) return true;
    if (entry.isFile() && /\.(?:js|json|html)$/.test(entry.name) && readFileSync(path, 'utf8').includes(brand)) return true;
  }
  return false;
}
function copyTree(sourceDir, targetDir) {
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = resolve(sourceDir, entry.name);
    const targetPath = resolve(targetDir, entry.name);
    if (entry.isDirectory()) copyTree(sourcePath, targetPath);
    else if (entry.isFile()) copyFileSync(sourcePath, targetPath);
  }
}
// 当前 Windows/DCloud 编译器偶发在打印 DONE 后以 0xC0000409 结束；仅当本次新产物存在且品牌码已写入时按成功收口。
if (process.platform === 'win32' && status === -1073740791
  && existsSync(resolve(source, 'index.html'))
  && statSync(resolve(source, 'index.html')).mtimeMs >= buildStartedAt - 2000
  && artifactContainsBrand(source)) {
  console.warn('[brand-build] DCloud 编译已生成有效产物，但 Windows 进程在退出阶段返回 0xC0000409；已通过产物校验。');
  status = 0;
}
if (status === 0) {
  if (platform === 'mp-weixin') {
    const projectConfigFile = resolve(source, 'project.config.json');
    if (!existsSync(projectConfigFile)) throw new Error(`微信小程序构建缺少 project.config.json: ${projectConfigFile}`);
    const projectConfig = JSON.parse(readFileSync(projectConfigFile, 'utf8'));
    projectConfig.appid = env.VITE_WECHAT_APP_ID;
    projectConfig.projectname = env.VITE_BRAND_DISPLAY_NAME || brand;
    writeFileSync(projectConfigFile, `${JSON.stringify(projectConfig, null, 2)}\n`);
  }
  const target = resolve('BuildArtifacts', 'brands', brand, platform);
  mkdirSync(dirname(target), { recursive: true });
  copyTree(source, target);
  writeFileSync(resolve(target, 'brand-build.json'), `${JSON.stringify({ brand, platform, displayName: env.VITE_BRAND_DISPLAY_NAME || brand, appId: env.VITE_WECHAT_APP_ID, channelId: env.VITE_PUBLIC_CHANNEL_ID || '', builtAt: new Date().toISOString() }, null, 2)}\n`);
  console.log(`[brand-build] 已保留独立产物: ${target}`);
}
process.exit(status);
