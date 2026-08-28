export interface SePayCheckoutConfig {
  env: "sandbox" | "production";
  merchantId: string;
  secretKey: string;
  siteUrl: string;
}

export interface PreparedPayment {
  code: string;
  invoice_number: string;
  amount_vnd: number;
  status: "initiated" | "paid" | "voided";
}

export interface SePayCheckoutStore {
  prepare(code: string): Promise<{ row: PreparedPayment | null; error: string | null }>;
}

export interface CheckoutResult {
  status: number;
  body: Record<string, unknown>;
}

const CODE_RE = /^PH-[0-9]{4}-[A-F0-9]{4}$/;

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function hmacSha256Base64(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message))));
}

/** Mirrors the official sepay-pg-node 1.0.0 field insertion/signing order. */
export async function signedCheckoutFields(
  payment: PreparedPayment,
  config: SePayCheckoutConfig,
): Promise<Record<string, string | number>> {
  const orderUrl = `${config.siteUrl.replace(/\/$/, "")}/shop/order/${encodeURIComponent(payment.code)}`;
  const unsigned: Record<string, string | number> = {
    operation: "PURCHASE",
    payment_method: "BANK_TRANSFER",
    order_invoice_number: payment.invoice_number,
    order_amount: payment.amount_vnd,
    currency: "VND",
    order_description: `Thanh toan don hang ${payment.code}`,
    success_url: `${orderUrl}?payment=success`,
    error_url: `${orderUrl}?payment=error`,
    cancel_url: `${orderUrl}?payment=cancel`,
    // The SDK appends merchant after the caller-supplied fields.
    merchant: config.merchantId,
  };
  const message = Object.entries(unsigned).map(([key, value]) => `${key}=${value}`).join(",");
  return { ...unsigned, signature: await hmacSha256Base64(message, config.secretKey) };
}

export async function processSePayCheckout(
  input: unknown,
  store: SePayCheckoutStore,
  config: SePayCheckoutConfig,
): Promise<CheckoutResult> {
  const code = typeof input === "object" && input !== null
    ? (input as Record<string, unknown>).code
    : null;
  if (typeof code !== "string" || !CODE_RE.test(code)) {
    return { status: 400, body: { error: "Mã đơn không hợp lệ.", code: "invalid_order_code" } };
  }
  if (!config.merchantId || !config.secretKey) {
    return { status: 503, body: { error: "SePay chưa được cấu hình.", code: "sepay_not_configured" } };
  }
  if (!/^https:\/\//.test(config.siteUrl) && !/^http:\/\/localhost(?::\d+)?$/.test(config.siteUrl)) {
    return { status: 500, body: { error: "URL trả về chưa hợp lệ.", code: "invalid_site_url" } };
  }

  const prepared = await store.prepare(code);
  if (prepared.error || !prepared.row) {
    const disabled = prepared.error?.toLowerCase().includes("chưa được bật");
    return {
      status: disabled ? 503 : 409,
      body: {
        error: disabled ? "SePay chưa được bật cho Shop." : "Không thể tạo phiên thanh toán cho đơn này.",
        code: disabled ? "sepay_disabled" : "checkout_not_available",
      },
    };
  }
  if (prepared.row.status === "paid") {
    return { status: 409, body: { error: "Đơn đã thanh toán.", code: "already_paid" } };
  }
  if (!Number.isSafeInteger(prepared.row.amount_vnd) || prepared.row.amount_vnd <= 0) {
    return { status: 500, body: { error: "Số tiền đơn không hợp lệ.", code: "invalid_amount" } };
  }

  const fields = await signedCheckoutFields(prepared.row, config);
  const host = config.env === "sandbox" ? "https://pay-sandbox.sepay.vn" : "https://pay.sepay.vn";
  return {
    status: 200,
    body: {
      checkout_url: `${host}/v1/checkout/init`,
      // Form controls are strings on every client. Normalising here also
      // keeps Swift Codable simple without changing the signed representation.
      fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, String(value)])),
      invoice_number: prepared.row.invoice_number,
      environment: config.env,
    },
  };
}
