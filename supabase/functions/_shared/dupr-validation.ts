// ============================================================================
// _shared/dupr-validation.ts — Manual DUPR rating input validation
// ----------------------------------------------------------------------------
// Pure helpers (no Deno-only imports) — importable from edge functions AND
// from frontend hooks (Phase 3 onboarding wizard / Settings → DUPR tab).
//
// Background: Sprint 3 Phase 2 pivoted from HTML scraping to manual rating
// entry because (a) DUPR is a client-rendered SPA so plain fetch returns
// only an empty shell, and (b) DUPR's underlying API requires personal
// Bearer auth tokens that we can't issue without partnership.
//
// Validation rules:
//   - dupr_doubles is REQUIRED (canonical rating used for leaderboards).
//   - dupr_singles is optional.
//   - Both ratings must be in DUPR's published 2.0-7.0 scale.
//   - dupr_id must be 4-20 alphanumeric chars (matches what DUPR shows in
//     profile URLs).
//   - dupr_profile_url, if provided, must point at a known DUPR domain
//     (mydupr.com, dupr.com, dupr.gg — DUPR has shifted hosting recently).
// ============================================================================

export type ManualRatingInput = {
  dupr_id?: string | null;
  dupr_singles?: number | null;
  dupr_doubles?: number | null;
  dupr_profile_url?: string | null;
};

export type ValidationResult =
  | {
      valid: true;
      errors: [];
      normalized: {
        dupr_id: string | null;
        dupr_singles: number | null;
        dupr_doubles: number | null;
        dupr_profile_url: string | null;
      };
    }
  | {
      valid: false;
      errors: string[];
    };

// Accept any subdomain of dupr.com / dupr.gg (DUPR shifted from mydupr.com →
// dashboard.dupr.com mid-2024 and may add more subdomains for the SPA / API).
const DUPR_URL_RE = /^https?:\/\/(?:[a-z0-9-]+\.)*(?:my)?dupr\.(?:com|gg)\//i;
const DUPR_ID_RE = /^[a-zA-Z0-9]{4,20}$/;
const RATING_MIN = 2.0;
const RATING_MAX = 7.0;

/**
 * Validates a manual DUPR rating input. Returns either a valid result with
 * a `normalized` object (NULLs filled in for omitted fields) or an invalid
 * result with a list of error codes.
 */
export function validateManualRating(
  input: ManualRatingInput,
): ValidationResult {
  const errors: string[] = [];

  // dupr_doubles is required — leaderboard + match-card primary rating.
  const doubles =
    input.dupr_doubles === null || input.dupr_doubles === undefined
      ? null
      : input.dupr_doubles;
  if (doubles === null) {
    errors.push("dupr_doubles_required");
  } else if (
    typeof doubles !== "number" ||
    !Number.isFinite(doubles) ||
    doubles < RATING_MIN ||
    doubles > RATING_MAX
  ) {
    errors.push("dupr_doubles_out_of_range");
  }

  // dupr_singles optional but if present must be in range.
  const singles =
    input.dupr_singles === null || input.dupr_singles === undefined
      ? null
      : input.dupr_singles;
  if (singles !== null) {
    if (
      typeof singles !== "number" ||
      !Number.isFinite(singles) ||
      singles < RATING_MIN ||
      singles > RATING_MAX
    ) {
      errors.push("dupr_singles_out_of_range");
    }
  }

  // dupr_id format (only when non-empty).
  const idRaw = input.dupr_id ?? "";
  const id = typeof idRaw === "string" ? idRaw.trim() : "";
  if (id.length > 0 && !DUPR_ID_RE.test(id)) {
    errors.push("dupr_id_invalid_format");
  }

  // dupr_profile_url format (only when non-empty).
  const urlRaw = input.dupr_profile_url ?? "";
  const url = typeof urlRaw === "string" ? urlRaw.trim() : "";
  if (url.length > 0 && !DUPR_URL_RE.test(url)) {
    errors.push("dupr_profile_url_invalid");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    normalized: {
      dupr_id: id.length > 0 ? id : null,
      dupr_singles: singles,
      dupr_doubles: doubles,
      dupr_profile_url: url.length > 0 ? url : null,
    },
  };
}

/**
 * Normalize either a bare DUPR ID or a full DUPR profile URL into a
 * canonical URL. Returns null for anything unrecognizable.
 *
 * - URL matching DUPR_URL_RE → returned trimmed as-is
 * - Bare ID matching DUPR_ID_RE → wrapped as
 *   `https://dashboard.dupr.com/dupr/players/<id>` (current canonical host
 *   per their SPA migration)
 */
export function normalizeDuprUrl(idOrUrl: string): string | null {
  if (!idOrUrl || typeof idOrUrl !== "string") return null;
  const trimmed = idOrUrl.trim();
  if (trimmed.length === 0) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return DUPR_URL_RE.test(trimmed) ? trimmed : null;
  }

  if (DUPR_ID_RE.test(trimmed)) {
    return `https://dashboard.dupr.com/dupr/players/${trimmed}`;
  }

  return null;
}
