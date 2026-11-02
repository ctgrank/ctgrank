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

/* Name shown on moderator posts. Keep in step with MOD_NAME in
   assets/reviews.js, which uses it for the composer label only — the value
   that actually gets stored is decided here. */
export const MOD_NAME = 'Jahin';

/* Names nobody may claim from the name box. Without this, a visitor could
   type "Jahin" and produce a post that looks like it came from the site
   owner. Compared case-insensitively. */
const RESERVED = ['admin', 'administrator', 'moderator', 'mod', 'owner',
                  'shikhor', MOD_NAME.toLowerCase()];

/* The display name a post is allowed to use.
   Moderators post as MOD_NAME with an Admin badge; everyone else is
   "Anonymous" when the box is empty, unticked, or trying to claim a
   reserved identity. */
export function authorFor(isMod, body) {
  if (isMod) return { name: MOD_NAME, anon: false, admin: true };

  const anon = !!body.anon;
  const raw = String(body.name || '').trim();
  const claimed = RESERVED.indexOf(raw.toLowerCase()) !== -1;
  const name = anon || !raw || claimed ? 'Anonymous' : raw;
  return { name, anon: anon || claimed, admin: false };
}
