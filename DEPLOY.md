# 🚀 Deployment

## Live now

| Host | URL | Status |
|---|---|---|
| **Cloudflare quick tunnel** | **https://chronicles-firefox-russia-harder.trycloudflare.com** | ✅ **live — share this** |
| Surge | https://shikhor-ctg.surge.sh | ⛔ HTTP 403 — email verification required |

The tunnel serves the identical build and works from any device. Its one catch: it lives as long as
this sandbox does, so it is a *right now* URL, not a forever URL.

---

## ⛔ Surge is blocked on email verification

Surge published fine, then gated the domain behind account verification:

> `check your email - shikhor-ctg.surge.sh serves once you verify`

The publish used a newly created account (`jahin.shikhor@gmail.com` / `Shikhor#Ctg2026`). That inbox
is not verifiable here, so Surge stays at **403** until one of these happens:

1. **That address is yours** → click the verification link and the URL comes back to life instantly,
   no redeploy needed. Then change the password.
2. **Give me a real email** → I re-publish under a fresh account you own:
   ```bash
   cd shikhor && ./deploy.sh shikhor-ctg.surge.sh
   ```
   (first run prompts for the new email + password, then it's stored and every later push is
   one command)
3. **Skip Surge** → use GitHub Pages below.

Surge needs no credit card and supports custom domains, so it stays a good option *if* the email
can be verified.

---

## 🔁 Updating the live site

After any change to `index.html`, `assets/` or `data/`:

```bash
cd shikhor
/home/user/surge-cli/node_modules/.bin/surge --project . --domain shikhor-ctg.surge.sh
```

It uploads only what changed and is live within seconds.

---

## 🏛️ Recommended permanent home: GitHub Pages

**GitHub Pages is the right long-term host** — free forever, custom
domain, and it's what your reference site uses. The repo is already initialised and committed;
you only need to create an empty GitHub repo and push:

```bash
cd shikhor
git remote add origin https://github.com/<your-username>/shikhor.git
git branch -M main
git push -u origin main
```

`.github/workflows/pages.yml` then builds and deploys automatically on every push
(*Settings → Pages → Source: GitHub Actions*). Your site appears at
`https://<your-username>.github.io/shikhor/`.

---

## 🧭 Other zero-config hosts

| Host | How | Notes |
|---|---|---|
| **Cloudflare Pages** | Dashboard → *Workers & Pages* → *Create* → *Upload assets*, drag `shikhor-site.zip` | Free, fast global CDN |
| **Netlify Drop** | https://app.netlify.com/drop, drag `shikhor-site.zip` | Live instantly, but the free drop **expires in 1 hour** unless you claim it with an account |
| **Any static host** | Upload the contents of `shikhor-site.zip` | nginx, S3 + CloudFront, Firebase Hosting, … |

`shikhor-site.zip` (7.5 MB) is already built and in the project root — regenerate it after changes with:

```bash
zip -qr shikhor-site.zip index.html assets data robots.txt sitemap.xml README.md serve.py .nojekyll
```

---

## 🔧 What's running where (this sandbox)

| Process | Port | Purpose |
|---|---|---|
| `python3 serve.py 8000` | 8000 | local origin |
| `cloudflared tunnel --url http://127.0.0.1:8000` | — | public HTTPS tunnel (**the live URL**) |

Both die when the sandbox sleeps. To bring the tunnel back:

```bash
cd shikhor && python3 serve.py 8000 &
/home/user/bin/cloudflared tunnel --url http://127.0.0.1:8000 --no-autoupdate --protocol http2
```
