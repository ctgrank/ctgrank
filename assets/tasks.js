/* ══════════════════════════════════════════════════════════════════════════
   Shikhor — Tasks & Habits
   A personal daily planner. Everything is kept in this browser's
   localStorage: there is no account, no sign-in and no server, so the list
   belongs to the browser you write it in.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var KEY = 'shikhor-tasks-v1';
  var DAY = 86400000;

  /* ── dates, in the visitor's own timezone ───────────────────────────────
     Never use toISOString() here: that converts to UTC and would roll the
     day over at the wrong hour for every visitor east or west of Greenwich. */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmt(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return fmt(new Date()); }
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return fmt(d); }
  function daysBetween(a, b) { return Math.round((parse(b) - parse(a)) / DAY); }

  function longDate(s) {
    var d = parse(s);
    return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  }

  /* ── storage ───────────────────────────────────────────────────────── */
  function blank() { return { tasks: [], habits: [] }; }

  function load() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY));
      if (o && Array.isArray(o.tasks) && Array.isArray(o.habits)) {
        o.tasks = o.tasks.filter(function (t) { return t && t.id && t.text; });
        o.habits = o.habits.filter(function (h) { return h && h.id && h.name; });
        o.habits.forEach(function (h) { if (!Array.isArray(h.log)) h.log = []; });
        return o;
      }
    } catch (e) { /* corrupt or blocked — start fresh rather than crash */ }
    return blank();
  }

  var S = load();
  var saveFailed = false;

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
    } catch (e) {
      if (!saveFailed) { saveFailed = true; status('Could not save — storage is full or blocked in this browser.', true); }
    }
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ── roll the day over ──────────────────────────────────────────────────
     Undone work follows you forward; finished work from earlier days is
     cleared so today's list only ever holds today's business. */
  function rollover() {
    var t = today(), changed = false;
    S.tasks = S.tasks.filter(function (x) {
      if (x.date >= t) return true;                 // today or a future day
      if (x.done) { changed = true; return false; }  // finished earlier — drop
      if (!x.orig) x.orig = x.date;                  // unfinished — carry forward
      x.date = t; changed = true; return true;
    });
    if (changed) save();
  }

  /* ── small DOM helpers ─────────────────────────────────────────────── */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;   // textContent only: names are user input
    return n;
  }
  function icon(id) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    var u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    u.setAttribute('href', '#' + id);
    s.appendChild(u);
    return s;
  }
  function $(sel) { return document.querySelector(sel); }

  var statusTimer = null;
  function status(msg, isError) {
    var n = $('#tkStatus');
    if (!n) return;
    n.textContent = msg || '';
    n.className = 'tk-status' + (isError ? ' is-err' : '');
    clearTimeout(statusTimer);
    if (msg) statusTimer = setTimeout(function () { n.textContent = ''; }, 4000);
  }

  /* ══════════════════════════ TASKS ══════════════════════════════════ */

  var view = 'today';

  function tasksFor(when) {
    var t = today();
    // Deliberately kept in the order things were added. Re-sorting so
    // finished work sinks to the bottom makes rows jump out from under the
    // cursor the moment you tick one — an easy way to misclick the next row.
    return S.tasks.filter(function (x) {
      return when === 'today' ? x.date <= t : x.date === addDays(t, 1);
    }).sort(function (a, b) { return a.ts - b.ts; });
  }

  function addTask(text, when) {
    text = (text || '').trim();
    if (!text) return false;
    if (text.length > 200) text = text.slice(0, 200);
    S.tasks.push({
      id: uid(), text: text, done: false,
      date: when === 'tomorrow' ? addDays(today(), 1) : today(),
      ts: Date.now()
    });
    save();
    return true;
  }

  function renderTasks() {
    var list = $('#tkList'), t = today();
    var items = tasksFor(view);
    var done = items.filter(function (x) { return x.done; }).length;

    // progress
    var pct = items.length ? Math.round(done / items.length * 100) : 0;
    $('#tkProgFill').style.width = pct + '%';
    $('#tkProg').setAttribute('aria-valuenow', String(pct));
    $('#tkCount').textContent = items.length
      ? done + ' of ' + items.length + ' done'
      : 'nothing here yet';

    list.textContent = '';
    if (!items.length) {
      var e = el('li');
      e.appendChild(el('p', 'tk-empty', view === 'today'
        ? 'No tasks for today. Add one above to get started.'
        : 'No tasks lined up for tomorrow yet.'));
      list.appendChild(e);
      return;
    }

    items.forEach(function (x) {
      var li = el('li', 'tk-item' + (x.done ? ' is-done' : ''));

      var cb = el('input', 'tk-check');
      cb.type = 'checkbox';
      cb.checked = !!x.done;
      cb.id = 'tk-' + x.id;
      cb.setAttribute('aria-label', (x.done ? 'Mark not done: ' : 'Mark done: ') + x.text);
      cb.addEventListener('change', function () {
        x.done = cb.checked;
        save();
        renderTasks();
        status(cb.checked ? 'Done — nice.' : 'Reopened.');
      });

      var body = el('div', 'tk-body');
      var lbl = el('label', 'tk-text', x.text);
      lbl.setAttribute('for', 'tk-' + x.id);
      body.appendChild(lbl);

      var meta = el('div', 'tk-meta');
      if (x.orig && x.orig !== x.date && !x.done) {
        meta.appendChild(el('span', 'tk-carried', 'carried from ' + longDate(x.orig)));
      }
      if (x.date > t) meta.appendChild(el('span', 'tk-carried', 'tomorrow'));
      if (meta.childNodes.length) body.appendChild(meta);

      var del = el('button', 'tk-del');
      del.type = 'button';
      del.title = 'Delete task';
      del.setAttribute('aria-label', 'Delete task: ' + x.text);
      del.appendChild(icon('i-trash'));
      del.addEventListener('click', function () {
        S.tasks = S.tasks.filter(function (y) { return y.id !== x.id; });
        save(); renderTasks(); status('Task deleted.');
      });

      li.appendChild(cb); li.appendChild(body); li.appendChild(del);
      list.appendChild(li);
    });
  }

  /* ══════════════════════════ HABITS ═════════════════════════════════ */

  /** Consecutive days ending today; if today isn't ticked yet, the run up
      to yesterday still counts so a habit isn't "broken" before the day ends. */
  function streakOf(h) {
    var t = today();
    var d = h.log.indexOf(t) >= 0 ? t : addDays(t, -1);
    var n = 0;
    while (h.log.indexOf(d) >= 0) { n++; d = addDays(d, -1); }
    return n;
  }

  function addHabit(name) {
    name = (name || '').trim();
    if (!name) return false;
    if (name.length > 60) name = name.slice(0, 60);
    S.habits.push({ id: uid(), name: name, start: today(), log: [] });
    save();
    return true;
  }

  function renderHabits() {
    var box = $('#tkHabits'), t = today();
    box.textContent = '';

    if (!S.habits.length) {
      box.appendChild(el('p', 'tk-empty',
        'No habits yet. Start one above and tick it each day you keep it.'));
      return;
    }

    S.habits.sort(function (a, b) { return a.start < b.start ? -1 : 1; }).forEach(function (h) {
      var doneToday = h.log.indexOf(t) >= 0;
      var dayNo = Math.max(1, daysBetween(h.start, t) + 1);
      var streak = streakOf(h);

      var card = el('div', 'tk-habit' + (doneToday ? ' is-done' : ''));

      var main = el('div', 'tk-habit-main');
      main.appendChild(el('div', 'tk-habit-name', h.name));

      var stats = el('div', 'tk-stats');
      var day = el('span', 'tk-stat', 'Day ' + dayNo);
      day.title = 'Started ' + longDate(h.start);
      stats.appendChild(day);

      if (streak > 0) {
        var st = el('span', 'tk-stat is-streak');
        st.appendChild(icon('i-flame'));
        st.appendChild(el('span', null, streak + (streak === 1 ? ' day' : ' days')));
        stats.appendChild(st);
      }
      var td = el('span', 'tk-stat ' + (doneToday ? 'is-today' : 'is-missed'),
        doneToday ? 'Done today' : 'Not ticked today');
      stats.appendChild(td);

      var best = h.log.length;
      if (best > 0) stats.appendChild(el('span', 'tk-stat', best + ' total'));
      main.appendChild(stats);

      // last 7 days, oldest first
      var week = el('div', 'tk-week');
      week.setAttribute('aria-hidden', 'true');
      for (var i = 6; i >= 0; i--) {
        var ds = addDays(t, -i);
        var on = h.log.indexOf(ds) >= 0;
        var cell = el('span', 'tk-day' + (on ? ' on' : '') +
          (ds === t ? ' today' : '') + (daysBetween(h.start, ds) < 0 ? ' future' : ''),
          String(parse(ds).getDate()));
        cell.title = ds === t ? 'Today' : longDate(ds);
        week.appendChild(cell);
      }
      main.appendChild(week);

      var side = el('div', 'tk-habit-side');
      var mark = el('button', 'tk-mark' + (doneToday ? ' is-on' : ''));
      mark.type = 'button';
      mark.setAttribute('aria-pressed', doneToday ? 'true' : 'false');
      mark.setAttribute('aria-label', (doneToday ? 'Untick ' : 'Tick ') + h.name + ' for today');
      mark.appendChild(icon(doneToday ? 'i-check' : 'i-plus'));
      mark.appendChild(el('span', null, doneToday ? 'Done' : 'Tick today'));
      mark.addEventListener('click', function () {
        var i2 = h.log.indexOf(t);
        if (i2 >= 0) h.log.splice(i2, 1); else h.log.push(t);
        save(); renderHabits();
        status(i2 >= 0 ? 'Unticked ' + h.name + '.' : h.name + ' ticked for today.');
      });

      var del = el('button', 'tk-del');
      del.type = 'button';
      del.title = 'Delete habit';
      del.setAttribute('aria-label', 'Delete habit: ' + h.name);
      del.appendChild(icon('i-trash'));
      del.addEventListener('click', function () {
        if (!window.confirm('Delete the habit "' + h.name + '"?\n\n' +
          h.log.length + ' day(s) of history will be removed. This cannot be undone.')) return;
        S.habits = S.habits.filter(function (y) { return y.id !== h.id; });
        save(); renderHabits(); status('Habit deleted.');
      });

      side.appendChild(mark); side.appendChild(del);
      card.appendChild(main); card.appendChild(side);
      box.appendChild(card);
    });
  }

  /* ══════════════════════════ WIRING ═════════════════════════════════ */

  function submit() {
    var inp = $('#tkInput');
    if (!addTask(inp.value, view)) { status('Type a task first.', true); inp.focus(); return; }
    inp.value = '';
    inp.focus();
    renderTasks();
    status(view === 'today' ? 'Added to today.' : 'Added to tomorrow.');
  }

  function setView(v) {
    view = v;
    var b1 = $('#tkTabToday'), b2 = $('#tkTabTomorrow');
    b1.classList.toggle('is-on', v === 'today');
    b2.classList.toggle('is-on', v === 'tomorrow');
    b1.setAttribute('aria-selected', v === 'today' ? 'true' : 'false');
    b2.setAttribute('aria-selected', v === 'tomorrow' ? 'true' : 'false');
    $('#tkInput').placeholder = v === 'today'
      ? 'What do you need to do today?' : 'What should tomorrow hold?';
    $('#tkAddBtn').lastChild.textContent = v === 'today' ? ' Add to today' : ' Add to tomorrow';
    $('#tkWhen').textContent = v === 'today' ? longDate(today()) : longDate(addDays(today(), 1));
    renderTasks();
  }

  function init() {
    rollover();

    $('#tkAddBtn').addEventListener('click', submit);
    $('#tkInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });
    $('#tkTabToday').addEventListener('click', function () { setView('today'); });
    $('#tkTabTomorrow').addEventListener('click', function () { setView('tomorrow'); });

    $('#tkHabitBtn').addEventListener('click', function () {
      var inp = $('#tkHabitInput');
      if (!addHabit(inp.value)) { status('Give the habit a name first.', true); inp.focus(); return; }
      inp.value = '';
      renderHabits();
      status('Habit started — today is day 1.');
    });
    $('#tkHabitInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); $('#tkHabitBtn').click(); }
    });

    $('#tkReset').addEventListener('click', function () {
      if (!window.confirm('Clear every task and habit from this browser?\n\n' +
        'This cannot be undone.')) return;
      S = blank(); save(); renderTasks(); renderHabits();
      status('Everything cleared.');
    });

    setView('today');
    renderHabits();

    // If the site is open across midnight, roll the day over on its own.
    var day = today();
    setInterval(function () {
      if (today() !== day) { day = today(); rollover(); setView(view); renderHabits(); }
    }, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
