// ============================================================================
// telegram-policy — which alerts reach Cuong's Telegram instantly (2026-10-20)
// ----------------------------------------------------------------------------
// Owner decision: Telegram carries only real incidents plus two Grok Bot
// digests a day (08:00 and 21:00 Asia/Saigon, built by team-v2 on the Mac,
// which READS the state tables these functions already write). Instant:
// site down, OTP/auth and payment failures, critical edge functions, CI on
// main. Everything else stays in its table and shows up in the digest.
// Every instant message starts with "[Grok Bot]".
//
// Lives here, not in _shared/, on purpose: deploy-guard redeploys ALL
// functions when _shared/ changes. ops-edge-health imports it from here.
// ============================================================================

export const GROK_PREFIX = "[Grok Bot]";

/** Edge functions whose outage blocks sign-in, payment or the public site. */
export const CRITICAL_EDGE_FUNCTIONS: ReadonlySet<string> = new Set([
  "create-payment-order",
  "mark-payment-claimed",
  "phone-otp-send",
  "phone-otp-verify",
  "send-auth-email",
  "pages-prerender",
]);

// Payment / auth vocabulary seen in job keys, error messages, stacks and URLs.
const CRITICAL_RE =
  /(payment|checkout|sepay|vnpay|momo|\botp\b|[-_/]otp|\bauth\b|auth[-_/ ]|oauth|login|sign[-_ ]?in|sign[-_ ]?up|registration)/i;

export function isCriticalEdgeFunction(slug: string): boolean {
  return CRITICAL_EDGE_FUNCTIONS.has(slug);
}

/** True when any part (job key, message, stack, URL) is about payment or auth. */
export function isCriticalText(...parts: (string | null | undefined)[]): boolean {
  return parts.some((part) => !!part && CRITICAL_RE.test(part));
}

/** Plain-text instant message: "[Grok Bot] 🔴 …" or "[Grok Bot] ✅ …". */
export function instantText(text: string, kind: "alert" | "resolved" = "alert"): string {
  if (text.startsWith(GROK_PREFIX)) return text;
  return `${GROK_PREFIX} ${kind === "resolved" ? "✅" : "🔴"} ${text}`;
}

/** Same as instantText for MarkdownV2 bodies, where [ and ] must be escaped. */
export function instantMarkdownV2(text: string, kind: "alert" | "resolved" = "alert"): string {
  const prefix = "\\[Grok Bot\\]";
  if (text.startsWith(prefix)) return text;
  return `${prefix} ${kind === "resolved" ? "✅" : "🔴"} ${text}`;
}
