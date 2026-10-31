#!/usr/bin/env python3
"""Step 2 of the HSC 2026 pipeline: institution -> every roll number + GPA.

  POST https://hscresult.bise-ctg.gov.bd/h22_31_x1_26/result.php   body: eiin=<6 digits>

The reply lists every candidate under headings Science / Business Studies /
Humanities / "Unsuccessful / Others", as `ROLL[GPA]` pairs. Only rows carrying a
numeric GPA are passed candidates, so those are the ones we keep.

Outputs
  hsc2026/institutes.jsonl   one record per EIIN (name, zilla, stats, counts)
  hsc2026/rolls.jsonl        one record per passed candidate
                             {roll, gpa, group, eiin, institute, zilla}
  hsc2026/raw_inst/<eiin>.html   raw replies, so parsing can be re-run cheaply
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
RAW = os.path.join(OUT, "raw_inst")
os.makedirs(RAW, exist_ok=True)

BASE = "https://hscresult.bise-ctg.gov.bd/h22_31_x1_26"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

# our site's group names
GROUPS = {"science": "Science", "business studies": "Commerce", "humanities": "Arts"}
ROLL_RE = re.compile(r"(\d{6})\[([^\]]+)\]")
GPA_RE = re.compile(r"^\d\.\d{2}$")

_lock = threading.Lock()
_done = {"ok": 0, "empty": 0, "err": 0}


def session():
    s = requests.Session()
    s.headers.update({
        "User-Agent": UA,
        "Referer": BASE + "/",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://hscresult.bise-ctg.gov.bd",
        "Content-Type": "application/x-www-form-urlencoded",
    })
    return s


def parse(html, eiin):
    """Return (institute_record, [roll records])."""
    def txt(pat, flags=0):
        m = re.search(pat, html, flags)
        return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", m.group(1))).strip() if m else ""

    name = txt(r'<dt>Institute name</dt><dd>(.*?)</dd>', re.S)
    if not name:
        return None, []
    zilla = txt(r'<dt>Zilla</dt><dd>(.*?)</dd>', re.S)
    thana = txt(r'<dt>Thana</dt><dd>(.*?)</dd>', re.S)

    stats = {}
    for label, key in (("Appeared", "appeared"), ("Passed", "passed"),
                       ("Pass rate", "pass_rate"), ("GPA 5", "gpa5")):
        m = re.search(r"<small>" + label + r"</small><b>(.*?)</b>", html, re.S)
        if m:
            stats[key] = m.group(1).strip()

    inst = {
        "eiin": eiin, "name": name, "zilla": zilla, "thana": thana, **stats,
    }

    rows = []
    # each group is an <h2> followed by a <p class="rolls">
    for m in re.finditer(r"<h2>(.*?)</h2>(.*?)(?=<h2>|$)", html, re.S):
        # <h2>Science <span>764 examinees</span></h2> -> drop the <span> count first
        head = re.sub(r"<span>.*?</span>", "", m.group(1), flags=re.S)
        gname = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", head)).strip()
        group = GROUPS.get(gname.lower())
        if not group:                     # "Unsuccessful / Others"
            continue
        body = m.group(2)
        for roll, gpa in ROLL_RE.findall(body):
            if GPA_RE.match(gpa.strip()):
                rows.append({"roll": int(roll), "gpa": float(gpa),
                             "group": group, "eiin": eiin,
                             "institute": name, "zilla": zilla})
    inst["listed"] = len(rows)
    return inst, rows


def fetch(eiin, s, retries=3):
    raw_path = os.path.join(RAW, eiin + ".html")
    if os.path.exists(raw_path) and os.path.getsize(raw_path) > 2000:
        html = open(raw_path, encoding="utf-8", errors="replace").read()
    else:
        html = None
        for attempt in range(retries):
            try:
                r = s.post(BASE + "/result.php", data={"eiin": eiin}, timeout=90)
                if r.status_code == 200 and r.text:
                    html = r.text
                    with open(raw_path, "w", encoding="utf-8") as fh:
                        fh.write(html)
                    break
            except Exception:
                time.sleep(1.5 * (attempt + 1))
        if html is None:
            with _lock:
                _done["err"] += 1
            return eiin, None
    inst, rows = parse(html, eiin)
    with _lock:
        if inst is None:
            _done["empty"] += 1
        else:
            _done["ok"] += 1
    return eiin, (inst, rows)


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    eiins = [l.strip() for l in open(os.path.join(ROOT, "eiin", "chittagong_hsc_eiin.txt"))
             if l.strip()]
    if limit:
        eiins = eiins[:limit]
    print(f"fetching {len(eiins)} institutions from {BASE}/result.php", flush=True)

    s = session()
    inst_f = open(os.path.join(OUT, "institutes.jsonl"), "w", encoding="utf-8")
    roll_f = open(os.path.join(OUT, "rolls.jsonl"), "w", encoding="utf-8")
    total = 0
    t0 = time.time()

    with ThreadPoolExecutor(max_workers=8) as ex:
        for n, (eiin, res) in enumerate(ex.map(lambda e: fetch(e, s), eiins), 1):
            if not res:
                continue
            inst, rows = res
            if inst:
                inst_f.write(json.dumps(inst, ensure_ascii=False) + "\n")
            for r in rows:
                roll_f.write(json.dumps(r, ensure_ascii=False) + "\n")
            total += len(rows)
            if n % 25 == 0 or n == len(eiins):
                el = time.time() - t0
                print(f"  {n:>4}/{len(eiins)}  rolls so far {total:>7,}  "
                      f"ok={_done['ok']} empty={_done['empty']} err={_done['err']}  "
                      f"{el:.0f}s  eta {el/n*(len(eiins)-n):.0f}s", flush=True)

    inst_f.close()
    roll_f.close()
    print(f"\ndone. {total:,} candidates from {_done['ok']} institutions "
          f"({_done['empty']} with no HSC 2026 result, {_done['err']} errors) in {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
