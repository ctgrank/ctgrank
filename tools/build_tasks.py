#!/usr/bin/env python3
"""Generate tasks.html from index.html's shared shell.

The sprite, header and footer are lifted straight out of index.html so the
nav, theme toggle and icon set can't drift out of sync between pages. Only
the middle section is unique to this page.

    python3 tools/build_tasks.py
"""
import os
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
SITE = "https://ctgrank.pages.dev"
# Cloudflare Pages serves this page extensionless and 308-redirects .html
PAGE_URL = SITE + "/tasks"


def slice_block(doc, start, end):
    """Return the text from `start` up to and including the first `end`."""
    i = doc.index(start)
    j = doc.index(end, i) + len(end)
    return doc[i:j]


def main():
    idx = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()

    sprite = slice_block(idx, '<svg width="0" height="0"', "</svg>")
    header = slice_block(idx, '<header class="nav"', "</header>")
    footer = slice_block(idx, '<footer class="foot">', "</footer>")

    # mark Tasks as the current page, repoint in-page-only links home
    header = header.replace('<a href="#picker" class="active">', '<a href="index.html">')
    header = header.replace('<a href="#schoolsView" data-goto="schools">',
                            '<a href="index.html#schoolsView" data-goto="schools">')
    header = header.replace('<a href="#compareView" data-goto="compare">',
                            '<a href="index.html#compareView" data-goto="compare">')
    header = header.replace('<a href="#about">', '<a href="index.html#about">')
    header = header.replace('<a href="reviews.html">', '<a href="reviews.html">')
    header = header.replace(
        '<a href="tasks.html">',
        '<a href="tasks.html" class="active" aria-current="page">')

    footer = footer.replace('<a href="#picker">', '<a href="index.html#picker">')
    footer = footer.replace('<a href="#about">', '<a href="index.html#about">')

    page = f"""<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Tasks &amp; Habits — Shikhor</title>
<meta name="description" content="A free daily planner for students: add today's tasks, line up tomorrow's, and track habits with a day counter and streak. No sign-up, nothing leaves your browser." />
<meta name="author" content="Jahin" />
<meta name="copyright" content="Copyright © 2026 Jahin" />
<meta name="robots" content="index, follow" />
<meta name="google-site-verification" content="nIIOK8Yis5j2SXAVNeFqBoS3zMTAc1giGRTj1-wq-ag" />
<link rel="canonical" href="{PAGE_URL}" />

<link rel="icon" href="assets/icon.svg" type="image/svg+xml" />
<meta name="theme-color" content="#533afd" />

<meta property="og:type" content="website" />
<meta property="og:site_name" content="Shikhor" />
<meta property="og:title" content="Tasks &amp; Habits — Shikhor" />
<meta property="og:description" content="Plan today, line up tomorrow, and keep a habit going. Free, private, and no sign-up." />
<meta property="og:url" content="{PAGE_URL}" />
<meta property="og:image" content="{SITE}/assets/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />

<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" />
<link rel="preload" href="assets/styles.css" as="style" />
<link rel="stylesheet" href="assets/styles.css" />
<script type="application/ld+json">
{{"@context":"https://schema.org","@type":"WebPage","name":"Tasks & Habits — Shikhor",
 "url":"{PAGE_URL}","description":"A free daily task and habit tracker for students that keeps everything in the browser.",
 "isPartOf":{{"@type":"WebSite","name":"Shikhor","url":"{SITE}/"}}}}
</script>
</head>
<body>
{sprite}
{header}

<main>
  <section class="hero tk-hero">
    <p class="eyebrow"><svg class="ico"><use href="#i-check"/></svg> Tasks &amp; Habits</p>
    <h1>Plan today. <span>Keep it going.</span></h1>
    <p class="lede">A plain daily planner for students. Add what today needs,
       line up tomorrow while you think of it, and tick off one habit a day
       to watch the run build.</p>
  </section>

  <div class="wrap">
    <p class="tk-note">
      <svg><use href="#i-shield"/></svg>
      <span><b>This stays on your device.</b> Tasks and habits are saved in
      this browser only — there is no account and nothing is uploaded, so
      they won't follow you to another phone or survive a cleared browsing
      history.</span>
    </p>

    <!-- ══════════════════ tasks ══════════════════ -->
    <section class="card">
      <div class="tk-head">
        <h2><svg><use href="#i-check"/></svg> To-do</h2>
        <span class="tk-count" id="tkCount">nothing here yet</span>
        <div class="seg seg-sm" role="tablist" aria-label="Which day">
          <button class="seg-btn is-on" id="tkTabToday" role="tab" aria-selected="true">
            <svg><use href="#i-sun"/></svg> Today</button>
          <button class="seg-btn" id="tkTabTomorrow" role="tab" aria-selected="false">
            <svg><use href="#i-up"/></svg> Tomorrow</button>
        </div>
      </div>

      <p class="hint" id="tkWhen" style="margin-bottom:12px"></p>

      <div class="tk-prog" id="tkProg" role="progressbar" aria-label="Tasks completed"
           aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <i id="tkProgFill"></i>
      </div>

      <div class="tk-add">
        <input class="tk-input" id="tkInput" type="text" maxlength="200"
               autocomplete="off" aria-label="New task"
               placeholder="What do you need to do today?" />
        <button class="btn btn-primary" id="tkAddBtn" type="button">
          <svg><use href="#i-plus"/></svg> Add to today</button>
      </div>

      <ul class="tk-list" id="tkList"></ul>
      <p class="tk-status" id="tkStatus" role="status" aria-live="polite"></p>
      <p class="hint">Anything left unticked rolls over to the next day, so
         you don't lose it. Finished tasks clear once the day ends.</p>
    </section>

    <!-- ══════════════════ habits ══════════════════ -->
    <section class="card">
      <div class="tk-head">
        <h2><svg><use href="#i-flame"/></svg> Habits</h2>
        <span class="tk-count">one tick a day</span>
      </div>

      <div class="tk-add">
        <input class="tk-input" id="tkHabitInput" type="text" maxlength="60"
               autocomplete="off" aria-label="New habit"
               placeholder="Start a habit — e.g. revise physics for 30 minutes" />
        <button class="btn btn-primary" id="tkHabitBtn" type="button">
          <svg><use href="#i-plus"/></svg> Start habit</button>
      </div>

      <div id="tkHabits"></div>
      <p class="hint">Each habit counts the days since you began and the
         current run of days you've kept it. Tap <b>Tick today</b> once a day.</p>
    </section>

    <div class="tk-foot">
      <button class="tk-reset" id="tkReset" type="button">Clear everything</button>
      <span class="hint" style="margin:0">Saved in this browser · nothing is uploaded</span>
    </div>
  </div>
</main>

{footer}
<script src="assets/theme.js"></script>
<script src="assets/tasks.js"></script>
</body>
</html>
"""
    out = os.path.join(ROOT, "tasks.html")
    open(out, "w", encoding="utf-8").write(page)
    print("wrote %s (%d bytes)" % (out, len(page)))

    sm = os.path.join(ROOT, "sitemap.xml")
    if os.path.exists(sm):
        s = open(sm, encoding="utf-8").read()
        if PAGE_URL not in s:
            entry = (f"<url><loc>{PAGE_URL}</loc><lastmod>{date.today().isoformat()}"
                     "</lastmod><changefreq>weekly</changefreq>"
                     "<priority>0.6</priority></url>")
            s = s.replace("</urlset>", entry + "</urlset>")
            open(sm, "w", encoding="utf-8").write(s)
            print("  + sitemap.xml now lists tasks.html")


if __name__ == "__main__":
    main()
