// Admin-only moderation: delete a review or a single reply.
//
//   POST /api/admin   x-admin-key: <ADMIN_KEY>
//                     { "action": "deleteReview",  "id": "..." }
//                     { "action": "deleteComment", "reviewId": "...", "commentId": "..." }
//
// Returns the updated list so the page can repaint from the server's truth
// rather than trusting the client to have removed the right thing.
//
// ADMIN_KEY is a Cloudflare Pages secret — it is never sent to the browser
// and never appears in this file. See REVIEWS.md.

const KEY = 'reviews:v1';

/* ------------------------------------------------------------------------
   Brute-force throttle.

   The admin key used to be a long random string, where guessing is hopeless.
   It can now be a memorable password, so wrong-key attempts are rate limited:
   after MAX_FAILS wrong keys from one IP, that IP is locked out for LOCK_MS.

   The counter lives in the same KV namespace under its own prefix. KV is
   eventually consistent (writes can take up to 60s to be visible globally),
   so this is a strong speed bump rather than a hard guarantee — which is
   fine, because it only needs to make guessing impractical, not impossible.
   ------------------------------------------------------------------------ */
const LOCK_PREFIX = 'adminlock:';
const MAX_FAILS = 8;                    // wrong keys before a lockout
const LOCK_MS = 10 * 60 * 1000;         // 10 minutes
const WINDOW_MS = 10 * 60 * 1000;       // failures reset after this long
const LOCK_TTL = 24 * 60 * 60;          // KV entry self-cleans after a day

async function lockState(env, ip) {
  try {
    return JSON.parse(await env.REVIEWS.get(LOCK_PREFIX + ip)) || null;
  } catch {
    return null;
  }
}

async function lockedOut(env, ip) {
  const st = await lockState(env, ip);
  if (st && st.until && Date.now() < st.until) return st;
  return null;
}

async function recordFail(env, ip) {
  const now = Date.now();
  let st = await lockState(env, ip);
  if (!st || now - (st.first || 0) > WINDOW_MS) st = { count: 0, first: now, until: 0 };
  st.count += 1;
  if (st.count >= MAX_FAILS) st.until = now + LOCK_MS;
  await env.REVIEWS.put(LOCK_PREFIX + ip, JSON.stringify(st), { expirationTtl: LOCK_TTL });
  return st;
}

async function clearFails(env, ip) {
  try { await env.REVIEWS.delete(LOCK_PREFIX + ip); } catch { /* non-fatal */ }
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

/* Constant-time compare. JS strings are compared byte-by-byte by the
   engine, so a plain === can leak length/timing; this keeps every
   comparison the same length. */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function load(env) {
  try {
    return JSON.parse((await env.REVIEWS.get(KEY)) || '[]');
  } catch {
    return [];
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.REVIEWS) return json({ error: 'Storage not configured' }, 500);
  if (!env.ADMIN_KEY) return json({ error: 'Admin key not configured' }, 500);

  // Cloudflare hands us the visitor IP; fall back to a fixed bucket so a
  // missing header can't be used to bypass the throttle.
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';

  if (await lockedOut(env, ip)) {
    return json({ error: 'Too many wrong attempts. Please wait a few minutes and try again.' }, 429);
  }

  const supplied = request.headers.get('x-admin-key') || '';
  if (!safeEqual(supplied, env.ADMIN_KEY)) {
    const st = await recordFail(env, ip);
    if (st.until && Date.now() < st.until) {
      return json({ error: 'Too many wrong attempts. Please wait a few minutes and try again.' }, 429);
    }
    const left = MAX_FAILS - st.count;
    return json({
      error: left > 0
        ? `Not authorised. ${left} attempt${left === 1 ? '' : 's'} left before a temporary lock.`
        : 'Not authorised.',
    }, 401);
  }

  // Correct key: wipe the failure counter so a legitimate typo spree doesn't
  // accumulate towards a lockout.
  await clearFails(env, ip);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Malformed request.' }, 400);
  }

  // Cheap auth check so the UI can confirm a key before showing controls.
  if (body.action === 'ping') return json({ ok: true });

  const list = await load(env);

  if (body.action === 'deleteReview') {
    const next = list.filter((r) => r.id !== String(body.id || ''));
    if (next.length === list.length) return json({ error: 'Not found.' }, 404);
    await env.REVIEWS.put(KEY, JSON.stringify(next));
    return json({ ok: true, reviews: next });
  }

  if (body.action === 'deleteComment') {
    const review = list.find((r) => r.id === String(body.reviewId || ''));
    if (!review) return json({ error: 'Not found.' }, 404);
    const before = (review.comments || []).length;
    review.comments = (review.comments || []).filter(
      (c) => c.id !== String(body.commentId || ''));
    if (review.comments.length === before) return json({ error: 'Not found.' }, 404);
    await env.REVIEWS.put(KEY, JSON.stringify(list));
    return json({ ok: true, reviews: list });
  }

  return json({ error: 'Unknown action.' }, 400);
}
