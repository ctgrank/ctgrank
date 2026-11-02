#!/usr/bin/env python3
"""Generate reviews.html from index.html's shared shell.

The sprite, header and footer are lifted straight out of index.html so the
nav, theme toggle and icon set can't drift out of sync between the two
pages. Only the middle section is unique to this page.

    python3 tools/build_reviews.py

Giscus config comes from giscus.json (repo id, category id) — see
GISCUS.md for the one-time setup.
"""
import os
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
SITE = "https://ctgrank.pages.dev"


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

    # mark Reviews as the current page, drop in-page-only actions
    header = header.replace(
        '<a href="#picker" class="active">', '<a href="index.html">')
    header = header.replace(
        '<a href="#schoolsView" data-goto="schools">',
        '<a href="index.html#schoolsView" data-goto="schools">')
    header = header.replace(
        '<a href="#compareView" data-goto="compare">',
        '<a href="index.html#compareView" data-goto="compare">')
    header = header.replace('<a href="#about">', '<a href="index.html#about">')
    header = header.replace(
        '<a href="reviews.html">',
        '<a href="reviews.html" class="active" aria-current="page">')

    page = f"""<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Reviews — Shikhor, Chattogram Board Rank Lists</title>
<meta name="description" content="Reviews and feedback for Shikhor, the unofficial SSC &amp; HSC rank archive for the Chattogram Education Board. Tell us what works, what's missing, and what to fix next." />
<meta name="author" content="Jahin" />
<meta name="copyright" content="Copyright © 2026 Jahin" />
<meta name="robots" content="index, follow" />
<meta name="google-site-verification" content="nIIOK8Yis5j2SXAVNeFqBoS3zMTAc1giGRTj1-wq-ag" />
<link rel="canonical" href="{SITE}/reviews.html" />

<link rel="icon" href="assets/icon.svg" type="image/svg+xml" />
<meta name="theme-color" content="#2563eb" />

<meta property="og:type" content="website" />
<meta property="og:site_name" content="Shikhor" />
<meta property="og:title" content="Reviews — Shikhor" />
<meta property="og:description" content="Tell us what works, what's missing, and what Shikhor should fix next." />
<meta property="og:url" content="{SITE}/reviews.html" />
<meta property="og:image" content="{SITE}/assets/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />

<link rel="preload" href="assets/styles.css" as="style" />
<link rel="stylesheet" href="assets/styles.css" />
<script type="application/ld+json">
{{"@context":"https://schema.org","@type":"WebPage","name":"Reviews — Shikhor",
 "url":"{SITE}/reviews.html","description":"User reviews and feedback for Shikhor, the unofficial Chattogram Board SSC & HSC rank archive.",
 "isPartOf":{{"@type":"WebSite","name":"Shikhor","url":"{SITE}/"}}}}
</script>
</head>
<body>
{sprite}
{header}

<main>
  <section class="hero rev-hero">
    <p class="eyebrow"><svg class="ico"><use href="#i-star"/></svg> Reviews</p>
    <h1>What you think of <span>Shikhor</span></h1>
    <p class="lede">Shikhor is built and maintained by one person. If a rank
       looks wrong, a year is missing, or something helped you find your
       result — say so here. Replies are open, so questions get answered.</p>
  </section>

  <section class="card prose rev-intro">
    <h2><svg><use href="#i-info"/></svg> Before you post</h2>
    <ul class="rev-rules">
      <li><b>Correcting a result?</b> Include the exam, year, roll number and
          what looks wrong. Vague reports can't be checked.</li>
      <li><b>Shikhor is unofficial.</b> It republishes board data — it can't
          change your marks. For that, contact the Chattogram board directly.</li>
      <li><b>No personal data in public posts.</b> Don't paste phone numbers,
          addresses or full marksheets.</li>
    </ul>
    <p class="rev-signin">No sign-up and no email needed — just write and
       post. <b>Anonymous is on by default</b>; untick it if you'd like your
       name shown.</p>
  </section>

  <section class="card rev-box">
    <h2 id="write"><svg><use href="#i-star"/></svg> Leave a review</h2>
    <div id="revForm"></div>
    <p class="rev-status" id="revStatus" aria-live="polite"></p>
  </section>

  <section class="card rev-box rev-list-card">
    <div class="rev-list-h">
      <h2><svg><use href="#i-users"/></svg> What people are saying</h2>
      <div id="revAdmin"></div>
    </div>
    <div id="revList" class="rev-list">
      <p class="rev-empty">Loading reviews…</p>
    </div>
    <noscript>
      <p class="hint">Posting a review needs JavaScript enabled.</p>
    </noscript>
  </section>
</main>

{footer}
<script src="assets/reviews.js"></script>
</body>
</html>
"""
    out = os.path.join(ROOT, "reviews.html")
    open(out, "w", encoding="utf-8").write(page)
    print("wrote %s (%d bytes)" % (out, len(page)))

    # keep the sitemap aware of it
    sm = os.path.join(ROOT, "sitemap.xml")
    if os.path.exists(sm):
        s = open(sm, encoding="utf-8").read()
        url = f"{SITE}/reviews.html"
        if url not in s:
            entry = (f"<url><loc>{url}</loc><lastmod>{date.today().isoformat()}"
                     "</lastmod><changefreq>weekly</changefreq>"
                     "<priority>0.6</priority></url>")
            s = s.replace("</urlset>", entry + "</urlset>")
            open(sm, "w", encoding="utf-8").write(s)
            print("  + sitemap.xml now lists reviews.html")


if __name__ == "__main__":
    main()
