// LINE通知はアプリ本体と分離（line-notifier/ の別サービスが送信を担当）。
// アプリ側は通知設定（ON/OFF・時刻）を外部サービスへ渡すだけ。記録内容は送らない。
(function () {
  async function sync(lineSettings) {
    const { endpoint, enabled, time } = lineSettings;
    if (!endpoint) return { ok: false, reason: 'no-endpoint' };
    try {
      const res = await fetch(endpoint.replace(/\/$/, '') + '/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, time }),
      });
      return { ok: res.ok, reason: res.ok ? '' : `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, reason: 'network' };
    }
  }

  window.LineBridge = { sync };
})();
