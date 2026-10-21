import { describe, expect, it, vi } from "vitest";
import {
  processSePayCheckout,
  type PreparedPayment,
} from "../../shop-sepay-checkout/handler";
import {
  parseSePayIpn,
  processSePayIpn,
  secretMatches,
} from "../../shop-sepay-ipn/handler";
import {
  parseSePayBankWebhook,
  processSePayBankWebhook,
} from "../../shop-sepay-ipn/bank-webhook";

const PAYMENT: PreparedPayment = {
  code: "PH-2608-A1B2",
  invoice_number: "PH-2608-A1B2",
  amount_vnd: 125_000,
  status: "initiated",
};
const CONFIG = {
  bankCode: "MB",
  accountNumber: "0123456789",
  accountName: "THE PICKLE HUB",
};

const PAID_IPN = {
  timestamp: 1_787_857_200,
  notification_type: "ORDER_PAID",
  order: {
    id: "sepay-order-1",
    order_status: "CAPTURED",
    order_currency: "VND",
    order_amount: "125000.00",
    order_invoice_number: "PH-2608-A1B2",
  },
  transaction: {
    payment_method: "BANK_TRANSFER",
    transaction_id: "sepay-txn-1",
    transaction_status: "APPROVED",
    transaction_amount: "125000",
    transaction_currency: "VND",
  },
};

describe("shop SePay checkout", () => {
  it("returns an inline QR with the exact recipient, amount and memo", async () => {
    const result = await processSePayCheckout(
      { code: PAYMENT.code },
      { prepare: vi.fn().mockResolvedValue({ row: PAYMENT, error: null }) },
      CONFIG,
    );
    expect(result.status).toBe(200);
    const qr = new URL(String(result.body.qr_url));
    expect(qr.hostname).toBe("vietqr.app");
    expect(qr.searchParams.get("acc")).toBe(CONFIG.accountNumber);
    expect(qr.searchParams.get("bank")).toBe(CONFIG.bankCode);
    expect(qr.searchParams.get("amount")).toBe("125000");
    expect(qr.searchParams.get("des")).toBe(PAYMENT.invoice_number);
  });

  it("does not prepare invalid, disabled, unconfigured or already-paid orders", async () => {
    const store = { prepare: vi.fn().mockResolvedValue({ row: PAYMENT, error: null }) };
    expect((await processSePayCheckout({ code: "bad" }, store, CONFIG)).status).toBe(400);
    expect(store.prepare).not.toHaveBeenCalled();

    expect((await processSePayCheckout(
      { code: PAYMENT.code },
      store,
      { ...CONFIG, accountNumber: "" },
    )).status).toBe(503);

    expect((await processSePayCheckout(
      { code: PAYMENT.code },
      { prepare: vi.fn().mockResolvedValue({ row: null, error: "SePay chưa được bật" }) },
      CONFIG,
    )).status).toBe(503);

    expect((await processSePayCheckout(
      { code: PAYMENT.code },
      { prepare: vi.fn().mockResolvedValue({ row: { ...PAYMENT, status: "paid" }, error: null }) },
      CONFIG,
    )).status).toBe(409);
  });
});

describe("shop SePay IPN", () => {
  it("compares the configured secret and rejects missing configuration", () => {
    expect(secretMatches("same", "same")).toBe(true);
    expect(secretMatches("same", "different")).toBe(false);
    expect(secretMatches("", "")).toBe(false);
  });

  it("projects only reconciliation fields and parses whole-VND decimals", () => {
    const parsed = parseSePayIpn(PAID_IPN);
    expect(parsed).toMatchObject({
      notification_type: "ORDER_PAID",
      invoice_number: PAYMENT.code,
      order_amount_vnd: 125_000,
      transaction_amount_vnd: 125_000,
      provider_transaction_id: "sepay-txn-1",
    });
    expect(parsed).not.toHaveProperty("card_number");
  });

  it("authenticates before touching the store", async () => {
    const apply = vi.fn();
    const result = await processSePayIpn(PAID_IPN, "wrong", "right", { apply });
    expect(result.status).toBe(401);
    expect(apply).not.toHaveBeenCalled();
  });

  it("acknowledges SePay's headerless dashboard probe without reconciling", async () => {
    const apply = vi.fn();
    const result = await processSePayIpn(
      { notification_type: "PAYMENT_SUCCESS" },
      "",
      "right",
      { apply },
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ success: true, result: "connectivity_test" });
    expect(apply).not.toHaveBeenCalled();
  });

  it("passes an approved IPN to the idempotent database RPC and acknowledges it", async () => {
    const apply = vi.fn().mockResolvedValue({ row: { ok: true, result: "paid" }, error: null });
    const result = await processSePayIpn(PAID_IPN, "right", "right", { apply });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ success: true, result: "paid" });
    expect(apply).toHaveBeenCalledOnce();
  });

  it("rejects malformed amounts before reconciliation", async () => {
    const apply = vi.fn();
    const result = await processSePayIpn({
      ...PAID_IPN,
      transaction: { ...PAID_IPN.transaction, transaction_amount: "125000.50" },
    }, "right", "right", { apply });
    expect(result.status).toBe(400);
    expect(apply).not.toHaveBeenCalled();
  });
});

describe("shop SePay bank webhook", () => {
  const timestamp = 1_787_857_200;
  const secret = "webhook-secret";
  const payload = {
    id: 92704,
    gateway: "MBBank",
    transactionDate: "2026-08-28 10:00:00",
    accountNumber: "0123456789",
    code: null,
    content: "PH2608A1B2 thanh toan",
    transferType: "in",
    transferAmount: 125000,
    referenceCode: "FT2608280001",
  };

  const signatureFor = async (raw: string) => {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const bytes = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${raw}`)),
    );
    return `sha256=${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  };

  it("extracts and normalises the order code from bank content", () => {
    expect(parseSePayBankWebhook(payload, new Date(timestamp * 1000).toISOString())).toMatchObject({
      invoice_number: "PH-2608-A1B2",
      provider_transaction_id: "bank:92704",
      transaction_amount_vnd: 125000,
    });
  });

  it("verifies raw-body HMAC and reconciles an exact incoming transfer", async () => {
    const raw = JSON.stringify(payload);
    const apply = vi.fn().mockResolvedValue({ row: { ok: true, result: "paid" }, error: null });
    const result = await processSePayBankWebhook(
      raw,
      await signatureFor(raw),
      String(timestamp),
      { secret, accountNumber: payload.accountNumber },
      { apply },
      timestamp,
    );
    expect(result.status).toBe(200);
    expect(apply).toHaveBeenCalledOnce();
  });

  it("rejects a changed payload, stale timestamp or wrong recipient before DB", async () => {
    const raw = JSON.stringify(payload);
    const signature = await signatureFor(raw);
    const apply = vi.fn();
    expect((await processSePayBankWebhook(
      `${raw} `, signature, String(timestamp), { secret, accountNumber: payload.accountNumber }, { apply }, timestamp,
    )).status).toBe(401);
    expect((await processSePayBankWebhook(
      raw, signature, String(timestamp), { secret, accountNumber: payload.accountNumber }, { apply }, timestamp + 301,
    )).status).toBe(401);
    expect((await processSePayBankWebhook(
      raw, signature, String(timestamp), { secret, accountNumber: "9999" }, { apply }, timestamp,
    )).status).toBe(422);
    expect(apply).not.toHaveBeenCalled();
  });
});
