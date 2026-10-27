#!/usr/bin/env python3
"""Drive the `surge` CLI through an account-creating publish (needs a pty)."""
import os
import pty
import re
import select
import sys
import time

CLI = "/home/user/surge-cli/node_modules/.bin/surge"
PROJECT = "/home/user/shikhor"
DOMAIN = os.environ.get("DOMAIN", "shikhor.surge.sh")
EMAIL = os.environ.get("EMAIL", "")
PASSWORD = os.environ.get("PASSWORD", "")

buf = []
sent = {"email": 0, "password": 0, "confirm": 0}


def respond(master, queue, text):
    low = text.lower()
    if re.search(r"email\s*:", low):
        if sent["email"] < 3:
            sent["email"] += 1
            queue.append(EMAIL + "\n")
            return
    if re.search(r"password\s*:", low) or "password" in low and ":" in text:
        if sent["password"] < 4:
            sent["password"] += 1
            queue.append(PASSWORD + "\n")
            return
    if re.search(r"\(y/n\)|\(yes/no\)|confirm", low) and "password" not in low:
        queue.append("y\n")
        return
    if "project:" in low or "domain:" in low:
        queue.append("\n")


def main():
    argv = [CLI, "--project", PROJECT, "--domain", DOMAIN]
    pid, master = pty.fork()
    if pid == 0:
        os.environ["TERM"] = "dumb"
        os.execvp(argv[0], argv)

    queue = []
    deadline = time.time() + 300
    log = []
    while time.time() < deadline:
        r, _, _ = select.select([master], [], [], 1.0)
        if not r:
            if queue:
                os.write(master, queue.pop(0).encode())
            continue
        try:
            chunk = os.read(master, 4096)
        except OSError:
            break
        if not chunk:
            break
        text = chunk.decode("utf-8", "replace")
        log.append(text)
        sys.stdout.write(text)
        sys.stdout.flush()
        respond(master, queue, text)

    os.close(master)
    try:
        os.waitpid(pid, 0)
    except ChildProcessError:
        pass

    out = "".join(log)
    open("/tmp/surge_last.log", "w").write(out)
    print("\n─── done ───")
    for pat in ("Success! - Published to", "Aborted", "not available", "verify", "error"):
        for line in out.splitlines():
            if pat.lower() in line.lower():
                print("   •", line.strip()[:160])


if __name__ == "__main__":
    main()
