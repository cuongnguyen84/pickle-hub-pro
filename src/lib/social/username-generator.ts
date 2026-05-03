/**
 * Username generator for Bet #1 onboarding step 2.
 *
 * Spec: docs picklehub-bet1-spec-v2.md §6 onboarding (line 853-861).
 * "Username AUTO-GENERATED" — user enters display name, system derives a
 * unique URL-safe handle. No prompt, no friction.
 *
 * Algorithm:
 *   1. Strip Vietnamese diacritics ("Nam Nguyễn" → "nam nguyen")
 *   2. Lowercase + replace non [a-z0-9] with hyphen
 *   3. Collapse repeating hyphens, trim leading/trailing hyphens
 *   4. Truncate to 24 chars (leaving 6 for suffix)
 *   5. If username taken → append `-{base36 random 4}` suffix
 *   6. Retry up to 5x; if still taken → fall back to fully random 8-char
 *
 * Caller is responsible for the actual uniqueness check via Supabase
 * (passed in as `isAvailable`); this module is pure logic + retry harness.
 */

/** Diacritic stripper. Covers VN, plus some EN edge cases (cafe → cafe). */
function stripDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")     // standard combining marks
    .replace(/đ/g, "d").replace(/Đ/g, "D"); // Vietnamese-specific
}

/** "Nam Nguyễn" → "nam-nguyen" */
export function slugifyDisplayName(input: string): string {
  const cleaned = stripDiacritics(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 24);
}

/** Random 4-char base36 suffix, e.g. "2k4f". */
function randomSuffix(len = 4): string {
  return Math.random().toString(36).slice(2, 2 + len);
}

/** Fallback: fully random 8-char base36 username. */
function randomUsername(): string {
  return `pickler-${Math.random().toString(36).slice(2, 7)}`;
}

export interface GenerateUsernameOpts {
  /** Async predicate — return true if username is free. */
  isAvailable: (candidate: string) => Promise<boolean>;
  /** Max suffix retries before falling back to fully random. Default 5. */
  maxRetries?: number;
}

/**
 * Generate a unique username. Resolves to a string the caller can persist.
 * Throws only if `isAvailable` itself throws.
 */
export async function generateUsername(
  displayName: string,
  opts: GenerateUsernameOpts,
): Promise<string> {
  const { isAvailable, maxRetries = 5 } = opts;

  const base = slugifyDisplayName(displayName) || "pickler";

  if (await isAvailable(base)) return base;

  for (let i = 0; i < maxRetries; i++) {
    const candidate = `${base}-${randomSuffix(4)}`.slice(0, 30);
    if (await isAvailable(candidate)) return candidate;
  }

  // Last resort
  for (let i = 0; i < 5; i++) {
    const candidate = randomUsername();
    if (await isAvailable(candidate)) return candidate;
  }

  throw new Error("Could not generate unique username after fallback attempts");
}
