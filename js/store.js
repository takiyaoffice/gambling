// 記録データの保存・集計（localStorage）
(function () {
  const KEY = 'pachi-habit-v1';

  // 行かなかった日の改善行動
  const ACTIONS = [
    { id: 'ga', label: 'GA参加' },
    { id: 'parent', label: '親に電話' },
    { id: 'expert', label: '専門家に相談' },
    { id: 'partner', label: '彼女と話した' },
    { id: 'hobby', label: '趣味・運動' },
    { id: 'other', label: 'その他' },
  ];

  // なぜ行きたくなったか（きっかけ）
  const TRIGGERS = ['返済を早く進めたい', '負けを取り返したい', '勝ってお金を増やしたい', 'なんとなく打ちたい', 'ストレス・気分転換', 'その他'];

  // 予定・イベントの種類
  const PLAN_KINDS = [
    { id: 'ga', label: 'GA' },
    { id: 'clinic', label: '診察' },
    { id: 'counseling', label: 'カウンセリング' },
    { id: 'other', label: 'その他' },
  ];
  const PLAN_STATUS = ['planned', 'attended', 'missed'];

  const DEFAULT_SETTINGS = {
    monthlyGoal: 2,
    budget: 5000,
    line: { enabled: false, time: '21:00', endpoint: '' },
  };

  function normalize(raw) {
    return {
      records: (raw && raw.records) || {},
      plans: (raw && raw.plans) || {},
      settings: {
        ...DEFAULT_SETTINGS,
        ...(raw && raw.settings),
        line: { ...DEFAULT_SETTINGS.line, ...(raw && raw.settings && raw.settings.line) },
      },
    };
  }

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && typeof raw === 'object') return normalize(raw);
    } catch (e) { /* 破損時は初期化 */ }
    return normalize(null);
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

  // ---- 予定・イベント（記録とは別に保存） ----
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function plansOn(key) {
    return Object.values(state.plans)
      .filter((p) => p.date === key)
      .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  }

  function getPlan(id) { return state.plans[id] || null; }

  function setPlan(plan) {
    const id = plan.id || newId();
    state.plans[id] = { ...plan, id, updatedAt: Date.now() };
    save();
    return id;
  }

  function deletePlan(id) {
    delete state.plans[id];
    save();
  }

  // イベント参加の実績：予定を「参加した」にした日、または改善行動でGA参加・専門家に相談を記録した日
  function attendedOn(key) {
    if (plansOn(key).some((p) => p.status === 'attended')) return true;
    const r = state.records[key];
    return !!(r && (r.actions || []).some((a) => a === 'ga' || a === 'expert'));
  }

  function hasPlanned(key) {
    return plansOn(key).some((p) => p.status === 'planned');
  }

  function updateSettings(patch) {
    state.settings = { ...state.settings, ...patch, line: { ...state.settings.line, ...(patch.line || {}) } };
    save();
  }

  function monthRecords(y, m) {
    const p = monthPrefix(y, m);
    return Object.entries(state.records)
      .filter(([k]) => k.startsWith(p))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, r]) => ({ key, ...r }));
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
    const recs = monthRecords(y, m);
    const played = recs.filter((r) => r.type === 'played');
    const kept = played.filter((r) => r.budgetKept).length;
    const actionCounts = Object.fromEntries(ACTIONS.map((a) => [a.id, 0]));
    recs.forEach((r) => (r.actions || []).forEach((a) => { if (a in actionCounts) actionCounts[a]++; }));
    return {
      records: recs,
      playedDays: played.length,
      skippedDays: recs.length - played.length,
      daysInMonth: new Date(y, m + 1, 0).getDate(),
      balance: played.reduce((s, r) => s + (Number(r.balance) || 0), 0),
      budgetKept: kept,
      overBudget: played.length - kept,
      keepRate: played.length ? Math.round((kept / played.length) * 100) : null,
      actionCounts,
    };
  }

  // ---- CSVバックアップ ----
  const CSV_COLS_V1 = ['date', 'type', 'amount', 'balance', 'budgetKept', 'urge', 'triggers', 'actions', 'memo'];
  const CSV_COLS = [...CSV_COLS_V1, 'kind', 'time', 'status'];
  const csvCell = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

  function exportCSV() {
    const rows = Object.keys(state.records).sort().map((k) => {
      const r = state.records[k];
      return [k, r.type, r.amount ?? '', r.balance ?? '', r.type === 'played' ? (r.budgetKept ? 1 : 0) : '',
        r.urge ?? '', (r.triggers || []).join('|'), (r.actions || []).join('|'), r.memo || '', '', '', ''].map(csvCell).join(',');
    });
    const plans = Object.values(state.plans).sort((a, b) => a.date.localeCompare(b.date)).map((p) =>
      [p.date, 'plan', '', '', '', '', '', '', p.note || '', p.kind, p.time || '', p.status].map(csvCell).join(','));
    return '\uFEFF' + [CSV_COLS.join(','), ...rows, ...plans].join('\r\n');
  }

  function parseCSV(text) {
    const rows = []; let row = []; let cell = ''; let q = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((x) => x !== ''));
  }

  function importCSV(text) {
    const rows = parseCSV(text);
    const header = rows.length ? rows[0].join(',') : '';
    const hasPlans = header === CSV_COLS.join(',');
    if (!hasPlans && header !== CSV_COLS_V1.join(',')) throw new Error('形式が正しくありません');
    const records = {};
    const plans = {};
    rows.slice(1).forEach((c) => {
      const [date, type, amount, balance, kept, urge, triggers, actions, memo, kind, time, status] = c;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      if (type === 'plan') {
        if (!PLAN_KINDS.some((k) => k.id === kind)) return;
        const id = newId();
        plans[id] = { id, date, kind, time: time || '', note: memo || '', status: PLAN_STATUS.includes(status) ? status : 'planned' };
        return;
      }
      if (!['played', 'skipped'].includes(type)) return;
      const split = (s) => (s ? s.split('|') : []);
      records[date] = type === 'played'
        ? { type, amount: Number(amount) || 0, balance: Number(balance) || 0, budgetKept: kept === '1', urge: Number(urge) || null, triggers: split(triggers), actions: [], memo }
        : { type, urge: Number(urge) || null, triggers: split(triggers), actions: split(actions), memo };
    });
    state.records = records;
    if (hasPlans) state.plans = plans; // 旧形式のCSVでは予定を変更しない
    save();
    return Object.keys(records).length;
  }

  window.Store = {
    ACTIONS, TRIGGERS, PLAN_KINDS,
    get settings() { return state.settings; },
    getRecord, setRecord, deleteRecord, updateSettings,
    plansOn, getPlan, setPlan, deletePlan, attendedOn, hasPlanned,
    monthStats, skipStreak, exportCSV, importCSV,
    toKey, fromKey, todayKey,
  };
})();
