// ============================================================================
// badges / profileSlug — short UUID-prefix slugs for `/u/:slug` URLs
// ----------------------------------------------------------------------------
// Slug = first 8 hex characters of the profile.id UUID. At 8 chars the
// search space is 16^8 ≈ 4.3 billion, so collision probability at our
// scale (≤ tens of thousands of profiles) is ≈ 0.001%. The lookup uses
// `LIKE '<slug>%'` so a 12-char slug also resolves (we fall back to 12
// chars in the rare event of an 8-char collision; not implemented in
// this MVP — see TODO in lookupProfileBySlug below).
// ============================================================================

const UUID_HEX_PREFIX_RE = /^[0-9a-f]+$/i;
const SHORT_SLUG_LEN = 8;
const FALLBACK_SLUG_LEN = 12;

/**
 * Stringify a profile.id into its public slug. Strips dashes so a 36-char
 * UUID becomes a 32-char hex string and we take the first 8.
 */
export function profileIdToSlug(profileId: string): string {
  const hex = profileId.replace(/-/g, "");
  return hex.slice(0, SHORT_SLUG_LEN);
}

/**
 * Validate the shape of a slug from a `/u/:slug` URL.  Returns the
 * normalized lowercase slug, or null if the input isn't valid hex of the
 * expected length range. Used as a defence before issuing a DB query.
 */
export function normalizeSlug(slug: string | undefined): string | null {
  if (!slug) return null;
  const s = slug.toLowerCase();
  if (s.length < SHORT_SLUG_LEN || s.length > FALLBACK_SLUG_LEN) return null;
  if (!UUID_HEX_PREFIX_RE.test(s)) return null;
  return s;
}

export const PROFILE_SLUG_SHORT_LEN = SHORT_SLUG_LEN;
export const PROFILE_SLUG_FALLBACK_LEN = FALLBACK_SLUG_LEN;
