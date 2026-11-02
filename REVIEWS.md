# Setting up reviews (one time)

Reviews are posted through a **Cloudflare Pages Function** backed by **KV**.
No database, no third-party service, no ads — but the KV namespace has to be
created by hand, because I can't reach your Cloudflare account.

Roughly two minutes, then it's done permanently.

## Step 1 — create the KV namespace

1. Open **https://dash.cloudflare.com**
2. Left sidebar → **Workers & Pages** → **KV**
3. **Create a namespace**
   - Name: `shikhor-reviews`
4. **Add**

## Step 2 — bind it to the Pages project

1. **Workers & Pages** → your **`ctgrank`** project
2. **Settings** → **Functions**
3. Under **KV namespace bindings**, **Add binding**:
   - Variable name: **`REVIEWS`** ← must be exactly this
   - KV namespace: **`shikhor-reviews`**
4. **Save**

## Step 3 — redeploy

Bindings only apply to new deployments.

In the project → **Deployments** → **⋯** on the latest one → **Retry deployment**.

Then check:

```
https://ctgrank.pages.dev/api/reviews
```

It should return `{"reviews":[]}`. If it returns
`{"error":"Storage not configured"}`, the binding name doesn't match — go
back to step 2 and check it's `REVIEWS`, capitalised.

---

## How it behaves

**No sign-up.** Visitors type a review and post. **Anonymous is on by
default** — untick the box to show a name.

**Comments** open inline under any review, same anonymous option.

**Anti-spam** (in `functions/api/reviews.js`):

| Guard | Limit |
|---|---|
| Links | stripped before saving |
| Review length | 1,000 characters |
| Reply length | 500 characters |
| Posting rate | 3 per minute per IP |
| Replying rate | 5 per minute per IP |
| Storage cap | newest 500 reviews |

Rendering uses `textContent`, never `innerHTML`, so markup typed into a
review is displayed as text rather than executed.

## Costs

KV's free tier is 100,000 reads and 1,000 writes per day. A site of this size
won't come close; you'd need thousands of reviews a day to hit it.

## Moderation

There's no approval queue — posts appear instantly, as you chose. If spam
becomes a problem:

- Edit or delete entries directly: **KV** → `shikhor-reviews` → the
  `reviews:v1` key (it's one JSON array).
- Or tell me and I'll add an approval flag, or a hidden admin view.

## Local testing

Cloudflare's Functions runtime doesn't run locally, so
`tools/test_reviews_server.py` serves the site *and* a mock `/api/reviews`
that mirrors the real thing:

```bash
python3 tools/test_reviews_server.py 8100
```

It writes to `.review-store.json` (gitignored).

## If you move off Cloudflare Pages

The functions only run on Pages. On Surge or GitHub Pages the page still
loads, but shows "Reviews are unavailable right now" instead of failing.
