#!/usr/bin/env python3
"""Build assets/og-image.png — the 1200x630 social preview card.

Generated rather than designed by hand so it can be regenerated whenever the
branding or the headline numbers change:

    python3 tools/make_og_image.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
OUT = os.path.join(ROOT, "assets", "og-image.png")

W, H = 1200, 630
NAVY = (12, 21, 46)
INDIGO = (30, 58, 138)
AMBER = (245, 158, 11)
SKY = (147, 197, 253)
WHITE = (255, 255, 255)

FONTS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def font(size, bold_path=0):
    for p in FONTS[bold_path:]:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def gradient():
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / (H - 1)
        d.line([(0, y), (W, y)],
               fill=tuple(int(NAVY[i] + (INDIGO[i] - NAVY[i]) * t) for i in range(3)))
    return img


def main():
    img = gradient()
    d = ImageDraw.Draw(img, "RGBA")

    # faint grid
    for x in range(0, W, 60):
        d.line([(x, 0), (x, H)], fill=(255, 255, 255, 8))
    for y in range(0, H, 60):
        d.line([(0, y), (W, y)], fill=(255, 255, 255, 8))

    # mountain peaks along the bottom
    peaks = [(0, 630), (170, 430), (330, 545), (520, 360), (700, 520),
             (880, 400), (1060, 520), (1200, 460), (1200, 630)]
    d.polygon(peaks, fill=(16, 30, 66, 235))
    d.polygon([(0, 630), (250, 500), (470, 600), (700, 470), (950, 590),
               (1200, 505), (1200, 630)], fill=(11, 20, 44, 245))

    f_word = font(132)
    f_sub = font(34)
    f_meta = font(30)
    f_pill = font(22)

    def centre(text, y, f, fill):
        w = d.textlength(text, font=f)
        d.text(((W - w) / 2, y), text, font=f, fill=fill)

    centre("SHIKHOR", 150, f_word, WHITE)
    centre("CHATTOGRAM BOARD RANK LISTS", 310, f_sub, SKY)

    # amber accent rule
    rw = 190
    d.rectangle([(W / 2 - rw / 2, 372), (W / 2 + rw / 2, 376)], fill=AMBER)

    centre("SSC & HSC  \u00b7  2023\u20132026", 402, f_meta, (226, 232, 240))

    # UNOFFICIAL pill, top right
    pad, ph = 22, 44
    pw = d.textlength("UNOFFICIAL", font=f_pill) + pad * 2
    x0, y0 = W - pw - 46, 44
    d.rounded_rectangle([(x0, y0), (x0 + pw, y0 + ph)], radius=ph / 2,
                        fill=(255, 255, 255, 26), outline=(255, 255, 255, 70), width=2)
    d.text((x0 + pad, y0 + 11), "UNOFFICIAL", font=f_pill, fill=(226, 232, 240))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img.save(OUT, "PNG", optimize=True)
    print("wrote %s  %dx%d  %.0f KB" % (OUT, W, H, os.path.getsize(OUT) / 1024))


if __name__ == "__main__":
    main()
