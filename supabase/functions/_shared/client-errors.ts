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

export function parseJsClientError(
  type: "js_error" | "unhandled_rejection",
  body: unknown,
  userId: string | null,
  serverUserAgent: string | null,
): ParsedClientErrors {
  if (!isRecord(body)) return { rawCount: 1, rows: [], tooLarge: false };
  const message = text(body.message, 1_000);
  if (!message) return { rawCount: 1, rows: [], tooLarge: false };

  const suppliedDetails = isRecord(body.details) ? body.details : {};
  const details = compactDetails({
    filename: sanitizeClientErrorUrl(suppliedDetails.filename),
    lineno: finiteInteger(suppliedDetails.lineno),
    colno: finiteInteger(suppliedDetails.colno),
  });

  return {
    rawCount: 1,
    tooLarge: false,
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
    return {
      rawCount: 1,
      rows: [parseCspReport(body["csp-report"], undefined, userId, serverUserAgent)],
      tooLarge: false,
    };
  }

  if (!Array.isArray(body)) return { rawCount: 0, rows: [], tooLarge: false };
  if (body.length > MAX_CLIENT_ERROR_BATCH) {
    return { rawCount: body.length, rows: [], tooLarge: true };
  }

  const rows: ClientErrorInsert[] = [];
  for (const item of body) {
    if (!isRecord(item) || item.type !== "csp-violation" || !isRecord(item.body)) continue;
    rows.push(parseCspReport(item.body, item.url, userId, serverUserAgent));
  }
  return { rawCount: body.length, rows, tooLarge: false };
}

export function getClientErrorIp(req: Request): string | null {
  const raw =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
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
