// 画面描画とルーティング
(function () {
  const $view = document.getElementById('view');
  const $sheetRoot = document.getElementById('sheet-root');
  const $toast = document.getElementById('toast');
  const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

  const ui = {
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth(),
    revYear: new Date().getFullYear(),
    revMonth: new Date().getMonth(),
  };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const yen = (n) => `${Number(n || 0).toLocaleString('ja-JP')}円`;
  const signedYen = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n).toLocaleString('ja-JP') + '円';
  const jpDate = (key) => { const d = Store.fromKey(key); return `${d.getMonth() + 1}月${d.getDate()}日（${WEEK[d.getDay()]}）`; };

  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => $toast.classList.remove('show'), 1800);
  }

  // ---------------- ルーティング ----------------
  const routes = { home: renderHome, calendar: renderCalendar, review: renderReview, settings: renderSettings };

  function currentRoute() {
    const r = location.hash.replace('#', '');
    return routes[r] ? r : 'home';
  }

  function render() {
    const r = currentRoute();
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.route === r));
    routes[r]();
    $view.scrollTop = 0;
  }

  document.querySelectorAll('.tab').forEach((t) =>
    t.addEventListener('click', () => { location.hash = t.dataset.route; }));
  window.addEventListener('hashchange', render);

  // ---------------- ホーム ----------------
  function renderHome() {
    const now = new Date();
    const s = Store.monthStats(now.getFullYear(), now.getMonth());
    const goal = Store.settings.monthlyGoal;
    const today = Store.getRecord(Store.todayKey());
    const streak = Store.skipStreak();
    const todayLabel = !today ? '未記録' : today.type === 'played' ? '行った日として記録済み' : '行かなかった日として記録済み';

    $view.innerHTML = `
      <header class="page-head">
        <p class="page-sub">${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日（${WEEK[now.getDay()]}）</p>
        <h1 class="page-title">ホーム</h1>
      </header>

      <section class="card hero">
        <p class="hero-label">連続で行っていない日数</p>
        <p class="hero-value"><span>${streak}</span>日</p>
        <p class="hero-note">${streak ? 'この調子で続けましょう' : '今日から一日ずつ積み重ねましょう'}</p>
      </section>

      <section class="stat-grid">
        <div class="card stat">
          <p class="stat-label">今月の遊技日数</p>
          <p class="stat-value ${s.playedDays > goal ? 'is-over' : ''}">${s.playedDays}<small>/ 目標${goal}回</small></p>
        </div>
        <div class="card stat">
          <p class="stat-label">予算遵守率</p>
          <p class="stat-value">${s.keepRate === null ? '—' : s.keepRate}<small>${s.keepRate === null ? '' : '%'}</small></p>
        </div>
        <div class="card stat stat-wide">
          <p class="stat-label">今月の改善行動</p>
          <p class="stat-value">${s.actionTotal}<small>回</small></p>
        </div>
      </section>

      <section class="card today">
        <div>
          <p class="today-label">今日の記録</p>
          <p class="today-status ${today ? 'status-' + today.type : 'status-none'}">${todayLabel}</p>
        </div>
        <button class="btn btn-primary btn-block" id="today-btn">${today ? '今日の記録を編集' : '今日の記録をつける'}</button>
      </section>
    `;
    document.getElementById('today-btn').onclick = () => openRecordSheet(Store.todayKey());
  }

  // ---------------- カレンダー ----------------
  function renderCalendar() {
    const y = ui.calYear, m = ui.calMonth;
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const todayKey = Store.todayKey();
    const s = Store.monthStats(y, m);

    let cells = '';
    for (let i = 0; i < first; i++) cells += '<div class="cal-cell empty"></div>';
    for (let d = 1; d <= days; d++) {
      const key = Store.toKey(new Date(y, m, d));
      const rec = Store.getRecord(key);
      const future = key > todayKey;
      const cls = rec ? rec.type : future ? 'future' : 'none';
      cells += `<button class="cal-cell ${cls} ${key === todayKey ? 'today' : ''}" data-key="${key}" ${future ? 'disabled' : ''}
        aria-label="${m + 1}月${d}日 ${rec ? (rec.type === 'played' ? '行った' : '行かなかった') : '未記録'}">${d}</button>`;
    }

    $view.innerHTML = `
      <header class="page-head"><h1 class="page-title">カレンダー</h1></header>
      <section class="card">
        <div class="month-nav">
          <button class="icon-btn" id="prev" aria-label="前の月">‹</button>
          <h2>${y}年${m + 1}月</h2>
          <button class="icon-btn" id="next" aria-label="次の月">›</button>
        </div>
        <div class="cal-week">${WEEK.map((w, i) => `<span class="${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${w}</span>`).join('')}</div>
        <div class="cal-grid">${cells}</div>
        <div class="legend">
          <span><i class="dot played"></i>行った</span>
          <span><i class="dot skipped"></i>行かなかった</span>
          <span><i class="dot none"></i>未記録</span>
        </div>
      </section>
      <section class="card mini-summary">
        <div><p>行った</p><strong class="c-played">${s.playedDays}日</strong></div>
        <div><p>行かなかった</p><strong class="c-skipped">${s.skippedDays}日</strong></div>
        <div><p>未記録</p><strong class="c-none">${countUnrecorded(y, m)}日</strong></div>
      </section>
      <p class="hint">日付をタップすると記録・編集できます</p>
    `;
    document.getElementById('prev').onclick = () => shiftMonth('cal', -1);
    document.getElementById('next').onclick = () => shiftMonth('cal', 1);
    $view.querySelectorAll('.cal-cell[data-key]').forEach((b) =>
      b.addEventListener('click', () => openRecordSheet(b.dataset.key)));
  }

  // 今日までの日で記録がない日数
  function countUnrecorded(y, m) {
    const todayKey = Store.todayKey();
    const days = new Date(y, m + 1, 0).getDate();
    let n = 0;
    for (let d = 1; d <= days; d++) {
      const key = Store.toKey(new Date(y, m, d));
      if (key <= todayKey && !Store.getRecord(key)) n++;
    }
    return n;
  }

  function shiftMonth(prefix, delta) {
    const d = new Date(ui[prefix + 'Year'], ui[prefix + 'Month'] + delta, 1);
    ui[prefix + 'Year'] = d.getFullYear();
    ui[prefix + 'Month'] = d.getMonth();
    render();
  }

  // ---------------- 記録シート ----------------
  function openRecordSheet(key) {
    const existing = Store.getRecord(key);
    const budget = Store.settings.budget;
    const f = {
      type: existing?.type || null,
      amount: existing?.amount ?? '',
      balAbs: existing?.balance ? Math.abs(existing.balance) : '',
      balSign: existing?.balance < 0 ? -1 : 1,
      budgetKept: existing?.budgetKept ?? null,
      urge: existing?.urge || 0,
      triggers: [...(existing?.triggers || [])],
      actions: [...(existing?.actions || [])],
      memo: existing?.memo || '',
    };

    $sheetRoot.innerHTML = `
      <div class="sheet-backdrop" data-close></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div class="sheet-handle"></div>
        <div class="sheet-head">
          <h2 id="sheet-title">${jpDate(key)}の記録</h2>
          <button class="icon-btn" data-close aria-label="閉じる">×</button>
        </div>
        <div class="sheet-body" id="sheet-body"></div>
        <div class="sheet-foot">
          ${existing ? '<button class="btn btn-ghost" id="del">記録を消す</button>' : ''}
          <button class="btn btn-primary" id="save">保存する</button>
        </div>
      </div>`;
    document.body.classList.add('no-scroll');
    requestAnimationFrame(() => $sheetRoot.classList.add('open'));

    const body = document.getElementById('sheet-body');

    function drawBody() {
      const chips = (list, sel, attr) => list.map((x) => {
        const id = typeof x === 'string' ? x : x.id;
        const label = typeof x === 'string' ? x : x.label;
        return `<button type="button" class="chip ${sel.includes(id) ? 'on' : ''}" data-${attr}="${esc(id)}">${esc(label)}</button>`;
      }).join('');

      const urgeRow = `
        <div class="field">
          <label>行きたい気持ちの強さ</label>
          <div class="urge">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="urge-btn ${f.urge === n ? 'on' : ''}" data-urge="${n}">${n}</button>`).join('')}</div>
          <div class="urge-scale"><span>弱い</span><span>強い</span></div>
        </div>`;
      const triggerRow = `<div class="field"><label>きっかけ</label><div class="chips">${chips(Store.TRIGGERS, f.triggers, 'trigger')}</div></div>`;
      const memoRow = `<div class="field"><label for="memo">メモ</label><textarea id="memo" rows="3" placeholder="気づいたことなど">${esc(f.memo)}</textarea></div>`;

      let detail = '';
      if (f.type === 'played') {
        const autoKept = f.amount !== '' && Number(f.amount) <= budget;
        detail = `
          <div class="field">
            <label for="amount">使用金額</label>
            <div class="input-unit"><input id="amount" type="number" inputmode="numeric" min="0" step="100" value="${esc(f.amount)}" placeholder="0"><span>円</span></div>
          </div>
          <div class="field">
            <label for="balance">収支</label>
            <div class="seg small" id="bal-sign">
              <button type="button" data-sign="1" class="${f.balSign === 1 ? 'on' : ''}">プラス</button>
              <button type="button" data-sign="-1" class="${f.balSign === -1 ? 'on' : ''}">マイナス</button>
            </div>
            <div class="input-unit"><input id="balance" type="number" inputmode="numeric" min="0" step="100" value="${esc(f.balAbs)}" placeholder="0"><span>円</span></div>
          </div>
          <div class="field">
            <label>${yen(budget)}の予算を守れたか</label>
            <div class="seg">
              <button type="button" data-kept="1" class="${f.budgetKept === true ? 'on ok' : ''}">守れた</button>
              <button type="button" data-kept="0" class="${f.budgetKept === false ? 'on ng' : ''}">守れなかった</button>
            </div>
            ${f.amount !== '' && f.budgetKept === null ? `<p class="field-note">使用金額からの目安：${autoKept ? '予算内' : '予算超過'}</p>` : ''}
          </div>
          ${urgeRow}${triggerRow}${memoRow}`;
      } else if (f.type === 'skipped') {
        detail = `
          <div class="field">
            <label>改善行動（複数選択可）</label>
            <div class="chips">${chips(Store.ACTIONS, f.actions, 'action')}</div>
          </div>
          ${urgeRow}${triggerRow}${memoRow}`;
      } else {
        detail = '<p class="field-note center">まず「行った」か「行かなかった」かを選んでください</p>';
      }

      body.innerHTML = `
        <div class="type-switch">
          <button type="button" class="type-btn played ${f.type === 'played' ? 'on' : ''}" data-type="played">行った</button>
          <button type="button" class="type-btn skipped ${f.type === 'skipped' ? 'on' : ''}" data-type="skipped">行かなかった</button>
        </div>
        ${detail}`;
    }

    function readInputs() {
      const a = document.getElementById('amount');
      const b = document.getElementById('balance');
      const memo = document.getElementById('memo');
      if (a) f.amount = a.value === '' ? '' : Math.max(0, Number(a.value));
      if (b) f.balAbs = b.value === '' ? '' : Math.abs(Number(b.value));
      if (memo) f.memo = memo.value;
    }

    body.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      readInputs();
      if (t.dataset.type) f.type = t.dataset.type;
      else if (t.dataset.urge) f.urge = f.urge === Number(t.dataset.urge) ? 0 : Number(t.dataset.urge);
      else if (t.dataset.trigger) toggle(f.triggers, t.dataset.trigger);
      else if (t.dataset.action) toggle(f.actions, t.dataset.action);
      else if (t.dataset.kept) f.budgetKept = t.dataset.kept === '1';
      else if (t.dataset.sign) f.balSign = Number(t.dataset.sign);
      drawBody();
    });

    body.addEventListener('input', (e) => {
      if (e.target.id === 'amount') {
        // 予算判定の目安表示を更新
        const prev = f.amount;
        readInputs();
        if ((prev === '') !== (f.amount === '') && f.budgetKept === null) {
          const pos = e.target.selectionStart; drawBody();
          const el = document.getElementById('amount'); el.focus(); try { el.setSelectionRange(pos, pos); } catch (_) {}
        }
      }
    });

    function toggle(arr, v) { const i = arr.indexOf(v); i >= 0 ? arr.splice(i, 1) : arr.push(v); }

    drawBody();

    $sheetRoot.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeSheet));

    document.getElementById('save').onclick = () => {
      readInputs();
      if (!f.type) { toast('「行った」か「行かなかった」を選んでください'); return; }
      const base = { type: f.type, urge: f.urge || null, triggers: f.triggers, memo: f.memo.trim() };
      let rec;
      if (f.type === 'played') {
        if (f.amount === '') { toast('使用金額を入力してください'); return; }
        const kept = f.budgetKept === null ? Number(f.amount) <= budget : f.budgetKept;
        rec = { ...base, amount: Number(f.amount), balance: f.balAbs === '' ? 0 : f.balSign * Math.round(f.balAbs), budgetKept: kept, actions: [] };
      } else {
        rec = { ...base, actions: f.actions };
      }
      Store.setRecord(key, rec);
      closeSheet();
      toast('保存しました');
      render();
    };

    const del = document.getElementById('del');
    if (del) del.onclick = () => {
      if (!confirm('この日の記録を消して「未記録」に戻しますか？')) return;
      Store.deleteRecord(key);
      closeSheet();
      toast('記録を消しました');
      render();
    };
  }

  function closeSheet() {
    $sheetRoot.classList.remove('open');
    document.body.classList.remove('no-scroll');
    setTimeout(() => { if (!$sheetRoot.classList.contains('open')) $sheetRoot.innerHTML = ''; }, 250);
  }

  // ---------------- 振り返り ----------------
  function renderReview() {
    const y = ui.revYear, m = ui.revMonth;
    const s = Store.monthStats(y, m);
    const goal = Store.settings.monthlyGoal;
    const maxAction = Math.max(1, ...Object.values(s.actionCounts));

    $view.innerHTML = `
      <header class="page-head"><h1 class="page-title">振り返り</h1></header>
      <section class="card">
        <div class="month-nav">
          <button class="icon-btn" id="prev" aria-label="前の月">‹</button>
          <h2>${y}年${m + 1}月</h2>
          <button class="icon-btn" id="next" aria-label="次の月">›</button>
        </div>
        <div class="review-grid">
          <div class="review-item">
            <p>遊技日数</p>
            <strong class="${s.playedDays > goal ? 'c-played' : ''}">${s.playedDays}<small>日</small></strong>
            <span class="${s.playedDays > goal ? 'tag ng' : 'tag ok'}">${s.playedDays > goal ? `目標${goal}回を超過` : `目標${goal}回以内`}</span>
          </div>
          <div class="review-item">
            <p>予算超過</p>
            <strong class="${s.overBudget ? 'c-played' : ''}">${s.overBudget}<small>回</small></strong>
            <span class="tag ${s.overBudget ? 'ng' : 'ok'}">${s.playedDays ? `遵守 ${s.budgetKept}/${s.playedDays}回` : '遊技なし'}</span>
          </div>
          <div class="review-item">
            <p>収支</p>
            <strong class="small">${s.playedDays ? signedYen(s.balance) : '—'}</strong>
            <span class="tag muted">使用 ${yen(s.spent)}</span>
          </div>
          <div class="review-item">
            <p>記録した日</p>
            <strong>${s.recordedDays}<small>/${s.daysInMonth}日</small></strong>
            <span class="tag muted">行かなかった ${s.skippedDays}日</span>
          </div>
        </div>
      </section>

      <section class="card">
        <h3 class="card-title">改善行動 <span class="card-title-sub">合計 ${s.actionTotal}回</span></h3>
        <ul class="bars">
          ${Store.ACTIONS.map((a) => `
            <li>
              <span class="bar-label">${a.label}</span>
              <span class="bar-track"><span class="bar-fill" style="width:${(s.actionCounts[a.id] / maxAction) * 100}%"></span></span>
              <span class="bar-val">${s.actionCounts[a.id]}</span>
            </li>`).join('')}
        </ul>
      </section>

      <section class="card">
        <h3 class="card-title">行きたい気持ちの推移</h3>
        ${urgeChart(s)}
      </section>
    `;
    document.getElementById('prev').onclick = () => shiftMonth('rev', -1);
    document.getElementById('next').onclick = () => shiftMonth('rev', 1);
  }

  function urgeChart(s) {
    if (!s.urges.length) return '<p class="empty-note">この月の記録はまだありません</p>';
    const W = 320, H = 150, L = 22, R = 8, T = 10, B = 22;
    const x = (d) => L + ((d - 1) / Math.max(1, s.daysInMonth - 1)) * (W - L - R);
    const yy = (u) => T + (1 - (u - 1) / 4) * (H - T - B);
    const grid = [1, 2, 3, 4, 5].map((u) => `<line x1="${L}" x2="${W - R}" y1="${yy(u)}" y2="${yy(u)}" class="grid"/><text x="${L - 8}" y="${yy(u) + 3}" class="axis" text-anchor="end">${u}</text>`).join('');
    const ticks = [1, 10, 20, s.daysInMonth].map((d) => `<text x="${x(d)}" y="${H - 6}" class="axis" text-anchor="middle">${d}日</text>`).join('');
    const path = s.urges.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)},${yy(p.urge).toFixed(1)}`).join(' ');
    const dots = s.urges.map((p) => `<circle cx="${x(p.day)}" cy="${yy(p.urge)}" r="4" class="pt ${p.type}"/>`).join('');
    const avg = (s.urges.reduce((a, p) => a + p.urge, 0) / s.urges.length).toFixed(1);
    return `
      <svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="行きたい気持ちの推移">${grid}${ticks}<path d="${path}" class="line"/>${dots}</svg>
      <div class="chart-foot"><span>平均 <strong>${avg}</strong> / 5</span><span class="legend small"><span><i class="dot played"></i>行った日</span><span><i class="dot skipped"></i>行かなかった日</span></span></div>`;
  }

  // ---------------- 設定 ----------------
  function renderSettings() {
    const st = Store.settings;
    $view.innerHTML = `
      <header class="page-head"><h1 class="page-title">設定</h1></header>

      <h3 class="group-title">自分で決めたルール</h3>
      <section class="card list">
        <div class="row">
          <div><p class="row-title">月の遊技目標</p><p class="row-sub">この回数以内に抑える</p></div>
          <div class="stepper">
            <button type="button" class="icon-btn" id="goal-dec" aria-label="減らす">−</button>
            <span id="goal-val">${st.monthlyGoal}回</span>
            <button type="button" class="icon-btn" id="goal-inc" aria-label="増やす">＋</button>
          </div>
        </div>
        <div class="row">
          <div><p class="row-title">1回の予算</p><p class="row-sub">これを超えたら予算超過</p></div>
          <div class="input-unit compact"><input id="budget" type="number" inputmode="numeric" min="0" step="500" value="${st.budget}"><span>円</span></div>
        </div>
      </section>

      <h3 class="group-title">通知</h3>
      <section class="card list">
        <div class="row">
          <div><p class="row-title">LINE通知</p><p class="row-sub">記録のリマインドをLINEで受け取る</p></div>
          <label class="switch"><input type="checkbox" id="line-on" ${st.line.enabled ? 'checked' : ''}><span></span></label>
        </div>
        <div class="row ${st.line.enabled ? '' : 'disabled'}" id="line-time-row">
          <div><p class="row-title">通知時刻</p></div>
          <input type="time" id="line-time" value="${esc(st.line.time)}" ${st.line.enabled ? '' : 'disabled'}>
        </div>
        <div class="row column ${st.line.enabled ? '' : 'disabled'}" id="line-ep-row">
          <p class="row-title">通知サーバーURL</p>
          <input type="url" id="line-ep" placeholder="https://example.com" value="${esc(st.line.endpoint)}" ${st.line.enabled ? '' : 'disabled'}>
          <p class="row-sub">LINE通知は別サービス（line-notifier）が送信します。記録内容は送信されません。</p>
        </div>
      </section>

      <h3 class="group-title">データ</h3>
      <section class="card list">
        <button class="row link" id="export">データを書き出す（バックアップ）</button>
        <label class="row link">データを読み込む<input type="file" id="import" accept="application/json" hidden></label>
        <button class="row link danger" id="reset">すべての記録を削除</button>
      </section>
      <p class="hint">記録はこの端末内に保存されます</p>
    `;

    const setGoal = (d) => {
      const v = Math.max(0, Math.min(31, Store.settings.monthlyGoal + d));
      Store.updateSettings({ monthlyGoal: v });
      document.getElementById('goal-val').textContent = `${v}回`;
    };
    document.getElementById('goal-dec').onclick = () => setGoal(-1);
    document.getElementById('goal-inc').onclick = () => setGoal(1);

    document.getElementById('budget').addEventListener('change', (e) => {
      const v = Math.max(0, Math.round(Number(e.target.value) || 0));
      e.target.value = v;
      Store.updateSettings({ budget: v });
      toast('予算を保存しました');
    });

    const syncLine = async () => {
      const r = await LineBridge.sync(Store.settings.line);
      if (r.ok) toast('LINE通知の設定を送信しました');
      else if (r.reason !== 'no-endpoint') toast('通知サーバーに接続できませんでした');
    };
    document.getElementById('line-on').addEventListener('change', (e) => {
      Store.updateSettings({ line: { enabled: e.target.checked } });
      renderSettings();
      toast(e.target.checked ? 'LINE通知をオンにしました' : 'LINE通知をオフにしました');
      syncLine();
    });
    document.getElementById('line-time').addEventListener('change', (e) => {
      Store.updateSettings({ line: { time: e.target.value } });
      syncLine();
    });
    document.getElementById('line-ep').addEventListener('change', (e) => {
      Store.updateSettings({ line: { endpoint: e.target.value.trim() } });
      syncLine();
    });

    document.getElementById('export').onclick = () => {
      const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `pachinko-record-${Store.todayKey()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    };
    document.getElementById('import').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        Store.importJSON(await file.text());
        toast('読み込みました');
        renderSettings();
      } catch (err) { toast('読み込みに失敗しました'); }
    });
    document.getElementById('reset').onclick = () => {
      if (!confirm('すべての記録と設定を削除します。よろしいですか？')) return;
      Store.clearAll();
      toast('削除しました');
      renderSettings();
    };
  }

  // ---------------- 起動 ----------------
  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
