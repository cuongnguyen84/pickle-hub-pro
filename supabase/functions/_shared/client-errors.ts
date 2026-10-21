export type ClientErrorType = "js_error" | "unhandled_rejection" | "csp_violation";

export interface ClientErrorInsert {
  type: ClientErrorType;
  message: string | null;
  stack: string | null;
  url: string | null;
  user_agent: string | null;
  user_id: string | null;
  details: Record<string, unknown> | null;
}

export interface ParsedClientErrors {
  rawCount: number;
  rows: ClientErrorInsert[];
  tooLarge: boolean;
  /**
   * Reports that parsed cleanly and were then dropped as third-party noise —
   * see isThirdPartyCspReport. Non-zero with an empty `rows` means "we
   * understood the request and chose to store nothing", which is a different
   * answer to the caller than "we could not parse it".
   */
  injectedCount: number;
}

export const MAX_CLIENT_ERROR_BODY_BYTES = 32 * 1024;
export const MAX_CLIENT_ERROR_BATCH = 20;

const CLIENT_ERROR_TYPES = new Set<ClientErrorType>([
  "js_error",
  "unhandled_rejection",
  "csp_violation",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function finiteInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const integer = Math.trunc(value);
  return integer >= 0 && integer <= 10_000_000 ? integer : null;
}

function compactDetails(value: Record<string, unknown>): Record<string, unknown> | null {
  const entries = Object.entries(value).filter(([, detail]) => detail !== null);
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export function parseClientErrorType(value: string | null): ClientErrorType | null {
  const normalized = (value ?? "js_error").toLowerCase() as ClientErrorType;
  return CLIENT_ERROR_TYPES.has(normalized) ? normalized : null;
}

export function sanitizeClientErrorUrl(value: unknown, maxLength = 500): string | null {
  const raw = text(value, maxLength * 2);
  if (!raw) return null;
  if (/^data:/i.test(raw)) return "data:";
  if (/^blob:/i.test(raw)) return "blob:";
  if (/^(inline|eval|self|none)$/i.test(raw)) return raw.toLowerCase();

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return `${parsed.protocol}`.slice(0, maxLength);
    }
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().slice(0, maxLength);
  } catch {
    return raw.split(/[?#]/, 1)[0]?.slice(0, maxLength) || null;
  }
}

/**
 * Third-party code injected into OUR document, reporting against OUR policy.
 * ---------------------------------------------------------------------------
 * A CSP report says "this document tried to load that resource". It does not
 * say the document's own code asked for it. Three things routinely inject
 * scripts and stylesheets into a page the site never requested:
 *
 *   * the Facebook in-app browser (connect.facebook.net/…/pcm.js and
 *     iab.autofill.enhanced.v2.js, 371 reports in the 30 days to 2026-08-30) —
 *     which matters here more than anywhere, because most of this site's
 *     traffic arrives from Facebook links and therefore inside that browser;
 *   * the ShopBack cashback extension, which injects its own webfonts
 *     (static.shopback.com/fonts/…, 56 reports over the same 30 days);
 *   * Google Translate's page translation (www.gstatic.com/_/translate_http/…);
 *   * browser extensions, whose source-file carries an extension scheme.
 *
 * None of these hosts appears anywhere in this repo, so a report naming one
 * can only be an injection: there is no version of our code that could be
 * fixed in response to it, and no CSP change that should be made for it —
 * allow-listing Facebook's injected scripts would weaken the policy to
 * accommodate software we do not ship.
 *
 * They are dropped at ingestion rather than filtered at read time because the
 * cost is not just noise in a query. In the week to 2026-08-30 they were 93%
 * of every row (312 of 336), which (a) pushes real reports past PostgREST's
 * 1000-row response cap on the triage query and (b) spends the per-identity
 * rate limit in log-client-event — so a genuine error from a Facebook in-app
 * browser user can be rejected with 429 because Facebook's own scripts had
 * already used that user's budget. Noise that evicts signal, not just noise.
 *
 * Deliberately host-exact, not a substring match on the message: the filter
 * must never be able to grow into "hide the CSP violations we find annoying".
 * Our own violations name our own origin and are always kept — including the
 * `blocked-uri: "data"` connect-src reports coming out of /assets/index-*.js,
 * which are the reason this feed exists and which sat under 200 rows of
 * Facebook noise until this filter.
 *
 * NOT listed, on purpose: lottingem.com and gateway.zscloud.net also showed up
 * in the same 30 days. Those are adware and a corporate TLS proxy rewriting
 * pages for real readers — third-party, but evidence about the audience rather
 * than a known browser feature, so they stay visible.
 */
const THIRD_PARTY_REPORT_HOSTS = new Set<string>([
  "connect.facebook.net",
  "static.shopback.com",
]);

const THIRD_PARTY_REPORT_PREFIXES: readonly string[] = [
  // Google Translate injects its stylesheet from a versioned path under
  // gstatic.com. The host alone is too broad — we load fonts from gstatic.
  "https://www.gstatic.com/_/translate_http/",
];

const EXTENSION_SCHEMES: readonly string[] = [
  "chrome-extension:",
  "moz-extension:",
  "safari-extension:",
  "safari-web-extension:",
];

/** True when a parsed CSP report describes injected third-party code. */
export function isThirdPartyCspReport(details: Record<string, unknown> | null): boolean {
  if (!details) return false;

  const sourceFile = typeof details["source-file"] === "string" ? details["source-file"] : "";
  if (EXTENSION_SCHEMES.some((scheme) => sourceFile.startsWith(scheme))) return true;

  const blocked = typeof details["blocked-uri"] === "string" ? details["blocked-uri"] : "";
  if (!blocked) return false;
  if (THIRD_PARTY_REPORT_PREFIXES.some((prefix) => blocked.startsWith(prefix))) return true;

  try {
    return THIRD_PARTY_REPORT_HOSTS.has(new URL(blocked).hostname);
  } catch {
    return false;
  }
}

export function parseJsClientError(
  type: "js_error" | "unhandled_rejection",
  body: unknown,
  userId: string | null,
  serverUserAgent: string | null,
): ParsedClientErrors {
  if (!isRecord(body)) return { rawCount: 1, rows: [], tooLarge: false, injectedCount: 0 };
  const message = text(body.message, 1_000);
  if (!message) return { rawCount: 1, rows: [], tooLarge: false, injectedCount: 0 };

  const suppliedDetails = isRecord(body.details) ? body.details : {};
  const details = compactDetails({
    filename: sanitizeClientErrorUrl(suppliedDetails.filename),
    lineno: finiteInteger(suppliedDetails.lineno),
    colno: finiteInteger(suppliedDetails.colno),
  });

  return {
    rawCount: 1,
    tooLarge: false,
    injectedCount: 0,
    rows: [{
      type,
      message,
      stack: text(body.stack, 4_000),
      url: sanitizeClientErrorUrl(body.url),
      user_agent: text(serverUserAgent, 500),
      user_id: userId,
      details,
    }],
  };
}

function first(report: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (report[key] !== undefined) return report[key];
  }
  return undefined;
}

function parseCspReport(
  report: Record<string, unknown>,
  outerUrl: unknown,
  userId: string | null,
  serverUserAgent: string | null,
): ClientErrorInsert {
  const documentUrl = sanitizeClientErrorUrl(
    first(report, "document-uri", "documentURL") ?? outerUrl,
  );
  const blockedUrl = sanitizeClientErrorUrl(first(report, "blocked-uri", "blockedURL"));
  const sourceFile = sanitizeClientErrorUrl(first(report, "source-file", "sourceFile"));
  const violatedDirective = text(
    first(report, "violated-directive", "violatedDirective"),
    200,
  );
  const effectiveDirective = text(
    first(report, "effective-directive", "effectiveDirective"),
    200,
  );
  const lineNumber = finiteInteger(first(report, "line-number", "lineNumber"));

  const details = compactDetails({
    "document-uri": documentUrl,
    "violated-directive": violatedDirective,
    "effective-directive": effectiveDirective,
    "original-policy": text(first(report, "original-policy", "originalPolicy"), 8_000),
    "blocked-uri": blockedUrl,
    "source-file": sourceFile,
    "line-number": lineNumber,
    "column-number": finiteInteger(first(report, "column-number", "columnNumber")),
    "status-code": finiteInteger(first(report, "status-code", "statusCode")),
    referrer: sanitizeClientErrorUrl(report.referrer),
    disposition: text(report.disposition, 50),
    "script-sample": text(first(report, "script-sample", "sample"), 500),
  });

  return {
    type: "csp_violation",
    message: `${violatedDirective ?? effectiveDirective ?? "csp"} blocked ${blockedUrl ?? ""}`
      .trim()
      .slice(0, 500),
    stack: sourceFile ? `${sourceFile}:${lineNumber ?? "?"}` : null,
    url: documentUrl,
    user_agent: text(serverUserAgent, 500),
    user_id: userId,
    details,
  };
}

export function parseCspClientErrors(
  body: unknown,
  userId: string | null,
  serverUserAgent: string | null,
): ParsedClientErrors {
  if (isRecord(body) && isRecord(body["csp-report"])) {
    const row = parseCspReport(body["csp-report"], undefined, userId, serverUserAgent);
    const injected = isThirdPartyCspReport(row.details);
    return {
      rawCount: 1,
      rows: injected ? [] : [row],
      tooLarge: false,
      injectedCount: injected ? 1 : 0,
    };
  }

  if (!Array.isArray(body)) return { rawCount: 0, rows: [], tooLarge: false, injectedCount: 0 };
  if (body.length > MAX_CLIENT_ERROR_BATCH) {
    return { rawCount: body.length, rows: [], tooLarge: true, injectedCount: 0 };
  }

  const rows: ClientErrorInsert[] = [];
  let injectedCount = 0;
  for (const item of body) {
    if (!isRecord(item) || item.type !== "csp-violation" || !isRecord(item.body)) continue;
    const row = parseCspReport(item.body, item.url, userId, serverUserAgent);
    if (isThirdPartyCspReport(row.details)) {
      injectedCount += 1;
      continue;
    }
    rows.push(row);
  }
  return { rawCount: body.length, rows, tooLarge: false, injectedCount };
}

export function getClientErrorIp(req: Request): string | null {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const raw =
    req.headers.get("cf-connecting-ip") ??
    forwardedFor?.split(",").at(-1)?.trim() ??
    req.headers.get("x-real-ip")?.trim() ??
    "";
  if (!raw || raw.length > 64 || !/^[0-9a-f:.]+$/i.test(raw)) return null;
  return raw;
}

export async function hashClientErrorIdentity(identity: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`log-client-event:${identity}`),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
