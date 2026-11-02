// POST /api/reviews/comment → { reviewId, name, text, anon }

import { isAdmin, authorFor } from '../_auth.js';
// Appends a reply to an existing review.

const KEY = 'reviews:v1';
const MAX_TEXT = 500;
const MAX_NAME = 40;
const MIN_TEXT = 2;
const REPLIES_PER_MINUTE = 5;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

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
    return json({ error: `Keep replies under ${MAX_TEXT} characters.` }, 400);

  const k = `rlc:${ip}`;
  const hits = parseInt((await env.REVIEWS.get(k)) || '0', 10) || 0;
  if (!isAdmin(request, env) && hits >= REPLIES_PER_MINUTE)
    return json({ error: 'Slow down a moment, then try again.' }, 429);
  if (!isAdmin(request, env)) await env.REVIEWS.put(k, String(hits + 1), { expirationTtl: 60 });

  const list = await load(env);
  const review = list.find((r) => r.id === String(body.reviewId || ''));
  if (!review) return json({ error: 'That review no longer exists.' }, 404);

  // Same rule as a new review: the Admin identity comes from the moderator
  // key, never from the request body.
  const author = authorFor(isAdmin(request, env), body);
  const comment = {
    id: uid(),
    name: author.name,
    anon: author.anon,
    admin: author.admin,
    text,
    ts: Date.now(),
  };
  review.comments = review.comments || [];
  review.comments.push(comment);

  await env.REVIEWS.put(KEY, JSON.stringify(list));
  return json({ ok: true, comment });
}
