# Deploying Shikhor to Cloudflare Pages

## Why we moved

Surge serves its **own** `robots.txt` at `/robots.txt` on every `*.surge.sh`
subdomain and ignores the one you deploy:

```
$ curl https://ctgrank.surge.sh/robots.txt
User-agent: *
Disallow: /
```

It survives deleting the file and redeploying, and unrelated sites
(`hello.surge.sh`, `nasa.surge.sh`) return the same thing — so it's platform
behaviour, not a misconfiguration. Google therefore **cannot crawl any
`surge.sh` copy**. Cloudflare Pages serves whatever `robots.txt` you upload.

The canonical host is now **`https://ctgrank.pages.dev`**. To change it later
(custom domain, different host):

```bash
python3 tools/set_canonical.py https://your.new.host
```

That rewrites `index.html`, `assets/app.js`, both generators, then regenerates
the sitemap and all 19 prerendered pages.

---

## Part A — you give me repo access (once)

1. Sign in at **github.com** (create an account if needed).
2. Create a repo — **name it `ctgrank`**, Public, **don't** check any of
   "Add README", ".gitignore" or "license" (the repo must be empty).
3. Go to **github.com/settings/tokens** → **Generate new token (classic)**.
   - Note: `shikhor-deploy`
   - Expiration: **7 days**
   - Scope: tick **`repo`** only
4. **Generate** → copy the token (`ghp_…`).
5. Send me: **username**, **repo name**, **token**.
6. I push. Then **github.com/settings/tokens → Delete** the token immediately.

> Never commit the token to the repo. Delete it the moment I confirm the push.

---

## Part B — connect Cloudflare Pages (you, ~3 minutes)

1. Create an account at **dash.cloudflare.com/sign-up** (free).
2. Left sidebar → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Choose **GitHub** → **Install & Authorize** → pick the `ctgrank` repo.
   (If the repo doesn't appear, choose "Only select repositories" and add it.)
4. **Set up builds and deployments:**
   | Field | Value |
   |---|---|
   | Project name | `ctgrank` ← sets the URL |
   | Production branch | `main` |
   | Framework preset | **None** |
   | Build command | *(leave empty)* |
   | Build output directory | `/` |
5. **Save and Deploy.**

Your site goes live at **https://ctgrank.pages.dev** — usually under a minute.
86 files, ~26 MB, no build step; it's plain static HTML/CSS/JS.

### If `ctgrank` is taken

Cloudflare `<name>.pages.dev` subdomains are global. If it's taken, use
`ctgrank-bd` or similar and tell me — I'll run
`python3 tools/set_canonical.py https://<whatever>.pages.dev` and redeploy.

### Later: custom domain

Pages project → **Custom domains** → **Set up a custom domain**. Then
`python3 tools/set_canonical.py https://yourdomain.com`.

---

## Part C — verify

```bash
curl https://ctgrank.pages.dev/robots.txt
```

Must show `Allow: /` **and** the `Sitemap:` line. If it shows `Disallow: /`,
stop and tell me — that's the whole point of the move.

Then check:

```bash
curl -s https://ctgrank.pages.dev/sitemap.xml | head -5
curl -s -o /dev/null -w "%{http_code}\n" https://ctgrank.pages.dev/hsc-2026-science/
```

Both the sitemap and the prerendered page should return 200.

---

## Part D — submit the sitemap to Google

1. **https://search.google.com/search-console** → **Add property**
2. Pick **URL prefix** (left option) — *not* "Domain", which needs DNS.
3. Enter `https://ctgrank.pages.dev` → Continue.
4. Expand **HTML tag**, copy the meta tag:
   ```html
   <meta name="google-site-verification" content="aBcD1234xxx…" />
   ```
5. Send me the `content="…"` value. I add it to `index.html`, redeploy, and
   Cloudflare picks it up from the repo automatically.
6. Click **Verify**.
7. Left menu → **Sitemaps** → type `sitemap.xml` → **Submit**.
8. Status reads **Success** within a day or two; 20 pages discovered.
9. **URL Inspection** on `/hsc-2026-science/` → **Request Indexing**. Do a
   handful, not all 19 — Google throttles this.
10. Optional: **bing.com/webmasters** → Import from Google Search Console.

**Windows 7:** Search Console is JS-heavy and may misfire on Chrome 110. Use
**Supermium** (win32subsystem.live) if buttons don't respond.

---

## Notes

- Both Surge domains stay live as mirrors. They're blocked from crawling, which
  is harmless — the canonical tag points at `ctgrank.pages.dev` regardless.
- Every push to `main` auto-deploys. No build, no action required.
- `.nojekyll` is in the repo (harmless on Cloudflare, needed only on GitHub Pages).
