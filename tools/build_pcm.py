#!/usr/bin/env python3
"""Compile per-board PCM sources into the payload the PCM checker loads.

    python3 tools/build_pcm.py            # compile everything, write index
    python3 tools/build_pcm.py --check    # validate sources only

Every board is one source file in data/pcm/sources/. Nothing here knows the
merit rules — those live in assets/pcm.js, so eligibility and tie-breaks are
defined exactly once. This script only validates, packs and reports.

Source schema (data/pcm/sources/<board>[_<year>_<group>].json):

    {
      "board": "dhaka",
      "exam": "HSC", "year": 2026, "group": "Science",
      "kind": "records",
      "students": [
        { "roll": 1234567, "name": "FULL NAME", "gpa": 5.00,
          "physics": 183, "chemistry": 162, "math": 186,
          "english": 150, "biology": 171 }
      ]
    }

  "gpa"    overall GPA, either 5.00 form or 500 (hundredths). Required.
  marks    raw subject marks, out of "full" (default 200). null or absent
           means the subject was not taken — that student is simply not
           eligible for the categories that require it.
  "kind"   "records" (inline students, above), or "dataset" to reuse a file
           already in data/:
             { "kind": "dataset", "dataset": "hsc_2026_science" }

Output: data/pcm/<board>_<year>_<group>.json, plus data/pcm/index.json.
Records are packed little-endian, 12 bytes each, and base64'd — roll u32,
gpa u16 (hundredths), then physics, chemistry, math, english, biology as u8
(255 = not taken), one pad byte. Names ride alongside as newline-joined
UTF-8, also base64.
"""
import argparse
import base64
import json
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
OUT_DIR = os.path.join(ROOT, "data", "pcm")
SRC_DIR = os.path.join(OUT_DIR, "sources")
DATA_DIR = os.path.join(ROOT, "data")

# The eleven boards that publish HSC/SSC. Order is presentation order.
BOARDS = [
    ("dhaka", "Dhaka"),
    ("rajshahi", "Rajshahi"),
    ("cumilla", "Cumilla"),
    ("chattogram", "Chattogram"),
    ("barishal", "Barishal"),
    ("sylhet", "Sylhet"),
    ("dinajpur", "Dinajpur"),
    ("jashore", "Jashore"),
    ("mymensingh", "Mymensingh"),
    ("madrasah", "Madrasah"),
    ("technical", "Technical"),
]
BOARD_LABEL = dict(BOARDS)
BOARD_IDS = [b for b, _ in BOARDS]

NO_MARK = 255       # sentinel: subject not taken
REC = struct.Struct("<IHBBBBBB")   # roll, gpa*100, p, c, m, e, bio, pad


def fail(msg):
    print("  ERROR: " + msg)
    sys.exit(1)


# ── source loading ────────────────────────────────────────────────────────
def from_dataset(ds_id):
    """Read one of the site's existing data/<id>.json files.

    Those pack subject marks as base64, one byte per subject slot, with
    255 meaning "not taken". Slot order comes from meta.subjects.
    """
    path = os.path.join(DATA_DIR, ds_id + ".json")
    if not os.path.exists(path):
        fail(f"dataset not found: data/{ds_id}.json")
    d = json.load(open(path, encoding="utf-8"))
    meta = d["meta"]
    order = [s["name"] for s in meta["subjects"]]
    raw = base64.b64decode(d["subjects"])
    width = d["subjWidth"]

    def slot(name):
        for i, s in enumerate(order):
            if s.lower() == name.lower():
                return i
        return None

    want = {k: slot(v) for k, v in {
        "physics": "Physics", "chemistry": "Chemistry",
        "math": "Higher Mathematics", "english": "English",
        "biology": "Biology"}.items()}
    missing = [k for k, v in want.items() if v is None]
    if missing:
        fail(f"{ds_id} has no subject slot for: {', '.join(missing)}")

    students = []
    for i in range(len(d["roll"])):
        off = i * width
        rec = {"roll": int(d["roll"][i]), "name": d["name"][i],
               "gpa": int(d["gpa"][i])}          # already hundredths
        for k, idx in want.items():
            v = raw[off + idx]
            rec[k] = None if v == NO_MARK else int(v)
        students.append(rec)
    return meta.get("exam", "HSC"), int(meta.get("year", 0)), \
        meta.get("group", "Science"), students


def norm_gpa(v):
    """Accept 5.00 or 500 and return hundredths."""
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f <= 5.5:
        f = round(f * 100)
    return int(f) if 0 <= f <= 500 else None


def norm_mark(v, full):
    if v is None or v == "":
        return None
    try:
        n = int(round(float(v)))
    except (TypeError, ValueError):
        return None
    if n < 0 or n > full:
        return None
    return n


