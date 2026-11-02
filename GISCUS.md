# Enabling reviews (Giscus)

Reviews are stored in your repo's **GitHub Discussions** and rendered by
[Giscus](https://giscus.app). No database, no backend, no ads — the site
stays 100% static.

Two one-time steps that only you can do (GitHub exposes neither through an
API, so I can't do them for you). Both take under two minutes.

## Step 1 — Turn on Discussions

1. Open **https://github.com/ctgrank/ctgrank/settings**
2. Under **Features**, tick **Discussions**
3. Click **Save changes** (the button appears at the top of the section)

## Step 2 — Install the Giscus app

1. Open **https://github.com/apps/giscus**
2. **Install** → choose **Only select repositories** → pick **`ctgrank`**
3. **Install**

Giscus needs this permission to create discussions and comments on behalf
of people posting reviews.

## Step 3 — Tell me it's done

That's everything on your side. Once both are on, I'll fetch the repo ID
and category ID from GitHub's API, fill them into `giscus.json`, rebuild
`reviews.html` and push.

```bash
python3 tools/build_reviews.py
```

---

## How a review gets posted

Giscus signs people in with **GitHub**, so every review shows the poster's
GitHub name and links to their profile.

**This is the one thing that doesn't match the original brief.** You asked
for a name box with an *Anonymous* option; Giscus can't do that — it always
attributes a post to the signed-in GitHub account, and there's no way to
hide it.

The trade-off, in plain terms:

| | Giscus (current) | Custom form + Cloudflare Function |
|---|---|---|
| Anyone can post without signing up | ❌ needs GitHub | ✅ |
| Custom name / anonymous | ❌ | ✅ |
| Backend needed | none | a small serverless endpoint |
| Spam resistance | high | needs filtering |

If most of your visitors are students without GitHub accounts, Giscus will
get very few reviews and we should switch to the second option. Say the
word and I'll rebuild it.

---

## Moderation

You own the Discussions, so you can edit or delete anything, and lock a
thread. Enable **Discussions moderation** if you want new posts held for
approval: repo → **Settings** → **Moderation** → **Discussions**.

## Optional tweaks

All in `tools/build_reviews.py`, in the `<script src="https://giscus.app/client.js">`
block:

- `data-reactions-enabled="1"` — 👍 reactions on reviews (on)
- `data-input-position="top"` — composer above the list (on)
- `data-theme="preferred_color_scheme"` — follows the visitor's OS setting,
  and the inline script keeps it in sync with the site's own dark-mode toggle
- `data-mapping="specific"` + `data-term="Reviews"` — every review lives in
  one thread
