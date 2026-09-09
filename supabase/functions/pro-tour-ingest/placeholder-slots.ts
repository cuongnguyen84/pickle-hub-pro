// ============================================================================
// pro-tour-ingest — placeholder bracket slots
// ----------------------------------------------------------------------------
// Bracket pages publish a round before it is drawn. An undecided slot comes
// back from the scraper as a player whose external_id is a placeholder token —
// "tbd", "tbd-tbd", "bye" — not a person. Two such slots on the same match
// resolve to the SAME ghost profile, and match_participants has
// UNIQUE (match_id, player_id): the second insert raises 23505, the ingest
// throws, and the whole event returns 500.
//
// Observed on production 2026-09-08 18:00 UTC (PPA Asia 1000 Leapmotor Kuala
// Lumpur Cup 2026, all 5 watchlist rows) and 2026-08-06 (PPA Asia 500 MB Ho
// Chi Minh City Open 2026). Both left orphan `matches` rows behind — the match
// is inserted before its participants, so a failed participant insert leaves a
// public match with nobody in it.
//
// This module is intentionally free of npm:/Deno imports so vitest can cover
// it directly (see __tests__/placeholder-slots.test.ts). It lives beside
// index.ts rather than in _shared/ because CI redeploys every edge function
// when anything under supabase/functions/_shared/ changes.
//
// Ô CHỜ (placeholder) trong nhánh đấu chưa bốc thăm — bỏ qua, lần ingest sau
// khi nhánh đã chốt sẽ nhập bình thường.
// ============================================================================

/**
 * Tokens a bracket source uses for "this slot has no player yet".
 *
 * Compared after normalisation (lowercase, trimmed, runs of non-alphanumerics
 * collapsed to a single "-"), so "TBD", " tbd ", "T.B.D." and "tbd_tbd" all
 * land on an entry below. Kept as an explicit list rather than a prefix match
 * so a real player whose slug merely starts with these letters is never
 * dropped.
 */
const PLACEHOLDER_TOKENS = new Set([
  "tbd",
  "tbd-tbd",
  "tba",
  "tba-tba",
  "bye",
  "bye-bye",
  "na",
  "n-a",
  "none",
  "unknown",
  "to-be-determined",
  "to-be-announced",
]);

/** Lowercase, trim, collapse non-alphanumeric runs to a single hyphen. */
export function normalizeExternalId(externalId: string): string {
  return externalId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * True when the external id names an undecided bracket slot rather than a
 * person. Empty / whitespace-only ids count as placeholders too: they cannot
 * identify anybody and would otherwise mint a ghost profile with a blank
 * handle.
 */
export function isPlaceholderExternalId(externalId: string | null | undefined): boolean {
  if (typeof externalId !== "string") return true;
  const normalized = normalizeExternalId(externalId);
  if (normalized === "") return true;
  if (PLACEHOLDER_TOKENS.has(normalized)) return true;
  // "tbd-tbd-tbd", "bye-bye-bye" — a repeated single placeholder token.
  const parts = normalized.split("-");
  return parts.length > 1 && parts.every((part) => PLACEHOLDER_TOKENS.has(part));
}

/**
 * Why a scraped match cannot be turned into rows yet, or null when it can.
 *
 * Returning a reason string (rather than a bare boolean) keeps the skip
 * auditable: the caller logs it, so an event that stops importing is
 * diagnosable from the ingestion log without re-running the scrape.
 */
export function describeUnimportableSlots(
  teamOneExternalIds: readonly string[],
  teamTwoExternalIds: readonly string[],
): string | null {
  if (teamOneExternalIds.length === 0 || teamTwoExternalIds.length === 0) {
    return "empty team";
  }

  const placeholders = [...teamOneExternalIds, ...teamTwoExternalIds].filter((id) =>
    isPlaceholderExternalId(id),
  );
  if (placeholders.length > 0) {
    return `undecided slot (${[...new Set(placeholders)].join(", ")})`;
  }

  // Same person listed twice — on one side, or on both. Either way the
  // participant rows would collide on UNIQUE (match_id, player_id), and the
  // match itself is nonsense. Compare normalised so "Ryan-Ng" and "ryan_ng"
  // are recognised as the same slug.
  const normalized = [...teamOneExternalIds, ...teamTwoExternalIds].map(normalizeExternalId);
  const seen = new Set<string>();
  for (const id of normalized) {
    if (seen.has(id)) return `duplicate player slot (${id})`;
    seen.add(id);
  }

  return null;
}
