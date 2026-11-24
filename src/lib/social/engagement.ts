/**
 * Feed engagement targets (2026-11-24): kudos + comments for every
 * feed card kind, on the same polymorphic tables the match engagement
 * already uses (public.kudos / public.social_comments keyed by
 * target_type + target_id).
 */

export type EngagementTargetType =
  | "news"
  | "blog"
  | "post"
  | "video"
  | "highlight"
  | "embed"
  | "livestream"
  | "tournament"
  | "event";

/**
 * Blogs are file modules with no DB row, so their engagement target id
 * is a deterministic UUID derived from the canonical slug (the same
 * slug in EN and VI whenever the pair shares one, which is the repo
 * convention for new posts). Two FNV-1a 64-bit passes with different
 * seeds form the 128 bits; version/variant bits are set so the value
 * is a well-formed UUID. Pure + synchronous so cards can derive it at
 * render time, identically on every client.
 */
export function blogTargetId(slug: string): string {
  const OFFSET = 0xcbf29ce484222325n;
  const PRIME = 0x100000001b3n;
  const MASK = 0xffffffffffffffffn;
  const fnv1a = (seed: bigint): bigint => {
    let h = OFFSET ^ seed;
    for (let i = 0; i < slug.length; i++) {
      h ^= BigInt(slug.charCodeAt(i));
      h = (h * PRIME) & MASK;
    }
    return h;
  };
  const hex = (h: bigint) => h.toString(16).padStart(16, "0");
  const raw = (hex(fnv1a(0n)) + hex(fnv1a(0x9e3779b97f4a7c15n))).split("");
  // UUID layout: 8-4-4-4-12, version 5, variant 10xx.
  raw[12] = "5";
  raw[16] = ((parseInt(raw[16], 16) & 0x3) | 0x8).toString(16);
  const s = raw.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}
