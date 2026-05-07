// ============================================================================
// _shared/dupr-parser.ts — DUPR profile scrape helpers
// ----------------------------------------------------------------------------
// DEPRECATED for Sprint 3 Phase 2 (2026-05-07).
//
// Original purpose: parse DUPR HTML profile pages for ratings.
// Pivoted: DUPR public pages are a Vite/React SPA (empty <div id="root">
// shell on first paint) and DUPR's underlying API requires per-user Bearer
// auth. Rating ingest moved to manual user input — see
// supabase/functions/_shared/dupr-validation.ts and the dupr-link function.
//
// Functions kept here for reference + Sprint 5+ revival when DUPR
// partnership lands:
//
//   - parseDuprInput        — STILL USED. Validates DUPR ID/URL format
//                             (called by dupr-validation.normalizeDuprUrl).
//   - parseDuprProfile      — RESERVED. Re-enable in dupr-sync once we have
//                             rendered HTML or partnership API responses.
//   - fetchDuprProfile      — RESERVED. Re-enable in dupr-sync alongside
//                             parseDuprProfile.
//
// When reviving: stamp dupr_rating_history.source = 'dupr_official' instead
// of 'manual' so the UI can switch the "self-reported" badge to "DUPR
// Official".
// ============================================================================

/**
 * Parse user input from the link-DUPR form. Accepts either a bare DUPR ID or
 * a full mydupr.com profile URL. Returns null for anything else.
 *
 * - URL: https?://(www.)?mydupr.com/dupr/players/<id>(/?)
 * - Bare ID: 4-20 alphanumeric chars
 *
 * Whitespace is trimmed before matching.
 */
export function parseDuprInput(input: string): { duprId: string } | null {
  if (!input || typeof input !== "string") return null;

  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  // URL form
  const urlMatch = trimmed.match(
    /^https?:\/\/(?:www\.)?mydupr\.com\/dupr\/players\/([a-zA-Z0-9]+)\/?$/i,
  );
  if (urlMatch) return { duprId: urlMatch[1] };

  // Bare ID form (alphanumeric, 4-20 chars)
  const idMatch = trimmed.match(/^([a-zA-Z0-9]{4,20})$/);
  if (idMatch) return { duprId: idMatch[1] };

  return null;
}

/** Output of parseDuprProfile. `null` fields mean "could not extract". */
export type ParsedDuprProfile = {
  singles: number | null;
  doubles: number | null;
  displayName: string | null;
};

/**
 * Best-effort parse of a DUPR public profile page. Tries 3 strategies in
 * order; first one that yields a singles or doubles value wins.
 *
 *   1. __NEXT_DATA__ JSON blob (DUPR appears to be a Next.js app — most
 *      structured signal, easiest to keep stable across UI tweaks).
 *   2. CSS class regex (rating-singles / singles-rating + variants for
 *      doubles), with a <title> sniff for the display name.
 *   3. data-* attributes (data-singles / data-doubles), no name extraction.
 *
 * Returns null only when nothing at all matched. Caller decides whether
 * `singles=null && doubles=null` is acceptable (typically: 422 to user).
 */
export function parseDuprProfile(html: string): ParsedDuprProfile | null {
  if (!html || typeof html !== "string" || html.length < 100) return null;

  // ─── Strategy 1: __NEXT_DATA__ JSON blob ────────────────────────────────
  const nextDataMatch = html.match(
    /<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/,
  );
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]);
      const player =
        data?.props?.pageProps?.player ?? data?.props?.pageProps?.profile;
      if (player) {
        const singles = parseFloatOrNull(player.singles ?? player.singlesRating);
        const doubles = parseFloatOrNull(player.doubles ?? player.doublesRating);
        if (singles !== null || doubles !== null) {
          return {
            singles,
            doubles,
            displayName: stringOrNull(player.fullName ?? player.displayName),
          };
        }
      }
    } catch {
      // Malformed JSON — fall through to strategy 2.
    }
  }

  // ─── Strategy 2: CSS class regex ────────────────────────────────────────
  const singlesMatch = html.match(
    /class="[^"]*(?:rating-singles|singles-rating)[^"]*"[^>]*>([0-9.]+)/i,
  );
  const doublesMatch = html.match(
    /class="[^"]*(?:rating-doubles|doubles-rating)[^"]*"[^>]*>([0-9.]+)/i,
  );
  // Title separator can be hyphen, en/em-dash (–, —), or pipe — DUPR's templates vary.
  const titleMatch = html.match(/<title>([^<]+?)\s*[-–—|]\s*DUPR/i);

  if (singlesMatch || doublesMatch) {
    return {
      singles: singlesMatch ? parseFloatOrNull(singlesMatch[1]) : null,
      doubles: doublesMatch ? parseFloatOrNull(doublesMatch[1]) : null,
      displayName: titleMatch ? titleMatch[1].trim() : null,
    };
  }

  // ─── Strategy 3: data-* attributes ──────────────────────────────────────
  const dataSinglesMatch = html.match(/data-singles="([0-9.]+)"/i);
  const dataDoublesMatch = html.match(/data-doubles="([0-9.]+)"/i);

  if (dataSinglesMatch || dataDoublesMatch) {
    return {
      singles: dataSinglesMatch ? parseFloatOrNull(dataSinglesMatch[1]) : null,
      doubles: dataDoublesMatch ? parseFloatOrNull(dataDoublesMatch[1]) : null,
      displayName: null,
    };
  }

  return null;
}

/**
 * Fetch a DUPR profile page. Sets a non-deceptive User-Agent identifying
 * ThePickleHub so DUPR ops can contact us if they want to rate-limit or
 * partner. Honors a 10s default timeout via AbortSignal.timeout (Node 17+,
 * Deno).
 *
 * Network errors propagate as exceptions; HTTP 4xx/5xx return the response
 * body and status — caller maps status → user-facing error code.
 */
export async function fetchDuprProfile(
  url: string,
  opts: { timeout?: number } = {},
): Promise<{ html: string; status: number }> {
  const timeout = opts.timeout ?? 10000;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; ThePickleHub/1.0; +https://www.thepicklehub.net/about)",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,vi-VN;q=0.5",
    },
    signal: AbortSignal.timeout(timeout),
  });

  const html = await response.text();
  return { html, status: response.status };
}

// ─── Internal helpers ───────────────────────────────────────────────────────
function parseFloatOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function stringOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}
