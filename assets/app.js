/* ══════════════════════════════════════════════════════════════════════════
   Shikhor — SSC & HSC board rank explorer (Chattogram Board)
   Static, dependency-free. Data: ./data/index.json + ./data/<id>.json
   ══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const GROUPS = ['Science', 'Commerce', 'Arts'];

/* ─────────────────────────────── state ─────────────────────────────── */
const S = {
  catalog: null,
  exam: 'HSC',
  year: null,
  group: 'Science',
  ds: null,          // loaded dataset
  view: 'students',
  q: '',
  gpaMin: 0,
  school: '',
  rows: [],          // filtered row indices
  openRoll: null,
  cmp: [null, null],
  schoolSort: 'gpa5',
  loading: false,
};

/* ─────────────────────────────── helpers ───────────────────────────── */
const nf = n => (n == null ? '—' : n.toLocaleString('en-US'));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = id => `<svg><use href="#i-${id}"/></svg>`;
const gpaTxt = v => (v < 0 ? '—' : (v / 100).toFixed(2));

function b64ToBytes(b64) {
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let toastT;
function toast(msg, ok = true) {
  const t = $('#toast');
  t.innerHTML = icon(ok ? 'check' : 'info') + '<span>' + esc(msg) + '</span>';
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, 2400);
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* ─────────────────────────────── theme ─────────────────────────────── */
function initTheme() {
  const saved = localStorage.getItem('shikhor_theme');
  const dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(dark);
  $('#themeBtn').addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme !== 'dark');
    localStorage.setItem('shikhor_theme', document.documentElement.dataset.theme);
  });
}
function setTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('.theme-label').textContent = dark ? 'Light' : 'Dark';
  const m = $('meta[name="theme-color"]');
  if (m) m.setAttribute('content', dark ? '#0b1120' : '#2563eb');
}

