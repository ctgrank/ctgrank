#!/usr/bin/env python3
"""Parse the decoded raw TSV dumps, clean them, compute ranks, and pack each
(year, group) pair into one compact JSON file for the static site.

Ranking rule (documented on the site):
    rank by TOTAL MARKS desc -> GPA desc -> roll asc.
    Students with identical (total, gpa) share the same rank.
"""
import base64
import json
import os
import re
import struct
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
RAW = os.path.join(ROOT, "raw")
OUT = os.path.join(ROOT, "data")
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- subjects ---
# Label + full-marks layout taken from the source site's result-card renderer.
GROUP_SUBJECTS = {
    "science": ("BGS", "Physics", "Chemistry"),
    "commerce": ("Science", "Accounting", "Finance"),
    "arts": ("Science", "Geography", "Civics"),
}


def ssc_subjects(group):
    g1, g2, g3 = GROUP_SUBJECTS[group]
    return [
        ("Bangla", 200), ("English", 200), ("Mathematics", 100), (g1, 100),
        ("Religion", 100), (g2, 100), (g3, 100), ("Compulsory", 100),
        ("ICT", 50), ("Optional", 100), ("Physical Education", 100),
        ("Career Education", 100),
    ]


HSC_SUBJECTS = [
    ("Bangla", 200), ("English", 200), ("ICT", 100), ("Physics", 200),
    ("Chemistry", 200), ("Compulsory", 200), ("Optional", 200),
]

WS = re.compile(r"\s+")


def clean(s):
    s = WS.sub(" ", (s or "").replace("\xa0", " ")).strip()
    s = re.sub(r"\s*,\s*", ", ", s)      # "SCHOOL , CHATTOGRAM" -> "SCHOOL, CHATTOGRAM"
    s = re.sub(r"(,\s*){2,}", ", ", s)    # collapse ", ,"
    return s.strip(" ,").strip()


def to_int(s):
    s = (s or "").strip()
    return int(s) if s.isdigit() else None


def to_gpa(s):
    s = (s or "").strip()
    if not s:
        return None
    try:
        v = float(s)
    except ValueError:
        return None
    return None if v <= 0 or v > 5 else round(v, 2)


# ------------------------------------------------------------- parse main ---
def parse_main(path):
    rows, seen_roll, dupes = [], set(), 0
    src_rows = 0
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.rstrip("\r\n")
            if not line.strip():
                continue
            p = line.split("\t")
            if p and p[0].strip().lower() in ("#", "rank", "sl", "sl."):
                continue
            src_rows += 1
            if len(p) < 6:
                continue
            roll = to_int(p[2])
            name = clean(p[1])
            if roll is None or not name:
                continue
            gpa = to_gpa(p[3])
            total = to_int(p[4])
            school = clean(p[5])
            if roll in seen_roll:
                dupes += 1
                continue
            seen_roll.add(roll)
            rows.append({"roll": roll, "name": name, "gpa": gpa,
                         "total": total, "school": school})
    return rows, dupes, src_rows


def parse_individual(path, width):
    """roll -> [marks] for files that have the real subject columns."""
    out = {}
    if not os.path.exists(path):
        return out
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.rstrip("\r\n")
            if not line.strip():
                continue
            p = line.split("\t")
            if len(p) < width + 1:
                continue
            roll = to_int(p[0])
            if roll is None:
                continue
            marks = [to_int(x) for x in p[1:width + 1]]
            if any(m is None or m < 0 or m > 200 for m in marks):
                continue
            out.setdefault(roll, marks)
    return out


