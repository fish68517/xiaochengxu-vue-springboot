// 告警通道：脱敏文件留档 + 实际 HTTPS webhook 投递（仅对已授权渠道启用）。
// 覆盖：支付回调失败/退款失败/转账失败/服务异常 → 通知管理员（§G.4）。

import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ops from '../uniCloud-tcb/cloudfunctions/game-service/lib/commercial-ops.cjs';

// 发送告警：控制台 + 按日追加文件；webhook 通道预留。
export async function sendAlert({ level = 'P1', title, message = '', meta = {} }, { logDir = process.env.ALERT_LOG_DIR || './alerts', webhookUrl = process.env.ALERT_WEBHOOK_URL, allowLocal = false } = {}) {
  if (!title) throw new Error('告警标题不能为空');
  const event = ops.sanitize({ ts: new Date().toISOString(), level, title, message, meta });
  mkdirSync(logDir, { recursive: true });
  let delivered = false; let error = '';
  if (webhookUrl) { try { await ops.deliverWebhook(webhookUrl, event, { allowLocal }); delivered = true; } catch (cause) { error = cause.message; } }
  const result = { ok: !webhookUrl || delivered, logged: true, delivered, webhookReady: Boolean(webhookUrl), error };
  appendFileSync(join(logDir, `${new Date().toISOString().slice(0, 10)}.log`), `${JSON.stringify({ ...event, delivery: result })}\n`, 'utf8');
  return result;
}

function printHelp() {
  console.log('用法：node scripts/alert.mjs [--level <ERROR|WARN|INFO>] [--title <标题>] [--message <内容>] [--help]');
  console.log('  ALERT_LOG_DIR 指定留档目录；ALERT_WEBHOOK_URL 配置后将实际发送，仅用于已授权通道。');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  if (process.argv.includes('--help')) { printHelp(); process.exit(0); }
  const opt = (flag) => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : undefined; };
  const result = await sendAlert({
    level: opt('--level') || 'INFO',
    title: opt('--title') || '冒烟告警',
    message: opt('--message') || '本地告警通道自检',
  });
  console.log(JSON.stringify(result));
  process.exitCode = result.ok ? 0 : 1;
}
