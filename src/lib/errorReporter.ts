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
  details?: {
    filename?: string;
    lineno?: number;
    colno?: number;
  };
}

function send(type: "js_error" | "unhandled_rejection", payload: ReportPayload) {
  const fp = fingerprint(payload.message, payload.stack);
  if (!shouldSend(fp)) return;

  const url = `${ENDPOINT}?type=${type}`;

  try {
    // Inside the try with everything else: `payload` is ours and cannot
    // currently throw, but the invariant this file keeps is that reporting
    // never throws, not that today's payload happens to be safe.
    const body = JSON.stringify(payload);
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

// A rejected promise carries whatever the thrower passed, and BOTH obvious
// ways to render that are hostile:
//   * JSON.stringify returns undefined — not a string — for undefined, a
//     function or a symbol, so calling .slice() on the result throws; and it
//     throws outright on a circular structure or a BigInt.
//   * String() throws on a null-prototype object, on an object with a
//     poisoned toString, and on a bare symbol.
// The previous implementation called .slice() on the stringify result with no
// guard, so a rejection carrying `undefined`, or a circular object such as a
// fetch/Supabase error holding a reference back to its own request, threw
// inside the handler. Production paid for it twice over between 06 and
// 18/08/2026: the real rejection was never recorded, and the throw was logged
// as "TypeError: undefined is not an object (evaluating
// 'JSON.stringify(t).slice')" instead. So every fallback below is itself
// guarded — a describeReason that can throw is the same bug one layer down.

/** String(value), or null when the value refuses to be stringified. */
function safeString(value: unknown): string | null {
  try {
    const text = String(value);
    return typeof text === "string" ? text : null;
  } catch {
    return null;
  }
}

/** Constructor name, for objects that will not stringify usefully. */
function safeConstructorName(value: object): string {
  try {
    return value.constructor?.name || "Object";
  } catch {
    return "Object";
  }
}

/** A few own keys — enough to recognise the shape in the triage table. */
function safeKeys(value: object): string {
  try {
    return Object.keys(value).slice(0, 20).join(", ");
  } catch {
    return "";
  }
}

/**
 * A message for the client_errors table, for any rejection reason at all.
 * Never throws, never returns an empty string.
 */
export function describeReason(reason: unknown): string {
  if (reason instanceof Error) return reason.message || reason.name || "Error";
  if (typeof reason === "string") return reason || "Promise rejected with an empty string";
  if (reason === undefined) return "Promise rejected with undefined";
  if (reason === null) return "Promise rejected with null";

  if (typeof reason === "object") {
    let json: string | undefined;
    try {
      json = JSON.stringify(reason);
    } catch {
      json = undefined;
    }
    // "{}" is what a DOMException, an ErrorEvent and several Supabase error
    // shapes serialise to: a string, technically, and useless in triage. Four
    // such rows landed in client_errors in the fortnight to 18/08/2026.
    if (typeof json === "string" && json !== "{}" && json !== "") return json;

    const name = safeConstructorName(reason);
    const text = safeString(reason);
    if (text && text !== "[object Object]") return `${name}: ${text}`;
    const keys = safeKeys(reason);
    return keys ? `${name} { ${keys} }` : name;
  }

  return safeString(reason) ?? `Promise rejected with a ${typeof reason}`;
}

// React render errors caught by an error boundary never reach
// window.onerror in production — the boundary must report explicitly.
// Same dedupe/ignore pipeline as the global listeners.
export function reportCaughtError(error: Error, context: string): void {
  const message = error.message ?? "unknown_error";
  if (isIgnored(message)) return;
  send("js_error", {
    message: truncate(`[${context}] ${message}`, 1000)!,
    stack: truncate(error.stack, 4000),
    url: typeof window !== "undefined" ? window.location.href : undefined,
  });
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
      details: {
        filename: ev.filename,
        lineno: ev.lineno,
        colno: ev.colno,
      },
    });
  });

  window.addEventListener("unhandledrejection", (ev: PromiseRejectionEvent) => {
    // Guarded end to end. A throw in here does not just lose the rejection —
    // it re-enters as a window "error" event and lands in client_errors as a
    // js_error describing the reporter instead of the bug. That is exactly
    // what the old `JSON.stringify(reason).slice(...)` did in production.
    try {
      const reason = ev.reason;
      const message = describeReason(reason);
      if (isIgnored(message)) return;
      send("unhandled_rejection", {
        message: truncate(message, 1000)!,
        stack: truncate(reason instanceof Error ? reason.stack : undefined, 4000),
        url: window.location.href,
      });
    } catch {
      // Silence would be the worse failure: an unreported rejection is
      // invisible in triage, while a vague row is at least a thread to pull.
      // This payload is a constant, so it cannot fail the same way.
      try {
        send("unhandled_rejection", { message: "unreportable_rejection" });
      } catch {
        /* swallow — error reporter cannot error */
      }
    }
  });
}