def load_source(path):
    try:
        s = json.load(open(path, encoding="utf-8"))
    except Exception as e:
        fail(f"{os.path.basename(path)}: {e}")

    board = s.get("board")
    if board not in BOARD_LABEL:
        fail(f"{os.path.basename(path)}: board '{board}' is not one of "
             + ", ".join(BOARD_IDS))
    exam = s.get("exam", "HSC")
    year = int(s.get("year", 0))
    group = s.get("group", "Science")
    if not year:
        fail(f"{os.path.basename(path)}: missing year")

    if s.get("kind") == "dataset":
        e, y, g, students = from_dataset(s.get("dataset", ""))
        exam, year, group = exam or e, year or y, group or g
        full = 200
    else:
        students = s.get("students") or []
        full = int(s.get("full", 200))

    if not students:
        fail(f"{os.path.basename(path)}: no students")

    seen, out, dropped = set(), [], 0
    for i, rec in enumerate(students):
        roll = rec.get("roll")
        gpa = norm_gpa(rec.get("gpa"))
        try:
            roll = int(roll)
        except (TypeError, ValueError):
            dropped += 1
            continue
        if gpa is None or roll in seen:
            dropped += 1
            continue
        seen.add(roll)
        out.append({
            "roll": roll,
            "name": (rec.get("name") or "").strip(),
            "gpa": gpa,
            "physics": norm_mark(rec.get("physics"), full),
            "chemistry": norm_mark(rec.get("chemistry"), full),
            "math": norm_mark(rec.get("math"), full),
            "english": norm_mark(rec.get("english"), full),
            "biology": norm_mark(rec.get("biology"), full),
        })

    if not out:
        fail(f"{os.path.basename(path)}: every row was rejected")
    return {
        "board": board, "exam": exam, "year": year, "group": group,
        "full": full, "students": out, "dropped": dropped,
        "source": os.path.basename(path),
    }


# ── packing ───────────────────────────────────────────────────────────────
def pack(src):
    recs, names = [], []
    for st in src["students"]:
        def m(k):
            v = st[k]
            return NO_MARK if v is None else min(254, max(0, v))
        recs.append(REC.pack(st["roll"], st["gpa"], m("physics"),
                             m("chemistry"), m("math"), m("english"),
                             m("biology"), 0))
        names.append(st["name"])

    pcm = sum(1 for st in src["students"]
              if None not in (st["physics"], st["chemistry"], st["math"]))
    meta = {
        "board": src["board"],
        "boardLabel": BOARD_LABEL[src["board"]],
        "exam": src["exam"], "year": src["year"], "group": src["group"],
        "label": f'{src["exam"]} {src["year"]} — {src["group"]}',
        "full": src["full"],
        "n": len(recs),
        "nPcm": pcm,
        "dropped": src["dropped"],
        "source": src["source"],
        "recSize": REC.size,
    }
    return {
        "meta": meta,
        "rec": base64.b64encode(b"".join(recs)).decode(),
        "names": base64.b64encode("\n".join(names).encode()).decode(),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="validate sources without writing output")
    args = ap.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(SRC_DIR, exist_ok=True)
    files = sorted(f for f in os.listdir(SRC_DIR) if f.endswith(".json"))
    if not files:
        fail(f"no sources in {os.path.relpath(SRC_DIR, ROOT)}/")

    by_board, total, total_pcm = {}, 0, 0
    for fn in files:
        src = load_source(os.path.join(SRC_DIR, fn))
        meta = pack(src)["meta"]
        total += meta["n"]
        total_pcm += meta["nPcm"]
        print(f'  {meta["boardLabel"]:<11} {meta["label"]:<22} '
              f'{meta["n"]:>7,} students  {meta["nPcm"]:>7,} with PCM'
              + (f'  ({meta["dropped"]} dropped)' if meta["dropped"] else ""))
        if not args.check:
            out = os.path.join(
                OUT_DIR, f'{src["board"]}_{src["year"]}_{src["group"]}.json')
            with open(out, "w", encoding="utf-8") as fh:
                json.dump(pack(src), fh, separators=(",", ":"))
            size = os.path.getsize(out)
            by_board.setdefault(src["board"], []).append({
                "exam": src["exam"], "year": src["year"],
                "group": src["group"], "label": meta["label"],
                "file": os.path.relpath(out, ROOT).replace(os.sep, "/"),
                "n": meta["n"], "nPcm": meta["nPcm"], "bytes": size,
            })

    if args.check:
        print(f"\n  {total:,} students, {total_pcm:,} with PCM — sources valid")
        return

    boards = []
    for bid, label in BOARDS:
        boards.append({
            "id": bid, "label": label,
            "sets": sorted(by_board.get(bid, []),
                           key=lambda s: (-s["year"], s["group"])),
        })
    with open(os.path.join(OUT_DIR, "index.json"), "w", encoding="utf-8") as fh:
        json.dump({"boards": boards, "total": total, "totalPcm": total_pcm},
                  fh, separators=(",", ":"))

    have = [b["label"] for b in boards if b["sets"]]
    print(f"\n  {len(have)}/{len(BOARDS)} boards loaded: {', '.join(have)}")
    print(f"  {total:,} students, {total_pcm:,} with PCM")
    print(f"  wrote {os.path.relpath(OUT_DIR, ROOT)}/index.json")


if __name__ == "__main__":
    main()
