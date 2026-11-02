#!/usr/bin/env python3
"""Local stand-in for the Cloudflare Pages Functions, for UI testing only.

Cloudflare's Functions runtime (and the KV binding) only exist on Pages, so
this serves the site *and* answers /api/reviews from a JSON file using the
same request/response shapes as functions/api/reviews.js.

    python3 tools/test_reviews_server.py 8100
"""
import json
import os
import re
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
STORE = os.path.join(ROOT, ".review-store.json")
# Local stand-in for the ADMIN_KEY secret. Mirror whatever you set on Pages.
ADMIN_KEY = os.environ.get("ADMIN_KEY", "letmein")


def clean(s):
    s = "" if s is None else str(s)
    s = re.sub(r"https?://\S+", "", s, flags=re.I)
    s = re.sub(r"www\.\S+", "", s, flags=re.I)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def load():
    try:
        return json.load(open(STORE))
    except Exception:
        return []


def save(lst):
    json.dump(lst, open(STORE, "w"), indent=1)


def uid():
    return hex(int(time.time() * 1000))[2:] + hex(id(object()))[2:8]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def _json(self, body, status=200):
        raw = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(raw)))
        self.send_header("cache-control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/reviews":
            return self._json({"reviews": load()})
        return super().do_GET()

    def do_POST(self):
        n = int(self.headers.get("content-length") or 0)
        try:
            body = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return self._json({"error": "Malformed request."}, 400)

        path = self.path.split("?")[0]

        if path == "/api/admin":
            if (self.headers.get("x-admin-key") or "") != ADMIN_KEY:
                return self._json({"error": "Not authorised."}, 401)
            lst = load()
            if body.get("action") == "deleteReview":
                nxt = [r for r in lst if r["id"] != str(body.get("id"))]
                if len(nxt) == len(lst):
                    return self._json({"error": "Not found."}, 404)
                save(nxt)
                return self._json({"ok": True, "reviews": nxt})
            if body.get("action") == "deleteComment":
                for r in lst:
                    if r["id"] == str(body.get("reviewId")):
                        before = len(r.get("comments", []))
                        r["comments"] = [c for c in r.get("comments", [])
                                         if c["id"] != str(body.get("commentId"))]
                        if len(r["comments"]) == before:
                            return self._json({"error": "Not found."}, 404)
                        save(lst)
                        return self._json({"ok": True, "reviews": lst})
                return self._json({"error": "Not found."}, 404)
            if body.get("action") == "ping":
                return self._json({"ok": True})
            return self._json({"error": "Unknown action."}, 400)

        text = clean(body.get("text"))
        anon = bool(body.get("anon"))
        raw_name = clean(body.get("name"))[:40]
        name = "Anonymous" if (anon or not raw_name) else raw_name

        if path == "/api/reviews":
            if len(text) < 3:
                return self._json({"error": "Please write a little more."}, 400)
            if len(text) > 1000:
                return self._json({"error": "Keep it under 1000 characters."}, 400)
            lst = load()
            r = {"id": uid(), "name": name, "anon": anon, "text": text,
                 "ts": int(time.time() * 1000), "comments": []}
            lst.insert(0, r)
            save(lst)
            return self._json({"ok": True, "review": r})

        if path == "/api/reviews/comment":
            if len(text) < 2:
                return self._json({"error": "Please write a little more."}, 400)
            lst = load()
            for r in lst:
                if r["id"] == str(body.get("reviewId")):
                    c = {"id": uid(), "name": name, "anon": anon, "text": text,
                         "ts": int(time.time() * 1000)}
                    r.setdefault("comments", []).append(c)
                    save(lst)
                    return self._json({"ok": True, "comment": c})
            return self._json({"error": "That review no longer exists."}, 404)

        return self._json({"error": "Not found"}, 404)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8100
    print(f"serving {ROOT} with a mock reviews API on http://127.0.0.1:{port}")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
