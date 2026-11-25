#!/usr/bin/env python3
"""Generate pcm.html from index.html's shared shell.

    python3 tools/build_pcm.py          # compile board data first
    python3 tools/build_pcm_page.py     # then this

The sprite, header and footer are lifted out of index.html so the nav,
theme toggle and icon set cannot drift between pages.
"""
import os
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
SITE = "https://ctgrank.pages.dev"
PAGE_URL = SITE + "/pcm"          # Pages serves this extensionless


def slice_block(doc, start, end):
    i = doc.index(start)
    j = doc.index(end, i) + len(end)
    return doc[i:j]


def main():
    idx = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()

    sprite = slice_block(idx, '<svg width="0" height="0"', "</svg>")
    header = slice_block(idx, '<header class="nav"', "</header>")
    footer = slice_block(idx, '<footer class="foot">', "</footer>")

    # mark this page current, point the in-page anchors back at the homepage
    header = header.replace('<a href="#picker" class="active">',
                            '<a href="index.html">')
    header = header.replace('<a href="#schoolsView" data-goto="schools">',
                            '<a href="index.html#schoolsView" data-goto="schools">')
    header = header.replace('<a href="#compareView" data-goto="compare">',
                            '<a href="index.html#compareView" data-goto="compare">')
    header = header.replace('<a href="#about">', '<a href="index.html#about">')
    header = header.replace(
        '<a href="pcm.html">',
        '<a href="pcm.html" class="active" aria-current="page">')
    footer = footer.replace('<a href="#picker">', '<a href="index.html#picker">')
    footer = footer.replace('<a href="#about">', '<a href="index.html#about">')

    page = f"""<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>PCM Rank Checker — Chittagong Board Rank</title>
<meta name="description" content="Check your HSC PCM rank from your roll number: Physics, Chemistry and Higher Math marks, with BUET, RUET, KUET, CUET and BUTEX eligibility and merit position." />
<meta name="author" content="Jahin" />
<meta name="copyright" content="Copyright © 2026 Jahin" />
<meta name="robots" content="index, follow" />
<meta name="google-site-verification" content="nIIOK8Yis5j2SXAVNeFqBoS3zMTAc1giGRTj1-wq-ag" />
<link rel="canonical" href="{PAGE_URL}" />

<link rel="icon" href="assets/icon.svg" type="image/svg+xml" />
<meta name="theme-color" content="#533afd" />

<meta property="og:type" content="website" />
<meta property="og:site_name" content="Chittagong Board Rank" />
<meta property="og:title" content="PCM Rank Checker — Chittagong Board Rank" />
<meta property="og:description" content="Rank your Physics, Chemistry and Higher Math marks against every PCM student, with BUET, RUET, KUET, CUET and BUTEX eligibility." />
<meta property="og:url" content="{PAGE_URL}" />
<meta property="og:image" content="{SITE}/assets/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />

<link rel="stylesheet" href="assets/styles.css" />
<script type="application/ld+json">
{{"@context":"https://schema.org","@graph":[
{{"@type":"WebSite","@id":"{SITE}/#website","name":"Chittagong Board Rank","url":"{SITE}/"}},
{{"@type":"WebPage","@id":"{PAGE_URL}","url":"{PAGE_URL}","name":"PCM Rank Checker — Chittagong Board Rank","isPartOf":{{"@id":"{SITE}/#website"}},"inLanguage":"en","dateModified":"{date.today().isoformat()}"}}
]}}
</script>
</head>
<body>
{sprite}

{header}

<main>
  <section class="rev-hero pcm-top">
    <p class="eyebrow"><svg><use href="#i-target"/></svg> Rank checker</p>
    <h1>PCM Rank Checker</h1>
    <p class="lede">Enter your roll number to see where your Physics, Chemistry and
      Higher Math marks place you — and whether you clear the grade gates for
      BUET, RUET, KUET, CUET and BUTEX.</p>
  </section>

  <div class="wrap">
    <section class="card pcm-card">
      <div class="pcm-cover" id="pcmCoverage" hidden></div>

      <form class="pcm-form" id="pcmForm" novalidate>
        <div class="rev-field">
          <label for="pcmBoard">Education board</label>
          <select class="rev-input" id="pcmBoard"></select>
        </div>
        <div class="rev-field">
          <label for="pcmSet">Examination</label>
          <select class="rev-input" id="pcmSet"></select>
        </div>
        <div class="rev-field">
          <label for="pcmRoll">Roll number</label>
          <input class="rev-input" id="pcmRoll" type="text" inputmode="numeric"
                 autocomplete="off" placeholder="e.g. 114978" maxlength="9" />
        </div>
        <button class="btn btn-primary pcm-go" id="pcmGo" type="submit">
          <svg><use href="#i-search"/></svg> Check my rank
        </button>
      </form>

      <p class="pcm-status" id="pcmStatus" hidden></p>
      <div class="pcm-result" id="pcmResult" hidden></div>
    </section>

    <section class="card pcm-card">
      <h2><svg><use href="#i-info"/></svg> How each category is ordered</h2>
      <p class="pcm-lede">A rank is 1 + the number of eligible students ahead of you.
        Ties break on the subjects listed, in that order — so two students on the
        same PCM total separate on Higher Math first.</p>
      <ul class="pcm-rules">
        <li><b>PCM ALL</b> — grades first, then PCM marks. The overall science standing.</li>
        <li><b>Only PCM Mark</b> — PCM total alone, GPA ignored. What most people mean by "PCM rank".</li>
        <li><b>BUET</b> — needs GPA 5.00 and A+ in all three. <b>BUET BME</b> adds A in Biology.</li>
        <li><b>RUET</b> — A in each of P, C, M and 13.00 grade points between them.</li>
        <li><b>KUET</b> — ranks on PCME, so English marks count. 16.00 grade points.</li>
        <li><b>CUET</b> — 14.00 PCM grade points and at least B in English.</li>
        <li><b>BUTEX</b> — GPA 4.00, A- in all four PCME subjects, 16.50 grade points.</li>
        <li>Each <b>BME</b> variant adds A in Biology to its parent category.</li>
      </ul>
    </section>

    <section class="card pcm-card">
      <h2><svg><use href="#i-shield"/></svg> About the data</h2>
      <p class="pcm-lede">Ranks are calculated from published board results — the same
        marksheet data behind every list on this site. Grades are derived from those
        marks using the board grading scale, because the result sheets carry the
        overall GPA rather than a per-subject grade.</p>
      <p class="pcm-lede">The all-board combined rank needs the marks of every board.
        Only the boards listed as loaded above are included; the rest show as
        unavailable until their data is added, so a combined rank is never guessed.</p>
    </section>
  </div>
</main>

{footer}

<script src="assets/theme.js"></script>
<script src="assets/pcm.js"></script>
</body>
</html>
"""
    out = os.path.join(ROOT, "pcm.html")
    open(out, "w", encoding="utf-8").write(page)
    print(f"  wrote pcm.html ({len(page):,} bytes)")


if __name__ == "__main__":
    main()
