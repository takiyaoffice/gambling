// LINE通知サービス（アプリ本体とは独立して動作）
// アプリから受け取るのは { enabled, time } のみ。指定時刻にLINE Messaging APIでリマインドを送る。
// 必要な環境変数: LINE_CHANNEL_ACCESS_TOKEN, LINE_USER_ID  任意: PORT, ALLOW_ORIGIN, TZ
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8787);
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';
const CONFIG_FILE = path.join(__dirname, 'config.json');
const MESSAGE = process.env.LINE_MESSAGE || '今日の記録をつけましょう。行かなかった日も大切な記録です。';

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return { enabled: false, time: '21:00' }; }
}
let config = loadConfig();
let lastSentDate = null;

async function pushLine(text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_USER_ID;
  if (!token || !to) { console.warn('LINE_CHANNEL_ACCESS_TOKEN / LINE_USER_ID が未設定です'); return false; }
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
  });
  if (!res.ok) console.error('LINE送信失敗', res.status, await res.text());
  return res.ok;
}

// 1分ごとに時刻を確認し、1日1回だけ送信
setInterval(() => {
  if (!config.enabled) return;
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const today = now.toDateString();
  if (hhmm === config.time && lastSentDate !== today) {
    lastSentDate = today;
    pushLine(MESSAGE).catch((e) => console.error(e));
  }
}, 30 * 1000);

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }

  if (req.method === 'POST' && req.url === '/config') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e4) req.destroy(); });
    req.on('end', () => {
      try {
        const { enabled, time } = JSON.parse(body);
        if (typeof enabled !== 'boolean' || !/^\d{2}:\d{2}$/.test(time)) throw new Error('invalid');
        config = { enabled, time };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config));
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(config));
      } catch {
        res.writeHead(400).end('bad request');
      }
    });
    return;
  }
  if (req.method === 'POST' && req.url === '/test') {
    pushLine('テスト通知です。').then((ok) => res.writeHead(ok ? 200 : 500).end(ok ? 'sent' : 'failed'));
    return;
  }
  res.writeHead(404).end();
}).listen(PORT, () => console.log(`line-notifier: http://localhost:${PORT}`));
