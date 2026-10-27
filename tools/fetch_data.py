#!/usr/bin/env python3
"""Download the public board-rank datasets and decode them (Base64 + XOR).

Source: https://boradrankctg.github.io/DATA/data_{year}_{group}.txt
  main -> base64( XOR(tsv, "MySecretKey123") )
  ind  -> plain tsv of per-subject marks
"""
import base64
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = "https://boradrankctg.github.io/DATA/"
KEY = b"MySecretKey123"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "raw")
os.makedirs(OUT, exist_ok=True)

YEARS = ["2026", "2025", "2024", "2023", "2022", "hsc_2025", "hsc_2024", "hsc_2023"]
GROUPS = ["science", "commerce", "arts"]


def xor_decrypt(data):
    return bytes(b ^ KEY[i % len(KEY)] for i, b in enumerate(data))


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def job(args):
    year, group, kind = args
    suffix = "_individual" if kind == "ind" else ""
    url = BASE + "data_%s_%s%s.txt" % (year, group, suffix)
    dest = os.path.join(OUT, "%s_%s_%s.tsv" % (year, group, kind))
    try:
        raw = get(url)
    except Exception as e:  # noqa: BLE001
        return (year, group, kind, "ERR %s" % e)
    if raw.startswith(b"<!DOCTYPE html>"):
        return (year, group, kind, "MISSING")
    try:
        if kind == "main":
            text = xor_decrypt(base64.b64decode(raw)).decode("utf-8", "replace")
        else:
            text = raw.decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        return (year, group, kind, "DECODE-ERR %s" % e)
    with open(dest, "w", encoding="utf-8", newline="") as fh:
        fh.write(text)
    return (year, group, kind, "OK %d chars" % len(text))


if __name__ == "__main__":
    tasks = [(y, g, k) for y in YEARS for g in GROUPS for k in ("main", "ind")]
    with ThreadPoolExecutor(max_workers=8) as ex:
        for r in ex.map(job, tasks):
            print("%8s %-9s %-4s %s" % r, flush=True)
