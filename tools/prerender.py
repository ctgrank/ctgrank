#!/usr/bin/env python3
"""Prerender one static, crawler-readable HTML page per dataset.

The app is a single-page app: every result lives in JSON fetched at runtime,
so a crawler has to execute JavaScript to see a single student. These pages
fix that — each one is plain HTML containing the top students and top
colleges, with its own title, meta, canonical and structured data.

Output:  <slug>/index.html  e.g.  hsc-2026-science/index.html

    python3 tools/prerender.py
"""
import base64
import html
import json
import os
import re
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
DATA = os.path.join(ROOT, "data")
SITE = "https://ctgrank.pages.dev"

TOP_STUDENTS = 100
TOP_COLLEGES = 50

esc = lambda s: html.escape(str(s), quote=True)


def slug(meta):
    return "%s-%d-%s" % (meta["exam"].lower(), meta["year"], meta["group"].lower())


def label(meta):
    return "%s %d %s" % (meta["exam"], meta["year"], meta["group"])


def page(meta, index_meta, all_metas):
    d = json.load(open(os.path.join(DATA, meta["id"] + ".json")))
    n = meta["count"]
    inst = "colleges" if meta["exam"] == "HSC" else "schools"
    slug_ = slug(meta)
    url = "%s/%s/" % (SITE, slug_)
    title = "%s Rank List — Chattogram Board | Shikhor" % label(meta)
    desc = ("%s merit list for the Chattogram Education Board: %s students from "
            "%d %s, ranked by total marks. Board rank, GPA and subject-wise "
            "marks for the top %d."
            % (label(meta), f"{n:,}", meta["schools"], inst, TOP_STUDENTS))

    w = d.get("subjWidth", 0)
    blob = base64.b64decode(d["subjects"]) if d.get("subjects") else b""

    # ── top students ──
    rows = []
    for i in range(min(TOP_STUDENTS, len(d["roll"]))):
        gpa = d["gpa"][i] / 100 if d["gpa"][i] >= 0 else None
        rows.append(
            '<tr><td class="rk">%s</td><td class="roll">%s</td><td>%s</td>'
            '<td class="sch">%s</td><td class="num">%s</td><td class="num tot">%s</td></tr>'
            % (i + 1, d["roll"][i], esc(d["name"][i]),
               esc(d["schools"][d["sid"][i]]),
               "%.2f" % gpa if gpa is not None else "—",
               f'{d["total"][i]:,}' if d["total"][i] >= 0 else "—"))

    # ── college / school aggregation ──
    agg = {}
    for i in range(len(d["roll"])):
        a = agg.setdefault(d["sid"][i], {"n": 0, "g5": 0, "gs": 0.0, "best": None})
        a["n"] += 1
        g = d["gpa"][i]
        if g >= 500:
            a["g5"] += 1
        if g >= 0:
            a["gs"] += g / 100
        if a["best"] is None:
            a["best"] = i + 1
    cols = sorted(agg.items(), key=lambda kv: (-kv[1]["g5"], kv[1]["best"]))[:TOP_COLLEGES]
    crows = []
    for pos, (sid, a) in enumerate(cols, 1):
        crows.append(
            '<tr><td class="rk">%d</td><td>%s</td><td class="num">%s</td>'
            '<td class="num">%d</td><td class="num">%.2f</td><td class="num">#%s</td></tr>'
            % (pos, esc(d["schools"][sid]), f'{a["n"]:,}', a["g5"],
               a["gs"] / a["n"], f'{a["best"]:,}'))

    # ── structured data ──
    items = [{
        "@type": "ListItem", "position": i + 1,
        "name": d["name"][i],
        "description": "Roll %s — %s, %s marks, GPA %s. Board rank %d of %s in %s."
                       % (d["roll"][i], d["schools"][d["sid"][i]], d["total"][i],
                          "%.2f" % (d["gpa"][i] / 100) if d["gpa"][i] >= 0 else "n/a",
                          i + 1, f"{n:,}", label(meta)),
    } for i in range(min(TOP_STUDENTS, len(d["roll"])))]
    ld = {
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "WebPage", "@id": url + "#webpage", "url": url, "name": title,
             "description": desc, "isPartOf": {"@id": SITE + "/#website"},
             "breadcrumb": {"@id": url + "#breadcrumb"}},
            {"@type": "BreadcrumbList", "@id": url + "#breadcrumb", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Shikhor", "item": SITE + "/"},
                {"@type": "ListItem", "position": 2, "name": meta["exam"],
                 "item": SITE + "/"},
                {"@type": "ListItem", "position": 3, "name": label(meta), "item": url}]},
            {"@type": "Dataset", "name": "%s merit list" % label(meta),
             "description": desc, "url": url,
             "creator": {"@id": SITE + "/#org"},
             "temporalCoverage": str(meta["year"]),
             "spatialCoverage": {"@type": "Place", "name": "Chattogram, Bangladesh"},
             "distribution": {"@type": "DataDownload", "encodingFormat": "application/json",
                              "contentUrl": "%s/data/%s.json" % (SITE, meta["id"])}},
            {"@type": "ItemList", "name": "Top %d — %s" % (TOP_STUDENTS, label(meta)),
             "numberOfItems": len(items), "itemListElement": items},
        ],
    }

    # ── links to every other dataset ──
    others = "".join(
        '<li><a href="%s/%s/">%s</a> <span>%s</span></li>'
        % (SITE, slug(m), label(m), f'{m["count"]:,}')
        for m in all_metas if m["id"] != meta["id"])

    app = "../?exam=%s&year=%d&group=%s" % (meta["exam"], meta["year"], meta["group"])

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}" />
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
<link rel="canonical" href="{url}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Shikhor" />
<meta property="og:title" content="{esc(title)}" />
<meta property="og:description" content="{esc(desc)}" />
<meta property="og:url" content="{url}" />
<meta property="og:image" content="{SITE}/assets/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{esc(title)}" />
<meta name="twitter:description" content="{esc(desc)}" />
<meta name="twitter:image" content="{SITE}/assets/og-image.png" />
<link rel="icon" href="../assets/icon.svg" type="image/svg+xml" />
<link rel="stylesheet" href="../assets/styles.css" />
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False, separators=(",", ":"))}</script>
<style>
  body{{max-width:1000px;margin:0 auto;padding:24px 18px 60px;line-height:1.55;
        font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}}
  h1{{font-size:1.7rem;margin:.2em 0 .1em}} h2{{font-size:1.15rem;margin:2em 0 .6em}}
  .crumb{{font-size:.85rem;color:#64748b;margin-bottom:14px}}
  .crumb a{{color:#2563eb;text-decoration:none}}
  .facts{{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0 8px}}
  .fact{{background:#f1f5f9;border-radius:10px;padding:8px 14px;font-size:.85rem}}
  .fact b{{display:block;font-size:1.15rem}}
  table{{width:100%;border-collapse:collapse;font-size:.82rem}}
  th,td{{text-align:left;padding:6px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top}}
  th{{background:#f8fafc;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;color:#475569}}
  td.num{{text-align:right;white-space:nowrap}} td.rk{{width:38px;color:#64748b}}
  td.roll{{font-variant-numeric:tabular-nums;color:#475569}} td.sch{{color:#475569}}
  td.tot{{font-weight:700}}
  .scroll{{max-height:520px;overflow:auto;border:1px solid #e2e8f0;border-radius:10px}}
  .cta{{display:inline-block;margin:18px 14px 4px 0;background:#2563eb;color:#fff;
        padding:11px 18px;border-radius:10px;text-decoration:none;font-weight:700;font-size:.9rem}}
  .cta.alt{{background:#f1f5f9;color:#1d4ed8}}
  .grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:6px;
         list-style:none;padding:0;font-size:.85rem}}
  .grid a{{color:#2563eb;text-decoration:none}} .grid span{{color:#94a3b8;font-size:.78rem}}
  .note{{font-size:.8rem;color:#64748b;margin-top:26px;border-top:1px solid #e2e8f0;padding-top:12px}}
</style>
</head>
<body>
<p class="crumb"><a href="../">Shikhor</a> › {esc(meta["exam"])} › {esc(label(meta))}</p>

<h1>{esc(label(meta))} Rank List — Chattogram Board</h1>
<p>The unofficial {esc(label(meta))} merit list for the <b>Chattogram (Chittagong)
Education Board</b>. All {n:,} candidates are ordered by <b>total marks</b>; ties are broken by
GPA and then by roll number, so students on identical marks share a rank.</p>

<div class="facts">
  <div class="fact"><b>{n:,}</b>students ranked</div>
  <div class="fact"><b>{meta["schools"]:,}</b>{inst}</div>
  <div class="fact"><b>{meta["gpa5"]:,}</b>GPA-5</div>
  <div class="fact"><b>{meta["avgGpa"]}</b>average GPA</div>
  <div class="fact"><b>{meta["maxTotal"]:,}</b>highest total</div>
</div>

<a class="cta" href="{app}">Search all {n:,} students →</a>
<a class="cta alt" href="../?exam={meta["exam"]}&year={meta["year"]}&group={meta["group"]}&view=schools">Top {inst}</a>

<h2>Top {TOP_STUDENTS} students — {esc(label(meta))}</h2>
<div class="scroll"><table>
<thead><tr><th>Rank</th><th>Roll</th><th>Name</th><th>{inst.title()}</th>
<th>GPA</th><th>Total</th></tr></thead>
<tbody>
{chr(10).join(rows)}
</tbody></table></div>

<h2>Top {TOP_COLLEGES} {inst} — {esc(label(meta))}</h2>
<div class="scroll"><table>
<thead><tr><th>#</th><th>{inst.title()}</th><th>Students</th><th>GPA-5</th>
<th>Avg GPA</th><th>Best rank</th></tr></thead>
<tbody>
{chr(10).join(crows)}
</tbody></table></div>

<h2>Other exams</h2>
<ul class="grid">
{others}
</ul>

<p class="note">Shikhor is an unofficial study tool and is not affiliated with the Chattogram
Education Board. Always confirm against your official marksheet. © 2026 Jahin.</p>
</body>
</html>
"""


def inject_index_links(metas):
    """Fill the homepage's browse directory with real <a> links, so crawlers
    can actually reach every prerendered page."""
    path = os.path.join(ROOT, "index.html")
    doc = open(path, encoding="utf-8").read()
    start, end = "<!--DATASET-LINKS:START-->", "<!--DATASET-LINKS:END-->"
    if start not in doc:
        return False
    exams = {}
    for m in metas:
        exams.setdefault(m["exam"], []).append(m)
    parts = []
    for exam in ("HSC", "SSC"):
        if exam not in exams:
            continue
        items = "".join(
            # relative, so the same HTML works on Surge, GitHub Pages and a sub-path
            '<li><a href="%s/">%s %d %s</a> <span>%s students · %d %s</span></li>'
            % (slug(m), m["exam"], m["year"], m["group"], f'{m["count"]:,}',
               m["schools"], "colleges" if exam == "HSC" else "schools")
            for m in sorted(exams[exam], key=lambda x: (-x["year"], x["group"])))
        parts.append('<h3>%s</h3><ul class="dirlist">%s</ul>' % (exam, items))
    block = start + "\n" + "\n".join(parts) + "\n    " + end
    doc = re.sub(re.escape(start) + r".*?" + re.escape(end), lambda m: block, doc,
                 count=1, flags=re.S)
    open(path, "w", encoding="utf-8").write(doc)
    return True


def main():
    idx = json.load(open(os.path.join(DATA, "index.json")))
    metas = idx["datasets"]
    total = 0
    print("Prerendering %d dataset pages:" % len(metas))
    for m in metas:
        d = os.path.join(ROOT, slug(m))
        os.makedirs(d, exist_ok=True)
        p = os.path.join(d, "index.html")
        open(p, "w", encoding="utf-8").write(page(m, idx, metas))
        size = os.path.getsize(p)
        total += size
        print("  /%-24s %6.1f KB" % (slug(m) + "/", size / 1024))
    if inject_index_links(metas):
        print("  homepage directory updated with %d crawlable links" % len(metas))
    print("\n%d pages, %.1f MB total" % (len(metas), total / 1048576))


if __name__ == "__main__":
    main()
