import { describe, expect, it, vi } from "vitest";
import {
  processSePayCheckout,
  signedCheckoutFields,
  type PreparedPayment,
} from "../../shop-sepay-checkout/handler";
import {
  parseSePayIpn,
  processSePayIpn,
  secretMatches,
} from "../../shop-sepay-ipn/handler";

const PAYMENT: PreparedPayment = {
  code: "PH-2608-A1B2",
  invoice_number: "PH-2608-A1B2",
  amount_vnd: 125_000,
  status: "initiated",
};
const CONFIG = {
  env: "sandbox" as const,
  merchantId: "MERCHANT_TEST",
  secretKey: "secret-test",
  siteUrl: "https://www.thepicklehub.net",
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
  it("matches the official SDK 1.0.0 HMAC field order", async () => {
    const fields = await signedCheckoutFields(PAYMENT, CONFIG);
    expect(fields.signature).toBe("It/HAWppjn61H/pvGq6UvvMoSocuBt/Z3//+4+bt/mk=");
    expect(Object.keys(fields)).toEqual([
      "operation", "payment_method", "order_invoice_number", "order_amount", "currency",
      "order_description", "success_url", "error_url", "cancel_url", "merchant", "signature",
    ]);
  });

  it("returns the sandbox form action without exposing the secret", async () => {
    const result = await processSePayCheckout(
      { code: PAYMENT.code },
      { prepare: vi.fn().mockResolvedValue({ row: PAYMENT, error: null }) },
      CONFIG,
    );
    expect(result.status).toBe(200);
    expect(result.body.checkout_url).toBe("https://pay-sandbox.sepay.vn/v1/checkout/init");
    expect(JSON.stringify(result.body)).not.toContain(CONFIG.secretKey);
  });

  it("does not sign invalid, disabled or already-paid orders", async () => {
    const store = { prepare: vi.fn().mockResolvedValue({ row: PAYMENT, error: null }) };
    expect((await processSePayCheckout({ code: "bad" }, store, CONFIG)).status).toBe(400);
    expect(store.prepare).not.toHaveBeenCalled();

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

  it("acknowledges SePay's authenticated dashboard probe without reconciling", async () => {
    const apply = vi.fn();
    const result = await processSePayIpn(
      { notification_type: "PAYMENT_SUCCESS" },
      "right",
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
