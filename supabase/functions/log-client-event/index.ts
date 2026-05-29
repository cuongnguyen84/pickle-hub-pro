// ============================================================================
// log-client-event — receives JS errors + CSP reports from the browser
// ----------------------------------------------------------------------------
// Solo-dev grade error tracker. No JWT required (browser side never has
// service-role; CSP reports are sent by the browser with no auth at all).
// All writes go through the service_role client and bounce off RLS via
// SECURITY DEFINER on the implicit insert.
//
// Endpoint shape:
//
//   POST /functions/v1/log-client-event?type=js_error
//     body: { message, stack?, url?, user_agent?, user_id? }
//
//   POST /functions/v1/log-client-event?type=unhandled_rejection
//     body: same as js_error
//
//   POST /functions/v1/log-client-event?type=csp_violation
//     body: { "csp-report": { ... } }     ← legacy report-uri shape
//     OR  : [ { type:"csp-violation", body:{ ... } } ]  ← Reporting-API
//
// Replies 204 No Content. We never throw user-visible errors — error
// reporting that itself errors out is worse than silent.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
};

interface JsErrorPayload {
  message?: string;
  stack?: string;
  url?: string;
  user_agent?: string;
  user_id?: string;
  details?: Record<string, unknown>;
}

interface CspReportLegacy {
  "csp-report": {
    "document-uri"?: string;
    "violated-directive"?: string;
    "effective-directive"?: string;
    "original-policy"?: string;
    "blocked-uri"?: string;
    "source-file"?: string;
    "line-number"?: number;
    [k: string]: unknown;
  };
}

interface CspReportingApi {
  type: string;
  body: Record<string, unknown>;
  url?: string;
  user_agent?: string;
}

function noContent() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") return noContent();

  const url = new URL(req.url);
  const type = (url.searchParams.get("type") ?? "js_error").toLowerCase();
  const allowed = new Set(["js_error", "unhandled_rejection", "csp_violation"]);
  if (!allowed.has(type)) return noContent();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const text = await req.text();
    if (!text) return noContent();

    // CSP reports can arrive as application/csp-report or
    // application/reports+json. Try to parse both.
    if (type === "csp_violation") {
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { return noContent(); }

      // Legacy report-uri shape: { "csp-report": {...} }
      if (
        parsed &&
        typeof parsed === "object" &&
        "csp-report" in (parsed as object)
      ) {
        const r = (parsed as CspReportLegacy)["csp-report"];
        await supabase.from("client_errors").insert({
          type: "csp_violation",
          message: `${r["violated-directive"] ?? r["effective-directive"] ?? "csp"} blocked ${r["blocked-uri"] ?? ""}`.slice(0, 500),
          url: r["document-uri"] ?? null,
          stack: r["source-file"]
            ? `${r["source-file"]}:${r["line-number"] ?? "?"}`
            : null,
          details: r as unknown as Record<string, unknown>,
        });
        return noContent();
      }

      // Reporting-API shape: [{type, body, url, user_agent}]
      if (Array.isArray(parsed)) {
        for (const rep of parsed as CspReportingApi[]) {
          if (rep.type !== "csp-violation") continue;
          const body = rep.body ?? {};
          await supabase.from("client_errors").insert({
            type: "csp_violation",
            message: `${body["effectiveDirective"] ?? "csp"} blocked ${body["blockedURL"] ?? ""}`.slice(0, 500),
            url: rep.url ?? null,
            user_agent: rep.user_agent ?? null,
            details: body as Record<string, unknown>,
          });
        }
        return noContent();
      }
      return noContent();
    }

    // js_error / unhandled_rejection
    let payload: JsErrorPayload = {};
    try { payload = JSON.parse(text); } catch { return noContent(); }

    // Hard caps so a runaway loop can't fill the table — drop anything
    // outrageous before insert.
    const cap = (s: string | undefined, n: number) =>
      s ? s.slice(0, n) : null;

    await supabase.from("client_errors").insert({
      type,
      message: cap(payload.message, 1000),
      stack: cap(payload.stack, 4000),
      url: cap(payload.url, 500),
      user_agent: cap(payload.user_agent, 500),
      user_id: payload.user_id ?? null,
      details: payload.details ?? null,
    });
  } catch (e) {
    // Never throw — error logging that errors itself is a death spiral.
    console.warn("log-client-event silent error:", e instanceof Error ? e.message : String(e));
  }

  return noContent();
});
