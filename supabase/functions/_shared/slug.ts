// ============================================================================
// _shared/slug.ts — Deno port of src/lib/social/slug.ts
// ----------------------------------------------------------------------------
// URL convention: Vietnamese canonical, no English aliases (spec §2).
//   /tran-dau/:slug         — match permalink
// Match slug pattern: "{p1}-vs-{p2}-{YYYYMMDD}-{shortId}"
//   - p1, p2 are usernames (or IDs as fallback)
//   - YYYYMMDD = played_at in Asia/Ho_Chi_Minh (UTC+7)
//   - shortId = 6 hex chars to disambiguate same-day matches
// ============================================================================

function stripDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/** Generic slugifier: ASCII-lowercase-hyphenated, max length cap. */
export function slugify(input: string, max = 80): string {
  return stripDiacritics(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
}

/** Random short hex id for slug disambiguation. 6 chars = 16M possible. */
export function shortId(len = 6): string {
  return Math.random()
    .toString(16)
    .slice(2, 2 + len)
    .padEnd(len, "0");
}

/** YYYYMMDD in Asia/Ho_Chi_Minh (UTC+7) for any Date. */
export function dateStampHCM(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .replace(/-/g, "");
}

/** Build the canonical match slug. */
export function buildMatchSlug(
  player1Username: string,
  player2Username: string,
  playedAt: Date,
  id?: string,
): string {
  const p1 = slugify(player1Username, 16) || "p1";
  const p2 = slugify(player2Username, 16) || "p2";
  const date = dateStampHCM(playedAt);
  const sid = id ? slugify(id).slice(0, 6) : shortId(6);
  return `${p1}-vs-${p2}-${date}-${sid}`;
}
