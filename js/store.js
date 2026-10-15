// 記録データの保存・集計（localStorage）
(function () {
  const KEY = 'pachi-habit-v1';

  const ACTIONS = [
    { id: 'ga', label: 'GA参加' },
    { id: 'family', label: '家族への電話' },
    { id: 'expert', label: '専門家への相談' },
    { id: 'partner', label: '恋人との会話' },
    { id: 'hobby', label: '趣味・運動' },
  ];

  const TRIGGERS = ['ストレス', '暇・退屈', '給料日', '休日', 'お酒', '広告・通りがかり', '人に誘われた', 'その他'];

  const DEFAULT_SETTINGS = {
    monthlyGoal: 2,
    budget: 5000,
    line: { enabled: false, time: '21:00', endpoint: '' },
  };

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && typeof raw === 'object') {
        return {
          records: raw.records || {},
          settings: {
            ...DEFAULT_SETTINGS,
            ...raw.settings,
            line: { ...DEFAULT_SETTINGS.line, ...(raw.settings && raw.settings.line) },
          },
        };
      }
    } catch (e) { /* 破損時は初期化 */ }
    return { records: {}, settings: structuredClone(DEFAULT_SETTINGS) };
  }

  let state = load();

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }

  // ---- 日付ユーティリティ（ローカル時刻） ----
  const pad = (n) => String(n).padStart(2, '0');
  const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const todayKey = () => toKey(new Date());
  const monthPrefix = (y, m) => `${y}-${pad(m + 1)}`;

  function getRecord(key) { return state.records[key] || null; }

  function setRecord(key, rec) {
    state.records[key] = { ...rec, updatedAt: Date.now() };
    save();
  }

  function deleteRecord(key) {
    delete state.records[key];
    save();
  }

  function updateSettings(patch) {
    state.settings = { ...state.settings, ...patch, line: { ...state.settings.line, ...(patch.line || {}) } };
    save();
  }

  function monthRecords(y, m) {
    const p = monthPrefix(y, m);
    return Object.entries(state.records)
      .filter(([k]) => k.startsWith(p))
      .sort(([a], [b]) => a.localeCompare(b));
  }

  // 今日（未記録なら昨日）から遡って「行かなかった」が続く日数。未記録・遊技日で止まる
  function skipStreak() {
    const d = new Date();
    if (!state.records[toKey(d)]) d.setDate(d.getDate() - 1);
    let n = 0;
    for (;;) {
      const r = state.records[toKey(d)];
      if (!r || r.type !== 'skipped') break;
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  function monthStats(y, m) {
    const recs = monthRecords(y, m).map(([k, r]) => ({ key: k, ...r }));
    const played = recs.filter((r) => r.type === 'played');
    const skipped = recs.filter((r) => r.type === 'skipped');
    const kept = played.filter((r) => r.budgetKept).length;
    const actionCounts = Object.fromEntries(ACTIONS.map((a) => [a.id, 0]));
    recs.forEach((r) => (r.actions || []).forEach((a) => { if (a in actionCounts) actionCounts[a]++; }));
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    return {
      records: recs,
      playedDays: played.length,
      skippedDays: skipped.length,
      recordedDays: recs.length,
      daysInMonth,
      spent: played.reduce((s, r) => s + (Number(r.amount) || 0), 0),
      balance: played.reduce((s, r) => s + (Number(r.balance) || 0), 0),
      budgetKept: kept,
      overBudget: played.length - kept,
      keepRate: played.length ? Math.round((kept / played.length) * 100) : null,
      actionCounts,
      actionTotal: Object.values(actionCounts).reduce((a, b) => a + b, 0),
      urges: recs.filter((r) => r.urge).map((r) => ({ day: fromKey(r.key).getDate(), urge: r.urge, type: r.type })),
    };
  }

  function exportJSON() { return JSON.stringify(state, null, 2); }

  function importJSON(text) {
    const data = JSON.parse(text);
    if (!data || typeof data.records !== 'object') throw new Error('形式が正しくありません');
    state = { records: data.records, settings: { ...DEFAULT_SETTINGS, ...data.settings } };
    save();
  }

  function clearAll() {
    state = { records: {}, settings: structuredClone(DEFAULT_SETTINGS) };
    save();
  }

  window.Store = {
    ACTIONS, TRIGGERS,
    get settings() { return state.settings; },
    getRecord, setRecord, deleteRecord, updateSettings,
    monthStats, skipStreak, exportJSON, importJSON, clearAll,
    toKey, fromKey, todayKey,
  };
})();
