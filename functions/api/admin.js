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

  const supplied = request.headers.get('x-admin-key') || '';
  if (!safeEqual(supplied, env.ADMIN_KEY)) {
    return json({ error: 'Not authorised.' }, 401);
  }

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
