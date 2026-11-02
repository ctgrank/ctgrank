// Shared auth helper for the reviews Functions.
//
// The leading underscore means Cloudflare Pages does not expose this file as
// a route — it is import-only.
//
// Why this matters: a review's "Admin" badge is decided HERE, on the server,
// by checking the moderator key. It is never taken from the request body.
// Otherwise any visitor could type "Admin" into the name box and post as the
// site owner.

/* Constant-time compare. JS string comparison can leak length/timing, so
   every comparison below is forced to run over the full length. */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/* True only when the request carries the real moderator key. */
export function isAdmin(request, env) {
  if (!env.ADMIN_KEY) return false;
  return safeEqual(request.headers.get('x-admin-key') || '', env.ADMIN_KEY);
}

/* The display name a post is allowed to use.
   Moderators are always "Admin". Everyone else is "Anonymous" when the box
   is empty or unticked, and is stopped from reserving "Admin" for themselves. */
export function authorFor(isMod, body) {
  if (isMod) return { name: 'Admin', anon: false, admin: true };

  const anon = !!body.anon;
  const raw = String(body.name || '').trim();
  // Reserve the moderator identity. Without this, typing "admin" in the name
  // box would produce a post indistinguishable from a real moderator reply.
  const claimedAdmin = raw.toLowerCase() === 'admin';
  const name = anon || !raw || claimedAdmin ? 'Anonymous' : raw;
  return { name, anon: anon || claimedAdmin, admin: false };
}
