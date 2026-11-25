/* PCM Rank Checker — all-board merit lookup.
 *
 * Every board's marks live in one packed file per board/year/group, listed
 * in data/pcm/index.json. This file holds the only copy of the merit rules:
 * eligibility gates and tie-break order per category, taken from the
 * published admission requirements of each university.
 *
 * Ranking is done by counting, not sorting: a student's rank in a category
 * is 1 + the number of eligible students with a better key. That is exact,
 * needs no precomputed list, and stays O(n) per category however many
 * boards are loaded.
 */
(function () {
  'use strict';

  var BASE = 201;          // marks run 0..200, so base 201 packs them exactly
  var NO_MARK = 255;
  var MELD = 200;          // full marks per subject unless the file says otherwise

  /* Every sort key reads from one flat numeric vector per student, built
     once at decode time. Index order is fixed here and nowhere else. */
  var V = { gpa: 0, pcm: 1, pcmE: 2, m: 3, p: 4, c: 5, e: 6, bio: 7, mpp: 8 };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var el = function (tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };

  /* ── grading ──────────────────────────────────────────────────────────
     Grade point from raw marks. The board's own GPA is used wherever a
     GPA gate applies; this is only needed for the per-subject gates
     (A+ in P/C/M, A in Biology, B in English) which the data doesn't
     carry separately. */
  function gradePoint(marks, full) {
    if (marks == null) return null;
    var pct = (marks / full) * 100;
    if (pct >= 80) return 5.0;
    if (pct >= 70) return 4.0;
    if (pct >= 60) return 3.5;
    if (pct >= 50) return 3.0;
    if (pct >= 40) return 2.0;
    if (pct >= 33) return 1.0;
    return 0;
  }

  function gradeLabel(marks, full) {
    var gp = gradePoint(marks, full);
    if (gp == null) return '—';
    return { 5: 'A+', 4: 'A', 3.5: 'A-', 3: 'B', 2: 'C', 1: 'D', 0: 'F' }[gp];
  }

  /* ── categories ───────────────────────────────────────────────────────
     spec     leading-to-trailing sort keys, all "higher is better"
     requires the gate, returning a reason string when it fails
     gate     human-readable requirement, shown in the result table

     Sources for the gates and tie-breaks: the published admission
     circulars for BUET, RUET, KUET, CUET and BUTEX. */
  var CATS = [
    {
      id: 'pcmall', name: 'PCM ALL', when: 'Every student with Physics, Chemistry and Higher Math',
      gate: 'Has PCM',
      spec: [0, 1, 3, 4, 5],
      tie: 'GPA → PCM → Math → Physics → Chemistry',
      requires: function (s) {
        return s.pcm == null ? 'No Physics, Chemistry and Higher Math' : null;
      }
    },
    {
      id: 'onlypcm', name: 'Only PCM Mark', when: 'Pure PCM marks, GPA ignored',
      gate: 'Has PCM',
      spec: [1, 3, 4, 5],
      tie: 'PCM → Math → Physics → Chemistry',
      requires: function (s) {
        return s.pcm == null ? 'No Physics, Chemistry and Higher Math' : null;
      }
    },
    {
      id: 'buet', name: 'PCM BUET', when: 'BUET engineering',
      gate: 'GPA 5.00 and A+ in Physics, Chemistry and Math',
      spec: [1, 3, 4, 8],
      tie: 'PCM → Math → Physics → (Math + Physics)',
      requires: function (s) {
        if (s.pcm == null) return 'No PCM';
        if (s.gpa < 500) return 'GPA below 5.00';
        if (s.gp.p !== 5) return 'Physics below A+';
        if (s.gp.c !== 5) return 'Chemistry below A+';
        if (s.gp.m !== 5) return 'Higher Math below A+';
        return null;
      }
    },
    {
      id: 'buetBme', name: 'BUET BME', when: 'BUET Biomedical Engineering',
      gate: 'PCM BUET plus A in Biology',
      spec: [1, 3, 4, 7],
      tie: 'PCM → Math → Physics → Biology',
      requires: function (s) {
        var why = CATS[2].requires(s);
        if (why) return why;
        if (s.gp.bio == null) return 'No Biology';
        if (s.gp.bio < 4) return 'Biology below A';
        return null;
      }
    },
    {
      id: 'ruet', name: 'PCM RUET', when: 'RUET engineering',
      gate: 'A in Physics, Chemistry and Math, PCM grade points 13.00+',
      spec: [1, 3, 4, 5],
      tie: 'PCM → Math → Physics → Chemistry',
      requires: function (s) {
        if (s.pcm == null) return 'No PCM';
        if (s.gpa < 100) return 'Did not pass';
        if (s.gp.p < 4) return 'Physics below A';
        if (s.gp.c < 4) return 'Chemistry below A';
        if (s.gp.m < 4) return 'Higher Math below A';
        if (s.gp.p + s.gp.c + s.gp.m < 13) return 'PCM grade points below 13.00';
        return null;
      }
    },
    {
      id: 'kuet', name: 'PCM KUET', when: 'KUET engineering (PCME)',
      gate: 'PCME grade points 16.00+',
      spec: [2, 3, 4, 5, 6],
      tie: 'PCME → Math → Physics → Chemistry → English',
      requires: function (s) {
        if (s.pcm == null) return 'No PCM';
        if (s.gpa < 100) return 'Did not pass';
        if (s.gp.e == null) return 'No English';
        if (s.gp.p + s.gp.c + s.gp.m + s.gp.e < 16) return 'PCME grade points below 16.00';
        return null;
      }
    },
    {
      id: 'kuetBme', name: 'KUET BME', when: 'KUET Biomedical Engineering',
      gate: 'PCM KUET plus A in Biology',
      spec: [2, 3, 4, 5, 6, 7],
      tie: 'PCME → Math → Physics → Chemistry → English → Biology',
      requires: function (s) {
        var why = CATS[5].requires(s);
        if (why) return why;
        if (s.gp.bio == null) return 'No Biology';
        if (s.gp.bio < 4) return 'Biology below A';
        return null;
      }
    },
    {
      id: 'cuet', name: 'PCM CUET', when: 'CUET engineering',
      gate: 'PCM grade points 14.00+ and B in English',
      spec: [1, 3, 4, 5],
      tie: 'PCM → Math → Physics → Chemistry',
      requires: function (s) {
        if (s.pcm == null) return 'No PCM';
        if (s.gpa < 100) return 'Did not pass';
        if (s.gp.p + s.gp.c + s.gp.m < 14) return 'PCM grade points below 14.00';
        if (s.gp.e == null) return 'No English';
        if (s.gp.e < 3) return 'English below B';
        return null;
      }
    },
    {
      id: 'cuetBme', name: 'CUET BME', when: 'CUET Biomedical Engineering',
      gate: 'PCM CUET plus A in Biology',
      spec: [1, 3, 4, 5, 7],
      tie: 'PCM → Math → Physics → Chemistry → Biology',
      requires: function (s) {
        var why = CATS[7].requires(s);
        if (why) return why;
        if (s.gp.bio == null) return 'No Biology';
        if (s.gp.bio < 4) return 'Biology below A';
        return null;
      }
    },
    {
      id: 'butex', name: 'PCM BUTEX', when: 'BUTEX textile engineering',
      gate: 'GPA 4.00+, A- in PCME each, PCME grade points 16.50+',
      spec: [1, 3, 4, 5],
      tie: 'PCM → Math → Physics → Chemistry',
      requires: function (s) {
        if (s.pcm == null) return 'No PCM';
        if (s.gpa < 400) return 'GPA below 4.00';
        if (s.gp.e == null) return 'No English';
        var four = [s.gp.p, s.gp.c, s.gp.m, s.gp.e];
        for (var i = 0; i < four.length; i++) {
          if (four[i] < 3.5) return 'A subject below A-';
        }
        if (s.gp.p + s.gp.c + s.gp.m + s.gp.e < 16.5) return 'PCME grade points below 16.50';
        return null;
      }
    }
  ];

  /* Sort key: pack the spec into one integer, base 201, so comparing two
     students is a single number comparison. Largest case is
     PCME (≤1700) followed by five 0..200 values — about 5.6e14, still
     exact in a double. */
  function keyOf(v, spec) {
    var k = 0;
    for (var i = 0; i < spec.length; i++) k = k * BASE + v[spec[i]];
    return k;
  }

  /* ── decoding ─────────────────────────────────────────────────────────
     One 12-byte record per student: roll u32, GPA u16 (hundredths), then
     Physics, Chemistry, Math, English, Biology as u8 (255 = not taken),
     one pad byte. Names ride alongside, newline joined. */
  function b64bytes(b64) {
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function decodeSet(payload, full) {
    var buf = b64bytes(payload.rec);
    var dv = new DataView(buf.buffer);
    var n = payload.meta.n;
    var names = new TextDecoder('utf-8').decode(b64bytes(payload.names))
      .split('\n');

    var rows = new Array(n);
    for (var i = 0; i < n; i++) {
      var o = i * 12;
      var p = dv.getUint8(o + 6), c = dv.getUint8(o + 7),
          m = dv.getUint8(o + 8), e = dv.getUint8(o + 9),
          bio = dv.getUint8(o + 10);
      var row = {
        roll: dv.getUint32(o, true),
        gpa: dv.getUint16(o + 4, true),
        board: payload.meta.board,
        boardLabel: payload.meta.boardLabel,
        name: names[i] || '',
        p: p === NO_MARK ? null : p,
        c: c === NO_MARK ? null : c,
        m: m === NO_MARK ? null : m,
        e: e === NO_MARK ? null : e,
        bio: bio === NO_MARK ? null : bio,
        gp: null, pcm: null, pcmE: null, mpp: 0
      };
      row.gp = {
        p: gradePoint(row.p, full), c: gradePoint(row.c, full),
        m: gradePoint(row.m, full), e: gradePoint(row.e, full),
        bio: gradePoint(row.bio, full)
      };
      if (row.p != null && row.c != null && row.m != null) {
        row.pcm = row.p + row.c + row.m;
        row.mpp = row.m + row.p;
        row.pcmE = row.pcm + (row.e == null ? 0 : row.e);
        if (row.e == null) row.pcmE = row.pcm;
      }

      // flat key vector, -1 for a subject not taken so it sorts last
      var v = [row.gpa, -1, -1, -1, -1, -1, -1, -1, -1];
      var put = function (idx, val) { v[idx] = val == null ? -1 : val; };
      put(1, row.pcm); put(2, row.pcmE); put(3, row.m);
      put(4, row.p); put(5, row.c); put(6, row.e);
      put(7, row.bio); put(8, row.mpp);
      row.v = v;

      // which of the ten categories this student clears, as a bitmask
      var mask = 0;
      for (var ci = 0; ci < CATS.length; ci++) {
        if (CATS[ci].requires(row) === null) mask |= (1 << ci);
      }
      row.mask = mask;
      rows[i] = row;
    }
    return rows;
  }

  /* ── state ────────────────────────────────────────────────────────────── */
  var S = { idx: null, loaded: {}, fullByBoard: {}, full: MELD };

  function loadIndex() {
    return fetch('data/pcm/index.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('index ' + r.status); return r.json(); });
  }

  function loadSet(entry) {
    if (S.loaded[entry.file]) return Promise.resolve(S.loaded[entry.file]);
    return fetch(entry.file).then(function (r) {
      if (!r.ok) throw new Error(entry.file + ' ' + r.status);
      return r.json();
    }).then(function (j) {
      var rows = decodeSet(j, j.meta.full || MELD);
      S.fullByBoard[j.meta.board] = j.meta.full || MELD;
      S.loaded[entry.file] = rows;
      return rows;
    });
  }

  /* All sets sharing the chosen exam/year/group — the combined all-board
     pool the universities actually rank against. */
  function cohortOf(set) {
    var out = [];
    S.idx.boards.forEach(function (b) {
      b.sets.forEach(function (s) {
        if (s.exam === set.exam && s.year === set.year && s.group === set.group) {
          out.push({ board: b.id, label: b.label, entry: s });
        }
      });
    });
    return out;
  }

  /* ── ranking ───────────────────────────────────────────────────────────
     One pass per category: count the eligible pool, and how many of those
     are ahead of this student (within their own board, and combined). */
  function rankAll(target, cohort, loaded) {
    var res = [];
    for (var ci = 0; ci < CATS.length; ci++) {
      var cat = CATS[ci];
      var why = cat.requires(target);
      if (why) { res.push({ cat: cat, ok: false, why: why }); continue; }

      var tkey = keyOf(target.v, cat.spec);
      var bit = 1 << ci;
      var pool = 0, aheadBoard = 0, aheadAll = 0;
      for (var bi = 0; bi < cohort.length; bi++) {
        var rows = loaded[cohort[bi].board];
        if (!rows) continue;
        var isOwn = cohort[bi].board === target.board;
        for (var i = 0; i < rows.length; i++) {
          var o = rows[i];
          if (!(o.mask & bit)) continue;
          pool++;
          if (keyOf(o.v, cat.spec) > tkey) {
            aheadAll++;
            if (isOwn) aheadBoard++;
          }
        }
      }
      res.push({
        cat: cat, ok: true, pool: pool,
        rankAll: aheadAll + 1, rankBoard: aheadBoard + 1
      });
    }
    return res;
  }

  /* ── rendering ────────────────────────────────────────────────────────── */
  function fmt(n) { return n.toLocaleString('en-US'); }

  function renderResult(target, res, cohort, loadedCount) {
    var box = $('#pcmResult');
    box.innerHTML = '';
    box.hidden = false;

    var head = el('div', 'pcm-id');
    var who = el('div', 'pcm-who');
    var nm = el('h2', null, target.name || 'Roll ' + target.roll);
    who.appendChild(nm);
    var sub = el('p', 'pcm-sub');
    sub.innerHTML = 'Roll <b>' + target.roll + '</b> · ' +
      target.boardLabel + ' · GPA <b>' + (target.gpa / 100).toFixed(2) + '</b>' +
      (target.pcm != null ? ' · PCM <b>' + target.pcm + '</b>' : '');
    who.appendChild(sub);
    head.appendChild(who);
    box.appendChild(head);

    // subject marks
    if (target.pcm != null) {
      var marks = el('div', 'pcm-marks');
      [['Physics', 'p'], ['Chemistry', 'c'], ['Higher Math', 'm'],
       ['English', 'e'], ['Biology', 'bio']].forEach(function (pair) {
        var v = target[pair[1]];
        if (v == null) return;
        var cell = el('div', 'pcm-mark');
        cell.appendChild(el('span', 'pcm-mark-k', pair[0]));
        cell.appendChild(el('b', null, String(v)));
        var gl = gradeLabel(v, S.full);
        var tag = el('span', 'tag pcm-grade', gl);
        tag.setAttribute('data-g', gl);
        cell.appendChild(tag);
        marks.appendChild(cell);
      });
      box.appendChild(marks);
    }

    // headline rank — pure PCM marks, which is what "PCM rank" means
    var headline = null;
    res.forEach(function (r) { if (r.cat.id === 'onlypcm' && r.ok) headline = r; });
    if (headline) {
      var hero = el('div', 'pcm-hero-rank');
      hero.appendChild(el('span', 'pcm-hero-k', 'Only PCM Mark rank'));
      var line = el('p', 'pcm-hero-v');
      line.innerHTML = '<b>#' + fmt(headline.rankAll) + '</b> of ' +
        fmt(headline.pool);
      hero.appendChild(line);
      hero.appendChild(el('span', 'pcm-hero-note',
        loadedCount > 1
          ? 'Combined across ' + loadedCount + ' boards'
          : 'All ' + target.boardLabel + ' PCM students'));
      box.appendChild(hero);
    }

    // the ten categories
    var table = el('div', 'pcm-table');
    var hdr = el('div', 'pcm-row pcm-row-head');
    hdr.appendChild(el('span', null, 'Category'));
    hdr.appendChild(el('span', 'c-num', 'Rank'));
    hdr.appendChild(el('span', 'c-num', 'Eligible'));
    hdr.appendChild(el('span', 'c-note', 'Requirement'));
    table.appendChild(hdr);

    res.forEach(function (r) {
      var row = el('div', 'pcm-row' + (r.ok ? ' is-ok' : ' is-no'));
      row.appendChild(el('span', 'c-name', r.cat.name));
      if (r.ok) {
        var rankTxt = cohort.length > 1
          ? '#' + fmt(r.rankAll)
          : '#' + fmt(r.rankBoard);
        row.appendChild(el('span', 'c-num c-rank', rankTxt));
        row.appendChild(el('span', 'c-num', fmt(r.pool)));
        row.appendChild(el('span', 'c-note', r.cat.tie));
      } else {
        row.appendChild(el('span', 'c-num', '—'));
        row.appendChild(el('span', 'c-num', '—'));
        row.appendChild(el('span', 'c-note', r.why));
      }
      table.appendChild(row);
    });
    box.appendChild(table);

    var note = el('p', 'pcm-note');
    note.textContent = cohort.length > 1
      ? 'Rank counts every eligible student across the ' + cohort.length +
        ' boards loaded, with each category\'s own tie-break order.'
      : 'Only ' + cohort[0].label + ' is loaded, so the combined all-board rank ' +
        'cannot be calculated yet — this is the rank within one board.';
    box.appendChild(note);
  }

  /* ── controls ─────────────────────────────────────────────────────────── */
  function setStatus(msg, kind) {
    var s = $('#pcmStatus');
    s.textContent = msg || '';
    s.hidden = !msg;
    s.className = 'pcm-status' + (kind ? ' is-' + kind : '');
  }

  function coverage() {
    var loaded = S.idx.boards.filter(function (b) { return b.sets.length; });
    var totalBoards = S.idx.boards.length;
    var box = $('#pcmCoverage');
    if (loaded.length === totalBoards) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.innerHTML = '';
    box.appendChild(el('b', null, loaded.length + ' of ' + totalBoards +
      ' boards loaded'));
    box.appendChild(el('span', null,
      ' — ' + loaded.map(function (b) { return b.label; }).join(', ') +
      '. Combined all-board ranks stay equal to single-board ranks until the ' +
      'remaining boards are supplied. For the full eleven-board list, '));
    var a = el('a', null, 'check EBR.BD');
    a.href = 'https://ebr.bd/tools/pcm-rank-checker/';
    a.target = '_blank';
    a.rel = 'noopener';
    box.appendChild(a);
    box.appendChild(el('span', null, '.'));
  }

  function setSets(boardId) {
    var b = S.idx.boards.filter(function (x) { return x.id === boardId; })[0];
    var sel = $('#pcmSet');
    sel.innerHTML = '';
    if (!b || !b.sets.length) {
      sel.disabled = true;
      sel.appendChild(new Option('No data loaded for this board', ''));
      return false;
    }
    sel.disabled = b.sets.length < 2;
    b.sets.forEach(function (s) {
      sel.appendChild(new Option(s.label + ' · ' + fmt(s.n) + ' students',
        s.file));
    });
    return true;
  }

  function lookup() {
    var boardId = $('#pcmBoard').value;
    var file = $('#pcmSet').value;
    var rollStr = ($('#pcmRoll').value || '').trim().replace(/\s+/g, '');
    if (!file) return setStatus('No result data for that board yet.');
    if (!/^\d{4,9}$/.test(rollStr)) {
      return setStatus('Enter a roll number — digits only.', 'warn');
    }
    var roll = parseInt(rollStr, 10);
    var entry = null;
    S.idx.boards.forEach(function (b) {
      b.sets.forEach(function (s) { if (s.file === file) entry = s; });
    });
    if (!entry) return setStatus('That result set is missing.');

    var btn = $('#pcmGo');
    btn.disabled = true;
    setStatus('Looking up roll ' + roll + '…');

    var cohort = cohortOf(entry);
    var toLoad = cohort.map(function (c) {
      return loadSet(c.entry).then(function (rows) {
        S.loaded[c.board] = rows;
        return rows;
      });
    });

    Promise.all(toLoad).then(function () {
      S.full = S.fullByBoard[boardId] || MELD;
      var rows = S.loaded[boardId] || [];
      var target = null;
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].roll === roll) { target = rows[i]; break; }
      }
      if (!target) {
        $('#pcmResult').hidden = true;
        setStatus('No student with roll ' + roll + ' in ' +
          entry.label + '.', 'warn');
        return;
      }
      var res = rankAll(target, cohort, S.loaded);
      renderResult(target, res, cohort, cohort.length);
      setStatus('');
      if (history.replaceState) {
        history.replaceState(null, '',
          '?board=' + boardId + '&roll=' + roll);
      }
      $('#pcmResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }).catch(function (e) {
      setStatus('Could not load the result data: ' + e.message, 'bad');
    }).then(function () {
      btn.disabled = false;
    });
  }

  function init() {
    var form = $('#pcmForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      lookup();
    });
    $('#pcmBoard').addEventListener('change', function () {
      setSets(this.value);
      $('#pcmResult').hidden = true;
      setStatus('');
      $('#pcmRoll').focus();
    });

    setStatus('Loading board data…');
    loadIndex().then(function (idx) {
      S.idx = idx;
      var sel = $('#pcmBoard');
      sel.innerHTML = '';
      idx.boards.forEach(function (b) {
        var opt = new Option(b.label + (b.sets.length ? '' : ' (not loaded yet)'),
          b.id);
        opt.disabled = !b.sets.length;
        sel.appendChild(opt);
      });
      // open on the first board that actually has data
      var first = idx.boards.filter(function (b) { return b.sets.length; })[0];
      if (first) { sel.value = first.id; setSets(first.id); }
      coverage();
      setStatus('');

      // deep link: ?board=chattogram&roll=114978
      var p = new URLSearchParams(location.search);
      var rb = p.get('board'), rr = p.get('roll');
      if (rb && rr) {
        var b = idx.boards.filter(function (x) { return x.id === rb; })[0];
        if (b && b.sets.length) {
          sel.value = rb;
          setSets(rb);
          var s2 = $('#pcmSet');
          if (p.get('set')) s2.value = p.get('set');
          $('#pcmRoll').value = rr;
          lookup();
        }
      }
    }).catch(function (e) {
      setStatus('Could not load the board index: ' + e.message, 'bad');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
