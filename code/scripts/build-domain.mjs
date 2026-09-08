// 单一源构建：将 packages/domain/src/index.js 打包为 CommonJS，输出到云函数 game-service/lib/domain.cjs。
// 用法：node scripts/build-domain.mjs
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DOMAIN_ENTRY = resolve(ROOT, 'packages/domain/src/index.js');
export const DOMAIN_OUTFILE = resolve(ROOT, 'uniCloud-tcb/cloudfunctions/game-service/lib/domain.cjs');

export async function buildDomain() {
  await build({
    entryPoints: [DOMAIN_ENTRY],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    outfile: DOMAIN_OUTFILE,
    banner: {
      js: "'use strict';\n// 本文件由 packages/domain 构建生成（node scripts/build-domain.mjs），请勿手改。",
    },
    logLevel: 'info',
  });
  return DOMAIN_OUTFILE;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  buildDomain()
    .then((out) => console.log(`已生成 ${out}`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
