#!/usr/bin/env python3
"""Try Netlify Drop (no-signup drag & drop hosting) with a headless browser."""
import re
import sys
import time
from playwright.sync_api import sync_playwright

ZIP = "/home/user/shikhor/shikhor-site.zip"
URL = "https://app.netlify.com/drop"


def snap(pg, tag):
    try:
        pg.screenshot(path=f"/home/user/shikhor/shots/drop-{tag}.png")
    except Exception as e:
        print("  (screenshot failed:", e, ")")


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    pg.set_default_timeout(60000)
    print("→", URL)
    pg.goto(URL, wait_until="domcontentloaded", timeout=90000)
    pg.wait_for_timeout(4000)
    print("  title:", pg.title())
    snap(pg, "01")

    inputs = pg.eval_on_selector_all(
        "input[type=file]", "els => els.map(e => ({id: e.id, name: e.name, cls: e.className}))")
    print("  file inputs:", inputs)

    if not inputs:
        body = pg.inner_text("body")[:400]
        print("  no file input. page text:", body)
        b.close()
        sys.exit(1)

    print("  uploading 7.5 MB…")
    t0 = time.time()
    pg.set_input_files("input[type=file]", ZIP)
    print(f"  set_input_files ok ({time.time()-t0:.1f}s)")

    for i in range(60):
        pg.wait_for_timeout(3000)
        txt = pg.inner_text("body")
        urls = re.findall(r"https://[a-z0-9-]+\.netlify\.app", txt or "")
        if urls:
            print(f"\n  ✅ DEPLOYED → {urls[0]}")
            print("  page snippet:", " ".join(txt.split())[:300])
            snap(pg, "02")
            b.close()
            sys.exit(0)
        if i % 5 == 0:
            print(f"   …{(i+1)*3}s waiting:", " ".join((txt or "").split())[:140])

    print("\n  ⚠ no netlify URL found. final text:")
    print(" ", " ".join(pg.inner_text("body").split())[:800])
    snap(pg, "03")
    b.close()
