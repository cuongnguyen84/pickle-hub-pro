import { secretMatches, type SePayIpnInput, type SePayIpnStore } from "./handler.ts";

export interface BankWebhookConfig {
  secret: string;
  accountNumber: string;
}

export interface BankWebhookResult {
  status: number;
  body: Record<string, unknown>;
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function money(value: unknown): number | null {
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
  if (!/^[0-9]+(?:\.0+)?$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 2_147_483_647 ? parsed : null;
}

function invoiceFrom(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const match = value.toUpperCase().match(/PH[-\s]?(\d{4})[-\s]?([A-F0-9]{4})/);
    if (match) return `PH-${match[1]}-${match[2]}`;
  }
  return null;
}

export function parseSePayBankWebhook(payload: unknown, sentAt: string): SePayIpnInput | null {
  const root = object(payload);
  if (!root || String(root.transferType ?? "").toLowerCase() !== "in") return null;
  const amount = money(root.transferAmount);
  const invoice = invoiceFrom(root.code, root.content, root.description);
  const id = typeof root.id === "number" || typeof root.id === "string" ? String(root.id) : "";
  const reference = typeof root.referenceCode === "string" ? root.referenceCode : id;
  if (
    !amount || !invoice || !id || !reference
    || typeof root.accountNumber !== "string" || !root.accountNumber
  ) return null;

  return {
    notification_type: "ORDER_PAID",
    invoice_number: invoice,
    provider_order_id: reference,
    order_status: "CAPTURED",
    order_amount_vnd: amount,
    order_currency: "VND",
    provider_transaction_id: `bank:${id}`,
    transaction_status: "APPROVED",
    transaction_amount_vnd: amount,
    transaction_currency: "VND",
    payment_method: "BANK_TRANSFER",
    sent_at: sentAt,
  };
}

async function hmacHex(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function processSePayBankWebhook(
  rawBody: string,
  signature: string,
  timestampHeader: string,
  config: BankWebhookConfig,
  store: SePayIpnStore,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<BankWebhookResult> {
  const timestamp = Number(timestampHeader);
  if (
    !config.secret || !Number.isSafeInteger(timestamp)
    || Math.abs(nowSeconds - timestamp) > 300
    || !/^sha256=[a-f0-9]{64}$/i.test(signature)
  ) {
    return { status: 401, body: { error: "unauthorized", code: "unauthorized" } };
  }

  const expected = `sha256=${await hmacHex(`${timestampHeader}.${rawBody}`, config.secret)}`;
  if (!secretMatches(signature.toLowerCase(), expected.toLowerCase())) {
    return { status: 401, body: { error: "unauthorized", code: "unauthorized" } };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: "invalid_json", code: "invalid_json" } };
  }
  const root = object(payload);
  const presentedAccount = typeof root?.accountNumber === "string"
    ? root.accountNumber.replace(/\s+/g, "")
    : "";
  const expectedAccount = config.accountNumber.replace(/\s+/g, "");
  if (!secretMatches(presentedAccount, expectedAccount)) {
    return { status: 422, body: { error: "account_mismatch", code: "account_mismatch" } };
  }

  const input = parseSePayBankWebhook(payload, new Date(timestamp * 1000).toISOString());
  if (!input) return { status: 400, body: { error: "invalid_payload", code: "invalid_payload" } };

  const applied = await store.apply(input);
  if (applied.error || !applied.row) {
    const unknown = applied.error?.toLowerCase().includes("unknown invoice");
    return {
      status: unknown ? 404 : 422,
      body: {
        error: unknown ? "unknown_invoice" : "reconciliation_failed",
        code: unknown ? "unknown_invoice" : "reconciliation_failed",
      },
    };
  }
  return { status: 200, body: { success: true, ...applied.row } };
}
