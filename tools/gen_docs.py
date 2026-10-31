#!/usr/bin/env python3
"""Regenerate README coverage table, robots.txt and sitemap.xml from data/index.json."""
import json
import os
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
SITE = "https://ctgrank.pages.dev"
START, END = "<!--COVERAGE:START-->", "<!--COVERAGE:END-->"

idx = json.load(open(os.path.join(ROOT, "data/index.json")))
dsets = idx["datasets"]

# ─────────────────────────────── coverage table ─────────────────────────
rows = ["| Exam | Year | Group | Students | Inst. | GPA-5 | Avg GPA | Subjects | Source |",
        "|---|---|---|---:|---:|---:|---:|:--:|---:|"]
for m in dsets:
    rows.append("| {exam} | {year} | {group} | {count:,} | {schools:,} | {gpa5:,} | {avg} | {sub} | {cov} |".format(
        exam=m["exam"], year=m["year"], group=m["group"], count=m["count"], schools=m["schools"],
        gpa5=m["gpa5"], avg=f'{m["avgGpa"]:.2f}' if m.get("avgGpa") else "—",
        sub="yes" if m["hasSubjects"] else "no",
        cov=f'{m["coveragePct"]}%{" ⚠" if m["partial"] else ""}'))
rows.append("| | | **Total** | **{:,}** | | | | | |".format(idx["totalStudents"]))
table = "\n".join(rows)

readme = os.path.join(ROOT, "README.md")
src = open(readme, encoding="utf-8").read() if os.path.exists(readme) else ""
if START in src and END in src:
    src = src.split(START)[0] + START + "\n" + table + "\n" + END + src.split(END)[1]
    open(readme, "w", encoding="utf-8").write(src)
    print("README coverage table updated")
else:
    print("COVERAGE MARKERS MISSING\n" + table)

# ───────────────────────────────── robots.txt ───────────────────────────
open(os.path.join(ROOT, "robots.txt"), "w").write(
    f"User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n")

# ───────────────────────────────── sitemap.xml ──────────────────────────
# The prerendered /<slug>/ pages are the canonical, crawler-readable versions;
# the SPA's ?exam=... URLs serve the same content and are not listed.
urls = [("", "1.0")]
for m in dsets:
    urls.append((f'{m["exam"].lower()}-{m["year"]}-{m["group"].lower()}/', "0.8"))
TODAY = datetime.now(timezone.utc).strftime("%Y-%m-%d")
# '&' in a query string is invalid XML and makes Google reject the whole file
def esc(u):
    return u.replace("&", "&amp;").replace("'", "&apos;").replace('"', "&quot;")
body = "\n".join(
    f"  <url><loc>{esc(SITE + '/' + q)}</loc><lastmod>{TODAY}</lastmod>"
    f"<changefreq>weekly</changefreq><priority>{p}</priority></url>"
    for q, p in urls)
open(os.path.join(ROOT, "sitemap.xml"), "w").write(
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{body}\n</urlset>\n')
print(f"sitemap.xml + robots.txt written ({len(urls)} urls)")
