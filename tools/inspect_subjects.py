#!/usr/bin/env python3
"""Column-by-column sanity check of the packed subject marks (per dataset).

Prints max/min per subject column, and compares sum(marks) against the published
`total` from the main file — a mismatch is the tell-tale sign of a scaled column.
"""
import base64
import json
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
COLS = ["Bangla", "English", "Math", "Grp1", "Religion", "Grp2", "Grp3",
        "Compulsory", "ICT", "Optional", "PhysicalEd", "CareerEd"]

for fn in sorted(os.listdir(ROOT)):
    if not fn.endswith(".json") or fn == "index.json":
        continue
    j = json.load(open(os.path.join(ROOT, fn), encoding="utf-8"))
    meta, width = j["meta"], j["subjWidth"]
    if not j["subjects"]:
        continue
    blob = base64.b64decode(j["subjects"])
    n = len(blob) // width
    cols = [[] for _ in range(width)]
    tot = j["total"]
    diffs, samples = [], []
    for i in range(n):
        off = i * width
        if blob[off] == 255:
            continue
        vals = list(blob[off:off + width])
        for k, v in enumerate(vals):
            cols[k].append(v)
        s = sum(vals)
        if tot[i] > 0:
            d = tot[i] - s
            diffs.append(d)
            if len(samples) < 3 and d:
                samples.append((j["roll"][i], tot[i], s, d, vals))
    print(f"\n=== {fn}  ({meta['exam']} {meta['year']} {meta['group']}) "
          f"rows with marks: {len(cols[0]):,}")
    hdr = "  ".join(f"{c[:9]:>9}" for c in COLS[:width])
    print(f"      {'':>9}  {hdr}")
    print(f"      {'max':>9}  " + "  ".join(f"{max(c):>9}" for c in cols))
    print(f"      {'min':>9}  " + "  ".join(f"{min(c):>9}" for c in cols))
    if diffs:
        zero = sum(1 for d in diffs if d == 0)
        print(f"      sum(marks) vs published total → exact match: "
              f"{zero:,}/{len(diffs):,} ({100*zero/len(diffs):.1f}%)")
        nz = sorted(set(d for d in diffs if d))
        if nz:
            print(f"      non-zero differences: min {min(nz)} max {max(nz)} "
                  f"(distinct: {len(nz)})")
            for s in samples[:3]:
                pe = s[4][10] if width > 10 else "-"
                ce = s[4][11] if width > 11 else "-"
                print(f"        roll {s[0]}: total={s[1]} sum={s[2]} diff={s[3]} "
                      f"PhysicalEd={pe} CareerEd={ce}")
