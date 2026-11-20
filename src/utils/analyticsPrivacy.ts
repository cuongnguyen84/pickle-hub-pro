// Keep private URL cases in parity with index.html's pre-SDK guard (tests do).
export function isPrivateAnalyticsUrl(input: string, base = "https://www.thepicklehub.net"): boolean {
  try {
    const url = new URL(input, base);
    const path = decodeURIComponent(url.pathname).replace(/\/+/g, "/").toLowerCase();
    if (/^\/(?:vi\/)?(?:dang-ky|join|auth|reset-password|update-password|khoi-phuc-dang-ky)(?:\/|$)/.test(path)) return true;
    if (/(?:access_token|refresh_token|magic_token|authorization|password|otp|session|(?:^|[&#])code)=/i.test(url.hash)) return true;
    for (const [key, value] of url.searchParams) {
      if (/token|secret|code|otp|phone|email|password|session|authorization/i.test(key) || /(?:dang-ky(?:\/|%2f)|(?:access_token|refresh_token|magic_token|code|otp|password)(?:=|%3d))/i.test(value)) return true;
    }
    return false;
  } catch { return true; }
}
export function analyticsLocation(input: string): { page_path: string; page_location: string; page_referrer: string } | null {
  if (isPrivateAnalyticsUrl(input)) return null;
  try { const url = new URL(input); return { page_path: url.pathname, page_location: `${url.origin}${url.pathname}`, page_referrer: "" }; } catch { return null; }
}
export function analyticsProps(params: Record<string, unknown> = {}): Record<string, string | number | boolean> {
  const safe: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (/token|secret|code|otp|phone|email|password|authorization|session|^name$|^page_|referrer/i.test(key)) continue;
    if (typeof value === "number" && Number.isFinite(value) || typeof value === "boolean") safe[key] = value;
    else if (typeof value === "string" && value.length <= 100) {
      if (key !== "journey_id" && /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(value)) continue;
      if (/@|(?:bearer\s|eyJ[a-z0-9_-]+\.)|(?:dang-ky(?:\/|%2f)|(?:access_token|refresh_token|magic_token|code|otp|password)(?:=|%3d))/i.test(value)) continue;
      if (/^(?:https?:\/\/|\/)/i.test(value)) {
        if (isPrivateAnalyticsUrl(value)) continue;
        try { safe[key] = new URL(value, "https://www.thepicklehub.net").pathname; } catch { /* omit */ }
      } else safe[key] = value;
    }
  }
  return safe;
}
