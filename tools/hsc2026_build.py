#!/usr/bin/env python3
"""Step 4 of the HSC 2026 pipeline: turn the scraped results into site datasets.

Reads  hsc2026/institutes.jsonl   institution metadata (name, zilla, stats)
       hsc2026/students.jsonl     one record per candidate (marks, gpa, …)

Writes data/hsc_2026_{science,commerce,arts}.json in exactly the shape
tools/build_data.py emits (columnar roll/name/gpa/total/sid + base64 subject
blob), then rebuilds data/index.json across every dataset in data/.

Ranking: total desc -> GPA desc -> roll asc, ties share a rank.
Only PASSED candidates are listed (that is what the board publishes per
institution, and what every other dataset on the site contains).
"""
import base64
import html
import json
import os
import re
import struct
from collections import Counter, OrderedDict
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
SRC = os.path.join(ROOT, "hsc2026")
OUT = os.path.join(ROOT, "data")

# ── full marks ────────────────────────────────────────────────────────────
# Every HSC subject is out of 200 except ICT (275), which is out of 100.
# Confirmed from the scrape: the pass floor is 66 (=33% of 200) on all 200-mark
# subjects and ~41 on ICT, and several subjects top out at exactly 200.
FULL_DEFAULT = 200
FULL_OVERRIDE = {275: 100}
COMPULSORY = [101, 107, 275]          # Bangla, English, ICT — always first

# readable column labels (the raw page names are shouty and sometimes typo'd)
NAMES = {
    101: "Bangla", 107: "English", 275: "ICT",
    174: "Physics", 176: "Chemistry", 178: "Biology",
    265: "Higher Mathematics", 129: "Statistics",
    109: "Economics", 253: "Accounting",
    277: "Business Organization", 292: "Finance & Banking",
    286: "Production Management", 239: "Agriculture",
    121: "Logic", 304: "History", 117: "Sociology",
    267: "Islamic History", 269: "Civics & Good Governance",
    249: "Islamic Studies", 125: "Geography", 271: "Social Work",
}

GROUP_OF = {"science": "Science", "business studies": "Commerce",
            "humanities": "Arts"}
KEY_OF = {"Science": "science", "Commerce": "commerce", "Arts": "arts"}


def load_institutes():
    inst = {}
    p = os.path.join(SRC, "institutes.jsonl")
    if os.path.exists(p):
        for line in open(p, encoding="utf-8"):
            try:
                r = json.loads(line)
            except Exception:
                continue
            inst[r["eiin"]] = r
    return inst


def school_label(rec):
    """'NAME (104051)' + 'CHATTOGRAM (18)'  ->  'NAME, CHATTOGRAM'"""
    name = html.unescape(re.sub(r"\s*\(\d+\)\s*$", "", rec.get("name", ""))).strip()
    zilla = html.unescape(re.sub(r"\s*\(\d+\)\s*$", "", rec.get("zilla", ""))).strip()
    # always append the district, to match the "NAME, DISTRICT" style used by
    # every other dataset on the site
    if name and zilla:
        return "%s, %s" % (name, zilla)
    return name or zilla or "—"


