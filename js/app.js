// 画面描画とルーティング
(function () {
  const $view = document.getElementById('view');
  const $tabbar = document.getElementById('tabbar');
  const $toast = document.getElementById('toast');
  const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
  const WEEK_MON = ['月', '火', '水', '木', '金', '土', '日'];

  const now = new Date();
  const ui = {
    calYear: now.getFullYear(), calMonth: now.getMonth(), selected: Store.todayKey(),
    revYear: now.getFullYear(), revMonth: now.getMonth(),
  };

  // ---------------- 共通 ----------------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => Number(n || 0).toLocaleString('ja-JP');
  const signed = (n) => (n < 0 ? '-' : n > 0 ? '+' : '') + num(Math.abs(n));
  const jpDate = (key) => { const d = Store.fromKey(key); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WEEK[d.getDay()]}）`; };
  const shortDate = (key) => { const d = Store.fromKey(key); return `${d.getMonth() + 1}月${d.getDate()}日（${WEEK[d.getDay()]}）`; };

  const ICONS = {
    ga: '<circle cx="12" cy="6" r="3"/><circle cx="4.8" cy="8.6" r="2.2"/><circle cx="19.2" cy="8.6" r="2.2"/><path d="M7 21v-5a5 5 0 0 1 10 0v5z"/><path d="M1 20v-3.2A3.8 3.8 0 0 1 5.8 13 7 7 0 0 0 5.5 15.5V20z"/><path d="M23 20v-3.2A3.8 3.8 0 0 0 18.2 13a7 7 0 0 1 .3 2.5V20z"/>',
    parent: '<path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/>',
    expert: '<circle cx="12" cy="7" r="4.2"/><path d="M3.5 21.5a8.5 8.5 0 0 1 17 0z"/><path d="M11 13.2h2l.7 2.3-1.7 3-1.7-3z" class="cut"/>',
    partner: '<path d="M3 4h13a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4.5 3.5V15H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M20 8h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1v3l-3.5-3H11a2 2 0 0 1-1.8-1.2H16a4 4 0 0 0 4-4z"/>',
    hobby: '<rect x="1" y="9" width="3" height="6" rx="1"/><rect x="4.5" y="6.5" width="3.2" height="11" rx="1"/><rect x="16.3" y="6.5" width="3.2" height="11" rx="1"/><rect x="20" y="9" width="3" height="6" rx="1"/><rect x="7.5" y="11" width="9" height="2"/>',
    clinic: '<path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M10.2 7h3.6v3.2H17v3.6h-3.2V17h-3.6v-3.2H7v-3.6h3.2z" class="cut"/>',
    other: '<path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M8 11h8M8 14.5h8M8 18h5" class="cut-line"/>',
  };
  const icon = (id, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[id] || ''}</svg>`;

  // ホーム・振り返りの改善行動一覧（画像の4区分）
  const ACTION_GROUPS = [
    { label: 'GA参加', icon: 'ga', ids: ['ga'] },
    { label: '親に電話', icon: 'parent', ids: ['parent'] },
    { label: '専門家に相談', icon: 'expert', ids: ['expert'] },
    { label: 'その他の行動', icon: 'other', ids: ['partner', 'hobby', 'other'] },
  ];
  const groupCount = (s, g) => g.ids.reduce((n, id) => n + (s.actionCounts[id] || 0), 0);

  // 行きたい気持ちの顔アイコン（1:弱い〜5:強い）
  const FACE_MOUTH = { 1: 'M8 14.5q4 3.5 8 0', 2: 'M8.5 15q3.5 1.8 7 0', 3: 'M8.5 15.5h7', 4: 'M8.5 16.5q3.5-1.8 7 0', 5: 'M8 17q4-3.5 8 0' };
  const urgeTone = (n) => (n <= 1 ? 'low' : n <= 3 ? 'mid' : 'high');
  const face = (n, on) => `<svg viewBox="0 0 24 24" class="face ${on ? 'on ' + urgeTone(n) : ''}"><circle cx="12" cy="12" r="10"/><circle cx="8.7" cy="10" r="1.1" class="eye"/><circle cx="15.3" cy="10" r="1.1" class="eye"/><path d="${FACE_MOUTH[n]}" class="mouth"/></svg>`;

  // 予定の種類 → アイコン、参加状況 → バッジ
  const PLAN_ICON = { ga: 'ga', clinic: 'clinic', counseling: 'expert', other: 'other' };
  const planLabel = (p) => (Store.PLAN_KINDS.find((k) => k.id === p.kind) || {}).label || '予定';
  const STATUS_BADGE = {
    planned: '<span class="badge plan">予定</span>',
    attended: '<span class="badge attended">参加した</span>',
    missed: '<span class="badge none">参加しなかった</span>',
  };

  const CHEVRON = '<svg class="chev" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>';
  const appbar = (center, left = '', right = '') =>
    `<header class="appbar"><div class="appbar-side">${left}</div><h1>${center}</h1><div class="appbar-side right">${right}</div></header>`;

  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => $toast.classList.remove('show'), 1800);
  }

  // ---------------- ルーティング ----------------
  function parseRoute() {
    const [name, arg, arg2] = location.hash.replace(/^#\/?/, '').split('/');
    return { name: name || 'home', arg, arg2 };
  }

  function go(hash) { location.hash = hash; }
  // 記録画面からは開いた元の画面（ホーム／カレンダー）へ戻る
  function back(fallback) { go(fallback); }

  function render() {
    const { name, arg, arg2 } = parseRoute();
    const full = name === 'record' || name === 'plan';
    const tab = ['home', 'calendar', 'review', 'settings'].includes(name) ? name : 'home';
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.route === tab));
    $tabbar.hidden = full;
    document.body.classList.toggle('has-tabbar', !full);

    if (name === 'home' || name === 'calendar') ui.from = name;
    if (name === 'record' && /^\d{4}-\d{2}-\d{2}$/.test(arg || '')) renderRecord(arg);
    else if (name === 'plan' && /^\d{4}-\d{2}-\d{2}$/.test(arg || '')) renderPlan(arg, arg2 || 'new');
    else if (name === 'calendar') renderCalendar();
    else if (name === 'review') renderReview();
    else if (name === 'settings') renderSettings(arg);
    else renderHome();
    window.scrollTo(0, 0);
  }

  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => go(t.dataset.route)));
  window.addEventListener('hashchange', render);

  // ---------------- ホーム ----------------
  function renderHome() {
    const s = Store.monthStats(now.getFullYear(), now.getMonth());
    const goal = Store.settings.monthlyGoal;
    const today = Store.getRecord(Store.todayKey());
    const menu = `<button class="icon-btn" id="menu" aria-label="設定を開く"><svg viewBox="0 0 24 24" class="stroke"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>`;

    $view.innerHTML = appbar('ホーム', '', menu) + `
      <div class="page">
        <section class="card streak">
          <p class="card-label">現在の連続記録</p>
          <p class="streak-value"><span>${Store.skipStreak()}</span>日</p>
          <p class="streak-note">パチンコに行っていない日数</p>
        </section>

        <div class="pair">
          <section class="card metric">
            <p class="card-label">今月の遊技日数</p>
            <p class="metric-value ${s.playedDays > goal ? 'over' : ''}"><span>${s.playedDays}</span>日</p>
            <p class="metric-goal">目標：${goal}日以内</p>
          </section>
          <section class="card metric">
            <p class="card-label">予算を守れた割合</p>
            <p class="metric-value accent ${s.keepRate !== null && s.keepRate < 100 ? 'over' : ''}"><span>${s.keepRate === null ? '—' : s.keepRate}</span>${s.keepRate === null ? '' : '%'}</p>
            <p class="metric-goal">目標：100%</p>
          </section>
        </div>

        <section class="card">
          <p class="card-label">今月の改善行動（カウント）</p>
          <ul class="count-list">
            ${ACTION_GROUPS.map((g) => `<li>${icon(g.icon)}<span>${g.label}</span><b>${groupCount(s, g)}</b>回</li>`).join('')}
          </ul>
          <button class="btn-primary" id="today-btn">${today ? '今日の記録を編集する' : '今日の記録をつける'}</button>
        </section>
      </div>`;

    document.getElementById('today-btn').onclick = () => go('record/' + Store.todayKey());
    document.getElementById('menu').onclick = () => go('settings');
  }

  // ---------------- カレンダー ----------------
  function renderCalendar() {
    const y = ui.calYear, m = ui.calMonth;
    const todayKey = Store.todayKey();
    const lead = (new Date(y, m, 1).getDay() + 6) % 7; // 月曜始まり
    const days = new Date(y, m + 1, 0).getDate();
    const total = Math.ceil((lead + days) / 7) * 7;
    if (!ui.selected.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`)) {
      ui.selected = todayKey.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`) ? todayKey : Store.toKey(new Date(y, m, 1));
    }

    let cells = '';
    for (let i = 0; i < total; i++) {
      const d = new Date(y, m, i - lead + 1);
      const key = Store.toKey(d);
      const inMonth = d.getMonth() === m;
      if (!inMonth) { cells += `<span class="day out"><i>${d.getDate()}</i></span>`; continue; }
      const rec = Store.getRecord(key);
      const future = key > todayKey;
      const cls = rec ? rec.type : future ? 'future' : 'none';
      const event = !future && Store.attendedOn(key);
      const planned = Store.hasPlanned(key);
      const label = (rec ? (rec.type === 'played' ? '行った日' : '行かなかった日') : future ? '' : '未記録') + (event ? ' イベント参加' : '') + (planned ? ' 予定あり' : '');
      cells += `<button class="day ${cls} ${event ? 'event' : ''} ${key === ui.selected ? 'sel' : ''}" data-key="${key}"
        aria-label="${d.getMonth() + 1}月${d.getDate()}日 ${label}"><i>${d.getDate()}</i>${planned ? '<b class="pdot"></b>' : ''}</button>`;
    }

    const prev = `<button class="icon-btn" id="prev" aria-label="前の月"><svg viewBox="0 0 24 24" class="stroke"><path d="m15 6-6 6 6 6"/></svg></button>`;
    const next = `<button class="icon-btn" id="next" aria-label="次の月"><svg viewBox="0 0 24 24" class="stroke"><path d="m9 6 6 6-6 6"/></svg></button>`;

    $view.innerHTML = appbar(`${y}年${m + 1}月`, prev, next) + `
      <section class="cal">
        <div class="cal-week">${WEEK_MON.map((w) => `<span>${w}</span>`).join('')}</div>
        <div class="cal-grid">${cells}</div>
        <div class="cal-legend">
          <span><i class="lg skipped"></i>行かなかった</span><span><i class="lg played"></i>行った</span><span><i class="lg none"></i>未記録</span>
          <span><i class="lg event"></i>イベント参加</span><span><i class="lg-dot"></i>予定</span>
        </div>
      </section>
      <div class="page tight">${dayPanel(ui.selected)}${plansCard(ui.selected)}</div>`;

    document.getElementById('prev').onclick = () => shiftMonth('cal', -1);
    document.getElementById('next').onclick = () => shiftMonth('cal', 1);
    $view.querySelectorAll('.day[data-key]').forEach((b) => b.addEventListener('click', () => {
      if (ui.selected === b.dataset.key) { go((b.dataset.key > todayKey ? 'plan/' : 'record/') + b.dataset.key); return; }
      ui.selected = b.dataset.key;
      renderCalendar();
    }));
    const panel = document.getElementById('day-panel');
    if (panel) panel.onclick = () => go('record/' + ui.selected);
    document.getElementById('add-plan').onclick = () => go(`plan/${ui.selected}/new`);
    $view.querySelectorAll('[data-plan]').forEach((b) => (b.onclick = () => go(`plan/${ui.selected}/${b.dataset.plan}`)));
  }

  function plansCard(key) {
    const list = Store.plansOn(key);
    const future = key > Store.todayKey();
    return `
      <section class="card plans">
        <div class="plans-head"><b>${future ? shortDate(key) + 'の予定' : '予定・イベント'}</b><button class="link-btn" id="add-plan">＋ 予定を追加</button></div>
        ${list.length ? `<ul class="plan-list">${list.map((p) => `
          <li><button class="plan-item" data-plan="${p.id}">
            ${icon(PLAN_ICON[p.kind])}
            <span class="plan-main"><b>${planLabel(p)}${p.time ? `<small>${esc(p.time)}</small>` : ''}</b>${p.note ? `<span>${esc(p.note)}</span>` : ''}</span>
            ${STATUS_BADGE[p.status] || ''}${CHEVRON}
          </button></li>`).join('')}</ul>` : '<p class="panel-text muted">予定はありません</p>'}
      </section>`;
  }

  function dayPanel(key) {
    if (key > Store.todayKey()) return '';
    const r = Store.getRecord(key);
    const badge = !r ? '<span class="badge none">未記録</span>'
      : r.type === 'played' ? '<span class="badge played">行った日</span>' : '<span class="badge skipped">行かなかった日</span>';
    let body;
    if (!r) body = '<p class="panel-text muted">タップして記録をつける</p>';
    else if (r.type === 'skipped') {
      const acts = Store.ACTIONS.filter((a) => (r.actions || []).includes(a.id));
      body = acts.length
        ? `<div class="panel-icons">${acts.map((a) => icon(a.id)).join('')}</div><p class="panel-text">${acts.map((a) => a.label).join('、')}</p>`
        : '<p class="panel-text muted">改善行動の記録なし</p>';
    } else {
      body = `<p class="panel-text">使用金額 ${num(r.amount)}円 ／ 収支 ${signed(r.balance)}円 ／ 予算 ${r.budgetKept ? '守れた' : '守れなかった'}</p>`;
    }
    const memo = r && r.memo ? `<div class="panel-memo"><p class="panel-memo-title">メモ</p><p>${esc(r.memo).replace(/\n/g, '<br>')}</p></div>` : '';
    return `
      <button class="card panel" id="day-panel">
        <div class="panel-head"><b>${shortDate(key)}</b><span class="panel-right">${badge}${CHEVRON}</span></div>
        ${body}${memo}
      </button>`;
  }

  function shiftMonth(prefix, delta) {
    const d = new Date(ui[prefix + 'Year'], ui[prefix + 'Month'] + delta, 1);
    ui[prefix + 'Year'] = d.getFullYear();
    ui[prefix + 'Month'] = d.getMonth();
    render();
  }

  // ---------------- 日別の記録画面 ----------------
  function renderRecord(key) {
    if (key > Store.todayKey()) { go('calendar'); return; }
    const existing = Store.getRecord(key);
    const budget = Store.settings.budget;
    const f = {
      type: existing?.type || null,
      amount: existing?.amount != null ? String(existing.amount) : '',
      balAbs: existing?.balance ? String(Math.abs(existing.balance)) : '',
      balSign: existing?.balance < 0 ? -1 : 1,
      budgetKept: existing?.type === 'played' ? existing.budgetKept : null,
      urge: existing?.urge || 0,
      triggers: [...(existing?.triggers || [])],
      actions: [...(existing?.actions || [])],
      memo: existing?.memo || '',
    };

    const backBtn = `<button class="icon-btn" id="back" aria-label="戻る"><svg viewBox="0 0 24 24" class="stroke"><path d="M20 12H5m6-6-6 6 6 6"/></svg></button>`;
    const moreBtn = `<button class="icon-btn" id="more" aria-label="その他の操作"><svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg></button>`;

    $view.innerHTML = appbar(jpDate(key), backBtn, moreBtn) + `
      <div class="menu" id="menu" hidden></div>
      <div class="page record" id="rec"></div>
      <div class="savebar"><button class="btn-primary" id="save">保存する</button></div>`;
    const $rec = document.getElementById('rec');
    const $menu = document.getElementById('menu');

    const autoKept = () => (f.amount === '' ? null : Number(f.amount) <= budget);
    const keptValue = () => (f.budgetKept === null ? autoKept() : f.budgetKept);

    function draw() {
      if (!f.type) {
        $rec.innerHTML = `
          <p class="choose-title">この日はどうでしたか？</p>
          <button class="banner played big" data-type="played">パチンコに行った日</button>
          <button class="banner skipped big" data-type="skipped">パチンコに行かなかった日</button>`;
        return;
      }

      const urge = `
        <h2 class="sec-title">行きたい気持ちの強さ</h2>
        <div class="faces">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-urge="${n}" aria-label="強さ${n}" aria-pressed="${f.urge === n}">${face(n, f.urge === n)}</button>`).join('')}</div>
        <div class="faces-scale"><span>弱い</span><span>強い</span></div>`;
      const triggers = `
        <h2 class="sec-title">なぜ行きたくなったか（複数選択可）</h2>
        <div class="box chips">${Store.TRIGGERS.map((t) => `<button type="button" class="chip ${f.triggers.includes(t) ? 'on' : ''}" data-trigger="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
      const memo = `
        <h2 class="sec-title">気持ち・出来事のメモ</h2>
        <textarea id="memo" class="box memo" rows="3" placeholder="気づいたことや出来事を書きましょう">${esc(f.memo)}</textarea>`;

      let main;
      if (f.type === 'played') {
        const kept = keptValue();
        main = `
          <h2 class="sec-title">遊技の記録</h2>
          <div class="box rows">
            <label class="row"><span>使用金額</span><span class="val"><input id="amount" inputmode="numeric" value="${f.amount === '' ? '' : num(f.amount)}" placeholder="0"> 円</span></label>
            <label class="row"><span>収支</span><span class="val"><button type="button" class="sign" id="sign" aria-label="プラス・マイナス切替">${f.balSign < 0 ? '−' : '+'}</button><input id="balance" inputmode="numeric" value="${f.balAbs === '' ? '' : num(f.balAbs)}" placeholder="0"> 円</span></label>
            <div class="row"><span>予算（${num(budget)}円以内）</span>
              <button type="button" class="kept ${kept === null ? '' : kept ? 'ok' : 'ng'}" id="kept">${kept === null ? '金額を入力' : kept
                ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6.5" class="mk"/></svg>守れた'
                : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m8.5 8.5 7 7m0-7-7 7" class="mk"/></svg>守れなかった'}</button>
            </div>
          </div>`;
      } else {
        main = `
          <h2 class="sec-title">行動したこと（複数選択可）</h2>
          <div class="tiles">${Store.ACTIONS.map((a) => {
            const on = f.actions.includes(a.id);
            return `<button type="button" class="tile ${on ? 'on' : ''}" data-action="${a.id}" aria-pressed="${on}">
              ${on ? '<svg viewBox="0 0 24 24" class="check"><circle cx="12" cy="12" r="11"/><path d="m7 12.5 3.2 3.2L17 9" class="mk"/></svg>' : `<span class="tile-ic">${icon(a.id)}</span>`}
              <span>${a.label}</span></button>`;
          }).join('')}</div>`;
      }

      $rec.innerHTML = `
        <div class="banner ${f.type}">${f.type === 'played' ? 'パチンコに行った日' : 'パチンコに行かなかった日'}</div>
        ${main}${urge}${triggers}${memo}`;
    }

    function readInputs() {
      const a = document.getElementById('amount');
      const b = document.getElementById('balance');
      const m = document.getElementById('memo');
      if (a) f.amount = a.value.replace(/\D/g, '');
      if (b) f.balAbs = b.value.replace(/\D/g, '');
      if (m) f.memo = m.value;
    }

    $rec.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      readInputs();
      if (t.dataset.type) f.type = t.dataset.type;
      else if (t.dataset.urge) f.urge = f.urge === Number(t.dataset.urge) ? 0 : Number(t.dataset.urge);
      else if (t.dataset.trigger) toggle(f.triggers, t.dataset.trigger);
      else if (t.dataset.action) toggle(f.actions, t.dataset.action);
      else if (t.id === 'sign') f.balSign *= -1;
      else if (t.id === 'kept') { const k = keptValue(); if (k === null) return; f.budgetKept = !k; }
      else return;
      draw();
    });

    // 金額は入力中も3桁区切りで表示
    $rec.addEventListener('input', (e) => {
      if (e.target.id !== 'amount' && e.target.id !== 'balance') return;
      const digits = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
      e.target.value = digits ? num(digits) : '';
      readInputs();
      if (e.target.id === 'amount' && f.budgetKept === null) {
        const k = autoKept();
        const btn = document.getElementById('kept');
        btn.className = 'kept ' + (k === null ? '' : k ? 'ok' : 'ng');
        btn.innerHTML = k === null ? '金額を入力' : k
          ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6.5" class="mk"/></svg>守れた'
          : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m8.5 8.5 7 7m0-7-7 7" class="mk"/></svg>守れなかった';
      }
    });

    function toggle(arr, v) { const i = arr.indexOf(v); i >= 0 ? arr.splice(i, 1) : arr.push(v); }

    draw();

    document.getElementById('back').onclick = () => back(ui.from || 'calendar');

    document.getElementById('more').onclick = (e) => {
      e.stopPropagation();
      readInputs();
      const items = [];
      if (f.type) items.push(`<button data-m="switch">「${f.type === 'played' ? 'パチンコに行かなかった日' : 'パチンコに行った日'}」に変更</button>`);
      if (existing) items.push('<button data-m="delete" class="danger">記録を削除（未記録に戻す）</button>');
      if (!items.length) items.push('<button data-m="close">閉じる</button>');
      $menu.innerHTML = items.join('');
      $menu.hidden = !$menu.hidden;
    };
    $menu.onclick = (e) => {
      const m = e.target.closest('button')?.dataset.m;
      $menu.hidden = true;
      if (m === 'switch') { f.type = f.type === 'played' ? 'skipped' : 'played'; draw(); }
      if (m === 'delete' && confirm('この日の記録を削除して「未記録」に戻しますか？')) {
        Store.deleteRecord(key);
        toast('記録を削除しました');
        back(ui.from || 'calendar');
      }
    };
    $view.addEventListener('click', (e) => { if (!e.target.closest('#menu, #more')) $menu.hidden = true; });

    document.getElementById('save').onclick = () => {
      readInputs();
      if (!f.type) { toast('行った日か行かなかった日かを選んでください'); return; }
      const base = { type: f.type, urge: f.urge || null, triggers: f.triggers, memo: f.memo.trim() };
      if (f.type === 'played') {
        if (f.amount === '') { toast('使用金額を入力してください'); document.getElementById('amount').focus(); return; }
        Store.setRecord(key, { ...base, amount: Number(f.amount), balance: f.balAbs === '' ? 0 : f.balSign * Number(f.balAbs), budgetKept: keptValue(), actions: [] });
      } else {
        Store.setRecord(key, { ...base, actions: f.actions });
      }
      toast('保存しました');
      ui.selected = key;
      back(ui.from || 'calendar');
    };
  }

  // ---------------- 予定の追加・編集 ----------------
  function renderPlan(date, id) {
    const existing = id === 'new' ? null : Store.getPlan(id);
    if (id !== 'new' && !existing) { go('calendar'); return; }
    const todayKey = Store.todayKey();
    const f = {
      kind: existing?.kind || 'ga',
      date: existing?.date || date,
      time: existing?.time || '',
      note: existing?.note || '',
      status: existing?.status || 'planned',
    };

    const backBtn = `<button class="icon-btn" id="back" aria-label="戻る"><svg viewBox="0 0 24 24" class="stroke"><path d="M20 12H5m6-6-6 6 6 6"/></svg></button>`;
    const delBtn = existing ? `<button class="icon-btn" id="del" aria-label="予定を削除"><svg viewBox="0 0 24 24" class="stroke"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg></button>` : '';

    $view.innerHTML = appbar(existing ? '予定の編集' : '予定の追加', backBtn, delBtn) + `
      <div class="page record" id="plan"></div>
      <div class="savebar"><button class="btn-primary" id="save">保存する</button></div>`;
    const $plan = document.getElementById('plan');

    function draw() {
      const past = f.date && f.date <= todayKey;
      $plan.innerHTML = `
        <h2 class="sec-title">種類</h2>
        <div class="tiles">${Store.PLAN_KINDS.map((k) => {
          const on = f.kind === k.id;
          return `<button type="button" class="tile ${on ? 'on' : ''}" data-kind="${k.id}" aria-pressed="${on}">
            <span class="tile-ic">${icon(PLAN_ICON[k.id])}</span><span>${k.label}</span></button>`;
        }).join('')}</div>

        <h2 class="sec-title">日時</h2>
        <div class="box rows">
          <label class="row"><span>日付</span><input type="date" id="p-date" class="field slim" value="${esc(f.date)}"></label>
          <label class="row"><span>時刻（任意）</span><input type="time" id="p-time" class="field slim" value="${esc(f.time)}"></label>
        </div>

        <h2 class="sec-title">場所・メモ</h2>
        <textarea id="p-note" class="box memo" rows="3" placeholder="会場や持ち物など">${esc(f.note)}</textarea>

        ${past ? `
          <h2 class="sec-title">参加状況</h2>
          <div class="seg3">
            <button type="button" data-status="attended" class="${f.status === 'attended' ? 'on ok' : ''}">参加した</button>
            <button type="button" data-status="missed" class="${f.status === 'missed' ? 'on ng' : ''}">参加しなかった</button>
            <button type="button" data-status="planned" class="${f.status === 'planned' ? 'on' : ''}">未確認</button>
          </div>
          <p class="hint-text">「参加した」にするとカレンダーの日付が実績の色になります</p>` : ''}`;
    }

    function readInputs() {
      f.date = document.getElementById('p-date').value;
      f.time = document.getElementById('p-time').value;
      f.note = document.getElementById('p-note').value;
    }

    $plan.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      readInputs();
      if (t.dataset.kind) f.kind = t.dataset.kind;
      else if (t.dataset.status) f.status = t.dataset.status;
      else return;
      draw();
    });
    // 日付を変えたら参加状況欄の表示を切り替える
    $plan.addEventListener('change', (e) => { if (e.target.id === 'p-date') { readInputs(); draw(); } });

    draw();

    const done = (key) => {
      ui.selected = key;
      const d = Store.fromKey(key);
      ui.calYear = d.getFullYear();
      ui.calMonth = d.getMonth();
      go('calendar');
    };

    document.getElementById('back').onclick = () => done(existing?.date || date);
    if (existing) document.getElementById('del').onclick = () => {
      if (!confirm('この予定を削除しますか？')) return;
      Store.deletePlan(existing.id);
      toast('予定を削除しました');
      done(existing.date);
    };
    document.getElementById('save').onclick = () => {
      readInputs();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) { toast('日付を入力してください'); return; }
      Store.setPlan({
        id: existing?.id,
        kind: f.kind,
        date: f.date,
        time: f.time,
        note: f.note.trim(),
        status: f.date > todayKey ? 'planned' : f.status,
      });
      toast('予定を保存しました');
      done(f.date);
    };
  }

  // ---------------- 振り返り ----------------
  function renderReview() {
    const y = ui.revYear, m = ui.revMonth;
    const s = Store.monthStats(y, m);
    const prev = `<button class="icon-btn" id="prev" aria-label="前の月"><svg viewBox="0 0 24 24" class="stroke"><path d="m15 6-6 6 6 6"/></svg></button>`;
    const next = `<button class="icon-btn" id="next" aria-label="次の月"><svg viewBox="0 0 24 24" class="stroke"><path d="m9 6 6 6-6 6"/></svg></button>`;

    $view.innerHTML = appbar(`${y}年${m + 1}月`, prev, next) + `
      <div class="page review">
        <h2 class="sec-title">今月のまとめ</h2>
        <div class="trio">
          <div class="box sum"><p>遊技日数</p><strong class="${s.playedDays > Store.settings.monthlyGoal ? 'red' : ''}">${s.playedDays}<small>日</small></strong></div>
          <div class="box sum"><p>行かなかった日数</p><strong class="green">${s.skippedDays}<small>日</small></strong></div>
          <div class="box sum"><p>予算を守れた割合</p><strong>${s.keepRate === null ? '—' : s.keepRate}<small>${s.keepRate === null ? '' : '%'}</small></strong></div>
        </div>
        <div class="kv"><span>収支合計</span><strong class="${s.balance < 0 ? 'red' : s.balance > 0 ? 'green' : ''}">${s.playedDays ? signed(s.balance) : '—'}<small>${s.playedDays ? ' 円' : ''}</small></strong></div>
        <div class="kv"><span>予算超過</span><strong class="${s.overBudget ? 'red' : ''}">${s.overBudget}<small> 回</small></strong></div>

        <h2 class="sec-title">改善行動の回数</h2>
        <ul class="box count-list compact">
          ${ACTION_GROUPS.map((g) => `<li>${icon(g.icon)}<span>${g.label}</span><b>${groupCount(s, g)}</b>回</li>`).join('')}
        </ul>

        <h2 class="sec-title">気持ちの強さの傾向（行きたい気持ち）</h2>
        <div class="box chart-box">${urgeChart(y, m, s)}</div>
      </div>`;
    document.getElementById('prev').onclick = () => shiftMonth('rev', -1);
    document.getElementById('next').onclick = () => shiftMonth('rev', 1);
  }

  // 週ごとの「行きたい気持ち」を 強い(4-5)・ふつう(3)・弱い(1-2) で積み上げ
  function urgeChart(y, m, s) {
    const weeks = [[1, 7], [8, 14], [15, 21], [22, s.daysInMonth]];
    const data = weeks.map(([a, b]) => {
      const c = { high: 0, mid: 0, low: 0 };
      s.records.forEach((r) => {
        const d = Store.fromKey(r.key).getDate();
        if (r.urge && d >= a && d <= b) c[r.urge >= 4 ? 'high' : r.urge === 3 ? 'mid' : 'low']++;
      });
      return { label: `${m + 1}/${a}-${m + 1}/${b}`, ...c };
    });
    const W = 320, H = 170, L = 26, R = 6, T = 8, B = 24, MAX = 7;
    const yy = (v) => T + (1 - v / MAX) * (H - T - B);
    const colW = (W - L - R) / 4, barW = colW * 0.5;
    const grid = [0, 2, 4, 6].map((v) => `<line x1="${L}" x2="${W - R}" y1="${yy(v)}" y2="${yy(v)}" class="grid"/><text x="${L - 7}" y="${yy(v) + 3.5}" class="axis" text-anchor="end">${v}</text>`).join('');
    const bars = data.map((d, i) => {
      const x = L + colW * i + (colW - barW) / 2;
      let acc = 0, out = '';
      [['low', 'g'], ['mid', 'o'], ['high', 'r']].forEach(([k, cls]) => {
        if (!d[k]) return;
        out += `<rect x="${x}" y="${yy(acc + d[k])}" width="${barW}" height="${yy(acc) - yy(acc + d[k])}" class="${cls}"/>`;
        acc += d[k];
      });
      return out + `<text x="${x + barW / 2}" y="${H - 6}" class="axis" text-anchor="middle">${d.label}</text>`;
    }).join('');
    return `
      <div class="chart-legend"><span><i class="r"></i>強い</span><span><i class="o"></i>ふつう</span><span><i class="g"></i>弱い</span></div>
      <svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="週ごとの行きたい気持ちの強さ">${grid}${bars}</svg>
      ${data.some((d) => d.high + d.mid + d.low) ? '' : '<p class="chart-empty">この月の記録はまだありません</p>'}`;
  }

  // ---------------- 設定 ----------------
  function renderSettings(sub) {
    if (sub === 'goal') return renderGoal();
    if (sub === 'reminder') return renderReminder();
    if (sub === 'backup') return renderBackup();
    const st = Store.settings;
    $view.innerHTML = appbar('設定') + `
      <div class="page">
        <section class="card list">
          <button class="item" data-go="settings/goal">
            <div><p class="item-title">目標設定</p><p class="item-sub">月の遊技回数の目標：${st.monthlyGoal}回以内<br>1回あたりの予算：${num(st.budget)}円以内</p></div>${CHEVRON}
          </button>
          <div class="item">
            <button class="item-main" data-go="settings/reminder"><p class="item-title">リマインダー設定</p><p class="item-sub">${st.line.enabled ? `毎日 ${esc(st.line.time)} にLINEで記録を促す` : 'LINE通知：オフ'}</p></button>
            <label class="switch"><input type="checkbox" id="line-on" ${st.line.enabled ? 'checked' : ''} aria-label="LINE通知"><span></span></label>
          </div>
          <button class="item" data-go="settings/backup">
            <div><p class="item-title">データのバックアップ</p><p class="item-sub">データをエクスポート（CSV）<br>バックアップから復元</p></div>${CHEVRON}
          </button>
        </section>
        <p class="foot-note">記録はこの端末内に保存されます</p>
      </div>`;
    $view.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => go(b.dataset.go)));
    document.getElementById('line-on').addEventListener('change', (e) => {
      Store.updateSettings({ line: { enabled: e.target.checked } });
      syncLine();
      renderSettings();
    });
  }

  const subBar = (title) => appbar(title, `<button class="icon-btn" id="back" aria-label="戻る"><svg viewBox="0 0 24 24" class="stroke"><path d="M20 12H5m6-6-6 6 6 6"/></svg></button>`);

  function renderGoal() {
    const st = Store.settings;
    $view.innerHTML = subBar('目標設定') + `
      <div class="page">
        <section class="card list">
          <div class="item">
            <div><p class="item-title">月の遊技回数の目標</p><p class="item-sub">この回数以内に抑える</p></div>
            <div class="stepper"><button class="step" id="dec" aria-label="減らす">−</button><b id="goal">${st.monthlyGoal}回</b><button class="step" id="inc" aria-label="増やす">＋</button></div>
          </div>
          <div class="item">
            <div><p class="item-title">1回あたりの予算</p><p class="item-sub">これを超えたら予算超過</p></div>
            <span class="val"><input id="budget" inputmode="numeric" value="${num(st.budget)}"> 円</span>
          </div>
        </section>
      </div>`;
    document.getElementById('back').onclick = () => back('settings');
    const step = (d) => {
      const v = Math.max(0, Math.min(31, Store.settings.monthlyGoal + d));
      Store.updateSettings({ monthlyGoal: v });
      document.getElementById('goal').textContent = `${v}回`;
    };
    document.getElementById('dec').onclick = () => step(-1);
    document.getElementById('inc').onclick = () => step(1);
    const $b = document.getElementById('budget');
    $b.addEventListener('input', () => { const d = $b.value.replace(/\D/g, ''); $b.value = d ? num(d) : ''; });
    $b.addEventListener('change', () => {
      const v = Number($b.value.replace(/\D/g, '')) || 0;
      Store.updateSettings({ budget: v });
      $b.value = num(v);
      toast('予算を保存しました');
    });
  }

  function renderReminder() {
    const l = Store.settings.line;
    $view.innerHTML = subBar('リマインダー設定') + `
      <div class="page">
        <section class="card list">
          <div class="item">
            <div><p class="item-title">LINE通知</p><p class="item-sub">毎日、記録をつけるよう促します</p></div>
            <label class="switch"><input type="checkbox" id="line-on" ${l.enabled ? 'checked' : ''} aria-label="LINE通知"><span></span></label>
          </div>
          <div class="item ${l.enabled ? '' : 'off'}">
            <p class="item-title">通知時刻</p>
            <input type="time" id="line-time" class="field" value="${esc(l.time)}" ${l.enabled ? '' : 'disabled'}>
          </div>
          <div class="item col ${l.enabled ? '' : 'off'}">
            <p class="item-title">通知サーバーURL</p>
            <input type="url" id="line-ep" class="field" placeholder="https://example.com" value="${esc(l.endpoint)}" ${l.enabled ? '' : 'disabled'}>
            <p class="item-sub">LINEへの送信はアプリとは別の通知サービス（line-notifier）が行います。送るのはオン/オフと時刻だけで、記録内容は送りません。</p>
          </div>
        </section>
      </div>`;
    document.getElementById('back').onclick = () => back('settings');
    document.getElementById('line-on').addEventListener('change', (e) => {
      Store.updateSettings({ line: { enabled: e.target.checked } }); syncLine(); renderReminder();
    });
    document.getElementById('line-time').addEventListener('change', (e) => { Store.updateSettings({ line: { time: e.target.value } }); syncLine(); });
    document.getElementById('line-ep').addEventListener('change', (e) => { Store.updateSettings({ line: { endpoint: e.target.value.trim() } }); syncLine(); });
  }

  async function syncLine() {
    const r = await LineBridge.sync(Store.settings.line);
    if (r.ok) toast('通知サービスに設定を送りました');
    else if (r.reason !== 'no-endpoint') toast('通知サービスに接続できませんでした');
  }

  function renderBackup() {
    $view.innerHTML = subBar('データのバックアップ') + `
      <div class="page">
        <section class="card list">
          <button class="item" id="export"><div><p class="item-title">データをエクスポート（CSV）</p><p class="item-sub">すべての記録をCSVファイルに保存</p></div>${CHEVRON}</button>
          <label class="item"><div><p class="item-title">バックアップから復元</p><p class="item-sub">エクスポートしたCSVを読み込む（現在の記録は置き換わります）</p></div>${CHEVRON}<input type="file" id="import" accept=".csv,text/csv" hidden></label>
        </section>
      </div>`;
    document.getElementById('back').onclick = () => back('settings');
    document.getElementById('export').onclick = () => {
      const blob = new Blob([Store.exportCSV()], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `pachinko-record-${Store.todayKey()}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    document.getElementById('import').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file || !confirm('現在の記録をバックアップの内容に置き換えますか？')) return;
      try { toast(`${Store.importCSV(await file.text())}日分を復元しました`); }
      catch (err) { toast('読み込みに失敗しました'); }
    });
  }

  // ---------------- 起動 ----------------
  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
