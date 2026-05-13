// ============================================================================
// _shared/zalo-zns.ts — Zalo OA Notification Service helper
// ----------------------------------------------------------------------------
// Wraps the POST /message/template endpoint. Two callers: phone-otp-send
// (PR61, OTP delivery) and request-recovery-link (PR59, recovery link).
//
// Each caller passes its own template_id + template_data. Required env:
//   ZALO_OA_ACCESS_TOKEN  — OA access_token (refresh manually for now)
//
// Returns a discriminated union so the caller can decide whether to log
// + fall back. Never throws.
// ============================================================================

export type ZaloResult =
  | { ok: true; provider_message_id?: string }
  | { ok: false; reason: "not_configured" | "api_error" | "network_error"; code?: number; message?: string };

interface SendArgs {
  /** Phone in international format WITHOUT the leading '+', e.g. "84912345678". */
  phone_no_plus: string;
  template_id: string;
  template_data: Record<string, string | number>;
  tracking_id?: string;
}

export async function sendZaloZns(args: SendArgs): Promise<ZaloResult> {
  const accessToken = Deno.env.get("ZALO_OA_ACCESS_TOKEN") ?? "";
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
      // ignore — provider returned non-JSON
    }

    // Zalo convention: error === 0 → success.
    if (body.error === 0 || body.error === undefined) {
      return { ok: true, provider_message_id: body.data?.msg_id };
    }
    return {
      ok: false,
      reason: "api_error",
      code: body.error,
      message: body.message,
    };
  } catch (e) {
    return { ok: false, reason: "network_error", message: String(e) };
  }
}
