// ============================================================================
// Vietnamese phone normalization + validation helpers
// ----------------------------------------------------------------------------
// Used by:
//   - Social Events MVP registration flow (PR2 modal)
//   - phone-otp-send / phone-otp-verify edge functions (Deno re-imports
//     these helpers via a Deno-friendly mirror — see
//     supabase/functions/_shared/phone.ts)
//
// We do NOT depend on libphonenumber-js. The set of valid VN mobile prefixes
// is small and changes rarely; a hand-curated allow-list is ~2KB versus the
// ~140KB libphonenumber bundle, which matters for the public landing page
// (first-paint critical).
//
// VN mobile carrier prefixes after the 2018 sub-prefix migration:
//   Viettel:    032 033 034 035 036 037 038 039 086 096 097 098
//   Vinaphone:  081 082 083 084 085 088 091 094
//   Mobifone:   070 076 077 078 079 089 090 093
//   Vietnamobile: 052 056 058 092
//   Gmobile:    059 099
//   Itelecom:   087
// All VN mobile numbers are 10 digits in 0xx form (3-digit prefix + 7
// digit subscriber). E.164: +84 + 9 digits (drop the leading 0).
// ============================================================================

const VN_MOBILE_PREFIXES = [
  // Viettel
  "32", "33", "34", "35", "36", "37", "38", "39", "86", "96", "97", "98",
  // Vinaphone
  "81", "82", "83", "84", "85", "88", "91", "94",
  // Mobifone
  "70", "76", "77", "78", "79", "89", "90", "93",
  // Vietnamobile
  "52", "56", "58", "92",
  // Gmobile
  "59", "99",
  // Itelecom
  "87",
] as const;

const VN_PREFIX_SET = new Set<string>(VN_MOBILE_PREFIXES);

/**
 * Strip everything that isn't a digit. Used as the first pass on any
 * user-supplied phone input.
 */
function stripNonDigits(input: string): string {
  return input.replace(/\D+/g, "");
}

/**
 * Normalize a user-supplied Vietnamese phone number to E.164 (`+84xxxxxxxxx`).
 *
 * Accepts:
 *   "0901234567"        → "+84901234567"
 *   "+84 901 234 567"   → "+84901234567"
 *   "84-901-234-567"    → "+84901234567"
 *   "84 90 1234 567"    → "+84901234567"
 *   "901234567"         → "+84901234567"  (raw subscriber number)
 *
 * Returns `null` for anything we can't confidently coerce into a 10-digit
 * VN mobile number. Callers should treat null as "invalid input".
 *
 * Pure: no I/O, no Date, no random.
 */
export function normalizeVietnamPhone(input: string | null | undefined): string | null {
  if (input == null) return null;
  const trimmed = String(input).trim();
  if (trimmed.length === 0) return null;

  // Reject obvious junk before we strip — letters in the middle of an
  // otherwise-digit string usually mean it's not a phone number at all.
  // (Pure-letter or symbol-only strings will fall out of stripNonDigits
  // as the empty string anyway.)
  if (/[a-zA-Z]/.test(trimmed)) return null;

  const digits = stripNonDigits(trimmed);
  if (digits.length === 0) return null;

  // Three coercion paths, in priority order:
  //   1) starts with 84  → "84xxxxxxxxx" → +84xxxxxxxxx
  //   2) starts with 0   → "0xxxxxxxxx"  → +84xxxxxxxxx
  //   3) bare 9 digits   → "xxxxxxxxx"   → +84xxxxxxxxx
  let subscriber: string;
  if (digits.startsWith("84")) {
    subscriber = digits.slice(2);
  } else if (digits.startsWith("0")) {
    subscriber = digits.slice(1);
  } else if (digits.length === 9) {
    subscriber = digits;
  } else {
    return null;
  }

  // After coercion, a valid VN mobile subscriber is exactly 9 digits:
  // 2-digit prefix (after dropping the leading "0" or "84") + 7-digit body.
  if (subscriber.length !== 9) return null;
  if (!/^\d{9}$/.test(subscriber)) return null;

  const prefix = subscriber.slice(0, 2);
  if (!VN_PREFIX_SET.has(prefix)) return null;

  return `+84${subscriber}`;
}

/**
 * True iff `e164` is the E.164 form of a valid VN mobile number.
 * Mirror of normalizeVietnamPhone but accepting only the canonical form
 * — useful in edge functions where we want to reject unnormalized input
 * before doing any work.
 */
export function isValidVietnamPhone(e164: string | null | undefined): boolean {
  if (e164 == null) return false;
  const s = String(e164);
  if (!/^\+84\d{9}$/.test(s)) return false;
  const prefix = s.slice(3, 5);
  return VN_PREFIX_SET.has(prefix);
}

/**
 * Mask an E.164 VN phone for public display. Keeps the country code +
 * the last 3 digits visible: `+84 *** *** 567`.
 *
 * For non-VN or malformed input, returns the input unchanged after
 * stripping any non-digit-or-plus characters so we never leak raw data
 * through this function.
 */
export function maskPhone(e164: string | null | undefined): string {
  if (e164 == null) return "";
  const s = String(e164).trim();
  if (s.length === 0) return "";
  if (isValidVietnamPhone(s)) {
    const last3 = s.slice(-3);
    return `+84 *** *** ${last3}`;
  }
  // Generic fallback for non-VN E.164: keep "+", strip everything else
  // except digits, show last 3.
  const cleaned = s.replace(/[^\d+]/g, "");
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 2)}*** *** ${cleaned.slice(-3)}`;
}