# ------------------------------------------------------------------ pack ----
def build(year, group):
    is_hsc = year.startswith("hsc_")
    main_path = os.path.join(RAW, "%s_%s_main.tsv" % (year, group))
    ind_path = os.path.join(RAW, "%s_%s_ind.tsv" % (year, group))
    if not os.path.exists(main_path):
        return None

    rows, dupes, src_rows = parse_main(main_path)
    if len(rows) < 1000:
        return None  # not enough usable data to publish

    subj_def = HSC_SUBJECTS if is_hsc else ssc_subjects(group)
    width = len(subj_def)
    marks_map = parse_individual(ind_path, width)

    # ---- rank: total desc -> gpa desc -> roll asc, ties share the rank ----
    rows.sort(key=lambda r: (-(r["total"] or 0), -(r["gpa"] or 0), r["roll"]))
    prev_key, rank = None, 0
    for i, r in enumerate(rows):
        key = (r["total"], r["gpa"])
        if key != prev_key:
            rank = i + 1
            prev_key = key
        r["rank"] = rank

    # ---- dedupe school names ----
    school_ids, schools = {}, []
    for r in rows:
        s = r["school"] or "—"
        if s not in school_ids:
            school_ids[s] = len(schools)
            schools.append(s)
        r["sid"] = school_ids[s]

    # ---- pack subject marks into one base64 byte blob (1 byte / mark) ----
    blob = bytearray()
    subj_count = 0
    for r in rows:
        m = marks_map.get(r["roll"])
        if m and len(m) == width:
            blob.extend(struct.pack("%dB" % width, *m))
            subj_count += 1
        else:
            blob.extend(b"\xff" * width)
    subj_b64 = base64.b64encode(bytes(blob)).decode("ascii") if subj_count else ""

    gpa5 = sum(1 for r in rows if r["gpa"] is not None and r["gpa"] >= 5.0)
    tot_sum = sum(r["total"] or 0 for r in rows)
    gpa_sum = sum(r["gpa"] or 0 for r in rows)
    gpa_n = sum(1 for r in rows if r["gpa"] is not None)

    # Coverage: how complete is the year vs. the biggest year of that exam+group
    exam = "HSC" if is_hsc else "SSC"
    label = "%s %s" % (exam, year.replace("hsc_", ""))

    payload = {
        "meta": {
            "id": "%s_%s_%s" % (exam.lower(), year.replace("hsc_", ""), group),
            "exam": exam,
            "year": int(year.replace("hsc_", "")),
            "group": group.capitalize(),
            "label": label,
            "count": len(rows),
            "schools": len(schools),
            "gpa5": gpa5,
            "avgGpa": round(gpa_sum / gpa_n, 2) if gpa_n else None,
            "avgTotal": round(tot_sum / len(rows), 1) if rows else None,
            "maxTotal": max((r["total"] or 0) for r in rows),
            "hasSubjects": bool(subj_b64),
            "subjectsWithMarks": subj_count,
            "dupesDropped": dupes,
            "sourceRows": src_rows,
            "coveragePct": round(100.0 * len(rows) / src_rows, 1) if src_rows else 100.0,
            "partial": (src_rows and len(rows) < src_rows * 0.97)
                       or bool(subj_count and subj_count < len(rows) * 0.95),
            "subjects": [{"name": n, "full": f} for n, f in subj_def],
            "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        },
        "schools": schools,
        "roll": [r["roll"] for r in rows],
        "name": [r["name"] for r in rows],
        "gpa": [int(round(r["gpa"] * 100)) if r["gpa"] is not None else -1 for r in rows],
        "total": [r["total"] if r["total"] is not None else -1 for r in rows],
        "sid": [r["sid"] for r in rows],
        "subjects": subj_b64,
        "subjWidth": width,
    }

    fname = "%s_%s_%s.json" % (exam.lower(), year.replace("hsc_", ""), group)
    path = os.path.join(OUT, fname)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
    size = os.path.getsize(path)
    payload["meta"]["bytes"] = size
    print("  %-26s %6d rows  %5d schools  subjects:%-5s %6.1f KB  partial=%s"
          % (fname, len(rows), len(schools), bool(subj_b64), size / 1024,
             payload["meta"]["partial"]))
    return payload["meta"]


def main():
    years = ["2026", "2025", "2024", "2023", "2022", "hsc_2025", "hsc_2024", "hsc_2023"]
    groups = ["science", "commerce", "arts"]
    catalog = []
    print("Packing datasets:")
    for y in years:
        for g in groups:
            meta = build(y, g)
            if meta:
                catalog.append(meta)
    catalog.sort(key=lambda m: (m["exam"], -m["year"],
                                ["Science", "Commerce", "Arts"].index(m["group"])))
    all_schools = set()
    for fname in os.listdir(OUT):
        if fname.endswith(".json") and fname != "index.json":
            with open(os.path.join(OUT, fname), encoding="utf-8") as fh:
                all_schools.update(json.load(fh)["schools"])
    index = {
        "totalSchools": len(all_schools),
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "board": "Chattogram (Chittagong) Education Board",
        "totalStudents": sum(c["count"] for c in catalog),
        "datasets": catalog,
    }
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as fh:
        json.dump(index, fh, ensure_ascii=False, separators=(",", ":"))
    print("\nDatasets: %d   Students: %s   Data dir: %.1f MB"
          % (len(catalog), f"{index['totalStudents']:,}",
             sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT)) / 1048576))


if __name__ == "__main__":
    main()
