# ⛰️ Shikhor

> **© 2026 Jahin — all rights reserved.** Built and copyrighted by Jahin.

**Unofficial SSC & HSC board-rank explorer for the Chattogram (Chittagong) Education Board.**

*Shikhor* is Bengali for **summit** — the top of the merit list.

A dependency-free static web app: pick an **exam → year → group**, then search ~530,000 ranked
results by name, roll number or institution, open any student for their **subject-wise marks**,
compare two students, browse the **top institutions**, and export anything to CSV.

```
index.html          the whole app (single page)
assets/styles.css   light + dark theme
assets/app.js       data loading, search, virtual table, exports   (~30 KB, no libraries)
data/index.json     catalogue of every dataset
data/*.json         one packed dataset per exam+year+group (17 files, ~22 MB)
tools/              data pipeline (fetch → decode → clean → rank → pack)
serve.py            tiny gzip static server for local preview
```

---

## ⚠️ Disclaimer

This is **not an official rank** and the site is **not affiliated** with the Chattogram Education
Board, the Ministry of Education, or any government body. Every record is a re-presentation of
publicly available board result data, rebuilt for study and comparison. Some source years are
incomplete (tagged **Partial** with an exact coverage %), and there may be transcription errors.
**Always verify against your official marksheet.**

---

## 🚀 Run it locally

```bash
cd shikhor
python3 serve.py 8000          # then open http://localhost:8000
```

Any static server works — `python3 -m http.server`, `npx serve`, nginx, …
**Do not open `index.html` by double-clicking it**: browsers block `fetch()` on `file://` URLs, so
the datasets will not load.

## 📦 Deploy

Shikhor runs on two hosts at once, from the same static files.

| Host | Address | Command |
|---|---|---|
| Surge | <https://shikhor.surge.sh> | `./deploy.sh` |
| GitHub Pages | <https://ctgrank.github.io> | `git push` |

**GitHub Pages** needs no build step — `.nojekyll` is included and every asset
path is relative, so it serves from a domain root or a `/repo` sub-path.
Full step-by-step (account, token, Pages settings, troubleshooting) is in
**[GITHUB_PAGES.md](GITHUB_PAGES.md)**.

To make GitHub the primary address in `sitemap.xml` / `robots.txt`, change
`SITE` in `tools/gen_docs.py` and re-run it:

```bash
sed -i 's|https://shikhor.surge.sh|https://ctgrank.github.io|' tools/gen_docs.py
python3 tools/gen_docs.py
```

`deploy.sh` deletes the `CNAME` file Surge drops in the project root — a stray
`CNAME` would break GitHub Pages, so don't commit one.

---

## 📊 Coverage

<!--COVERAGE:START-->
| Exam | Year | Group | Students | Inst. | GPA-5 | Avg GPA | Subjects | Source |
|---|---|---|---:|---:|---:|---:|:--:|---:|
| HSC | 2026 | Science | 17,273 | 205 | 2,107 | 3.83 | yes | 99.6% |
| HSC | 2026 | Commerce | 16,554 | 245 | 637 | 3.28 | yes | 99.9% |
| HSC | 2026 | Arts | 16,265 | 246 | 185 | 3.04 | yes | 99.8% |
| HSC | 2025 | Science | 17,188 | 196 | 4,044 | 4.15 | yes | 100.0% |
| HSC | 2025 | Commerce | 16,677 | 246 | 1,506 | 3.61 | yes | 100.0% |
| HSC | 2025 | Arts | 14,896 | 241 | 533 | 3.39 | yes | 100.0% |
| HSC | 2024 | Science | 20,200 | 199 | 7,819 | 4.59 | yes | 100.0% |
| HSC | 2024 | Commerce | 24,127 | 247 | 1,869 | 3.90 | no | 100.0% |
| HSC | 2024 | Arts | 21,286 | 243 | 637 | 3.61 | no | 100.0% |
| HSC | 2023 | Science | 19,824 | 218 | 4,278 | 4.11 | yes | 97.5% |
| SSC | 2026 | Science | 28,232 | 1,049 | 8,301 | 4.34 | yes | 72.4% ⚠ |
| SSC | 2025 | Science | 33,935 | 1,051 | 10,508 | 4.48 | yes | 97.0% ⚠ |
| SSC | 2025 | Arts | 39,452 | 1,052 | 138 | 3.28 | yes | 55.6% ⚠ |
| SSC | 2024 | Science | 32,148 | 1,008 | 9,665 | 4.42 | yes | 93.5% ⚠ |
| SSC | 2024 | Commerce | 41,704 | 1,018 | 1,027 | 3.53 | no | 100.0% |
| SSC | 2024 | Arts | 28,975 | 1,019 | 136 | 3.23 | yes | 72.4% ⚠ |
| SSC | 2023 | Science | 31,297 | 991 | 9,990 | 4.41 | yes | 100.0% |
| SSC | 2023 | Commerce | 47,175 | 1,048 | 1,416 | 3.56 | no | 100.0% |
| SSC | 2023 | Arts | 32,945 | 994 | 162 | 3.09 | no | 100.0% |
| | | **Total** | **500,153** | | | | | |
<!--COVERAGE:END-->