def main():
    inst = load_institutes()
    rows = []
    for line in open(os.path.join(SRC, "students.jsonl"), encoding="utf-8"):
        try:
            rows.append(json.loads(line))
        except Exception:
            pass
    if not rows:
        raise SystemExit("no students scraped yet")

    # normalise group + institute label
    for r in rows:
        r["grp"] = GROUP_OF.get((r.get("group") or "").lower(), r.get("group"))
        rec = inst.get(str(r.get("eiin")))
        r["school"] = school_label(rec) if rec else html.unescape(
            (r.get("institute") or "—")).strip().title()

    catalog_new = []
    for gname in ("Science", "Commerce", "Arts"):
        grp = [r for r in rows if r["grp"] == gname]
        if len(grp) < 200:
            print("  skip %s — only %d rows" % (gname, len(grp)))
            continue

        # ---- subject columns: compulsory first, then most-taken first ----
        freq = Counter()
        names = {}
        for r in grp:
            for s in r["subjects"]:
                freq[s["code"]] += 1
                names[s["code"]] = html.unescape(s["name"]).strip()
        cols = [c for c in COMPULSORY if freq.get(c)]
        cols += [c for c, _ in freq.most_common() if c not in cols]
        width = len(cols)
        idx = {c: i for i, c in enumerate(cols)}

        # ---- rows ----
        out = []
        seen = set()
        for r in grp:
            if r["roll"] in seen:
                continue
            seen.add(r["roll"])
            marks = [0xFF] * width
            total = 0
            for s in r["subjects"]:
                if s["code"] not in idx:
                    continue
                m = int(s["marks"])
                marks[idx[s["code"]]] = min(254, m)
                total += m
            try:
                gpa = float(r.get("gpa"))
            except (TypeError, ValueError):
                gpa = None
            out.append({"roll": int(r["roll"]),
                        "name": html.unescape(r.get("name", "")).strip(),
                        "gpa": gpa, "total": total,
                        "school": r["school"], "marks": marks})

        # ---- rank: total desc -> gpa desc -> roll asc, ties share ----
        out.sort(key=lambda x: (-x["total"], -(x["gpa"] or 0), x["roll"]))
        prev, rank = None, 0
        for i, x in enumerate(out):
            key = (x["total"], x["gpa"])
            if key != prev:
                rank = i + 1
                prev = key
            x["rank"] = rank

        # ---- schools ----
        sids, schools = {}, []
        for x in out:
            s = x["school"] or "—"
            if s not in sids:
                sids[s] = len(schools)
                schools.append(s)
            x["sid"] = sids[s]

        blob = bytearray()
        for x in out:
            blob.extend(struct.pack("%dB" % width, *x["marks"]))

        gpa5 = sum(1 for x in out if x["gpa"] is not None and x["gpa"] >= 5.0)
        gpa_n = sum(1 for x in out if x["gpa"] is not None)
        subj_def = [{"name": NAMES.get(c) or names[c].title(),
                     "full": FULL_OVERRIDE.get(c, FULL_DEFAULT)} for c in cols]

        meta = {
            "id": "hsc_2026_%s" % KEY_OF[gname],
            "exam": "HSC", "year": 2026, "group": gname,
            "label": "HSC 2026", "count": len(out), "schools": len(schools),
            "gpa5": gpa5,
            "avgGpa": round(sum(x["gpa"] for x in out if x["gpa"] is not None) / gpa_n, 2)
                      if gpa_n else None,
            "avgTotal": round(sum(x["total"] for x in out) / len(out), 1),
            "maxTotal": max(x["total"] for x in out),
            "hasSubjects": True, "subjectsWithMarks": len(out),
            "dupesDropped": len(grp) - len(out),
            "sourceRows": len(grp),
            "coveragePct": round(100.0 * len(out) / len(grp), 1) if grp else 100.0,
            "partial": False,
            "subjects": subj_def,
            "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        }
        payload = {"meta": meta, "schools": schools,
                   "roll": [x["roll"] for x in out],
                   "name": [x["name"] for x in out],
                   "gpa": [int(round(x["gpa"] * 100)) if x["gpa"] is not None else -1
                           for x in out],
                   "total": [x["total"] for x in out],
                   "sid": [x["sid"] for x in out],
                   "subjects": base64.b64encode(bytes(blob)).decode("ascii"),
                   "subjWidth": width}
        path = os.path.join(OUT, "hsc_2026_%s.json" % KEY_OF[gname])
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
        meta["bytes"] = os.path.getsize(path)
        catalog_new.append(meta)
        print("  hsc_2026_%-9s %6d rows  %4d schools  %2d subjects  %6.1f KB"
              % (KEY_OF[gname], len(out), len(schools), width, meta["bytes"] / 1024))

    # ── rebuild index.json over everything currently in data/ ──
    catalog, all_schools = [], set()
    for fn in sorted(os.listdir(OUT)):
        if not fn.endswith(".json") or fn == "index.json":
            continue
        with open(os.path.join(OUT, fn), encoding="utf-8") as fh:
            d = json.load(fh)
        catalog.append(d["meta"])
        all_schools.update(d["schools"])
    catalog.sort(key=lambda m: (m["exam"], -m["year"],
                                ["Science", "Commerce", "Arts"].index(m["group"])))
    index = {"totalSchools": len(all_schools),
             "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
             "board": "Chattogram (Chittagong) Education Board",
             "totalStudents": sum(c["count"] for c in catalog),
             "datasets": catalog}
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as fh:
        json.dump(index, fh, ensure_ascii=False, separators=(",", ":"))
    print("\nindex.json: %d datasets, %s students, %d schools"
          % (len(catalog), f"{index['totalStudents']:,}", len(all_schools)))


if __name__ == "__main__":
    main()
