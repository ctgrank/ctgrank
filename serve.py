#!/usr/bin/env python3
"""Tiny gzip-enabled static server for local development / preview.

    python3 serve.py [port]        # default 8000, binds 0.0.0.0

For production just upload the folder to GitHub Pages (or any static host) —
index.html + assets/ + data/ are all you need.
"""
import gzip
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
GZIP_TYPES = {".html", ".css", ".js", ".json", ".svg", ".xml", ".txt", ".csv"}
MIN_GZIP = 1024


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_head(self):
        path = self.translate_path(self.path)
        if not os.path.isdir(path) and os.path.exists(path):
            ext = os.path.splitext(path)[1].lower()
            if ext in GZIP_TYPES and os.path.getsize(path) > MIN_GZIP:
                if "gzip" in self.headers.get("Accept-Encoding", ""):
                    with open(path, "rb") as fh:
                        body = gzip.compress(fh.read(), 6)
                    self.send_response(200)
                    self.send_header("Content-Type",
                                     self.guess_type(path) or "application/octet-stream")
                    self.send_header("Content-Encoding", "gzip")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    return _BytesIO(body)
        return super().send_head()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))


class _BytesIO:
    def __init__(self, b):
        self.b = b
        self.pos = 0

    def read(self, n=-1):
        if n is None or n < 0:
            out, self.pos = self.b[self.pos:], len(self.b)
        else:
            out, self.pos = self.b[self.pos:self.pos + n], min(len(self.b), self.pos + n)
        return out

    def close(self):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    srv = ThreadingHTTPServer(("0.0.0.0", port), H)
    srv.daemon_threads = True
    print("Shikhor → http://0.0.0.0:%d" % port, flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
