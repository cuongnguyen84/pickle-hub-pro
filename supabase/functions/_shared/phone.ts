// ============================================================================
// _shared/phone.ts — Deno mirror of src/lib/phone for edge functions
// ----------------------------------------------------------------------------
// Edge functions run on Deno and can't import from src/. This file is a
// hand-mirror of src/lib/phone/index.ts. When you change the carrier
// prefix list, update BOTH files. The browser-side suite at
// src/lib/phone/__tests__/phone.test.ts is the source of truth for
// expected behavior — if a case disagrees, the browser suite wins.
// ============================================================================

const VN_MOBILE_PREFIXES: ReadonlySet<string> = new Set([
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
]);

export function normalizeVietnamPhone(input: string | null | undefined): string | null {
  if (input == null) return null;
  const trimmed = String(input).trim();
  if (trimmed.length === 0) return null;
  if (/[a-zA-Z]/.test(trimmed)) return null;

  const digits = trimmed.replace(/\D+/g, "");
  if (digits.length === 0) return null;

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

  if (subscriber.length !== 9) return null;
  if (!/^\d{9}$/.test(subscriber)) return null;

  const prefix = subscriber.slice(0, 2);
  if (!VN_MOBILE_PREFIXES.has(prefix)) return null;
  return `+84${subscriber}`;
}

export function isValidVietnamPhone(e164: string | null | undefined): boolean {
  if (e164 == null) return false;
  const s = String(e164);
  if (!/^\+84\d{9}$/.test(s)) return false;
  return VN_MOBILE_PREFIXES.has(s.slice(3, 5));
}
