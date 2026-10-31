#!/usr/bin/env python3
"""Browser check for the freshly built HSC 2026 datasets."""
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
errs = []


SEL = {"examSeg": "button[data-exam='{}']",
       "yearCards": "button[data-year='{}']",
       "groupTabs": "button[data-group='{}']"}


def pick(page, container, value):
    page.click(f"#{container} {SEL[container].format(value)}")
    page.wait_for_timeout(1200)


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))

    pg.goto(BASE, wait_until="networkidle")
    pg.wait_for_timeout(1500)

    # HSC 2026 must now be offered as a year card
    pick(pg, "examSeg", "HSC")
    cards = pg.eval_on_selector_all("#yearCards button",
                                    "els => els.map(e => e.dataset.year)")
    print("HSC year cards:", cards)
    assert "2026" in cards, "HSC 2026 missing from the year picker"
    for g in ("Science", "Commerce", "Arts"):
        pick(pg, "yearCards", "2026")
        pick(pg, "groupTabs", g)
        pg.wait_for_timeout(600)
        print(f"   {g:<9} -> {pg.inner_text('#wsTitle')}  |  {pg.inner_text('#wsMeta')[:80]}")

    for group, expect_first in (("Science", "tamzeed tahseen reza"),
                                ("Commerce", "imtiaz hossain"),
                                ("Arts", "nawsin tabassum")):
        pick(pg, "examSeg", "HSC")
        pick(pg, "yearCards", "2026")
        pick(pg, "groupTabs", group)
        pg.wait_for_selector("#rows .row", timeout=20000)
        pg.wait_for_timeout(600)

        title = pg.inner_text("#wsTitle")
        meta = pg.inner_text("#wsMeta")
        first = pg.eval_on_selector_all(
            "#rows .row", """els => els.slice(0,1).map(e => ({
                rank: e.querySelector('.rank')?.textContent.trim(),
                name: e.querySelector('.nm')?.textContent.trim(),
                roll: e.querySelector('.rl')?.textContent.trim(),
                gpa:  e.querySelector('.gp')?.textContent.trim(),
                tot:  e.querySelector('.tt')?.textContent.trim() }))""")
        print(f"\n── HSC 2026 {group} ──")
        print("   title:", title)
        print("   meta :", meta[:110])
        print("   #1   :", first)

        assert expect_first.lower() in (first[0]["name"] or "").lower(), \
            f"unexpected topper for {group}: {first[0]['name']}"

        # open the #1 card and count subject rows
        pg.click("#rows .row")
        pg.wait_for_selector("#modal:not([hidden])", timeout=8000)
        pg.wait_for_timeout(400)
        subs = pg.eval_on_selector_all(
            "#modalBody .subj-row, #modalBody tr",
            "els => els.length")
        card = pg.inner_text("#modalBody")
        has_total = "1222" in card or "1195" in card or "1170" in card
        print(f"   card : {subs} subject rows, total shown = {has_total}, {len(card)} chars")
        pg.screenshot(path=f"shots/hsc2026_{group.lower()}_card.png")
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(400)

    # a known roll must land on the rank the dataset says it has
    pick(pg, "examSeg", "HSC")
    pick(pg, "yearCards", "2026")
    pick(pg, "groupTabs", "Science")
    pg.fill("#q", "100427")
    pg.wait_for_timeout(1200)
    res = pg.eval_on_selector_all(
        "#rows .row", "els => els.slice(0,1).map(e => e.innerText.replace(/\\n/g,' | '))")
    print("\n── search roll 100427 (expected rank 2) ──")
    print("   ", res[0] if res else "NO RESULT")
    assert res and "2" == res[0].split("|")[0].strip(), "rank from search is wrong"

    print("\nconsole errors:", errs if errs else "none")
    b.close()
    print("OK" if not errs else "FAILED")
    sys.exit(1 if errs else 0)
