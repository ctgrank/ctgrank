#!/usr/bin/env python3
"""Programmatic layout audit (no eyes needed): overflow, geometry, contrast-ish checks."""
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000/"

JS_OVERFLOW = """() => {
  const bad = [];
  const vw = document.documentElement.clientWidth;
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    if (r.right > vw + 1.5 || r.left < -1.5) {
      const st = getComputedStyle(el);
      if (st.position === 'fixed' || st.position === 'absolute') return;
      bad.push(`${el.tagName}.${(el.className||'').toString().split(' ')[0]} L${r.left.toFixed(0)} R${r.right.toFixed(0)} vw${vw}`);
    }
  });
  return {vw, docW: document.documentElement.scrollWidth, bad: bad.slice(0, 12)};
}"""

JS_GEOM = """() => {
  const g = s => { const e = document.querySelector(s); if (!e) return null;
    const r = e.getBoundingClientRect(); return {w:Math.round(r.width),h:Math.round(r.height),t:Math.round(r.top),l:Math.round(r.left)}; };
  const rowH = getComputedStyle(document.documentElement).getPropertyValue('--row-h');
  const rows = [...document.querySelectorAll('#rows .row')];
  const tops = rows.map(r => parseFloat(r.style.top));
  return {
    rowH: rowH.trim(),
    rowCount: rows.length,
    rowHeights: [...new Set(rows.map(r => Math.round(r.getBoundingClientRect().height)))],
    firstTop: tops[0], lastTop: tops[tops.length-1],
    tableScroll: g('#tableScroll'), spacer: g('#tableSpacer'),
    head: g('#tableHead'), nav: g('#nav'), hero: g('.hero'),
    yearCards: document.querySelectorAll('.year-card').length,
    groupBtns: document.querySelectorAll('.group-btn').length,
    schoolOpts: document.querySelectorAll('#schoolFilter option').length,
    cards: [...document.querySelectorAll('.card')].map(c => Math.round(c.getBoundingClientRect().width)),
  };
}"""

JS_TEXT = """() => {
  // any element whose text is visually clipped (overflow hidden) unintentionally
  const bad = [];
  document.querySelectorAll('.kpi b,.kpi span,.stat b,.stat span,.yc-year,.yc-count,.seg-btn,.btn,.group-btn,.subj-row .sn,.subj-row .sv').forEach(el => {
    if (el.scrollWidth > el.clientWidth + 2) bad.push(`${el.className}|${el.textContent.trim().slice(0,30)}|${el.scrollWidth}>${el.clientWidth}`);
  });
  return bad;
}"""


def report(pg, label):
    o = pg.evaluate(JS_OVERFLOW)
    print(f"\n── {label} ──")
    print("  viewport", o["vw"], "docScrollWidth", o["docW"],
          "→", "OK" if o["docW"] <= o["vw"] + 1 else "HORIZONTAL OVERFLOW")
    if o["bad"]:
        print("  overflowing elements:")
        for b in o["bad"]:
            print("   ", b)
    t = pg.evaluate(JS_TEXT)
    if t:
        print("  clipped text:")
        for x in t[:10]:
            print("   ", x)


with sync_playwright() as p:
    b = p.chromium.launch()

    for w, h, name in [(1280, 900, "desktop 1280"), (900, 800, "tablet 900"), (390, 780, "mobile 390")]:
        pg = b.new_page(viewport={"width": w, "height": h})
        pg.goto(BASE + "?exam=SSC&year=2024&group=Science", wait_until="networkidle")
        pg.wait_for_selector("#rows .row", timeout=30000)
        pg.wait_for_timeout(400)
        report(pg, name)
        g = pg.evaluate(JS_GEOM)
        print("  geom:", g)
        if name.startswith("desktop"):
            # scroll the virtual table and make sure rows keep painting
            pg.eval_on_selector("#tableScroll", "el => el.scrollTop = 40000")
            pg.wait_for_timeout(400)
            n = pg.locator("#rows .row").count()
            tops = pg.evaluate("() => [...document.querySelectorAll('#rows .row')].map(r=>parseFloat(r.style.top))")
            print("  after scroll→40000px: painted", n, "rows, first top", tops[0],
                  "expected ≈", round((40000 / float(g["rowH"].replace("px", ""))) - 6) * float(g["rowH"].replace("px", "")))
            first = pg.locator("#rows .row").first
            print("  first visible row text:", " | ".join(first.inner_text().split("\n")))
            # open modal
            first.click()
            pg.wait_for_selector("#modal .scard", timeout=8000)
            pg.wait_for_timeout(300)
            mb = pg.evaluate("""() => { const c=document.querySelector('.modal-card'); const r=c.getBoundingClientRect();
               return {w:Math.round(r.width), h:Math.round(r.height), top:Math.round(r.top), bottom:Math.round(r.bottom),
                       scrollH:c.scrollHeight, clientH:c.clientHeight, vh:innerHeight}; }""")
            print("  modal:", mb)
            if mb["bottom"] > mb["vh"] + 1 or mb["top"] < -1:
                print("  !! modal outside viewport")
        pg.close()

    b.close()
print("\naudit done")
