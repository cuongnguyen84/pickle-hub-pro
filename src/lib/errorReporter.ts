// ============================================================================
// errorReporter — solo-dev grade Sentry replacement
// ----------------------------------------------------------------------------
// Wires window.onerror + window.onunhandledrejection to a Supabase edge
// function (`log-client-event`) so production-only errors stop dying
// silently. Uses navigator.sendBeacon when available — fires-and-forgets
// without holding up page navigation; falls back to fetch keepalive.
//
// Dedupes by message+stack fingerprint within a 5-minute window so a
// runaway error loop doesn't flood the table.
//
// Reads VITE_SUPABASE_URL at boot — no React, no lazy import.
// ============================================================================

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  "https://ajvlcamxemgbxduhiqrl.supabase.co";

const ENDPOINT = `${SUPABASE_URL}/functions/v1/log-client-event`;

const DEDUPE_WINDOW_MS = 5 * 60 * 1000;
const seen = new Map<string, number>();

function fingerprint(message: string, stack: string | undefined): string {
  // Hash collisions don't matter much — we just want "is this the same
  // burst of errors". Use first 200 chars of message + first stack line.
  const stackLine = (stack ?? "").split("\n")[0] ?? "";
  return `${message.slice(0, 200)}|${stackLine.slice(0, 200)}`;
}

function shouldSend(fp: string): boolean {
  const now = Date.now();
  // Garbage-collect old entries every call (cheap, Map is tiny).
  for (const [key, ts] of seen) {
    if (now - ts > DEDUPE_WINDOW_MS) seen.delete(key);
  }
  const last = seen.get(fp);
  if (last && now - last < DEDUPE_WINDOW_MS) return false;
  seen.set(fp, now);
  return true;
}

interface ReportPayload {
  message: string;
  stack?: string;
  url?: string;
  user_agent?: string;
  user_id?: string;
  details?: Record<string, unknown>;
}

function send(type: "js_error" | "unhandled_rejection", payload: ReportPayload) {
  const fp = fingerprint(payload.message, payload.stack);
  if (!shouldSend(fp)) return;

  const body = JSON.stringify(payload);
  const url = `${ENDPOINT}?type=${type}`;

  try {
    // sendBeacon is the right tool — survives navigation, ignores response.
    // Some browsers cap payload at 64 KB; we truncate aggressively below.
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon(url, blob);
      if (ok) return;
    }
    // Fallback — keepalive lets the request survive a navigation.
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      /* swallow — error reporter cannot error */
    });
  } catch {
    /* swallow — same */
  }
}

function truncate(s: string | undefined, n: number): string | undefined {
  if (!s) return undefined;
  return s.length > n ? s.slice(0, n) : s;
}

// Filter list — known noisy errors we don't want flooding the table.
// Add to this conservatively; the point of this tracker is to catch
// surprises, not to silence them.
const IGNORE_MESSAGES = [
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",
  // Chrome extensions can inject scripts that throw — not our problem.
  "Script error.",
];

function isIgnored(message: string): boolean {
  return IGNORE_MESSAGES.some((m) => message.includes(m));
}

export function initErrorReporter(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (ev: ErrorEvent) => {
    const message = ev.message ?? ev.error?.message ?? "unknown_error";
    if (isIgnored(message)) return;
    send("js_error", {
      message: truncate(message, 1000)!,
      stack: truncate(ev.error?.stack, 4000),
      url: window.location.href,
      user_agent: navigator.userAgent,
      details: {
        filename: ev.filename,
        lineno: ev.lineno,
        colno: ev.colno,
      },
    });
  });

  window.addEventListener("unhandledrejection", (ev: PromiseRejectionEvent) => {
    const reason = ev.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : JSON.stringify(reason).slice(0, 1000);
    if (isIgnored(message)) return;
    send("unhandled_rejection", {
      message: truncate(message, 1000)!,
      stack: truncate(reason instanceof Error ? reason.stack : undefined, 4000),
      url: window.location.href,
      user_agent: navigator.userAgent,
    });
  });
}