/* ─────────────────────────────── catalog ───────────────────────────── */
async function loadCatalog() {
  const res = await fetch('data/index.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('index.json ' + res.status);
  S.catalog = await res.json();

  const d = S.catalog.datasets;
  $('#statStudents').textContent = nf(S.catalog.totalStudents);
  $('#statSchools').textContent = nf(S.catalog.totalSchools);
  $('#statYears').textContent = d.length;
  $('#year').textContent = new Date().getFullYear();

  // open on the newest HSC year that has Science — HSC 2026
  const first = d.filter(x => x.exam === 'HSC' && x.group === 'Science')[0]
             || d.filter(x => x.exam === 'SSC')[0];
  S.exam = 'HSC';
  S.year = first.year;
  S.group = 'Science';
}

const findMeta = (exam, year, group) =>
  S.catalog.datasets.find(m => m.exam === exam && m.year === +year && m.group === group);

/* HSC institutions are colleges, SSC institutions are schools. */
const capWord = (plural) => (S.exam === 'HSC' ? (plural ? 'Colleges' : 'College')
                                              : (plural ? 'Schools'  : 'School'));

/* Relabel every "school" surface to match the selected exam. */
function applyExamLabels() {
  const cap = capWord(true);
  const btn = $('#viewSchoolsBtn span');
  if (btn) btn.textContent = cap;
  const nav = $('#navSchoolsLbl');
  if (nav) nav.textContent = 'Top ' + cap;
  const q = $('#q');
  if (q) q.placeholder = 'Search by name, roll number or ' + capWord(false).toLowerCase() + '…';
  const sf = $('#schoolFilter');
  if (sf && sf.options.length) sf.options[0].textContent = 'All ' + cap.toLowerCase();
}

/* ──────────────────────────────── picker ───────────────────────────── */
function renderPicker() {
  const d = S.catalog.datasets;

  // exam
  $$('#examSeg .seg-btn').forEach(b => b.classList.toggle('is-on', b.dataset.exam === S.exam));
  applyExamLabels();

  // years
  const years = [...new Set(d.filter(m => m.exam === S.exam).map(m => m.year))].sort((a, b) => b - a);
  const newest = years[0];
  $('#yearCards').innerHTML = years.map(y => {
    const has = GROUPS.some(g => findMeta(S.exam, y, g));
    const count = d.filter(m => m.exam === S.exam && m.year === y).reduce((a, b) => a + b.count, 0);
    // No year gets special treatment — HSC 2026 used to be spotlighted, but
    // it is just one dataset among nineteen now.
    // Only "SOON" (no data yet) and "NEW" (newest) ribbons remain: the old
    // HOT / PART badges were noise, since every listed year is complete enough.
    let ribbon = '';
    if (!has) ribbon = '<span class="ribbon ribbon-soon">SOON</span>';
    else if (y === newest) ribbon = '<span class="ribbon ribbon-new">NEW</span>';
    return `<button class="year-card ${y === S.year ? 'is-on' : ''}" data-year="${y}" ${has ? '' : 'disabled'}>
        ${ribbon}
        <div class="yc-exam">${S.exam}</div>
        <div class="yc-year">${String(y).slice(2)}</div>
        <div class="yc-count">${has ? nf(count) + ' students' : 'no data'}</div>
      </button>`;
  }).join('');

  // groups
  $('#groupTabs').innerHTML = GROUPS.map(g => {
    const m = findMeta(S.exam, S.year, g);
    return `<button class="group-btn ${g === S.group ? 'is-on' : ''}" data-group="${g}" ${m ? '' : 'disabled'}>
        ${g}${m ? ` <small>${nf(m.count)}</small>` : ' <small>n/a</small>'}
      </button>`;
  }).join('');

  // note
  const m = findMeta(S.exam, S.year, S.group);
  $('#pickerNote').innerHTML = m ? describeMeta(m) : 'No dataset for that combination yet.';
}

function describeMeta(m) {
  const bits = [
    `<b>${m.count.toLocaleString('en-US')}</b> students`,
    `<b>${m.schools.toLocaleString('en-US')}</b> institutions`,
    m.gpa5 ? `<b>${m.gpa5.toLocaleString('en-US')}</b> GPA-5` : null,
    m.avgGpa != null ? `avg GPA <b>${m.avgGpa.toFixed(2)}</b>` : null,
  ].filter(Boolean).join(' • ');
  return bits + (m.partial
    ? ` <span class="tag tag-warn">Partial source — ${m.coveragePct}% of rows present</span>`
    : '') + (m.hasSubjects ? '' : ' • no subject-wise marks in source');
}

/* ───────────────────────────── data loading ────────────────────────── */
/* ── SEO: keep head tags in step with the dataset on screen ── */
const SEO_SITE = 'https://ctgrank.pages.dev';
function applySeo(meta) {
  const exam = meta.exam, yr = meta.year, grp = meta.group;
  const n = meta.count.toLocaleString('en-US');
  const title = `${exam} ${yr} ${grp} Rank List — Chattogram Board | Shikhor`;
  const desc = `Unofficial ${exam} ${yr} ${grp} merit list for the Chattogram Board: `
    + `${n} students from ${meta.schools} `
    + `${exam === 'HSC' ? 'colleges' : 'schools'}, ranked by GPA then total marks with `
    + `subject-wise marks, GPA and board rank.`;
  // the prerendered page is canonical for this dataset; the ?exam=... URL
  // is the same content served by the SPA
  const url = `${SEO_SITE}/${exam.toLowerCase()}-${yr}-${grp.toLowerCase()}/`;
  const appUrl = `${SEO_SITE}/?exam=${exam}&year=${yr}&group=${grp}`;

  document.title = title;
  const setMeta = (sel, attr, val) => {
    let el = document.querySelector(sel);
    if (!el) return;
    el.setAttribute(attr === 'text' ? 'content' : attr, val);
  };
  setMeta('meta[name="description"]', 'content', desc);
  setMeta('meta[property="og:title"]', 'content', title);
  setMeta('meta[property="og:description"]', 'content', desc);
  setMeta('meta[property="og:url"]', 'content', appUrl);
  setMeta('meta[name="twitter:title"]', 'content', title);
  setMeta('meta[name="twitter:description"]', 'content', desc);
  // one canonical across all hosts, so the Surge/GitHub copies don't compete
  const canon = document.querySelector('link[rel="canonical"]');
  if (canon) canon.setAttribute('href', url);
  const ld = document.querySelector('script[type="application/ld+json"]');
  if (ld) {
    try {
      const data = JSON.parse(ld.textContent);
      (data['@graph'] || []).forEach(node => {
        if (node['@type'] === 'WebPage') { node.name = title; node.url = url; node.description = desc; }
      });
      ld.textContent = JSON.stringify(data);
    } catch (e) { /* leave the static graph alone */ }
  }
}

/* ─────────────────────────────── PCM ────────────────────────────────
   PCM = Physics + Chemistry + Mathematics, for HSC Science cohorts whose
   source data names its subject columns. Older datasets store marks under
   a generic template ("Compulsory"/"Optional"), so Math cannot be
   identified there and PCM is simply unavailable. */
function pcmColumns(meta) {
  // PCM was asked for HSC. SSC's "Physics"/"Chemistry" columns come from a
  // different (100-mark) subject layout and aren't comparable.
  if (meta.exam !== 'HSC') return null;
  const names = (meta.subjects || []).map(s => (s.name || '').toLowerCase());
  const find = (...keys) => {
    for (const k of keys) {
      const i = names.findIndex(n => n.includes(k));
      if (i >= 0) return i;
    }
    return -1;
  };
  const p = find('physics');
  const c = find('chemistry');
  // "Higher Mathematics" / "Mathematics" — never the generic "Compulsory".
  const m = find('higher mathematics', 'mathematics', 'math');
  if (p < 0 || c < 0 || m < 0) return null;
  return { p, c, m };
}

function computePcm(ds) {
  const cols = pcmColumns(ds.meta);
  ds.pcmCols = cols;
  if (!cols || !ds.subj || !ds.width) { ds.pcm = null; return; }
  const out = new Array(ds.n);
  let have = 0;
  for (let i = 0; i < ds.n; i++) {
    const off = i * ds.width;
    const a = ds.subj[off + cols.p], b = ds.subj[off + cols.c], c = ds.subj[off + cols.m];
    if (a === NO_MARK || b === NO_MARK || c === NO_MARK) { out[i] = -1; continue; }
    out[i] = a + b + c;
    have++;
  }
  ds.pcm = out;
  ds.pcmHave = have;
}

/* Merit order. GPA leads, then total marks, then PCM where it is known,
   then roll number. The dataset ships pre-sorted on the old rule, so the
   parallel arrays are physically reordered here and index+1 stays the
   rank everywhere else in the app. */
function resortDataset(ds) {
  const pcm = ds.pcm;
  const perm = new Array(ds.n);
  for (let i = 0; i < ds.n; i++) perm[i] = i;
  const key = (a, b) =>
    (ds.gpa[b] - ds.gpa[a]) ||
    (ds.total[b] - ds.total[a]) ||
    (pcm ? ((pcm[b] < 0 ? -1 : pcm[b]) - (pcm[a] < 0 ? -1 : pcm[a])) : 0) ||
    (ds.roll[a] - ds.roll[b]);
  perm.sort(key);

  const pick = arr => { const o = new Array(perm.length); for (let i = 0; i < perm.length; i++) o[i] = arr[perm[i]]; return o; };
  ds.roll  = pick(ds.roll);
  ds.name  = pick(ds.name);
  ds.gpa   = pick(ds.gpa);
  ds.total = pick(ds.total);
  ds.sid   = pick(ds.sid);
  if (pcm) ds.pcm = pick(pcm);
  if (ds.subj && ds.width) {
    const nb = new Uint8Array(ds.n * ds.width);
    for (let i = 0; i < ds.n; i++) {
      nb.set(ds.subj.subarray(perm[i] * ds.width, perm[i] * ds.width + ds.width), i * ds.width);
    }
    ds.subj = nb;
  }
}

/* PCM merit list: GPA, then PCM, then total. Only students with all three. */
function buildPcmOrder(ds) {
  if (!ds.pcm) return [];
  const idx = [];
  for (let i = 0; i < ds.n; i++) if (ds.pcm[i] >= 0) idx.push(i);
  idx.sort((a, b) =>
    (ds.gpa[b] - ds.gpa[a]) ||
    (ds.pcm[b] - ds.pcm[a]) ||
    (ds.total[b] - ds.total[a]) ||
    (ds.roll[a] - ds.roll[b]));
  return idx;
}

async function loadDataset(push = true) {
  const meta = findMeta(S.exam, S.year, S.group);
  if (!meta) { $('#workspace').hidden = true; return; }

  S.loading = true;
  $('#workspace').hidden = false;
  $('#loading').hidden = false;
  $('#wsTitle').textContent = `${meta.exam} ${meta.year} — ${meta.group}`;
  $('#wsMeta').textContent = 'Loading…';
  applySeo(meta);
  $('#cmpExam').textContent = `${meta.exam} ${meta.year} ${meta.group}`;

  try {
    const res = await fetch('data/' + meta.id + '.json');
    if (!res.ok) throw new Error(meta.id + ' ' + res.status);
    const j = await res.json();

    const ds = {
      meta,
      schools: j.schools,
      roll: j.roll,
      name: j.name,
      gpa: j.gpa,
      total: j.total,
      sid: j.sid,
      subj: j.subjects ? b64ToBytes(j.subjects) : null,
      width: j.subjWidth,
    };
    ds.n = ds.roll.length;
    computePcm(ds);
    resortDataset(ds);
    ds.nameL = ds.name.map(s => s.toLowerCase());
    ds.schoolL = ds.schools.map(s => s.toLowerCase());
    ds.rollS = ds.roll.map(String);
    ds.byRoll = new Map();
    ds.roll.forEach((r, i) => { if (!ds.byRoll.has(r)) ds.byRoll.set(r, i); });
    S.ds = ds;

    // school filter dropdown
    $('#schoolFilter').innerHTML =
      '<option value="">All ' + capWord(true).toLowerCase() + '</option>' +
      ds.schools.map((s, i) => `<option value="${i}">${esc(s)}</option>`).join('');

    $('#wsMeta').textContent =
      `${nf(meta.count)} students • ${nf(meta.schools)} institutions • ranked by GPA, then total marks` +
      (S.ds && S.ds.pcm ? ' • PCM merit available' : '') +
      (meta.hasSubjects ? ' • subject-wise marks available' : '');

    // the PCM tab depends on this dataset having named PCM columns
    setView(S.view === 'pcm' && S.ds.pcm ? 'pcm'
          : S.view === 'compare' ? 'compare'
          : S.view === 'schools' ? 'schools' : 'students');
    applyFilters();
    renderSchools();
    if (push) writeUrl(true);
    if (S.openRoll != null) {
      const i = ds.byRoll.get(S.openRoll);
      if (i != null) openStudent(i, false); else S.openRoll = null;
    }
  } catch (e) {
    console.error(e);
    $('#loading').hidden = true;
    $('#wsMeta').innerHTML = '<b style="color:var(--red)">Could not load this dataset.</b> ' +
      'If you opened the file directly from disk, serve the folder over HTTP (see README).';
  }
  S.loading = false;
  $('#loading').hidden = true;
}

/* ────────────────────────────── filtering ──────────────────────────── */
function applyFilters() {
  const ds = S.ds;
  if (!ds) return;
  const q = S.q.trim().toLowerCase();
  const digits = /^\d+$/.test(q);
  const sid = S.school === '' ? -1 : +S.school;
  const out = [];
  for (let i = 0; i < ds.n; i++) {
    if (S.gpaMin && ds.gpa[i] < S.gpaMin * 100) continue;
    if (sid >= 0 && ds.sid[i] !== sid) continue;
    if (q) {
      const hit = digits
        ? ds.rollS[i].includes(q)
        : (ds.nameL[i].includes(q) || ds.schoolL[ds.sid[i]].includes(q) || ds.rollS[i].includes(q));
      if (!hit) continue;
    }
    out.push(i);
  }
  S.rows = out;
  renderChips();
  renderTable();
}

function renderChips() {
  const c = [];
  if (S.q) c.push(['q', `“${S.q}”`]);
  if (S.gpaMin) c.push(['gpa', `GPA ${S.gpaMin.toFixed(2)}+`]);
  if (S.school !== '') c.push(['school', S.ds.schools[+S.school]]);
  $('#chips').innerHTML = c.map(([k, v]) =>
    `<span class="chip">${esc(v)}<button data-drop="${k}" aria-label="Remove filter">${icon('close')}</button></span>`).join('');
}

/* ─────────────────────────── virtual table ─────────────────────────── */
const rowH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--row-h')) || 52;

function renderTable() {
  const ds = S.ds, list = S.rows, sc = $('#tableScroll');
  if (!ds) return;
  const n = list.length, h = rowH();
  $('#tableSpacer').style.height = (n * h) + 'px';
  $('#emptyState').hidden = n > 0;
  sc.style.display = n ? '' : 'none';
  $('#tableFoot').textContent = n
    ? `Showing ${nf(n)} of ${nf(ds.n)} students${n === ds.n ? '' : ' — scroll to browse, click a row for full marks'}`
    : '';
  paintRows();
}

let rafId = 0;
function paintRows() {
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    const ds = S.ds, list = S.rows, sc = $('#tableScroll'), box = $('#rows');
    if (!ds || !list.length) { box.innerHTML = ''; return; }
    const h = rowH();
    const first = Math.max(0, Math.floor(sc.scrollTop / h) - 6);
    const last = Math.min(list.length, first + Math.ceil(sc.clientHeight / h) + 12);
    const q = S.q.trim().toLowerCase();
    const hR = $('#hRank');
    if (hR) hR.textContent = S.school !== '' ? 'Merit' : 'Rank';
    let html = '';
    for (let k = first; k < last; k++) {
      const i = list[k];
      const g = ds.gpa[i], t = ds.total[i];
      const cls = g >= 500 ? 'pill-g5' : g >= 400 ? 'pill-g4' : 'pill-g0';
      // With an institution selected the list is that college's own merit
      // order; otherwise rows carry the true board rank. The student card
      // always shows the board rank.
      const inInst = S.school !== '';
      const shown = inInst ? k + 1 : i + 1;
      html += `<div class="row" data-i="${i}" style="top:${k * h}px" role="button" tabindex="0">
        <span class="rk ${shown < 4 ? 'top' : ''}">${nf(shown)}</span>
        <span class="rl">${ds.rollS[i]}</span>
        <span class="nm">${hl(ds.name[i], q)}</span>
        <span class="sc">${hl(ds.schools[ds.sid[i]], q)}</span>
        <span class="num c-gpa"><span class="pill ${cls}">${gpaTxt(g)}</span></span>
        <span class="num c-tot"><b>${t < 0 ? '—' : t}</b></span>
        <span class="go">›</span>
      </div>`;
    }
    box.innerHTML = html;
  });
}

