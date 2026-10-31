#!/usr/bin/env python3
"""Step 3 of the HSC 2026 pipeline: roll -> full result with subject-wise marks.

  POST https://hscresult.bise-ctg.gov.bd/h22_31_x1_26/individual/result_mark_details.php
  body: roll=<6 digits>

Writes hsc2026/students.jsonl, one JSON object per roll:
  {roll, name, group, institute, eiin, gpa, result, type, session, reg,
   subjects: [{code, name, grade, marks}], total}

Resumable: rolls already present in the output are skipped, so it can be stopped
and restarted freely. Usage:  python3 tools/hsc2026_fetch_students.py [max_rolls] [workers]
"""
import json
import os
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
OUT = os.path.join(ROOT, "hsc2026")
ROLLS = os.path.join(OUT, "rolls.jsonl")
STUDENTS = os.path.join(OUT, "students.jsonl")

BASE = "https://hscresult.bise-ctg.gov.bd/h22_31_x1_26"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

INFO_RE = re.compile(r"<div>([^<]+)</div>\s*<div[^>]*>(.*?)</div>", re.S)
# grade is A+, A, A-, B, C, D, F ...  (NOT [A+-]+ which only matches A/+/-)
MARK_RE = re.compile(
    r"<tr><td>(.*?)<span[^>]*>\((\d+)\)</span>\s*</td>"
    r"<td[^>]*>\s*([A-F][+-]?)\s*\(\s*(\d+)\)\s*</td></tr>", re.S)
NOT_FOUND = re.compile(r"(not found|খুঁজে পাওয়া যায়নি|No result)", re.I)

_lock = threading.Lock()
_stat = {"ok": 0, "empty": 0, "err": 0}


def session():
    s = requests.Session()
    s.headers.update({
        "User-Agent": UA,
        "Referer": BASE + "/individual/",
        "Origin": "https://hscresult.bise-ctg.gov.bd",
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    })
    a = requests.adapters.HTTPAdapter(pool_connections=64, pool_maxsize=64)
    s.mount("https://", a)
    return s


def parse(html, roll):
    info = {}
    for k, v in INFO_RE.findall(html):
        k = k.strip()
        v = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", v)).strip()
        if k and v:
            info[k] = v
    if not info.get("Roll No"):
        return None
    subs = []
    for raw_name, code, grade, marks in MARK_RE.findall(html):
        name = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", raw_name)).strip()
        subs.append({"code": int(code), "name": name,
                     "grade": grade, "marks": int(marks)})
    if not subs:
        return None
    return {
        "roll": roll,
        "name": info.get("Name", ""),
        "group": (info.get("Group") or "").title(),
        "institute": info.get("Institute", ""),
        "gpa": info.get("GPA", ""),
        "result": info.get("Result", ""),
        "type": info.get("Type", ""),
        "session": info.get("Session", ""),
        "reg": info.get("Reg. NO", ""),
        "subjects": subs,
        "total": sum(s["marks"] for s in subs),
    }


def fetch(rec, s, retries=3):
    roll = rec["roll"]
    for attempt in range(retries):
        try:
            r = s.post(BASE + "/individual/result_mark_details.php",
                       data={"roll": roll}, timeout=60)
            if r.status_code != 200:
                time.sleep(1.0 * (attempt + 1))
                continue
            rec2 = parse(r.text, roll)
            if rec2:
                rec2["eiin"] = rec["eiin"]
                with _lock:
                    _stat["ok"] += 1
                return rec2
            # empty page = transient (throttle/partial); back off and retry
            time.sleep(1.2 * (attempt + 1))
        except Exception:
            time.sleep(1.0 * (attempt + 1))
    with _lock:
        _stat["empty"] += 1
    return None


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    workers = int(sys.argv[2]) if len(sys.argv) > 2 else 16

    done = set()
    if os.path.exists(STUDENTS):
        for l in open(STUDENTS, encoding="utf-8"):
            try:
                done.add(json.loads(l)["roll"])
            except Exception:
                pass
    todo = []
    for l in open(ROLLS, encoding="utf-8"):
        r = json.loads(l)
        if r["roll"] not in done:
            todo.append(r)
    if limit:
        todo = todo[:limit]
    print(f"rolls to fetch: {len(todo):,}  (already have {len(done):,})  workers={workers}",
          flush=True)
    if not todo:
        return

    s = session()
    fh = open(STUDENTS, "a", encoding="utf-8")
    t0 = time.time()
    n = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for rec in ex.map(lambda r: fetch(r, s), todo):
            n += 1
            if rec:
                fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
            if n % 250 == 0 or n == len(todo):
                fh.flush()
                el = time.time() - t0
                rate = n / el if el else 0
                print(f"  {n:>7,}/{len(todo):,}  ok={_stat['ok']:,} "
                      f"empty={_stat['empty']:,} err={_stat['err']:,}  "
                      f"{rate:5.1f} req/s  eta {(len(todo)-n)/rate/60:.1f} min", flush=True)
    fh.close()
    print(f"\ndone in {(time.time()-t0)/60:.1f} min — ok={_stat['ok']:,} "
          f"empty={_stat['empty']:,} err={_stat['err']:,}")


if __name__ == "__main__":
    main()
