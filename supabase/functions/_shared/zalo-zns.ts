// ============================================================================
// _shared/zalo-zns.ts — Zalo OA Notification Service helper
// ----------------------------------------------------------------------------
// Wraps the POST /message/template endpoint. Two callers: phone-otp-send
// (PR61, OTP delivery) and request-recovery-link (PR59, recovery link).
//
// Each caller passes its own template_id + template_data and may pass
// `access_token` explicitly (PR65: phone-otp-send loads from the
// `zalo_tokens` DB row which is auto-refreshed every 23h). If no
// access_token arg is given, falls back to ZALO_OA_ACCESS_TOKEN env.
//
// Returns a discriminated union so the caller can decide whether to log
// + fall back. Never throws.
// ============================================================================

export type ZaloResult =
  | { ok: true; provider_message_id?: string }
  | {
      ok: false;
      reason:
        | "not_configured"
        | "api_error"
        | "network_error"
        | "unexpected_response";
      code?: number;
      message?: string;
    };

interface SendArgs {
  /** Phone in international format WITHOUT the leading '+', e.g. "84912345678". */
  phone_no_plus: string;
  template_id: string;
  template_data: Record<string, string | number>;
  tracking_id?: string;
  /**
   * Optional OA access_token override. PR65: callers (phone-otp-send)
   * now load the token from the `zalo_tokens` DB row (auto-refreshed
   * every 23h by `zalo-token-refresh` edge function). If not provided,
   * falls back to ZALO_OA_ACCESS_TOKEN env var so older callers (e.g.
   * request-recovery-link) keep working until they migrate.
   */
  access_token?: string;
}

export async function sendZaloZns(args: SendArgs): Promise<ZaloResult> {
  const accessToken = args.access_token ?? Deno.env.get("ZALO_OA_ACCESS_TOKEN") ?? "";
  if (!accessToken || !args.template_id) {
    return { ok: false, reason: "not_configured" };
  }

  try {
    const res = await fetch(
      "https://business.openapi.zalo.me/message/template",
      {
        method: "POST",
        headers: {
          access_token: accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: args.phone_no_plus,
          template_id: args.template_id,
          template_data: args.template_data,
          tracking_id: args.tracking_id,
        }),
      },
    );

    let body: { error?: number; message?: string; data?: { msg_id?: string } } = {};
    try {
      body = await res.json();
    } catch {
      // ignore — provider returned non-JSON (proxy / gateway error,
      // HTML error page, etc.). Falls through to the unexpected-
      // response branch below.
    }

    // Codex P1 fix: ONLY explicit `error === 0` counts as success.
    // The previous version also accepted `error === undefined`, which
    // let non-JSON responses, proxy/gateway shells, and HTML error
    // pages through — phone-otp-send would then log channel="zalo",
    // success=true and skip the eSMS fallback even though the player
    // never received the OTP. Now any non-zero / missing / non-numeric
    // error field returns ok=false so the caller falls back.
    if (body.error === 0) {
      return { ok: true, provider_message_id: body.data?.msg_id };
    }

    // Explicit non-zero numeric error → Zalo API rejected the call.
    if (typeof body.error === "number") {
      return {
        ok: false,
        reason: "api_error",
        code: body.error,
        message: body.message,
      };
    }

    // Anything else — missing field, non-numeric value, non-JSON body.
    return {
      ok: false,
      reason: "unexpected_response",
      code: res.status,
      message:
        typeof body.message === "string" && body.message.length > 0
          ? body.message
          : `zalo_unexpected_response_${res.status}`,
    };
  } catch (e) {
    return { ok: false, reason: "network_error", message: String(e) };
  }
}
