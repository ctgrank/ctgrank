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
DOMAIN = os.environ.get("DOMAIN", "shikhor-ctg.surge.sh")
EMAIL = os.environ.get("EMAIL", "")
PASSWORD = os.environ.get("PASSWORD", "")

buf = []


def pump(fd, master, send_queue, deadline):
    while time.time() < deadline:
        r, _, _ = select.select([master], [], [], 1.0)
        if not r:
            if send_queue:
                nxt = send_queue.pop(0)
                os.write(master, nxt.encode())
            continue
        try:
            chunk = os.read(master, 4096)
        except OSError:
            break
        if not chunk:
            break
        text = chunk.decode("utf-8", "replace")
        buf.append(text)
        sys.stdout.write(text)
        sys.stdout.flush()
        low = text.lower()
        if "email" in low and ":" in text:
            send_queue.append(EMAIL + "\n")
        elif "password" in low and ":" in text:
            send_queue.append(PASSWORD + "\n")
        elif re.search(r"\b(project|domain)\b.*:.*$", text, re.I | re.M):
            send_queue.append("\n")
    return


def main():
    argv = [CLI, "--project", PROJECT, "--domain", DOMAIN]
    pid, master = pty.fork()
    if pid == 0:
        os.environ["TERM"] = "dumb"
        os.execvp(argv[0], argv)
    queue = []
    pump(None, master, queue, time.time() + 300)
    os.close(master)
    _, status = os.waitpid(pid, 0)
    print("\n─── exit", status, "───")
    out = "".join(buf)
    m = re.findall(r"https?://[a-z0-9.-]+\.surge\.sh", out)
    if m:
        print("PUBLISHED:", m[-1])
    else:
        print("no surge URL found")


if __name__ == "__main__":
    main()
