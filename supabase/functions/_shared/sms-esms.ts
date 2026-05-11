// ============================================================================
// _shared/sms-esms.ts — eSMS.vn brandname SMS gateway client
// ----------------------------------------------------------------------------
// Docs: https://developer.esms.vn/api-rest/gui-tin-thuong  (SmsType 2 =
// brandname). Endpoint takes ApiKey/SecretKey/Brandname/Phone/Content
// as JSON; returns CodeResult "100" on accept-for-delivery.
//
// We deliberately keep this thin: one function, no retries, no queueing.
// The caller (phone-otp-send) handles dev-mode bypass + structured logging.
//
// Required env on the edge function:
//   ESMS_API_KEY     — eSMS API key
//   ESMS_SECRET_KEY  — eSMS secret key
//   ESMS_BRAND_NAME  — registered brandname (e.g. "PickleHub")
//
// Optional:
//   ESMS_BASE_URL    — defaults to https://rest.esms.vn/MainService.svc/json
//   ESMS_SMS_TYPE    — defaults to "2" (brandname). Use "8" for fixed-number.
// ============================================================================

interface EsmsSendResult {
  ok: boolean;
  /** Provider-side message id when delivered, null on failure. */
  messageId: string | null;
  /** Raw provider response code (e.g. "100" = OK). */
  codeResult: string | null;
  /** Provider error string if any. */
  errorMessage: string | null;
}

interface EsmsResponseShape {
  CodeResult?: string;
  ErrorMessage?: string;
  SMSID?: string;
}

/**
 * Send an SMS via eSMS.vn brandname route. Returns a normalized result
 * — callers should never throw on send failure; the OTP row is still
 * persisted server-side so the user can use Resend-OTP if delivery
 * silently fails.
 *
 * `phoneE164` is converted to the 84xxxxxxxxx form the gateway expects
 * (no plus sign). Non-VN numbers are passed through unchanged — eSMS
 * supports international routing for some carriers.
 */
export async function sendBrandnameSms(args: {
  phoneE164: string;
  content: string;
}): Promise<EsmsSendResult> {
  const apiKey = Deno.env.get("ESMS_API_KEY") ?? "";
  const secretKey = Deno.env.get("ESMS_SECRET_KEY") ?? "";
  const brandName = Deno.env.get("ESMS_BRAND_NAME") ?? "";
  const baseUrl =
    Deno.env.get("ESMS_BASE_URL") ?? "https://rest.esms.vn/MainService.svc/json";
  const smsType = Deno.env.get("ESMS_SMS_TYPE") ?? "2";

  if (!apiKey || !secretKey || !brandName) {
    return {
      ok: false,
      messageId: null,
      codeResult: null,
      errorMessage: "esms_credentials_missing",
    };
  }

  const phoneForGateway = args.phoneE164.startsWith("+")
    ? args.phoneE164.slice(1)
    : args.phoneE164;

  const body = {
    ApiKey: apiKey,
    SecretKey: secretKey,
    Content: args.content,
    Phone: phoneForGateway,
    Brandname: brandName,
    SmsType: smsType,
    IsUnicode: "0",
  };

  try {
    const resp = await fetch(`${baseUrl}/SendMultipleMessage_V4_post_json/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      return {
        ok: false,
        messageId: null,
        codeResult: null,
        errorMessage: `http_${resp.status}`,
      };
    }
    const json = (await resp.json()) as EsmsResponseShape;
    const codeResult = json.CodeResult ?? null;
    const ok = codeResult === "100";
    return {
      ok,
      messageId: json.SMSID ?? null,
      codeResult,
      errorMessage: ok ? null : (json.ErrorMessage ?? null),
    };
  } catch (e) {
    return {
      ok: false,
      messageId: null,
      codeResult: null,
      errorMessage: e instanceof Error ? e.message : "fetch_failed",
    };
  }
}
