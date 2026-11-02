// Reviews API — Cloudflare Pages Function backed by KV.
//
//   GET  /api/reviews          → { reviews: [...] }
//   POST /api/reviews          → { name, text, anon } → creates a review
//
// Storage is a single KV key holding the whole list. That's a deliberate
// trade: one read-modify-write per post instead of an index to keep in
// sync. At this site's volume concurrent posts are vanishingly rare; the
// cost is a lost review, never corruption of the list.
//
// Requires a KV namespace bound as REVIEWS — see REVIEWS.md.

const KEY = 'reviews:v1';
const MAX_REVIEWS = 500;
const MAX_TEXT = 1000;
const MAX_NAME = 40;
const MIN_TEXT = 3;
const POSTS_PER_MINUTE = 3;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

/* Strip anything we don't want on a public wall: links, runaway whitespace.
   Text is escaped again at render time via textContent. */
function clean(s) {
  return String(s == null ? '' : s)
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/www\.\S+/gi, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

async function load(env) {
  try {
    return JSON.parse((await env.REVIEWS.get(KEY)) || '[]');
  } catch {
    return [];
  }
}

/* Rough IP throttle. KV is eventually consistent, so this is a speed bump
   against casual spam rather than a hard guarantee. */
async function throttled(env, ip) {
  const k = `rl:${ip}`;
  const hits = parseInt((await env.REVIEWS.get(k)) || '0', 10) || 0;
  if (hits >= POSTS_PER_MINUTE) return true;
  await env.REVIEWS.put(k, String(hits + 1), { expirationTtl: 60 });
  return false;
}

export async function onRequestGet({ env }) {
  if (!env.REVIEWS) return json({ error: 'Storage not configured' }, 500);
  return json({ reviews: await load(env) });
}

export async function onRequestPost({ request, env }) {
  if (!env.REVIEWS) return json({ error: 'Storage not configured' }, 500);

  const ip =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For') ||
    'unknown';

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Malformed request.' }, 400);
  }

  const text = clean(body.text);
  if (text.length < MIN_TEXT)
    return json({ error: 'Please write a little more.' }, 400);
  if (text.length > MAX_TEXT)
    return json({ error: `Keep it under ${MAX_TEXT} characters.` }, 400);

  if (await throttled(env, ip))
    return json({ error: 'Slow down a moment, then try again.' }, 429);

  const anon = !!body.anon;
  const rawName = clean(body.name).slice(0, MAX_NAME);
  const name = anon || !rawName ? 'Anonymous' : rawName;

  const list = await load(env);
  const review = {
    id: uid(),
    name,
    anon,
    text,
    ts: Date.now(),
    comments: [],
  };
  list.unshift(review);
  if (list.length > MAX_REVIEWS) list.length = MAX_REVIEWS;

  await env.REVIEWS.put(KEY, JSON.stringify(list));
  return json({ ok: true, review });
}
