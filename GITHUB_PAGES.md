# Hosting on GitHub Pages — https://ctgrank.github.io

Run this alongside the existing Surge deploy. Both hosts serve the same static
files, so nothing about the app changes — push once and both are live.

The target is a **user site**, which is why the account *and* the repo are both
named `ctgrank`: GitHub serves `https://<account>.github.io` from a repo called
`<account>.github.io`. That gives the clean, board-ranking-looking address with
no `/repo` path.

---

## 1. Create the GitHub account

Go to <https://github.com/join> and sign up with the username:

```
ctgrank
```

Use **jahinhashemchowdhury@gmail.com**. Verify the email — GitHub will not
publish Pages until it is confirmed.

> If `ctgrank` is taken, either pick another username and accept
> `https://<that-name>.github.io`, or keep any username and create a free
> **organisation** named `ctgrank` — an org site also serves at
> `ctgrank.github.io`. The site itself needs no changes either way.

## 2. Create the repository

New repository → name it exactly:

```
ctgrank.github.io
```

* **Public** (required for Pages on a free account)
* Do **not** add a README, .gitignore or licence — the repo already has them

## 3. Push this project

Run from this folder (`/home/user/shikhor`):

```bash
git remote add origin https://github.com/ctgrank/ctgrank.github.io.git
git push -u origin main
```

Authenticate with a **Personal Access Token**, not your password:
GitHub → Settings → Developer settings → Personal access tokens →
Tokens (classic) → *Generate new token* → tick **`repo`** → use it as the
password when git prompts.

If git asks for a branch name upstream, the local branch is already `main`.

## 4. Turn on Pages

In the repo: **Settings → Pages → Build and deployment**

* Source: **Deploy from a branch**
* Branch: **main**, folder **/ (root)**
* Save

First publish takes ~1–2 minutes. The site is then at
**https://ctgrank.github.io**.

## 5. Check it

```bash
curl -sI https://ctgrank.github.io/data/index.json | head -1   # expect 200
```

Then open the URL — it should land on **HSC 2026 → Science**.

---

## Keeping all three hosts in sync

```bash
./deploy-all.sh                   # both Surge domains at once
git add -A && git commit -m "…"   # GitHub Pages
git push
```

Or one Surge domain at a time with `./deploy.sh <domain>` (default
`shikhor.surge.sh`).

`deploy.sh` deletes any `CNAME` file Surge drops in the project root — a
stray `CNAME` would break GitHub Pages, so don't commit one.

## Notes

* **Both work at once.** Every path in the app is relative, so it runs at a
  domain root *or* under a `/repo` subpath. The `<link rel=canonical>`
  rewrites itself to whichever host is serving, so the two copies don't
  compete in search results.
* **Sizes are fine for Pages:** largest file 2.1 MB (limit 100 MB), repo
  ~26 MB (soft limit 1 GB).
* **`sitemap.xml` / `robots.txt`** currently point at `https://shikhor.surge.sh`.
  To make GitHub the primary instead:
  ```bash
  sed -i 's|https://shikhor.surge.sh|https://ctgrank.github.io|' tools/gen_docs.py
  python3 tools/gen_docs.py && ./deploy.sh && git commit -am "Switch canonical host" && git push
  ```
* **Custom domain later?** Add it in Settings → Pages; GitHub writes the
  `CNAME` file itself, so remember to remove it before running `deploy.sh`.
