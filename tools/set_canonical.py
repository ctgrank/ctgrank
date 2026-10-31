#!/usr/bin/env python3
"""Repoint every canonical/SEO reference at one host, then regenerate.

Search engines treat the canonical host as *the* version of the site, so all
of these must agree. They're spread across a static HTML head, a JS constant
and two generators, which is exactly how they drift apart.

    python3 tools/set_canonical.py https://ctgrank.pages.dev

Rewrites:
  index.html          canonical, og:url, og:image, JSON-LD @id/url
  assets/app.js       SEO_SITE
  tools/prerender.py  SITE
  tools/gen_docs.py   SITE
then regenerates sitemap.xml, robots.txt and the 19 prerendered pages.
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")


def current_site():
    m = re.search(r'^SITE\s*=\s*"([^"]+)"', open(os.path.join(HERE, "gen_docs.py"),
                                                 encoding="utf-8").read(), re.M)
    return m.group(1) if m else None


def swap(path, pairs):
    p = os.path.join(ROOT, path)
    s = open(p, encoding="utf-8").read()
    n = 0
    for a, b in pairs:
        c = s.count(a)
        if c:
            s, n = s.replace(a, b), n + c
    open(p, "w", encoding="utf-8").write(s)
    return n


def main():
    if len(sys.argv) != 2:
        print(__doc__.strip())
        print("\ncurrent:", current_site())
        return 1
    new = sys.argv[1].rstrip("/")
    old = current_site()
    if not new.startswith("http"):
        sys.exit("error: pass a full absolute URL, e.g. https://ctgrank.pages.dev")
    if new == old:
        print("already set to", new)
        return 0

    total = 0
    total += swap("index.html", [(old, new)])
    total += swap("assets/app.js", [("const SEO_SITE = '%s'" % old,
                                     "const SEO_SITE = '%s'" % new)])
    for gen in ("prerender.py", "gen_docs.py"):
        total += swap(os.path.join("tools", gen),
                      [('SITE = "%s"' % old, 'SITE = "%s"' % new)])
    print("rewrote %d reference(s): %s -> %s" % (total, old, new))

    for cmd in ([sys.executable, os.path.join(HERE, "gen_docs.py")],
                [sys.executable, os.path.join(HERE, "prerender.py")]):
        r = subprocess.run(cmd, capture_output=True, text=True)
        tail = (r.stdout.strip().splitlines() or ["<no output>"])[-1]
        print("  %-14s %s" % (os.path.basename(cmd[1]), tail))
        if r.returncode:
            sys.exit(r.stderr)
    print("\ndone — commit and redeploy.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
