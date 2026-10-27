#!/usr/bin/env python3
"""Collect every Chittagong-board institution EIIN from the official result portal.

Endpoint (reverse-engineered from /app/stud/btbl.html, which builds this URL for
its DataTables AJAX source):

    /v2/list?id=btree&board=<board>&exam=<exam>&year=<year>
            &type=tbl&cols=eiin,i_code,i_name,zilla,thana

Returns {"data": [[eiin, code, name, zilla, thana], ...]}

An institution only appears in a given exam/year if it actually entered candidates
that year, so we sweep several years and union the results.
"""
import csv
import json
import os
import time
import urllib.request
from collections import defaultdict

BASE = "https://www.educationboardresults.gov.bd"
COLS = "eiin,i_code,i_name,zilla,thana"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "eiin")
RAW = os.path.join(OUT, "raw")
os.makedirs(RAW, exist_ok=True)

BOARD = "chittagong"
EXAMS = ["hsc", "ssc"]
YEARS = [2026, 2025, 2024, 2023, 2022]


def fetch(exam, year):
    url = (f"{BASE}/v2/list?id=btree&board={BOARD}&exam={exam}&year={year}"
           f"&type=tbl&cols={COLS}")
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": f"{BASE}/app/stud/btbl.html",
    })
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read()
    path = os.path.join(RAW, f"{BOARD}_{exam}_{year}.json")
    with open(path, "wb") as fh:
        fh.write(raw)
    try:
        rows = json.loads(raw.decode("utf-8", "replace")).get("data", [])
    except Exception:
        rows = []
    return rows, path


def main():
    inst = {}                      # eiin -> record
    seen = defaultdict(list)       # eiin -> ["hsc:2025", ...]
    per_query = []

    for exam in EXAMS:
        for year in YEARS:
            rows, path = fetch(exam, year)
            per_query.append((exam, year, len(rows)))
            print(f"  {exam.upper()} {year}: {len(rows):>5} institutions   ({os.path.basename(path)})")
            for r in rows:
                if len(r) < 5:
                    continue
                eiin = (r[0] or "").strip()
                if not eiin.isdigit():
                    continue                       # skip header/junk rows
                rec = inst.setdefault(eiin, {
                    "eiin": eiin,
                    "code": (r[1] or "").strip(),
                    "name": " ".join((r[2] or "").split()),
                    "zilla": " ".join((r[3] or "").split()),
                    "upazila": " ".join((r[4] or "").split()),
                })
                # keep the richest record (some years leave `code` blank)
                if not rec["code"] and (r[1] or "").strip():
                    rec["code"] = r[1].strip()
                tag = f"{exam}:{year}"
                if tag not in seen[eiin]:
                    seen[eiin].append(tag)
            time.sleep(0.4)

    for eiin, rec in inst.items():
        tags = sorted(seen[eiin])
        rec["exams"] = sorted({t.split(":")[0] for t in tags})
        rec["years"] = sorted({int(t.split(":")[1]) for t in tags})
        rec["seen_in"] = tags

    rows = sorted(inst.values(), key=lambda r: (r["zilla"], r["upazila"], r["name"]))

    # ── CSV ──
    csv_path = os.path.join(OUT, f"{BOARD}_institutions.csv")
    with open(csv_path, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["eiin", "code", "name", "zilla", "upazila", "exams", "years", "seen_in"])
        for r in rows:
            w.writerow([r["eiin"], r["code"], r["name"], r["zilla"], r["upazila"],
                        "|".join(r["exams"]), "|".join(map(str, r["years"])),
                        "|".join(r["seen_in"])])

    # ── JSON ──
    hsc = [r for r in rows if "hsc" in r["exams"]]
    ssc = [r for r in rows if "ssc" in r["exams"]]
    both = [r for r in rows if set(r["exams"]) >= {"hsc", "ssc"}]
    payload = {
        "board": BOARD,
        "board_label": "Chattogram (Chittagong) Education Board",
        "source": f"{BASE}/v2/list?id=btree",
        "fetched": time.strftime("%Y-%m-%d %H:%M:%S"),
        "queries": [{"exam": e, "year": y, "rows": n} for e, y, n in per_query],
        "total": len(rows),
        "counts": {"hsc": len(hsc), "ssc": len(ssc), "both": len(both)},
        "by_zilla": {z: sum(1 for r in rows if r["zilla"] == z)
                     for z in sorted({r["zilla"] for r in rows})},
        "institutions": rows,
    }
    json_path = os.path.join(OUT, f"{BOARD}_institutions.json")
    with open(json_path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=1)

    # ── plain EIIN lists, one per exam (ready to pipe into a result scrape) ──
    for exam in EXAMS:
        with open(os.path.join(OUT, f"{BOARD}_{exam}_eiin.txt"), "w", encoding="utf-8") as fh:
            fh.write("\n".join(r["eiin"] for r in rows if exam in r["exams"]))

    print(f"\n  total unique institutions : {len(rows):,}")
    print(f"    HSC (colleges)          : {len(hsc):,}")
    print(f"    SSC (schools)           : {len(ssc):,}")
    print(f"    both                    : {len(both):,}")
    print("  by district:")
    for z, n in payload["by_zilla"].items():
        print(f"    {z or '—':<22} {n:>5}")
    print(f"\n  wrote {csv_path}\n        {json_path}\n        {BOARD}_hsc_eiin.txt / {BOARD}_ssc_eiin.txt")


if __name__ == "__main__":
    main()
