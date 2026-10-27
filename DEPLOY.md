# 🚀 Deployment

## Live now

| Host | URL | Status |
|---|---|---|
| **Surge** (permanent) | **https://shikhor-ctg.surge.sh** | ✅ live |
| Cloudflare quick tunnel | https://chronicles-firefox-russia-harder.trycloudflare.com | ✅ live while this sandbox runs |

Both serve the identical build. Surge is the one to share.

---

## ⚠️ Action needed: verify the Surge account

Surge was published with a **newly created account**, and Surge emailed a verification link.
**Until that link is clicked, Surge may restrict or remove the site.**

```
login (email) : jahin.shikhor@gmail.com
password      : Shikhor#Ctg2026
```

Two ways to settle this properly:

1. **That address is yours** → open the verification email, click the link, then change the password.
2. **It isn't** → tell me the email you want and I'll re-publish under a fresh account you own:

   ```bash
   cd shikhor
   /home/user/surge-cli/node_modules/.bin/surge --project . --domain shikhor-ctg.surge.sh
   # enter your email + a password of your choice → creates/uses your account
   ```

Surge is free, needs no credit card, and supports a custom domain (`surge . yourdomain.com` + a CNAME).

---

## 🔁 Updating the live site

After any change to `index.html`, `assets/` or `data/`:

```bash
cd shikhor
/home/user/surge-cli/node_modules/.bin/surge --project . --domain shikhor-ctg.surge.sh
```

It uploads only what changed and is live within seconds.

---

## 🏛️ Preferred permanent home: GitHub Pages

Surge is live today, but **GitHub Pages is the better long-term host** — free forever, custom
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
| `cloudflared tunnel --url http://127.0.0.1:8000` | — | public HTTPS tunnel |

Both die when the sandbox sleeps. To bring the tunnel back:

```bash
cd shikhor && python3 serve.py 8000 &
/home/user/bin/cloudflared tunnel --url http://127.0.0.1:8000 --no-autoupdate --protocol http2
```