`Source` = share of the published rows that were present and usable in the upstream data.
Anything below 97 % is surfaced in the UI as a **Partial source** badge.

## 🧮 Ranking method

Students are ordered by **total marks (descending)**. Ties are broken by **GPA (descending)**, then
by **roll number (ascending)**. Students with the same total marks *and* the same GPA share one rank
(so you may see `7, 7, 9`).

The upstream files were **not** consistently merit-ordered (several were ordered by roll number), so
the rank is recomputed here for every dataset — that keeps the definition identical across years.

---

## 🔁 Rebuilding / refreshing the data

```bash
python3 tools/fetch_data.py     # download + Base64/XOR-decode the public result dumps into raw/
python3 tools/build_data.py     # clean, rank, dedupe, pack → data/*.json
python3 tools/gen_docs.py       # refresh README table, robots.txt, sitemap.xml
```

### HSC 2026 — collected straight from the board portal

HSC 2026 was not in the upstream dump, so it is gathered from the Chattogram board's own
result portal in three passes:

```bash
python3 tools/fetch_eiin.py              # 1. every institution EIIN           → eiin/
python3 tools/hsc2026_fetch_rolls.py     # 2. per college: every roll + GPA    → hsc2026/
python3 tools/hsc2026_fetch_students.py  # 3. per roll: subject-wise marks     → hsc2026/
python3 tools/hsc2026_build.py           #    rank + pack → data/hsc_2026_*.json
```

* **277 colleges** entered candidates; **50,092** passed candidates are ranked —
  17,273 Science · 16,554 Commerce · 16,265 Arts.
* Only **passed** candidates are listed: that is what the board publishes per institution,
  and it is what every other dataset here contains.
* Full marks are **200** a subject, except **ICT at 100**.
* Sanity check — the GPA-5 counts add to **2,107 + 637 + 185 = 2,929**, exactly the board's
  published GPA-5 figure for the year.
* The intermediate `hsc2026/` cache is regenerable, so it is deliberately not committed.

`tools/build_data.py` is the place to change cleaning rules, the ranking comparator, or the
subject label/full-marks layout (`ssc_subjects()` / `HSC_SUBJECTS`).

### Subject layout

| Exam | Columns (roll, then…) |
|---|---|
| SSC | Bangla 200 · English 200 · Mathematics 100 · *group subject* 100 · Religion 100 · *group subject* 100 · *group subject* 100 · Compulsory 100 · ICT 50 · Optional 100 · Physical Education 100 · Career Education **50** |
| HSC | Bangla 200 · English 200 · ICT 100 · Physics 200 · Chemistry 200 · Compulsory 200 · Optional 200 |

Group subjects — **Science**: BGS / Physics / Chemistry · **Commerce**: Science / Accounting /
Finance · **Arts**: Science / Geography / Civics.

### Known source quirks (corrected in `tools/build_data.py`)

| Quirk | Evidence | Fix |
|---|---|---|
| **Career Education** is a 50-mark subject, not 100 | Its value never exceeds 50 in any SSC year | Full mark set to 50 for all SSC datasets |
| **SSC 2026 Physical Education is stored halved** | 2026 PE median 50 / mean 49.8 vs 98–100 in every other year; 2026 totals sat ~58 below 2024/25 until restored | `PE = min(100, PE × 2)` and the difference added back to the total, so the breakdown always sums to the total |

The 2026 correction reorders that year (median 38 places, 99th pct 1,675) because the published
totals were short by a varying amount — that is the point of the fix, not a side effect.

### Packed file format

`data/<exam>_<year>_<group>.json` holds parallel arrays (already sorted by rank) plus a school-name
table, so the browser only ever holds one dataset in memory:

```jsonc
{
  "meta":    { "count": 32148, "subjects": [{ "name": "Bangla", "full": 200 }, …], … },
  "schools": ["DR. KHASTAGIR GOVT. GIRLS' HIGH SCHOOL, CHATTOGRAM", …],
  "roll": [112257, …], "name": ["MD. SAADMAN ISLAM", …],
  "gpa":  [500, …],    // GPA × 100 as an int, -1 = not published
  "total":[1221, …],   // -1 = not published
  "sid":  [0, …],      // index into `schools`
  "subjects": "base64…", "subjWidth": 12   // 1 byte per mark, 0xFF = row has no marks
}
```

---

## 🧪 Verifying a build

```bash
pip install playwright && playwright install chromium
python3 serve.py 8000 &
python3 tools/verify.py     # end-to-end click-through + screenshots
python3 tools/audit.py      # overflow / geometry checks at 3 breakpoints
```

---

## 🙏 Credits

Result data is aggregated from publicly published Chattogram Education Board result lists.
This project is an independent, non-commercial study tool. If you are (or represent) a student in
these lists and would like a record removed, please open an issue.

## © Copyright

Copyright © 2026 **Jahin**. All rights reserved.
The site name *Shikhor* and this codebase belong to Jahin. The underlying examination
results are public data of the Chattogram Education Board and are not covered by this copyright.

Made for the students of Chattogram. 🏆