function hl(text, q) {
  const safe = esc(text);
  if (!q || q.length < 2) return safe;
  const i = safe.toLowerCase().indexOf(q);
  if (i < 0) return safe;
  return safe.slice(0, i) + '<mark>' + safe.slice(i, i + q.length) + '</mark>' + safe.slice(i + q.length);
}

/* ─────────────────────────── student modal ─────────────────────────── */
const NO_MARK = 255;   // stored for a subject the student did not sit

function subjectsOf(i) {
  const ds = S.ds;
  if (!ds.subj) return null;
  const off = i * ds.width;
  if (ds.subj[off] === 255) return null;
  return Array.from(ds.subj.subarray(off, off + ds.width));
}

function studentCard(i, forPrint) {
  const ds = S.ds, m = ds.meta;
  const roll = ds.roll[i], name = ds.name[i], g = ds.gpa[i], t = ds.total[i];
  const school = ds.schools[ds.sid[i]];
  const rank = i + 1;   // the dataset is pre-sorted by rank, so index+1 IS the board rank
  const filtered = !!(S.q.trim() || S.gpaMin || S.school !== '');
  const posInFilter = filtered ? S.rows.indexOf(i) + 1 : 0;
  const subs = subjectsOf(i);
  const defs = m.subjects;
  let bars = '';
  if (subs) {
    bars = '<p class="subj-h">Subject-wise marks</p>' + defs.map((d, k) => {
      const v = subs[k];
      if (v === NO_MARK) return '';   // not sat by this student - do not show
      const pct = Math.min(100, Math.round(v / d.full * 100));
      const cls = pct >= 80 ? 'g5' : pct < 33 ? 'lo' : '';
      return `<div class="subj">
        <div class="subj-row"><span class="sn">${esc(d.name)}</span>
          <span class="sv">${v} / ${d.full}</span></div>
        <div class="bar ${cls}"><i style="width:${pct}%"></i></div>
      </div>`;
    }).join('');
  }
  // Every exam here is marked out of 1300 (6 x 200 + ICT 100). Older datasets
  // used a fixed schema that summed to exactly that; HSC 2026 lists every
  // *possible* elective (11-19 columns), so summing defs would divide by
  // 2100-3700. Use the real board scale and the stored total, which already
  // excludes subjects the student did not take (stored as 255).
  const PCT_FULL = 1300;
  const marksPct = (subs && t >= 0)
    ? Math.min(100, Math.round(t / PCT_FULL * 100)) : null;
  const actions = forPrint ? '' : `<div class="scard-actions">
      <button class="btn btn-ghost" data-act="copy">${icon('copy')} Copy result</button>
      <button class="btn btn-ghost" data-act="link">${icon('link')} Copy link</button>
      <button class="btn btn-ghost" data-act="print">${icon('print')} Print / PDF</button>
      <button class="btn btn-ghost" data-act="school">${icon('school')} This institution</button>
    </div>`;
  return `<div class="scard" data-i="${i}">
    <div class="scard-top">
      <div class="avatar">${esc(name.replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase() || '?')}</div>
      <div>
        <h3 id="mName">${esc(name)}</h3>
        <div class="sub">Roll <b>${roll}</b> • ${esc(m.exam)} ${m.year} • ${esc(m.group)}</div>
        <div class="sub">${esc(school)}</div>
      </div>
    </div>
    <div class="kpis">
      <div class="kpi"><b>${rank}</b><span>Board rank</span></div>
      <div class="kpi"><b>${gpaTxt(g)}</b><span>GPA</span></div>
      <div class="kpi"><b>${t < 0 ? '—' : t}</b><span>Total marks</span></div>
      <div class="kpi"><b>${marksPct == null ? '—' : marksPct + '%'}</b><span>${marksPct == null ? 'Marks %' : 'Of ' + PCT_FULL}</span></div>
    </div>
    ${bars}
    <p class="note">Board rank <b>${nf(rank)}</b> of ${nf(m.count)} ${esc(m.exam)} ${m.year} ${esc(m.group)}
      students, ordered by GPA then total marks.${posInFilter ? ` Shown as <b>#${nf(posInFilter)}</b> in your current filtered list.` : ''}
      Unofficial — verify with your official marksheet.</p>
    ${pcmCardLine(ds, i)}
    ${actions}
  </div>`;
}

/* PCM merit position for one student (cached alongside the PCM view). */
function pcmMeritOf(ds, i) {
  if (!ds || !ds.pcm || ds.pcm[i] < 0) return null;
  if (!S.pcmOrder || S.pcmOrderDs !== ds) {
    S.pcmOrder = buildPcmOrder(ds);
    S.pcmOrderDs = ds;
    S.pcmRank = new Map();
    S.pcmOrder.forEach((idx, r) => S.pcmRank.set(idx, r + 1));
  }
  const rank = S.pcmRank.get(i);
  return rank ? { rank, of: S.pcmOrder.length, marks: ds.pcm[i] } : null;
}

/* Shown at the end of a student card: PCM merit + combined marks. */
function pcmCardLine(ds, i) {
  const m = pcmMeritOf(ds, i);
  if (!m) return '';
  const cols = ds.pcmCols;
  const names = (ds.meta.subjects || []).map(x => x.name);
  const trio = [cols.p, cols.c, cols.m].map(c => names[c]).join(' + ');
  return `<div class="pcm-merit">
      <div class="pcm-merit-h">PCM merit</div>
      <div class="pcm-merit-b">
        <b>#${nf(m.rank)}</b> of ${nf(m.of)}
        <span>${trio} = <b>${m.marks}</b></span>
      </div>
      <div class="pcm-merit-n">Among students who sat all three, ordered by GPA then PCM marks.</div>
    </div>`;
}

function openStudent(i, push = true) {
  S.openRoll = S.ds.roll[i];
  $('#modalBody').innerHTML = studentCard(i);
  $('#modal').hidden = false;
  document.body.style.overflow = 'hidden';
  if (push) writeUrl(true);
}
function closeModal() {
  $('#modal').hidden = true;
  document.body.style.overflow = '';
  S.openRoll = null;
  writeUrl(true);
}

/* ───────────────────────────── schools view ────────────────────────── */
function aggregate() {
  const ds = S.ds;
  const acc = new Map();   // sid -> {n, g5, sum, n5, best}
  for (let i = 0; i < ds.n; i++) {
    const s = ds.sid[i];
    let a = acc.get(s);
    if (!a) { a = { n: 0, g5: 0, sum: 0, ng: 0, best: Infinity, sid: s }; acc.set(s, a); }
    a.n++;
    if (ds.gpa[i] >= 0) { a.sum += ds.gpa[i] / 100; a.ng++; }
    if (ds.gpa[i] >= 500) a.g5++;
    if (i < a.best) a.best = i;
  }
  const list = [...acc.values()].map(a => ({ ...a, avg: a.ng ? a.sum / a.ng : 0, best: a.best + 1 }));
  const cmp = {
    gpa5: (a, b) => b.g5 - a.g5 || b.avg - a.avg || a.best - b.best,
    avg: (a, b) => b.avg - a.avg || b.g5 - a.g5,
    best: (a, b) => a.best - b.best,
    count: (a, b) => b.n - a.n,
  }[S.schoolSort];
  return list.sort(cmp);
}

function renderSchools() {
  if (!S.ds) return;
  const q = $('#qSchool').value.trim().toLowerCase();
  const list = aggregate().filter(a => !q || S.ds.schools[a.sid].toLowerCase().includes(q));
  const top = Math.max(1, ...list.map(a => a.n));
  $('#schoolBody').innerHTML = list.slice(0, 500).map((a, k) => `
    <tr data-sid="${a.sid}">
      <td class="badge ${k < 3 ? 'top' : ''}">${k + 1}</td>
      <td class="sname">${esc(S.ds.schools[a.sid])}</td>
      <td class="num">${nf(a.n)}</td>
      <td class="num">${nf(a.g5)}</td>
      <td class="num">${a.avg ? a.avg.toFixed(2) : '—'}</td>
      <td class="num">${nf(a.best)}</td>
    </tr>`).join('');
  $('#schoolFoot').textContent =
    `${nf(list.length)} institutions ranked by ${S.schoolSort === 'gpa5' ? 'number of GPA-5 students' :
      S.schoolSort === 'avg' ? 'average GPA' : S.schoolSort === 'best' ? 'best board rank' : 'number of students'}` +
    (list.length > 500 ? ' (showing top 500)' : '') + '. Click a row to filter the student list.';
}

/* ────────────────────────────── compare ────────────────────────────── */
function renderCompare() {
  const ds = S.ds;
  if (!ds) return;
  const [a, b] = S.cmp;
  const box = $('#cmpOut');
  if (a == null && b == null) {
    box.innerHTML = '<div class="cmp-empty">Enter two roll numbers above to compare.</div>';
    return;
  }
  box.innerHTML = [a, b].map((roll, k) => {
    if (roll == null) return '<div class="cmp-empty">—</div>';
    const i = ds.byRoll.get(roll);
    if (i == null) {
      const near = ds.rollS.filter(r => r.startsWith(String(roll).slice(0, 3))).slice(0, 4);
      return `<div class="card"><b>Roll ${esc(roll)} not found</b> in ${ds.meta.exam} ${ds.meta.year} ${ds.meta.group}.
        ${near.length ? '<p class="note">Did you mean ' + near.join(', ') + '?</p>' : ''}</div>`;
    }
    return `<div class="card">${studentCard(i, true)}</div>`;
  }).join('');
  // relabel the two cards
  $$('#cmpOut .card').forEach((c, k) => {
    const t = document.createElement('div');
    t.className = 'subj-h';
    t.textContent = k === 0 ? 'Student A' : 'Student B';
    c.prepend(t);
  });
}

/* ─────────────────────────────── print one result ─────────────────────── */
/* Print / save-as-PDF for a single student.
   window.print() would send the whole site to the printer — nav, tables and
   all — so the card is rendered into a hidden iframe holding only this
   result, and the dialog is opened from there. The live page is never
   touched, so nothing leaks into an ordinary Ctrl+P. */
function printStudent(i) {
  const ds = S.ds;
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('title', 'Print result');
  frame.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    toast('Printing is not available in this browser.', false);
    return;
  }

  // Resolve the stylesheet the same way the host page does, so this works
  // from "/" and from the prerendered /hsc-2026-science/ style URLs alike.
  const link = document.querySelector('link[rel="stylesheet"][href*="styles.css"]');
  const cssHref = link ? link.href : new URL('assets/styles.css', location.href).href;

  const m = ds.meta;
  doc.open();
  doc.write('<!doctype html><html><head><meta charset="utf-8">' +
    '<title>' + esc(ds.name[i]) + ' — Roll ' + ds.roll[i] + ' — Shikhor</title>' +
    '<link rel="stylesheet" href="' + esc(cssHref) + '">' +
    '<style>' + [
      '@page { size: A4 portrait; margin: 14mm; }',
      '* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
      'html, body { background: #fff !important; color: #101828 !important; }',
      'body { margin: 0; padding: 0; font: 14px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }',
      '.print-head { display: flex; align-items: baseline; justify-content: space-between;',
      '  gap: 12px; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 16px; }',
      '.print-head .ph-brand { font-weight: 800; font-size: 17px; color: #2563eb; letter-spacing: .02em; }',
      '.print-head .ph-sub { font-size: 11px; color: #5b6875; text-align: right; }',
      '.print-foot { margin-top: 16px; padding-top: 8px; border-top: 1px solid #d7dee8;',
      '  font-size: 10.5px; color: #5b6875; }',
      '.scard { border: 1px solid #d7dee8 !important; border-radius: 12px; padding: 16px !important; }',
      '.scard-top { padding-right: 0 !important; }'
    ].join('') + '</style></head><body>' +
    '<div class="print-head">' +
      '<div class="ph-brand">Shikhor</div>' +
      '<div class="ph-sub">' + esc(m.exam + ' ' + m.year) + ' &middot; ' + esc(m.group) +
      '<br>Chattogram Board &middot; unofficial rank archive</div>' +
    '</div>' +
    studentCard(i, true) +
    '<p class="print-foot">Printed from Shikhor (ctgrank.pages.dev) on ' +
      esc(new Date().toLocaleDateString('en-GB')) + '. ' +
      'Unofficial — always verify against your official marksheet or the board\u2019s own result portal. ' +
      'Shikhor &copy; ' + new Date().getFullYear() + ' Jahin.</p>' +
    '</body></html>');
  doc.close();

  const w = frame.contentWindow;
  const cleanup = () => frame.remove();
  w.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 5 * 60 * 1000);   // safety net if afterprint never fires

  // Open the dialog exactly once. The stylesheet may still be loading when
  // the load event fires, so retry briefly — but never twice.
  let opened = false;
  const go = () => {
    if (opened) return;
    opened = true;
    try { w.focus(); w.print(); } catch (e) { cleanup(); }
  };
  if (doc.readyState === 'complete') go(); else frame.onload = go;
  setTimeout(go, 300);
  toast('Opening print dialog…');
}

/* ─────────────────────────────── URL state ─────────────────────────── */
function writeUrl(push) {
  const p = new URLSearchParams();
  p.set('exam', S.exam); p.set('year', S.year); p.set('group', S.group);
  if (S.q) p.set('q', S.q);
  if (S.openRoll != null) p.set('roll', S.openRoll);
  if (S.view !== 'students') p.set('view', S.view);
  const url = location.pathname + '?' + p.toString();
  history[push ? 'pushState' : 'replaceState']({}, '', url);
}
function readUrl() {
  const p = new URLSearchParams(location.search);
  if (p.get('exam')) S.exam = p.get('exam').toUpperCase() === 'HSC' ? 'HSC' : 'SSC';
  if (p.get('year')) S.year = +p.get('year');
  if (p.get('group')) S.group = p.get('group')[0].toUpperCase() + p.get('group').slice(1).toLowerCase();
  if (p.get('q')) S.q = p.get('q');
  if (p.get('roll')) S.openRoll = +p.get('roll');
  if (p.get('view')) S.view = p.get('view');
  if (!GROUPS.includes(S.group)) S.group = 'Science';
}

/* ──────────────────────────────── views ────────────────────────────── */
function setView(v) {
  S.view = v;
  // PCM needs named Physics/Chemistry/Math columns; hide the tab where the
  // source data can't supply them.
  const hasPcm = !!(S.ds && S.ds.pcm);
  if (v === 'pcm' && !hasPcm) v = 'students';
  const pcmBtn = $('#viewPcmBtn');
  if (pcmBtn) pcmBtn.hidden = !hasPcm;
  S.view = v;
  $('#viewStudents').hidden = v !== 'students';
  $('#viewSchools').hidden = v !== 'schools';
  $('#viewCompare').hidden = v !== 'compare';
  $('#viewPcm').hidden = v !== 'pcm';
  $$('#viewSeg .seg-btn').forEach(b => b.classList.toggle('is-on', b.dataset.view === v));
  if (v === 'students') { renderTable(); }
  if (v === 'schools') renderSchools();
  if (v === 'compare') renderCompare();
  if (v === 'pcm') renderPcm();
}

/* PCM merit list — GPA first, then combined PCM marks. */
function pcmMatches(i, q, digits) {
  const ds = S.ds;
  if (!q) return true;
  if (digits) return ds.rollS[i].includes(q);
  return ds.nameL[i].includes(q) ||
         ds.schoolL[ds.sid[i]].includes(q) ||
         ds.rollS[i].includes(q);
}

function renderPcm() {
  const ds = S.ds;
  if (!ds || !ds.pcm) return;
  if (!S.pcmOrder || S.pcmOrderDs !== ds) {
    S.pcmOrder = buildPcmOrder(ds);
    S.pcmOrderDs = ds;
    S.pcmRank = new Map();
    S.pcmOrder.forEach((i, r) => S.pcmRank.set(i, r + 1));
  }
  const q = (S.pcmQ || '').trim().toLowerCase();
  const digits = /^\d+$/.test(q);
  S.pcmRows = q ? S.pcmOrder.filter(i => pcmMatches(i, q, digits)) : S.pcmOrder;

  const list = S.pcmRows;
  const clear = $('#pcmClearQ');
  if (clear) clear.hidden = !q;

  $('#pcmFoot').textContent = q
    ? `${nf(list.length)} match${list.length === 1 ? '' : 'es'} for “${(S.pcmQ || '').trim()}” — of ${nf(S.pcmOrder.length)} who sat all three`
    : `${nf(list.length)} of ${nf(ds.n)} students sat Physics, Chemistry and Mathematics`;

  $('#pcmSpacer').style.height = (list.length * rowH()) + 'px';
  paintPcm();
}

let pcmRaf = 0;
function paintPcm() {
  cancelAnimationFrame(pcmRaf);
  pcmRaf = requestAnimationFrame(() => {
    const ds = S.ds;
    if (!ds || !S.pcmOrder) return;
    const list = S.pcmRows || S.pcmOrder, sc = $('#pcmScroll'), box = $('#pcmRows');
    const h = rowH();
    const first = Math.max(0, Math.floor(sc.scrollTop / h) - 6);
    const last = Math.min(list.length, first + Math.ceil(sc.clientHeight / h) + 12);
    const q = (S.pcmQ || '').trim().toLowerCase();
    let html = '';
    for (let k = first; k < last; k++) {
      const i = list[k];
      const g = ds.gpa[i];
      const cls = g >= 500 ? 'pill-g5' : g >= 400 ? 'pill-g4' : 'pill-g0';
      // Always the student's true PCM merit, never their position in the
      // search results — merit belongs to the student, not to the filter.
      const merit = S.pcmRank.get(i) || (k + 1);
      html += `<div class="row" data-i="${i}" style="top:${k * h}px" role="button" tabindex="0">
        <span class="rk ${merit < 4 ? 'top' : ''}">${nf(merit)}</span>
        <span class="rl">${hl(ds.rollS[i], q)}</span>
        <span class="nm">${hl(ds.name[i], q)}</span>
        <span class="sc">${hl(ds.schools[ds.sid[i]], q)}</span>
        <span class="num c-gpa"><span class="pill ${cls}">${gpaTxt(g)}</span></span>
        <span class="num c-tot"><b>${ds.pcm[i]}</b></span>
        <span class="go">›</span>
      </div>`;
    }
    box.innerHTML = html;
  });
}

/* ─────────────────────────────── wiring ────────────────────────────── */
function wire() {
  // nav
  $('#navToggle').addEventListener('click', () => {
    const l = $('#navLinks'); const open = l.classList.toggle('open');
    $('#navToggle').setAttribute('aria-expanded', String(open));
  });
  $('#navLinks').addEventListener('click', e => { if (e.target.closest('a')) $('#navLinks').classList.remove('open'); });
  $$('[data-goto]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    setView(a.dataset.goto);
    $('#workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
    writeUrl(true);
  }));
  $('#topBtn').addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

  // theme + share
  $('#shareBtn').addEventListener('click', share);

  // picker
  $('#examSeg').addEventListener('click', e => {
    const b = e.target.closest('.seg-btn'); if (!b) return;
    S.exam = b.dataset.exam;
    const years = [...new Set(S.catalog.datasets.filter(m => m.exam === S.exam).map(m => m.year))].sort((a, b2) => b2 - a);
    S.year = years[0];
    S.group = GROUPS.find(g => findMeta(S.exam, S.year, g)) || 'Science';
    renderPicker(); loadDataset();
  });
  $('#yearCards').addEventListener('click', e => {
    const b = e.target.closest('.year-card'); if (!b || b.disabled) return;
    S.year = +b.dataset.year;
    if (!findMeta(S.exam, S.year, S.group)) S.group = GROUPS.find(g => findMeta(S.exam, S.year, g)) || 'Science';
    renderPicker(); loadDataset();
  });
  $('#groupTabs').addEventListener('click', e => {
    const b = e.target.closest('.group-btn'); if (!b || b.disabled) return;
    S.group = b.dataset.group;
    renderPicker(); loadDataset();
  });

  // view tabs
  $('#viewSeg').addEventListener('click', e => {
    const b = e.target.closest('.seg-btn'); if (!b) return;
    setView(b.dataset.view); writeUrl(true);
  });

  // search
  const onQ = debounce(() => { S.q = $('#q').value; applyFilters(); writeUrl(false); }, 140);
  $('#q').addEventListener('input', () => { $('#clearQ').hidden = !$('#q').value; onQ(); });
  $('#clearQ').addEventListener('click', () => { $('#q').value = ''; $('#clearQ').hidden = true; S.q = ''; applyFilters(); writeUrl(false); $('#q').focus(); });
  $('#gpaFilter').addEventListener('change', e => { S.gpaMin = e.target.value ? +e.target.value : 0; applyFilters(); });
  $('#schoolFilter').addEventListener('change', e => { S.school = e.target.value; applyFilters(); });
  $('#chips').addEventListener('click', e => {
    const b = e.target.closest('[data-drop]'); if (!b) return;
    const k = b.dataset.drop;
    if (k === 'q') { $('#q').value = ''; $('#clearQ').hidden = true; S.q = ''; }
    if (k === 'gpa') { $('#gpaFilter').value = ''; S.gpaMin = 0; }
    if (k === 'school') { $('#schoolFilter').value = ''; S.school = ''; }
    applyFilters();
  });
  $('#resetFilters').addEventListener('click', () => {
    $('#q').value = ''; $('#clearQ').hidden = true; $('#gpaFilter').value = ''; $('#schoolFilter').value = '';
    S.q = ''; S.gpaMin = 0; S.school = ''; applyFilters();
  });

  // table
  $('#tableScroll').addEventListener('scroll', paintRows, { passive: true });
  $('#pcmScroll').addEventListener('scroll', paintPcm, { passive: true });
  $('#pcmRows').addEventListener('click', e => {
    const r = e.target.closest('.row');
    if (r) openStudent(+r.dataset.i);
  });
  $('#pcmQ').addEventListener('input', e => {
    S.pcmQ = e.target.value;
    $('#pcmScroll').scrollTop = 0;
    renderPcm();
  });
  $('#pcmQ').addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.target.value = ''; S.pcmQ = ''; renderPcm(); }
  });
  $('#pcmClearQ').addEventListener('click', () => {
    $('#pcmQ').value = '';
    S.pcmQ = '';
    $('#pcmScroll').scrollTop = 0;
    renderPcm();
    $('#pcmQ').focus();
  });
  addEventListener('resize', debounce(() => { renderTable(); }, 120));
  $('#rows').addEventListener('click', e => {
    const r = e.target.closest('.row'); if (r) openStudent(+r.dataset.i);
  });
  $('#rows').addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const r = e.target.closest('.row'); if (!r) return;
    e.preventDefault(); openStudent(+r.dataset.i);
  });

  // schools
  $('#qSchool').addEventListener('input', debounce(renderSchools, 140));
  $('#schoolSort').addEventListener('change', e => { S.schoolSort = e.target.value; renderSchools(); });
  $('#schoolBody').addEventListener('click', e => {
    const tr = e.target.closest('tr'); if (!tr) return;
    $('#schoolFilter').value = tr.dataset.sid;
    S.school = tr.dataset.sid; S.q = ''; $('#q').value = ''; $('#clearQ').hidden = true;
    applyFilters(); setView('students');
    $('#workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // compare
  $('#cmpBtn').addEventListener('click', doCompare);
  [$('#cmpA'), $('#cmpB')].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') doCompare(); }));

  // modal
  $('#modal').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });
  $('#modalBody').addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const card = b.closest('.scard'); const i = +card.dataset.i;
    const ds = S.ds;
    if (b.dataset.act === 'copy') {
      const subs = subjectsOf(i);
      const txt = [
        `${ds.meta.exam} ${ds.meta.year} — ${ds.meta.group}`,
        `Name: ${ds.name[i]}`, `Roll: ${ds.roll[i]}`, `Institution: ${ds.schools[ds.sid[i]]}`,
        `GPA: ${gpaTxt(ds.gpa[i])}`, `Total marks: ${ds.total[i]}`,
        ds.meta.hasSubjects && subs ? '\nSubject-wise:\n' + ds.meta.subjects
          .map((d, k) => subs[k] === NO_MARK ? '' : `  ${d.name}: ${subs[k]}/${d.full}`)
          .filter(Boolean).join('\n') : '',
        '\nShikhor © ' + new Date().getFullYear() + ' Jahin — unofficial, verify with your official marksheet.',
      ].filter(Boolean).join('\n');
      try { await navigator.clipboard.writeText(txt); toast('Result copied'); }
      catch { toast('Copy failed — select the text manually', false); }
    }
    if (b.dataset.act === 'link') {
      const url = location.origin + location.pathname +
        `?exam=${S.exam}&year=${S.year}&group=${S.group}&roll=${ds.roll[i]}`;
      try { await navigator.clipboard.writeText(url); toast('Link copied'); }
      catch { toast(url, false); }
    }
    if (b.dataset.act === 'print') printStudent(i);
    if (b.dataset.act === 'school') {
      $('#schoolFilter').value = ds.sid[i]; S.school = String(ds.sid[i]);
      closeModal(); applyFilters(); setView('students');
      $('#workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  addEventListener('popstate', () => {
    const p = new URLSearchParams(location.search);
    const ex = p.get('exam'), yr = +p.get('year'), gr = p.get('group');
    if (ex && yr && gr && (ex !== S.exam || yr !== S.year || gr !== S.group)) {
      S.exam = ex; S.year = yr; S.group = gr[0].toUpperCase() + gr.slice(1).toLowerCase();
      renderPicker(); loadDataset(false);
    }
  });
}

function doCompare() {
  const a = $('#cmpA').value.trim(), b = $('#cmpB').value.trim();
  S.cmp = [a ? +a : null, b ? +b : null];
  renderCompare();
}

async function share() {
  const url = location.href;
  const data = { title: 'Shikhor — Board Rank, Chattogram', text: 'Unofficial SSC & HSC board rank for the Chattogram Board — Shikhor, © Jahin', url };
  try {
    if (navigator.share) { await navigator.share(data); return; }
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch { toast(url, false); }
}

/* ──────────────────────────────── boot ─────────────────────────────── */
(async function boot() {
  initTheme();
  // Ranking is deliberately consolidated on ONE host (SEO_SITE), so mirrors
  // are treated as copies rather than competing duplicates. applySeo()
  // rewrites this link per dataset once the data loads.
  //
  // Note: Surge hijacks /robots.txt on every *.surge.sh subdomain and serves
  // "Disallow: /", so Surge copies can never be crawled. The canonical host
  // must be one that actually serves our robots.txt (Cloudflare Pages here).
  // Change it with: python3 tools/set_canonical.py https://new.host
  wire();
  try {
    await loadCatalog();
  } catch (e) {
    console.error(e);
    $('#pickerNote').innerHTML = '<b style="color:var(--red)">Could not read data/index.json.</b> ' +
      'Serve this folder over HTTP (<code>python3 -m http.server</code>) — opening index.html from disk blocks local file loading.';
    return;
  }
  readUrl();
  if (!findMeta(S.exam, S.year, S.group)) {
    const m = S.catalog.datasets[0];
    S.exam = m.exam; S.year = m.year; S.group = m.group;
  }
  renderPicker();
  $('#q').value = S.q;
  $('#clearQ').hidden = !S.q;
  setView(S.view === 'compare' || S.view === 'schools' ? S.view : 'students');
  await loadDataset(false);
})();

})();
