#!/usr/bin/env python3
"""Headless smoke test: load the site, exercise the UI, capture screenshots."""
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000/"
SHOTS = "/home/user/boardrankctg/shots"

import os
os.makedirs(SHOTS, exist_ok=True)

errors, console = [], []


def run(p):
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    pg.on("console", lambda m: (console.append(f"{m.type}: {m.text}"),
                                errors.append(m.text) if m.type == "error" else None))
    pg.on("pageerror", lambda e: errors.append("PAGEERROR " + str(e)))

    pg.goto(BASE, wait_until="networkidle")
    pg.wait_for_selector(".year-card", timeout=20000)
    pg.wait_for_selector("#rows .row", timeout=30000)
    pg.screenshot(path=f"{SHOTS}/01-home.png", full_page=False)

    # headline numbers
    print("hero students:", pg.inner_text("#statStudents"),
          "| schools:", pg.inner_text("#statSchools"),
          "| exams:", pg.inner_text("#statYears"))
    print("title:", pg.inner_text("#wsTitle"))
    print("meta :", pg.inner_text("#wsMeta"))
    print("foot :", pg.inner_text("#tableFoot"))
    print("row1 :", pg.inner_text("#rows .row:first-child"))

    # ── search by name ────────────────────────────────────────────────
    pg.fill("#q", "RAFIQ")
    pg.wait_for_timeout(500)
    print("search RAFIQ ->", pg.inner_text("#tableFoot"))
    pg.screenshot(path=f"{SHOTS}/02-search.png")

    # ── search by roll ────────────────────────────────────────────────
    pg.fill("#q", "100224")
    pg.wait_for_timeout(500)
    rows = pg.locator("#rows .row").count()
    print("roll 100224 ->", pg.inner_text("#tableFoot"), "| painted rows:", rows)
    if rows:
        pg.locator("#rows .row").first.click()
        pg.wait_for_selector("#modal:not([hidden]) .scard", timeout=8000)
        pg.wait_for_timeout(300)
        print("modal name:", pg.inner_text("#mName"))
        print("modal kpis:", " / ".join(pg.locator(".kpi b").all_inner_texts()))
        print("subject rows:", pg.locator("#modalBody .subj").count())
        pg.screenshot(path=f"{SHOTS}/03-student.png")
        pg.screenshot(path=f"{SHOTS}/03-student-full.png",
                      clip=pg.locator(".modal-card").bounding_box())
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(200)

    pg.fill("#q", "")
    pg.wait_for_timeout(400)

    # ── top schools ───────────────────────────────────────────────────
    pg.click('#viewSeg .seg-btn[data-view="schools"]')
    pg.wait_for_timeout(700)
    print("schools:", pg.inner_text("#schoolFoot"))
    print("top3:", [t.strip() for t in pg.locator("#schoolBody tr").first.inner_text().split("\t")])
    pg.screenshot(path=f"{SHOTS}/04-schools.png")

    # ── compare ───────────────────────────────────────────────────────
    pg.click('#viewSeg .seg-btn[data-view="compare"]')
    pg.wait_for_timeout(400)
    pg.fill("#cmpA", "100224")
    pg.fill("#cmpB", "100225")
    pg.click("#cmpBtn")
    pg.wait_for_timeout(700)
    print("compare cards:", pg.locator("#cmpOut .card").count())
    pg.screenshot(path=f"{SHOTS}/05-compare.png")

    # ── switch dataset ────────────────────────────────────────────────
    pg.click('#viewSeg .seg-btn[data-view="students"]')
    pg.click('.year-card[data-year="2024"]')
    pg.wait_for_timeout(2500)
    print("after 2024:", pg.inner_text("#wsTitle"), "|", pg.inner_text("#tableFoot"))
    pg.click('.group-btn[data-group="Commerce"]')
    pg.wait_for_timeout(2500)
    print("commerce:", pg.inner_text("#wsTitle"), "|", pg.inner_text("#tableFoot"))
    pg.screenshot(path=f"{SHOTS}/06-commerce.png")

    # ── HSC ───────────────────────────────────────────────────────────
    pg.click('#examSeg .seg-btn[data-exam="HSC"]')
    pg.wait_for_timeout(2500)
    print("HSC:", pg.inner_text("#wsTitle"), "|", pg.inner_text("#tableFoot"))
    pg.screenshot(path=f"{SHOTS}/07-hsc.png")

    # ── deep link + dark mode + mobile ────────────────────────────────
    pg.goto(BASE + "?exam=SSC&year=2024&group=Science&roll=100224", wait_until="networkidle")
    pg.wait_for_selector("#modal .scard", timeout=25000)
    pg.wait_for_timeout(400)
    print("deeplink modal:", pg.inner_text("#mName"))
    pg.click(".modal-x")
    pg.click("#themeBtn")
    pg.wait_for_timeout(400)
    pg.screenshot(path=f"{SHOTS}/08-dark.png")

    m = b.new_page(viewport={"width": 390, "height": 780}, device_scale_factor=2)
    m.goto(BASE + "?exam=SSC&year=2024&group=Science", wait_until="networkidle")
    m.wait_for_selector("#rows .row", timeout=25000)
    m.wait_for_timeout(400)
    m.screenshot(path=f"{SHOTS}/09-mobile.png")
    m.click("#navToggle")
    m.wait_for_timeout(300)
    m.screenshot(path=f"{SHOTS}/10-mobile-nav.png")

    b.close()


with sync_playwright() as p:
    run(p)

print("\n──── console ────")
for c in console[-25:]:
    print(c)
print("\n──── errors ────")
print("\n".join(errors) if errors else "none ✓")
