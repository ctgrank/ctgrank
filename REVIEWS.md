# Setting up reviews (one time)

Reviews are posted through a **Cloudflare Pages Function** backed by **KV**.
No database, no third-party service, no ads — but the KV namespace has to be
created by hand, because I can't reach your Cloudflare account.

Roughly two minutes, then it's done permanently.

## Step 0 — choose a moderator key

This is the password that unlocks deleting reviews. Pick something long and
unrelated to anything else — you'll type it into the site, not a login form.

**Step 1 comes first**, because Pages won't let you add variables until the
project exists with a deployment.

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

## Step 3 — add the moderator key

1. Workers & Pages → **ctgrank** → **Settings** → **Environment variables**
2. **Add variable**:
   - Name: **`ADMIN_KEY`**
   - Value: the key you chose in step 0
3. Pick **Encrypt** (it's a secret — this hides it from the dashboard and logs)
4. **Save**

Set it for **both** Production and Preview if you use preview deployments.

## Step 4 — redeploy

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

## Moderation — deleting a review

Posts appear instantly, as you chose. To remove one:

1. Open **https://ctgrank.pages.dev/reviews.html**
2. Click **Moderate** (top right of "What people are saying")
3. Type your `ADMIN_KEY`
4. Every review and every reply grows a red **Delete** button
5. Delete, then **Sign out**

How it's protected:

| Guard | Detail |
|---|---|
| Key never reaches the page | held as an encrypted Pages secret, compared server-side |
| Verified before use | the key is checked the moment you enter it; a wrong one never reveals controls |
| Not stored permanently | kept in `sessionStorage`, so it dies when you close the tab |
| Constant-time compare | the check doesn't leak the key through timing |
| Stale keys dropped | a key restored from session is re-validated on load |

You can also edit the store directly: **KV** → `shikhor-reviews` → the
`reviews:v1` key (it's one JSON array).

Forgotten the key? Just set a new one in step 3 and redeploy.

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

## Changing the key (including to a memorable password)

`ADMIN_KEY` is an ordinary encrypted environment variable, so you can set it to
anything you like — a random string *or* a password you can remember.

1. Workers & Pages → **ctgrank** → Settings → **Environment variables**
2. Edit `ADMIN_KEY`, type the new value, tick **Encrypt**, save
3. **Deployments → ⋯ → Retry deployment** — the old key keeps working until a
   new build finishes, so retry straight away

**Pick a passphrase, not a single word.** The key travels in a request header, so
anyone who guesses it can delete every review. Three or four unrelated words
(`purple-tractor-canvas-91`) are both memorable and effectively unguessable.
Avoid anything from a password breach list, and don't reuse an email or bank
password.

### Wrong-key lockout

Because the key can now be a password, `/api/admin` throttles guessing:

- **8 wrong attempts** from one IP → that IP is locked out for **10 minutes**
- A correct key immediately resets the counter, so ordinary typos never add up
- The counter expires on its own after 24 hours

If you lock yourself out, just wait 10 minutes. Your visitors are unaffected —
posting and replying are separate endpoints and never throttled by this.
