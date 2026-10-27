# 🚀 Deployment

## Live now

| Host | URL | Status |
|---|---|---|
| **Surge** | **https://shikhor.surge.sh** | ✅ **live — this is the one to share** |
| Cloudflare quick tunnel | https://chronicles-firefox-russia-harder.trycloudflare.com | ✅ backup, live while this sandbox runs |

Both serve the identical build and work from any device.

---

## 🔐 Your Surge account

```
site      : https://shikhor.surge.sh
login     : jahinhashemchowdhury@gmail.com
password  : Shikhor#BD2530d14e
```

### ⚠️ Do this now: verify the email

Surge emailed a verification link to **jahinhashemchowdhury@gmail.com**. Click it.

The site works the moment it is published, but an unverified account gets **gated to HTTP 403**
after a short grace period — that is exactly what happened to the first deployment
(`shikhor-ctg.surge.sh`, now dead). Verifying takes it from temporary to permanent and needs
**no redeploy**.

Change the password afterwards if you like; future publishes are automatic (see below).

---

## 🔁 Updating the live site

After any change to `index.html`, `assets/` or `data/`:

```bash
cd shikhor && ./deploy.sh          # → https://shikhor.surge.sh
```

Credentials are cached in `~/.netrc`, so it uploads only what changed and is live in seconds — no
prompts. `./deploy.sh <other-domain>` publishes elsewhere; `./deploy.sh yourdomain.com` publishes to
a custom domain (point a CNAME at `na-west1.surge.sh` first).

> Note: each publish re-arms the verification check, so **verify the email before running this**
> on any new account.

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
