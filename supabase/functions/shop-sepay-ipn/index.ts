import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { jsonResponse } from "../_shared/auth.ts";
import { processSePayIpn, type SePayIpnInput } from "./handler.ts";
import { processSePayBankWebhook } from "./bank-webhook.ts";

const MAX_BODY_BYTES = 64 * 1024;

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed", code: "method_not_allowed" }, 405);
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) return jsonResponse({ error: "payload_too_large", code: "payload_too_large" }, 413);

  let payload: unknown;
  let raw = "";
  try {
    raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return jsonResponse({ error: "payload_too_large", code: "payload_too_large" }, 413);
    }
    payload = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: "invalid_json", code: "invalid_json" }, 400);
  }

  const service = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const store = {
      async apply(input: SePayIpnInput) {
        const { data, error } = await service.rpc("shop_sepay_apply_ipn", {
          _notification_type: input.notification_type,
          _invoice_number: input.invoice_number,
          _provider_order_id: input.provider_order_id,
          _order_status: input.order_status,
          _order_amount_vnd: input.order_amount_vnd,
          _order_currency: input.order_currency,
          _provider_transaction_id: input.provider_transaction_id,
          _transaction_status: input.transaction_status,
          _transaction_amount_vnd: input.transaction_amount_vnd,
          _transaction_currency: input.transaction_currency,
          _payment_method: input.payment_method,
          _sent_at: input.sent_at,
        });
        return { row: data as Record<string, unknown> | null, error: error?.message ?? null };
      },
    };
  const hasBankSignature = Boolean(
    req.headers.get("X-SePay-Signature") || req.headers.get("X-SePay-Timestamp"),
  );
  const result = hasBankSignature
    ? await processSePayBankWebhook(
        raw,
        req.headers.get("X-SePay-Signature") ?? "",
        req.headers.get("X-SePay-Timestamp") ?? "",
        {
          secret: Deno.env.get("SEPAY_WEBHOOK_SECRET") ?? "",
          accountNumber: Deno.env.get("SEPAY_BANK_ACCOUNT_NUMBER") ?? "",
        },
        store,
      )
    : await processSePayIpn(
        payload,
        req.headers.get("X-Secret-Key") ?? "",
        Deno.env.get("SEPAY_IPN_SECRET") ?? Deno.env.get("SEPAY_SECRET_KEY") ?? "",
        store,
      );

  console.log(JSON.stringify({
    function: "shop-sepay-ipn",
    status: result.status,
    has_secret_header: Boolean(req.headers.get("X-Secret-Key")),
    mode: hasBankSignature ? "bank_webhook" : "payment_gateway_ipn",
    notification_type: typeof payload === "object" && payload ? (payload as Record<string, unknown>).notification_type : null,
  }));
  return jsonResponse(result.body, result.status);
});
